import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const yaml = createRequire(require.resolve('blume'))('js-yaml');
const root = new URL('../', import.meta.url);
const workflow = yaml.load(readFileSync(new URL('examples/my-journal/.github/workflows/deploy.yml', root), 'utf8'));

test('YAML bootstrap rejects mutable setup pin before fetching code', t => {
  const bootstrap = workflow.jobs.deploy.steps.find(step => step.name === 'Build pinned setup');
  assert.ok(bootstrap, 'Workflow needs inline bootstrap.');
  const cwd = mkdtempSync(path.join(tmpdir(), 'demo workflow '));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const config = JSON.parse(readFileSync(new URL('examples/my-journal/journal-site.json', root), 'utf8'));
  writeFileSync(path.join(cwd, 'journal-site.json'), JSON.stringify({ ...config, revision: 'main' }));
  const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', bootstrap.run], {
    cwd, encoding: 'utf8', timeout: 10_000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /40 lowercase hex/);
});
