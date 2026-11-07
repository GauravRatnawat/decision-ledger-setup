# Decision Ledger Setup

Build your own searchable journal website using your GitHub and Cloudflare accounts. Your journals and website stay private; the reusable website code can be public.

You choose the setup version, journal repository, branch, website URL and Cloudflare project. No original author's account or domain is required.

Full flow from recorder to private GitHub repo and protected website: [end to end setup guide](docs/end-to-end-setup.md). Includes existing site upgrade path.

Public knowledge base page code lives in [site/](site/). Own build and deploy workflow, separate from setup renderer and private site.

## Before you start

You need Git, Node.js 22.12 or newer, pnpm 10.34.5, a GitHub account and a Cloudflare account.

Use two repositories:

| Repository | Visibility | Contents |
| --- | --- | --- |
| `decision-ledger-setup` | Public | Website code and setup templates. Anyone can read or fork code. |
| `my-journals` | **Private** | Your journals, website settings and deployment workflow. |

Never make a repository containing real journal history public. Setup code can stay private too. For a private setup repository, each user needs GitHub read access. GitHub Actions also needs a separate token restricted to reading the setup repository; its default token cannot read another private repository. The starter workflow assumes public setup code and needs that authentication configured before deploying with private setup code.

Read [how two repos work](docs/how-two-repos-work.md) for diagram, build flow, privacy and upgrades.

See [demo private journal repo](examples/my-journal/) for small repo layout, fake entries and config. Its deploy YAML holds bootstrap code. Copy only into new private repo. [Local runner steps below](#local-runner-starter) use `templates/private`.

See [demo setup workflow](examples/setup.yml) for deploy YAML with notes. Copy it into your **private journal repo** at `.github/workflows/deploy.yml` after copying starter files.

## Local runner starter

Use [setup guide steps 1 through 3](docs/end-to-end-setup.md#1-get-starter-code) for clone, private repo, branch and config. Fork setup repo if you want own code copy. Use own fork URL when cloning and in config.

For local runner, replace guide's demo copy command with these commands from new empty private clone:

```sh
cp -R ../decision-ledger-setup/templates/private/. .
cp -R ../decision-ledger-setup/examples/journals/. .
git -C ../decision-ledger-setup rev-parse HEAD
```

Copy includes hidden `.github/` and `.gitignore`. Set `revision` to full commit ID printed above. Fill template's other config fields from guide. Start with fake notes. Local runner uses `master` too. If using `main`, change workflow push branch, job ref guard, deploy branch and `journalBranch` together.

Runner adds local site commands. Recorder install stays in [guide step 5](docs/end-to-end-setup.md#5-install-recorder-with-git-sync).

## 4. Build and check locally

Run these commands from your private repository:

```sh
node --test tests/site.test.mjs
node scripts/site.mjs prepare
node scripts/site.mjs install
node scripts/site.mjs test
node scripts/site.mjs check
node scripts/site.mjs build
```

Your built website is in `.site/setup/dist`. To preview it:

```sh
cd .site/setup
pnpm preview
```

Open the local URL printed in the terminal. Stop the preview with Ctrl+C, then return to your private repository with `cd ../..`.

The build reads your journals without changing them. Downloaded code and generated pages stay in ignored `.site/`. Never commit that directory. Local preview has no Cloudflare login protection, so keep it on your own machine.

## 5. Set up Cloudflare privacy and deployment

Follow [guide step 4](docs/end-to-end-setup.md#4-set-privacy-and-first-deploy) for Pages project, Access protection and deploy secrets. Check every host with fake notes before real upload. No tokens in JSON or public repo.

## 6. Push your private repository

From your private repository, using your actual branch name:

```sh
git add .
git commit -m "Set up private journal site"
git push -u origin master
```

Open the repository's **Actions** tab and watch **Deploy private ledger**. It fetches your pinned setup version, tests and builds your journals, then deploys the site and its Functions together.

Future journal pushes run the same workflow. Your setup version stays fixed until you change `revision`.

## Optional: enable Archive and Restore

Reading and search work without a GitHub write token. Archive and Restore need these **Production** variables in your Cloudflare Pages project's **Settings → Variables and secrets**:

| Variable | Value |
| --- | --- |
| `GITHUB_TOKEN` | Secret: fine-grained GitHub token with **Contents: read and write**, restricted to your private journal repository. |
| `GITHUB_REPO` | `YOUR_ACCOUNT/my-journals` |
| `GITHUB_BRANCH` | Your journal branch, such as `main`. |
| `OWNER_EMAIL` | The email allowed by your Access policy. |
| `ACCESS_TEAM_DOMAIN` | `https://YOUR_TEAM.cloudflareaccess.com` |
| `ACCESS_AUD` | Application Audience tag from your Cloudflare Access application. |

Redeploy after saving these settings. Keep the write token out of Preview environments. Without the required settings, archive actions return “Archive is not configured here”.

Archive moves a journal into `.archive/` in your private repository. Restore moves it back. Both trigger a normal deployment, so the website changes in about two minutes. Neither permanently deletes the journal.

## Updating or rolling back

Choose a reviewed setup commit and replace `revision` in your private `journal-site.json`. Run the commands in step 4, then commit and push the configuration change. Restore the previous commit ID to roll back.

Always use a full commit ID. Branch names and tags are rejected. Your journals, private Git history and Cloudflare Access protection remain separate from setup code.
