const express = require('express');

const app = require('../../')();
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

    res.status(200).json(toApiCourse(course, {
      instanceId: body.instanceId,
      menuStyle: body.menuStyle,
      theme: body.theme
    }));
  });
});