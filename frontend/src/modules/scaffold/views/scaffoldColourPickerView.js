define([
  'core/origin',
  'backbone-forms',
  'libraries/spectrum/spectrum'
], function(Origin, BackboneForms, Spectrum) {

  var ScaffoldColourPickerView = Backbone.Form.editors.Base.extend({

    tagName: 'input',

    className: 'scaffold-colour-picker',

    events: {
      'change': function() { this.trigger('change', this); },
      'focus': function() { this.trigger('focus', this); },
      'blur': function() { this.trigger('blur', this); }
    },

    render: function() {
      _.defer(this.postRender.bind(this));
      return this;
    },

    postRender: function() {

      const options = {
        color: this.value,
        showAlpha: true,
        showInitial: true,
        showInput: true,
        showPalette: true,
        showButtons: true,
        cancelText: Origin.l10n.t('app.scaffold.colourPickerCancel'),
        allowEmpty: true, // to allow empty strings in schema default value
        palette: [],
        preferredFormat: "hex3",
        showSelectionPalette: true,
        maxSelectionSize: 24,
        localStorageKey: "adapt-authoring.spectrum.colourpicker",
        show: function(colour) {
          Origin.contentPane.disableScroll();
        },
        hide: function(colour) {
          Origin.contentPane.enableScroll();
        }
      }

      if(this.schema && this.schema.extra && this.schema.extra.palette) {
        options.palette = this.schema.extra.palette;
        options.localStorageKey = null;
        options.showPaletteOnly = true;
        options.showSelectionPalette = false;
        options.togglePaletteOnly = true
      }

      this.$el.spectrum(options);
      // remove class beacuse we aren't using the clear button
      $('.sp-container').removeClass('sp-clear-enabled');
    },

    getValue: function() {
      var colour = this.$el.spectrum('get');
      if (!colour) return '';

      return (colour.getAlpha() < 1) ? colour.toRgbString() : colour.toHexString();
    },

    setValue: function(value) {
      this.$el.spectrum('set', value);
    },

    focus: function() {
      if (!this.hasFocus) {
        this.$el.focus();
      }
    },

    blur: function() {
      if (this.hasFocus) {
        this.$el.blur();
      }
    },

    remove: function() {
      this.$el.spectrum('destroy');
      Backbone.Form.editors.Text.prototype.remove.call(this);
    }

  });

  Origin.on('origin:dataReady', function() {
    Origin.scaffold.addCustomField('ColourPicker', ScaffoldColourPickerView);
  });

  return ScaffoldColourPickerView;
});
