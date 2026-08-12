// Storyboard comment content-type plugin (ADAPT-3779, AC9).
//
// Model-only: it registers the `storyboardcomment` Mongoose model. Its REST
// surface is served by the `storyboard` plugin under /api/storyboard/*.
// A comment anchors to a document block (blockId), supports threaded replies
// (_parentCommentId) and a resolved flag; author/timestamps come from
// trackedObject via the tenantObject $ref.

const contentmanager = require('../../../lib/contentmanager');
const ContentPlugin = contentmanager.ContentPlugin;

class StoryboardCommentContent extends ContentPlugin {
  getModelName = () => 'storyboardcomment';

  getChildType = () => false;

  hasPermission = (action, userId, tenantId, contentItem, next) => next(null, true);
}

module.exports = StoryboardCommentContent;
