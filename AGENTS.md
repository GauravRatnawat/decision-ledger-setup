# Setup Repo

Reusable code only. Real journals, private domains, owner emails, tokens and generated site output stay out of tracked files and Git history.

Use `DESIGN.md` for site style. Markdown journals stay source of truth. Renderer reads `JOURNAL_ROOT`; generated output stays under setup `.generated/` and `dist/`.

## Checks

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
```

Default build uses fake sample data. Private consumer pins full setup commit SHA and passes external journal root. Runtime archive writes require explicit private target repo and verified owner JWT. Never add owner repo fallback.

UI browser checks use gstack `/browse`. Site stays private behind Cloudflare Access when deployed with real journals.
