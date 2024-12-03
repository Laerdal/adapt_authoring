// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Origin = require('core/origin');
  var Helpers = require('../global/helpers');

  var ArticleModel = require('core/models/articleModel');
  var EditorArticleEditSidebarView = require('./views/editorArticleEditSidebarView');
  var EditorArticleEditView = require('./views/editorArticleEditView');

  async function getCurrentUserRole() {
    try {
      const response = await fetch('/api/user/me');
      const result = await response.json();
      return result.rolesAsName[0]; // Assuming the role is the first item in rolesAsName
    } catch (error) {
      console.error('Error fetching user role:', error);
      throw new Error('Unable to fetch user role');
    }
  }
  
  Origin.getCurrentUserRole = getCurrentUserRole;

  Origin.on('editor:article', function(data) {
    if(data.action !== 'edit') {
      return;
    }
    (new ArticleModel({ _id: data.id })).fetch({
      success: function(model) {
        var form = Origin.scaffold.buildForm({ model: model });
        Helpers.setPageTitle(model);
        Origin.sidebar.addView(new EditorArticleEditSidebarView({ model: model, form: form }).$el);
        Origin.contentPane.setView(EditorArticleEditView, { model: model, form: form });
      }
    });
  });
});
