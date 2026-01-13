// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Backbone = require('backbone');
  var EditorOriginView = require('../../global/views/editorOriginView');
  var Helpers = require('core/helpers');
  var Origin = require('core/origin');
  var ThemeCollection = require('../collections/editorThemeCollection');
  var PresetCollection = require('../collections/editorPresetCollection.js');
  var PresetEditView = require('./editorPresetEditView.js');
  var PresetModel = require('../models/editorPresetModel.js');

  var ThemingView = EditorOriginView.extend({
    tagName: 'div',
    className: 'theming',

    settings: {
      presetSelection: null
    },

    events: {
      'change .theme select': 'onThemeChanged',
      'change .preset select': 'onPresetChanged',
      'change .form-container form': 'onFieldChanged',
      'click button.edit': 'showPresetEdit',
      'click .accordion-header': 'onAccordionToggle'  // NEW: Accordion toggle
    },

    initialize: function() {
      this.listenTo(this, 'dataReady', this.render);
      this.listenTo(Origin, {
        'editorThemingSidebar:views:save': this.saveData,
        'editorThemingSidebar:views:savePreset': this.onSavePresetClicked,
        'editorThemingSidebar:views:resetToPreset': this.restorePresetSettings,
        'editorThemingSidebar:views:cancel': this.setPresetSelection(null),
        'managePresets:edit': this.onEditPreset,
        'managePresets:delete': this.onDeletePreset
      });

      this.loadCollections();

      EditorOriginView.prototype.initialize.apply(this, arguments);
    },

    preRender: function() {
      this.$el.hide();
    },

    render: function() {
      EditorOriginView.prototype.render.apply(this, arguments);

      Origin.trigger('location:title:update', {
        breadcrumbs: ['dashboard','course', { title: Origin.l10n.t('app.themeeditor') }],
        title: Origin.l10n.t('app.themingtitle')
      });

      this.updateRestorePresetButton();
      this.renderForm();
    },

    renderForm: function() {
      this.removeForm();

      var selectedTheme = this.getSelectedTheme();

      if (!this.themeIsEditable(selectedTheme)) {
        this.$('.theme-selector').removeClass('show-preset-select');
        this.$('.empty-message').show();
        this.$('.editable-theme').hide();
        $('.editor-theming-sidebar-reset').hide();
        return;
      }

      this.$('.theme-selector').addClass('show-preset-select');
      this.$('.empty-message').hide();
      this.$('.editable-theme').show();
      $('.editor-theming-sidebar-reset').show();
      try {
        this.form = Origin.scaffold.buildForm({
          model: selectedTheme,
          schemaType: selectedTheme.get('theme')
        });
      }
      catch(e) {
        console.log(e);
      }

      if (this.form) {
        // NEW: Check if theme has accordion sections
        var themeProperties = selectedTheme.get('properties');
        if (this.hasAccordionSections(themeProperties)) {
          this.renderAccordionForm();
        } else {
          // Original behavior
          this.$('.form-container').html(this.form.el);
        }
      }

      this.$el.find('fieldset:not(:has(>.field))').addClass('empty-fieldset');
      this.$('.theme-customiser').show();
      Origin.trigger('theming:showPresetButton', true);

      var toRestore = this.getDefaultThemeSettings();
      // Only restore theme variables if currently selected theme = saved theme
      if (selectedTheme.get('name') === Origin.editor.data.config.get('_theme') && Origin.editor.data.course.get('themeVariables')) {
        toRestore = Origin.editor.data.course.get('themeVariables');
      }
      _.defer(function() { this.restoreFormSettings(toRestore); }.bind(this));
    },

    // NEW: Check if theme has accordion sections
    hasAccordionSections: function(themeProperties) {
      if (!themeProperties || !themeProperties.variables) return false;
      
      for (var key in themeProperties.variables) {
        var section = themeProperties.variables[key];
        if (section && section.type === 'object' && section._accordion) {
          return true;
        }
      }
      return false;
    },

    // NEW: Render form using accordion structure
    renderAccordionForm: function() {
      var selectedTheme = this.getSelectedTheme();
      var themeProperties = selectedTheme.get('properties');
      var allSections = this.getAccordionSections(themeProperties);

      

      // Separate flat sections from accordion sections

      var flatSections = allSections.filter(function(s) { return s.data._accordion && s.data._accordion.renderFlat; });

      var accordionSections = allSections.filter(function(s) { return !s.data._accordion || !s.data._accordion.renderFlat; });
      
      // Start main content column
      var accordionHtml = '<div class="theme-editor-main">';
      accordionHtml += '<div class="simplified-theme-editor">';
      accordionHtml += '<div class="theme-editor-header">';
      accordionHtml += '<div class="header-icon"><i class="fa fa-paint-brush"></i></div>';
      accordionHtml += '<h2 class="theme-editor-heading">Simplified Theme Editor</h2>';
      accordionHtml += '<p>Start with global colors that automatically generate hover, focus, and disabled states. Use Advanced Mode to fine-tune specific elements if needed.</p>';
      accordionHtml += '<div class="theme-tip">';
      accordionHtml += '<strong>Tip:</strong> Your global theme colors will cascade down to all components. Only override specific sections if you need different styling.';
      accordionHtml += '</div>';
      accordionHtml += '</div>';
      
      // Render flat sections first
      flatSections.forEach(function(section) {
        accordionHtml += this.renderFlatSection(section.key, section.data);
      }.bind(this));
      accordionHtml += '<div class="theme-accordion-container">';
      
      accordionSections.forEach(function(section) {
        accordionHtml += this.renderAccordionSection(section.key, section.data);
      }.bind(this));
      
      accordionHtml += '</div></div>'; // Close accordion-container and simplified-theme-editor
      accordionHtml += '</div>'; // Close theme-editor-main

      // Add sidebar with preview
      accordionHtml += '<div class="theme-editor-sidebar">';
      accordionHtml += this.renderColorPreview();
      accordionHtml += '</div>'; // Close theme-editor-sidebar

      
      this.$('.form-container').html(accordionHtml);
      this.renderAccordionFields();
      this.initializeAccordions();
    },

    // NEW: Get sections sorted by priority
    getAccordionSections: function(themeProperties) {
      var sections = [];
      var variables = themeProperties.variables;
      
      for (var key in variables) {
        var section = variables[key];
        if (section && section.type === 'object' && section._accordion) {
          sections.push({
            key: key,
            data: section,
            priority: section._accordion.priority || 999
          });
        }
      }
      
      // Sort by priority
      sections.sort(function(a, b) {
        return a.priority - b.priority;
      });
      
      return sections;
    },


// NEW: Render color preview
    renderColorPreview: function() {
      var previewHtml = '<div class="theme-color-preview">';
      previewHtml += '<h3 class="preview-title">Live Preview</h3>';
      
      previewHtml += '<div class="preview-container">';
      previewHtml += '<div class="preview-page" data-preview="page">';
      previewHtml += '<span class="preview-hierarchy-label">Page</span>';
      
      // Progress bar (linked to primary brand color) - Page level progress
      previewHtml += '<div class="preview-progress-bar" data-preview="progress-bar">';
      previewHtml += '<div class="preview-progress-fill"></div>';
      previewHtml += '</div>';
      
      previewHtml += '<h4 class="preview-page-title">Page title</h4>';
      
      previewHtml += '<div class="preview-article" data-preview="article">';
      // previewHtml += '<span class="preview-hierarchy-label">Article</span>';
      previewHtml += '<h5 class="preview-article-title">Article title</h5>';
      
      previewHtml += '<div class="preview-block" data-preview="block">';
      // previewHtml += '<span class="preview-hierarchy-label">Block</span>';
      previewHtml += '<h6 class="preview-block-title">Block title</h6>';
      
      previewHtml += '<div class="preview-component" data-preview="component">';
      // previewHtml += '<span class="preview-hierarchy-label">Component</span>';
      previewHtml += '<h6 class="preview-component-title">Component title</h6>';
      previewHtml += '<p class="preview-instruction" data-preview="instruction">Select the correct answer from the options below:</p>';
      
      previewHtml += '<div class="preview-items">';
      previewHtml += '<label class="preview-checkbox">';
      previewHtml += '<div class="checkbox-state-container">';
      previewHtml += '<span class="checkbox-icon-wrapper">';
      previewHtml += '<span class="checkbox-icon is-checkbox checked"></span>';
      previewHtml += '</span>';
      previewHtml += '</div>';
      previewHtml += '<span class="checkbox-text">Correct answer option</span>';
      previewHtml += '</label>';
      previewHtml += '<label class="preview-checkbox">';
      previewHtml += '<div class="checkbox-state-container">';
      previewHtml += '<span class="checkbox-icon-wrapper">';
      previewHtml += '<span class="checkbox-icon is-checkbox"></span>';
      previewHtml += '</span>';
      previewHtml += '</div>';
      previewHtml += '<span class="checkbox-text">Incorrect answer option</span>';
      previewHtml += '</label>';
      previewHtml += '</div>';
      
      previewHtml += '<div class="preview-buttons">';
      previewHtml += '<button class="preview-btn preview-btn-secondary" data-preview="secondary-btn">Previous</button>';
      previewHtml += '<button class="preview-btn preview-btn-primary" data-preview="primary-btn">Next</button>';
      previewHtml += '</div>';
      
      previewHtml += '</div>';
      previewHtml += '</div>';
      previewHtml += '</div>';
      previewHtml += '</div>';
      previewHtml += '</div>';
      previewHtml += '</div>';
      return previewHtml;
    },

    // NEW: Render flat section (without accordion wrapper)
    renderFlatSection: function(sectionKey, section) {
      var sectionHtml = '<div class="theme-flat-section" data-section="' + sectionKey + '">';
      sectionHtml += '<div class="flat-section-header">';
      sectionHtml += '<h3 class="section-title">' + (section.title || sectionKey) + '</h3>';
      if (section.help) {
        sectionHtml += '<p class="section-subtitle">' + section.help + '</p>';
      }
      sectionHtml += '</div>';
      sectionHtml += '<div class="flat-section-content">';
      sectionHtml += '<div class="section-properties" data-section="' + sectionKey + '"></div>';
      sectionHtml += '</div>';
      sectionHtml += '</div>';
      return sectionHtml;
    },

    // NEW: Render individual accordion section
    renderAccordionSection: function(sectionKey, section) {
      var accordion = section._accordion || {};
      var isOpen = accordion.defaultOpen || false;
      var priority = accordion.priority || 999;
      var icon = accordion.icon || 'default';
      var status = accordion.status || '';
      
      var sectionHtml = '<div class="theme-section-accordion" data-section="' + sectionKey + '" data-priority="' + priority + '">';
      
      // Header
      sectionHtml += '<div class="accordion-header' + (isOpen ? ' open' : '') + '" data-section="' + sectionKey + '">';
      sectionHtml += '<div class="header-left">';
      sectionHtml += '<i class="icon fa fa-' + this.getIconClass(icon) + '"></i>';
      sectionHtml += '<div class="section-info">';
      sectionHtml += '<h3 class="section-title">' + (section.title || sectionKey) + '</h3>';
      if (section.help) {
        sectionHtml += '<p class="section-subtitle">' + section.help + '</p>';
      }
      sectionHtml += '</div>';
      sectionHtml += '</div>';
      sectionHtml += '<div class="header-right">';
      if (status) {
        sectionHtml += '<span class="status-badge status-' + status.toLowerCase().replace(/[^a-z]/g, '-') + '">' + status + '</span>';
      }
      sectionHtml += '<i class="chevron fa fa-chevron-down"></i>';
      sectionHtml += '</div>';
      sectionHtml += '</div>';
      
      // Content
      sectionHtml += '<div class="accordion-content' + (isOpen ? ' expanded' : ' collapsed') + '">';
      sectionHtml += '<div class="content-inner">';
      sectionHtml += '<div class="section-properties" data-section="' + sectionKey + '"></div>';
      sectionHtml += '</div>';
      sectionHtml += '</div>';
      
      sectionHtml += '</div>';
      
      return sectionHtml;
    },

    // NEW: Map icon names to Font Awesome classes
    getIconClass: function(iconName) {
      var iconMap = {
        'global': 'globe',
        'pages': 'file-text-o',
        'components': 'cube',
        'navigation': 'compass',
        'menu': 'bars',
        'progress': 'chart-line',
        'feedback': 'comment',
        'overlay': 'window-maximize',
        'settings': 'cog',
        'default': 'folder'
      };
      
      return iconMap[iconName] || iconMap['default'];
    },

    // NEW: Initialize accordion functionality
    initializeAccordions: function() {
      var self = this;
      
      // Restore saved accordion states
      this.$('.theme-section-accordion').each(function() {
        var sectionKey = $(this).data('section');
        var savedState = localStorage.getItem('accordion-' + sectionKey);
        if (savedState !== null) {
          var shouldBeOpen = savedState === 'true';
          var header = $(this).find('.accordion-header');
          var content = $(this).find('.accordion-content');
          
          if (shouldBeOpen) {
            header.addClass('open');
            content.addClass('expanded').removeClass('collapsed');
          } else {
            header.removeClass('open');
            content.addClass('collapsed').removeClass('expanded');
          }
        }      });

      // Add color picker listeners after accordions are initialized
      this.attachColorPreviewListeners();
    },

    // NEW: Color manipulation helpers for preview
    darkenColor: function(hex, percent) {
      // Convert hex to RGB
      var rgb = parseInt(hex.slice(1), 16);
      var r = (rgb >> 16) & 0xff;
      var g = (rgb >> 8) & 0xff;
      var b = rgb & 0xff;
      
      // Darken by reducing each channel
      r = Math.max(0, Math.floor(r * (1 - percent / 100)));
      g = Math.max(0, Math.floor(g * (1 - percent / 100)));
      b = Math.max(0, Math.floor(b * (1 - percent / 100)));
      
      // Convert back to hex
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    // NEW: Attach color picker change listeners
    attachColorPreviewListeners: function() {
      var self = this;
      
      // Wait for form fields to be rendered
      setTimeout(function() {
        // Map schema properties to preview elements
        var colorMap = {
          'page-bg-color': '.preview-page',
          'article-bg-color': '.preview-article',
          'block-bg-color': '.preview-block',
          'component-bg-color': '.preview-component',
          'btn-color': '.preview-btn-primary',
          'btn-color-inverted': '.preview-btn-primary',
          'item-color': '.preview-btn-secondary',
          // Brand color cascades
          '_primaryBrandColor': 'PRIMARY_CASCADE',
          '_secondaryBrandColor': 'SECONDARY_CASCADE',
          '_accentBrandColor': 'ACCENT_CASCADE'
        };

        // Listen to all color picker changes - multiple event types for better coverage
        self.$('.form-container').on('input change keyup', 'input[type="text"], input[data-type="ColourPicker"]', function(e) {
          var $input = $(e.target);
          var fieldName = $input.attr('name');
          var colorValue = $input.val();

          // Check if this field affects the preview
          if (colorMap[fieldName]) {
            if (colorMap[fieldName].indexOf('CASCADE') > -1) {
              self.applyCascadeColors(fieldName, colorValue);
            } else {
              self.updatePreviewColor(colorMap[fieldName], colorValue, fieldName);
            }
          }
        });

        // Also listen to changes on color picker wrappers
        self.$('.form-container').on('change', '.field-colourpicker input, .colourpicker input', function(e) {
          var $input = $(e.target);
          var fieldName = $input.attr('name') || $input.closest('.field').find('input[name]').attr('name');
          var colorValue = $input.val();

          if (colorMap[fieldName]) {
            if (colorMap[fieldName].indexOf('CASCADE') > -1) {
              self.applyCascadeColors(fieldName, colorValue);
            } else {
              self.updatePreviewColor(colorMap[fieldName], colorValue, fieldName);
            }
          }
        });

        // Listen to spectrum colorpicker events if using spectrum plugin
        self.$('.form-container').on('move.spectrum', 'input[type="text"]', function(e, color) {
          var $input = $(e.target);
          var fieldName = $input.attr('name');
          var colorValue = color ? color.toHexString() : $input.val();

          if (colorMap[fieldName]) {
            if (colorMap[fieldName].indexOf('CASCADE') > -1) {
              self.applyCascadeColors(fieldName, colorValue);
            } else {
              self.updatePreviewColor(colorMap[fieldName], colorValue, fieldName);
            }
          }
        });

        // Initialize preview with current values
        for (var fieldName in colorMap) {
          var $input = self.$('input[name="' + fieldName + '"]');
          if ($input.length && $input.val()) {
            if (colorMap[fieldName].indexOf('CASCADE') > -1) {
              self.applyCascadeColors(fieldName, $input.val());
            } else {
              self.updatePreviewColor(colorMap[fieldName], $input.val(), fieldName);
            }
          }
        }

        // Fallback: Poll for color changes every 300ms
        self.colorPreviewInterval = setInterval(function() {
          for (var fieldName in colorMap) {
            var $input = self.$('input[name="' + fieldName + '"]');
            if ($input.length) {
              var currentValue = $input.val();
              var lastValue = $input.data('last-preview-value');
              
              if (currentValue && currentValue !== lastValue) {
                if (colorMap[fieldName].indexOf('CASCADE') > -1) {
                  self.applyCascadeColors(fieldName, currentValue);
                } else {
                  self.updatePreviewColor(colorMap[fieldName], currentValue, fieldName);
                }
                $input.data('last-preview-value', currentValue);
              }
            }
          }
        }, 300);
      }, 500);
    },

    // NEW: Apply cascade colors for brand colors
    // Helper function to darken a color by percentage
    darkenColor: function(color, percentage) {
      var rgb = this.hexToRgb(color);
      if (!rgb) return color;
      
      var factor = 1 - (percentage / 100);
      var r = Math.round(rgb.r * factor);
      var g = Math.round(rgb.g * factor);
      var b = Math.round(rgb.b * factor);
      
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    
    // Helper function to mix two colors (for generating tints/shades)
    mixColors: function(color1, color2, percentage) {
      // Convert hex to RGB
      var c1 = this.hexToRgb(color1);
      var c2 = this.hexToRgb(color2);
      
      if (!c1 || !c2) return color2;
      
      // Mix colors based on percentage (percentage of color1)
      var p = percentage / 100;
      var r = Math.round(c1.r * p + c2.r * (1 - p));
      var g = Math.round(c1.g * p + c2.g * (1 - p));
      var b = Math.round(c1.b * p + c2.b * (1 - p));
      
      // Convert back to hex
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    
    // Helper function to convert hex to RGB
    hexToRgb: function(hex) {
      // Remove # if present
      hex = hex.replace(/^#/, '');
      
      // Parse hex values
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      
      var num = parseInt(hex, 16);
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
      };
    },
    
    applyCascadeColors: function(fieldName, color) {
      if (!color || color === '') return;
      
      // Normalize hex color (remove # if present, then add it back)
      if (color.indexOf('#') !== 0) {
        color = '#' + color;
      }
      
      switch(fieldName) {
        case '_primaryBrandColor':
          // Primary affects progress bar and buttons (both primary and secondary)
          // Progress bar: fill color
          this.$('.preview-progress-fill').css('background-color', color);
          // Primary button: background color
          this.$('.preview-btn-primary').css('background-color', color);
          // Secondary button: border color (keeps light background, uses primary for border)
          this.$('.preview-btn-secondary').css({
            'border-color': color,
            'border': '2px solid ' + color,
            'color': color
          });
          break;
          
        case '_secondaryBrandColor':
          // Secondary affects items (MCQs, accordions, checkboxes, etc.)
          // Mimic actual MCQ styling: darker shade for state container, lighter tint for item background
          
          // State container (left side) - use the actual color (item-color-inverted)
          this.$('.checkbox-state-container').css('background-color', color);
          
          // Checkbox icon border and fill colors
          this.$('.checkbox-icon').css({
            'border-color': 'rgba(255, 255, 255, 0.6)',
            'color': '#ffffff'
          });
          
          // Checked checkbox - fill with white
          this.$('.checkbox-icon.checked').css('background-color', '#ffffff');
          
          // Item background (text area) - use lighter tint (item-color)
          // Generate lighter tint by mixing with white (95% white = very light tint)
          var lightTint = this.mixColors('#ffffff', color, 95);
          this.$('.preview-checkbox').css('background-color', lightTint);
          
          // Hover state for state container - use darker tint
          var hoverTint = this.mixColors('#ffffff', color, 0); // Slightly darker
          var darkerTint = this.darkenColor(color, 15);
          // Store as CSS variable or data attribute for future use
          break;
          
        case '_accentBrandColor':
          // Accent affects table alternating rows (not in preview)
          // Could add visual indicator later
          break;
      }
    },

    // NEW: Update preview element color
    updatePreviewColor: function(selector, color, fieldName) {
      var $element = this.$(selector);
      if (!$element.length || !color) return;

      // Apply color based on field type
      if (fieldName.indexOf('-inverted') > -1) {
        // Inverted colors are text colors
        $element.css('color', color);
      } else if (fieldName.indexOf('btn-') === 0 || fieldName.indexOf('item-') === 0) {
        // Button and item colors are backgrounds
        $element.css('background-color', color);
      } else {
        // Default to background color
        $element.css('background-color', color);
      }
    },

    // NEW: Render form fields into their respective accordion sections
    renderAccordionFields: function() {
      var self = this;
      var selectedTheme = this.getSelectedTheme();
      var themeProperties = selectedTheme.get('properties');
      
      if (!this.form || !this.form.fields) return;
      
      // Group fields by section
      var fieldsBySection = {};
      var unmatchedFields = [];
      
      for (var fieldKey in this.form.fields) {
        var field = this.form.fields[fieldKey];
        var sectionKey = this.findFieldSection(fieldKey, themeProperties.variables);
        
        if (sectionKey) {
          if (!fieldsBySection[sectionKey]) {
            fieldsBySection[sectionKey] = [];
          }
          fieldsBySection[sectionKey].push({ key: fieldKey, field: field });
        } else {
          // Collect unmatched fields with their keys for debugging
          unmatchedFields.push({ key: fieldKey, field: field });
        }
      }
      
      // Log unmatched fields for debugging
      if (unmatchedFields.length > 0) {
        console.log('Unmatched theme fields:', unmatchedFields.map(function(item) { return item.key; }));
      }
      
      // Render fields into their accordion sections
      for (var sectionKey in fieldsBySection) {
        var $sectionContainer = this.$('.section-properties[data-section="' + sectionKey + '"]');
        var fields = fieldsBySection[sectionKey];
        
        fields.forEach(function(item) {
          if (item.field && item.field.el) {
            $sectionContainer.append(item.field.el);
          }
        });
      }
      
      // Render unmatched fields in a separate section at the bottom
      if (unmatchedFields.length > 0) {
        var $container = this.$('.theme-accordion-container');
        var unmatchedHtml = '<div class="theme-section-accordion unmatched-fields" data-section="_unmatched">';
        unmatchedHtml += '<div class="accordion-header open" data-section="_unmatched">';
        unmatchedHtml += '<div class="header-left">';
        unmatchedHtml += '<i class="icon fa fa-exclamation-triangle"></i>';
        unmatchedHtml += '<div class="section-info">';
        unmatchedHtml += '<h3 class="section-title">Additional Settings</h3>';
        unmatchedHtml += '<p class="section-subtitle">Settings not categorized in sections above</p>';
        unmatchedHtml += '</div>';
        unmatchedHtml += '</div>';
        unmatchedHtml += '<div class="header-right">';
        unmatchedHtml += '<i class="chevron fa fa-chevron-down"></i>';
        unmatchedHtml += '</div>';
        unmatchedHtml += '</div>';
        unmatchedHtml += '<div class="accordion-content expanded">';
        unmatchedHtml += '<div class="content-inner">';
        unmatchedHtml += '<div class="section-properties" data-section="_unmatched"></div>';
        unmatchedHtml += '</div>';
        unmatchedHtml += '</div>';
        unmatchedHtml += '</div>';
        
        $container.append(unmatchedHtml);
        
        var $unmatchedContainer = this.$('.section-properties[data-section="_unmatched"]');
        unmatchedFields.forEach(function(item) {
          if (item.field && item.field.el) {
            $unmatchedContainer.append(item.field.el);
          }
        });
      }
    },

    // NEW: Find which section a field belongs to
    findFieldSection: function(fieldKey, variables) {
      for (var sectionKey in variables) {
        var section = variables[sectionKey];
        if (section && section.type === 'object' && section.properties) {
          if (section.properties[fieldKey]) {
            return sectionKey;
          }
        }
      }
      return null;
    },

    // NEW: Handle accordion header clicks
    onAccordionToggle: function(event) {
      var $header = $(event.currentTarget);
      var $section = $header.closest('.theme-section-accordion');
      var $content = $section.find('.accordion-content');
      var sectionKey = $section.data('section');
      
      // Toggle open/closed
      $header.toggleClass('open');
      $content.toggleClass('expanded collapsed');
      
      // Save state to localStorage
      var isOpen = $header.hasClass('open');
      localStorage.setItem('accordion-' + sectionKey, isOpen);
    },

    // ORIGINAL METHODS BELOW (unchanged)

    removeForm: function() {
      this.$('.form-container').empty();
      this.$('.theme-customiser').hide();

      this.form = null;

      Origin.trigger('theming:showPresetButton', false);
    },

    postRender: function() {
      this.updateSelects();
      this.setViewToReady();

      this.$el.show();
    },

    loadCollections: function() {
      this.themes = new ThemeCollection();
      this.listenTo(this.themes, {
        sync: this.onCollectionReady,
        error: this.onError
      });
      this.themes.fetch();

      this.presets = new PresetCollection();
      this.listenTo(this.presets, {
        sync: this.onCollectionReady,
        error: this.onError
      });
      this.presets.fetch();
    },

    updateSelects: function() {
      this.updateThemeSelect();
      this.updatePresetSelect();
    },

    updateThemeSelect: function() {
      var select = this.$('.theme select');
      var oldVal = select.val();
      // remove options first
      $('option', select).remove();
      // add 'no presets'
      select.append($('<option>', { value: "", disabled: 'disabled', selected: 'selected' }).text(Origin.l10n.t('app.selectinstr')));
      // add options
      this.themes.models.forEach(function(item) {
        if (item.get('_isAvailableInEditor') === false) return;
        select.append($('<option>', { value: item.get('theme') }).text(item.get('displayName')));
      }, this);

      // disable if no options
      select.attr('disabled', this.themes.models.length === 0);
      // restore the previous value
      if (oldVal) return select.val(oldVal);

      // select current theme
      var selectedTheme = this.getSelectedTheme();
      if (selectedTheme) select.val(selectedTheme.get('theme'));
    },

    updatePresetSelect: function() {
      var theme = this.$('.theme select').val();
      var presets = this.presets.where({ parentTheme: theme });
      var select = this.$('.preset select');
      // remove options first
      $('option', select).remove();
      // add 'no presets'
      select.append($('<option>', { value: "", selected: 'selected' }).text(Origin.l10n.t('app.nopresets')));
      // add options
      presets.forEach(function(item) {
        select.append($('<option>', { value: item.get('_id') }).text(item.get('displayName')));
      }, this);
      // disable delete, hide manage preset buttons if empty
      if (presets.length <= 0) {
        select.attr('disabled', true);
        this.$('button.edit').hide();
        return;
      }

      var selectedPreset = this.getSelectedPreset();
      if (selectedPreset && selectedPreset.get('parentTheme') === theme) {
        $.get('api/themepreset/exists/' + selectedPreset.get('_id'), function(data) {
          if (data.success) {
            select.val(selectedPreset.get('_id'))
          } else {
            this.removePresetOption(selectedPreset.get('_id'));
          }
        }.bind(this));
      }
      select.attr('disabled', false);
      this.$('button.edit').show();
    },

    restoreFormSettings: function(toRestore) {
      if (!this.form || !this.form.el) return;

      for (var key in toRestore) {
        // Check for nested properties
        if (typeof toRestore[key] === 'object') {
          for (var innerKey in toRestore[key]) {
            this.restoreField(this.form.fields[innerKey], toRestore[key][innerKey], innerKey);
          }
        } else {
          this.restoreField(this.form.fields[key], toRestore[key], key)
        }
      }
    },

    restoreField: function(fieldView, value, key) {
      if (!fieldView) {
        return;
      }
      var inputType = fieldView.schema.inputType.type || fieldView.schema.inputType;
      // Colour picker
      if (inputType === 'ColourPicker') {
        fieldView.setValue(value);
        return
      }

      // Assets
      if (inputType.indexOf('Asset') > -1) {
        fieldView.setValue(value);
        fieldView.render();
        $('div[data-editor-id*="' + key + '"]').append(fieldView.editor.$el);
        return;
      }

      // Lists / arrays
      if (inputType === "List"){
        fieldView.setValue(value);
        return;
      }

      // Checkbox
      if (inputType === "Checkbox"){
        fieldView.setValue(value);
        return;
      }
  
      // Default
      fieldView.editor.$el.val(value.toString())

    },

    showPresetEdit: function(event) {
      event && event.preventDefault();
      var parentTheme = this.getSelectedTheme().get('theme');
      var pev = new PresetEditView({
        model: new Backbone.Model({ presets: new Backbone.Collection(this.presets.where({ parentTheme: parentTheme })) })
      });
      $('body').append(pev.el);
    },

    restorePresetSettings: function(event) {
      event && event.preventDefault();
      var self = this;
      Origin.Notify.confirm({
        type: 'warning',
        text: Origin.l10n.t('app.restorepresettext'),
        callback: function(confirmed) {
          if (!confirmed) {
            return;
          }
          var preset = self.getSelectedPreset();
          var settings = (preset) ? preset.get('properties') : self.getDefaultThemeSettings();
          self.updateRestorePresetButton(false);
          self.restoreFormSettings(settings);
        }
      });
    },

    validateForm: function() {
      var selectedTheme = this.getSelectedTheme();

      if (selectedTheme === undefined) {
        Origin.Notify.alert({
          type: 'error',
          text: Origin.l10n.t('app.errornothemeselected')
        });
        return false;
      }
      return true;
    },

    savePreset: function(presetName) {
      // first, save the form data
      this.form.commit();

      var presetModel = new PresetModel({
        displayName: presetName,
        parentTheme: this.getSelectedTheme().get('theme'),
        properties: this.extractData(this.form.model.attributes)
      });

      var self = this;
      presetModel.save(null, {
        error: function(model, response, options) {
          Origin.Notify.alert({ type: 'error', text: response });
        },
        success: function() {
          self.presets.add(presetModel);
          self.updateRestorePresetButton(false);
          self.setPresetSelection(presetModel.get('_id'));
          window.setTimeout(function() { self.$('.preset select').val(presetModel.get('_id')); }, 1);
        }
      });
    },

    saveData: function(event) {
      event && event.preventDefault();

      if (!this.validateForm()) {
        return Origin.trigger('sidebar:resetButtons');
      }

      this.postThemeData(function(){
        this.postPresetData(function() {
          this.postSettingsData(this.onSaveSuccess);
        });
      });
    },

    postThemeData: function(callback) {
      var selectedTheme = this.getSelectedTheme();
      var selectedThemeId = selectedTheme.get('_id');
      $.post('api/theme/' + selectedThemeId + '/makeitso/' + this.model.get('_courseId'))
        .error(this.onSaveError.bind(this))
        .done(callback.bind(this));
    },

    postPresetData: function(callback) {
      var selectedPreset = this.getSelectedPreset(false);
      var selectedPresetId = null;
      if (selectedPreset) selectedPresetId = selectedPreset.get('_id');
      $.post('api/themepreset/' + selectedPresetId + '/makeitso/' + this.model.get('_courseId'))
        .error(this.onSaveError.bind(this))
      .done(callback.bind(this));
    },

    postSettingsData: function(callback) {
      if (!this.form) {
        return callback.apply(this);
      }
      this.form.commit();
      var settings = this.extractData(this.form.model.attributes);
      Origin.editor.data.course.set('themeVariables', settings);
      Origin.editor.data.course.save(null, {
        error: this.onSaveError.bind(this),
        success: callback.bind(this)
      });
    },

    extractData: function(attributes) {
      var data = {};
      var properties = attributes.properties.variables;
      for (var key in properties) {
        // Check for nested properties
        if (typeof properties[key].properties !== 'undefined') {
          data[key] = {};
            for (var innerKey in properties[key].properties) {
              data[key][innerKey] = attributes[innerKey];
          }
        } else {
          data[key] = attributes[key];
        }
      }
      return data;
    },

    navigateBack: function(event) {
      event && event.preventDefault();
      Backbone.history.history.back();
      this.remove();
    },

    isDataLoaded: function() {
      return this.themes.ready === true && this.presets.ready === true;
    },

    getSelectedTheme: function() {
      var theme = $('select#theme', this.$el).val();
      if (theme) {
        return this.themes.findWhere({ 'theme': theme });
      }
      return this.themes.findWhere({ 'name': this.model.get('_theme') });
    },

    getSelectedPreset: function(includeCached) {
      var storedId = this.getPresetSelection();
      var presetId = $('select#preset', this.$el).val();
      if (storedId) {
        return this.presets.findWhere({ '_id': storedId });
      }
      if (presetId) {
        return this.presets.findWhere({ '_id': presetId });
      }
      if (includeCached !== false){
        var selectedTheme = this.getSelectedTheme();
        if (!selectedTheme) return;
        var parent = selectedTheme.get('theme');
        return this.presets.findWhere({ '_id': this.model.get('_themePreset'), parentTheme: parent });
      }
    },

    getDefaultThemeSettings: function() {
      var defaults = {};
      var props = this.getSelectedTheme().get('properties').variables;
      for (var key in props) {
        // Check for nested properties
        if (typeof props[key].properties === 'object') {
          defaults[key] = {};
          for (var innerKey in props[key].properties) {
            defaults[key][innerKey] = props[key].properties[innerKey].default;
          }
        } else {
          defaults[key] = props[key].default;
        }
      }
      return defaults;
    },

    getCurrentSettings: function() {
      if (!this.form) {
        return Origin.editor.data.course.get('themeVariables');
      }

      return _.mapObject(this.form.fields, function(field) {
        return field.getValue();
      });
    },

    themeIsEditable: function(theme) {
      var props = theme && theme.get('properties');

      return props && props.variables;
    },

    flattenNestedProperties: function(properties) {
      var flatProperties = {};
      if (typeof properties !== 'undefined') {
        for (var key in properties) {
          // Check for nested properties
          if (typeof properties[key] === 'object') {
            for (var innerKey in properties[key]) {
              flatProperties[innerKey] = properties[key][innerKey];
            }
          } else {
            flatProperties[key] = properties[key];
          }
        }
      }
      return flatProperties;
    },

    updateRestorePresetButton: function(shouldShow) {
      if (typeof shouldShow === 'undefined') {
        var currentSettings = this.flattenNestedProperties(this.getCurrentSettings());
        var preset = this.getSelectedPreset();
        var baseSettings = this.flattenNestedProperties((preset) ? preset.get('properties') : this.getDefaultThemeSettings());
        shouldShow = !_.isEqual(currentSettings, baseSettings);
      }
      var $reset = $('.editor-theming-sidebar-reset');
      shouldShow ? $reset.css('visibility', 'visible') : $reset.css('visibility', 'hidden');
    },

    getPresetSelection: function() {
      return this.settings.presetSelection;
    },

    setPresetSelection: function(id) {
      this.settings.presetSelection = id;
    },

    onEditPreset: function(data) {
      var model = this.presets.findWhere({ displayName: data.oldValue });
      model.set('displayName', data.newValue);
      model.save();
    },

    onDeletePreset: function(preset) {
      var toDestroy = this.presets.findWhere({ displayName: preset });
      this.removePresetOption(toDestroy.get('_id'));
      toDestroy.destroy();
    },

    removePresetOption: function(id) {
      var select = this.$('.preset select');
      if (select.val() === id) {
          select.val('');
      }
      select.find('option[value="' + id + '"]').remove();
    },

    onCollectionReady: function(collection) {
      if (collection === this.themes || collection === this.presets) {
        collection.ready = true;
        if (this.isDataLoaded()) this.trigger('dataReady');
      }
      // must just be a model
      else {
        this.updateSelects();
      }
    },

    onError: function(collection, response, options) {
      Origin.Notify.alert({
        type: 'error',
        text: response
      });
    },

    onThemeChanged: function() {
      this.setPresetSelection(null);
      this.updatePresetSelect();
      this.renderForm();
      this.updateRestorePresetButton(false);
    },

    onPresetChanged: function(event) {
      var preset = this.presets.findWhere({ _id: $(event.currentTarget).val() });
      var settings = preset && preset.get('properties') || this.getDefaultThemeSettings();
      this.setPresetSelection($(event.currentTarget).val());
      this.restoreFormSettings(settings);
      this.updateRestorePresetButton(false);
    },

    onFieldChanged: function() {
      this.updateRestorePresetButton();
    },

    onSavePresetClicked: function() {
      var self = this;
      Origin.Notify.alert({
        type: 'input',
        text: Origin.l10n.t('app.presetinputtext'),
        closeOnConfirm: false,
        showCancelButton: true,
        callback: function(presetName) {
          if (presetName === false) return;
          if (presetName === "") return swal.showInputError(Origin.l10n.t('app.invalidempty'));
          var theme = self.$('.theme select').val();
          var presets = self.presets.where({ parentTheme: theme, displayName: presetName });
          if (presets.length > 0) {
            swal.showInputError(Origin.l10n.t('app.duplicatepreseterror'));
          } else {
            // watch out for injection attacks
            self.savePreset(Helpers.escapeText(presetName));
            swal.close();
          }
        }
      });
    },

    onSaveError: function() {
      Origin.Notify.alert({
        type: 'error',
        text: Origin.l10n.t('app.errorsave')
      });

      this.navigateBack();
    },

    onSaveSuccess: function() {
      Origin.trigger('editingOverlay:views:hide');
      Origin.trigger('editor:refreshData', this.navigateBack.bind(this), this);
    }
  }, {
    template: 'editorTheming'
  });

  // Try to load custom extension if available
  try {
    var customExtension = require('./editorThemingView.custom');
    if (typeof customExtension === 'function') {
      // Apply custom extension to ThemingView
      ThemingView = customExtension(ThemingView);
    }
  } catch(e) {
    // Custom extension not found or error loading, continue with original
    console.log('Custom theming extension not loaded:', e.message);
  }

  return ThemingView;

});


