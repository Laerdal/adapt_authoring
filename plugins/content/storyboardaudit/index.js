// Storyboard audit content-type plugin (ADAPT-3779, AC8).
//
// Model-only: registers the `storyboardaudit` Mongoose model. Records are an
// append-only, immutable trail of workflow events (status_change / generated /
// imported). The routes served by the `storyboard` plugin expose only
// list + append — never update or delete.

const contentmanager = require('../../../lib/contentmanager');
const ContentPlugin = contentmanager.ContentPlugin;

class StoryboardAuditContent extends ContentPlugin {
  getModelName = () => 'storyboardaudit';

  getChildType = () => false;

  hasPermission = (action, userId, tenantId, contentItem, next) => next(null, true);
}

module.exports = StoryboardAuditContent;
