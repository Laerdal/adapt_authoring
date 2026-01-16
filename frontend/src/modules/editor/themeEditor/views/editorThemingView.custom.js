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
    
    // Extend the existing ThemingView
    return ThemingView.extend({
      
      // Add events for color picker handling
      events: function() {
        // Get original events
        var originalEvents = ThemingView.prototype.events || {};
        
        // Add our custom events
        return _.extend({}, originalEvents, {
          'change .form-container input[data-type="ColourPicker"]': 'onColorPickerChanged',
          'change .form-container .scaffold-colour-picker': 'onColorPickerChanged'
        });
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
      
      // Override onFieldChanged to update font preview when fonts change and handle linked properties
      onFieldChanged: function(e) {
        // Call original method first
        var result = originalOnFieldChanged.apply(this, arguments);
        
        // Update font preview for any changed font selects
        this.updateFontPreviewOnChange();
        
        // Handle linked properties
        if (e && e.target) {
          this.handleLinkedProperties(e.target);
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
      
      // NEW: Handle color picker changes specifically for linked properties
      onColorPickerChanged: function(e) {
        // Handle linked properties for color pickers specifically
        if (e && e.target) {
          this.handleLinkedProperties(e.target);
        }
      },
      
      /**
       * Handle linked properties feature - automatically update linked fields when a field with 
       * linkedProperties is changed. This is a one-way relationship (parent -> children only).
       * 
       * To use this feature, add a 'linkedProperties' array to your schema property definition:
       * 
       * "_primaryBrandColor": {
       *   "linkedProperties": [
       *     "_nav.nav-progress",
       *     "anotherProperty"
       *   ]
       * }
       * 
       * When _primaryBrandColor changes, it will automatically update _nav.nav-progress and anotherProperty.
       * Users can still manually override the linked properties without affecting the parent.
       */
      handleLinkedProperties: function(changedElement) {
        // Prevent infinite loops when updating linked properties
        if ($(changedElement).data('updating-linked-property')) {
          return;
        }
        
        if (!this.form || !this.form.model || !this.form.model.schema) {
          return;
        }
        
        var fieldName = changedElement.name || $(changedElement).attr('name');
        var fieldSchema = this.form.model.schema[fieldName];
        
        if (!fieldSchema) {
          return;
        }
        
        // Check for linkedProperties in both extra and top-level
        var linkedProperties = fieldSchema.linkedProperties || 
                              (fieldSchema.extra && fieldSchema.extra.linkedProperties);
        
        if (!linkedProperties || linkedProperties.length === 0) {
          return;
        }
        
        var changedValue = this.getFieldValue(changedElement);
        
        // Update each linked property
        for (var i = 0; i < linkedProperties.length; i++) {
          this.updateLinkedProperty(linkedProperties[i], changedValue);
        }
      },
      
      getFieldValue: function(element) {
        var $element = $(element);
        
        // Handle different input types
        if (element.type === 'checkbox') {
          return element.checked;
        } else if ($element.hasClass('scaffold-colour-picker') || $element.attr('data-type') === 'ColourPicker') {
          // For color picker, get the actual color value
          return $element.val();
        } else {
          return $element.val();
        }
      },
      
      updateLinkedProperty: function(propertyPath, value) {
        var $linkedField = this.findLinkedField(propertyPath);
        
        if ($linkedField.length === 0) {
          return;
        }
        
        // Update the field value
        if ($linkedField.hasClass('scaffold-colour-picker') || $linkedField.attr('data-type') === 'ColourPicker') {
          // For color picker fields, use spectrum API
          if ($linkedField.spectrum) {
            $linkedField.spectrum('set', value);
          } else {
            $linkedField.val(value);
          }
        } else if ($linkedField.attr('type') === 'checkbox') {
          $linkedField.prop('checked', value);
        } else {
          $linkedField.val(value);
        }
        
        // Trigger change event to ensure proper form handling (but avoid infinite loops)
        if (!$linkedField.data('updating-linked-property')) {
          $linkedField.data('updating-linked-property', true);
          $linkedField.trigger('change');
          setTimeout(function() {
            $linkedField.removeData('updating-linked-property');
          }, 100);
        }
      },
      
      findLinkedField: function(propertyPath) {
        // Handle dot notation like "_nav.nav-progress"
        var pathParts = propertyPath.split('.');
        var $field;
        
        if (pathParts.length === 1) {
          // Simple field name - try multiple selectors
          var simpleFieldName = pathParts[0];
          $field = this.$('.form-container [name="' + simpleFieldName + '"]');
          
          if ($field.length === 0) {
            // Try with data-name attribute
            $field = this.$('.form-container [data-name="' + simpleFieldName + '"]');
          }
        } else {
          // Nested property - handle cases like "_nav.nav-progress" 
          var parentField = pathParts[0];
          var childField = pathParts[1];
          
          // Try multiple approaches to find the nested field
          // 1. Direct child field name
          $field = this.$('.form-container [name="' + childField + '"]');
          
          // 2. If not found, try within the parent fieldset/section
          if ($field.length === 0) {
            // Look for accordion with matching data-group
            var $parentSection = this.$('.accordion-item[data-group="' + parentField + '"]');
            
            if ($parentSection.length > 0) {
              $field = $parentSection.find('[name="' + childField + '"]');
            }
          }
          
          // 3. Try full path as field name
          if ($field.length === 0) {
            $field = this.$('.form-container [name="' + propertyPath + '"]');
          }
          
          // 4. Try without the leading underscore in child field
          if ($field.length === 0 && childField.startsWith('_')) {
            var childWithoutUnderscore = childField.substring(1);
            $field = this.$('.form-container [name="' + childWithoutUnderscore + '"]');
          }
          
          // 5. Try looking by partial class name or data attributes
          if ($field.length === 0) {
            $field = this.$('.form-container input').filter(function() {
              var name = $(this).attr('name') || '';
              return name.indexOf(childField) > -1;
            });
          }
        }
        
        return $field;
      }
      
    });
  };
});