const ContentObject = require('../contentobject');
const { readConfiguration } = require('../../../lib/configuration');
const permissions = require('../../../lib/permissions');
const database = require('../../../lib/database');
const path = require('path');
const Routes = require('./routes');

class TemplateContent extends ContentObject {
  hasPermission = (action, userId, tenantId, contentItem, next) => {
    // TODO: implement permissions handling
    // const resource = permissions.buildResourceString(tenantId, '/api/content/template/' + contentItem._id);
    // console.log('API: /api/template/' + contentItem._id);
    // return permissions.hasPermission(userId, action, resource, next);
    // We lack to define some permissions for this content type
    return next(null, true);
  };

  getModelName = () => {
    return 'templating';
  };

  getChildType = () => false;

  getMiddleware = (server, callback) => {
    this.server = server;
    callback(this.addMiddleware.bind(this));
  };

  addMiddleware = () => {
    // All role types may use this plugin
    permissions.ignoreRoute(/\/api\/templating\/?.*$/);
    // Ownership-scoped template listings (results are filtered by the current
    // user inside the handlers, so the authorization gate can be skipped).
    permissions.ignoreRoute(/\/api\/my\/templating\/?.*$/);
    permissions.ignoreRoute(/\/api\/shared\/templating\/?.*$/);
    this.routes = new Routes();
  };
}

module.exports = TemplateContent;
