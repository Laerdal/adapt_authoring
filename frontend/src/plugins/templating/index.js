define(function (require) {
  // Basic framework modules
  const Origin = require('core/origin');

  // Extended view modules
  const extendOriginView = require('./views/extendOriginView');
  const extendEditorMenuItemView = require('./views/extendEditorMenuItemView');
  const extendEditorPageView = require('./views/extendEditorPageView');
  const extendEditorPageComponentView = require('./views/extendEditorPageComponentView');
  const extendEditorPageBlockView = require('./views/extendEditorPageBlockView');
  const extendEditorPageArticleView = require('./views/extendEditorPageArticleView');
  const TemplateManagementView = require('./views/templateManagementView');
  const TemplateCollection = require('./collections/templateCollection');

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

  // Plugin event listener trigger initialization
  Origin.on('origin:dataReady login:changed', initPlugin);

  function initPlugin() {
    Origin.globalMenu.addItem({
      location: 'global',
      text: 'Template Management',
      icon: 'fa-file-image-o',
      callbackEvent: 'templateManagement:open',
      sortOrder: 2,
    });

    Origin.on('globalMenu:templateManagement:open', function () {
      Origin.router.navigateTo('templateManagement');
    });

    Origin.on(
      'router:templateManagement',
      function (location, subLocation, action) {
        Origin.templateManagement = {
          filterData: {},
        };
        return loadTemplatesView();
      }
    );
    function loadTemplatesView() {
      const templateCollection = new TemplateCollection();
      Origin.trigger('location:title:hide');
      Origin.contentPane.setView(TemplateManagementView, {
        collection: templateCollection,
      });
      Origin.trigger('templateManagement:loaded');
    }

    const buttonElement = {
      title: Origin.l10n.t('app.savetemplate'),
      className: 'context-menu-item',
      callbackEvent: 'saveTemplate',
    };
    Origin.contextMenu.addItem('page', buttonElement);
    Origin.contextMenu.addItem('article', buttonElement);
    Origin.contextMenu.addItem('block', buttonElement);
    Origin.contextMenu.addItem('component', buttonElement);

    extendOriginView();
    extendEditorMenuItemView();
    extendEditorPageView();
    extendEditorPageArticleView();
    extendEditorPageBlockView();
    extendEditorPageComponentView();
  }
});
