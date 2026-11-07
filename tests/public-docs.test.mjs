import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

test('public home links to built setup guide', () => {
  const output = mkdtempSync(path.join(tmpdir(), 'ledger-public-docs-'));
  try {
    const build = spawnSync('pnpm', ['docs:build', '--outDir', output], {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
    });
    assert.equal(build.status, 0, build.error?.message ?? `${build.stdout}\n${build.stderr}`);
    const home = readFileSync(path.join(output, 'index.html'), 'utf8');
    assert.match(home, /<a\b[^>]*href=["']\/decision-ledger-setup\/guide\/["'][^>]*>/);
    const guide = readFileSync(path.join(output, 'guide/index.html'), 'utf8');
    assert.match(guide, /<main\b/);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
