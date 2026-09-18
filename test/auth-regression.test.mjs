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

test('canonical DungeonMaster access is role-aware with legacy fallback', () => {
  const result = runTsx(`
    import('./server/auth.ts').then(({ hasDungeonMasterAccess }) => {
      const cases = [
        [{ role: 'player', isAdmin: false }, false],
        [{ role: 'dungeon_master', isAdmin: false }, true],
        [{ role: 'player', isAdmin: true }, true],
        [{ role: 'player', accessRole: 'player', isAdmin: true }, false],
        [{ role: 'player', accessRole: 'dungeon_master', isAdmin: false }, true],
        [{ role: 'player', accessRole: 'moderator', isAdmin: false }, false],
        [{ role: 'player', accessRole: 'admin', isAdmin: false }, true],
      ];
      for (const [user, expected] of cases) {
        if (hasDungeonMasterAccess(user) !== expected) {
          throw new Error('DungeonMaster role mapping changed for ' + JSON.stringify(user));
        }
      }
    });
  `, { NODE_ENV: 'test' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('DungeonMaster grant and revoke change only the canonical role', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/auth.ts'),
      import('./server/storage.ts'),
    ]).then(([auth, storageMod]) => {
      storageMod.runMigrations();
      const created = storageMod.storage.createUser({
        email: 'role-split@example.invalid',
        username: 'role_split_user',
        passwordHash: 'test-hash',
      });

      const granted = auth.grantDungeonMasterAccess(created.id);
      if (!granted || granted.accessRole !== 'dungeon_master') throw new Error('DungeonMaster role was not granted');
      if (granted.role !== 'player' || granted.isAdmin || granted.unlimitedTurns) {
        throw new Error('DungeonMaster grant mutated legacy privilege flags');
      }
      if (granted.subscriptionBypass || granted.campaignLimitBypass || granted.unlimitedAiTurns) {
        throw new Error('DungeonMaster grant mutated entitlements');
      }

      const revoked = auth.revokeDungeonMasterAccess(created.id);
      if (!revoked || revoked.accessRole !== 'player') throw new Error('DungeonMaster role was not revoked');
      if (revoked.subscriptionBypass || revoked.campaignLimitBypass || revoked.unlimitedAiTurns) {
        throw new Error('DungeonMaster revoke mutated entitlements');
      }

      const admin = storageMod.storage.createUser({
        email: 'admin-role-split@example.invalid',
        username: 'admin_role_split_user',
        passwordHash: 'test-hash',
        accessRole: 'admin',
      });
      if (auth.grantDungeonMasterAccess(admin.id)?.accessRole !== 'admin') {
        throw new Error('granting DungeonMaster demoted an admin');
      }
      if (auth.revokeDungeonMasterAccess(admin.id)?.accessRole !== 'admin') {
        throw new Error('revoking DungeonMaster demoted an admin');
      }
    });
  `, { NODE_ENV: 'test' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
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

test('access policy separates canonical roles from explicit entitlements', () => {
  const result = runTsx(`
    import('./server/access-policy.ts').then(({ resolveAccessCapabilities }) => {
      const canonicalBase = {
        role: 'player',
        isAdmin: false,
        unlimitedTurns: false,
        accessRole: 'player',
        subscriptionBypass: false,
        campaignLimitBypass: false,
        unlimitedAiTurns: false,
      };
      const cases = [
        [
          canonicalBase,
          { dungeonMasterAccess: false, subscriptionBypass: false, campaignLimitBypass: false, unlimitedAiTurns: false },
        ],
        [
          { ...canonicalBase, accessRole: 'dungeon_master' },
          { dungeonMasterAccess: true, subscriptionBypass: false, campaignLimitBypass: false, unlimitedAiTurns: false },
        ],
        [
          { ...canonicalBase, accessRole: 'moderator' },
          { dungeonMasterAccess: false, subscriptionBypass: false, campaignLimitBypass: false, unlimitedAiTurns: false },
        ],
        [
          { ...canonicalBase, accessRole: 'admin' },
          { dungeonMasterAccess: true, subscriptionBypass: false, campaignLimitBypass: false, unlimitedAiTurns: false },
        ],
        [
          { ...canonicalBase, subscriptionBypass: true, campaignLimitBypass: true, unlimitedAiTurns: true },
          { dungeonMasterAccess: false, subscriptionBypass: true, campaignLimitBypass: true, unlimitedAiTurns: true },
        ],
        [
          { role: 'dungeon_master', isAdmin: false, unlimitedTurns: false },
          { dungeonMasterAccess: true, subscriptionBypass: true, campaignLimitBypass: true, unlimitedAiTurns: true },
        ],
      ];

      for (const [user, expected] of cases) {
        const actual = resolveAccessCapabilities(user);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error('capability mapping changed for ' + JSON.stringify(user) + ': ' + JSON.stringify(actual));
        }
      }
    });
  `, { NODE_ENV: 'test' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('entitlement resolvers depend on explicit entitlements, not canonical roles', () => {
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
        accessRole: 'player',
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
        subscriptionBypass: false,
        campaignLimitBypass: false,
        unlimitedAiTurns: false,
        unlimitedTurns: false,
        isAdmin: false,
        authVersion: 0,
        createdAt: new Date().toISOString(),
      };

      for (const principal of [
        base,
        { ...base, accessRole: 'dungeon_master' },
        { ...base, accessRole: 'moderator' },
        { ...base, accessRole: 'admin' },
      ]) {
        if (resolvePlayEntitlement(principal).canPlay !== false) throw new Error('role unexpectedly bypassed subscription');
        if (resolvePlayEntitlement(principal).readOnly !== true) throw new Error('expired role lost read-only mode');
        if (resolveCampaignEntitlement(principal).unlimited !== false) throw new Error('role unexpectedly bypassed campaign limit');
        if (resolveAiEntitlement(principal).unlimited !== false) throw new Error('role unexpectedly gained unlimited AI');
      }

      const explicit = {
        ...base,
        subscriptionBypass: true,
        campaignLimitBypass: true,
        unlimitedAiTurns: true,
      };
      if (resolvePlayEntitlement(explicit).canPlay !== true) throw new Error('explicit subscription bypass was ignored');
      if (resolvePlayEntitlement(explicit).readOnly !== false) throw new Error('explicit subscription bypass stayed read-only');
      if (resolveCampaignEntitlement(explicit).unlimited !== true) throw new Error('explicit campaign bypass was ignored');
      if (resolveAiEntitlement(explicit).unlimited !== true) throw new Error('explicit unlimited AI entitlement was ignored');

      const aiOnly = { ...base, unlimitedAiTurns: true };
      if (resolvePlayEntitlement(aiOnly).canPlay !== false) throw new Error('AI entitlement incorrectly bypassed subscription');
      if (resolveCampaignEntitlement(aiOnly).unlimited !== false) throw new Error('AI entitlement incorrectly bypassed campaign limit');
      if (resolveAiEntitlement(aiOnly).unlimited !== true) throw new Error('AI entitlement did not grant unlimited AI');
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
  assert.match(changePassword, /setSessionCookie\(res, user\.id, ["']password["'], authVersion, \{[\s\S]*?userAgent:/);

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


test('explicit permission matrix separates player, DungeonMaster, moderator, and admin', () => {
  const result = runTsx(`
    import('./server/permissions.ts').then(({ PERMISSIONS, hasPermission, resolvePermissions }) => {
      const player = { role: 'player', accessRole: 'player', isAdmin: false };
      const dm = { role: 'player', accessRole: 'dungeon_master', isAdmin: false };
      const moderator = { role: 'player', accessRole: 'moderator', isAdmin: false };
      const admin = { role: 'player', accessRole: 'admin', isAdmin: false };

      if (resolvePermissions(player).size !== 0) throw new Error('player unexpectedly received permissions');

      if (!hasPermission(dm, PERMISSIONS.DUNGEON_MASTER_ACCESS)) throw new Error('DungeonMaster lost DM access');
      if (hasPermission(dm, PERMISSIONS.MODERATION_ACCESS)) throw new Error('DungeonMaster gained moderation access');
      if (hasPermission(dm, PERMISSIONS.ADMIN_ACCESS)) throw new Error('DungeonMaster gained admin access');
      if (hasPermission(dm, PERMISSIONS.ADMIN_USERS_MANAGE)) throw new Error('DungeonMaster gained user management');
      if (hasPermission(dm, PERMISSIONS.ADMIN_ROLES_MANAGE)) throw new Error('DungeonMaster gained role management');
      if (hasPermission(dm, PERMISSIONS.ADMIN_ENTITLEMENTS_MANAGE)) throw new Error('DungeonMaster gained entitlement management');

      if (!hasPermission(moderator, PERMISSIONS.MODERATION_ACCESS)) throw new Error('moderator lost moderation access');
      if (hasPermission(moderator, PERMISSIONS.DUNGEON_MASTER_ACCESS)) throw new Error('moderator gained DM access');
      if (hasPermission(moderator, PERMISSIONS.ADMIN_ACCESS)) throw new Error('moderator gained admin access');
      if (hasPermission(moderator, PERMISSIONS.ADMIN_ROLES_MANAGE)) throw new Error('moderator gained role management');
      if (hasPermission(moderator, PERMISSIONS.ADMIN_ENTITLEMENTS_MANAGE)) throw new Error('moderator gained entitlement management');

      for (const permission of Object.values(PERMISSIONS)) {
        if (!hasPermission(admin, permission)) throw new Error('admin missing permission ' + permission);
      }

      for (const legacy of [
        { role: 'dungeon_master', isAdmin: false },
        { role: 'player', isAdmin: true },
      ]) {
        if (!hasPermission(legacy, PERMISSIONS.ADMIN_ACCESS)) throw new Error('legacy privileged principal lost rollback access');
        if (!hasPermission(legacy, PERMISSIONS.DUNGEON_MASTER_ACCESS)) throw new Error('legacy privileged principal lost DM access');
      }
    });
  `, { NODE_ENV: 'test' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');
  assert.match(routes, /\/api\/admin\/me", requirePermission\(PERMISSIONS\.ADMIN_ACCESS\)/);
  assert.match(routes, /\/api\/admin\/set-access-role", requirePermission\(PERMISSIONS\.ADMIN_ROLES_MANAGE\), requireTrustedOrigin, requireRecentAuthentication/);
  assert.match(routes, /\/api\/admin\/grant-dungeon-master", requirePermission\(PERMISSIONS\.ADMIN_ROLES_MANAGE\), requireTrustedOrigin, requireRecentAuthentication/);
  assert.match(routes, /\/api\/admin\/revoke-dungeon-master", requirePermission\(PERMISSIONS\.ADMIN_ROLES_MANAGE\), requireTrustedOrigin, requireRecentAuthentication/);
  assert.doesNotMatch(routes, /\/api\/admin\/(?:set-access-role|grant-dungeon-master|revoke-dungeon-master)", requirePermission\(PERMISSIONS\.ADMIN_USERS_MANAGE\)/);
  assert.doesNotMatch(routes, /\/api\/admin\/[^\"']+", requireDungeonMaster/);
});

test('legacy requireDungeonMaster now targets the DungeonMaster permission boundary', () => {
  const auth = readFileSync(path.join(repoRoot, 'server', 'auth.ts'), 'utf8');
  assert.match(auth, /requirePermission\(PERMISSIONS\.DUNGEON_MASTER_ACCESS\)\(req, res, next\)/);
});

test('canonical access roles and entitlement defaults are authoritative when present', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('./server/permissions.ts'),
    ]).then(([storageMod, permissions]) => {
      storageMod.runMigrations();
      const created = storageMod.storage.createUser({
        email: 'canonical-role@example.invalid',
        username: 'canonical_role_user',
        passwordHash: 'test-hash',
      });
      if (created.accessRole !== 'player') throw new Error('new user did not default to player access role');
      if (created.subscriptionBypass || created.campaignLimitBypass || created.unlimitedAiTurns) {
        throw new Error('new user received entitlement overrides by default');
      }

      const explicitPlayerWithLegacyAdmin = {
        role: 'player',
        accessRole: 'player',
        isAdmin: true,
      };
      if (permissions.hasPermission(explicitPlayerWithLegacyAdmin, permissions.PERMISSIONS.ADMIN_ACCESS)) {
        throw new Error('legacy flag overrode an explicit canonical player role');
      }

      const canonicalAdmin = {
        role: 'player',
        accessRole: 'admin',
        isAdmin: false,
      };
      if (!permissions.hasPermission(canonicalAdmin, permissions.PERMISSIONS.ADMIN_ACCESS)) {
        throw new Error('canonical admin role did not grant admin access');
      }
    });
  `, { NODE_ENV: 'test' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('canonical role management changes authority without changing entitlements', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/auth.ts'),
      import('./server/storage.ts'),
      import('./shared/schema.ts'),
    ]).then(([auth, storageMod, schema]) => {
      storageMod.runMigrations();

      for (const accessRole of ['player', 'dungeon_master', 'moderator', 'admin']) {
        const parsed = schema.accessRoleUpdateSchema.safeParse({
          username: 'target-user',
          accessRole,
        });
        if (!parsed.success) throw new Error('valid role was rejected: ' + accessRole);
      }
      if (schema.accessRoleUpdateSchema.safeParse({ username: 'target-user', accessRole: 'owner' }).success) {
        throw new Error('invalid access role was accepted');
      }

      const created = storageMod.storage.createUser({
        email: 'legacy-admin-role-change@example.invalid',
        username: 'legacy_admin_role_change',
        passwordHash: 'test-hash',
        role: 'dungeon_master',
        accessRole: 'admin',
        isAdmin: true,
        subscriptionBypass: true,
        campaignLimitBypass: true,
        unlimitedAiTurns: true,
        unlimitedTurns: true,
      });

      const demoted = auth.setAccessRole(created.id, 'moderator');
      if (!demoted || demoted.accessRole !== 'moderator') throw new Error('admin was not demoted to moderator');
      if (demoted.role !== 'player' || demoted.isAdmin !== false) {
        throw new Error('legacy privilege shadows survived canonical demotion');
      }
      if (!demoted.subscriptionBypass || !demoted.campaignLimitBypass || !demoted.unlimitedAiTurns) {
        throw new Error('role change mutated explicit entitlements');
      }
      if (!demoted.unlimitedTurns) throw new Error('legacy AI rollback shadow was unexpectedly rewritten');

      const promoted = auth.setAccessRole(created.id, 'admin');
      if (!promoted || promoted.accessRole !== 'admin') throw new Error('moderator was not promoted to admin');
      if (promoted.role !== 'player' || promoted.isAdmin !== false) {
        throw new Error('canonical promotion recreated legacy privilege shadows');
      }
      if (!promoted.subscriptionBypass || !promoted.campaignLimitBypass || !promoted.unlimitedAiTurns) {
        throw new Error('canonical promotion mutated explicit entitlements');
      }

      const dm = auth.setAccessRole(created.id, 'dungeon_master');
      if (!dm || dm.accessRole !== 'dungeon_master') throw new Error('admin was not changed to DungeonMaster');
      if (dm.role !== 'player' || dm.isAdmin !== false) {
        throw new Error('DungeonMaster transition recreated legacy admin authority');
      }
      if (!dm.subscriptionBypass || !dm.campaignLimitBypass || !dm.unlimitedAiTurns) {
        throw new Error('DungeonMaster transition mutated explicit entitlements');
      }
    });
  `, { NODE_ENV: 'test' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('canonical role-management route is guarded, self-demotion-safe, and audited', () => {
  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');

  assert.match(
    routes,
    /\/api\/admin\/set-access-role", requirePermission\(PERMISSIONS\.ADMIN_ROLES_MANAGE\), requireTrustedOrigin, requireRecentAuthentication, authSensitiveIpLimit/,
  );
  assert.match(routes, /accessRoleUpdateSchema\.safeParse\(req\.body\)/);
  assert.match(routes, /target\.id === req\.user!\.id && parsed\.data\.accessRole !== target\.accessRole/);
  assert.match(routes, /code: ["']SELF_ROLE_CHANGE_NOT_ALLOWED["']/);
  assert.match(routes, /eventType: ["']ACCESS_ROLE_CHANGED["']/);
  assert.match(routes, /fromRole: target\.accessRole/);
  assert.match(routes, /toRole: updated\.accessRole/);
});

test('DungeonMaster compatibility mutations delegate to the canonical role setter without entitlement writes', () => {
  const auth = readFileSync(path.join(repoRoot, 'server', 'auth.ts'), 'utf8');
  const grantBody = auth.match(/export function grantDungeonMasterAccess[\s\S]*?export function revokeDungeonMasterAccess/)?.[0] || '';
  const revokeBody = auth.match(/export function revokeDungeonMasterAccess[\s\S]*?function useSecureCookies/)?.[0] || '';

  assert.match(grantBody, /setAccessRole\(user\.id, ["']dungeon_master["']\)/);
  assert.match(revokeBody, /setAccessRole\(user\.id, ["']player["']\)/);
  for (const body of [grantBody, revokeBody]) {
    assert.doesNotMatch(body, /subscriptionBypass\s*:/);
    assert.doesNotMatch(body, /campaignLimitBypass\s*:/);
    assert.doesNotMatch(body, /unlimitedAiTurns\s*:/);
    assert.doesNotMatch(body, /unlimitedTurns\s*:/);
    assert.doesNotMatch(body, /isAdmin\s*:/);
    assert.doesNotMatch(body, /role:\s*["'](?:player|dungeon_master)["']/);
  }
});
