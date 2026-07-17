define(function (require) {
  const EditorPageComponentView = require('modules/editor/contentObject/views/editorPageComponentView');
  const preRender = EditorPageComponentView.prototype.preRender;
  const TemplateHelper = require('../utils/templatingHelper');

  return function () {
    EditorPageComponentView.prototype.preRender = function () {
      preRender.call(this);
      this.listenTo(this, {
        'contextMenu:component:saveTemplate': this.saveTemplate,
      });
    };

    EditorPageComponentView.prototype.saveTemplate =
      TemplateHelper.handleSaveTemplate;
    EditorPageComponentView.prototype.refresh =
      EditorPageComponentView.prototype.render;
  };
});
