const express = require('express');

const app = require('../../')();
const configuration = require('../../lib/configuration');
const database = require('../../lib/database');
const logger = require('../../lib/logger');

const server = module.exports = express();

function getContentManager() {
  return app && app.contentmanager;
}

function asIdString(value) {
  return value == null ? '' : String(value);
}

function toApiCourse(course, extras) {
  const createdAt = course.createdAt || new Date();
  const updatedAt = course.updatedAt || createdAt;
  return {
    id: asIdString(course._id),
    title: course.displayTitle || course.title || 'Untitled Course',
    description: course.description || '',
    createdAt,
    updatedAt,
    status: 'Draft',
    instanceId: extras.instanceId,
    menuStyle: extras.menuStyle,
    theme: extras.theme,
    pages: []
  };
}

function enableStudioPreviewEdit(courseId, callback) {
  database.getDatabase(function(error, db) {
    if (error) return callback(error);
    db.retrieve('extensiontype', { name: 'adapt-preview-edit' }, function(error, extensions) {
      if (error) return callback(error);
      const previewEdit = extensions && extensions[0];
      if (!previewEdit) return callback(new Error('adapt-preview-edit extension type is unavailable'));
      const handled = app.emit('extensions:enable', courseId, [previewEdit._id], callback);
      if (!handled) return callback(new Error('No handler registered for extensions:enable'));
    });
  }, configuration.getConfig('dbName'));
}

server.post('/api/courses', function(req, res) {
  const manager = getContentManager();
  const body = req.body || {};
  const title = String(body.title || '').trim();

  if (!manager) {
    logger.log('error', 'Content manager is not available for new UI course creation');
    return res.status(503).json({ success: false, message: 'Course creation is not available yet' });
  }

  if (!title) {
    return res.status(400).json({ success: false, message: 'Course title is required' });
  }

  const courseData = {
    title,
    displayTitle: title,
    description: String(body.description || '').trim(),
    tags: []
  };

  if (req.user && req.user._id) {
    // Keep parity with legacy POST /api/content/:type behavior.
    courseData.createdBy = req.user._id;
  }

  manager.create('course', courseData, function(error, course) {
    if (error) {
      logger.log('error', 'Failed to create course for new UI flow', error);
      return res.status(error.name === 'ContentPermissionError' ? 403 : 500).json({ success: false, message: error.message });
    }

    // New Studio's Quick Edit is an opt-in text-only mode of this extension.
    // Enable it up front so the first Studio preview shell already contains
    // the plugin; legacy course creation and legacy Preview Edit are unchanged.
    enableStudioPreviewEdit(course._id.toString(), function(enableError) {
      if (enableError) {
        logger.log('warn', 'Created new Studio course without Preview Edit enabled', enableError);
      }
      res.status(200).json(toApiCourse(course, {
        instanceId: body.instanceId,
        menuStyle: body.menuStyle,
        theme: body.theme
      }));
    });
  });
});