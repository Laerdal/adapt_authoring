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


    saveEditing: async function(event) {
      const currentUserRole = await Origin.getCurrentUserRole();
      if (currentUserRole === 'Authenticated User') {
        Origin.Notify.alert({
          type: 'error',
          text: 'You do not have permission to edit or delete the courses'
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
