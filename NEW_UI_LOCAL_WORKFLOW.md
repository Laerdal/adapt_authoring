# New UI Local-Only Workflow

This repository is now self-contained for New UI deployment.

## What is vendored in this repo

- `new-ui-bundle/` : deployable static New UI assets (index.html + assets)
- `new-ui-source/` : React source snapshot for reference/history
- `public/new/` : runtime location served by Adapt Authoring at `/new`

## Scripts

- `npm run new-ui:sync`
  - Copies `new-ui-bundle/` to `public/new/`
  - Injects legacy hash-route compatibility bridge

- `npm run new-ui:build-and-sync`
  - Alias to `new-ui:sync` (kept for backward compatibility)

## Optional external override

If you want to sync from a temporary external dist artifact, set:

`NEW_UI_DIST_PATH=<absolute path to dist>`

Then run:

`npm run new-ui:sync`

Without `NEW_UI_DIST_PATH`, sync always uses `new-ui-bundle/`.
