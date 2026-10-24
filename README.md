# Decision Ledger Setup

Code for private journal site. Code can be public. Your journals and deployed site stay private.

## Try locally

Need Node 22.12+ and pnpm 10.34.5.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
pnpm dev
```

Default build uses fake entries in `examples/journals`. No login on local dev. Do not expose local dev port.

## Use private journals

```sh
JOURNAL_ROOT=/absolute/path/to/private-journals JOURNAL_SITE_URL=https://journal.example.com pnpm build
```

Build reads journals from external root. Output stays in setup `.generated/` and `dist/`. Both ignored. Never commit built output. Journal source stays untouched. Keep external journals out of this repo.

## Pin setup version

Private repo keeps journals, `.archive/`, `journal-site.json`, `scripts/site.mjs` and private deploy workflow. Copy consumer templates from `templates/private` into private repo. Set setup Git URL and full 40-char commit SHA. Local absolute Git path also works for local proof.

```json
{
  "repository": "https://github.com/YOUR_ACCOUNT/decision-ledger-setup.git",
  "revision": "FULL_40_CHAR_SETUP_COMMIT_SHA",
  "siteUrl": "https://journal.example.com",
  "journalRepository": "YOUR_ACCOUNT/private-journals",
  "journalBranch": "master",
  "pagesProject": "private-journal"
}
```

```sh
node scripts/site.mjs prepare
node scripts/site.mjs install
node scripts/site.mjs test
node scripts/site.mjs check
node scripts/site.mjs build
```

Runner fetches exact pin into ignored `.site/setup`. New setup commits never change current pin. Upgrade: review new setup commit, change `revision`, run checks and private build, commit config change in private repo. Rollback: restore old revision and build again. No moving branch/tag pins.

## Private Cloudflare deploy

Create Cloudflare Pages project with private domain. Protect custom domain, `pages.dev` production host and preview hosts with Cloudflare Access before deploying real journals. Allow only owner email. Headers do not replace Access.

Private workflow builds from pinned setup. Deploy from `.site/setup` so `functions/` ships with `dist/`:

```sh
cd .site/setup
pnpm dlx wrangler@4.117.0 pages deploy dist --project-name YOUR_PRIVATE_PROJECT --branch master
```

Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in private GitHub repo secrets. Never put secrets in config or public setup.

## Archive and restore

Production Pages runtime vars:

- `GITHUB_TOKEN`: secret, fine-grained Contents read/write on private journals repo only.
- `GITHUB_REPO`: private journals target, e.g. `YOUR_ACCOUNT/private-journals`. Required, no owner repo fallback.
- `GITHUB_BRANCH`: private journal branch. Default `master`.
- `OWNER_EMAIL`: only allowed writer.
- `ACCESS_TEAM_DOMAIN`: `https://YOUR_TEAM.cloudflareaccess.com`.
- `ACCESS_AUD`: Access app audience.

Build vars and runtime vars are separate. `journalRepository` config sets build context, not Pages runtime secrets. Set `GITHUB_REPO` in Pages too. Preview gets no write token, so mutations return 503.

Archive makes atomic Git move into `.archive/`; restore moves back. Both trigger private repo deploy. UI reports ~2 min lag. `/archives` exposes summary metadata only. Body stays off site.

## Repo boundary

Setup repo owns renderer, tests, styles and site creation/deploy templates. Private repo owns all real content, Git history, site config and workflow. Existing journal recorder keeps writing private repo. This setup does not install or alter machine-wide recorder hooks.
