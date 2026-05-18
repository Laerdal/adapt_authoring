define(function (require) {
  var $ = require('jquery');
  var Origin = require('core/origin');

  var EXTENSION_KEY = 'preview-edit';
  var TARGET_ATTRIBUTE = '_previewEdit';

  /**
   * Ensure course._extensions._previewEdit._isEnabled === true. The Preview Editor
   * extension stores its settings under the course's _extensions map; if the course
   * creator unchecked _isEnabled there, the runtime extension won't activate even
   * though the extension is included in the build.
   */
  function ensurePreviewEditEnabled(course, cb) {
    var extensions = course.get('_extensions') || {};
    var current = extensions[TARGET_ATTRIBUTE] || {};
    if (current._isEnabled === true) {
      return cb();
    }
    var updatedPreviewEdit = $.extend({}, current, { _isEnabled: true });
    var updatedExtensions = $.extend({}, extensions);
    updatedExtensions[TARGET_ATTRIBUTE] = updatedPreviewEdit;
    course.set('_extensions', updatedExtensions);
    course.save(null, {
      success: function () {
        cb();
      },
      error: function (model, response) {
        console.error('[Studio] failed to save _extensions._previewEdit', response);
        var message = (response && response.responseJSON && response.responseJSON.message)
          || 'Failed to enable the Preview Editor on this course.';
        Origin.Notify.alert({ type: 'error', title: 'Studio', text: message });
      }
    });
  }

  function triggerStudioPreview(course) {
    ensurePreviewEditEnabled(course, function () {
      Origin.trigger('editorCommon:preview', true, true);
    });
  }

  Origin.on('navigation:studio', function () {
    var editor = Origin.editor;
    var hasCourseContext = editor
      && editor.data
      && editor.data.course
      && typeof editor.data.course.get === 'function'
      && editor.data.course.get('_id');

    if (!hasCourseContext) {
      Origin.Notify.alert({
        type: 'info',
        title: 'Studio',
        text: 'Open a course to preview it in Studio.'
      });
      return;
    }

    var course = editor.data.course;
    var courseId = course.get('_id');
    var config = editor.data.config;
    var enabled = (config && config.get('_enabledExtensions')) || {};

    // Already enabled on the course config - just make sure _isEnabled is on, then preview.
    if (enabled[EXTENSION_KEY]) {
      triggerStudioPreview(course);
      return;
    }

    // Resolve the extensiontype _id from the editor's loaded collection.
    var extensionTypes = editor.data.extensiontypes;
    var previewEditType = extensionTypes && typeof extensionTypes.findWhere === 'function'
      ? extensionTypes.findWhere({ extension: EXTENSION_KEY })
      : null;

    if (!previewEditType) {
      Origin.Notify.alert({
        type: 'error',
        title: 'Studio',
        text: 'The "preview-edit" extension is not installed on this tenant. Install it via Plugin Management and try again.'
      });
      return;
    }

    var extensionTypeId = previewEditType.get('_id');

    // Enable the extension on this course, then trigger a force-rebuild preview.
    $.post('api/extension/enable/' + courseId, { extensions: [extensionTypeId] })
      .done(function (result) {
        if (!result || !result.success) {
          return Origin.Notify.alert({
            type: 'error',
            title: 'Studio',
            text: 'Could not enable the Preview Editor extension on this course.'
          });
        }
        // Refresh in-memory config so the editor sees the new extension before preview.
        if (config && typeof config.fetch === 'function') {
          config.fetch({
            success: function () {
              Origin.trigger('scaffold:updateSchemas', function () {
                triggerStudioPreview(course);
              });
            },
            error: function () {
              // Even if config refetch fails, the server-side build will still pick up the new extension.
              triggerStudioPreview(course);
            }
          });
        } else {
          triggerStudioPreview(course);
        }
      })
      .fail(function (jqXHR) {
        var message = (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.message)
          || 'Failed to enable the Preview Editor extension.';
        Origin.Notify.alert({
          type: 'error',
          title: 'Studio',
          text: message
        });
      });
  });
});
