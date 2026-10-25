#!/usr/bin/env bash
# Runs ON an instance (by hand over Session Manager today, by SSM from the pipeline later).
# Usage: deploy-release.sh <release-id> [--dry-run] [--no-rollback]
# Env:   BUCKET (required)  ENV_NAME=dev  APP_DIR=/efs-mount/opt/adapt-dev  PM2_NAME=adapt
#        AWS_DEFAULT_REGION=eu-west-1 (root has no default region on these hosts)
set -euo pipefail

# SSM shells are non-interactive and skip nvm; on these hosts node/npm live under root's nvm (pm2 is in /usr/bin)
export HOME="${HOME:-/root}"
if [ -s "$HOME/.nvm/nvm.sh" ]; then set +eu; . "$HOME/.nvm/nvm.sh" >/dev/null; set -eu; fi
export PATH="$PATH:/usr/local/bin:/usr/bin"

ID="${1:?usage: deploy-release.sh <release-id> [--dry-run] [--no-rollback]}"; shift || true
DRY=0; ROLLBACK=1
for a in "$@"; do case "$a" in --dry-run) DRY=1;; --no-rollback) ROLLBACK=0;; esac; done

: "${BUCKET:?set BUCKET}"
ENV_NAME="${ENV_NAME:-dev}"
PM2_NAME="${PM2_NAME:-adapt}"
# Default APP_DIR = where PM2 actually runs the app (DEV: /efs-mount/opt/adapt-dev, older hosts: /opt/adapt)
APP_DIR="${APP_DIR:-$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const p=JSON.parse(s.slice(s.indexOf("[{"))).find(x=>x.name===process.argv[1]);if(p)console.log(p.pm2_env.pm_cwd)}catch(e){}})' "$PM2_NAME" || true)}"
[ -f "$APP_DIR/conf/config.json" ] || { echo "ERROR: cannot determine APP_DIR from pm2 app '$PM2_NAME'; set APP_DIR" >&2; exit 1; }
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-eu-west-1}"
REPOS_DIR="$APP_DIR/repos"
STATE="$APP_DIR/.deploy"
S3="s3://$BUCKET/$ENV_NAME"
# ponytail: staged on local disk (EFS is slow for many small files); needs ~2x the app size free in /var/tmp
STAGE=$(mktemp -d /var/tmp/adapt-deploy.XXXXXX)
trap 'rm -rf "$STAGE"' EXIT

log() { echo "[deploy $ID] $*"; }
command -v rsync >/dev/null || { echo "ERROR: rsync not installed (dnf install -y rsync)" >&2; exit 1; }
mkdir -p "$STATE"
PREVIOUS=$(cat "$STATE/current" 2>/dev/null || true)
PORT=$(node -p "require('$APP_DIR/conf/config.json').serverPort || 5000")

log "app=$APP_DIR env=$ENV_NAME previous=${PREVIOUS:-none} dry-run=$DRY"
log "isProduction in instance config: $(node -p "require('$APP_DIR/conf/config.json').isProduction")"

aws s3 cp "$S3/manifest-$ID.json" "$STAGE/manifest.json" --only-show-errors
aws s3 cp "$S3/app-$ID.tgz" "$STAGE/app.tgz" --only-show-errors
mkdir "$STAGE/app" && tar -xzf "$STAGE/app.tgz" -C "$STAGE/app"
LOCK=$(node -p "require('$STAGE/manifest.json').lockHash")

# Managed dirs are mirrored with --delete; instance runtime state inside them is protected by the excludes.
# The tarball is owned by the CI user (runner, uid 1001) with CI perms: never copy owner/group/perms onto the instance
# (existing files keep theirs, new files get the usual umask), so DEV's 777 EFS dirs and root ownership stay as they are.
KEEP=(--no-owner --no-group --no-perms)
RSYNC_COMMON=(-a "${KEEP[@]}" --delete --itemize-changes)
sync_dir() { # <dir> [extra rsync args...]
  local d="$1"; shift
  rsync "${RSYNC_COMMON[@]}" "$@" "$STAGE/app/$d/" "$APP_DIR/$d/"
}
PLUGIN_STATE=(--exclude=/content/component/versions/ --exclude=/content/component/componentcache/
  --exclude=/content/extension/versions/ --exclude=/content/extension/extensioncache/
  --exclude=/content/theme/versions/ --exclude=/content/theme/extensioncache/
  --exclude=/content/menu/versions/ --exclude=/content/bower/bowercache/)

apply_files() {
  local flag=("$@")
  for d in lib routes frontend migrations scripts; do sync_dir "$d" "${flag[@]}"; done
  sync_dir plugins "${PLUGIN_STATE[@]}" "${flag[@]}"
  sync_dir public --exclude=/assets/ "${flag[@]}"
  # conf: code files only; config.json / migrate.json are instance-owned and never in the artifact
  rsync -a "${KEEP[@]}" --itemize-changes "${flag[@]}" "$STAGE/app/conf/" "$APP_DIR/conf/"
  # top-level files (package.json, server.js, ...); directories handled above
  for f in "$STAGE"/app/*; do
    [ -f "$f" ] || continue
    rsync -a "${KEEP[@]}" --itemize-changes "${flag[@]}" "$f" "$APP_DIR/"
  done
}

if [ "$DRY" = 1 ]; then
  log "DRY RUN: changes that would be applied (lines starting with *deleting are removals — review them):"
  apply_files --dry-run | grep -v '^\.' | head -400 || true
  log "deps: installed lock=$(cat "$STATE/lockhash" 2>/dev/null || echo none) release lock=$LOCK"
  node -e '
    const m = require(process.argv[1]); for (const [r, s] of Object.entries(m.repos)) console.log("pin", r, s)' "$STAGE/manifest.json"
  exit 0
fi

fail() {
  log "FAILED at: $1"
  if [ "$ROLLBACK" = 1 ] && [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$ID" ]; then
    log "rolling back to $PREVIOUS"
    "$0" "$PREVIOUS" --no-rollback || log "ROLLBACK ALSO FAILED - manual intervention needed"
  fi
  exit 1 # a rolled-back deploy is still a failed deploy
}

wait_healthy() { # up to ~90s; 200, or 401/403 (server answering) counts as up
  for _ in $(seq 1 30); do
    code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$PORT/api/webhooks/healthcheck" || true)
    case "$code" in 200|401|403) return 0;; esac
    sleep 3
  done
  return 1
}

log "applying files"; apply_files >/dev/null || fail "file sync"

if [ "$LOCK" != "$(cat "$STATE/lockhash" 2>/dev/null || true)" ]; then
  log "deps changed ($LOCK), swapping node_modules"
  aws s3 cp "$S3/deps-$LOCK.tgz" "$STAGE/deps.tgz" --only-show-errors || fail "deps download"
  rm -rf "$APP_DIR/node_modules.new" && mkdir "$APP_DIR/node_modules.new"
  tar -xzf "$STAGE/deps.tgz" -C "$APP_DIR/node_modules.new" --strip-components=1 || fail "deps extract"
  rm -rf "$APP_DIR/node_modules.old"
  [ -d "$APP_DIR/node_modules" ] && mv "$APP_DIR/node_modules" "$APP_DIR/node_modules.old"
  mv "$APP_DIR/node_modules.new" "$APP_DIR/node_modules"
  echo "$LOCK" > "$STATE/lockhash"
  (rm -rf "$APP_DIR/node_modules.old" &) # slow on NFS; do not block the deploy
fi

# Pin the deployment clones to the exact SHAs this release was built from.
while read -r repo sha; do
  [ "$repo" = adapt_authoring ] && continue
  dir="$REPOS_DIR/$repo"
  [ -d "$dir/.git" ] || { log "WARN: $dir is not a git clone, skipping"; continue; }
  before=$(git -C "$dir" rev-parse HEAD)
  git -C "$dir" status --short | sed 's/^/  local change: /'
  git -C "$dir" fetch origin --prune --quiet && git -C "$dir" checkout -f --detach "$sha" --quiet \
    && git -C "$dir" submodule update --init --checkout --quiet || fail "checkout $repo@$sha"
  if [ "$repo" = adapt-cdn-deploy-cli ] && [ "$before" != "$sha" ]; then
    log "cdn-deploy-cli changed, npm install + link"
    (cd "$dir" && npm install --no-audit --no-fund >/dev/null && npm link >/dev/null) || fail "cdn-deploy-cli install"
  fi
done < <(node -e 'for (const [r, s] of Object.entries(require(process.argv[1]).repos)) console.log(r, s)' "$STAGE/manifest.json")

log "restarting $PM2_NAME"
pm2 restart "$PM2_NAME" --update-env >/dev/null || fail "pm2 restart"
wait_healthy || fail "health check after restart"

# Framework plugins live in the DB + temp/, not in the artifact: re-import them from the pinned clone.
# No ?branch= so the webhook skips its own git step and imports exactly what is checked out. Synchronous.
log "importing framework plugins"
curl -fsS -m 900 "http://127.0.0.1:$PORT/api/webhooks/force/frameworkplugins" >/dev/null \
  || { log "framework plugin import FAILED (code is deployed; not rolling back — a rollback would not undo the DB import)"; exit 1; }
wait_healthy || fail "health check after import"

echo "${PREVIOUS:-}" > "$STATE/previous"; echo "$ID" > "$STATE/current"
log "OK. Reminder: DB scripts in adapt-build/database-helpers are still manual."
