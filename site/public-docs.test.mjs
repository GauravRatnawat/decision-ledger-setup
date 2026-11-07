import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('.', import.meta.url));
const base = (process.env.PUBLIC_BASE_PATH || '/decision-ledger-setup').replace(/\/$/, '');
const prefix = `${base}/`;

test('public home links to built setup guide', () => {
  const output = mkdtempSync(path.join(tmpdir(), 'ledger-public-docs-'));
  try {
    const build = spawnSync('pnpm', ['build', '--outDir', output], {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
    });
    assert.equal(build.status, 0, build.error?.message ?? `${build.stdout}\n${build.stderr}`);
    const home = readFileSync(path.join(output, 'index.html'), 'utf8');
    const homeLinks = [...home.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/g)];
    assert.ok(homeLinks.some(match => match[1] === `${prefix}guide/`));
    const guide = readFileSync(path.join(output, 'guide/index.html'), 'utf8');
    assert.match(guide, /<main\b/);
    assert.match(guide, /Sync: git/);
    assert.match(guide, /30 minutes/);
    for (const name of ['index.html', 'guide/index.html', 'demo/index.html']) {
      const page = readFileSync(path.join(output, name), 'utf8');
      for (const match of page.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
        const href = match[1];
        if (!href.startsWith(prefix)) continue;
        const url = new URL(href, 'https://example.test');
        const relative = url.pathname.slice(prefix.length);
        const target = path.join(output, relative, url.pathname.endsWith('/') ? 'index.html' : '');
        assert.ok(existsSync(target), `Missing public target: ${href}`);
        if (url.hash) {
          const id = decodeURIComponent(url.hash.slice(1));
          assert.ok(readFileSync(target, 'utf8').includes(`id="${id}"`), `Missing section: ${href}`);
        }
      }
    }
    assert.equal(existsSync(path.join(output, 'functions')), false);
    assert.equal(existsSync(path.join(output, '.generated')), false);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
