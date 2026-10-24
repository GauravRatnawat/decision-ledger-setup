import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const runner = fileURLToPath(new URL('../scripts/site.mjs', import.meta.url));
const PROCESS_TIMEOUT_MS = 10_000;

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    timeout: PROCESS_TIMEOUT_MS,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  }).trim();
}

function fixture(t) {
  const base = mkdtempSync(path.join(tmpdir(), 'journal site '));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'private journal');
  const origin = path.join(base, 'setup origin');
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(origin);
  copyFileSync(runner, path.join(root, 'scripts/site.mjs'));
  git(origin, 'init', '--initial-branch=master');
  git(origin, 'config', 'user.name', 'Test');
  git(origin, 'config', 'user.email', 'test@example.com');
  const commit = (text) => {
    writeFileSync(path.join(origin, 'version.txt'), text);
    git(origin, 'add', '.');
    git(origin, 'commit', '-m', 'test: setup pin');
    return git(origin, 'rev-parse', 'HEAD');
  };
  const revision = commit('A');
  const config = {
    repository: origin,
    revision,
    siteUrl: 'https://journal.example.com',
    journalRepository: 'owner/private-journal',
    journalBranch: 'master',
    pagesProject: 'private-journal',
  };
  const save = (value = config) => writeFileSync(path.join(root, 'journal-site.json'), JSON.stringify(value));
  save();
  const journal = path.join(root, 'private notes.md');
  const bytes = Buffer.from('# Notes\n\nSecret café 🪨\n');
  writeFileSync(journal, bytes);
  const setup = path.join(root, '.site/setup');
  const run = (command, env = {}) => spawnSync(process.execPath, [path.join(root, 'scripts/site.mjs'), command], {
    cwd: base,
    timeout: PROCESS_TIMEOUT_MS,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', ...env },
  });
  return { base, root, origin, setup, revision, config, save, commit, run, journal, bytes };
}

function fakePnpm(f) {
  const bin = path.join(f.base, 'fake bin');
  mkdirSync(bin);
  const executable = path.join(bin, 'pnpm');
  const log = path.join(f.base, 'pnpm.json');
  writeFileSync(executable, `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs';\nwriteFileSync(process.env.PNPM_LOG, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), root: process.env.JOURNAL_ROOT, siteUrl: process.env.JOURNAL_SITE_URL, repository: process.env.JOURNAL_REPOSITORY, branch: process.env.JOURNAL_BRANCH }));\nprocess.exit(Number(process.env.PNPM_EXIT || 0));\n`);
  chmodSync(executable, 0o755);
  return { log, env: { PATH: `${bin}${path.delimiter}${process.env.PATH}`, PNPM_LOG: log } };
}

function succeeds(result) {
  assert.equal(result.status, 0, result.stderr);
}

function fails(result, message) {
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, message);
}

test('git env from caller cannot aim checkout at private root', (t) => {
  const f = fixture(t);
  git(f.root, 'init', '--initial-branch=master');
  const env = { GIT_DIR: path.join(f.root, '.git'), GIT_WORK_TREE: f.root };
  succeeds(f.run('prepare', env));
  assert.equal(git(f.setup, 'rev-parse', 'HEAD'), f.revision);
  assert.equal(existsSync(path.join(f.root, 'version.txt')), false);
  assert.deepEqual(readFileSync(f.journal), f.bytes);
});

test('siteUrl needs string, not URL-like list', (t) => {
  const f = fixture(t);
  f.save({ ...f.config, siteUrl: ['https://journal.example.com'] });
  fails(f.run('prepare'), /siteUrl/i);
  assert.equal(existsSync(f.setup), false);
});

test('repo swap needs new prepare, keeps journal hash cache and private output', (t) => {
  const f = fixture(t);
  const pnpm = fakePnpm(f);
  succeeds(f.run('prepare'));
  const hashes = path.join(f.root, '.site/journal-hashes.json');
  const output = path.join(f.root, 'dist/index.html');
  mkdirSync(path.dirname(output));
  writeFileSync(hashes, '{"private":"hash"}');
  writeFileSync(output, 'private output');
  const nextOrigin = path.join(f.base, 'new origin');
  git(f.base, 'clone', '--no-hardlinks', f.origin, nextOrigin);
  f.save({ ...f.config, repository: nextOrigin, siteUrl: 'http://localhost:4321' });
  fails(f.run('build', pnpm.env), /prepare/i);
  succeeds(f.run('prepare'));
  succeeds(f.run('build', pnpm.env));
  assert.equal(JSON.parse(readFileSync(pnpm.log, 'utf8')).siteUrl, 'http://localhost:4321');
  assert.equal(readFileSync(hashes, 'utf8'), '{"private":"hash"}');
  assert.equal(readFileSync(output, 'utf8'), 'private output');
  assert.deepEqual(readFileSync(f.journal), f.bytes);
});

test('checkout clash fails short without leaking origin credentials or running stale setup', (t) => {
  const f = fixture(t);
  const pnpm = fakePnpm(f);
  succeeds(f.run('prepare'));
  git(f.setup, 'remote', 'add', 'origin', 'https://user:secret@github.com/owner/repo.git');
  writeFileSync(path.join(f.setup, 'version.txt'), 'private local change');
  const next = f.commit('B');
  f.save({ ...f.config, revision: next });
  const result = f.run('prepare');
  fails(result, /checkout.*failed/i);
  assert.ok(result.stderr.length < 200, result.stderr);
  assert.doesNotMatch(result.stderr, /secret|user:|github.com|node:internal/);
  f.save();
  fails(f.run('build', pnpm.env), /prepare/i);
  assert.equal(existsSync(pnpm.log), false);
  assert.deepEqual(readFileSync(f.journal), f.bytes);
});

test('missing or malformed config fails short for all commands', (t) => {
  const f = fixture(t);
  const configPath = path.join(f.root, 'journal-site.json');
  rmSync(configPath);
  for (const command of ['prepare', 'install', 'test', 'check', 'build']) {
    const result = f.run(command);
    fails(result, /config.*journal-site.json/i);
    assert.ok(result.stderr.length < 200, result.stderr);
  }
  writeFileSync(configPath, '{bad JSON');
  fails(f.run('prepare'), /config.*JSON/i);
  assert.equal(existsSync(f.setup), false);
});

test('prepare cannot bless dirty checkout as exact pin', (t) => {
  const f = fixture(t);
  const pnpm = fakePnpm(f);
  succeeds(f.run('prepare'));
  writeFileSync(path.join(f.setup, 'version.txt'), 'changed');
  fails(f.run('prepare'), /clean pin/i);
  fails(f.run('build', pnpm.env), /prepare/i);
  assert.equal(existsSync(pnpm.log), false);
  assert.equal(readFileSync(path.join(f.setup, 'version.txt'), 'utf8'), 'changed');
});

test('command rejects attached branch even at right pin', (t) => {
  const f = fixture(t);
  const pnpm = fakePnpm(f);
  succeeds(f.run('prepare'));
  git(f.setup, 'checkout', '-b', 'moving');
  fails(f.run('build', pnpm.env), /pin|detached/i);
  assert.equal(existsSync(pnpm.log), false);
});

test('setup path cannot point outside own checkout', (t) => {
  const f = fixture(t);
  const outside = path.join(f.base, 'outside');
  mkdirSync(outside);
  const site = path.join(f.root, '.site');
  for (const target of [site, f.setup, path.join(f.setup, '.git')]) {
    mkdirSync(path.dirname(target), { recursive: true });
    symlinkSync(outside, target);
    fails(f.run('prepare'), /setup.*path/i);
    assert.equal(existsSync(path.join(outside, '.git')), false);
    rmSync(site, { recursive: true, force: true });
  }
  assert.deepEqual(readFileSync(f.journal), f.bytes);
});

test('pnpm failure keeps exit code and gives short hint', (t) => {
  const f = fixture(t);
  const pnpm = fakePnpm(f);
  succeeds(f.run('prepare'));
  const result = f.run('build', { ...pnpm.env, PNPM_EXIT: '7' });
  assert.equal(result.status, 7);
  assert.match(result.stderr, /build.*failed/i);
  assert.ok(result.stderr.length < 200, result.stderr);
});

test('unknown or missing command gives usage before touching setup', (t) => {
  const f = fixture(t);
  for (const command of ['', 'deploy', '--help']) {
    fails(f.run(command), /prepare\|install\|test\|check\|build/);
    assert.equal(existsSync(f.setup), false);
  }
});

test('unknown pin fails short and blocks stale checkout', (t) => {
  const f = fixture(t);
  const pnpm = fakePnpm(f);
  succeeds(f.run('prepare'));
  f.save({ ...f.config, revision: 'f'.repeat(40) });
  const result = f.run('prepare');
  fails(result, /fetch.*pin/i);
  assert.ok(result.stderr.length < 200, result.stderr);
  fails(f.run('build', pnpm.env), /prepare/i);
  f.save();
  fails(f.run('build', pnpm.env), /prepare/i);
  assert.equal(existsSync(pnpm.log), false);
  assert.deepEqual(readFileSync(f.journal), f.bytes);
});

test('commands need prepare proof and exact clean pin', (t) => {
  const f = fixture(t);
  const pnpm = fakePnpm(f);
  for (const command of ['install', 'test', 'check', 'build']) {
    fails(f.run(command, pnpm.env), /prepare/i);
    assert.equal(existsSync(pnpm.log), false);
  }
  succeeds(f.run('prepare'));
  writeFileSync(path.join(f.setup, 'version.txt'), 'changed');
  fails(f.run('build', pnpm.env), /checkout|pin/i);
  assert.equal(existsSync(pnpm.log), false);
  git(f.setup, 'checkout', '--', 'version.txt');
  const next = f.commit('B');
  git(f.setup, 'fetch', f.origin, next);
  git(f.setup, 'checkout', '--detach', next);
  fails(f.run('build', pnpm.env), /pin/i);
  assert.equal(existsSync(pnpm.log), false);
});

test('pnpm commands get pinned cwd and private config vars', (t) => {
  const f = fixture(t);
  const pnpm = fakePnpm(f);
  succeeds(f.run('prepare'));
  for (const command of ['install', 'test', 'check', 'build']) {
    succeeds(f.run(command, pnpm.env));
    assert.deepEqual(JSON.parse(readFileSync(pnpm.log, 'utf8')), {
      args: command === 'install' ? ['install', '--frozen-lockfile'] : ['run', command],
      cwd: realpathSync(f.setup),
      root: realpathSync(f.root),
      siteUrl: f.config.siteUrl,
      repository: f.config.journalRepository,
      branch: f.config.journalBranch,
    });
  }
  assert.deepEqual(readFileSync(f.journal), f.bytes);
});

test('bad config fails with short safe field hint', (t) => {
  const f = fixture(t);
  const cases = [
    [null, /config/i], [[], /config/i],
    ...[undefined, null, '', ' ', 42, {}, 'git@github.com:owner/repo.git', '--help', 'https://evil.example/repo', 'https://user:secret@github.com/owner/repo', 'relative/path'].map((repository) => [{ ...f.config, repository }, /repository/i]),
    ...[undefined, null, '', 'http://example.com', 'javascript:alert(1)', 'https://user:secret@example.com', 'nonsense'].map((siteUrl) => [{ ...f.config, siteUrl }, /siteUrl/i]),
    ...[undefined, '', 'owner', '../repo', 'owner/repo/extra', 42].map((journalRepository) => [{ ...f.config, journalRepository }, /journalRepository/i]),
    ...[undefined, '', '--help', 42].map((journalBranch) => [{ ...f.config, journalBranch }, /journalBranch/i]),
    ...[undefined, '', ' ', 42].map((pagesProject) => [{ ...f.config, pagesProject }, /pagesProject/i]),
  ];
  for (const [config, hint] of cases) {
    f.save(config);
    const result = f.run('prepare');
    fails(result, hint);
    assert.ok(result.stderr.length < 200, result.stderr);
    assert.doesNotMatch(result.stderr, /secret|node:internal/);
    assert.equal(existsSync(f.setup), false);
  }
});

test('bad revision fails before setup gets touched', (t) => {
  const f = fixture(t);
  for (const revision of [undefined, null, '', 'master', 'HEAD', '--help', 'a'.repeat(39), 'A'.repeat(40), 'g'.repeat(40), 42]) {
    f.save({ ...f.config, revision });
    fails(f.run('prepare'), /revision.*40.*lowercase hex/i);
    assert.equal(existsSync(f.setup), false);
  }
});

test('prepare keeps pin A when origin moves B, leaves journal bytes safe', (t) => {
  const f = fixture(t);
  f.commit('B');
  succeeds(f.run('prepare'));
  assert.equal(git(f.setup, 'rev-parse', 'HEAD'), f.revision);
  assert.equal(readFileSync(path.join(f.setup, 'version.txt'), 'utf8'), 'A');
  assert.notEqual(spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: f.setup, timeout: PROCESS_TIMEOUT_MS }).status, 0);
  succeeds(f.run('prepare'));
  assert.deepEqual(readFileSync(f.journal), f.bytes);
  assert.equal(existsSync(path.join(f.setup, 'private notes.md')), false);
});
