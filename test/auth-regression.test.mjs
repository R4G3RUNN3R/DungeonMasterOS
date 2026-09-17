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

test('browser session cookie contract remains compatible while session internals evolve', () => {
  const auth = readFileSync(path.join(repoRoot, 'server', 'auth.ts'), 'utf8');

  assert.match(auth, /COOKIE_NAME\s*=\s*["']dmos_session["']/);
  assert.match(auth, /httpOnly:\s*true/);
  assert.match(auth, /maxAge:\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(auth, /path:\s*["']\/["']/);
});

test('current access bypasses stay explicit until permissions and entitlements are separated', () => {
  const auth = readFileSync(path.join(repoRoot, 'server', 'auth.ts'), 'utf8');

  assert.match(auth, /requireCanPlay[\s\S]*?hasDungeonMasterAccess\(req\.user\)[\s\S]*?return next\(\)/);
  assert.match(auth, /allowReadOnlyForExpired[\s\S]*?hasDungeonMasterAccess\(req\.user\)[\s\S]*?return next\(\)/);
  assert.match(auth, /checkCampaignLimit[\s\S]*?hasDungeonMasterAccess\(user\)[\s\S]*?return next\(\)/);
  assert.match(auth, /checkTurnLimit[\s\S]*?hasDungeonMasterAccess\(user\) \|\| user\.unlimitedTurns/);
  assert.match(auth, /claimTurn[\s\S]*?hasDungeonMasterAccess\(user\) \|\| user\.unlimitedTurns/);
});
