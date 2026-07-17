define(function (require) {
  const Origin = require('core/origin');
  const EditorPageArticleView = require('modules/editor/contentObject/views/editorPageArticleView');

  // Original function definitions for reference
  const listenToEvents = EditorPageArticleView.prototype.listenToEvents;
  const events = EditorPageArticleView.prototype.events;

  const TemplateHelper = require('../utils/templatingHelper');

  return function () {
    EditorPageArticleView.prototype.listenToEvents = function () {
      listenToEvents.call(this);
      this.listenTo(this, {
        'contextMenu:article:saveTemplate': this.saveTemplate,
      });
    };
    EditorPageArticleView.prototype.events = function () {
      return _.extend({}, events, {
        'click .add-block-template': 'onAddBlockTemplateClicked',
      });
    };

    EditorPageArticleView.prototype.saveTemplate =
      TemplateHelper.handleSaveTemplate;
      EditorPageArticleView.prototype.onAddBlockTemplateClicked = async function (
        event
      ) {
        const currentUserRole = await Origin.getCurrentUserRole();
        if (currentUserRole === 'Authenticated User') {
          Origin.Notify.alert({
            type: 'error',
            text: 'Your user role does not allow editing or deleting courses.'
          });
        } else {
        if (event) {
          event.preventDefault();
        }
  
        TemplateHelper.showTemplateList(this, 'block');
      }
      };
    EditorPageArticleView.prototype.refresh =
      EditorPageArticleView.prototype.render;
  };
});
