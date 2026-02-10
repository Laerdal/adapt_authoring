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
          // Toggle reset button visibility based on whether value equals default
          self.updateDefaultValueClass();
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
      
      // Set initial is-default-value class state
      this.updateDefaultValueClass();
    },
    
    updateDefaultValueClass: function() {
      // Toggle the is-default-value class based on whether current value equals default
      if (this.defaultValue !== undefined) {
        var currentValue = this.getValue();
        var defaultValue = this.defaultValue;
        
        // Normalize both values for comparison (trim spaces, lowercase, handle transparent)
        var normalizedCurrent = this.normalizeColorValue(currentValue);
        var normalizedDefault = this.normalizeColorValue(defaultValue);
        
        var isDefaultValue = normalizedCurrent === normalizedDefault;
        this.$el.closest('.field').toggleClass('is-default-value', isDefaultValue);
      }
    },
    
    normalizeColorValue: function(value) {
      // Normalize color values for consistent comparison
      if (!value) return '';
      
      // Convert to string and trim whitespace
      var normalized = String(value).trim().toLowerCase();
      
      // Handle empty/transparent values
      if (normalized === '' || normalized === 'transparent' || normalized === 'rgba(0, 0, 0, 0)') {
        return '';
      }
      
      // Remove all whitespace from color values
      normalized = normalized.replace(/\s+/g, '');
      
      return normalized;
    },

    setValue: function(value) {
      // Call parent setValue
      ScaffoldColourPickerView.prototype.setValue.apply(this, arguments);
      
      // Update is-default-value class after programmatic value change
      this.updateDefaultValueClass();
      
      // Manually trigger preview update by directly calling the Origin event
      // This bypasses the spectrum event which has the wrong cached color
      var fieldName = this.key;
      var colorValue = this.getValue() || '';
      Origin.trigger('editor:colorChanged', {
        fieldName: fieldName,
        colorValue: colorValue
      });
      
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
