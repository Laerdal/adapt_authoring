define(function (require) {
  const OriginView = require('core/views/originView');
  require('backbone-forms');
  // Registers the custom 'Users' editor (ScaffoldUsersView) on Backbone.Form.
  require('modules/scaffold/views/scaffoldUsersView');

  const SaveNewTemplateView = OriginView.extend({
    className: 'save-new-template',

    // Render the sharing controls through a Backbone scaffold form so they are
    // the exact same fields (markup, styling, ⓘ help, ↺ reset, selectize
    // dropdown/search/scroll behaviour) as Project Settings → Share with
    // specific users. No hand-built selectize — the scaffold owns it all.
    postRender: function () {
      this.form = new Backbone.Form({
        schema: {
          _isShared: {
            type: 'Checkbox',
            // `inputType` drives the field template's data-type attribute (and
            // thus the scaffold field styling) — keep it in sync with `type`.
            inputType: 'Checkbox',
            title: 'Share with all users',
            help: "Controls whether or not your colleagues will be able to see this template from the 'Shared Templates' filter",
          },
          _shareWithUsers: {
            type: 'Users',
            inputType: 'Users',
            title: 'Share with specific users',
            help: "Specifies which colleagues will be able to see this template from the 'Shared Templates' filter",
          },
        },
      }).render();
      this.$('#templateShareForm').append(this.form.el);
    },

    getData: function () {
      const share = this.form ? this.form.getValue() : {};
      return {
        name: this.$('#templateName').val(),
        description: this.$('#templateDescription').val(),
        _isShared: !!share._isShared,
        _shareWithUsers: share._shareWithUsers || [],
      };
    },

    remove: function () {
      if (this.form) this.form.remove();
      return OriginView.prototype.remove.apply(this, arguments);
    },
  });
  SaveNewTemplateView.template = 'saveNewTemplate';
  return SaveNewTemplateView;
});
