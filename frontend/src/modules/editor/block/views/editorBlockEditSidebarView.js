// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Backbone = require('backbone');
  var Origin = require('core/origin');
  var SidebarItemView = require('modules/sidebar/views/sidebarItemView');

  var EditorBlockEditSidebarView = SidebarItemView.extend({
    events: {
      'click .editor-block-edit-sidebar-save': 'saveEditing',
      'click .editor-block-edit-sidebar-cancel': 'cancelEditing'
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
          text: 'You do not have permission to edit or delete the courses'
        });
      } else {
      event && event.preventDefault();
      this.updateButton('.editor-block-edit-sidebar-save', Origin.l10n.t('app.saving'));
      Origin.trigger('editorBlockEditSidebar:views:save');
      }
    },

    cancelEditing: function(event) {
      event && event.preventDefault();
      Backbone.history.history.back();
    }
  }, {
    template: 'editorBlockEditSidebar'
  });

  return EditorBlockEditSidebarView;
});
