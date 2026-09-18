import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function runTsx(source, extraEnv = {}) {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-auth-test-'));
  const env = { ...process.env, DATABASE_URL: path.join(dbDir, 'test.db'), ...extraEnv };
  delete env.JWT_SECRET;
  const result = spawnSync(path.join(repoRoot, 'node_modules', '.bin', 'tsx'), ['-e', source], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
  rmSync(dbDir, { recursive: true, force: true });
  return result;
}

test('production auth fails closed when JWT_SECRET is missing', () => {
  const result = runTsx("import('./server/auth.ts').then(({ signToken }) => signToken(1));", {
    NODE_ENV: 'production',
  });
  assert.notEqual(result.status, 0, 'production signToken unexpectedly succeeded without JWT_SECRET');
  assert.match(`${result.stdout}\n${result.stderr}`, /JWT_SECRET must be set in production/);
});

test('DungeonMaster auth helpers remain exported for protected admin routes', () => {
  const result = runTsx(`
    import('./server/auth.ts').then((auth) => {
      const required = ['hasDungeonMasterAccess', 'requireDungeonMaster', 'grantDungeonMasterAccess', 'revokeDungeonMasterAccess'];
      const missing = required.filter((name) => typeof auth[name] !== 'function');
      if (missing.length) throw new Error('missing exports: ' + missing.join(', '));
    });
  `, { NODE_ENV: 'test' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});


test('Google sign-in remains wired through server, storage, schema, and auth UI', () => {
  const googleAuthPath = path.join(repoRoot, 'server', 'google-auth.ts');
  assert.equal(existsSync(googleAuthPath), true, 'server/google-auth.ts is missing');

  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');
  const storage = readFileSync(path.join(repoRoot, 'server', 'storage.ts'), 'utf8');
  const schema = readFileSync(path.join(repoRoot, 'shared', 'schema.ts'), 'utf8');
  const authPage = readFileSync(path.join(repoRoot, 'client', 'src', 'pages', 'auth.tsx'), 'utf8');

  assert.match(routes, /\/api\/auth\/google\/status/);
  assert.match(routes, /\/api\/auth\/google\/callback/);
  assert.match(storage, /getUserByGoogleId/);
  assert.match(schema, /googleId:\s*text\(["']google_id["']\)/);
  assert.match(authPage, /Continue with Google/);
});

test('Google OAuth authorization URL uses the configured callback and state', () => {
  const result = runTsx(`
    import('./server/google-auth.ts').then(({ buildGoogleAuthorizationUrl }) => {
      const url = new URL(buildGoogleAuthorizationUrl('state-123'));
      if (url.origin !== 'https://accounts.google.com') throw new Error('wrong google origin');
      if (url.searchParams.get('state') !== 'state-123') throw new Error('missing state');
      if (url.searchParams.get('redirect_uri') !== 'https://dungeonmaster-os.com/api/auth/google/callback') throw new Error('wrong callback');
      if (url.searchParams.get('scope') !== 'openid email profile') throw new Error('wrong scope');
    });
  `, {
    NODE_ENV: 'test',
    APP_URL: 'https://dungeonmaster-os.com',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('current DungeonMaster access accepts either the DungeonMaster role or legacy admin flag', () => {
  const result = runTsx(`
    import('./server/auth.ts').then(({ hasDungeonMasterAccess }) => {
      const cases = [
        [{ role: 'player', isAdmin: false }, false],
        [{ role: 'dungeon_master', isAdmin: false }, true],
        [{ role: 'player', isAdmin: true }, true],
        [{ role: 'dungeon_master', isAdmin: true }, true],
      ];
      for (const [user, expected] of cases) {
        if (hasDungeonMasterAccess(user) !== expected) {
          throw new Error('DungeonMaster compatibility contract changed for ' + JSON.stringify(user));
        }
      }
    });
  `, { NODE_ENV: 'test' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('legacy DungeonMaster grant and revoke semantics stay pinned during auth migration', () => {
  const auth = readFileSync(path.join(repoRoot, 'server', 'auth.ts'), 'utf8');

  assert.match(
    auth,
    /grantDungeonMasterAccess[\s\S]*?role:\s*["']dungeon_master["'][\s\S]*?isAdmin:\s*true[\s\S]*?unlimitedTurns:\s*true/,
    'grant compatibility must keep role/admin/unlimited access together until the entitlement migration is explicit',
  );
  assert.match(
    auth,
    /revokeDungeonMasterAccess[\s\S]*?role:\s*["']player["'][\s\S]*?isAdmin:\s*false[\s\S]*?unlimitedTurns:\s*false/,
    'revoke compatibility must keep role/admin/unlimited access together until the entitlement migration is explicit',
  );
});

test('browser session cookie contract remains rollback-compatible while v2 sessions migrate', () => {
  const auth = readFileSync(path.join(repoRoot, 'server', 'auth.ts'), 'utf8');

  assert.match(auth, /COOKIE_NAME\s*=\s*["']dmos_session["']/);
  assert.match(auth, /OPAQUE_COOKIE_NAME\s*=\s*["']dmos_session_v2["']/);
  assert.match(auth, /SESSION_MAX_AGE_MS\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(auth, /httpOnly:\s*true/);
  assert.match(auth, /maxAge:\s*SESSION_MAX_AGE_MS/);
  assert.match(auth, /path:\s*["']\/["']/);
});

test('access policy preserves current legacy capability semantics during separation', () => {
  const result = runTsx(`
    import('./server/access-policy.ts').then(({ resolveAccessCapabilities }) => {
      const cases = [
        [
          { role: 'player', isAdmin: false, unlimitedTurns: false },
          { dungeonMasterAccess: false, subscriptionBypass: false, campaignLimitBypass: false, unlimitedAiTurns: false },
        ],
        [
          { role: 'dungeon_master', isAdmin: false, unlimitedTurns: false },
          { dungeonMasterAccess: true, subscriptionBypass: true, campaignLimitBypass: true, unlimitedAiTurns: true },
        ],
        [
          { role: 'player', isAdmin: true, unlimitedTurns: false },
          { dungeonMasterAccess: true, subscriptionBypass: true, campaignLimitBypass: true, unlimitedAiTurns: true },
        ],
        [
          { role: 'player', isAdmin: false, unlimitedTurns: true },
          { dungeonMasterAccess: false, subscriptionBypass: false, campaignLimitBypass: false, unlimitedAiTurns: true },
        ],
      ];

      for (const [user, expected] of cases) {
        const actual = resolveAccessCapabilities(user);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error('legacy capability mapping changed for ' + JSON.stringify(user) + ': ' + JSON.stringify(actual));
        }
      }
    });
  `, { NODE_ENV: 'test' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('entitlement resolvers preserve legacy subscription, campaign, and AI outcomes', () => {
  const result = runTsx(`
    import('./server/entitlements.ts').then(({ resolvePlayEntitlement, resolveCampaignEntitlement, resolveAiEntitlement }) => {
      const base = {
        id: 1,
        email: 'test@example.invalid',
        username: 'tester',
        passwordHash: 'x',
        googleId: null,
        googleEmail: null,
        avatarUrl: null,
        role: 'player',
        tier: 'free',
        subscriptionStatus: 'expired',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeBillingInterval: null,
        trialEndsAt: null,
        subscriptionCurrentPeriodEnd: null,
        aiTurnsUsedThisMonth: 0,
        bonusTurns: 0,
        usageResetAt: null,
        onboardingComplete: true,
        unlimitedTurns: false,
        isAdmin: false,
        createdAt: new Date().toISOString(),
      };

      const normal = { ...base };
      if (resolvePlayEntitlement(normal).canPlay !== false) throw new Error('expired player unexpectedly playable');
      if (resolvePlayEntitlement(normal).readOnly !== true) throw new Error('expired player lost read-only mode');
      if (resolveCampaignEntitlement(normal).unlimited !== false) throw new Error('normal player unexpectedly bypasses campaign limit');
      if (resolveAiEntitlement(normal).unlimited !== false) throw new Error('normal player unexpectedly has unlimited AI');

      const dm = { ...base, role: 'dungeon_master' };
      if (resolvePlayEntitlement(dm).canPlay !== true) throw new Error('DungeonMaster lost play bypass');
      if (resolvePlayEntitlement(dm).readOnly !== false) throw new Error('DungeonMaster became read-only');
      if (resolveCampaignEntitlement(dm).unlimited !== true) throw new Error('DungeonMaster lost campaign bypass');
      if (resolveAiEntitlement(dm).unlimited !== true) throw new Error('DungeonMaster lost unlimited AI');

      const admin = { ...base, isAdmin: true };
      if (resolvePlayEntitlement(admin).canPlay !== true) throw new Error('legacy admin lost play bypass');
      if (resolveCampaignEntitlement(admin).unlimited !== true) throw new Error('legacy admin lost campaign bypass');
      if (resolveAiEntitlement(admin).unlimited !== true) throw new Error('legacy admin lost unlimited AI');

      const unlimitedOnly = { ...base, unlimitedTurns: true };
      if (resolvePlayEntitlement(unlimitedOnly).canPlay !== false) throw new Error('unlimited-turn flag incorrectly bypassed subscription');
      if (resolveCampaignEntitlement(unlimitedOnly).unlimited !== false) throw new Error('unlimited-turn flag incorrectly bypassed campaign limit');
      if (resolveAiEntitlement(unlimitedOnly).unlimited !== true) throw new Error('unlimited-turn flag lost AI bypass');
    });
  `, { NODE_ENV: 'test' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('auth middleware consumes entitlement resolvers instead of duplicating product rules', () => {
  const auth = readFileSync(path.join(repoRoot, 'server', 'auth.ts'), 'utf8');

  assert.match(auth, /resolvePlayEntitlement\(req\.user\)/);
  assert.match(auth, /resolveCampaignEntitlement\(user\)/);
  assert.match(auth, /resolveAiEntitlement\(user\)/);
  assert.doesNotMatch(auth, /hasDungeonMasterAccess\(user\) \|\| user\.unlimitedTurns/);
});

test('WebSocket authentication uses the same dual-session resolver as HTTP auth', () => {
  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');

  assert.match(routes, /getSessionUserIdFromCookieHeader\(cookieHeader\)/);
  assert.doesNotMatch(routes, /const payload = verifyToken\(token\)/);
});


test('password rotation routes invalidate prior sessions and preserve the intended browser outcome', () => {
  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');

  const changeStart = routes.indexOf('app.post("/api/auth/change-password"');
  const forgotStart = routes.indexOf('app.post("/api/auth/forgot-password"', changeStart);
  const resetStart = routes.indexOf('app.post("/api/auth/reset-password"', forgotStart);
  const accountRoutesStart = routes.indexOf('// USER / ACCOUNT ROUTES', resetStart);

  assert.notEqual(changeStart, -1);
  assert.notEqual(forgotStart, -1);
  assert.notEqual(resetStart, -1);
  assert.notEqual(accountRoutesStart, -1);

  const changePassword = routes.slice(changeStart, forgotStart);
  const resetPassword = routes.slice(resetStart, accountRoutesStart);

  assert.match(changePassword, /updateUserPasswordAndBumpAuthVersion\(user\.id, passwordHash\)/);
  assert.match(changePassword, /revokeAllOpaqueSessionsForUser\(user\.id\)/);
  assert.match(changePassword, /setSessionCookie\(res, user\.id, ["']password["'], authVersion\)/);

  assert.match(resetPassword, /updateUserPasswordAndBumpAuthVersion\(resetToken\.userId, passwordHash\)/);
  assert.match(resetPassword, /revokeAllOpaqueSessionsForUser\(resetToken\.userId\)/);
  assert.match(resetPassword, /clearSessionCookie\(res\)/);
});

test('auth version remains internal and is stripped from public user payloads', () => {
  const result = runTsx(`
    import('./server/auth.ts').then(({ toPublicUser }) => {
      const publicUser = toPublicUser({
        id: 1,
        email: 'public@example.invalid',
        username: 'public_user',
        passwordHash: 'secret-hash',
        googleId: 'google-subject',
        googleEmail: 'public@example.invalid',
        avatarUrl: null,
        role: 'player',
        tier: 'free',
        subscriptionStatus: 'trial',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeBillingInterval: null,
        trialEndsAt: null,
        subscriptionCurrentPeriodEnd: null,
        aiTurnsUsedThisMonth: 0,
        bonusTurns: 0,
        usageResetAt: null,
        onboardingComplete: false,
        unlimitedTurns: false,
        isAdmin: false,
        authVersion: 7,
        createdAt: new Date().toISOString(),
      });

      if ('passwordHash' in publicUser) throw new Error('password hash leaked');
      if ('googleId' in publicUser) throw new Error('Google provider subject leaked');
      if ('authVersion' in publicUser) throw new Error('auth version leaked');
    });
  `, { NODE_ENV: 'test' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});


test('Google OAuth PKCE uses a high-entropy verifier and S256 challenge', () => {
  const result = runTsx(`
    import('./server/google-auth.ts').then((auth) => {
      const verifier = auth.generateGooglePkceVerifier();
      const challenge = auth.buildGooglePkceChallenge(verifier);
      const url = new URL(auth.buildGoogleAuthorizationUrl('state-pkce', challenge));

      if (verifier.length < 43 || verifier.length > 128) throw new Error('invalid verifier length');
      if (!/^[A-Za-z0-9_-]+$/.test(verifier)) throw new Error('verifier is not base64url');
      if (!challenge || challenge.includes('=')) throw new Error('challenge is not base64url');
      if (url.searchParams.get('code_challenge') !== challenge) throw new Error('missing PKCE challenge');
      if (url.searchParams.get('code_challenge_method') !== 'S256') throw new Error('wrong PKCE method');
    });
  `, {
    NODE_ENV: 'test',
    APP_URL: 'https://dungeonmaster-os.com',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('Google OAuth routes persist and consume the PKCE verifier while preserving legacy callback compatibility', () => {
  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');
  const googleAuth = readFileSync(path.join(repoRoot, 'server', 'google-auth.ts'), 'utf8');

  assert.match(routes, /GOOGLE_PKCE_COOKIE/);
  assert.match(routes, /generateGooglePkceVerifier\(\)/);
  assert.match(routes, /buildGooglePkceChallenge\(codeVerifier\)/);
  assert.match(routes, /setShortLivedCookie\(res, GOOGLE_PKCE_COOKIE, codeVerifier\)/);
  assert.match(routes, /exchangeGoogleCodeForProfile\(code, codeVerifier\)/);
  assert.match(googleAuth, /\.\.\.\(codeVerifier \? \{ code_verifier: codeVerifier \} : \{\}\)/);
});
