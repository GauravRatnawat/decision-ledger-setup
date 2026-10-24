# Decision Ledger Setup

Build your own searchable journal website using your GitHub and Cloudflare accounts. Your journals and website stay private; the reusable website code can be public.

You choose the setup version, journal repository, branch, website URL and Cloudflare project. No original author's account or domain is required.

## Before you start

You need Git, Node.js 22.12 or newer, pnpm 10.34.5, a GitHub account and a Cloudflare account.

Use two repositories:

| Repository | Visibility | Contents |
| --- | --- | --- |
| `decision-ledger-setup` | Public | Website code and setup templates. Anyone can read or fork code. |
| `my-journals` | **Private** | Your journals, website settings and deployment workflow. |

Never make a repository containing real journal history public. Setup code can stay private too. For a private setup repository, each user needs GitHub read access. GitHub Actions also needs a separate token restricted to reading the setup repository; its default token cannot read another private repository. The starter workflow assumes public setup code and needs that authentication configured before deploying with private setup code.

Read [how two repos work](docs/how-two-repos-work.md) for diagram, build flow, privacy and upgrades.

See [demo private journal repo](examples/my-journal/) for full folder layout, fake entries, config, runner and deploy workflow. Copy only into new private repo.

See [demo setup workflow](examples/setup.yml) for deploy YAML with notes. Copy it into your **private journal repo** at `.github/workflows/deploy.yml` after copying starter files.

## 1. Get the setup code

Fork the published setup repository into your GitHub account if you want to maintain your own copy. Otherwise, use the published repository directly.

Replace `SETUP_OWNER` below with the account hosting that repository:

```sh
git clone https://github.com/SETUP_OWNER/decision-ledger-setup.git
cd decision-ledger-setup
git rev-parse HEAD
cd ..
```

Save the full 40-character commit ID printed above. It locks your site to that version, so later code updates cannot change your site unexpectedly.

## 2. Create your private journal repository

On GitHub, create an empty repository named `my-journals` and choose **Private**. Replace `YOUR_ACCOUNT` with your GitHub username:

```sh
git clone https://github.com/YOUR_ACCOUNT/my-journals.git
cd my-journals
cp -R ../decision-ledger-setup/templates/private/. .
```

The copy command includes hidden files such as `.github/` and `.gitignore`. Use it in the new, empty repository.

Add your Markdown journals using this layout:

```text
HOME.md
my-project/
  INDEX.md
  2026-01-01_10-00_first-decision.md
```

Copy the examples from `decision-ledger-setup/examples/journals/` if you want a starting point. Write journals yourself or use your existing recorder. This setup does not install recording hooks.

## 3. Fill in your settings

Open `journal-site.json` in your private repository:

```json
{
  "repository": "https://github.com/SETUP_OWNER/decision-ledger-setup.git",
  "revision": "PASTE_THE_FULL_COMMIT_ID_FROM_STEP_1",
  "siteUrl": "https://my-journal.pages.dev",
  "journalRepository": "YOUR_ACCOUNT/my-journals",
  "journalBranch": "main",
  "pagesProject": "my-journal"
}
```

Use your actual Cloudflare Pages project name for `pagesProject` and its URL for `siteUrl`. You can use a custom domain instead.

The workflow template uses `master`. If your journal branch is `main`, open `.github/workflows/deploy.yml` and change `branches: [master]`, the job guard `refs/heads/master` and `--branch master` to `main`. Keep these values and `journalBranch` consistent.

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

1. Create a Cloudflare Pages **Direct Upload** project with the name from `pagesProject`. Use GitHub Actions below for deployments, rather than a second Git-connected build.
2. In Cloudflare Zero Trust, configure Access to allow only your email. Protect the production `pages.dev` address, preview addresses and any custom domain **before uploading real journals**. Confirm a signed-out visitor must log in. Privacy headers alone do not protect the site.
3. Find your Cloudflare account ID and create an API token with **Account → Cloudflare Pages → Edit** permission for that account.
4. In your **private GitHub repository**, open **Settings → Secrets and variables → Actions**. Add these repository secrets:

   | Secret | Value |
   | --- | --- |
   | `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
   | `CLOUDFLARE_API_TOKEN` | Your Cloudflare Pages deployment token |

Never put tokens in `journal-site.json` or the public setup repository.

## 6. Push your private repository

From your private repository, using your actual branch name:

```sh
git add .
git commit -m "Set up private journal site"
git push -u origin main
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
