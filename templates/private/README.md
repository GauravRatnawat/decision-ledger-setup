# Private Ledger Starter

Copy this folder into NEW PRIVATE repo. Keep repo private for life. Never publish old journal history.

Fill `journal-site.json`: public setup Git URL, full commit SHA, private site URL, private journal repo, branch and Pages project. No secrets in JSON.

```sh
node --test tests/site.test.mjs
node scripts/site.mjs prepare
node scripts/site.mjs install
node scripts/site.mjs test
node scripts/site.mjs check
node scripts/site.mjs build
```

Need Node 22.12+ and pnpm 10.34.5. Data layout:

```text
HOME.md
project/INDEX.md
project/YYYY-MM-DD_HH-MM_topic.md
project/commits/YYYY-MM-DD_HH-MM_change.md
.archive/project/YYYY-MM-DD_HH-MM_topic.md
```

Build output stays in ignored `.site/setup`. Journal recorder writes this private repo. Public setup gets no journal content.

Workflow assumes branch `master`. If private branch differs, update trigger and deploy branch. Protect Cloudflare Pages production and preview hosts with Access before first real deploy. Add `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` to private GitHub secrets. Pages runtime archive vars listed in setup README. Never give preview write token.

Upgrade: change exact setup `revision`, run checks, review, commit private config. Revert revision to roll back.
