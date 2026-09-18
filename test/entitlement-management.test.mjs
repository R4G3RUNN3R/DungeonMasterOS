import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function runTsx(source) {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-entitlement-test-'));
  const result = spawnSync(
    path.join(repoRoot, 'node_modules', '.bin', 'tsx'),
    ['-e', source],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: path.join(dbDir, 'test.db'),
      },
      encoding: 'utf8',
    },
  );
  rmSync(dbDir, { recursive: true, force: true });
  return result;
}

test('explicit entitlement management changes only requested overrides', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/entitlement-management.ts'),
      import('./server/storage.ts'),
      import('./shared/schema.ts'),
    ]).then(([entitlements, storageMod, schema]) => {
      storageMod.runMigrations();

      const valid = schema.explicitEntitlementUpdateSchema.safeParse({
        username: 'target-user',
        unlimitedAiTurns: true,
        reasonCode: 'support',
      });
      if (!valid.success) throw new Error('valid entitlement update was rejected');

      if (schema.explicitEntitlementUpdateSchema.safeParse({
        username: 'target-user',
        reasonCode: 'support',
      }).success) {
        throw new Error('entitlement update without an override was accepted');
      }

      if (schema.explicitEntitlementUpdateSchema.safeParse({
        username: 'target-user',
        unlimitedAiTurns: true,
        reasonCode: 'because-I-said-so',
      }).success) {
        throw new Error('free-form entitlement reason was accepted');
      }

      const user = storageMod.storage.createUser({
        email: 'entitlement-target@example.invalid',
        username: 'entitlement_target',
        passwordHash: 'test-hash',
        accessRole: 'moderator',
        role: 'player',
        isAdmin: false,
        unlimitedTurns: true,
      });

      const first = entitlements.setExplicitEntitlements(user.id, {
        subscriptionBypass: true,
      });
      if (!first) throw new Error('entitlement update returned no user');
      if (!first.subscriptionBypass) throw new Error('requested subscription bypass was not set');
      if (first.campaignLimitBypass) throw new Error('unspecified campaign bypass changed');
      if (first.unlimitedAiTurns) throw new Error('unspecified AI entitlement changed');
      if (first.accessRole !== 'moderator' || first.role !== 'player' || first.isAdmin) {
        throw new Error('entitlement update mutated authorization state');
      }
      if (!first.unlimitedTurns) throw new Error('entitlement update rewrote legacy rollback state');

      const second = entitlements.setExplicitEntitlements(user.id, {
        campaignLimitBypass: true,
        unlimitedAiTurns: true,
      });
      if (!second) throw new Error('second entitlement update returned no user');
      if (!second.subscriptionBypass || !second.campaignLimitBypass || !second.unlimitedAiTurns) {
        throw new Error('partial entitlement update lost existing or requested overrides');
      }
      if (second.accessRole !== 'moderator' || second.role !== 'player' || second.isAdmin) {
        throw new Error('second entitlement update mutated authorization state');
      }

      const cleared = entitlements.setExplicitEntitlements(user.id, {
        subscriptionBypass: false,
      });
      if (!cleared || cleared.subscriptionBypass) throw new Error('explicit bypass clear failed');
      if (!cleared.campaignLimitBypass || !cleared.unlimitedAiTurns) {
        throw new Error('clearing one entitlement changed unrelated overrides');
      }
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('entitlement management route is separately authorized, self-grant-safe, and audited', () => {
  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');

  assert.match(
    routes,
    /\/api\/admin\/set-entitlements", requirePermission\(PERMISSIONS\.ADMIN_ENTITLEMENTS_MANAGE\), requireTrustedOrigin, requireRecentAuthentication, authSensitiveIpLimit/,
  );
  assert.match(routes, /explicitEntitlementUpdateSchema\.safeParse\(req\.body\)/);
  assert.match(routes, /target\.id === req\.user!\.id && requestsChange/);
  assert.match(routes, /code: ["']SELF_ENTITLEMENT_CHANGE_NOT_ALLOWED["']/);
  assert.match(routes, /eventType: ["']ENTITLEMENTS_CHANGED["']/);
  assert.match(routes, /reasonCode: parsed\.data\.reasonCode/);
  assert.match(routes, /subscriptionBypassFrom: target\.subscriptionBypass/);
  assert.match(routes, /subscriptionBypassTo: updated\.subscriptionBypass/);
  assert.match(routes, /campaignLimitBypassFrom: target\.campaignLimitBypass/);
  assert.match(routes, /campaignLimitBypassTo: updated\.campaignLimitBypass/);
  assert.match(routes, /unlimitedAiTurnsFrom: target\.unlimitedAiTurns/);
  assert.match(routes, /unlimitedAiTurnsTo: updated\.unlimitedAiTurns/);
  assert.match(routes, /return res\.json\(\{ user: toPublicUser\(updated\), changed \}\);/);
});
