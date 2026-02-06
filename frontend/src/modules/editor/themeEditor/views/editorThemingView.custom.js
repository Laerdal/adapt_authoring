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
        if (!color || color === '') {
          return;
        }
        
        // Normalize color (add # if missing)
        if (color && color.indexOf('#') !== 0) {
          color = '#' + color;
        }
        
        // Determine if this is a background or font color field, and get relevant test pairs
        var testsToRun = this.getAccessibilityTestPairs(fieldName, color);
        
        if (testsToRun.length === 0) {
          return;
        }
        
        // Find the field container
        var $field = this.$('input[name="' + fieldName + '"]').closest('.field');
        if (!$field.length) {
          $field = this.$('.field-' + fieldName);
        }
        if (!$field.length) {
          $field = this.$('[data-editor-id]').has('input[name="' + fieldName + '"]').first();
        }
        
        if (!$field.length) {
          return;
        }
        
        // Remove existing accessibility display
        $field.find('.accessibility-results').remove();
        
        // Create results HTML
        var resultsHtml = '<div class="accessibility-results">';
        var hasAnyTest = false;
        
        for (var i = 0; i < testsToRun.length; i++) {
          var test = testsToRun[i];
          if (!test.color1 || !test.color2 || test.color1 === '' || test.color2 === '') continue;
          
          hasAnyTest = true;
          var ratio = self.calculateContrastRatio(test.color1, test.color2);
          
          if (ratio !== null) {
            var passes = ratio >= 4.5;
            var statusClass = passes ? 'pass' : 'fail';
            var statusIcon = passes ? '✓' : '✗';
            
            resultsHtml += '<div class="contrast-test ' + statusClass + '">';
            resultsHtml += '<span class="test-label">' + test.label + ':</span> ';
            resultsHtml += '<span class="contrast-ratio">' + ratio.toFixed(2) + ':1</span> ';
            resultsHtml += '<span class="status-badge">(AA ' + statusIcon + ')</span>';
            resultsHtml += '</div>';
          }
        }
        
        resultsHtml += '</div>';
        
        if (hasAnyTest) {
          // Remove any existing results for this field
          $field.find('.accessibility-results').remove();
          
          // Append to field (will use fixed positioning via JS)
          $field.append(resultsHtml);
          var $results = $field.find('.accessibility-results');
          
          // Add fixed positioning class and setup positioning
          $results.addClass('accessibility-results--portal');
          this.setupPortalPositioning($results, $field);
        }
      },
      
      // Setup portal-style positioning (stays within field DOM but uses fixed positioning)
      setupPortalPositioning: function($results, $field) {
        if (!$results.length) return;
        
        var updatePosition = function() {
          
          // Find the best element to position near - look for visible color swatch/button
          var $target = null;
          
          // Try different selectors in order of preference
          var selectors = [
            'button.btn-color', // Color picker button
            '.input-group-addon', // Bootstrap addon
            'span[style*="background"]', // Inline styled color swatch
            '.color-preview', // Custom color preview
            'input[type="text"]', // Text input
            'input' // Any input
          ];
          
          for (var i = 0; i < selectors.length; i++) {
            $target = $field.find(selectors[i]).first();
            if ($target.length && $target[0].getBoundingClientRect().width > 0) {
              break;
            }
          }
          
          // Last resort: use the field label or field itself
          if (!$target || !$target.length || $target[0].getBoundingClientRect().width === 0) {
            $target = $field.find('label').first();
            if (!$target.length) {
              $target = $field;
            }
          }
          
          var targetRect = $target[0].getBoundingClientRect();
          var viewportHeight = window.innerHeight;
          var viewportWidth = window.innerWidth;
          
          // Get results dimensions
          var resultsHeight = $results.outerHeight();
          var resultsWidth = Math.min(Math.max(targetRect.width, 280), 340);
          
          // Calculate position - always position below with significant offset to avoid blocking picker
          var topPos = targetRect.bottom + 50; // 50px gap below to ensure no overlap
          var leftPos = targetRect.left;
          
          // Check if fits below
          if (topPos + resultsHeight > viewportHeight - 10) {
            // Doesn't fit below, try above with significant offset
            var topAbove = targetRect.top - resultsHeight - 50;
            if (topAbove > 10) {
              topPos = topAbove;
            } else {
              // Try to the right if neither above nor below fits
              topPos = targetRect.top;
              leftPos = targetRect.right + 50;
              
              // If doesn't fit right either, force position below anyway (best option)
              if (leftPos + resultsWidth > viewportWidth - 10) {
                topPos = targetRect.bottom + 50;
                leftPos = targetRect.left;
                
                // Allow scrolling if needed rather than overlap
                if (topPos + resultsHeight > viewportHeight) {
                  topPos = Math.max(targetRect.bottom + 50, 10);
                }
              }
            }
          }
          
          // Final adjustment for horizontal overflow
          if (leftPos + resultsWidth > viewportWidth - 10) {
            leftPos = Math.max(10, viewportWidth - resultsWidth - 10);
          }
          
          // Apply fixed positioning
          $results.css({
            position: 'fixed',
            left: leftPos + 'px',
            top: topPos + 'px',
            width: resultsWidth + 'px',
            zIndex: 999999
          });
        };
        
        // Update position on field hover
        $field.on('mouseenter.accessibility', updatePosition);
        
        // Hide results when color picker is clicked/opened
        $field.on('click.accessibility', 'input, button, .input-group-addon', function() {
          $results.css({
            opacity: 0,
            visibility: 'hidden',
            pointerEvents: 'none'
          });
        });
        
        // Hide when spectrum color picker opens
        $field.find('input').on('show.spectrum', function() {
          $results.css({
            opacity: 0,
            visibility: 'hidden',
            pointerEvents: 'none'
          });
        });
        
        // Show again when spectrum closes (optional - remove if you don't want this)
        $field.find('input').on('hide.spectrum', function() {
          // Results will show again on next hover due to CSS
        });
        
        // Also update on scroll/resize
        $(window).on('scroll.accessibility resize.accessibility', updatePosition);
        
        // Initial position
        updatePosition();
      },
      
      // Get relevant accessibility test pairs based on field type
      getAccessibilityTestPairs: function(fieldName, color) {
        var self = this;
        var tests = [];
        
        // Normalize color
        var normalizedColor = color;
        if (normalizedColor && normalizedColor.indexOf('#') !== 0) {
          normalizedColor = '#' + normalizedColor;
        }
        
        // Helper to get and normalize a color value
        var getColor = function(name) {
          var val = self.$('input[name="' + name + '"]').val();
          if (!val) return null;
          return val.indexOf('#') === 0 ? val : '#' + val;
        };
        
        // Helper to capitalize section name for labels
        var capitalize = function(str) {
          return str.charAt(0).toUpperCase() + str.slice(1);
        };
        
        // Special case mappings for specific fields
        var specialCases = {
          // Navigation
          'nav': function() {
            var navForeground = getColor('nav-foreground') || getColor('nav-font-color');
            if (navForeground) {
              tests.push({ label: 'Navigation Background vs Foreground', color1: normalizedColor, color2: navForeground });
            }
          },
          'nav-progress': function() {
            var pageBg = getColor('page-bg-color') || getColor('page');
            if (pageBg) {
              tests.push({ label: 'Navigation Progress vs Page Background', color1: normalizedColor, color2: pageBg });
            }
          },
          
          // Menu
          'menu-header-background-color': function() {
            var menuForeground = getColor('menu-foreground') || getColor('menu-font-color');
            if (menuForeground) {
              tests.push({ label: 'Menu Header Background vs Foreground', color1: normalizedColor, color2: menuForeground });
            }
          },
          'menu-item': function() {
            // Test against menu-specific foreground
            var menuForeground = getColor('menu-foreground') || getColor('menu-font-color');
            if (menuForeground) {
              tests.push({ label: 'Menu Item vs Menu Foreground', color1: normalizedColor, color2: menuForeground });
            }
            
            // Test against global font color
            var fontColor = getColor('font-color');
            if (fontColor) {
              tests.push({ label: 'Menu Item vs Font Colour', color1: normalizedColor, color2: fontColor });
            }
            
            // Test against menu header background
            var menuHeaderBg = getColor('menu-header-background-color');
            if (menuHeaderBg) {
              tests.push({ label: 'Menu Item vs Menu Header Background', color1: normalizedColor, color2: menuHeaderBg });
            }
          },
          'menu-item-progress': function() {
            // Test against menu item background
            var menuItemBg = getColor('menu-item');
            if (menuItemBg) {
              tests.push({ label: 'Menu Item Progress vs Menu Item', color1: normalizedColor, color2: menuItemBg });
            }
            
            // Test against menu-specific foreground
            var menuForeground = getColor('menu-foreground') || getColor('menu-font-color');
            if (menuForeground) {
              tests.push({ label: 'Menu Item Progress vs Menu Foreground', color1: normalizedColor, color2: menuForeground });
            }
          },
          
          // Validation - TEMPORARILY DISABLED
          // 'validation-success': function() {
          //   var foreground = getColor('font-color');
          //   if (foreground) {
          //     tests.push({ label: 'Validation Success vs Foreground', color1: normalizedColor, color2: foreground });
          //   }
          // },
          // 'validation-error': function() {
          //   var foreground = getColor('font-color');
          //   if (foreground) {
          //     tests.push({ label: 'Validation Error vs Foreground', color1: normalizedColor, color2: foreground });
          //   }
          // },
          
          // Progress
          'progress-fill': function() {
            var componentBg = getColor('component-bg-color') || getColor('component');
            if (componentBg) {
              tests.push({ label: 'Progress Fill vs Component Background', color1: normalizedColor, color2: componentBg });
            }
          },
          'progress-background': function() {
            var componentBg = getColor('component-bg-color') || getColor('component');
            if (componentBg) {
              tests.push({ label: 'Progress Background vs Component Background', color1: normalizedColor, color2: componentBg });
            }
          },
          'progress-border': function() {
            var progressBg = getColor('progress-background');
            if (progressBg) {
              tests.push({ label: 'Progress Border vs Progress Background', color1: normalizedColor, color2: progressBg });
            }
          },
          
          // Notify
          'notify': function() {
            var notifyForeground = getColor('notify-foreground') || getColor('notify-font-color') || getColor('font-color');
            if (notifyForeground) {
              tests.push({ label: 'Notify Background vs Foreground', color1: normalizedColor, color2: notifyForeground });
            }
          },
          
          // Drawer
          'drawer': function() {
            var drawerForeground = getColor('drawer-foreground') || getColor('drawer-font-color') || getColor('font-color');
            if (drawerForeground) {
              tests.push({ label: 'Drawer Background vs Foreground', color1: normalizedColor, color2: drawerForeground });
            }
          }
        };
        
        // Check if this field has a special case handler
        if (specialCases[fieldName]) {
          specialCases[fieldName]();
          if (tests.length > 0) return tests; // Return early if special case handled it
        }
        
        // Detect if this is a background color field
        var isBackgroundField = fieldName.indexOf('-bg-color') > -1 || 
                               fieldName.indexOf('background') > -1 ||
                               ['page', 'article', 'block', 'component'].indexOf(fieldName) > -1;
        
        // Detect if this is a font/text color field
        var isFontField = fieldName.indexOf('-font-color') > -1 || 
                         fieldName.indexOf('font-color') > -1 ||
                         fieldName.indexOf('heading-color') > -1 ||
                         fieldName.indexOf('instruction-color') > -1 ||
                         fieldName.indexOf('link') > -1 ||
                         fieldName.indexOf('text') > -1;
        
        // Extract section name from field name (e.g., "nav-bg-color" -> "nav", "drawer-font-color" -> "drawer")
        var getSectionName = function(field) {
          // Handle special cases first
          if (field === 'page' || field === 'article' || field === 'block' || field === 'component') {
            return field;
          }
          
          // Extract section from pattern like "section-bg-color" or "section-font-color"
          var matches = field.match(/^([a-z]+)(?:-bg-color|-background|-font-color|-text|-heading-color)?$/);
          return matches ? matches[1] : null;
        };
        
        var currentSection = getSectionName(fieldName);
        
        // If this is a background color field
        if (isBackgroundField && currentSection) {
          // For main background fields (page, article, block, component), test against multiple text colors
          var isMainBackground = ['page', 'article', 'block', 'component'].indexOf(currentSection) > -1;
          
          if (isMainBackground) {
            // Test against body text color
            var fontColor = getColor('font-color');
            if (fontColor) {
              tests.push({ 
                label: 'Body Text on ' + capitalize(currentSection) + ' Background', 
                color1: normalizedColor, 
                color2: fontColor 
              });
            }
            
            // Test against heading color
            var headingColor = getColor('heading-color');
            if (headingColor) {
              tests.push({ 
                label: 'Heading Text on ' + capitalize(currentSection) + ' Background', 
                color1: normalizedColor, 
                color2: headingColor 
              });
            }
            
            // Test against instruction color
            var instructionColor = getColor('instruction-color');
            if (instructionColor) {
              tests.push({ 
                label: 'Instruction Text on ' + capitalize(currentSection) + ' Background', 
                color1: normalizedColor, 
                color2: instructionColor 
              });
            }
          } else {
            // For other section-specific backgrounds, just test against their font color
            var fontFields = [
              currentSection + '-font-color',
              currentSection + '-text',
              currentSection + '-heading-color',
              'font-color'  // fallback to global font color
            ];
            
            for (var i = 0; i < fontFields.length; i++) {
              var sectionFontColor = getColor(fontFields[i]);
              if (sectionFontColor) {
                var label = capitalize(currentSection) + ' Text on ' + capitalize(currentSection) + ' Background';
                tests.push({ label: label, color1: normalizedColor, color2: sectionFontColor });
                break; // Only use the first matching font color
              }
            }
          }
        }
        
        // If this is a font/text color field
        else if (isFontField) {
          // Special case for link color - check against page, article, block, and component backgrounds
          if (fieldName.indexOf('link') > -1) {
            // Test against page background
            var pageBg = getColor('page-bg-color') || getColor('page');
            if (pageBg) {
              tests.push({ 
                label: 'Link Text on Page Background', 
                color1: normalizedColor, 
                color2: pageBg 
              });
            }
            
            // Test against article background
            var articleBg = getColor('article-bg-color') || getColor('article');
            if (articleBg) {
              tests.push({ 
                label: 'Link Text on Article Background', 
                color1: normalizedColor, 
                color2: articleBg 
              });
            }
            
            // Test against block background
            var blockBg = getColor('block-bg-color') || getColor('block');
            if (blockBg) {
              tests.push({ 
                label: 'Link Text on Block Background', 
                color1: normalizedColor, 
                color2: blockBg 
              });
            }
            
            // Test against component background
            var componentBg = getColor('component-bg-color') || getColor('component');
            if (componentBg) {
              tests.push({ 
                label: 'Link Text on Component Background', 
                color1: normalizedColor, 
                color2: componentBg 
              });
            }
          }
          // Check if it's a global font color (affects multiple sections)
          else if (fieldName === 'font-color' || 
                   fieldName === 'heading-color' || 
                   fieldName === 'instruction-color') {
            // Test against all major background colors
            var globalBgSections = ['page', 'article', 'block', 'component'];
            for (var j = 0; j < globalBgSections.length; j++) {
              var section = globalBgSections[j];
              var bgColor = getColor(section + '-bg-color') || getColor(section);
              if (bgColor) {
                var globalLabel = 'Text on ' + capitalize(section) + ' Background';
                tests.push({ label: globalLabel, color1: normalizedColor, color2: bgColor });
              }
            }
          } else if (currentSection) {
            // Section-specific font color - check against its own background
            var bgFields = [
              currentSection + '-bg-color',
              currentSection + '-background',
              currentSection
            ];
            
            for (var k = 0; k < bgFields.length; k++) {
              var sectionBgColor = getColor(bgFields[k]);
              if (sectionBgColor) {
                var sectionLabel = capitalize(currentSection) + ' Text on ' + capitalize(currentSection) + ' Background';
                tests.push({ label: sectionLabel, color1: normalizedColor, color2: sectionBgColor });
                break; // Only use the first matching background color
              }
            }
          }
        }
        
        return tests;
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
        
        // If any background or global font color changed, update all displays
        var isBackgroundOrGlobalFont = fieldName.indexOf('-bg-color') > -1 || 
                                       fieldName.indexOf('background') > -1 ||
                                       fieldName === 'page' || fieldName === 'article' || 
                                       fieldName === 'block' || fieldName === 'component' ||
                                       fieldName === 'font-color' || fieldName === 'heading-color' || 
                                       fieldName === 'instruction-color';
        
        if (isBackgroundOrGlobalFont) {
          setTimeout(function() {
            self.updateAllAccessibilityDisplays();
          }, 100);
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
      },
      
      // Cleanup accessibility results on view removal
      remove: function() {
        // Clean up event handlers
        $(window).off('.accessibility');
        this.$('.field').off('.accessibility');
        
        // Call parent remove
        return Backbone.View.prototype.remove.apply(this, arguments);
      }
      
    });
  };
});