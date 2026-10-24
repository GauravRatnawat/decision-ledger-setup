# My Journal Demo

Fake private repo example. All notes here made for demo. Real journal repo must stay PRIVATE.

## Repo shape

```text
my-journal/
  .github/workflows/deploy.yml    GitHub Actions deploy
  .gitignore                      Keep builds and secrets out
  journal-site.json               Site settings and setup pin
  scripts/site.mjs                Fetch setup and run build
  tests/site.test.mjs             Check runner
  HOME.md                        Ledger home notes
  example/
    INDEX.md                     Project entry links
    2026-01-01_10-00_sample.md     Sample journal
    commits/
      2026-01-02_09-00_sample.md   Sample commit note
  .archive/
    example/
      2026-01-03_09-00_old-note.md Archived sample, body excluded from site
```

No renderer or package.json needed here. Runner fetches setup code into ignored `.site/setup`. Setup owns deps, styles, pages and Functions.

## Copy into own private repo

Create empty PRIVATE GitHub repo named `my-journal`. Clone setup and private repo side by side. From private repo root:

```sh
cp -R ../decision-ledger-setup/examples/my-journal/. .
```

Command includes hidden `.github`, `.gitignore` and `.archive` files. Run only in new empty repo. Demo workflow runs on `master`; use that branch or change push trigger, job guard and deploy branch together.

Open `journal-site.json`. Replace `YOUR_ACCOUNT`, website URL and Pages project name. Demo pins known setup commit; choose reviewed full commit SHA when upgrading. No secrets in JSON.

Need Node 22.12+ and pnpm 10.34.5. Run from private repo:

```sh
node --test tests/site.test.mjs
node scripts/site.mjs prepare
node scripts/site.mjs install
node scripts/site.mjs test
node scripts/site.mjs check
node scripts/site.mjs build
```

Build output stays in ignored `.site/setup/dist`. Markdown source stays unchanged. Replace fake entries with own notes in PRIVATE repo only. Do not put real notes into public example folder.

## Deploy

Protect production Pages host, deployment/preview hosts and custom domain with Cloudflare Access before real journal upload. Add private repo Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Push chosen production branch to build and deploy.

Archive and Restore optional. Need separate production runtime secrets from setup README. Build JSON does not set runtime `GITHUB_REPO`. Preview gets no write token.

Full setup guide: https://github.com/GauravRatnawat/decision-ledger-setup#readme

Two repo diagram: https://github.com/GauravRatnawat/decision-ledger-setup/blob/main/docs/how-two-repos-work.md
