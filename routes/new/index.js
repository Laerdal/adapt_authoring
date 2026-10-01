// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
const express = require('express');
const path = require('path');

const configuration = require('../../lib/configuration');
const logger = require('../../lib/logger');
const permissions = require('../../lib/permissions');

const server = module.exports = express();

server.use(require('./courses'));

// Every other top-level path prefix already owned by another routes/* folder
// (or by dynamically-registered /api/* content routes). The catch-all below
// must never swallow one of these, whatever order routes/* happens to load in
// - so it checks this list explicitly rather than relying on registration
// order, which Node's fs.readdir does not guarantee across platforms.
// Keep this in sync with routes/* and any other top-level mount point added
// in future - it's the one place that has to know about all of them.
const RESERVED_PREFIXES = [
  'api', 'classic', 'preview', 'studio', 'download', 'export', 'webhooks',
  'install', 'lang', 'config', 'loading', 'poll', 'support', 'translation',
  'health', 'assetmanagementv2', 'import'
];
const RESERVED_PATH_RE = new RegExp('^/(' + RESERVED_PREFIXES.join('|') + ')(/|$)');

function isReservedPath(p) {
  return RESERVED_PATH_RE.test(p);
}

// The SPA shell is public (all data comes from gated /api/* calls) - exempt
// every non-reserved top-level path from the permissions gate, same posture
// the bare "/" and the login page already had. This is a regex allowlist
// (not routing), so it's independent of Express's registration order, but it
// must exclude the same reserved prefixes above or it would accidentally make
// a gated /api/* (or /preview, /studio, etc.) route publicly readable.
permissions.ignoreRoute(new RegExp('^/(?!(?:' + RESERVED_PREFIXES.join('|') + ')(?:/|$)).*$'));

// Directory that scripts/sync-new-ui.js populates from new-ui-source/dist.
const NEW_UI_ROOT = path.join(configuration.serverRoot, 'public', 'new');

// Backward-compat for old /new bookmarks/links - one redirect, not a live
// route. Must be registered before the catch-all below, or that would claim
// /new/* itself and this would never be reached.
server.get(/^\/new(\/.*)?$/, (req, res) => res.redirect(301, req.params[0] || '/'));

// New UI is the primary UI: it's served directly at the site root - no /new
// prefix anywhere, no redirect hop to get there. Its own express.static mount
// (separate from the app-wide express.static('public') in lib/application.js)
// serves index.html/assets from the same build directory as before; only the
// URL they're served AT has changed, not where they live on disk.
server.use(express.static(NEW_UI_ROOT));

// SPA history fallback for real, direct-load, client-side-routed paths
// (e.g. /dashboard, /course/:id) - only reached once express.static above and
// every other routes/* handler has had a chance to claim the request first.
server.get('/*', (req, res, next) => {
  if (path.extname(req.path)) return next(); // let genuinely-missing assets 404, not HTML
  if (isReservedPath(req.path)) return next(); // never swallow a reserved backend path
  res.sendFile('index.html', { root: NEW_UI_ROOT }, (error) => {
    if (!error) return;
    logger.log('error', `New UI shell missing at ${NEW_UI_ROOT}. Run "npm run new-ui:sync".`);
    if (!res.headersSent) res.status(503).send('New UI not available. Run "npm run new-ui:sync".');
  });
});
