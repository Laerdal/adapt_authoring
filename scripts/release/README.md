# Centralized CI/CD (`.github/workflows/pipeline.yml`)

One pipeline builds and deploys adapt_authoring + adapt-authoring-plugins + adapt-framework-plugins + adapt-cdn-deploy-cli.
Until the repos are merged, a push to any of them triggers it (see "Trigger from the plugin repos").

```
push develop / master / release/**  ─┐          ┌─> tests (blocking) ──┐
plugin repo push (workflow_dispatch) ─┼─> resolve ┤                      ├─> [deploy via SSM] ─> E2E (non-blocking) ─> Teams
pull_request -> develop / master     ─┘          └─> build + package ───┘   (needs AWS role)
```

Tests (blocking, no DB needed): `test/storyboard.commentStatus.js` and the `new-ui-source` vitest suite.
E2E runs after a successful deploy and never fails the pipeline; its result and report link appear in the Teams card.

| Branch | Environment | Deploys when |
|---|---|---|
| `develop` | dev | `AWS_DEPLOY_ENABLED=true` and `dev` is in `DEPLOY_ENVS` (the default) |
| `release/*` | tryout | `tryout` is in `DEPLOY_ENVS` |
| `master` | prod | `prod` is in `DEPLOY_ENVS`, after the approval on the `prod` GitHub environment |
| PR / feature branch | none | never — build + package only |

Prod and tryout stay build-only until their GitHub environment, AWS role and instance tags exist (see "Production setup") and
the environment is added to the repo variable `DEPLOY_ENVS`. Merging this pipeline to `master` therefore changes nothing by itself.

What a release contains: `app-<id>.tgz` (code + built frontend + `public/new`), `deps-<lockhash>.tgz` (node_modules, re-shipped only
when `package-lock.json` changes), `manifest-<id>.json` (all four repo SHAs), `deploy-release.sh`.
`conf/config.json`, `conf/migrate.json`, `.env`, `data/`, `temp/`, `repos/` are instance-owned and never overwritten.

`deploy-release.sh` (on the instance): take the single-deploy lock (`.deploy/lock`; a second deploy exits 75) → on the **first** deploy
of an instance, back up the current code to `.deploy/pre-pipeline-<time>.tgz` → mirror managed dirs (the `versions/` and cache folders
are excluded from `--delete`) → swap `node_modules` if the lock changed → pin `repos/*` to the manifest SHAs (+ `npm link` for
cdn-deploy-cli if it changed) → `pm2 restart` → wait healthy → record `.deploy/current` → `GET /api/webhooks/force/frameworkplugins`
(re-imports framework plugins from the pinned clone; retried once) → **`verify-install.js`**: every plugin in the clone must have its
folder in `temp/…/src/<type>/`, its copy under `plugins/content/<type>/versions/` and exactly one DB row at the same version
(re-import once, then fail). Failure after the code is live rolls back to `.deploy/previous`; the first deploy has no earlier release,
so the backup tarball is the way back (`tar -xzf <file> -C <app dir>`; take an EBS snapshot/AMI as well).
DB scripts in `adapt-build/database-helpers` stay manual.

## Settings

| Where | Name | Kind | Value |
|---|---|---|---|
| adapt_authoring | `GHA_READ_APP_ID`, `GHA_READ_PRIVATE_KEY` **or** `ADAPT_REPOS_READ_TOKEN` | secret | read access to the 4 plugin repos + `adapt-laerdal-life-theme` |
| adapt_authoring | `TEAMS_WEBHOOK_URL` | secret | already set; Teams Workflows webhook URL (skipped if unset) |
| adapt_authoring | `STUDIO_E2E_TOKEN` | secret | already set; dispatches and reads the Playwright run in `Laerdal-Medical/adapt-studio-e2e-test` (E2E reports "skipped" without it) |
| adapt_authoring | `RELEASE_BUCKET`, `AWS_REGION` (`eu-west-1`) | variable | releases bucket |
| adapt_authoring | `AWS_DEPLOY_ENABLED` | variable | `true` turns the deploy job on at all |
| adapt_authoring | `DEPLOY_ENVS` | variable | space-separated environments that may deploy, e.g. `dev tryout prod` (unset = `dev`) |
| adapt_authoring | `E2E_ENVS` | variable | environments that run the smoke suite after deploy (unset = `dev`). The suite targets the shared DEV instance: keep prod out until a prod-safe suite exists |
| adapt_authoring | environment `dev` / `tryout` / `prod` | environment | branch rule `develop` / `release/*` / `master`; `prod` also has required reviewers |
| each environment | `AWS_DEPLOY_ROLE_ARN` | environment variable | that environment's own OIDC role; its name must end in `-<env>` (the deploy refuses a role that does not) |
| each environment | `DEPLOY_WAVES` | environment variable | e.g. `1 2` for prod: wave 1 = canary, wave 2 starts only if wave 1 succeeded. Unset (dev) = one pass |
| each plugin repo | `ADAPT_DISPATCH_TOKEN` | secret | fine-grained PAT on `Laerdal/adapt_authoring`: **Actions: read & write** |

## Manual rehearsal (no AWS role yet)

1. Open a PR from this branch to `develop` → the run builds and packages (no upload, no deploy). Check the job log.
2. After merge, a `develop` push builds and uploads the artifact `adapt-release-<id>`.
3. Laptop: `gh run download <run-id> --repo Laerdal/adapt_authoring -D rel` then
   `aws s3 cp rel/ s3://<bucket>/dev/ --recursive` (skip `deps-*` if that lock hash is already there).
4. Instance (Session Manager, `sudo -i`), dry-run first and read the `*deleting` lines:
   ```
   aws s3 cp s3://<bucket>/dev/deploy-release.sh /tmp/ --region eu-west-1
   export BUCKET=<bucket>
   bash /tmp/deploy-release.sh <release-id> --dry-run
   bash /tmp/deploy-release.sh <release-id>
   ```
   Needs on the instance: `rsync`, `aws`, `pm2`, and node via root's nvm (the script sources `~/.nvm/nvm.sh` itself, so SSM runs work too).

## Trigger from the plugin repos

`gh workflow run pipeline.yml --ref <branch>` runs the copy of `pipeline.yml` that exists on `<branch>`. Verified on PR #388: once GitHub has
seen the workflow (any earlier run registers it), a dispatch with `--ref <feature branch>` works without the file being on `master`, so no stub is needed.
Consequence for ordering: the file must exist on the branch the plugin repos dispatch to. Merge `pipeline.yml` to `develop` before the plugin-repo
trigger workflows reach `develop`, and release it to `master` before theirs reach `master`.

Add to each of `adapt-framework-plugins`, `adapt-authoring-plugins` (branches `[develop, master]`) and `adapt-cdn-deploy-cli` (branches `[main]`),
as `.github/workflows/notify-adapt-authoring.yml`:

```yaml
name: notify-adapt-authoring
on:
  push:
    branches: [develop, master]
jobs:
  dispatch:
    runs-on: ubuntu-22.04
    steps:
      - env:
          GH_TOKEN: ${{ secrets.ADAPT_DISPATCH_TOKEN }}
          REF: ${{ github.ref_name == 'master' && 'master' || 'develop' }}
        run: >-
          gh workflow run pipeline.yml --repo Laerdal/adapt_authoring --ref "$REF"
          -f trigger="${{ github.event.repository.name }}@${GITHUB_SHA::7}"
```

## Production setup (once)

Why: before this, every prod instance was updated by GitHub webhooks (adapt_authoring, authoring-plugins, framework-plugins, cdn-cli)
that fire at the same moment on a release with no lock between them. On 2026-10-29 that raced on SD: `installPlugins.js` emptied
`plugins/` while the framework import was copying into it, leaving the Life theme registered in the DB but missing on disk.
The pipeline deploys one release per instance, in order, and proves the result.

1. **AWS (CloudOps)** — copy the dev setup for `prod` (the bucket already has `prod/` and `tryout/`, kept 180 / 30 days):
   - IAM role `github-adapt-deploy-prod`. Trust policy = the dev role's, with only the subject changed to
     `repo:Laerdal/adapt_authoring:environment:prod`. Permissions, least privilege:
     ```json
     { "Version": "2012-10-17", "Statement": [
       { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"], "Resource": "arn:aws:s3:::<bucket>/prod/*" },
       { "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::<bucket>", "Condition": { "StringLike": { "s3:prefix": ["prod/*"] } } },
       { "Effect": "Allow", "Action": "ssm:SendCommand", "Resource": "arn:aws:ssm:eu-west-1::document/AWS-RunShellScript" },
       { "Effect": "Allow", "Action": "ssm:SendCommand", "Resource": "arn:aws:ec2:eu-west-1:<account>:instance/*",
         "Condition": { "StringEquals": { "ssm:resourceTag/app": "adapt", "ssm:resourceTag/env": "prod" } } },
       { "Effect": "Allow", "Action": ["ssm:ListCommandInvocations", "ssm:GetCommandInvocation", "ssm:ListCommands"], "Resource": "*" } ] }
     ```
   - Each prod instance: SSM agent Online, tags `app=adapt`, `env=prod`, and **`wave=1|2`** (add `wave` only when that instance is cut
     over: an untagged instance is never deployed to), instance profile able to read `s3://<bucket>/prod/*`, `rsync` + `flock` + `pm2` + `node`
     (Node 18, x86_64, same as CI), free disk of about twice the app size in `/var/tmp`.
2. **GitHub (repo admin)** — the `prod` environment, its role and waves, then the switch last:
   ```bash
   gh api -X PUT repos/Laerdal/adapt_authoring/environments/prod --input - <<'JSON'
   {"reviewers":[{"type":"User","id":<approver user id>}],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
   JSON
   gh api -X POST repos/Laerdal/adapt_authoring/environments/prod/deployment-branch-policies -f name=master
   gh variable set AWS_DEPLOY_ROLE_ARN --repo Laerdal/adapt_authoring --env prod --body arn:aws:iam::<account>:role/github-adapt-deploy-prod
   gh variable set DEPLOY_WAVES        --repo Laerdal/adapt_authoring --env prod --body "1 2"
   gh variable set DEPLOY_ENVS         --repo Laerdal/adapt_authoring --body "dev prod"      # last: this is the switch
   ```
   Do the same for `tryout` (branch policy `release/*`) if you want the rehearsal path.
3. **Merge order**: this pipeline file must be on `master` before prod can deploy (the plugin repos dispatch `--ref master`).
   Releases touching several repos start several runs; they queue per branch and each builds the latest heads. Approve only the
   last one, after every repo of the release has merged (reject the earlier ones).

## Cutting an instance over to the pipeline (one at a time, lowest-traffic first, busiest last)

An instance is either updated by the webhooks or by the pipeline, never both. Each GitHub webhook has an `active` flag, which is the switch.

1. Take an **EBS snapshot/AMI** of the instance (the first deploy has no earlier release to roll back to).
2. Tag it `app=adapt`, `env=prod`, `wave=<N>`.
3. **Dry run**: `gh workflow run pipeline.yml --repo Laerdal/adapt_authoring --ref master -f dry_run=true -f wave=<N>`, approve, and read
   the log: the "deletions by folder" and "existing files that would be overwritten" lists are what `--delete` would remove. Nothing changes.
4. Switch that instance's webhooks off (4 repos): list with `gh api repos/<owner>/<repo>/hooks --jq '.[] | select(.config.url | contains("adapt-sd.")) | [.id, .active, .config.url]'`,
   then `gh api -X PATCH repos/<owner>/<repo>/hooks/<id> -F active=false`.
5. **Real deploy**: `gh workflow run pipeline.yml --repo Laerdal/adapt_authoring --ref master -f wave=<N>` and approve. The Teams card shows the result;
   `[verify] OK: N plugins …` in the SSM output is the plugin check.
6. Open a preview of a Life-theme course by hand. Then leave the instance on the pipeline.
7. **Back out**: re-enable the webhooks (`-F active=true`); for the code, restore `.deploy/pre-pipeline-*.tgz` or run
   `deploy-release.sh <previous id>`.

The `/api/webhooks/force/*` routes stay available for manual repairs. Once every prod instance is cut over, remove the webhook receivers.

## Old path

In adapt-framework-plugins `build.yml`, `ci.yml` and `docker-build-reusable.yml` are already renamed `*.disabled` (keep sonar/test/auto-formatter).
The webhooks are switched off per instance as above, not all at once.
