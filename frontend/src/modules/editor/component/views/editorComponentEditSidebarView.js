// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Backbone = require('backbone');
  var Origin = require('core/origin');
  var SidebarItemView = require('modules/sidebar/views/sidebarItemView');

  var EditorComponentEditSidebarView = SidebarItemView.extend({
    events: {
      'click .editor-component-edit-sidebar-save': 'saveEditing',
      'click .editor-component-edit-sidebar-cancel': 'cancelEditing'
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
      event.preventDefault();
      this.updateButton('.editor-component-edit-sidebar-save', Origin.l10n.t('app.saving'));
      Origin.trigger('editorComponentEditSidebar:views:save');
      }
    },

    cancelEditing: function(event) {
      event.preventDefault();
      // FIXME got to be a better way to do this
      this.model.fetchParent(function(parentBlock) {
        parentBlock.fetchParent(function(parentArticle) {
          parentArticle.fetchParent(function(parentPage) {
            Origin.router.navigateTo('editor/' + Origin.editor.data.course.get('_id') + '/page/' + parentPage.get('_id'));
          });
        });
      });
    }
  }, {
    template: 'editorComponentEditSidebar'
  });

  return EditorComponentEditSidebarView;
});
