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

| Branch | Environment | Deploy job today |
|---|---|---|
| `develop` | dev | yes, once `AWS_DEPLOY_ENABLED=true` |
| `release/*` | tryout | not wired yet (build only) |
| `master` | prod | not wired yet (build only) |
| PR | none | never — build + package only |

What a release contains: `app-<id>.tgz` (code + built frontend + `public/new`), `deps-<lockhash>.tgz` (node_modules, re-shipped only
when `package-lock.json` changes), `manifest-<id>.json` (all four repo SHAs), `deploy-release.sh`.
`conf/config.json`, `conf/migrate.json`, `.env`, `data/`, `temp/`, `repos/` are instance-owned and never overwritten.

`deploy-release.sh` (on the instance): mirror managed dirs → swap `node_modules` if the lock changed → pin `repos/*` to the manifest SHAs
(+ `npm link` for cdn-deploy-cli if it changed) → `pm2 restart` → wait healthy → `GET /api/webhooks/force/frameworkplugins`
(re-imports framework plugins from the pinned clone) → record `.deploy/current`. Failure before the import rolls back to `.deploy/previous`.
DB scripts in `adapt-build/database-helpers` stay manual.

## Settings

| Where | Name | Kind | Value |
|---|---|---|---|
| adapt_authoring | `GHA_READ_APP_ID`, `GHA_READ_PRIVATE_KEY` **or** `ADAPT_REPOS_READ_TOKEN` | secret | read access to the 4 plugin repos + `adapt-laerdal-life-theme` |
| adapt_authoring | `TEAMS_WEBHOOK_URL` | secret | already set; Teams Workflows webhook URL (skipped if unset) |
| adapt_authoring | `STUDIO_E2E_TOKEN` | secret | already set; dispatches and reads the Playwright run in `Laerdal-Medical/adapt-studio-e2e-test` (E2E reports "skipped" without it) |
| adapt_authoring | `RELEASE_BUCKET`, `AWS_REGION` (`eu-west-1`) | variable | releases bucket |
| adapt_authoring | `AWS_DEPLOY_ROLE_ARN`, `AWS_DEPLOY_ENABLED` | variable | OIDC role; `true` turns the deploy job on |
| adapt_authoring | environment `dev` | environment | branch rule `develop` |
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

GitHub only lets `workflow_dispatch` start a workflow that exists on the **default branch (`master`)**, then `--ref` picks which branch's
copy runs. So: land a stub `pipeline.yml` on `master` first (same file name, `on: workflow_dispatch` with the same two inputs, one no-op job);
dispatches with `--ref develop` then run the real file from `develop`. Push-triggered runs on `develop` need no stub.

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

## Cutover (switch the old path off)

1. Delete the GitHub webhooks (Settings → Webhooks) on adapt_authoring, adapt-authoring-plugins, adapt-framework-plugins, adapt-cdn-deploy-cli.
2. In adapt-framework-plugins disable `build.yml`, `ci.yml`, `docker-build-reusable.yml` (rename to `*.disabled`). Keep sonar/test/auto-formatter.
3. Only then merge to `develop` and let the first pipeline deploy run.
