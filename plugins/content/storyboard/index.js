// Storyboard content-type plugin (ADAPT-3760 / ADAPT-3779, AC8).
//
// Registers a `storyboard` Mongoose model (schema-backed via model.schema) and
// a dedicated REST surface under /api/storyboard/{documents,comments,audit}.
// documentJson and _generatedContentMap are stored as JSON strings and (de)
// serialised at the route boundary — see routes/requestHandlers.js.
//
// NB: the legacy `plugins/output/storyboard` plugin also owns /api/storyboard/*
// (word/zip/import). Our routes are namespaced under distinct sub-paths
// (documents / comments / audit) so they never collide. permissions.ignoreRoute
// is idempotent, so registering it here is safe even when that plugin is off.

const contentmanager = require('../../../lib/contentmanager');
const ContentPlugin = contentmanager.ContentPlugin;
const permissions = require('../../../lib/permissions');
const Routes = require('./routes');

class StoryboardContent extends ContentPlugin {
  getModelName = () => 'storyboard';

  getChildType = () => false;

  // TODO(Phase 5): real ownership/course-scoped permissions. For now allow all
  // (matches the templating content plugin) — access is gated by the engine
  // session; the storyboard routes carry their own auth checks.
  hasPermission = (action, userId, tenantId, contentItem, next) => next(null, true);

  getMiddleware = (server, callback) => {
    this.server = server;
    callback(this.addMiddleware.bind(this));
  };

  addMiddleware = () => {
    permissions.ignoreRoute(/\/api\/storyboard\/?.*$/);
    this.routes = new Routes();
  };
}

module.exports = StoryboardContent;
