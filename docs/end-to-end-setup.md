# End To End Setup

Save work notes with [Journal Recorder](https://github.com/GauravRatnawat/journal-recorder-agent). Push notes to own private GitHub repo. GitHub Actions fetches pinned Decision Ledger Setup code, builds site and deploys to Cloudflare Pages. Cloudflare Access controls who can read it.

## Whole flow

```text
Journal Recorder on your machine
  → Markdown in local private repo clone
  → Git commit and push to private GitHub repo
  → Private repo GitHub Actions
      + pinned decision-ledger-setup code
  → Site build and Cloudflare Pages deploy
  → Cloudflare Access login
  → Your journal website
```

| Repo | Holds |
| --- | --- |
| Public journal-recorder-agent | Recorder core, hooks, shared skill and installer |
| Public decision-ledger-setup | Site code, styles, Functions, tests and fake examples |
| Your private my-journal | Real Markdown, private history, site config and deploy workflow |

Notes never go into either public code repo. Generated site contains private text too. Protect every deployed host before real notes upload.

## Already have private journal site

Keep existing private clone, branch and site settings. No need to copy demo or make new repo.

1. Run recorder command from step 5.
2. Choose tools already used. Pick current private clone as notes folder.
3. Keep Git sync enabled. Confirm target repo private.
4. Check folder and mode with `journal.py doctor`.
5. Save next note. Check private Git push and site deploy as shown in step 6.

Recorder upgrade and site upgrade separate. Installing recorder does not change site setup pin or deploy workflow.

## 1. Get starter code

Need Git, Python 3.10+ and curl on macOS or Linux. Existing Codex TOML safe edits need Python 3.11+. GitHub Actions supplies Node and pnpm for site build. Local site checks need Node 22.12+ and pnpm 10.34.5.

Clone public setup repo:

```sh
git clone https://github.com/GauravRatnawat/decision-ledger-setup.git
```

Use [small private repo demo](https://github.com/GauravRatnawat/decision-ledger-setup/tree/main/examples/my-journal/). Its deploy YAML holds bootstrap code. No separate scripts folder needed in journal repo. [Main README](https://github.com/GauravRatnawat/decision-ledger-setup/blob/main/README.md) also offers separate runner for local site commands. Pick one starter path.

## 2. Create private journal repo

On GitHub, create empty repo named `my-journal`. Choose **Private**. Clone it beside setup repo. Replace `YOUR_ACCOUNT` with own GitHub username:

```sh
git clone https://github.com/YOUR_ACCOUNT/my-journal.git
cd my-journal
git switch -c master
cp -R ../decision-ledger-setup/examples/my-journal/. .
```

Use copy command only in new empty clone. It includes hidden `.github/` and `.gitignore`. Start with fake demo notes until site privacy checked.

Guide uses `master`, same as demo workflow. To use `main`, change workflow push branch, job ref guard, deploy branch and `journalBranch` together. Existing users keep current branch.

## 3. Set site config

Edit `journal-site.json` in private clone:

```json
{
  "repository": "https://github.com/GauravRatnawat/decision-ledger-setup.git",
  "revision": "e9173b9fc21d455288c5507de0080710396aef07",
  "siteUrl": "https://my-journal.pages.dev",
  "journalRepository": "YOUR_ACCOUNT/my-journal",
  "journalBranch": "master",
  "pagesProject": "my-journal"
}
```

Use own account, Pages project name and site URL. Revision above matches demo pin. Use reviewed full 40 character setup commit for upgrades. Never use branch name as revision.

No tokens in JSON. `.site/`, secrets and generated output stay ignored. Real Markdown stays source of truth.

## 4. Set privacy and first deploy

1. Create Cloudflare Pages **Direct Upload** project with `pagesProject` name from config. Use private repo Actions for deploy, with no second Git build.
2. In Cloudflare Zero Trust, set Access policy for allowed reader email. Cover production Pages hostname, preview and deployment hosts, plus custom domain if used. Use fake content while checking protection. Headers alone do not guard site.
3. Find Cloudflare account ID. Create API token with **Account → Cloudflare Pages → Edit** for own account. In private repo **Settings → Secrets and variables → Actions**, add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. No tokens in JSON or public repo.
4. Commit starter and push `master`:

```sh
git add .github/workflows/deploy.yml .gitignore journal-site.json HOME.md example .archive
git commit -m "chore: build private site from pinned setup"
git push -u origin master
```

Open private repo **Actions** tab. Wait for **Deploy private ledger** to pass. Open site signed out. It must require allowed login before showing any content. Check every hostname above before replacing fake notes with real ones.

First push also creates tracked origin branch that recorder Git mode needs. Setup cannot prove repo private, so check GitHub visibility yourself.

## 5. Install recorder with Git sync

Run in terminal:

```sh
curl -fsSL https://raw.githubusercontent.com/GauravRatnawat/journal-recorder-agent/273ff5039c9106e60a59d49c20909b9502d513c9/bootstrap.py | python3 -I -
```

Need own Git auth working for private repo push. For SSH, use own SSH clone URL in step 2. Fetch and push origin URLs must match.

Choose tools to capture. Enter full path to private clone from step 2 as notes folder. Answer **yes** to Git sync and private repo confirmation. Review planned changes, then apply. Existing changed files get private backups. Failed setup check rolls file changes back. Restart chosen tools.

New install defaults to local `~/journal`. **Choose private clone and Git sync for website flow.** Local mode alone never pushes notes or updates site.

Check result:

```sh
python3 ~/.claude/hooks/journal.py resolve-dir
python3 ~/.claude/hooks/journal.py doctor
```

Expect own clone path and `Sync: git`. Doctor makes no model call or upload. It does not prove Git credentials or live capture works.

Automatic summaries need signed-in Claude CLI, even when capture comes from another tool. Manual summaries need no model CLI. Scrubbed automatic input still goes to model service. Known secret patterns filtered, but filter cannot prove all prose safe. Review [recorder privacy limits](https://github.com/GauravRatnawat/journal-recorder-agent#privacy-filter).

Rerun setup to add tools or change folder and sync. Old hooks stay active when omitted on rerun. Remove old tool recorder hook from config to stop its capture.

## 6. Check first note through whole flow

From project being recorded, submit harmless manual note. Replace `cwd` with full project path:

```sh
python3 ~/.claude/hooks/journal.py record <<'JSON'
{"agent":"manual","cwd":"/full/path/to/project","session_id":"setup-check","summary":"# Setup check\n\nPrivate journal flow ready.\n\n## Tags\n#journal #setup"}
JSON
```

This writes real test note to private journal clone, commits it and pushes. It makes no model call. Manual record does not check dedup. It does set project marker, so auto capture in same project skips next 30 minutes.

Check each link:

1. New Markdown note appears under project folder in configured clone.
2. New recorder commit appears on private GitHub production branch.
3. **Deploy private ledger** starts and passes.
4. Site still requires login. After login, new note appears in search.
5. Use chosen agent in different project, or wait 30 minutes before using same project. Confirm automatic capture saves note too. Manual check alone does not prove native hook capture.

If sync fails, local Markdown kept and recorder reports failure. Inspect Git state before retry, since retry may make another entry. Existing staged files, secret scan hits or diverged branch can block sync. Recorder never pulls, merges or rewrites history for you.

## Upgrades and optional archive

| Change | Where to do it |
| --- | --- |
| Recorder update | Rerun reviewed recorder install. Keep clone and Git mode |
| Site update | Change setup `revision` in private `journal-site.json`, check and push |
| Workflow update | Review and copy changed starter workflow into private repo |
| Archive and Restore | Set separate Production runtime secrets from [README](https://github.com/GauravRatnawat/decision-ledger-setup/blob/main/README.md#optional-enable-archive-and-restore) |

Read site works without archive write token. Keep that token out of Preview. Archive moves Markdown within private repo, then normal deploy runs.

For more build detail, see [how two repos work](https://github.com/GauravRatnawat/decision-ledger-setup/blob/main/docs/how-two-repos-work.md). For recorder capture routes and checks, see [recorder README](https://github.com/GauravRatnawat/journal-recorder-agent#readme).
