// internal
const app = require('../../../../')();
const database = require('../../../../lib/database');
const configuration = require('../../../../lib/configuration');

async function getDatabase() {
  const { masterTenantID } = configuration.getConfig();
  return new Promise((resolve, reject) => {
    database.getDatabase((error, db) => {
      if (error) {
        return reject(error);
      }
      resolve(db);
    }, masterTenantID);
  });
}

async function retrieveContent(contentType, data) {
  const contentManager = app.contentmanager;
  const { masterTenantID } = configuration.getConfig();
  return new Promise((resolve, reject) => {
    contentManager.retrieve(
      contentType,
      data,
      (error, results) => {
        if (error) {
          return reject(error);
        }
        resolve(results);
      },
      masterTenantID
    );
  });
}

async function createContent(contentType, data) {
  const contentManager = app.contentmanager;
  const { masterTenantID } = configuration.getConfig();
  return new Promise((resolve, reject) => {
    contentManager.create(
      contentType,
      data,
      (error, results) => {
        if (error) {
          return reject(error);
        }
        resolve(results);
      },
      masterTenantID
    );
  });
}

async function copyCourseAssets(data) {
  const courseAssets = await retrieveContent('courseasset', {
    _contentTypeId: data.previousId,
  });

  if (courseAssets.length === 0) {
    // No course assets to copy
    return;
  }
  return Promise.all(
    courseAssets.map(async (record) => {
      // Converting to object here stops the original reference to a mongoose model
      const courseAsset = record.toObject();
      // Delete old _id so create will actually create
      delete courseAsset._id;
      // Set new id and parentId
      courseAsset._contentTypeId = data.newId;
      courseAsset._contentTypeParentId = data.newParentId;
      courseAsset._courseId = data.courseId;
      await createContent('courseasset', courseAsset);
    })
  );
}

exports = module.exports = {
  getDatabase,
  retrieveContent,
  createContent,
  copyCourseAssets,
};
