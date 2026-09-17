# Dungeon Master OS — Production Deployment Guide

## Stack

- **Runtime:** Node.js 18+ (single process, single port)
- **Database:** SQLite (auto-created, no setup required)
- **Backend:** Express + WebSocket
- **Frontend:** Vite/React (built to `dist/public`, served as static files by Express)
- **Auth:** revocable opaque server sessions in httpOnly cookies, with temporary legacy JWT rollback compatibility + Google OAuth for linked identities
- **Payments:** Stripe Checkout + Customer Portal
- **AI:** Anthropic Claude (via API)

---

## Quick Start on a VPS

### 1. Install Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clone / upload the project

```bash
git clone https://your-repo/dungeon-master-os.git /opt/dungeon-master-os
cd /opt/dungeon-master-os
```

### 3. Install dependencies

Use the committed lockfile so release dependency resolution is deterministic:

```bash
npm ci
```

Do not use `npm install` as the production release step. If dependencies need to change, update and verify the lockfile in the testing/review workflow first.

### 4. Configure environment

```bash
cp .env.example .env
nano .env  # Fill in all required values
```

Required values:
- `JWT_SECRET` — long random string (generate with: `openssl rand -hex 64`)
- `AUTH_LEGACY_SESSION_ACCEPT` — keep `true` during the v2 compatibility window so pre-upgrade JWT-only clients continue to work
- `AUTH_LEGACY_SESSION_ISSUE` — keep `true` while the rollback target is an older JWT-only release; new logins then receive both legacy and v2 cookies
- `GOOGLE_CLIENT_ID` — Google OAuth client ID for existing and new Google-linked accounts
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `GOOGLE_OAUTH_REDIRECT_URL` — optional explicit callback; otherwise `${APP_URL}/api/auth/google/callback`
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `STRIPE_SECRET_KEY` — from Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET` — from Stripe Webhook settings
- `STRIPE_PUBLISHABLE_KEY` — from Stripe Dashboard
- All `STRIPE_PRICE_*` values — create products/prices in Stripe first
- `APP_URL` — your public domain, e.g. `https://dungeonmaster.os`

### 5. Build the frontend

```bash
npm run build
```

This outputs:
- `dist/index.cjs` — compiled server bundle
- `dist/public/` — compiled frontend (served as static files)

### 6. Start the server

```bash
npm run start
# or: NODE_ENV=production node dist/index.cjs
```

The server runs on port 5000 by default. Set `PORT=` in `.env` to change.

---

## Running with systemd

Voidsmith production uses systemd for DMOS. Keep the application release immutable and keep writable state outside the release directory.

Example unit shape:

```ini
[Unit]
Description=Dungeon Master OS
After=network.target

[Service]
Type=simple
User=dmos
Group=dmos
WorkingDirectory=/srv/dmos/app/current
EnvironmentFile=/srv/dmos/shared/dmos.env
ExecStart=/usr/bin/node /srv/dmos/app/current/dist/index.cjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Operational commands:

```bash
sudo systemctl status dmos
sudo systemctl restart dmos
sudo journalctl -u dmos --since "10 minutes ago"
```

Do not edit the active release in place. Build and verify a new immutable release, then move the `current` pointer only after all release gates pass.

---

## Nginx reverse proxy (recommended)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # WebSocket support
    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
    }

    # Stripe webhook (raw body needed)
    location /api/stripe/webhook {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API + static
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }
}
```

Install SSL with Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Setting up Stripe

1. Go to Stripe Dashboard → Products
2. Create one product per tier (Adventurer, Campaign Master, Legend, Chronicler)
3. Add recurring prices (monthly, weekly, yearly) to each product
4. Add one-time prices for each top-up pack size per tier
5. Copy all price IDs into your `.env` file
6. Set up webhook endpoint:
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
7. Copy webhook signing secret into `STRIPE_WEBHOOK_SECRET`

---

## Database

The SQLite database is auto-created at startup (default: `./data.db`).
All migrations run automatically on first start — no manual steps needed.

To use a different path:
```
DATABASE_URL=/var/data/dmos/data.db
```

Use SQLite online backup semantics rather than copying a live WAL-mode database file directly:

```bash
node script/backup-database.mjs \
  --source /path/to/data.db \
  --output /path/to/backups/data.db.$(date +%Y%m%dT%H%M%S).sqlite
```

The backup command checks the source database, performs SQLite's online backup, then verifies the resulting backup with `PRAGMA quick_check`.

Restore into a **new target path** first; the restore tool deliberately refuses to overwrite an existing database:

```bash
node script/restore-database.mjs \
  --backup /path/to/backups/data.db.YYYYMMDDTHHMMSS.sqlite \
  --target /path/to/restore-check/data.db
```

Verify the restored database before any production cutover. Never replace the live database merely because a backup command returned success.

---

## Updating / releasing V1

Production releases are immutable. Do not `git pull` into the active release and do not rebuild in place.

Before a release candidate can be promoted, verify it from a clean install:

```bash
npm ci
npm run release:verify
```

`release:verify` is the canonical local/CI gate. It runs TypeScript checking, the full regression suite (whose `pretest` builds the production artifact), and the production dependency audit at high severity. Pull requests and pushes to `main` run the same gate in GitHub Actions.

### Authentication continuity invariant

Google-linked users are durable production identities. A release must never remove or silently detach Google authentication while `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured. The regression suite must retain coverage for the Google auth module, route registration, storage lookup, schema identity fields, UI entry point, callback URI/state handling, and public-user redaction.

Before promotion and again after cutover:

- `/api/auth/google/status` must exist and report Google sign-in enabled when production Google credentials are configured.
- `/api/auth/google/start` must redirect to Google and set the OAuth state cookie with `HttpOnly`, `Secure` and `SameSite=Lax` in production.
- invalid or mismatched OAuth state must fail closed.
- an existing Google-linked identity must resolve to its existing user record rather than creating a duplicate account.
- `googleId` must never appear in the public user payload.

Treat failure of any authentication-continuity check as a release blocker. Roll back application code without rolling back user data unless a separately verified database rollback is actually required.

### Revocable session migration and rollback invariant

The v2 session rollout is deliberately additive:

- `dmos_session_v2` is a random opaque bearer token. Only its SHA-256 hash is stored in the additive `auth_sessions` table.
- `dmos_session` remains the legacy signed JWT during the initial compatibility window.
- HTTP and WebSocket authentication prefer a valid v2 session. Legacy JWT fallback is used only when no v2 cookie is present.
- If a v2 cookie is present but revoked or invalid, DMOS must not fall back to the legacy JWT beside it. This prevents a revoked v2 session from being resurrected.
- JWT-only HTTP sessions are upgraded additively by setting `dmos_session_v2`; the existing JWT cookie is left untouched so the previous release can still authenticate the browser after an application rollback.
- Logout revokes the current v2 session and clears both cookies.
- While the rollback target is JWT-only, keep both `AUTH_LEGACY_SESSION_ACCEPT=true` and `AUTH_LEGACY_SESSION_ISSUE=true`.
- Do not stop issuing the legacy cookie until the selected rollback release also understands v2 sessions. After that point, issuance may be disabled while acceptance remains enabled for at least the maximum seven-day legacy lifetime; only then may legacy acceptance be disabled.
- During the compatibility window, a copied legacy JWT retains its historical non-revocable lifetime. This is a bounded migration risk, not a property of the final session architecture.

The `auth_sessions` migration is additive and does not rewrite users, credentials, campaigns, billing records, or existing JWT cookies. A code rollback therefore does not require a database rollback.

Then:

1. Create a verified online backup of the production SQLite database.
2. Record the current `app/current` release target and bundle checksum as the rollback target.
3. Materialize the new release into a new immutable release directory.
4. Point the release at the existing shared environment/database paths without copying writable state into the release.
5. Run migrations and smoke checks against the intended release path before cutover where the deployment workflow supports it.
6. Atomically move the `current` symlink to the new release.
7. Restart `dmos.service`.
8. Verify service status, HTTPS readback, authentication, campaign access, WebSocket subscription, AI availability and billing configuration.
9. If a release gate fails, immediately restore the previous `current` pointer and restart the service. Restore the database only if the failed release performed a destructive/incompatible data change and the verified backup is required.

The application rollback and database rollback are separate decisions. Do not roll back user data merely to roll back application code.

---

## File Structure

```
dist/            ← Build output (created by npm run build)
  index.cjs      ← Compiled server
  public/        ← Compiled frontend
server/          ← Express backend
client/          ← React frontend
shared/          ← Shared types/logic
data.db          ← SQLite database (auto-created)
.env             ← Your configuration (DO NOT commit)
```

---

## Health check

```bash
curl http://localhost:5000/api/auth/me
# Should return 401 {"message":"Sign in to continue."}
# This means the server is running
```

---

## Troubleshooting

**Port already in use:**
```bash
PORT=3000 npm run start
```

**Database locked errors:**
SQLite WAL mode is enabled by default. Ensure only one process accesses the DB.

**JWT errors after redeployment:**
If you change `JWT_SECRET`, all existing sessions will be invalidated (users must log in again). This is expected.

**Stripe webhooks not working locally:**
Use Stripe CLI to forward webhooks:
```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
```
