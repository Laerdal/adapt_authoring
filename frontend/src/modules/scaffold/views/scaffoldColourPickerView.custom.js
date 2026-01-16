// Custom extension for scaffoldColourPickerView.js to add linkedProperties functionality
// This file extends the existing ColourPickerView without modifying the original
define([
  'core/origin',
  './scaffoldColourPickerView'
], function(Origin, ScaffoldColourPickerView) {

  // Create extended version with linkedProperties support
  var ScaffoldColourPickerViewExtended = ScaffoldColourPickerView.extend({

    events: _.extend({}, ScaffoldColourPickerView.prototype.events, {
      'change': function() { 
        this.trigger('change', this);
        this.handleLinkedPropertiesChange();
      }
    }),

    postRender: function() {
      // Call parent postRender
      ScaffoldColourPickerView.prototype.postRender.apply(this, arguments);

      // Override spectrum options to add linkedProperties change handler
      var self = this;
      this.$el.spectrum('destroy');
      
      const options = {
        color: this.value,
        showAlpha: true,
        showInitial: true,
        showInput: true,
        showPalette: true,
        showButtons: true,
        cancelText: Origin.l10n.t('app.scaffold.colourPickerCancel'),
        allowEmpty: true,
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
        },
        change: function(color) {
          self.handleLinkedPropertiesChange();
        }
      };

      if(this.schema && this.schema.extra && this.schema.extra.palette) {
        options.palette = this.schema.extra.palette;
        options.localStorageKey = null;
        options.showPaletteOnly = true;
        options.showSelectionPalette = false;
        options.togglePaletteOnly = true;
      }

      this.$el.spectrum(options);
      $('.sp-container').removeClass('sp-clear-enabled');
    },

    setValue: function(value) {
      // Call parent setValue
      ScaffoldColourPickerView.prototype.setValue.apply(this, arguments);
      // Also trigger linkedProperties change when value is set programmatically
      this.handleLinkedPropertiesChange();
    },

    // LinkedProperties: Handle changes and trigger updates
    handleLinkedPropertiesChange: function() {
      // Check if this field has linkedProperties defined
      if (this.schema && this.schema.linkedProperties && this.schema.linkedProperties.length > 0) {
        var fieldName = this.key;
        var newValue = this.getValue();
        var linkedProperties = this.schema.linkedProperties;
        
        // Trigger event for theme editor to handle linked property updates
        Origin.trigger('scaffold:linkedPropertyChanged', {
          sourceField: fieldName,
          newValue: newValue,
          linkedProperties: linkedProperties
        });
      }
    }

  });

  // Re-register the extended version as ColourPicker
  Origin.on('origin:dataReady', function() {
    Origin.scaffold.addCustomField('ColourPicker', ScaffoldColourPickerViewExtended, true);
  });

  return ScaffoldColourPickerViewExtended;
});
