const express = require('express');
const path = require('path');
const util = require('util');
const crypto = require('crypto');

const configuration = require('../../lib/configuration');
const Constants = require('../../lib/outputmanager').Constants;
const helpers = require('../../lib/helpers');
const logger = require('../../lib/logger');
const usermanager = require('../../lib/usermanager');

const server = module.exports = express();

server.set('views', __dirname);
server.set('view engine', 'hbs');

// Store temporary PDF generation tokens (in production, use Redis or database)
const pdfTokens = new Map();

function PreviewPermissionError(message, httpCode) {
  this.message = message || "Permission denied";
  this.http_code = httpCode || 401;
}
util.inherits(PreviewPermissionError, Error);

// Generate temporary token for PDF generation
server.generatePDFToken = function(tenantId, courseId, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const previewKey = `${tenantId}-${courseId}`;
  
  pdfTokens.set(token, {
    tenantId,
    courseId,
    userId,
    previewKey,
    expires: Date.now() + (10 * 60 * 1000) // 10 minutes
  });
  
  // Clean up expired tokens
  setTimeout(() => {
    pdfTokens.delete(token);
  }, 10 * 60 * 1000);
  
  return token;
};

server.get('/preview/:tenant/:course/*', (req, res, next) => {
  const courseId = req.params.course;
  const tenantId = req.params.tenant;
  const user = usermanager.getCurrentUser();
  const file = req.params[0] || Constants.Filenames.Main;
  const masterTenantId = configuration.getConfig('masterTenantID');
  const previewKey = `${tenantId}-${courseId}`;
  
  // Check for PDF generation token
  const pdfToken = req.query.pdfToken;
  if (pdfToken) {
    return handlePDFTokenRequest(pdfToken);
  }

  if (!user) {
    return onAuthError();
  }
  (file === Constants.Filenames.Main) ? handleIndexFile() : handleNonIndexFile();
  
  function handlePDFTokenRequest(token) {
    const tokenData = pdfTokens.get(token);
    
    if (!tokenData) {
      logger.log('warn', `Preview: Invalid or expired PDF token`);
      return next(new PreviewPermissionError('Invalid or expired token'));
    }
    
    if (tokenData.expires < Date.now()) {
      pdfTokens.delete(token);
      logger.log('warn', `Preview: Expired PDF token`);
      return next(new PreviewPermissionError('Token expired'));
    }
    
    if (tokenData.tenantId !== tenantId || tokenData.courseId !== courseId) {
      logger.log('warn', `Preview: PDF token mismatch`);
      return next(new PreviewPermissionError('Token mismatch'));
    }
    
    // Allow access for PDF generation
    sendFile(file);
  }

  function onAuthError() {
    logger.log('warn', `Preview: user '${user ? user._id : 'undefined'}' does not have permission to view course '${courseId}' on tenant '${tenantId}'`);
    next(new PreviewPermissionError());
  }

  function sendFile(filename) {
    res.sendFile(filename, {
      root: path.join(configuration.serverRoot, Constants.Folders.Temp, masterTenantId, Constants.Folders.Framework, Constants.Folders.AllCourses, tenantId, courseId, Constants.Folders.Build)
    }, error => {
      if(error) res.status(error.status || 500).end();
    });
  }

  function handleIndexFile() {
    // Verify the session is configured to hold the course previews accessible for this user.
    if (!req.session.previews || !Array.isArray(req.session.previews)) {
      req.session.previews = [];
    }
    if (tenantId !== user.tenant._id.toString() && tenantId !== masterTenantId) {
      return onAuthError();
    }
    helpers.hasCoursePermission('*', user._id, tenantId, { _id: courseId }, (error, hasPermission) => {
      if(error) {
        logger.log('error', error);
        next(new PreviewPermissionError());
      }
      if(!hasPermission) { // Remove this course from the cached sessions.
        const position = req.session.previews.indexOf(previewKey);
        if (position > -1) req.session.previews.splice(position, 1);
        return onAuthError();
      }
      req.session.previews.push(previewKey);
      return sendFile(file);
    });
  }

  function handleNonIndexFile() {
    // only allow if preview has been whitelisted
    if (!req.session.previews || !req.session.previews.includes(previewKey)) {
      return res.status(404).end();
    }
    sendFile(file);
  }
});
