// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Backbone = require('backbone');
  var Origin = require('core/origin');
  var EditorData = require('../global/editorDataLoader');
  var Helpers = require('../global/helpers');

  var ComponentModel = require('core/models/componentModel');
  var EditorComponentEditView = require('./views/editorComponentEditView');
  var EditorComponentEditSidebarView = require('./views/editorComponentEditSidebarView');


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

  Origin.on('editor:component', function(data) {
    (new ComponentModel({ _id: data.id })).fetch({
      success: function(model) {
        var form = Origin.scaffold.buildForm({ model: model });
        Helpers.setPageTitle(model);
        Origin.sidebar.addView(new EditorComponentEditSidebarView({ model: model, form: form }).$el);
        Origin.contentPane.setView(EditorComponentEditView, { model: model, form: form });
      }
    });
  });
});
