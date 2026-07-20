define(function (require) {
  // Module to extend the prototype of EditorPageBlockView
  const EditorPageBlockView = require('modules/editor/contentObject/views/editorPageBlockView');

  // Prevent overwriting the original events and functions
  const listenToEvents = EditorPageBlockView.prototype.listenToEvents;
  const events = EditorPageBlockView.prototype.events;

  const TemplateHelper = require('../utils/templatingHelper');

  return function () {
    EditorPageBlockView.prototype.events = function () {
      return _.extend({}, events, {
        'click .add-component-template': 'onAddComponentTemplateClicked',
      });
    };

    EditorPageBlockView.prototype.listenToEvents = function () {
      listenToEvents.call(this);
      this.listenTo(this, {
        'contextMenu:block:saveTemplate': this.saveTemplate,
      });
    };

    EditorPageBlockView.prototype.saveTemplate =
      TemplateHelper.handleSaveTemplate;
    EditorPageBlockView.prototype.refresh =
      EditorPageBlockView.prototype.render;

    EditorPageBlockView.prototype.onAddComponentTemplateClicked = function (
      event
    ) {
      if (event) {
        event.preventDefault();
      }

      TemplateHelper.showTemplateList(this, 'component');
    };
  };
});
