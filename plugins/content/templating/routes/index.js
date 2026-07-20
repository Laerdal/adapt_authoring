const rest = require('../../../../lib/rest');

const {
  handleTemplatePaste,
  handleMyTemplates,
  handleSharedTemplates,
} = require('./requestHandlers');

class Routes {
  constructor() {
    this.addPluginRoutes();
  }

  addPluginRoutes() {
    rest.post('/templating/paste', handleTemplatePaste);
    // Ownership-scoped listings, mirroring /my/course and /shared/course.
    rest.get('/my/templating', handleMyTemplates);
    rest.get('/shared/templating', handleSharedTemplates);
  }
}

exports = module.exports = Routes;
