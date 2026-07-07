// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
const express = require('express');
const path = require('path');

const configuration = require('../../lib/configuration');
const logger = require('../../lib/logger');
const permissions = require('../../lib/permissions');

const server = module.exports = express();

// The SPA shell is public (all data comes from gated /api/* calls), so exempt
// /new/* from the permissions gate — same posture as the login page and root.
permissions.ignoreRoute(/^\/new\/?.*$/);

// Directory that scripts/sync-new-ui.js populates and express.static('public') serves.
const NEW_UI_ROOT = path.join(configuration.serverRoot, 'public', 'new');

// Normalise the bare mount so the SPA's root-relative asset URLs resolve.
// (express.static usually 301s this already; this is the un-synced/safety path.)
server.get('/new', (req, res) => res.redirect(301, '/new/'));

// SPA history fallback. express.static('public') is registered earlier in the
// middleware chain, so real files (/new/assets/*, /new/index.html) are served
// before this runs. Only unmatched, extension-less /new/* paths reach here — hand
// them the SPA shell so client-side routing resolves them. Touches no /api/* route.
server.get('/new/*', (req, res, next) => {
  if (path.extname(req.path)) return next(); // let genuinely-missing assets 404, not HTML
  res.sendFile('index.html', { root: NEW_UI_ROOT }, (error) => {
    if (!error) return;
    logger.log('error', `New UI shell missing at ${NEW_UI_ROOT}. Run "npm run new-ui:sync".`);
    if (!res.headersSent) res.status(503).send('New UI not available. Run "npm run new-ui:sync".');
  });
});
