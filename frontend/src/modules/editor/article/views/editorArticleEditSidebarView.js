// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Backbone = require('backbone');
  var Origin = require('core/origin');
  var SidebarItemView = require('modules/sidebar/views/sidebarItemView');

  var EditorArticleEditSidebarView = SidebarItemView.extend({
    events: {
      'click .editor-article-edit-sidebar-save': 'saveEditing',
      'click .editor-article-edit-sidebar-cancel': 'cancelEditing'
    },

    postRender: function() {

    },

    getCurrentUserRole: async function () {
      const response = await fetch('/api/user/me');
      const result = await response.json();
      return result.rolesAsName[0];
    },

    saveEditing: async function(event) {
      const currentUserRole = await this.getCurrentUserRole();
      if (currentUserRole === 'Authenticated User') {
        Origin.Notify.alert({
          type: 'error',
          text: 'Your user role does not allow editing or deleting courses'
        });
      } else {
      event && event.preventDefault();
      this.updateButton('.editor-article-edit-sidebar-save', Origin.l10n.t('app.saving'));
      Origin.trigger('editorArticleEditSidebar:views:save');
      }
    },

    cancelEditing: function(event) {
      event && event.preventDefault();
      Backbone.history.history.back();
    }
  }, {
    template: 'editorArticleEditSidebar'
  });

  return EditorArticleEditSidebarView;
});
