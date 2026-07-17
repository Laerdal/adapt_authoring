// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function (require) {
  var Origin = require('core/origin');
  var OriginView = require('core/views/originView');
  var TemplateManagementCollectionView = require('./templateManagementCollectionView');

  var TemplateManagementView = OriginView.extend(
    {
      tagName: 'div',
      className: 'template-management',

      preRender: function () {
        this.listenTo(Origin, {
          'window:resize': this.resizePanels,
          'assetManagement:assetItemView:preview': this.onAssetClicked,
          'assetManagement:assetPreviewView:delete': this.onAssetDeleted,
        });
      },

      postRender: function () {
        // Hide the sidebar
        Origin.trigger('sidebar:sidebarContainer:hide');
        var view = new TemplateManagementCollectionView({
          collection: this.collection,
        });
        this.$('.template-management-templates-container-inner').append(
          view.$el
        );
        this.setViewToReady();
      },

      resizePanels: function () {},

      onAssetClicked: function (model) {},

      onAssetDeleted: function () {},
    },
    {
      template: 'templateManagement',
    }
  );

  return TemplateManagementView;
});
