// Custom extension for editorThemingView.js to add font preview functionality
// This file extends the existing ThemingView without modifying the original
define(function(require) {
  var Backbone = require('backbone');
  var Origin = require('core/origin');
  
  // Wait for the original ThemingView to be loaded, then extend it
  return function(ThemingView) {
    
    // Store original methods we'll override
    var originalPostRender = ThemingView.prototype.postRender;
    var originalRenderForm = ThemingView.prototype.renderForm;
    var originalRestoreFormSettings = ThemingView.prototype.restoreFormSettings;
    var originalOnFieldChanged = ThemingView.prototype.onFieldChanged;
    var originalInitialize = ThemingView.prototype.initialize;
    
    // Extend the existing ThemingView
    return ThemingView.extend({
      
      // Override initialize to add linkedProperties event listener
      initialize: function() {
        // Call original method first
        var result = originalInitialize.apply(this, arguments);
        
        // Add linkedProperties event listener
        this.listenTo(Origin, 'scaffold:linkedPropertyChanged', this.onLinkedPropertyChanged);
        
        return result;
      },
      
      // Override postRender to add font preview setup
      postRender: function() {
        // Call original method first
        var result = originalPostRender.apply(this, arguments);
        
        // Add our custom font preview functionality
        this.setupFontPreview();
        
        return result;
      },
      
      // Override renderForm to ensure font preview is applied after form rendering
      renderForm: function() {
        // Call original method first
        var result = originalRenderForm.apply(this, arguments);
        
        // Apply font preview after form is rendered
        var self = this;
        _.defer(function() {
          self.applyFontPreviewToSelects();
        });
        
        return result;
      },
      
      // Override restoreFormSettings to apply font preview after restoration
      restoreFormSettings: function(toRestore) {
        // Call original method first
        var result = originalRestoreFormSettings.apply(this, arguments);
        
        // Apply font preview after restoration
        var self = this;
        _.defer(function() {
          self.applyFontPreviewToSelects();
        });
        
        return result;
      },
      
      // Override onFieldChanged to update font preview when fonts change and handle linkedProperties
      onFieldChanged: function(event) {
        // Call original method first
        var result = originalOnFieldChanged.apply(this, arguments);
        
        // Update font preview for any changed font selects
        this.updateFontPreviewOnChange();
        
        // Handle linkedProperties if this field has them
        if (event && event.target) {
          var $target = $(event.target);
          var fieldName = $target.attr('name');
          
          if (fieldName && this.form) {
            this.handleLinkedPropertiesUpdate($target, fieldName);
          }
        }
        
        return result;
      },
      
      // NEW: Setup font preview functionality
      setupFontPreview: function() {
        var self = this;
        
        // Listen for changes to font family selects
        this.$el.on('change', 'select[name*="font-family"], select[name*="font"]', function() {
          self.updateSelectFontPreview($(this));
        });
        
        // Apply initial font preview
        this.applyFontPreviewToSelects();
      },
      
      // NEW: Apply font preview to all font-related selects
      applyFontPreviewToSelects: function() {
        var self = this;
        
        // Find all font-related selects
        this.$('select[name*="font-family"], select[name*="font"]').each(function() {
          self.updateSelectFontPreview($(this));
        });
      },
      
      // NEW: Update font preview for a specific select element
      updateSelectFontPreview: function($select) {
        var selectedValue = $select.val();
        
        if (!selectedValue) return;
        
        // Remove any existing font classes
        $select.removeClass(function(index, className) {
          return (className.match(/\\bfont-\\S+/g) || []).join(' ');
        });
        
        // Apply the appropriate font class based on selected value
        var fontClass = this.getFontClassForValue(selectedValue);
        if (fontClass) {
          $select.addClass(fontClass);
        }
        
        // Also apply inline style as fallback
        var fontFamily = this.getFontFamilyForValue(selectedValue);
        if (fontFamily) {
          $select.css('font-family', fontFamily);
        }
      },
      
      // NEW: Get CSS class name for a font value
      getFontClassForValue: function(value) {
        var fontClassMap = {
          'Lato': 'font-lato',
          'Georgia': 'font-georgia', 
          'Helvetica Neue': 'font-helvetica-neue',
          'Inter': 'font-inter',
          'Merriweather': 'font-merriweather',
          'Montserrat': 'font-montserrat',
          'Open Sans': 'font-open-sans',
          'Poppins': 'font-poppins',
          'Roboto': 'font-roboto',
          'Source Sans Pro': 'font-source-sans-pro'
        };
        
        return fontClassMap[value] || null;
      },
      
      // NEW: Get font-family CSS value for a font value
      getFontFamilyForValue: function(value) {
        var fontFamilyMap = {
          'Lato': "'Lato', sans-serif",
          'Georgia': "'Georgia', serif",
          'Helvetica Neue': "'Helvetica Neue', sans-serif", 
          'Inter': "'Inter', sans-serif",
          'Merriweather': "'Merriweather', serif",
          'Montserrat': "'Montserrat', sans-serif",
          'Open Sans': "'Open Sans', sans-serif",
          'Poppins': "'Poppins', sans-serif",
          'Roboto': "'Roboto', sans-serif",
          'Source Sans Pro': "'Source Sans Pro', sans-serif"
        };
        
        return fontFamilyMap[value] || null;
      },
      
      // NEW: Update font preview when fields change
      updateFontPreviewOnChange: function() {
        var self = this;
        
        // Delay to ensure DOM has updated
        _.defer(function() {
          self.applyFontPreviewToSelects();
        });
      },

      // LinkedProperties: Handle linkedProperties changes from scaffold fields (like ColourPicker)
      onLinkedPropertyChanged: function(data) {
        if (!data || !data.linkedProperties || !this.form) {
          return;
        }

        var newValue = data.newValue;
        var linkedProperties = data.linkedProperties;
        
        // Update each linked property
        for (var i = 0; i < linkedProperties.length; i++) {
          this.updateLinkedProperty(linkedProperties[i], newValue);
        }
      },

      // LinkedProperties: Update a specific linked property with new value
      updateLinkedProperty: function(propertyPath, newValue) {
        if (!propertyPath || newValue === undefined) {
          return;
        }

        // Handle nested property paths like "_nav.nav-progress"
        var targetFieldName;
        if (propertyPath.includes('.')) {
          // For nested paths like "_nav.nav-progress", extract the field name
          var pathParts = propertyPath.split('.');
          targetFieldName = pathParts[pathParts.length - 1]; // Get "nav-progress" from "_nav.nav-progress"
        } else {
          targetFieldName = propertyPath;
        }
        
        // Try exact match first
        var $targetField = this.$('input[name="' + targetFieldName + '"], select[name="' + targetFieldName + '"]');
        
        if ($targetField.length > 0) {
          $targetField.each(function(index, element) {
            var $elem = $(element);

            // Check if it's a spectrum color picker
            if ($elem.hasClass('scaffold-colour-picker') && $elem.spectrum) {
              $elem.spectrum('set', newValue);
            } else {
              // For regular inputs/selects
              $elem.val(newValue).trigger('change');
            }
          });
          
          // Also update the form model if available
          if (this.form && this.form.model) {
            this.form.model.set(targetFieldName, newValue);
          }
        }
      },

      // LinkedProperties: Handle linkedProperties for regular form field changes (not from scaffold events)
      handleLinkedPropertiesUpdate: function($target, fieldName) {
        // Get field schema to check for linkedProperties
        var fieldSchema = this.getFieldSchema(fieldName);
        
        if (fieldSchema && fieldSchema.linkedProperties && fieldSchema.linkedProperties.length > 0) {
          var newValue = $target.val();
          
          // Update each linked property
          for (var i = 0; i < fieldSchema.linkedProperties.length; i++) {
            this.updateLinkedProperty(fieldSchema.linkedProperties[i], newValue);
          }
        }
      },

      // LinkedProperties: Get schema definition for a specific field
      getFieldSchema: function(fieldName) {
        if (!this.form || !this.form.schema) {
          return null;
        }
        
        return this.form.schema[fieldName] || null;
      }
      
    });
  };
});