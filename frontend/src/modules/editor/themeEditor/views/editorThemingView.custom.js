// Custom extension for editorThemingView.js
// This file extends the existing ThemingView without modifying the original
// 
// Custom Features:
// 1. Font Preview - Shows selected font in the dropdown itself
// 2. WCAG Accessibility - Shows contrast ratio compliance for color pickers
// 3. Enhanced Color Preview - Adds support for dual field names, link field, navigation header
// 4. High Contrast Mode - Toggle button to preview theme in high contrast mode
// 
// All custom code is consolidated here to minimize conflicts with community updates
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
      
      // ========================================
      // WCAG Accessibility Contrast Checking
      // ========================================
      
      // WCAG Contrast Ratio Calculation
      getRelativeLuminance: function(rgb) {
        // Convert RGB to sRGB
        var rsRGB = rgb.r / 255;
        var gsRGB = rgb.g / 255;
        var bsRGB = rgb.b / 255;
        
        // Apply gamma correction
        var r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
        var g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
        var b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
        
        // Calculate luminance
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      },
      
      calculateContrastRatio: function(color1, color2) {
        var rgb1 = this.hexToRgb(color1);
        var rgb2 = this.hexToRgb(color2);
        
        if (!rgb1 || !rgb2) return null;
        
        var lum1 = this.getRelativeLuminance(rgb1);
        var lum2 = this.getRelativeLuminance(rgb2);
        
        var lighter = Math.max(lum1, lum2);
        var darker = Math.min(lum1, lum2);
        
        return (lighter + 0.05) / (darker + 0.05);
      },
      
      // Update accessibility display for a color field
      updateAccessibilityDisplay: function(fieldName, color) {
        var self = this;
        
        // Skip if color is not valid
        if (!color || color === '') return;
        
        // Normalize color (add # if missing)
        if (color && color.indexOf('#') !== 0) {
          color = '#' + color;
        }
        
        // Get background colors to test against
        var backgrounds = {
          'Page Background': this.$('input[name="page-bg-color"]').val() || this.$('input[name="page"]').val(),
          'Article Background': this.$('input[name="article-bg-color"]').val() || this.$('input[name="article"]').val(),
          'Block Background': this.$('input[name="block-bg-color"]').val() || this.$('input[name="block"]').val(),
          'Component Background': this.$('input[name="component-bg-color"]').val() || this.$('input[name="component"]').val()
        };
        
        // Normalize background colors
        for (var bgName in backgrounds) {
          var bgColor = backgrounds[bgName];
          if (bgColor && bgColor.indexOf('#') !== 0) {
            backgrounds[bgName] = '#' + bgColor;
          }
        }
        
        // Find the field container
        var $field = this.$('input[name="' + fieldName + '"]').closest('.field');
        if (!$field.length) {
          $field = this.$('.field-' + fieldName);
        }
        if (!$field.length) {
          $field = this.$('[data-editor-id]').has('input[name="' + fieldName + '"]').first();
        }
        
        if (!$field.length) return;
        
        // Remove existing accessibility display
        $field.find('.accessibility-results').remove();
        
        // Create results HTML
        var resultsHtml = '<div class="accessibility-results">';
        var hasAnyBackground = false;
        
        for (var bgName in backgrounds) {
          var bgColor = backgrounds[bgName];
          if (!bgColor || bgColor === '') continue;
          
          hasAnyBackground = true;
          var ratio = self.calculateContrastRatio(color, bgColor);
          
          if (ratio !== null) {
            var passes = ratio >= 4.5;
            var statusClass = passes ? 'pass' : 'fail';
            var statusIcon = passes ? '✓' : '✗';
            
            resultsHtml += '<div class="contrast-test ' + statusClass + '">';
            resultsHtml += '<span class="test-label">' + bgName + ':</span> ';
            resultsHtml += '<span class="contrast-ratio">' + ratio.toFixed(2) + ':1</span> ';
            resultsHtml += '<span class="status-badge">(AA ' + statusIcon + ')</span>';
            resultsHtml += '</div>';
          }
        }
        
        resultsHtml += '</div>';
        
        if (hasAnyBackground) {
          $field.append(resultsHtml);
        }
      },
      
      // Update all accessibility displays
      updateAllAccessibilityDisplays: function() {
        var self = this;
        
        this.$('input[data-type="ColourPicker"]').each(function() {
          var $input = $(this);
          var fieldName = $input.attr('name');
          var colorValue = $input.val();
          
          if (colorValue) {
            self.updateAccessibilityDisplay(fieldName, colorValue);
          }
        });
      },
      
      // Enhanced color change handler with accessibility
      handleColorChangeWithAccessibility: function(fieldName, colorValue, colorMap) {
        var self = this;
        
        // Check if this field affects the preview
        if (colorMap[fieldName]) {
          if (colorMap[fieldName].indexOf('CASCADE') > -1) {
            self.applyCascadeColors(fieldName, colorValue);
          } else {
            self.updatePreviewColor(colorMap[fieldName], colorValue, fieldName);
          }
        }
        
        // Update accessibility display
        self.updateAccessibilityDisplay(fieldName, colorValue);
        
        // If background color changed, update all displays
        if (fieldName === 'page' || fieldName === 'article' || fieldName === 'block' || fieldName === 'component' ||
            fieldName === 'page-bg-color' || fieldName === 'article-bg-color' || 
            fieldName === 'block-bg-color' || fieldName === 'component-bg-color') {
          self.updateAllAccessibilityDisplays();
        }
      },
      
      // Initialize accessibility checking
      initializeAccessibilityChecking: function(colorMap) {
        var self = this;
        
        // Document-level event delegation
        $(document).on('input.themeAccessibility change.themeAccessibility keyup.themeAccessibility', 'input[type="text"]', function(e) {
          var $input = $(this);
          if (!self.$el.find($input).length) return;
          
          var fieldName = $input.attr('name');
          var colorValue = $input.val();
          
          if (fieldName && colorValue) {
            self.handleColorChangeWithAccessibility(fieldName, colorValue, colorMap);
          }
        });

        // Spectrum events
        $(document).on('move.spectrum.themeAccessibility', function(e, color) {
          var $input = $(e.target);
          if (!self.$el.find($input).length) return;
          
          var fieldName = $input.attr('name');
          var colorValue = color ? color.toHexString() : $input.val();
          
          if (fieldName && colorValue) {
            self.handleColorChangeWithAccessibility(fieldName, colorValue, colorMap);
          }
        });
        
        // Initial display after delay
        setTimeout(function() {
          self.updateAllAccessibilityDisplays();
        }, 1000);
      },
      
      // ========================================
      // CUSTOM COLOR PREVIEW ENHANCEMENTS
      // ========================================
      
      // Override: Extend colorMap with dual field names and custom fields
      getCustomColorMap: function() {
        return {
          'page-bg-color': '.preview-page',
          'page': '.preview-page',
          'article-bg-color': '.preview-article',
          'article': '.preview-article',
          'block-bg-color': '.preview-block',
          'block': '.preview-block',
          'component-bg-color': '.preview-component',
          'component': '.preview-component',
          'btn-color': '.preview-btn-primary',
          'btn-color-inverted': '.preview-btn-primary',
          'item-color': '.preview-btn-secondary',
          // Text color properties
          'font-color': '.preview-component-body-text',
          'heading-color': 'HEADING_CASCADE',
          'instruction-color': '.preview-instruction',
          'link': '.preview-link a',
          // Navigation colors
          'nav': 'NAV_CASCADE',
          'nav-inverted': 'NAV_INVERTED_CASCADE',
          // Brand color cascades
          '_primaryBrandColor': 'PRIMARY_CASCADE',
          '_secondaryBrandColor': 'SECONDARY_CASCADE',
          '_accentBrandColor': 'ACCENT_CASCADE'
        };
      },
      
      // Override: Enhanced applyCascadeColors with navigation header support
      applyCascadeColorsCustom: function(fieldName, color) {
        // Call parent method first if it exists
        if (ThemingView.prototype.applyCascadeColors) {
          ThemingView.prototype.applyCascadeColors.call(this, fieldName, color);
        }
        
        // Add custom navigation background to page header
        if (fieldName === 'nav') {
          this.$('.preview-page-header').css('background-color', color);
        }
      },
      
      // ========================================
      // HIGH CONTRAST MODE TOGGLE
      // ========================================
      
      // Toggle high contrast mode for preview
      toggleHighContrast: function(e) {
        e.preventDefault();
        var $btn = $(e.currentTarget);
        var $preview = this.$('.theme-color-preview');
        var isActive = $btn.attr('data-contrast-active') === 'true';
        
        if (isActive) {
          // Turn off high contrast
          $preview.removeClass('high-contrast-mode');
          $btn.attr('data-contrast-active', 'false');
          $btn.find('i').removeClass('fa-sun-o').addClass('fa-moon-o');
          $btn.attr('title', 'Toggle High Contrast Mode');
        } else {
          // Turn on high contrast
          $preview.addClass('high-contrast-mode');
          $btn.attr('data-contrast-active', 'true');
          $btn.find('i').removeClass('fa-moon-o').addClass('fa-sun-o');
          $btn.attr('title', 'Disable High Contrast Mode');
        }
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
      updateLinkedProperty: function(propertyPath, newValue, visitedFields) {
        if (!propertyPath || newValue === undefined) {
          return;
        }

        // Initialize visitedFields set to prevent circular references
        if (!visitedFields) {
          visitedFields = new Set();
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

        // Check if we've already visited this field to prevent infinite loops
        if (visitedFields.has(targetFieldName)) {
          return;
        }
        
        // Mark this field as visited
        visitedFields.add(targetFieldName);
        
        // Try exact match first
        var $targetField = this.$('input[name="' + targetFieldName + '"], select[name="' + targetFieldName + '"]');
        
        if ($targetField.length > 0) {
          var self = this;
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

          // RECURSIVE PROPAGATION: Check if this linked field also has linkedProperties
          var targetFieldSchema = this.getFieldSchema(targetFieldName);
          if (targetFieldSchema && targetFieldSchema.linkedProperties && targetFieldSchema.linkedProperties.length > 0) {
            // Recursively update the grandchildren properties
            for (var i = 0; i < targetFieldSchema.linkedProperties.length; i++) {
              this.updateLinkedProperty(targetFieldSchema.linkedProperties[i], newValue, visitedFields);
            }
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