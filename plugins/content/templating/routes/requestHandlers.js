const app = require('../../../../')();
const {
  retrieveContent,
  createContent,
  copyCourseAssets,
} = require('../utils/database');

// Resolve the current user's id for the request. Prefer the passport-populated
// req.user (as the course /my|/shared routes do), fall back to the usermanager.
function getUserId(req) {
  if (req && req.user && req.user._id) return req.user._id;
  const current = app.usermanager.getCurrentUser();
  return current && current._id;
}

// GET /api/my/templating — templates created by the current user.
// Mirrors the course plugin's /my/course endpoint.
async function handleMyTemplates(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    const results = await retrieveContent('templating', { createdBy: userId });
    return res.status(200).json(results || []);
  } catch (error) {
    console.error('Error retrieving my templates:', error);
    return res.status(500).json({ error: 'Failed to retrieve templates' });
  }
}

// Look up display names for a set of user ids, returning an id → user map.
function retrieveUsersById(ids) {
  return new Promise((resolve) => {
    if (!ids.length) return resolve({});
    app.usermanager.retrieveUsers({ _id: { $in: ids } }, {}, (error, users) => {
      if (error || !Array.isArray(users)) return resolve({});
      const map = {};
      users.forEach((u) => {
        map[u._id.toString()] = u;
      });
      resolve(map);
    });
  });
}

function authorName(user) {
  if (!user) return '';
  if (user.firstName && user.lastName) return user.firstName + ' ' + user.lastName;
  return user.email || '';
}

// GET /api/shared/templating — templates shared with the current user, i.e.
// shared with everyone (_isShared) or explicitly shared with this user.
// Mirrors the course plugin's /shared/course endpoint. Each result is enriched
// with an `author` name (the creator), matching the Shared Courses UI.
async function handleSharedTemplates(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    const results = await retrieveContent('templating', {
      $or: [{ _shareWithUsers: userId }, { _isShared: true }],
    });
    const docs = (results || []).map((r) => (r && r.toObject ? r.toObject() : r));
    const creatorIds = [
      ...new Set(docs.map((d) => d.createdBy && d.createdBy.toString()).filter(Boolean)),
    ];
    const userMap = await retrieveUsersById(creatorIds);
    docs.forEach((d) => {
      d.author = authorName(userMap[d.createdBy && d.createdBy.toString()]);
    });
    return res.status(200).json(docs);
  } catch (error) {
    console.error('Error retrieving shared templates:', error);
    return res.status(500).json({ error: 'Failed to retrieve templates' });
  }
}

const PARENT_RELATIONSHIP = {
  contentobject: 'contentobject',
  article: 'contentobject',
  block: 'article',
  component: 'block',
};

const KEY_MAP = {
  ContentObject: 'contentobject',
  Article: 'article',
  Block: 'block',
  Component: 'component',
};

async function handleTemplatePaste(req, res) {
  const contentManager = app.contentmanager;
  const user = app.usermanager.getCurrentUser();
  const templatePasteHelper = new TemplatePasteHelper({
    templateId: req.body.objectId,
    parentId: req.body.parentId,
    layout: req.body.layout,
    sortOrder: req.body.sortOrder,
    courseId: req.body.courseId,
  });

  const result = await templatePasteHelper.createNewContentFromTemplate();

  if (result.success) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(500).json({ success: false });
  }
}

class TemplatePasteHelper {
  constructor({ templateId, parentId, layout, sortOrder, courseId }) {
    this.templateId = templateId;
    this.parentId = parentId;
    this.layout = layout;
    this.sortOrder = sortOrder;
    this.courseId = courseId;
    this.templateObject = null;
    this.parentObject = null;
    this.map = {};
  }

  async createNewContentFromTemplate() {
    const result = {};
    try {
      this.templateObject = await this.retrieveTemplateObject();
      this.parentObject = await this.retrieveParentObject();
      this.setSortOrder();
      this.setupMap();

      await this.createContentItems(KEY_MAP.ContentObject);
      await this.createContentItems(KEY_MAP.Article);
      await this.createContentItems(KEY_MAP.Block);
      await this.createContentItems(KEY_MAP.Component);

      result.success = true;
    } catch (error) {
      console.log('Error:', error);
      result.success = false;
    }
    return result;
  }

  async retrieveTemplateObject() {
    let templateObject;
    const results = await retrieveContent('templating', {
      _id: this.templateId,
    });

    if (results.length !== 1) {
      throw new Error('More than one template with id found');
    }

    templateObject = results[0]._doc;

    if (this.layout && templateObject[KEY_MAP.Component].length == 1) {
      // Persist the component layout when there is only one
      templateObject[KEY_MAP.Component][0]._layout = this.layout;
    }

    return templateObject;
  }

  async retrieveParentObject() {
    let parentObject;
    const parentType = PARENT_RELATIONSHIP[this.templateObject.referenceType];
    const results = await retrieveContent(parentType, { _id: this.parentId });

    if (results.length === 1) {
      parentObject = results[0]._doc;
      return parentObject;
    }

    if (
      this.templateObject.referenceType === KEY_MAP.ContentObject &&
      this.templateObject[KEY_MAP.ContentObject][0]._courseId.toString() ===
        this.templateObject._courseId.toString()
    ) {
      // Handle if this is a root-level page
      parentObject = { _id: this.courseId };
      return parentObject;
    }
  }

  setSortOrder() {
    if (
      this.templateObject[this.templateObject.referenceType].length === 1 &&
      this.sortOrder
    ) {
      this.templateObject[this.templateObject.referenceType][0]._sortOrder =
      this.sortOrder;
    }
  }

  setupMap() {
    [
      KEY_MAP.ContentObject,
      KEY_MAP.Article,
      KEY_MAP.Block,
      KEY_MAP.Component,
    ].forEach((contentType) => {
      this.map[contentType] = {};
      this.templateObject[contentType].forEach((contentItem) => {
        this.map[contentType][contentItem._id.toString()] = null;
      });
    });
  }

  async createContentItems(contentType) {
    const contentItems = this.templateObject[contentType];
    if (contentItems.length === 0) {
      return;
    }

    const parentType = PARENT_RELATIONSHIP[contentType];

    return Promise.all(
      contentItems.map(async (item) => {
        const previousId = item._id.toString();
        const previousParentId = item._parentId.toString();
        const mappedId = this.map[parentType][previousParentId];
        const newParentId = mappedId
          ? mappedId
          : this.parentObject._id.toString();

        delete item._id;
        item._parentId = newParentId;
        item._courseId = this.courseId;

        // Create new content record
        const newItem = await createContent(contentType, item);
        this.map[contentType][previousId] = newItem._id.toString();
        await copyCourseAssets({
          previousId,
          newId: newItem._id,
          newParentId,
          courseId: this.courseId,
        });
      })
    );
  }
}

module.exports = {
  handleTemplatePaste,
  handleMyTemplates,
  handleSharedTemplates,
};
