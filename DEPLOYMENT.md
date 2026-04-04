# Dungeon Master OS — Production Deployment Guide

## Stack

- **Runtime:** Node.js 18+ (single process, single port)
- **Database:** SQLite (auto-created, no setup required)
- **Backend:** Express + WebSocket
- **Frontend:** Vite/React (built to `dist/public`, served as static files by Express)
- **Auth:** JWT in httpOnly cookies
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

```bash
npm install
```

### 4. Configure environment

```bash
cp .env.example .env
nano .env  # Fill in all required values
```

Required values:
- `JWT_SECRET` — long random string (generate with: `openssl rand -hex 64`)
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

## Running with PM2 (recommended for production)

```bash
npm install -g pm2

# Start
pm2 start dist/index.cjs --name dmos --env production

# Auto-restart on reboot
pm2 startup
pm2 save

# View logs
pm2 logs dmos

# Restart after update
npm run build && pm2 restart dmos
```

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

To backup the database:
```bash
cp data.db data.db.backup-$(date +%Y%m%d)
# Or use sqlite3's online backup:
sqlite3 data.db ".backup data.db.backup"
```

---

## Updating

```bash
git pull
npm install
npm run build
pm2 restart dmos
```

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
