#!/usr/bin/env bash
# Packages an already-built tree (grunt build:prod done, devDependencies pruned) into release-out/:
#   app-<id>.tgz        code + built frontend + public/new, no instance state
#   deps-<lockhash>.tgz node_modules, keyed by package-lock.json so unchanged deps are not re-shipped
#   manifest-<id>.json  what went into the release (all repo SHAs)
#   deploy-release.sh   the on-instance script from this same commit
# Env in: RELEASE_ID BRANCH AUTHORING_SHA AUTHORING_PLUGINS_SHA FRAMEWORK_PLUGINS_SHA CDN_CLI_SHA
set -euo pipefail

: "${RELEASE_ID:?}" "${BRANCH:?}" "${AUTHORING_SHA:?}" "${AUTHORING_PLUGINS_SHA:?}" "${FRAMEWORK_PLUGINS_SHA:?}" "${CDN_CLI_SHA:?}"
OUT=release-out

# grunt's sync-new-ui degrades to a warning on failure; a release without a fresh UI must not ship.
for f in frontend/build/css/adapt.css public/new/index.html node_modules/.package-lock.json; do
  [ -e "$f" ] || { echo "ERROR: build output missing: $f" >&2; exit 1; }
done
[ new-ui-source/dist/index.html -nt package-lock.json ] || { echo "ERROR: new-ui-source/dist was not rebuilt" >&2; exit 1; }

LOCK_HASH=$(sha256sum package-lock.json | cut -c1-16)
rm -rf "$OUT" && mkdir -p "$OUT"

tar -czf "$OUT/deps-$LOCK_HASH.tgz" node_modules

tar -czf "$OUT/app-$RELEASE_ID.tgz" -C . \
  --exclude='./.git' --exclude='./.github' --exclude='./.husky' --exclude='./.claude' \
  --exclude='./node_modules' --exclude='./new-ui-source' --exclude='./temp' --exclude='./data' \
  --exclude='./test' --exclude='./docs' --exclude="./$OUT" --exclude='./_repos' \
  --exclude='./conf/config.json' --exclude='./conf/migrate.json' --exclude='./.env' \
  .

node -e '
const e = process.env;
console.log(JSON.stringify({
  releaseId: e.RELEASE_ID, branch: e.BRANCH, lockHash: process.argv[1],
  builtAt: new Date().toISOString(),
  repos: {
    "adapt_authoring": e.AUTHORING_SHA,
    "adapt-authoring-plugins": e.AUTHORING_PLUGINS_SHA,
    "adapt-framework-plugins": e.FRAMEWORK_PLUGINS_SHA,
    "adapt-cdn-deploy-cli": e.CDN_CLI_SHA
  }
}, null, 2));' "$LOCK_HASH" > "$OUT/manifest-$RELEASE_ID.json"

cp scripts/release/deploy-release.sh "$OUT/deploy-release.sh"
ls -lh "$OUT"
