# Public Knowledge Base

Public GitHub Pages site only. Home, setup guide and fake journal demo. No real notes or private renderer build here.

Page code, deps, lockfile and tests stay under `site/`. Guide source stays `docs/end-to-end-setup.md`. Public build imports only that Markdown, never `JOURNAL_ROOT`, `.generated/`, `src/`, templates or private data.

From repo root:

```sh
pnpm --dir site install --frozen-lockfile --ignore-scripts
pnpm --dir site test
pnpm --dir site build
pnpm --dir site dev
```

Open `/decision-ledger-setup/` at local URL printed by dev server. Output stays ignored at `.public-site/`. Private renderer commands and output stay separate.

Workflow `.github/workflows/public-docs.yml` builds public site on PR. Push to main deploys `.public-site/` through GitHub Pages. Repo Pages source must be **GitHub Actions**. No Cloudflare token or private repo access needed.

Default public URL: https://gauravratnawat.com/decision-ledger-setup/

Forks can set `PUBLIC_SITE_URL` to own origin and `PUBLIC_BASE_PATH` to own repo path when building. Default base path `/decision-ledger-setup` works on standard project Pages URL too.
