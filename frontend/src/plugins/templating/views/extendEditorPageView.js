define(function (require) {
  const EditorPageView = require('modules/editor/contentObject/views/editorPageView');
  const TemplateHelper = require('../utils/templatingHelper');
  const Origin = require('core/origin');
  // Prevent overwriting the original events and functions
  const events = EditorPageView.prototype.events;

  // Extend the prototype of EditorPageView
  return function () {
    EditorPageView.prototype.events = function () {
      return _.extend({}, events, {
        'click .add-article-template': 'onAddArticleTemplate',
      });
    };

    EditorPageView.prototype.onAddArticleTemplate = async function (event) {
      const currentUserRole = await Origin.getCurrentUserRole();
      if (currentUserRole === 'Authenticated User') {
        Origin.Notify.alert({
          type: 'error',
          text: 'Your user role does not allow editing or deleting courses.'
        });
      } else {
      TemplateHelper.showTemplateList(this, 'article');
      }
    };

    EditorPageView.prototype.saveTemplate = function (event) {
      if (event) {
        event.preventDefault();
      }
      const self = this;
      TemplateHelper.handleSaveTemplate(self);
    };
    EditorPageView.prototype.refresh = EditorPageView.prototype.render;
  };
});
