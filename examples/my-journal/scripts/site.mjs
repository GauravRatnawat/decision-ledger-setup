#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const setup = path.join(root, '.site/setup');

function stop(message) {
  console.error(message);
  process.exit(1);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function loadConfig() {
  let config;
  try {
    config = JSON.parse(readFileSync(path.join(root, 'journal-site.json'), 'utf8'));
  } catch {
    stop('Site config missing or bad JSON. Check journal-site.json.');
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) stop('Site config needs object.');
  if (typeof config.revision !== 'string' || !/^[a-f0-9]{40}$/.test(config.revision)) {
    stop('Site revision needs 40 lowercase hex chars.');
  }
  if (!hasText(config.repository) || (!path.isAbsolute(config.repository)
    && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(config.repository))) {
    stop('Site repository needs full local path or HTTPS GitHub URL.');
  }
  if (!hasText(config.siteUrl)) stop('Site siteUrl needs HTTPS URL or HTTP localhost.');
  let url;
  try {
    url = new URL(config.siteUrl);
  } catch {
    stop('Site siteUrl needs HTTPS URL or HTTP localhost.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) {
    stop('Site siteUrl needs HTTPS URL or HTTP localhost.');
  }
  if (typeof config.journalRepository !== 'string' || !/^[\w-]+\/[\w.-]+$/.test(config.journalRepository)) {
    stop('Site journalRepository needs owner/repo.');
  }
  if (!hasText(config.journalBranch) || config.journalBranch.startsWith('-')) {
    stop('Site journalBranch needs branch name.');
  }
  if (!hasText(config.pagesProject)) stop('Site pagesProject needs name.');
  return config;
}

function git(...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  try {
    return execFileSync('git', args, { cwd: setup, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    stop(`Setup ${args[0]} failed. Check pin and repository. Run prepare again.`);
  }
}

function hasChangedSource() {
  return git('status', '--porcelain', '--untracked-files=all')
    || git('ls-files', '-v').split('\n').some((line) => line && !line.startsWith('H '));
}

const command = process.argv[2];
if (!['prepare', 'install', 'test', 'check', 'build'].includes(command) || process.argv.length !== 3) {
  stop('Use node scripts/site.mjs prepare|install|test|check|build.');
}
const config = loadConfig();
for (const dir of [path.join(root, '.site'), setup, path.join(setup, '.git')]) {
  const stat = lstatSync(dir, { throwIfNoEntry: false });
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) stop('Setup path needs own folder.');
}
const proof = path.join(root, '.site/prepared.json');
const identity = JSON.stringify({ repository: config.repository, revision: config.revision });
if (command === 'prepare') {
  rmSync(proof, { force: true });
  mkdirSync(setup, { recursive: true });
  git('init');
  git('fetch', '--no-tags', config.repository, config.revision);
  git('checkout', '--detach', config.revision);
  if (git('rev-parse', 'HEAD') !== config.revision || hasChangedSource()) {
    stop('Setup checkout needs exact clean pin.');
  }
  writeFileSync(proof, identity);
} else {
  let prepared;
  try {
    prepared = readFileSync(proof, 'utf8');
  } catch {
    stop('Setup needs prepare first.');
  }
  if (prepared !== identity) stop('Setup pin changed. Run prepare first.');
  if (git('rev-parse', 'HEAD') !== config.revision || git('rev-parse', '--abbrev-ref', 'HEAD') !== 'HEAD'
    || hasChangedSource()) {
    stop('Setup checkout needs exact clean pin. Run prepare first.');
  }
  try {
    execFileSync('pnpm', command === 'install' ? ['install', '--frozen-lockfile'] : ['run', command], {
      cwd: setup,
      stdio: 'inherit',
      env: {
        ...process.env,
        JOURNAL_ROOT: root,
        JOURNAL_SITE_URL: config.siteUrl,
        JOURNAL_REPOSITORY: config.journalRepository,
        JOURNAL_BRANCH: config.journalBranch,
      },
    });
  } catch (error) {
    console.error(`Site ${command} failed. Check pnpm and setup output.`);
    process.exit(error.status || 1);
  }
}
