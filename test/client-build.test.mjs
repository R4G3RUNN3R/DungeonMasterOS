import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const publicDir = path.join(repoRoot, 'dist', 'public');
const assetsDir = path.join(publicDir, 'assets');

test('client build route-splits pages and keeps the HTML entry chunk under Vite warning threshold', () => {
  const javascriptFiles = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
  assert.ok(javascriptFiles.length >= 3, `expected route-level code splitting, found ${javascriptFiles.length} JS file(s)`);

  const html = readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const entryMatch = html.match(/<script[^>]+type=["']module["'][^>]+src=["']\.\/assets\/([^"']+\.js)["'][^>]*><\/script>/i);
  assert.ok(entryMatch, 'expected built index.html to reference one module entry script');

  const entryFile = entryMatch[1];
  const entryBytes = statSync(path.join(assetsDir, entryFile)).size;
  assert.ok(entryBytes < 500_000, `entry chunk ${entryFile} is ${entryBytes} bytes; expected < 500000`);
});


test('DMOS logo source is sized for its actual UI use instead of shipping a megabyte-scale image', () => {
  const logoBytes = statSync(path.join(repoRoot, 'attached_assets', 'logo.png')).size;
  assert.ok(logoBytes < 250_000, `attached_assets/logo.png is ${logoBytes} bytes; expected < 250000`);
});
