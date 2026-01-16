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
      
      // Override onFieldChanged to update font preview when fonts change
      onFieldChanged: function() {
        // Call original method first
        var result = originalOnFieldChanged.apply(this, arguments);
        
        // Update font preview for any changed font selects
        this.updateFontPreviewOnChange();
        
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
      }
      
    });
  };
});