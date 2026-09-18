import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

test('account settings exposes active sessions and scoped revocation controls', () => {
  const account = readFileSync(path.join(repoRoot, 'client', 'src', 'pages', 'account.tsx'), 'utf8');

  assert.match(account, /queryKey:\s*\["\/api\/auth\/sessions"\]/);
  assert.match(account, /apiRequest\("DELETE",[\s\S]*?\/api\/auth\/sessions\//);
  assert.match(account, /signedOutCurrentSession/);
  assert.match(account, /queryClient\.invalidateQueries\(\{ queryKey: \["\/api\/auth\/sessions"\] \}\)/);
  assert.match(account, /Current/);
  assert.match(account, /Revoke/);
  assert.match(account, /describeSessionClient\(session\.userAgent\)/);
  assert.doesNotMatch(account, /\{session\.userAgent\}/);
  assert.doesNotMatch(account, /tokenHash|ipHash|authVersion/);
});

test('account settings keeps React hooks ahead of auth-dependent early returns', () => {
  const account = readFileSync(path.join(repoRoot, 'client', 'src', 'pages', 'account.tsx'), 'utf8');

  const earlyReturn = account.indexOf('if (!isLoading && !user) return null;');
  assert.ok(earlyReturn > 0, 'auth-dependent early return is missing');

  for (const hookMarker of [
    'const changePasswordMutation = useMutation',
    'const logoutMutation = useMutation',
    'const sessionsQuery = useQuery',
    'const revokeSessionMutation = useMutation',
    'useEffect(() =>',
  ]) {
    const hookIndex = account.indexOf(hookMarker);
    assert.ok(hookIndex >= 0, 'missing hook: ' + hookMarker);
    assert.ok(hookIndex < earlyReturn, 'hook appears after auth-dependent early return: ' + hookMarker);
  }
});
