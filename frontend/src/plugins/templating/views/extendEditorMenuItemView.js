define(function (require) {
  const Origin = require('core/origin');
  const EditorMenuItemView = require('modules/editor/contentObject/views/editorMenuItemView');
  const EditorMenuLayerView = require('modules/editor/contentObject/views/editorMenuLayerView');
  const ContentCollection = require('core/collections/contentCollection');

  // Original function definitions for reference
  const setupEvents = EditorMenuItemView.prototype.setupEvents;
  const events = EditorMenuLayerView.prototype.events;

  const TemplateHelper = require('../utils/templatingHelper');

  return function () {
    EditorMenuItemView.prototype.setupEvents = function () {
      setupEvents.call(this);
      const type = this.model.get('_type'); // "page" or "menu"
      this.on('contextMenu:' + type + ':saveTemplate', this.saveTemplate);
    };

    EditorMenuItemView.prototype.saveTemplate =
      TemplateHelper.handleSaveTemplate;

    EditorMenuLayerView.prototype.events = function () {
      return _.extend({}, events, {
        'click .add-contentobject-template': 'onAddPageTemplateClicked',
      });
    };

    EditorMenuLayerView.prototype.onAddPageTemplateClicked = async function (event) {
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

      this.model = new Backbone.Model({ _id: this._parentId });
      TemplateHelper.showTemplateList(this, 'contentobject');
    }
    };

    EditorMenuLayerView.prototype.refresh = function (event) {
      const contentobjects = new ContentCollection(null, {
        _type: 'contentobject',
        _courseId: Origin.editor.data.course.get('_id'),
      });
      contentobjects.fetch({
        success: _.bind(function (children) {
          this.contentobjects = children;
          this.models = this.contentobjects.where({
            _parentId: this.model.get('_id'),
          });
          this.render();
        }, this),
        error: console.error,
      });
    };
  };
});
