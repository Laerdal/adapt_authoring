define([
  'core/origin',
  'backbone-forms',
  'libraries/marked.min.js',
  './xmlToHtmlPlugin'
], function(Origin, BackboneForms, marked, xmlToHtmlPlugin) {

  var templates = Handlebars.templates;
  var fieldTemplate = templates.field;
  var templateData = Backbone.Form.Field.prototype.templateData;
  var initialize = Backbone.Form.editors.Base.prototype.initialize;
  var textInitialize = Backbone.Form.editors.Text.prototype.initialize;
  var selectInitialize = Backbone.Form.editors.Select.prototype.initialize;
  var selectRender = Backbone.Form.editors.Select.prototype.render;
  var checkboxInitialize = Backbone.Form.editors.Checkbox.prototype.initialize;
  var checkboxRender = Backbone.Form.editors.Checkbox.prototype.render;
  var textAreaRender = Backbone.Form.editors.TextArea.prototype.render;
  var textAreaSetValue = Backbone.Form.editors.TextArea.prototype.setValue;

  Backbone.Form.prototype.constructor.template = templates.form;
  Backbone.Form.Fieldset.prototype.template = templates.fieldset;
  Backbone.Form.Field.prototype.template = fieldTemplate;
  Backbone.Form.NestedField.prototype.template = fieldTemplate;

  // Shared tooltip show/hide functions for mouse and keyboard accessibility
  var showTooltip = function(e) {
    var $icon = $(e.currentTarget);
    var $tooltip = $icon.siblings('.tooltip');
    if (!$tooltip.length) return;

    // Hide all other visible tooltips first
    $('.field-help .tooltip').not($tooltip).each(function() {
      var $t = $(this);
      clearTimeout($t.data('hideTimeout'));
      $t.removeData('hideTimeout');
      $t.css({ top: '', left: '', visibility: 'hidden', opacity: 0, display: 'none' });
    });

    // Clear any pending hide timeout for this tooltip
    var pendingTimeout = $tooltip.data('hideTimeout');
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      $tooltip.removeData('hideTimeout');
    }

    // Make tooltip visible but transparent to measure its size
    $tooltip.css({ visibility: 'hidden', opacity: 0, display: 'block' });
    var iconRect = $icon[0].getBoundingClientRect();
    var tooltipWidth = $tooltip.outerWidth();
    var tooltipHeight = $tooltip.outerHeight();

    var spaceBelow = window.innerHeight - iconRect.bottom;
    var margin = 8;

    // Vertical: prefer below, use above if not enough space below
    var top;
    if (spaceBelow >= tooltipHeight + margin) {
      top = iconRect.bottom + margin;
    } else {
      top = iconRect.top - tooltipHeight - margin;
    }

    // Horizontal: align left edge to icon, clamp to viewport
    var left = iconRect.left;
    if (left + tooltipWidth > window.innerWidth - margin) {
      left = window.innerWidth - tooltipWidth - margin;
    }
    left = Math.max(margin, left);

    // Clamp vertical to viewport
    top = Math.max(margin, Math.min(top, window.innerHeight - tooltipHeight - margin));

    $tooltip.css({
      top: top + 'px',
      left: left + 'px',
      visibility: 'visible',
      opacity: 0.9
    });

    // Dismiss tooltip on window scroll or resize
    var dismiss = function() {
      hideTooltip(e);
    };
    $(window).off('scroll.tooltip resize.tooltip');
    $(window).on('scroll.tooltip', dismiss);
    $(window).on('resize.tooltip', dismiss);
  };

  var hideTooltip = function(e) {
    var $icon = $(e.currentTarget);
    var $tooltip = $icon.siblings('.tooltip');
    if (!$tooltip.length) return;

    // Clear any existing hide timeout
    var existingTimeout = $tooltip.data('hideTimeout');
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Fade out: transition opacity first, then hide after animation completes
    $tooltip.css({ opacity: 0 });
    var hideTimeout = setTimeout(function() {
      $tooltip.css({ top: '', left: '', visibility: 'hidden', display: 'none' });
      $tooltip.removeData('hideTimeout');
    }, 300);
    $tooltip.data('hideTimeout', hideTimeout);
    $(window).off('scroll.tooltip resize.tooltip');
  };

  // add reset to default handler
  Backbone.Form.Field.prototype.events = {
    'click [data-action="default"]': function() {
      this.setValue(this.editor.defaultValue);
      this.editor.trigger('change', this);

      return false;
    },
    'mouseenter .field-help i': showTooltip,
    'mouseleave .field-help i': hideTooltip,
    'focus .field-help i': showTooltip,
    'blur .field-help i': hideTooltip
  };

  // merge schema into data
  Backbone.Form.Field.prototype.templateData = function() {
    return _.extend(templateData.call(this), this.schema, {
      isDefaultValue: _.isEqual(this.editor.value, this.editor.defaultValue)
    });
  };

  // use default from schema and set up isDefaultValue toggler
  Backbone.Form.editors.Base.prototype.initialize = function(options) {
    var schemaDefault = options.schema.default;

    if (schemaDefault !== undefined && options.id) {
      this.defaultValue = schemaDefault;
    }

    this.listenTo(this, 'change', function() {
      if (this.hasNestedForm) return;

      var isDefaultValue = _.isEqual(this.getValue(), this.defaultValue);

      this.form.$('[data-editor-id="' + this.id + '"]')
        .toggleClass('is-default-value', isDefaultValue);
    });

    initialize.call(this, options);
    
    // Trigger initial check after a short delay to ensure DOM is ready
    var self = this;
    _.defer(function() {
      if (!self.hasNestedForm && self.defaultValue !== undefined && self.form) {
        try {
          var isDefaultValue = _.isEqual(self.getValue(), self.defaultValue);
          var $field = self.$el.closest('[data-editor-id]');
          if ($field.length > 0) {
            $field.toggleClass('is-default-value', isDefaultValue);
          }
        } catch (e) {
          // Ignore errors from editors that aren't fully initialized yet (e.g., color pickers)
        }
      }
    });
  };

  // disable automatic completion on text fields if not specified
  Backbone.Form.editors.Text.prototype.initialize = function(options) {
    textInitialize.call(this, options);

    if (!this.$el.attr('autocomplete')) {
      this.$el.attr('autocomplete', 'off');
    }
    
    // Ensure DOM change/input events trigger Backbone change events for reset button visibility
    var self = this;
    this.$el.on('input change blur', function() {
      // Trigger Backbone change event
      self.trigger('change', self);
      
      // Also manually update is-default-value class
      if (self.form && self.id && self.defaultValue !== undefined) {
        var isDefaultValue = _.isEqual(self.getValue(), self.defaultValue);
        var $field = self.$el.closest('[data-editor-id]');
        if ($field.length > 0) {
          $field.toggleClass('is-default-value', isDefaultValue);
        }
      }
    });
  };

  // render ckeditor in textarea
  Backbone.Form.editors.TextArea.prototype.render = function() {
    textAreaRender.call(this);

    function until(conditionFunction) {
      function poll(resolve) {
        if (conditionFunction()) {
          resolve();
          return;
        }
        setTimeout(function() {
          poll(resolve)
        }, 10);
      }
      return new Promise(poll);
    }
    function isAttached($element) {
      return function() {
        return Boolean($element.parents('body').length);
      };
    }

    function convertStringsToRegExDeep (arr) {
      function processEntry ([key, value]) {
        value = (typeof value === "string")
          ? new RegExp(value, 'i')
          : Array.isArray(value)
            ? arr.map((value, index) => processEntry([index, value])[1])
            : (typeof value === "object" && value !== null)
              ? Object.fromEntries(Object.entries(value).map(processEntry))
              : value;
        return [key, value];
      }
      return arr.map((value, index) => processEntry([index, value])[1])
    }

      // Check if editor is empty
      function isCKEditorEmpty(editor) {
        const data = editor.getData().replace(/\s/g, '');
        const emptyPatterns = ['', '<p></p>', '<p>&nbsp;</p>', '<p><br></p>', '<div></div>', '<div>&nbsp;</div>', '<div><br></div>'];
        return !data || emptyPatterns.includes(data) || data.replace(/<p>(&nbsp;|<br>|)<\/p>/g, '').length === 0;
      }

    // Get full plain text content from the editor (strip HTML safely)
    function getEditorPlainText(editor) {
      try {
        const html = (typeof editor.getData === 'function') ? editor.getData() : '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        return (tmp.textContent || tmp.innerText || '').trim();
      } catch (e) {
        console.error('getEditorPlainText error', e);
        return '';
      }
    }

    // AI Agent Plugin
    function AiAgentPlugin(editor, promptResponse) {
      const balloon = editor.plugins.get('ContextualBalloon');
      
      // Create panel element
      const panelElement = document.createElement('div');
      panelElement.classList.add('ai-agent-popup-panel');
      
      // Initialize panel HTML
      panelElement.innerHTML = `
        <div class="AiAgent">
          <span id="closePopup">×</span>    
          <span class='help-assistant' title="Click for assistance"><svg width="20" height="20" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 16C12 16.5523 11.5523 17 11 17C10.4477 17 10 16.5523 10 16C10 15.4477 10.4477 15 11 15C11.5523 15 12 15.4477 12 16Z" fill="#666666"/><path d="M9.5 8.5C9.5 7.67157 10.1716 7 11 7C11.8284 7 12.5 7.67157 12.5 8.5C12.5 8.90672 12.3394 9.27391 12.0761 9.54503C11.9995 9.62385 11.9122 9.71095 11.8184 9.80462C11.5072 10.1151 11.1239 10.4977 10.8189 10.8896C10.4067 11.4192 10 12.1264 10 13C10 13.5523 10.4477 14 11 14C11.5523 14 12 13.5523 12 13C12 12.769 12.1052 12.4932 12.3972 12.118C12.6184 11.8338 12.8705 11.5819 13.1583 11.2943C13.2702 11.1826 13.3877 11.0652 13.5106 10.9386C14.122 10.3093 14.5 9.44778 14.5 8.5C14.5 6.567 12.933 5 11 5C9.067 5 7.5 6.567 7.5 8.5C7.5 9.05228 7.94772 9.5 8.5 9.5C9.05229 9.5 9.5 9.05228 9.5 8.5Z" fill="#666666"/><path d="M11 22C17.0751 22 22 17.0751 22 11C22 4.92487 17.0751 0 11 0C4.92487 0 0 4.92487 0 11C0 17.0751 4.92487 22 11 22ZM11 20C6.02944 20 2 15.9706 2 11C2 6.02944 6.02944 2 11 2C15.9706 2 20 6.02944 20 11C20 15.9706 15.9706 20 11 20Z" fill="#666666"/></svg></span>
          <label><svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.3738 13.5212C13.2868 14.4083 14.7461 14.4003 15.6493 13.4972L16.4742 12.6722C17.8411 11.3054 20.0572 11.3054 21.424 12.6723C22.0579 13.3062 22.3978 14.1227 22.4438 14.9525L23.4866 13.9097C25.5368 11.8594 25.5368 8.53533 23.4866 6.48508C21.4363 4.43482 18.1122 4.43482 16.0619 6.48508L12.3226 10.2246C11.4462 11.1296 11.4471 12.569 12.3255 13.4728L12.3738 13.5212Z" fill="#DBC6EC"/><path d="M20.5833 13.4817L20.6145 13.5129C21.5094 14.4245 21.505 15.8884 20.6014 16.7946L20.599 16.7971L14.5867 22.8094C14.2623 23.1338 13.7364 23.1338 13.412 22.8094L4.5123 13.9097C2.46205 11.8594 2.46205 8.53533 4.5123 6.48508C6.56255 4.43482 9.88667 4.43482 11.9369 6.48508L13.1744 7.72252L11.5244 9.37238C10.1576 10.7392 10.1576 12.9553 11.5244 14.3221C12.8912 15.689 15.1073 15.689 16.4741 14.3221L17.2991 13.4972C18.2052 12.5912 19.6709 12.586 20.5833 13.4817Z" fill="#EFDFFC"/><path fill-rule="evenodd" clip-rule="evenodd" d="M14 6.89757L15.2375 5.6601C17.7434 3.15423 21.8062 3.15423 24.3121 5.6601C26.818 8.16596 26.818 12.2288 24.3121 14.7346L21.4891 17.5576L21.429 17.6176C21.4275 17.619 21.4261 17.6205 21.4246 17.622L15.4123 23.6343C14.6323 24.4143 13.3677 24.4143 12.5877 23.6343L3.68799 14.7346C1.18213 12.2288 1.18213 8.16596 3.68799 5.6601C6.19386 3.15424 10.2567 3.15423 12.7625 5.6601L14 6.89757ZM14.5873 22.8094C14.2629 23.1337 13.737 23.1337 13.4126 22.8094L4.51295 13.9097C2.4627 11.8594 2.4627 8.53531 4.51295 6.48506C6.5632 4.4348 9.88732 4.4348 11.9376 6.48506L13.175 7.7225L11.525 9.37236C10.1582 10.7392 10.1582 12.9553 11.525 14.3221C12.8919 15.6889 15.1079 15.6889 16.4748 14.3221L17.2998 13.4972C18.211 12.586 19.6884 12.586 20.5996 13.4972C21.51 14.4076 21.5108 15.8832 20.6021 16.7946C20.6013 16.7954 20.6004 16.7962 20.5996 16.797L14.5873 22.8094ZM23.4871 13.9097L22.4443 14.9525C22.3984 14.1227 22.0585 13.3062 21.4246 12.6723C20.0577 11.3054 17.8416 11.3054 16.4748 12.6722L15.6498 13.4971C14.7386 14.4084 13.2612 14.4084 12.35 13.4971C11.4388 12.5859 11.4388 11.1085 12.35 10.1973L16.0625 6.48506C18.1128 4.4348 21.4369 4.4348 23.4871 6.48506C25.5374 8.53531 25.5374 11.8594 23.4871 13.9097Z" fill="#1A1A1A"/></svg>
Samaritan Assistance</label><br>

          <div class='generatedResponse'></div>
          <div id="loadingMsg"></div>
          <div class="ai-predefined-prompts-section">
            <div class="ai-prompt-buttons-inline">
              <button class="ai-prompt-btn-inline" data-prompt="ImproveWriting">Improve wording</button>
              <button class="ai-prompt-btn-inline" data-prompt="makeShorter">Shorten</button>
              <button class="ai-prompt-btn-inline" data-prompt="makeLonger">Prolong</button>
              <button class="ai-prompt-btn-inline" data-prompt="spellChecker">Correct spelling</button>
            </div>
          </div>        
            
          <div class="custom-prompt-section">
            <textarea id="assistantTextArea" placeholder="Ask Samaritan to edit or generate from scratch..."></textarea>            
            <button class="btnAiAgent buttonSend" id="assistantSubmitBtn"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5.26349 6.91891C5.04205 5.36781 6.6102 4.17583 8.04572 4.80367L20.3065 10.1679L20.452 10.2373C21.903 11.0064 21.8543 13.1548 20.3065 13.832L8.04572 19.1963C6.61011 19.8242 5.04188 18.6323 5.26349 17.081L5.99005 12L5.26349 6.91891ZM7.86701 11H9.99982C10.5521 11 10.9998 11.4477 10.9998 12C10.9998 12.5522 10.5521 13 9.99982 13H7.86701L7.24396 17.3642L19.5047 12L7.24396 6.63571L7.86701 11Z" fill="#ffffff"></path></svg></button>
          </div>
          <div class="aiButtons">
            <button class="btnAiAgent buttonTryAgain" disabled id="assistantTryAgainBtn">
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M11 2C7.83065 2 5.23524 4.45734 5.01512 7.57066L6.29289 6.29289C6.68342 5.90237 7.31658 5.90237 7.70711 6.29289C8.09763 6.68342 8.09763 7.31658 7.70711 7.70711L4.70711 10.7071C4.31658 11.0976 3.68342 11.0976 3.29289 10.7071L0.292893 7.70711C-0.0976311 7.31658 -0.0976311 6.68342 0.292893 6.29289C0.683418 5.90237 1.31658 5.90237 1.70711 6.29289L3.01003 7.59582C3.22054 3.36534 6.71726 0 11 0C12.5066 0 13.9187 0.41742 15.1237 1.14348C15.5967 1.42851 15.7491 2.04306 15.4641 2.51611C15.1791 2.98915 14.5645 3.14156 14.0915 2.85652C13.1894 2.31294 12.1327 2 11 2Z" fill="#666666"/>
<path d="M16.9849 8.42934L15.7071 9.70711C15.3166 10.0976 14.6834 10.0976 14.2929 9.70711C13.9024 9.31658 13.9024 8.68342 14.2929 8.29289L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289L21.7071 8.29289C22.0976 8.68342 22.0976 9.31658 21.7071 9.70711C21.3166 10.0976 20.6834 10.0976 20.2929 9.70711L18.99 8.40418C18.7795 12.6347 15.2827 16 11 16C9.49341 16 8.08126 15.5826 6.87631 14.8565C6.40326 14.5715 6.25085 13.9569 6.53589 13.4839C6.82092 13.0108 7.43547 12.8584 7.90852 13.1435C8.81065 13.6871 9.86725 14 11 14C14.1693 14 16.7648 11.5427 16.9849 8.42934Z" fill="#666666"/>
</svg>

</button>
            <button class="btnAiAgent buttonDismiss" disabled id="assistantDismissBtn">Dismiss</button>
            <button class="btnAiAgent buttonReplace" disabled id="assistantReplaceBtn"> Replace</button>
            <button class="btnAiAgent buttonInsert" disabled id="assistantInsertBtn">Insert</button>
          </div>
        </div>
      `;
      
      // Close popup functionality
      const closePopup = () => {
        if (balloon.hasView(popupView)) {
          balloon.remove(popupView);
        }
        
        // Clean up selection markers
        document.querySelectorAll('.ai-selected-text').forEach(el => {
          el.classList.remove('ai-selected-text');
          if (el.tagName.toLowerCase() === 'span') {
            const content = el.textContent;
            const parent = el.parentNode;
            if (parent) {
              const textNode = document.createTextNode(content);
              parent.replaceChild(textNode, el);
            }
          }
        });
        
        // Reset state
        document.removeEventListener('mousedown', outsideClickHandler);
      };
      
      // Close button handler
      panelElement.querySelector('#closePopup').onclick = closePopup;
      
      // Help Assistant popup functionality
      const createHelpAssistantPopup = () => {
        // Create help popup as a separate, top-level DOM element
        const helpPopupElement = document.createElement('div');
        helpPopupElement.classList.add('help-assistant-popup');
        // Create backdrop overlay for better focus and centering
        const backdropElement = document.createElement('div');
        backdropElement.classList.add('help-assistant-backdrop');
        backdropElement.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
        `;
        
        helpPopupElement.style.cssText = `
          position: relative;
          background: white;
          border: 1px solid #ccc;
          border-radius: 5px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          padding: 0px;
          max-width: 600px;
          width: 100%;x
          max-height: 85vh;
          overflow-y: auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          animation: helpPopupFadeIn 0.3s ease-out;
        `;
        
        // Add CSS animation for smooth entrance
        if (!document.getElementById('help-popup-styles')) {
          const styleSheet = document.createElement('style');
          styleSheet.id = 'help-popup-styles';
          styleSheet.textContent = `
            @keyframes helpPopupFadeIn {
              from {
                opacity: 0;
                transform: scale(0.9) translateY(-20px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
            .help-assistant-popup::-webkit-scrollbar {
              width: 8px;
            }
            .help-assistant-popup::-webkit-scrollbar-track {
              background: #f1f1f1;
              border-radius: 4px;
            }
            .help-assistant-popup::-webkit-scrollbar-thumb {
              background: #c1c1c1;
              border-radius: 4px;
            }
            .help-assistant-popup::-webkit-scrollbar-thumb:hover {
              background: #a8a8a8;
            }
          `;
          document.head.appendChild(styleSheet);
        }
        
        // Help popup content
        helpPopupElement.innerHTML = `
          <div class="help-assistant-content">
          <div class='logo-help-assistant'>
          
              <button class="help-close-btn">×</button>
            <svg width="106" height="106" viewBox="0 0 106 106" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M46.8453 51.1871C50.3017 54.5456 55.8264 54.5154 59.2455 51.0963L62.3685 47.9732C67.543 42.7988 75.9326 42.799 81.107 47.9735C83.5067 50.3732 84.7936 53.4644 84.9675 56.6058L88.9152 52.658C96.6769 44.8963 96.6769 32.3122 88.9152 24.5505C81.1535 16.7888 68.5694 16.7888 60.8077 24.5505L46.6518 38.7072C43.3339 42.1333 43.3374 47.5823 46.6625 51.0042L46.8453 51.1871Z" fill="#8969A5"/>
<path d="M77.9251 51.0377L78.0433 51.1559C81.4309 54.6069 81.4144 60.1488 77.9938 63.5794L77.9845 63.5887L55.2235 86.3496C53.9956 87.5776 52.0046 87.5776 50.7766 86.3496L17.0849 52.658C9.32325 44.8963 9.32325 32.3122 17.0849 24.5505C24.8466 16.7888 37.4308 16.7888 45.1924 24.5505L49.877 29.2351L43.6307 35.481C38.4563 40.6555 38.4563 49.0449 43.6307 54.2193C48.8052 59.3938 57.1946 59.3938 62.369 54.2194L65.4923 51.0965C68.9222 47.6666 74.471 47.647 77.9251 51.0377Z" fill="#A787C0"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M53.0008 26.1122L57.6858 21.4275C67.1723 11.941 82.553 11.941 92.0394 21.4275C101.526 30.914 101.526 46.2946 92.0394 55.7811L81.3524 66.4682L81.1249 66.6951C81.1194 66.7007 81.1138 66.7063 81.1082 66.7118L58.3472 89.4728C55.3944 92.4256 50.607 92.4256 47.6542 89.4728L13.9625 55.7811C4.47603 46.2946 4.47604 30.914 13.9625 21.4275C23.449 11.941 38.8296 11.941 48.3161 21.4275L53.0008 26.1122ZM55.2242 86.3497C53.9962 87.5777 52.0052 87.5777 50.7772 86.3497L17.0856 52.658C9.3239 44.8964 9.32391 32.3122 17.0856 24.5505C24.8472 16.7889 37.4314 16.7889 45.1931 24.5505L49.8777 29.2351L43.6314 35.4811C38.4569 40.6555 38.4569 49.0449 43.6314 54.2194C48.8058 59.3938 57.1952 59.3938 62.3696 54.2194L65.4929 51.0966C68.9425 47.6469 74.5355 47.6469 77.9851 51.0966C81.4316 54.5431 81.4347 60.1291 77.9944 63.5795C77.9913 63.5826 77.9882 63.5857 77.9851 63.5888L55.2242 86.3497ZM88.9164 52.658L84.9686 56.6058C84.7947 53.4645 83.5079 50.3733 81.1082 47.9735C75.9337 42.7991 67.5441 42.7989 62.3697 47.9733L59.2466 51.0963C55.797 54.546 50.204 54.546 46.7544 51.0963C43.3048 47.6467 43.3048 42.0537 46.7544 38.6041L60.8089 24.5505C68.5706 16.7889 81.1547 16.7889 88.9164 24.5505C96.6781 32.3122 96.6781 44.8964 88.9164 52.658Z" fill="white"/>
</svg>

          </div>
            <div class="help-header">
              <h3>Introducing Samaritan™ - Responsible AI across Laerdal products.</h3>
            </div>
            
            <div class="help-content">              
              <p>Samaritan enhances clarity, efficiency, and intelligence in our product portfolio, ensuring that our AI solutions align with our mission and are trustworthy, fair, compliant, and sustainable. Samaritan seamlessly integrates intelligence through various AI models tailored to meet your needs.</p>
            
              <div class="info-row">
                
                <strong><a href='https://life.laerdal.com/5d20fd236/p/920ebb-samaritan/b/080590' target="_blank" rel="noopener noreferrer">Learn more about Samaritan</a> 
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 10C19.4477 10 19 9.5523 19 9.00001V6.41441L12.7717 12.6428C12.3553 13.0591 11.7011 13.0801 11.3106 12.6896C10.9201 12.299 10.9411 11.6449 11.3574 11.2285L17.586 5.00001L15 5.00001C14.4477 5.00001 14 4.5523 14 4.00001C14 3.44773 14.4477 3.00001 15 3.00001L19.9953 3.00001L20 3C20.2527 3 20.4835 3.09373 20.6596 3.24833C20.6759 3.26254 20.6918 3.27739 20.7073 3.2929C20.7235 3.30911 20.739 3.32577 20.7538 3.34285C20.9071 3.51859 21 3.74845 21 4V9.00001C21 9.5523 20.5523 10 20 10Z" fill="#3294BA"/>
<path d="M5 6.00001C5 5.44773 5.44772 5.00001 6 5.00001H10C10.5523 5.00001 11 4.5523 11 4.00001C11 3.44773 10.5523 3.00001 10 3.00001H6C4.34315 3.00001 3 4.34316 3 6.00001V18C3 19.6569 4.34315 21 6 21H18C19.6569 21 21 19.6569 21 18V14C21 13.4477 20.5523 13 20 13C19.4477 13 19 13.4477 19 14V18C19 18.5523 18.5523 19 18 19H6C5.44772 19 5 18.5523 5 18V6.00001Z" fill="#3294BA"/>
</svg>
</strong>

                <a class="help-link">
                Close
              </a>
              </div>
             
              
            </div>
          </div>
        `;
        
        // Append popup to backdrop and backdrop to body
        backdropElement.appendChild(helpPopupElement);
        document.body.appendChild(backdropElement);
        
        // CRITICAL FIX: Prevent clicks inside help popup from closing main AI Assistant
        helpPopupElement.addEventListener('click', (event) => {
          event.stopPropagation();
        });
        
        // Also prevent mousedown events from bubbling to main popup's outside click handler
        helpPopupElement.addEventListener('mousedown', (event) => {
          event.stopPropagation();
        });
        
        // Prevent backdrop clicks from bubbling to main popup handlers
        backdropElement.addEventListener('click', (event) => {
          event.stopPropagation();
        });
        
        backdropElement.addEventListener('mousedown', (event) => {
          event.stopPropagation();
        });
        
        // Help popup close functionality
        const closeHelpPopup = () => {
          if (backdropElement && backdropElement.parentNode) {
            document.body.removeChild(backdropElement);
          }
          document.removeEventListener('mousedown', helpOutsideClickHandler);
          document.removeEventListener('keydown', helpEscapeHandler);
        };
        
        // Close button handler
        const closeBtn = helpPopupElement.querySelector('.help-close-btn');
        if (closeBtn) {
          closeBtn.onclick = closeHelpPopup;
        }
        const closeBtnBottom = helpPopupElement.querySelector('.help-link');
        if (closeBtnBottom) {
          // closeBtnBottom.onclick = closeHelpPopup;
            closeBtnBottom.onclick = closeHelpPopup;
            
        }
        
        // Outside click handler for help popup - close when clicking backdrop
        const helpOutsideClickHandler = (event) => {
          // Close only if clicking directly on the backdrop, not the popup content
          if (event.target === backdropElement) {
            closeHelpPopup();
          }
        };
        
        // Escape key handler
        const helpEscapeHandler = (event) => {
          if (event.key === 'Escape') {
            closeHelpPopup();
          }
        };
        
        // Add click handler to backdrop for outside clicks
        backdropElement.addEventListener('click', helpOutsideClickHandler);
        
        // Add escape key handler
        document.addEventListener('keydown', helpEscapeHandler);
        
        return helpPopupElement;
      };
      
      // Help Assistant button handler
      const helpAssistantBtn = panelElement.querySelector('.help-assistant');
      if (helpAssistantBtn) {
        helpAssistantBtn.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          createHelpAssistantPopup();
        };
        
        // Add hover effect for help assistant button
        helpAssistantBtn.style.cursor = 'pointer';
        helpAssistantBtn.onmouseover = () => {
          helpAssistantBtn.style.opacity = '0.7';
        };
        helpAssistantBtn.onmouseout = () => {
          helpAssistantBtn.style.opacity = '1';
        };
      }
      
      // Outside click handler - Enhanced to ignore clicks on help popup
      const outsideClickHandler = (event) => {
        const balloonEl = balloon.view.element;
        const helpPopup = document.querySelector('.help-assistant-popup');
        
        // Don't close main popup if clicking on help popup or inside balloon
        if (balloonEl && !balloonEl.contains(event.target) && 
            (!helpPopup || !helpPopup.contains(event.target))) {
          closePopup();
        }
      };

      // Define popup view
      const popupView = {
        element: panelElement,
        render() {},
        destroy() {}
      };

      editor.closePopup = closePopup;

      // Register toolbar button
      editor.ui.componentFactory.add('AIAssistant', locale => {
        const undoView = editor.ui.componentFactory.create('undo');
        const ButtonView = undoView.constructor;

        const button = new ButtonView(locale);
        button.set({
          label: 'Samaritan AI Assistance',
          icon: '<svg width="111" height="24" viewBox="0 0 111 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 10px auto 0 auto;"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.0487 11.5574C12.0356 11.571 12.0224 11.5844 12.0091 11.5978L8.6244 14.9824C7.7275 15.8794 6.2733 15.8794 5.3763 14.9824L-0.07069 9.5354C-2.02331 7.5828 -2.02331 4.417 -0.07069 2.4643C1.8818 0.5118 5.0473 0.5117 7 2.464C8.9526 0.5117 12.1182 0.5118 14.0707 2.4643C16.0233 4.417 16.0233 7.5828 14.0707 9.5354L12.0487 11.5574ZM8.1789 3.6429L5.7317 6.09C5.2436 6.5782 5.2436 7.3696 5.7317 7.8578C6.2199 8.3459 7.0113 8.3459 7.4995 7.8578L7.8843 7.473C9.0233 6.334 10.87 6.334 12.0091 7.473C12.3252 7.7892 12.5536 8.1599 12.6943 8.5548L12.8922 8.3569C14.1939 7.0552 14.1939 4.9446 12.8922 3.6429C11.5906 2.3412 9.4807 2.3415 8.1789 3.6429ZM10.8563 10.3927L9.885 11.3641C9.8778 11.3713 9.8708 11.3785 9.864 11.3859L7.4459 13.8039C7.1999 14.05 6.8009 14.05 6.5548 13.8039L1.10782 8.3569C-0.19393 7.0552 -0.19393 4.9446 1.10782 3.6429C2.40957 2.3411 4.5201 2.3411 5.8219 3.6429L4.5532 4.9115C3.4142 6.0505 3.4142 7.8973 4.5532 9.0363C5.6922 10.1753 7.539 10.1753 8.678 9.0363L9.0628 8.6515C9.5509 8.1634 10.3424 8.1634 10.8305 8.6515C11.3099 9.1309 11.3185 9.9028 10.8563 10.3927Z" transform="translate(7 2)" fill="url(#paint0_linear_ai)"/><path d="M27.8209 4.5784C27.7604 4.6992 27.689 4.7844 27.6066 4.8338C27.5297 4.8833 27.4363 4.908 27.3264 4.908C27.2165 4.908 27.0929 4.8668 26.9555 4.7844C26.8182 4.6965 26.6561 4.6003 26.4693 4.4959C26.2825 4.3916 26.0628 4.2982 25.81 4.2158C25.5628 4.1278 25.2689 4.0839 24.9282 4.0839C24.6205 4.0839 24.3513 4.1224 24.1206 4.1993C23.8953 4.2707 23.703 4.3723 23.5437 4.5042C23.3899 4.636 23.2745 4.7954 23.1976 4.9822C23.1207 5.1635 23.0822 5.364 23.0822 5.5838C23.0822 5.864 23.1591 6.0975 23.313 6.2843C23.4723 6.4711 23.6811 6.6304 23.9393 6.7623C24.1975 6.8941 24.4914 7.0122 24.8211 7.1166C25.1507 7.221 25.4859 7.3337 25.8265 7.4545C26.1726 7.5699 26.5105 7.7072 26.8402 7.8666C27.1698 8.0204 27.4637 8.2182 27.722 8.4599C27.9802 8.6962 28.1862 8.9874 28.3401 9.3335C28.4994 9.6796 28.579 10.0999 28.579 10.5944C28.579 11.1328 28.4856 11.6383 28.2988 12.1108C28.1175 12.5778 27.8483 12.9871 27.4912 13.3387C27.1396 13.6848 26.7083 13.9595 26.1974 14.1628C25.6864 14.3606 25.1013 14.4595 24.442 14.4595C24.0629 14.4595 23.6893 14.421 23.3212 14.3441C22.9531 14.2727 22.5987 14.1683 22.2581 14.031C21.9229 13.8936 21.607 13.7288 21.3104 13.5365C21.0192 13.3442 20.7582 13.1299 20.5274 12.8937L21.1703 11.8306C21.2307 11.7537 21.3021 11.6905 21.3845 11.641C21.4724 11.5861 21.5686 11.5586 21.673 11.5586C21.8103 11.5586 21.9587 11.6163 22.118 11.7317C22.2773 11.8416 22.4641 11.9652 22.6784 12.1025C22.8982 12.2399 23.1536 12.3662 23.4448 12.4816C23.7415 12.5915 24.0959 12.6464 24.5079 12.6464C25.1397 12.6464 25.6287 12.4981 25.9748 12.2014C26.321 11.8992 26.494 11.468 26.494 10.9076C26.494 10.5944 26.4144 10.3389 26.255 10.1411C26.1012 9.9433 25.8952 9.7785 25.637 9.6467C25.3787 9.5093 25.0848 9.3939 24.7552 9.3005C24.4255 9.2071 24.0904 9.1055 23.7497 8.9956C23.4091 8.8857 23.074 8.7539 22.7443 8.6C22.4147 8.4462 22.1207 8.2457 21.8625 7.9984C21.6043 7.7512 21.3955 7.4435 21.2362 7.0754C21.0824 6.7018 21.0054 6.2431 21.0054 5.6992C21.0054 5.2651 21.0906 4.8421 21.2609 4.43C21.4367 4.018 21.6894 3.6526 22.0191 3.3339C22.3542 3.0153 22.7635 2.7598 23.247 2.5675C23.7305 2.3752 24.2827 2.2791 24.9035 2.2791C25.6067 2.2791 26.255 2.389 26.8484 2.6087C27.4418 2.8285 27.9472 3.1362 28.3648 3.5317L27.8209 4.5784ZM36.7812 14.3276H35.8664C35.6741 14.3276 35.523 14.3002 35.4131 14.2452C35.3033 14.1848 35.2209 14.0667 35.1659 13.8909L34.9846 13.2893C34.7703 13.4815 34.5588 13.6519 34.35 13.8002C34.1468 13.943 33.9352 14.0639 33.7155 14.1628C33.4957 14.2617 33.2622 14.3359 33.015 14.3853C32.7677 14.4348 32.493 14.4595 32.1909 14.4595C31.8337 14.4595 31.5041 14.4128 31.2019 14.3194C30.8997 14.2205 30.6388 14.0749 30.419 13.8826C30.2047 13.6903 30.0372 13.4513 29.9163 13.1656C29.7954 12.8799 29.735 12.5475 29.735 12.1685C29.735 11.8498 29.8174 11.5366 29.9822 11.229C30.1525 10.9158 30.4327 10.6356 30.8228 10.3884C31.2129 10.1356 31.7321 9.9269 32.3804 9.762C33.0287 9.5972 33.8336 9.5038 34.7951 9.4818V8.9874C34.7951 8.4215 34.6742 8.0039 34.4324 7.7347C34.1962 7.46 33.8501 7.3227 33.3941 7.3227C33.0644 7.3227 32.7897 7.3611 32.5699 7.438C32.3502 7.515 32.1579 7.6029 31.9931 7.7018C31.8337 7.7952 31.6854 7.8803 31.548 7.9572C31.4107 8.0341 31.2596 8.0726 31.0948 8.0726C30.9574 8.0726 30.8393 8.0369 30.7404 7.9655C30.6415 7.894 30.5619 7.8061 30.5014 7.7018L30.1306 7.0507C31.103 6.1607 32.276 5.7156 33.6495 5.7156C34.144 5.7156 34.5835 5.7981 34.9681 5.9629C35.3582 6.1222 35.6878 6.3475 35.9571 6.6386C36.2263 6.9243 36.4296 7.2677 36.5669 7.6688C36.7098 8.0699 36.7812 8.5094 36.7812 8.9874V14.3276ZM32.8254 13.0585C33.0342 13.0585 33.2265 13.0393 33.4023 13.0008C33.5781 12.9624 33.7429 12.9047 33.8968 12.8277C34.0561 12.7508 34.2072 12.6574 34.35 12.5475C34.4984 12.4322 34.6467 12.2976 34.7951 12.1437V10.718C34.2017 10.7455 33.7045 10.7977 33.3034 10.8746C32.9078 10.946 32.5892 11.0394 32.3474 11.1548C32.1057 11.2702 31.9326 11.4048 31.8282 11.5586C31.7294 11.7124 31.6799 11.88 31.6799 12.0613C31.6799 12.4184 31.7843 12.6739 31.9931 12.8277C32.2073 12.9816 32.4848 13.0585 32.8254 13.0585ZM38.7827 14.3276V5.8722H40.0272C40.2909 5.8722 40.4639 5.9958 40.5463 6.2431L40.6782 6.8694C40.8265 6.7046 40.9804 6.5535 41.1397 6.4161C41.3045 6.2788 41.4776 6.1607 41.6589 6.0618C41.8457 5.9629 42.0435 5.886 42.2523 5.831C42.4665 5.7706 42.7 5.7404 42.9528 5.7404C43.4857 5.7404 43.9225 5.886 44.2631 6.1771C44.6092 6.4628 44.8675 6.8447 45.0378 7.3227C45.1696 7.0425 45.3345 6.8035 45.5322 6.6057C45.73 6.4024 45.947 6.2376 46.1833 6.1112C46.4195 5.9849 46.6695 5.8915 46.9332 5.831C47.2024 5.7706 47.4717 5.7404 47.7409 5.7404C48.2079 5.7404 48.6227 5.8118 48.9853 5.9546C49.3479 6.0975 49.6528 6.3063 49.9 6.581C50.1473 6.8557 50.3341 7.1908 50.4604 7.5864C50.5923 7.982 50.6582 8.4352 50.6582 8.9462V14.3276H48.6227V8.9462C48.6227 8.4077 48.5045 8.0039 48.2683 7.7347C48.0321 7.46 47.6859 7.3227 47.2299 7.3227C47.0211 7.3227 46.8261 7.3584 46.6448 7.4298C46.469 7.5012 46.3124 7.6056 46.1751 7.743C46.0432 7.8748 45.9388 8.0424 45.8619 8.2457C45.785 8.449 45.7465 8.6825 45.7465 8.9462V14.3276H43.7027V8.9462C43.7027 8.3803 43.5873 7.9682 43.3566 7.71C43.1313 7.4518 42.7962 7.3227 42.3512 7.3227C42.06 7.3227 41.7853 7.3968 41.527 7.5452C41.2743 7.688 41.0381 7.8858 40.8183 8.1385V14.3276H38.7827ZM59.2834 14.3276H58.3686C58.1763 14.3276 58.0252 14.3002 57.9153 14.2452C57.8055 14.1848 57.723 14.0667 57.6681 13.8909L57.4868 13.2893C57.2725 13.4815 57.061 13.6519 56.8522 13.8002C56.6489 13.943 56.4374 14.0639 56.2177 14.1628C55.9979 14.2617 55.7644 14.3359 55.5172 14.3853C55.2699 14.4348 54.9952 14.4595 54.693 14.4595C54.3359 14.4595 54.0063 14.4128 53.7041 14.3194C53.4019 14.2205 53.141 14.0749 52.9212 13.8826C52.7069 13.6903 52.5394 13.4513 52.4185 13.1656C52.2976 12.8799 52.2372 12.5475 52.2372 12.1685C52.2372 11.8498 52.3196 11.5366 52.4844 11.229C52.6547 10.9158 52.9349 10.6356 53.325 10.3884C53.7151 10.1356 54.2343 9.9269 54.8826 9.762C55.5309 9.5972 56.3358 9.5038 57.2972 9.4818V8.9874C57.2972 8.4215 57.1764 8.0039 56.9346 7.7347C56.6984 7.46 56.3523 7.3227 55.8963 7.3227C55.5666 7.3227 55.2919 7.3611 55.0721 7.438C54.8524 7.515 54.6601 7.6029 54.4953 7.7018C54.3359 7.7952 54.1876 7.8803 54.0502 7.9572C53.9129 8.0341 53.7618 8.0726 53.597 8.0726C53.4596 8.0726 53.3415 8.0369 53.2426 7.9655C53.1437 7.894 53.064 7.8061 53.0036 7.7018L52.6328 7.0507C53.6052 6.1607 54.7782 5.7156 56.1517 5.7156C56.6462 5.7156 57.0857 5.7981 57.4703 5.9629C57.8604 6.1222 58.19 6.3475 58.4593 6.6386C58.7285 6.9243 58.9317 7.2677 59.0691 7.6688C59.2119 8.0699 59.2834 8.5094 59.2834 8.9874V14.3276ZM55.3276 13.0585C55.5364 13.0585 55.7287 13.0393 55.9045 13.0008C56.0803 12.9624 56.2451 12.9047 56.399 12.8277C56.5583 12.7508 56.7094 12.6574 56.8522 12.5475C57.0006 12.4322 57.1489 12.2976 57.2972 12.1437V10.718C56.7039 10.7455 56.2067 10.7977 55.8056 10.8746C55.41 10.946 55.0914 11.0394 54.8496 11.1548C54.6079 11.2702 54.4348 11.4048 54.3304 11.5586C54.2315 11.7124 54.1821 11.88 54.1821 12.0613C54.1821 12.4184 54.2865 12.6739 54.4953 12.8277C54.7095 12.9816 54.987 13.0585 55.3276 13.0585ZM61.2849 14.3276V5.8722H62.4799C62.6887 5.8722 62.8343 5.9107 62.9167 5.9876C62.9991 6.0645 63.054 6.1964 63.0815 6.3832L63.2051 7.4051C63.5073 6.8831 63.8617 6.4711 64.2682 6.1689C64.6748 5.8667 65.1308 5.7156 65.6363 5.7156C66.0538 5.7156 66.3999 5.8118 66.6746 6.0041L66.4109 7.5287C66.3944 7.6276 66.3587 7.699 66.3038 7.743C66.2488 7.7814 66.1747 7.8006 66.0813 7.8006C65.9989 7.8006 65.8862 7.7814 65.7434 7.743C65.6005 7.7045 65.411 7.6853 65.1748 7.6853C64.7517 7.6853 64.3891 7.8034 64.0869 8.0396C63.7847 8.2704 63.5293 8.611 63.3205 9.0615V14.3276H61.2849ZM70.1805 5.8722V14.3276H68.1449V5.8722H70.1805ZM70.4854 3.4081C70.4854 3.5839 70.4497 3.7488 70.3783 3.9026C70.3068 4.0564 70.2107 4.191 70.0898 4.3064C69.9744 4.4218 69.8371 4.5152 69.6778 4.5866C69.5184 4.6525 69.3481 4.6855 69.1668 4.6855C68.991 4.6855 68.8234 4.6525 68.6641 4.5866C68.5103 4.5152 68.3757 4.4218 68.2603 4.3064C68.1449 4.191 68.0515 4.0564 67.9801 3.9026C67.9142 3.7488 67.8812 3.5839 67.8812 3.4081C67.8812 3.2268 67.9142 3.0565 67.9801 2.8972C68.0515 2.7378 68.1449 2.6005 68.2603 2.4851C68.3757 2.3697 68.5103 2.2791 68.6641 2.2132C68.8234 2.1417 68.991 2.106 69.1668 2.106C69.3481 2.106 69.5184 2.1417 69.6778 2.2132C69.8371 2.2791 69.9744 2.3697 70.0898 2.4851C70.2107 2.6005 70.3068 2.7378 70.3783 2.8972C70.4497 3.0565 70.4854 3.2268 70.4854 3.4081ZM75.265 14.4595C74.5343 14.4595 73.9711 14.2535 73.5756 13.8414C73.18 13.4239 72.9822 12.8497 72.9822 12.119V7.3968H72.1251C72.0152 7.3968 71.9191 7.3611 71.8367 7.2897C71.7598 7.2183 71.7213 7.1111 71.7213 6.9683V6.1607L73.0811 5.9382L73.5096 3.6306C73.5316 3.5207 73.5811 3.4356 73.658 3.3752C73.7404 3.3147 73.842 3.2845 73.9629 3.2845H75.0178V5.9464H77.2429V7.3968H75.0178V11.9789C75.0178 12.2426 75.0837 12.4487 75.2156 12.597C75.3474 12.7453 75.5232 12.8195 75.743 12.8195C75.8694 12.8195 75.9737 12.8058 76.0562 12.7783C76.1441 12.7453 76.2182 12.7124 76.2787 12.6794C76.3446 12.6464 76.4023 12.6162 76.4517 12.5888C76.5012 12.5558 76.5506 12.5393 76.6001 12.5393C76.6605 12.5393 76.71 12.5558 76.7484 12.5888C76.7869 12.6162 76.8281 12.6602 76.872 12.7206L77.4819 13.7096C77.1852 13.9568 76.8446 14.1436 76.46 14.2699C76.0754 14.3963 75.6771 14.4595 75.265 14.4595ZM85.4876 14.3276H84.5729C84.3806 14.3276 84.2295 14.3002 84.1196 14.2452C84.0097 14.1848 83.9273 14.0667 83.8724 13.8909L83.6911 13.2893C83.4768 13.4815 83.2653 13.6519 83.0565 13.8002C82.8532 13.943 82.6417 14.0639 82.4219 14.1628C82.2022 14.2617 81.9687 14.3359 81.7214 14.3853C81.4742 14.4348 81.1995 14.4595 80.8973 14.4595C80.5402 14.4595 80.2106 14.4128 79.9084 14.3194C79.6062 14.2205 79.3452 14.0749 79.1255 13.8826C78.9112 13.6903 78.7436 13.4513 78.6228 13.1656C78.5019 12.8799 78.4415 12.5475 78.4415 12.1685C78.4415 11.8498 78.5239 11.5366 78.6887 11.229C78.859 10.9158 79.1392 10.6356 79.5293 10.3884C79.9194 10.1356 80.4386 9.9269 81.0869 9.762C81.7352 9.5972 82.54 9.5038 83.5015 9.4818V8.9874C83.5015 8.4215 83.3806 8.0039 83.1389 7.7347C82.9027 7.46 82.5565 7.3227 82.1005 7.3227C81.7709 7.3227 81.4962 7.3611 81.2764 7.438C81.0566 7.515 80.8643 7.6029 80.6995 7.7018C80.5402 7.7952 80.3919 7.8803 80.2545 7.9572C80.1172 8.0341 79.9661 8.0726 79.8012 8.0726C79.6639 8.0726 79.5458 8.0369 79.4469 7.9655C79.348 7.894 79.2683 7.8061 79.2079 7.7018L78.837 7.0507C79.8095 6.1607 80.9825 5.7156 82.356 5.7156C82.8505 5.7156 83.29 5.7981 83.6746 5.9629C84.0647 6.1222 84.3943 6.3475 84.6635 6.6386C84.9327 6.9243 85.136 7.2677 85.2734 7.6688C85.4162 8.0699 85.4876 8.5094 85.4876 8.9874V14.3276ZM81.5319 13.0585C81.7407 13.0585 81.9329 13.0393 82.1088 13.0008C82.2846 12.9624 82.4494 12.9047 82.6032 12.8277C82.7626 12.7508 82.9136 12.6574 83.0565 12.5475C83.2048 12.4322 83.3532 12.2976 83.5015 12.1437V10.718C82.9082 10.7455 82.4109 10.7977 82.0099 10.8746C81.6143 10.946 81.2956 11.0394 81.0539 11.1548C80.8122 11.2702 80.6391 11.4048 80.5347 11.5586C80.4358 11.7124 80.3864 11.88 80.3864 12.0613C80.3864 12.4184 80.4907 12.6739 80.6995 12.8277C80.9138 12.9816 81.1912 13.0585 81.5319 13.0585ZM87.4892 14.3276V5.8722H88.7336C88.9973 5.8722 89.1704 5.9958 89.2528 6.2431L89.3929 6.9106C89.5632 6.7348 89.7418 6.5755 89.9286 6.4326C90.1209 6.2898 90.3214 6.1662 90.5302 6.0618C90.7445 5.9574 90.9725 5.8777 91.2142 5.8228C91.4559 5.7678 91.7197 5.7404 92.0053 5.7404C92.4669 5.7404 92.8762 5.82 93.233 5.9794C93.59 6.1332 93.887 6.353 94.123 6.6386C94.365 6.9188 94.546 7.2567 94.667 7.6523C94.794 8.0424 94.857 8.4737 94.857 8.9462V14.3276H92.8212V8.9462C92.8212 8.4297 92.7003 8.0314 92.4586 7.7512C92.2224 7.4655 91.8652 7.3227 91.3873 7.3227C91.0356 7.3227 90.706 7.4023 90.3983 7.5617C90.0907 7.721 89.7995 7.938 89.5248 8.2127V14.3276H87.4892Z" fill="url(#paint1_linear_ai)"/><defs><linearGradient id="paint0_linear_ai" x1="-1.53516" y1="8.6637" x2="15.5352" y2="8.6637" gradientUnits="userSpaceOnUse"><stop stop-color="#AF50AF"/><stop offset="1" stop-color="#5F73BA"/></linearGradient><linearGradient id="paint1_linear_ai" x1="20" y1="8.3274" x2="96" y2="8.3274" gradientUnits="userSpaceOnUse"><stop stop-color="#AF50AF"/><stop offset="1" stop-color="#5F73BA"/></linearGradient></defs></svg>',
          tooltip: true,
          tooltipPosition: 'n',
          class: 'ai-button'
        });

        
        
        button.on('execute', () => {
          if (!balloon.hasView(popupView)) {
            // Show popup
            balloon.add({
              view: popupView,
              position: {
                target: () => {
                  // Prioritize the AI Commands button for positioning (since AIAssistant icon may be hidden)
                  const editorElement = editor.ui.view.element;
                  let targetButton = editorElement.querySelector('.ai-predefined-button');
                  // Fallback to AI Assistant button if present, then editable area
                  if (!targetButton) {
                    targetButton = editorElement.querySelector('.ai-button');
                  }
                  return targetButton || editor.ui.view.editable.element;
                },
                positions: [
                  // Position below the AI Assistant button with dynamic adjustment
                  (targetRect, balloonRect) => {
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    const balloonWidth = balloonRect.width;
                    const balloonHeight = balloonRect.height;
                    
                    // Calculate initial position
                    let top = targetRect.bottom + 25;
                    let left = targetRect.left;
                    
                    // Adjust horizontal position to keep balloon within viewport
                    // Check if balloon extends beyond right edge
                    if (left + balloonWidth > viewportWidth - 20) {
                      // Align to right edge with 20px margin
                      left = viewportWidth - balloonWidth - 20;
                    }
                    
                    // Check if balloon extends beyond left edge
                    if (left < 20) {
                      left = 20;
                    }
                    
                    // For small screens, center the balloon
                    if (viewportWidth < 540) {
                      left = (viewportWidth - balloonWidth) / 2;
                      if (left < 10) left = 10;
                    } else if (viewportWidth < 768) {
                      // For medium screens, ensure proper spacing
                      const maxLeft = viewportWidth - balloonWidth - 20;
                      left = Math.min(targetRect.left, maxLeft);
                      if (left < 20) left = 20;
                    }
                    
                    // Adjust vertical position if balloon extends beyond bottom
                    if (top + balloonHeight > viewportHeight - 20) {
                      // Try positioning above the button instead
                      const topPosition = targetRect.top - balloonHeight - 10;
                      if (topPosition > 20) {
                        top = topPosition;
                      } else {
                        // If not enough space above, position at top of viewport
                        top = 20;
                      }
                    }
                    
                    return {
                      top: top,
                      left: left,
                      name: 'below'
                    };
                  }
                ]
              }
            });

            // Add custom class to the balloon panel (parent .ck-balloon-panel)
            if (balloon.view && balloon.view.element) {
              balloon.view.element.classList.add('ai-assistant-balloon');
            }

           
            // Get selected text
            const selection = window.getSelection();
            const selectedText = selection.toString();

            let selectionCursor = editor.model.document.selection;
            let selectedTextCursor = '';

            for (let range of selectionCursor.getRanges()) {
              for (let item of range.getItems()) {
                if (item.is('textProxy')) {
                  selectedTextCursor += item.data;
                }
              }
            }
            
            if (selectedText.trim() === '') {
              // No selection: select the entire editor content for "select all" behavior
              try {
                editor.model.change(writer => {
                  const root = editor.model.document.getRoot();
                  const start = writer.createPositionAt(root, 0);
                  const end = writer.createPositionAt(root, 'end');
                  writer.setSelection(writer.createRange(start, end));
                });

                // Prefer full HTML for display to preserve formatting
                const fullHtml = (typeof editor.getData === 'function') ? editor.getData() : '';
                if (fullHtml && fullHtml.trim() !== '') {
                  $('.generatedResponse').html(fullHtml).attr('disabled', true).css('background', '#FAFAFA');
                } else {
                  // Fallback to plain text from model selection
                  const sel = editor.model.document.selection;
                  let fullSelectedText = '';
                  for (let range of sel.getRanges()) {
                    for (let item of range.getItems()) {
                      if (item.is('textProxy')) {
                        fullSelectedText += item.data;
                      }
                    }
                  }
                  $('.generatedResponse').text(fullSelectedText).attr('disabled', true).css('background', '#FAFAFA');
                }
              } catch (err) {
                console.error('Error selecting full editor content:', err);
                $('.generatedResponse').text(selectedTextCursor || '').attr('disabled', true).css('background', '#FAFAFA');
              }
            } else {
              $('.generatedResponse').html(selectedText).attr('disabled', true).css('background', '#FAFAFA');
            }        

            initializePopup(editor, selectedText);
            
            // Add window resize listener to reposition balloon
            const handleResize = () => {
              if (balloon.hasView(popupView)) {
                // Force balloon to recalculate its position
                balloon.updatePosition();
              }
            };
            
            window.addEventListener('resize', handleResize);
            
            // Clean up listener when balloon is hidden
            const originalRemove = balloon.remove.bind(balloon);
            balloon.remove = function(view) {
              window.removeEventListener('resize', handleResize);
              balloon.remove = originalRemove;
              return originalRemove(view);
            };
            
          } else {
            // Close popup
            closePopup();
          }
        });
        
        return button;
      });
      
      // Initialize popup with selected text
      function initializePopup(editor, selectedText) {
        // Handle selection
        if (selectedText) {          
          // Mark selection in the editor
          editor.model.change(writer => {
            const selection = editor.model.document.selection;
            const range = selection.getFirstRange();
           
            // Process the selection range
            const ranges = Array.from(selection.getRanges());

            // Iterate through each range in the selection
            for (const range of ranges) {
              if (range.isCollapsed) continue; // Skip empty selections

              // Get the positions for applying the wrapper
              const startPosition = range.start;
              const endPosition = range.end;
              
              // Create a range for the wrapper to be applied to
              const wrapRange = writer.createRange(startPosition, endPosition);
              
              // Apply a marker to the selected text
              const markerId = `selected-${Date.now()}`;
              writer.addMarker(markerId, {
                range: wrapRange,
                usingOperation: true,
                affectsData: true
              });
              
              // Convert the marker to a span with the ai-selected-text class in the view
              editor.conversion.for('editingDowncast').markerToHighlight({
                model: markerId,
                view: {
                  classes: 'ai-selected-text',
                  priority: 10
                }
              });
              
              editor.conversion.for('dataDowncast').markerToElement({
                model: markerId,
                view: {
                  name: 'span',
                  classes: 'ai-selected-text'
                }
              });
            }
            
          });
        }
        
        // Set up UI handlers
        setTimeout(() => {
          setupUIHandlers(editor, selectedText);
          document.addEventListener('mousedown', outsideClickHandler);
        }, 0);
      }
      
      // Set up UI handlers
      function setupUIHandlers(editor, selectedText) {

        const elements = {
          input: panelElement.querySelector('#assistantTextArea'),
          submitBtn: panelElement.querySelector('#assistantSubmitBtn'),
          insertBtn: panelElement.querySelector('#assistantInsertBtn'),
          replaceBtn: panelElement.querySelector('#assistantReplaceBtn'),
          dismissBtn: panelElement.querySelector('#assistantDismissBtn'),
          tryAgainBtn: panelElement.querySelector('#assistantTryAgainBtn'),
          loading: panelElement.querySelector('#loadingMsg'),
          response: panelElement.querySelector('.generatedResponse')
        };
        
        // Reset popup content
        elements.input.value = '';
        elements.loading.innerText = '';
        elements.loading.style.display = 'none';
        
        elements.submitBtn.style.display = 'inline-block';
        elements.submitBtn.disabled = false;
        elements.insertBtn.disabled = true;        
        elements.replaceBtn.disabled = true;
        elements.dismissBtn.disabled = true;
        elements.tryAgainBtn.disabled = true;
        
        // Add event handlers for predefined prompt buttons
        const promptButtons = panelElement.querySelectorAll('.ai-prompt-btn-inline');
        promptButtons.forEach(button => {
          button.onclick = async (event) => {
            const selectedPrompt = event.target.getAttribute('data-prompt');
            // For other predefined prompts, execute them directly
            if (selectedPrompt) {
              await executePredefinedPrompt(selectedPrompt, elements, editor);
            }
          };
        });

        // Execute predefined prompt function
        const executePredefinedPrompt = async (promptType, elements, editor) => {
          // Get selected text or current line text (same logic as AiPreDefinedPromptsPlugin)
          const selection = window.getSelection();
          let selectedText = selection.toString();
          
          // Check if the selection is empty and use the current cursor position
          if (!selectedText || selectedText.trim() === '') {
            // Use entire editor text when nothing is selected
            const fullText = getEditorPlainText(editor);
            if (fullText) selectedText = fullText;
          } else {
            let selectionCursor = editor.model.document.selection;
            let selectedTextCursor = '';

            for (let range of selectionCursor.getRanges()) {
              for (let item of range.getItems()) {
                if (item.is('textProxy')) {
                  selectedTextCursor += item.data;
                }
              }
            }
            selectedText = selectedTextCursor;
          }
          
          if (!selectedText) {
            alert('Please select some text or place the cursor on text to use this feature.');
            return;
          }
          
          // Get the predefined prompt instruction
          const promptInstruction = apiConfig.prompts[promptType] || apiConfig.prompts.spellChecker;
          
          // Show loading state
          elements.loading.innerHTML = 'Loading response from Samaritan <span class="dots"></span>';
          elements.loading.style.display = 'block';
          // elements.response.style.display = 'none';
                    
          try {
            // Get AI response using the predefined prompt
            const response = await getAIAssistantResponse(selectedText, promptInstruction);
            
            // Format and display response
            const formattedHTML = simpleMarkdownToHTML(response);
            
          
            // Show response
            elements.response.innerHTML = formattedHTML;
            elements.response.style.background = 'linear-gradient(90deg, #FBDBFB 0%, #E0E6FA 100%)';
            elements.response.style.border = '0px !important';
            elements.response.style.display = 'block';
            elements.loading.style.display = 'none';
            elements.insertBtn.disabled = false;
            elements.replaceBtn.disabled = false;
            elements.dismissBtn.disabled = false;
            elements.tryAgainBtn.disabled = false;
            elements.replaceBtn.style.display = 'inline-block';
            elements.tryAgainBtn.style.display = 'inline-block';
            elements.dismissBtn.style.display = 'inline-block';
            
            
            
            // Set up button handlers
            setupButtonHandler(elements, editor, response, promptInstruction, selectedText);
            
          } catch (err) {
            console.error('AI Assistant error:', err);
            elements.loading.innerText = 'Error fetching response. Please try again.';
          }
        };

        // Submit handler function
        const submitHandler = async () => {
          const prompt = elements.input.value.trim();
          if (!prompt || elements.submitBtn.disabled) return;
          
          // Show loading state
          elements.loading.innerHTML = 'Loading response from Samaritan <span class="dots"></span>';
          elements.loading.style.display = 'block';
          // elements.response.style.display = 'none';
          
          try {
            // Get selected text
            const selectedElements = document.querySelectorAll('.ai-selected-text');
            const selection = window.getSelection();
            const selectedText = selection.toString();
            
            // Collect all HTML content from selectedElements
            let selectedTextValue = '';
            if (selectedElements.length > 0) {
              selectedTextValue = Array.from(selectedElements).map(el => el.innerHTML).join('\n');
            }

            
            // Get AI response
            const response = await getAIAssistantResponse(
              selectedText || selectedTextValue, 
              prompt
            );
            
            // Format and display response
            const formattedHTML = simpleMarkdownToHTML(response);
            
           
            // Show response
            elements.response.innerHTML = formattedHTML;
            elements.response.style.display = 'block';
            elements.loading.style.display = 'none';
            elements.insertBtn.disabled = false;
            // elements.replaceBtn.disabled = !!((isCKEditorEmpty(editor) || selectedTextValue == ''));
            elements.tryAgainBtn.disabled = false;
            elements.dismissBtn.disabled = false;
            elements.replaceBtn.disabled = false;
            elements.replaceBtn.style.display = 'inline-block';
            elements.tryAgainBtn.style.display = 'inline-block';
            elements.dismissBtn.style.display = 'inline-block';

            $('.generatedResponse').css('background', 'linear-gradient(90deg, #FBDBFB 0%, #E0E6FA 100%)');
            $('#assistantTextArea').val('');
            // Set up button handlers
            // setupResponseButtons(elements, editor, response, prompt, selectedText || selectedTextValue);
            
          setupButtonHandler(elements, editor, response, prompt, selectedText || selectedTextValue);
          } catch (err) {
            console.error('AI Assistant error:', err);
            elements.loading.innerText = 'Error fetching response. Please try again.';
          }
        };
        
        // Add submit button click handler
        if (!elements.submitBtn._listenerAttached) {
          elements.submitBtn.addEventListener('click', submitHandler);

          elements.input.addEventListener('input', (event) => {
            const length = $(event.target).val().length;
            if (length !== 0) {
                $('.buttonSend').addClass('active');
            } else {
                $('.buttonSend').removeClass('active');
            }
          });
          
          // Add keyboard handler for Enter key
          elements.input.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey && !elements.submitBtn.disabled) {
              event.preventDefault();
              submitHandler();
            }
          });
          
          elements.submitBtn._listenerAttached = true;
        }
      }
    }

    // Set up response action buttons
      function setupButtonHandler(elements, editor, response, prompt, selectedText) {
        // Insert action
        elements.insertBtn.onclick = () => {
          if (!response) return;
          try {
            editor.model.change(() => {
            //  // Get the newly generated response content
                // Insert the AI response at the current selection/cursor position, preserving existing content
                const selection = editor.model.document.selection;
                const position = selection.getLastPosition();

                // Convert the AI response (markdown) to HTML, then to a CKEditor model fragment
                const htmlResponse = simpleMarkdownToHTML(response);
                const viewFragment = editor.data.processor.toView(htmlResponse);
                const modelFragment = editor.data.toModel(viewFragment);

                // Insert the model fragment at the current position
                editor.model.insertContent(modelFragment, position);
              // Clean up any selection markers
              cleanupSelectionMarkers(editor);
            });            
            
            // Clear any remaining selected text immediately
            document.querySelectorAll('.ai-selected-text').forEach(el => {
              if (el.parentNode) {
                // Replace the span with its text content
                el.parentNode.replaceChild(document.createTextNode(el.textContent), el);
              }
            });
            
            // Clear selection in the editor immediately
            editor.model.change(writer => {
              const root = editor.model.document.getRoot();
              if (root.childCount > 0) {
                const firstChild = root.getChild(0);
                if (firstChild && firstChild.childCount > 0) {
                  writer.setSelection(writer.createPositionAt(firstChild, 0));
                } else {
                  writer.setSelection(writer.createPositionAt(root, 0));
                }
              }
            });
            
            editor.closePopup();
            
          } catch (err) {
            console.error('Error inserting content:', err);
          }
        };
        
        // Replace action
        elements.replaceBtn.onclick = () => {
          if (!response) return;
          
          try {
            editor.model.change(writer => {
              // Find selected elements
              const selectedElements = document.querySelectorAll('.ai-selected-text');
              
              // Handle case where selectedText is empty or null
              let actualSelectedText = selectedText;
              if (!actualSelectedText || actualSelectedText.trim() === '') {
                // Use full editor text if nothing is selected (user requested whole textarea)
                const fullText = getEditorPlainText(editor);
                if (fullText) actualSelectedText = fullText;
              }
              
              // Get current selection from the editor
              const selection = editor.model.document.selection;
              
              if (selectedElements.length > 0 || !selection.isCollapsed) {
                
                // If we have a selection (either marked elements or current selection)
                if (selection.isCollapsed && selectedElements.length > 0) {
                  // Handle marked elements - find and select them in the model
                  const ranges = [];
                  for (const marker of editor.model.markers) {
                    if (marker.name && marker.name.startsWith('selected-')) {
                      ranges.push(marker.getRange());
                    }
                  }
                  
                  if (ranges.length > 0) {
                    // Select all marked ranges
                    writer.setSelection(ranges);
                  }
                }
                
                // Delete the selected content
                const deleteSelection = editor.model.document.selection;
                if (!deleteSelection.isCollapsed) {
                  editor.model.deleteContent(deleteSelection);
                  
                  // Insert the AI response at the current position
                  const htmlResponse = simpleMarkdownToHTML(response);
                  const viewFragment = editor.data.processor.toView(htmlResponse);
                  const modelFragment = editor.data.toModel(viewFragment);
                  editor.model.insertContent(modelFragment);
                }
                
              } else if (actualSelectedText) {
                if (process.env.NODE_ENV !== 'production') {
                  console.log('Replacing text at cursor position');
                }
                
                // No selection but we have text to replace - find and replace at cursor
                const position = selection.getLastPosition();
                const parent = position.parent;
                
                if (parent && parent.is('element', 'paragraph')) {
                  // Get the text content of the current paragraph
                  const textNode = parent.getChild(0);
                  if (textNode && textNode.is('$text')) {
                    const fullText = textNode.data;
                    const textToReplace = actualSelectedText.trim();
                    
                    // Find the text to replace in the paragraph
                    const replaceIndex = fullText.indexOf(textToReplace);
                    if (replaceIndex !== -1) {
                      // Create range for the text to replace
                      const startPos = writer.createPositionAt(parent, replaceIndex);
                      const endPos = writer.createPositionAt(parent, replaceIndex + textToReplace.length);
                      const replaceRange = writer.createRange(startPos, endPos);
                      
                      // Delete the old text
                      writer.remove(replaceRange);
                      
                      // Insert the AI response
                      const htmlResponse = simpleMarkdownToHTML(response);
                      const viewFragment = editor.data.processor.toView(htmlResponse);
                      const modelFragment = editor.data.toModel(viewFragment);
                      editor.model.insertContent(modelFragment, startPos);
                    }
                  }
                }
              }
              
              // Clean up selection markers
              cleanupSelectionMarkers(editor);
            });
            
            // Clear any remaining selected text immediately
            document.querySelectorAll('.ai-selected-text').forEach(el => {
              if (el.parentNode) {
                // Replace the span with its text content
                el.parentNode.replaceChild(document.createTextNode(el.textContent), el);
              }
            });
            
            // Clear selection in the editor immediately
            editor.model.change(writer => {
              const root = editor.model.document.getRoot();
              if (root.childCount > 0) {
                const firstChild = root.getChild(0);
                if (firstChild && firstChild.childCount > 0) {
                  writer.setSelection(writer.createPositionAt(firstChild, 0));
                } else {
                  writer.setSelection(writer.createPositionAt(root, 0));
                }
              }
            });
            
            editor.closePopup();
            
          } catch (err) {
            console.error('Error replacing content:', err);
          }
        };
        
        // Try again action
        elements.tryAgainBtn.onclick = async (e) => {
          e.preventDefault();
          
          // Get the content to retry with
          // Priority: 1) passed selectedText, 2) current generatedResponse content
          let contentToRetry = selectedText;
          
          if (!contentToRetry || contentToRetry.trim() === '') {
            // If no selectedText, try to get content from generatedResponse
            const generatedResponseEl = document.querySelector('.generatedResponse');
            if (generatedResponseEl) {
              contentToRetry = generatedResponseEl.innerText || generatedResponseEl.textContent;
            }
          }
          
          // If still no content, try to get from selected elements
          if (!contentToRetry || contentToRetry.trim() === '') {
            const selectedElements = document.querySelectorAll('.ai-selected-text');
            if (selectedElements.length > 0) {
              contentToRetry = Array.from(selectedElements).map(el => el.innerHTML).join('\n');
            }
          }
          
          // Validate we have both content and prompt
          if (!contentToRetry || contentToRetry.trim() === '' || !prompt) {
            console.error('Cannot retry: missing content or prompt', {
              contentToRetry: contentToRetry,
              prompt: prompt
            });
            elements.loading.innerText = 'Cannot retry: missing content or prompt';
            elements.loading.style.display = 'block';
            return;
          }

          // Show loading state
          elements.loading.innerHTML = 'Loading response from Samaritan <span class="dots"></span>';
          elements.loading.style.display = 'block';
          // elements.response.style.display = 'none';
          
          // Get new response using the content and prompt
          try {
            const newResponse = await getAIAssistantResponse(contentToRetry, prompt);
            
            // Display new response
            elements.response.innerHTML = simpleMarkdownToHTML(newResponse);
            response = newResponse; // Update response variable
            elements.response.style.display = 'block';
            elements.loading.style.display = 'none';
            
            // Ensure buttons remain enabled
            elements.insertBtn.disabled = false;
            elements.replaceBtn.disabled = false;
            elements.dismissBtn.disabled = false;
            elements.tryAgainBtn.disabled = false;
            
          } catch (err) {
            console.error('Error getting new response:', err);
            elements.loading.innerText = 'Error fetching response. Please try again.';
            elements.loading.style.display = 'block';
            elements.response.style.display = 'none';
          }
        };

        // Dismiss action
        elements.dismissBtn.onclick = () => {
          if (!response) return;        
          // Close the popup
          editor.closePopup();
        };
      }

      // Clean up selection markers
      function cleanupSelectionMarkers(editor) {
        try {
          // Remove markers from the model first
          const markersToRemove = [];
          for (const marker of editor.model.markers) {
            if (marker.name && marker.name.startsWith('selected-')) {
              markersToRemove.push(marker.name);
            }
          }
          
          // Remove markers using writer
          editor.model.change(writer => {
            markersToRemove.forEach(markerName => {
              writer.removeMarker(markerName);
            });
          });

          // Clean up DOM elements
          document.querySelectorAll('.ai-selected-text').forEach(element => {
            if (element && element.parentNode) {
              // Replace the element with its text content to preserve formatting context
              const textContent = element.textContent;
              const textNode = document.createTextNode(textContent);
              element.parentNode.replaceChild(textNode, element);
            }
          });
          
          // Force editor to refresh view
          editor.editing.view.change(writer => {
            writer.removeClass('ai-selected-text', editor.editing.view.document.getRoot());
          });
          
        } catch (err) {
          console.error('Error cleaning up selection markers:', err);
        }
      }
      
    // Configuration file for API related details
    const apiConfig = {
      openai: {
        endpoint: 'https://p-ais-ne-ais-adapt.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions',
        apiVersion: '2025-01-01-preview',
        apiKey: Origin.constants.ckEditorAIApiKey,
        model: 'gpt-4o-mini'
      },
      prompts: {
        ImproveWriting: 'Improve the writing quality of this text, maintaining exactly the same meaning and content.',
        makeShorter: 'Make this text shorter while preserving its complete meaning.',
        makeLonger: 'Make this text longer with relevant details while preserving its core meaning.',
        spellChecker: 'Check and correct spelling and grammar without changing the meaning. Return only the corrected text.'
      }
    };
    
     // API call function
    let getAIAssistantResponse = async (selectText, promptInstruction) => {
      if (typeof configData !== 'undefined' && typeof aiconfigJson !== 'undefined' && aiconfigJson.AiEnv) {
        configData.AiEnv = aiconfigJson.AiEnv;
        console.log('configData.AiEnv:', configData.AiEnv);
      }
      try {
        const response = await fetch(`${apiConfig.openai.endpoint}?api-version=${apiConfig.openai.apiVersion}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.openai.apiKey}`
          },
          body: JSON.stringify({
            model: apiConfig.openai.model,
            messages: [{
              role: 'user',
              content: selectText ? `${selectText}\n\nInstruction: ${promptInstruction}` : promptInstruction
            }]
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result || !result.choices || !Array.isArray(result.choices) || result.choices.length === 0) {
          throw new Error('Invalid API response structure');
        }
        
        if (!result.choices[0].message || !result.choices[0].message.content) {
          throw new Error('No content in API response');
        }
        
        return result.choices[0].message.content;
      } catch (error) {
        console.error('Error fetching AI response:', error);
        return 'Error fetching response. Please try again.';
      }
    };

    function simpleMarkdownToHTML(markdown) {
      let markDownToHtml = marked.parse(markdown);
      return markDownToHtml;
    }




    until(isAttached(this.$el)).then(() => {
      let ckEditorAIAssistantEnable = (Origin && Origin.constants && Origin.constants.ckEditorAIApiKey) ? true : false;
      return CKEDITOR.create(this.$el[0], {
        dataIndentationChars: "",
        disableNativeSpellChecker: false,
        versionCheck:false,
        enterMode: CKEDITOR[Origin.constants.ckEditorEnterMode],
        entities: false,
        extraPlugins: [ AiAgentPlugin, xmlToHtmlPlugin ],
        // htmlSupport: {
        //   // Convert all allow/disallow strings to regexp, as config is json only
        //   allow: convertStringsToRegExDeep((Origin.constants.ckEditorHtmlSupport && Origin.constants.ckEditorHtmlSupport.allow) || []),
        //   //disallow: convertStringsToRegExDeep((Origin.constants.ckEditorHtmlSupport && Origin.constants.ckEditorHtmlSupport.disallow) || [])
        // },
        htmlSupport: {
          allow: [
            {
              name: /.*/,
              attributes: true,
              classes: true,
              style: true,
              styles: true,
            },
          ],
        },
        on: {
          change: function () {
            this.trigger("change", this);
          }.bind(this),
          instanceReady: function() {
            var writer = this.dataProcessor.writer;
            var elements = Object.keys(CKEDITOR.dtd.$block);

            var rules = {
              indent: false,
              breakBeforeOpen: false,
              breakAfterOpen: false,
              breakBeforeClose: false,
              breakAfterClose: false,
            };

            writer.indentationChars = "";
            writer.lineBreakChars = "";
            elements.forEach(function (element) {
              writer.setRules(element, rules);
            });
          },
        },
        plugins: window.CKEDITOR.pluginsConfig,
        toolbar: {
          items: [
            "sourceEditing",
            "showBlocks",
            "undo",
            "redo",
            "|",
            "findAndReplace",
            "selectAll",
            "|",
            "numberedList",
            "bulletedList",
            "blockQuote",
            "indent",
            "outdent",
            "|",
            "bold",
            "italic",
            "underline",
            "strikethrough",
            "subscript",
            "superscript",
            "alignment",
            "removeFormat",
            "|",
            "link",
            "fontColor",
            "fontBackgroundColor",
            "|",
            "specialCharacters",
            "insertTable",
            "insertTableLayout",
            "uploadImage",
            "|",
            "xmlToHtmlConversion",
            ...(ckEditorAIAssistantEnable ? ["|", "AIAssistant"] : [])
          ],
          shouldNotGroupWhenFull: true,
        },
        table: {
          contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties', 'toggleTableCaption'],
        },
        tableCaptionPosition: 'bottom',
        image: {
          toolbar: [
            'toggleImageCaption',
            'imageTextAlternative',
            '|',
            'resizeImage'
          ],
          resizeOptions: [
            {
              name: 'resizeImage:original',
              label: 'Original',
              value: null
            },
            {
              name: 'resizeImage:50',
              label: '50%',
              value: '50'
            },
            {
              name: 'resizeImage:75',
              label: '75%',
              value: '75'
            }
          ]
        },
        link: {
          // Allow target="_blank" and rel attributes on links
          addTargetToExternalLinks: true,
          defaultProtocol: 'https://',
          // Enable all link decorators
          decorators: {
            openInNewTab: {
              mode: 'manual',
              label: 'Open in a new tab',
              attributes: {
                target: '_blank',
                rel: 'noopener noreferrer'
              }
            },
          }
        },
      }).then((editor) => {
        this.editor = editor;
        CKEDITOR.instances = CKEDITOR.instances || [];
        CKEDITOR.instances.length = CKEDITOR.instances.length || 0;
        this.editor.id = CKEDITOR.instances.length;
        CKEDITOR.instances.length++;
        CKEDITOR.instances[this.editor.id] = this.editor;
      });
    });
    return this;
  };

  // get data from ckeditor in textarea
  Backbone.Form.editors.TextArea.prototype.getValue = function() {
    return this.editor.getData();
  };

  // set value in ckeditor
  Backbone.Form.editors.TextArea.prototype.setValue = function(value) {
    textAreaSetValue.call(this, value);

    if (this.editor) {
      this.editor.setData(value);
    }
  };

  // ckeditor removal
  Backbone.Form.editors.TextArea.prototype.remove = function() {
    this.editor.stopListening()
    delete CKEDITOR.instances[this.editor.id]
  };

  // add override to allow prevention of validation
  Backbone.Form.prototype.validate = function(options) {
    var self = this,
        fields = this.fields,
        model = this.model,
        errors = {};

    options = options || {};

    //Collect errors from schema validation
    // passing in validate: false will stop validation of the backbone forms validators
    if (!options.skipModelValidate) {
      _.each(fields, function(field) {
        var error = field.validate();

        if (!error) return;

        var title = field.schema.title;

        if (title) {
            error.title = title;
        }

        errors[field.key] = error;
      });
    }

    //Get errors from default Backbone model validator
    if (!options.skipModelValidate && model && model.validate) {
      var modelErrors = model.validate(this.getValue());

      if (modelErrors) {
        var isDictionary = _.isObject(modelErrors) && !_.isArray(modelErrors);

        //If errors are not in object form then just store on the error object
        if (!isDictionary) {
          errors._others = errors._others || [];
          errors._others.push(modelErrors);
        }

        //Merge programmatic errors (requires model.validate() to return an object e.g. { fieldKey: 'error' })
        if (isDictionary) {
          _.each(modelErrors, function(val, key) {
            //Set error on field if there isn't one already
            if (fields[key] && !errors[key]) {
              fields[key].setError(val);
              errors[key] = val;
            }

            else {
              //Otherwise add to '_others' key
              errors._others = errors._others || [];
              var tmpErr = {};
              tmpErr[key] = val;
              errors._others.push(tmpErr);
            }
          });
        }
      }
    }

    return _.isEmpty(errors) ? null : errors;
  };

 // Limit the characters allowed in text input fields.
 Backbone.Form.editors.Text.prototype.events = {
  'keypress': function (event) {
    if (event.charCode === 0) {
      return;
    }
    // If the input is a text input field named 'courseid', limit its length to 30 characters
    if (this.$el[0].name === 'courseid' || this.$el[0].name === 'groupid') {

      // Get the whole new value so that we can prevent things like double decimals points etc.
      let newVal = this.$el.val()
      if (event.charCode != undefined) {
        newVal = newVal + String.fromCharCode(event.charCode);
      }
      // how to restrict special characters in text input fields and how show in the popup message

      let regex = new RegExp("^[a-zA-Z0-9-_]+$");
      let key = String.fromCharCode(!event.charCode ? event.which : event.charCode);
      if (!regex.test(key)) {
        event.preventDefault();
       Origin.Notify.alert({ type: 'error', text: 'Special characters are not allowed' });
      }

      if (newVal.length > 30) {
        // If the input exceeds 30 characters, prevent the character from being typed
        event && event.preventDefault();
        Origin.Notify.alert({ type: 'error', text: 'Exceed the character limit' });
      }
    }
  }
};

  // allow hyphen to be typed in number fields
  Backbone.Form.editors.Number.prototype.onKeyPress = function(event) {
    var self = this,
      delayedDetermineChange = function() {
        setTimeout(function() {
        self.determineChange();
      }, 0);
    };

    //Allow backspace
    if (event.charCode === 0) {
      delayedDetermineChange();
      return;
    }

    //Get the whole new value so that we can prevent things like double decimals points etc.
    var newVal = this.$el.val()
    if( event.charCode != undefined ) {
      newVal = newVal + String.fromCharCode(event.charCode);
    }

    var numeric = /^-?[0-9]*\.?[0-9]*?$/.test(newVal);

    if (numeric) {
      delayedDetermineChange();
    }
    else {
      event.preventDefault();
    }
  };

  // add listener to Select inputs with the "data-is-conditional" attribute
  Backbone.Form.editors.Select.prototype.initialize = function (options) {
    selectInitialize.call(this, options);
    this.on('change', updateConditionalView, this);
  };

  Backbone.Form.editors.Select.prototype.render = function() {
    selectRender.call(this);

    // Update view after the select has been rendered
    _.defer(updateConditionalView.bind(this));

    // Ensure DOM change events trigger Backbone change events for reset button visibility
    var self = this;
    this.$el.on('change', function() {
      // Trigger Backbone change event
      self.trigger('change', self);
      
      // Also manually update is-default-value class to ensure it updates immediately
      if (self.form && self.id && self.defaultValue !== undefined) {
        var currentValue = self.getValue();
        var isDefaultValue = _.isEqual(currentValue, self.defaultValue);
        var $field = self.$el.closest('[data-editor-id]');
        
        if ($field.length > 0) {
          $field.toggleClass('is-default-value', isDefaultValue);
        }
      }
    });
    
    // Set initial state after render
    _.defer(function() {
      if (self.form && self.id && self.defaultValue !== undefined) {
        try {
          var isDefaultValue = _.isEqual(self.getValue(), self.defaultValue);
          var $field = self.$el.closest('[data-editor-id]');
          if ($field.length > 0) {
            $field.toggleClass('is-default-value', isDefaultValue);
          }
        } catch (e) {
          // Ignore errors from editors that aren't fully initialized yet
        }
      }
    });

    return this;
  };

  Backbone.Form.editors.Checkbox.prototype.initialize = function (options) {
    checkboxInitialize.call(this, options);
    this.on('change', updateConditionalView, this);
  };

  Backbone.Form.editors.Checkbox.prototype.render = function() {
    checkboxRender.call(this);

    // Update view after the checkbox has been rendered
    _.defer(updateConditionalView.bind(this));

    // Ensure DOM change events trigger Backbone change events for reset button visibility
    var self = this;
    this.$el.on('change', function() {
      // Trigger Backbone change event
      self.trigger('change', self);
      
      // Also manually update is-default-value class
      if (self.form && self.id && self.defaultValue !== undefined) {
        var isDefaultValue = _.isEqual(self.getValue(), self.defaultValue);
        var $field = self.$el.closest('[data-editor-id]');
        if ($field.length > 0) {
          $field.toggleClass('is-default-value', isDefaultValue);
        }
      }
    });
    
    // Set initial state after render
    _.defer(function() {
      if (self.form && self.id && self.defaultValue !== undefined) {
        try {
          var isDefaultValue = _.isEqual(self.getValue(), self.defaultValue);
          var $field = self.$el.closest('[data-editor-id]');
          if ($field.length > 0) {
            $field.toggleClass('is-default-value', isDefaultValue);
          }
        } catch (e) {
          // Ignore errors from editors that aren't fully initialized yet
        }
      }
    });

    return this;
  };

  // If a radio, select, or checkbox input has the data-is-conditional attribute, then show/hide the relevant fields
  function updateConditionalView() {

    const editorAttrs = this.schema.editorAttrs;
    if (!editorAttrs) return;
  
    if (editorAttrs['data-is-conditional']) {
      const currentOption = this.getValue();
      if (this instanceof Backbone.Form.editors.Checkbox) {
        $(`[data-depends-on=${this.key}]`).toggle(currentOption);
      } else {
        $(`[data-depends-on=${this.key}]`).toggle(false);
        $(`[data-depends-on=${this.key}][data-option-match=${currentOption}]`).toggle(true);
      }
    }
  }
});
