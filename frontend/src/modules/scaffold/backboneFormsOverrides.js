define([
  'core/origin',
  'backbone-forms',
  'libraries/marked.min.js'
], function(Origin, BackboneForms, marked) {

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

  // add reset to default handler
  Backbone.Form.Field.prototype.events = {
    'click [data-action="default"]': function() {
      this.setValue(this.editor.defaultValue);
      this.editor.trigger('change', this);

      return false;
    }
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
  };

  // disable automatic completion on text fields if not specified
  Backbone.Form.editors.Text.prototype.initialize = function(options) {
    textInitialize.call(this, options);

    if (!this.$el.attr('autocomplete')) {
      this.$el.attr('autocomplete', 'off');
    }
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

   
    // AI Command predefined prompts
    function AiPreDefinedPromptsPlugin(editor) {
      const balloon = editor.plugins.get('ContextualBalloon');
      
      // DOM panel
      const panelElement = document.createElement('div');
      panelElement.classList.add('ai-agent-popup-select');
            
      // Initialize panel HTML
      panelElement.innerHTML = `
        <div class="AiAgent">
          <select class="ai-select-prompt" id="aiSelectPrompt">
            <option value="select" selected disabled hidden>Select a prompt</option>            
            <option value="generateAI">Generate Content</option>
            <option value="ImproveWriting">Improve Writing</option>
            <option value="makeShorter">Make Shorter</option>
            <option value="makeLonger">Make Longer</option>
            <option value="spellChecker">Spell Checker</option>
          </select>
        </div>
      `;
      
      // Define close popup functionality
      const closePopup = () => {
        if (balloon.hasView(popupView)) {
          balloon.remove(popupView);
          document.removeEventListener('mousedown', outsideClickHandler);
          
          // Reset select element to default
          const selectElement = panelElement.querySelector('#aiSelectPrompt');
          if (selectElement) selectElement.value = 'select';
        }
      };
      
      // Outside click handler
      const outsideClickHandler = (event) => {
        if (balloon.view.element && !balloon.view.element.contains(event.target)) {
          closePopup();
        }
      };

      // Define popup view
      const popupView = {
        element: panelElement,
        render() {
          panelElement.querySelector('#aiSelectPrompt').onchange = async (event) => {
            const selectedPrompt = event.target.value;
            if (selectedPrompt === 'generateAI') {
              // Find and trigger the AI Assistant button for this editor
              const editorElement = editor.ui.view.element;
              const aiButton = editorElement.querySelector('.ai-button');
              if (aiButton) {
                aiButton.click();
              }
              closePopup();
              return;
            }
            if (selectedPrompt !== 'select') {
              await AIPreDefinedPrompt(selectedPrompt, balloon, editor);
              closePopup();
            }
          };
          panelElement.querySelector('#aiSelectPrompt').onchange = async (event) => {
            const selectedPrompt = event.target.value;

            // If user picked "Generate AI", open the AIAssistant popup programmatically.
            // This avoids needing the visible toolbar button DOM element.
            if (selectedPrompt === 'generateAI') {
              const selection = window.getSelection();
              const selectedText = selection ? selection.toString() : '';

              // If the AIAssistant component is available, create and execute it.
              // Otherwise fallback to trying to open via launchAIAssistant.
              if (editor.ui && editor.ui.componentFactory && editor.ui.componentFactory.has && editor.ui.componentFactory.has('AIAssistant')) {
                const command = editor.ui.componentFactory.create('AIAssistant');
                command.fire('execute');
              } else {
                // Fallback: use launchAIAssistant (already defined in this plugin)
                await launchAIAssistant(editor, selectedText, '');
              }

              closePopup();
              return;
            }

            if (selectedPrompt !== 'select') {
              await AIPreDefinedPrompt(selectedPrompt, balloon, editor);
              closePopup();
            }
          };
        },
        destroy() {}
      };      
      
      // Handle predefined prompts
      async function AIPreDefinedPrompt(promptType, balloon, editor) {
        const selection = window.getSelection();
        let selectedText = selection.toString();
        // Check if the selection is empty and use the current cursor position
        if(selectedText == '' || selectedText == null) {
            // Get the cursor position information
            const selectionCursor = editor.model.document.selection;
            const cursorPosition = selectionCursor.getLastPosition();
            let cursorLine = null;
            const viewPosition = editor.editing.mapper.toViewPosition(cursorPosition);
            const domPosition = editor.editing.view.domConverter.viewPositionToDom(viewPosition);
            if (domPosition && domPosition.parent) {
              cursorLine = domPosition.parent;
            }

            // Check if we have either selected text or a cursor position
            if ((!selectedText || selectedText.trim() === '') && cursorLine) {
              // If no selection but we have a cursor line, get text from current paragraph/element
              const currentLineText = cursorLine.textContent || '';
              if (currentLineText.trim() !== '') {
                // Use the current line text instead                
                selectedText = currentLineText;
              }
            }
          }
        
        if (!selectedText) return;
        
        const promptInstruction = apiConfig.prompts[promptType] || apiConfig.prompts.spellChecker;
        
        // Launch AI Assistant with the selected prompt
        await launchAIAssistant(editor, selectedText, promptInstruction);
      }
      
      // Launch AI Assistant
      async function launchAIAssistant(editor, selectedText, promptInstruction) {
        if (!editor.ui.componentFactory.has('AIAssistant')) return;
        
        const command = editor.ui.componentFactory.create('AIAssistant');
        command.fire('execute');
        
        setTimeout(async () => {
          const panelElement = document.querySelector('.ai-agent-popup-panel');
          if (!panelElement) return;
          
          const elements = {
            input: panelElement.querySelector('#assistantTextArea'),
            submitBtn: panelElement.querySelector('#assistantSubmitBtn'),
            insertBtn: panelElement.querySelector('#assistantInsertBtn'),
            replaceBtn: panelElement.querySelector('#assistantReplaceBtn'),
            tryAgainBtn: panelElement.querySelector('#assistantTryAgainBtn'),
            loading: panelElement.querySelector('#loadingMsg'),
            response: panelElement.querySelector('.generatedResponse')
          };
          
          // Show loading state
          elements.input.value = '';
          elements.input.disabled = true;
          elements.loading.innerText = 'Loading response from Samaritan...';
          elements.loading.style.display = 'block';
          elements.submitBtn.style.display = 'none';
          // Only show .aiTitle if it exists, otherwise do nothing
          let $aiTitle = $('.aiTitle');
          if ($aiTitle.length) {
            $aiTitle.hide();
          }
          // Get AI response
          const response = await getAIAssistantResponse(selectedText, promptInstruction);
          
          // Process and display response
          const formattedHTML = simpleMarkdownToHTML(response);
          elements.response.style.display = 'block';
          elements.insertBtn.disabled = false;          
          elements.replaceBtn.disabled = false;
          elements.insertBtn.style.display = 'inline-block';
          elements.tryAgainBtn.style.display = 'none';
          elements.replaceBtn.style.display = 'inline-block';

          // Add title
            // Remove any existing .aiTitle before adding a new one
            const prevTitle = elements.response.previousElementSibling;
            if (prevTitle && prevTitle.classList && prevTitle.classList.contains('aiTitle')) {
              prevTitle.remove();
            }
            elements.response.insertAdjacentHTML('beforebegin', '<h1 class="aiTitle">AI Response</h1>');
          
          // Display formatted response
          $('.aiTitle').show();
          elements.response.innerHTML = formattedHTML;
          elements.loading.style.display = 'none';
          
          // Setup button handlers
          setupButtonHandler(elements, editor, response, promptInstruction, selectedText);
        }, 100);
      }
      
      // Register toolbar button
      editor.ui.componentFactory.add('AIPreDefinedPromptsOption', locale => {
        const undoView = editor.ui.componentFactory.create('undo');
        const ButtonView = undoView.constructor;
        
        const button = new ButtonView(locale);
        button.set({
          label: 'Samaritan Laerdal AI Assistant',
          icon: '<svg viewBox="0 0 54 48" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M21 5.8244L23.1215 3.70303C27.4172 -0.59274 34.3821 -0.59274 38.6778 3.70303C42.9736 7.99879 42.9736 14.9636 38.6778 19.2594L33.8384 24.0988L33.7354 24.2015C33.7329 24.2041 33.7303 24.2066 33.7278 24.2092L23.421 34.516C22.0839 35.8531 19.9159 35.8531 18.5788 34.516L3.32223 19.2594C-0.973539 14.9636 -0.973539 7.99879 3.32223 3.70303C7.618 -0.59274 14.5828 -0.592741 18.8786 3.70303L21 5.8244ZM22.0068 33.1018C21.4507 33.6578 20.5491 33.6578 19.993 33.1018L4.73644 17.8452C1.22172 14.3304 1.22172 8.63196 4.73644 5.11724C8.25116 1.60252 13.9496 1.60252 17.4644 5.11724L19.5857 7.23857L16.7572 10.0669C14.414 12.4101 14.414 16.209 16.7572 18.5522C19.1003 20.8953 22.8993 20.8953 25.2424 18.5522L26.6567 17.1381C28.2188 15.576 30.7515 15.576 32.3136 17.1381C33.8743 18.6988 33.8757 21.2283 32.3178 22.7907C32.3164 22.7921 32.315 22.7935 32.3136 22.7949L22.0068 33.1018ZM37.2636 17.8452L35.4759 19.6328C35.3972 18.2103 34.8145 16.8105 33.7278 15.7239C31.3847 13.3807 27.5856 13.3806 25.2425 15.7238L23.8282 17.138C22.2661 18.7001 19.7335 18.7001 18.1714 17.138C16.6093 15.5759 16.6093 13.0432 18.1714 11.4811L24.5357 5.11724C28.0504 1.60252 33.7489 1.60252 37.2636 5.11724C40.7783 8.63196 40.7783 14.3304 37.2636 17.8452Z"/></svg>',
          tooltip: true,
          tooltipPosition: 'n',
          class: 'ai-predefined-button'
        });
        
        button.on('execute', () => {
          if (!balloon.hasView(popupView)) {
            balloon.add({
              view: popupView,
              position: {
                target: () => {
                  // Find the AI Predefined button element for THIS specific editor
                  const editorElement = editor.ui.view.element;
                  const aiButton = editorElement.querySelector('.ai-predefined-button');
                  return aiButton || editor.ui.view.editable.element;
                },
                positions: [
                  // Position below the AI Assistant button
                  (targetRect, balloonRect) => ({
                    top: targetRect.bottom + 25,
                    left: targetRect.left,
                    name: 'below'
                  })
                ]
              }
            });
            document.addEventListener('mousedown', outsideClickHandler);
          } else {
            closePopup();
          }
        });
        
        return button;
      });
   
    }

    
      // Check if editor is empty
      function isCKEditorEmpty(editor) {
        const data = editor.getData().replace(/\s/g, '');
        const emptyPatterns = ['', '<p></p>', '<p>&nbsp;</p>', '<p><br></p>', '<div></div>', '<div>&nbsp;</div>', '<div><br></div>'];
        return !data || emptyPatterns.includes(data) || data.replace(/<p>(&nbsp;|<br>|)<\/p>/g, '').length === 0;
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
          <label><svg width="22" height="18" viewBox="0 0 42 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 5.8244L23.1215 3.70303C27.4172 -0.59274 34.3821 -0.59274 38.6778 3.70303C42.9736 7.99879 42.9736 14.9636 38.6778 19.2594L33.8384 24.0988L33.7354 24.2015C33.7329 24.2041 33.7303 24.2066 33.7278 24.2092L23.421 34.516C22.0839 35.8531 19.9159 35.8531 18.5788 34.516L3.32223 19.2594C-0.973539 14.9636 -0.973539 7.99879 3.32223 3.70303C7.618 -0.59274 14.5828 -0.592741 18.8786 3.70303L21 5.8244ZM22.0068 33.1018C21.4507 33.6578 20.5491 33.6578 19.993 33.1018L4.73644 17.8452C1.22172 14.3304 1.22172 8.63196 4.73644 5.11724C8.25116 1.60252 13.9496 1.60252 17.4644 5.11724L19.5857 7.23857L16.7572 10.0669C14.414 12.4101 14.414 16.209 16.7572 18.5522C19.1003 20.8953 22.8993 20.8953 25.2424 18.5522L26.6567 17.1381C28.2188 15.576 30.7515 15.576 32.3136 17.1381C33.8743 18.6988 33.8757 21.2283 32.3178 22.7907C32.3164 22.7921 32.315 22.7935 32.3136 22.7949L22.0068 33.1018ZM37.2636 17.8452L35.4759 19.6328C35.3972 18.2103 34.8145 16.8105 33.7278 15.7239C31.3847 13.3807 27.5856 13.3806 25.2425 15.7238L23.8282 17.138C22.2661 18.7001 19.7335 18.7001 18.1714 17.138C16.6093 15.5759 16.6093 13.0432 18.1714 11.4811L24.5357 5.11724C28.0504 1.60252 33.7489 1.60252 37.2636 5.11724C40.7783 8.63196 40.7783 14.3304 37.2636 17.8452Z" fill="#1A1A1A"/></svg>
Samaritan Laerdal AI Assistant</label><br>
          <textarea id="assistantTextArea" placeholder="Ask Samaritan to edit or generate"></textarea>
          <div id="loadingMsg"></div>
          <div class='generatedResponse'></div>
          <div class="aiButtons">
            <button class="btnAiAgent buttonSend" id="assistantSubmitBtn">Submit</button>
            <button class="btnAiAgent buttonInsert" disabled id="assistantInsertBtn">Insert</button>
            <button class="btnAiAgent buttonReplace" disabled id="assistantReplaceBtn">Replace</button>
            <button class="btnAiAgent buttonTryAgain" disabled id="assistantTryAgainBtn">Try Again</button>
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
        panelElement.querySelector('#assistantTextArea').disabled = false;
        document.removeEventListener('mousedown', outsideClickHandler);
      };
      
      // Close button handler
      panelElement.querySelector('#closePopup').onclick = closePopup;
      
      // Outside click handler
      const outsideClickHandler = (event) => {
        const balloonEl = balloon.view.element;
        if (balloonEl && !balloonEl.contains(event.target)) {
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
          label: 'AI Assistant',
          icon: '<svg viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title></title> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="icon" fill="#000000"> <path d="M320,64 L320,320 L64,320 L64,64 L320,64 Z M171.749388,128 L146.817842,128 L99.4840387,256 L121.976629,256 L130.913039,230.977 L187.575039,230.977 L196.319607,256 L220.167172,256 L171.749388,128 Z M260.093778,128 L237.691519,128 L237.691519,256 L260.093778,256 L260.093778,128 Z M159.094727,149.47526 L181.409039,213.333 L137.135039,213.333 L159.094727,149.47526 Z M341.333333,256 L384,256 L384,298.666667 L341.333333,298.666667 L341.333333,256 Z M85.3333333,341.333333 L128,341.333333 L128,384 L85.3333333,384 L85.3333333,341.333333 Z M170.666667,341.333333 L213.333333,341.333333 L213.333333,384 L170.666667,384 L170.666667,341.333333 Z M85.3333333,0 L128,0 L128,42.6666667 L85.3333333,42.6666667 L85.3333333,0 Z M256,341.333333 L298.666667,341.333333 L298.666667,384 L256,384 L256,341.333333 Z M170.666667,0 L213.333333,0 L213.333333,42.6666667 L170.666667,42.6666667 L170.666667,0 Z M256,0 L298.666667,0 L298.666667,42.6666667 L256,42.6666667 L256,0 Z M341.333333,170.666667 L384,170.666667 L384,213.333333 L341.333333,213.333333 L341.333333,170.666667 Z M0,256 L42.6666667,256 L42.6666667,298.666667 L0,298.666667 L0,256 Z M341.333333,85.3333333 L384,85.3333333 L384,128 L341.333333,128 L341.333333,85.3333333 Z M0,170.666667 L42.6666667,170.666667 L42.6666667,213.333333 L0,213.333333 L0,170.666667 Z M0,85.3333333 L42.6666667,85.3333333 L42.6666667,128 L0,128 L0,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg>',
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
                  // Position below the AI Assistant button
                  (targetRect, balloonRect) => ({
                    top: targetRect.bottom + 25,
                    left: targetRect.left,
                    name: 'below'
                  })
                ]
              }
            });
            
            // Get selected text
            const selection = window.getSelection();
            const selectedText = selection.toString();
            
            // Initialize popup with selected text
            initializePopup(editor, selectedText);
            
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
          tryAgainBtn: panelElement.querySelector('#assistantTryAgainBtn'),
          loading: panelElement.querySelector('#loadingMsg'),
          response: panelElement.querySelector('.generatedResponse')
        };
        
        // Reset popup content
        elements.input.value = '';
        elements.loading.innerText = '';
        elements.loading.style.display = 'none';
        elements.response.innerHTML = '';
        elements.response.style.display = 'none';
        
        elements.submitBtn.style.display = 'inline-block';
        elements.submitBtn.disabled = false;
        elements.insertBtn.disabled = true;        
        elements.replaceBtn.disabled = true;
        elements.tryAgainBtn.disabled = true;
        
        // Submit handler function
        const submitHandler = async () => {
          const prompt = elements.input.value.trim();
          if (!prompt || elements.submitBtn.disabled) return;
          
          // Show loading state
          elements.loading.innerText = 'Loading response from Samaritan...';
          elements.loading.style.display = 'block';
          elements.submitBtn.disabled = true;
          elements.response.style.display = 'none';
          
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

            let $aiTitle = $('.aiTitle');
            if ($aiTitle.length) {
              $aiTitle.hide();
            }
            
            // Get AI response
            const response = await getAIAssistantResponse(
              selectedText || selectedTextValue, 
              prompt
            );
            
            // Format and display response
            const formattedHTML = simpleMarkdownToHTML(response);
            
            // Add title
            // Remove any existing .aiTitle before adding a new one
            const prevTitle = elements.response.previousElementSibling;
            if (prevTitle && prevTitle.classList && prevTitle.classList.contains('aiTitle')) {
              prevTitle.remove();
            }
            elements.response.insertAdjacentHTML('beforebegin', '<h1 class="aiTitle">AI Response</h1>');
            
            // Show response
            elements.response.innerHTML = formattedHTML;
            elements.response.style.display = 'block';
            elements.input.disabled = true;
            elements.loading.style.display = 'none';
            elements.insertBtn.disabled = false;
            elements.replaceBtn.disabled = !!((isCKEditorEmpty(editor) || selectedTextValue == ''));
            elements.tryAgainBtn.disabled = false;
            elements.replaceBtn.style.display = 'inline-block';
            elements.tryAgainBtn.style.display = 'inline-block';
            
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

    // XML to HTML Conversion Plugin with XSLT support

function xmlToHtmlPlugin(editor) {
  const balloon = editor.plugins.get('ContextualBalloon');

  // XSLT Stylesheet for Paligo DocBook → HTML Conversion
  const xsltStylesheet = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:db="http://docbook.org/ns/docbook"
    xmlns:xl="http://www.w3.org/1999/xlink"
    exclude-result-prefixes="db xl">

  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <!-- Root: support article or section -->
  <xsl:template match="/">
    <div class="docbook-content">
      <xsl:apply-templates select="db:article | db:section"/>
    </div>
  </xsl:template>

  <!-- Section -->
  <xsl:template match="db:section">
    <section>
      <xsl:apply-templates/>
    </section>
  </xsl:template>

  <!-- Title -->
  <xsl:template match="db:title">
    <h2><xsl:apply-templates/></h2>
  </xsl:template>

  <!-- Paragraphs -->
  <xsl:template match="db:para | db:simpara">
    <p><xsl:apply-templates/></p>
  </xsl:template>

  <!-- Procedure / Steps -->
  <xsl:template match="db:procedure">
    <ol class="procedure">
      <xsl:apply-templates select="db:step"/>
    </ol>
  </xsl:template>

  <xsl:template match="db:step">
    <li class="step"><xsl:apply-templates/></li>
  </xsl:template>

  <!-- Lists -->
  <xsl:template match="db:itemizedlist">
    <ul><xsl:apply-templates/></ul>
  </xsl:template>

  <xsl:template match="db:listitem">
    <li><xsl:apply-templates/></li>
  </xsl:template>

  <!-- Emphasis -->
  <xsl:template match="db:emphasis">
    <xsl:choose>
      <xsl:when test="@role='bold' or @role='strong'">
        <strong><xsl:apply-templates/></strong>
      </xsl:when>
      <xsl:otherwise>
        <em><xsl:apply-templates/></em>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- Inline code -->
  <xsl:template match="db:command | db:filename | db:literal | db:keycap">
    <code><xsl:apply-templates/></code>
  </xsl:template>

  <!-- Links -->
  <xsl:template match="db:link">
    <a href="{@xl:href}">
      <xsl:apply-templates/>
    </a>
  </xsl:template>

  <!-- Tables -->
  <xsl:template match="db:table">
    <table><xsl:apply-templates/></table>
  </xsl:template>
  <xsl:template match="db:tgroup"><xsl:apply-templates/></xsl:template>
  <xsl:template match="db:thead"><thead><xsl:apply-templates/></thead></xsl:template>
  <xsl:template match="db:tbody"><tbody><xsl:apply-templates/></tbody></xsl:template>
  <xsl:template match="db:row"><tr><xsl:apply-templates/></tr></xsl:template>
  <xsl:template match="db:entry"><td><xsl:apply-templates/></td></xsl:template>

  <!-- Default -->
  <xsl:template match="*">
    <div data-tag="{local-name()}"><xsl:apply-templates/></div>
  </xsl:template>

</xsl:stylesheet>`;


  // XML → HTML Transformer (DocBook XSLT first, generic fallback for any XML)
  function transformXmlToHtml(xmlString) {
    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Generic serializer: converts any XML node to a readable HTML representation.
    function serializeNode(node) {
      if (!node) return '';
      switch (node.nodeType) {
        case Node.DOCUMENT_NODE:
          return Array.from(node.childNodes).map(serializeNode).join('');
        case Node.ELEMENT_NODE: {
          const tag = node.localName || node.nodeName;
          const attrs = Array.from(node.attributes || []).map(a => `<span class="xml-attr"><strong>${escapeHtml(a.name)}</strong>="${escapeHtml(a.value)}"</span>`).join(' ');
          const children = Array.from(node.childNodes).map(serializeNode).join('');
          // Normalize empty text-only nodes
          const hasVisibleText = children.replace(/\s+/g, '') !== '';
          return `<div class="xml-node" data-tag="${escapeHtml(tag)}">${attrs ? `<div class="xml-attrs">${attrs}</div>` : ''}${hasVisibleText ? `<div class="xml-children">${children}</div>` : ''}</div>`;
        }
        case Node.TEXT_NODE: {
          const txt = node.nodeValue || '';
          if (!txt.trim()) return ''; // skip pure whitespace
          return `<p class="xml-text">${escapeHtml(txt)}</p>`;
        }
        case Node.CDATA_SECTION_NODE:
          return `<pre class="xml-cdata">${escapeHtml(node.nodeValue)}</pre>`;
        case Node.COMMENT_NODE:
          return `<div class="xml-comment">&lt;!-- ${escapeHtml(node.nodeValue)} --&gt;</div>`;
        default:
          return '';
      }
    }

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString.trim(), 'application/xml');
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) throw new Error('XML parsing error: ' + parseError.textContent);

      // Detect DocBook root by namespace or root element name
      const root = xmlDoc.documentElement;
      const ns = root && root.namespaceURI;
      const localName = root && (root.localName || root.nodeName.toLowerCase());

      const looksLikeDocBook =
        (ns && ns.indexOf('docbook') !== -1) ||
        /^(article|section|chapter|book|bookinfo)$/i.test(localName);

      if (looksLikeDocBook) {
        // Use existing XSLT stylesheet (xsltStylesheet defined above in file)
        try {
          const xsltParser = new DOMParser();
          const xsltDoc = xsltParser.parseFromString(xsltStylesheet, 'application/xml');
          const xsltError = xsltDoc.querySelector('parsererror');
          if (xsltError) throw new Error('XSLT parsing error: ' + xsltError.textContent);

          const xsltProcessor = new XSLTProcessor();
          xsltProcessor.importStylesheet(xsltDoc);

          // Prefer transformToFragment; fallback to transformToDocument -> serialize
          let resultHtml = '';
          try {
            const frag = xsltProcessor.transformToFragment(xmlDoc, document);
            if (frag && frag instanceof Node) {
              const container = document.createElement('div');
              container.appendChild(frag);
              resultHtml = container.innerHTML;
            } else {
              // fallback to transformToDocument if available
              if (typeof xsltProcessor.transformToDocument === 'function') {
                const doc = xsltProcessor.transformToDocument(xmlDoc);
                if (doc && doc.documentElement) {
                  resultHtml = new XMLSerializer().serializeToString(doc.documentElement);
                }
              }
            }
          } catch (xsltErr) {
            // final fallback to generic serializer below
            console.warn('XSLT transform failed, falling back to generic XML serializer', xsltErr);
          }

          if (resultHtml && resultHtml.trim()) {
            return resultHtml.replace(/xmlns(:\w+)?="[^"]*"/g, '').replace(/<\?xml[^>]*\?>/g, '').trim();
          }
          // otherwise continue to generic fallback
        } catch (err) {
          console.warn('DocBook XSLT path failed, falling back to generic XML serializer:', err);
          // fallthrough to generic serializer
        }
      }

      // Generic fallback: produce readable HTML for any XML
      const html = serializeNode(xmlDoc);
      return `<div class="generic-xml">${html}</div>`;
    } catch (error) {
      console.error('XSLT / XML transformation error:', error);
      throw error;
    }
  }

  // CKEditor UI Integration
  const popupView = {
    element: null,
    render() {},
    destroy() {}
  };

  const closePopup = (panelElement, outsideClickHandler) => {
    if (balloon.hasView(popupView)) {
      balloon.remove(popupView);
    }
    if (panelElement.parentNode) panelElement.parentNode.removeChild(panelElement);
    document.removeEventListener('mousedown', outsideClickHandler);
  };

  // Toolbar Button
  editor.ui.componentFactory.add('xmlToHtmlConversion', locale => {
    const undoView = editor.ui.componentFactory.create('undo');
    const ButtonView = undoView.constructor;

    const button = new ButtonView(locale);
    button.set({
      label: 'Paste your XML',
      icon: '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 115.28 122.88" style="enable-background:new 0 0 115.28 122.88; width: 50px; height: auto;" xml:space="preserve"><style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style><g><path class="st0" d="M25.38,57h64.88V37.34H69.59c-2.17,0-5.19-1.17-6.62-2.6c-1.43-1.43-2.3-4.01-2.3-6.17V7.64l0,0H8.15 c-0.18,0-0.32,0.09-0.41,0.18C7.59,7.92,7.55,8.05,7.55,8.24v106.45c0,0.14,0.09,0.32,0.18,0.41c0.09,0.14,0.28,0.18,0.41,0.18 c22.78,0,58.09,0,81.51,0c0.18,0,0.17-0.09,0.27-0.18c0.14-0.09,0.33-0.28,0.33-0.41v-11.16H25.38c-4.14,0-7.56-3.4-7.56-7.56 V64.55C17.82,60.4,21.22,57,25.38,57L25.38,57z M29.98,68.76h7.76l4.03,7l3.92-7h7.66l-7.07,11.02l7.74,11.73h-7.91l-4.47-7.31 l-4.5,7.31h-7.85l7.85-11.86L29.98,68.76L29.98,68.76z M55.72,68.76H65l3.53,13.85l3.54-13.85h9.23v22.76h-5.75V74.17l-4.44,17.35 H65.9l-4.43-17.35v17.35h-5.75V68.76L55.72,68.76z M85.31,68.76h7.03v17.16h11v5.59H85.31V68.76L85.31,68.76z M97.79,57h9.93 c4.16,0,7.56,3.41,7.56,7.56v31.42c0,4.15-3.41,7.56-7.56,7.56h-9.93v13.55c0,1.61-0.65,3.04-1.7,4.1c-1.06,1.06-2.49,1.7-4.1,1.7 c-29.44,0-56.59,0-86.18,0c-1.61,0-3.04-0.64-4.1-1.7c-1.06-1.06-1.7-2.49-1.7-4.1V5.85c0-1.61,0.65-3.04,1.7-4.1 c1.06-1.06,2.53-1.7,4.1-1.7h58.72C64.66,0,64.8,0,64.94,0c0.64,0,1.29,0.28,1.75,0.69h0.09c0.09,0.05,0.14,0.09,0.23,0.18 l29.99,30.36c0.51,0.51,0.88,1.2,0.88,1.98c0,0.23-0.05,0.41-0.09,0.65V57L97.79,57z M67.52,27.97V8.94l21.43,21.7H70.19 c-0.74,0-1.38-0.32-1.89-0.78C67.84,29.4,67.52,28.71,67.52,27.97L67.52,27.97z"/></g></svg>',
      tooltip: true,
      tooltipPosition: 'n',
      class: 'xml-to-html-button'
    });

    // Button click handler
    button.on('execute', () => {
      const panelElement = document.createElement('div');
      panelElement.classList.add('xml-import-popup-panel');
      panelElement.innerHTML = `
        <div class="XmlImport">
          <span id="closeXmlPopup">×</span>
          <label><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 115.28 122.88" style="enable-background:new 0 0 115.28 122.88; width: 50px; height: auto;" xml:space="preserve"><style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style><g><path class="st0" d="M25.38,57h64.88V37.34H69.59c-2.17,0-5.19-1.17-6.62-2.6c-1.43-1.43-2.3-4.01-2.3-6.17V7.64l0,0H8.15 c-0.18,0-0.32,0.09-0.41,0.18C7.59,7.92,7.55,8.05,7.55,8.24v106.45c0,0.14,0.09,0.32,0.18,0.41c0.09,0.14,0.28,0.18,0.41,0.18 c22.78,0,58.09,0,81.51,0c0.18,0,0.17-0.09,0.27-0.18c0.14-0.09,0.33-0.28,0.33-0.41v-11.16H25.38c-4.14,0-7.56-3.4-7.56-7.56 V64.55C17.82,60.4,21.22,57,25.38,57L25.38,57z M29.98,68.76h7.76l4.03,7l3.92-7h7.66l-7.07,11.02l7.74,11.73h-7.91l-4.47-7.31 l-4.5,7.31h-7.85l7.85-11.86L29.98,68.76L29.98,68.76z M55.72,68.76H65l3.53,13.85l3.54-13.85h9.23v22.76h-5.75V74.17l-4.44,17.35 H65.9l-4.43-17.35v17.35h-5.75V68.76L55.72,68.76z M85.31,68.76h7.03v17.16h11v5.59H85.31V68.76L85.31,68.76z M97.79,57h9.93 c4.16,0,7.56,3.41,7.56,7.56v31.42c0,4.15-3.41,7.56-7.56,7.56h-9.93v13.55c0,1.61-0.65,3.04-1.7,4.1c-1.06,1.06-2.49,1.7-4.1,1.7 c-29.44,0-56.59,0-86.18,0c-1.61,0-3.04-0.64-4.1-1.7c-1.06-1.06-1.7-2.49-1.7-4.1V5.85c0-1.61,0.65-3.04,1.7-4.1 c1.06-1.06,2.53-1.7,4.1-1.7h58.72C64.66,0,64.8,0,64.94,0c0.64,0,1.29,0.28,1.75,0.69h0.09c0.09,0.05,0.14,0.09,0.23,0.18 l29.99,30.36c0.51,0.51,0.88,1.2,0.88,1.98c0,0.23-0.05,0.41-0.09,0.65V57L97.79,57z M67.52,27.97V8.94l21.43,21.7H70.19 c-0.74,0-1.38-0.32-1.89-0.78C67.84,29.4,67.52,28.71,67.52,27.97L67.52,27.97z"/></g></svg> Paste from XML</label>
          <textarea id="xmlInputArea" placeholder="Paste your XML here..."></textarea>
          <div class="xmlButtons">
            <button class="btnXmlImport buttonSubmit" id="xmlSubmitBtn">Submit</button>
            <button class="btnXmlImport buttonCancel" id="xmlCancelBtn">Cancel</button>
          </div>
        </div>`;

      document.body.appendChild(panelElement);
      popupView.element = panelElement;

      // Button handlers
      panelElement.querySelector('#closeXmlPopup').onclick = () =>
        closePopup(panelElement, outsideClickHandler);
      panelElement.querySelector('#xmlCancelBtn').onclick = () =>
        closePopup(panelElement, outsideClickHandler);
      panelElement.querySelector('#xmlSubmitBtn').onclick = () => {
        const xmlContent = panelElement.querySelector('#xmlInputArea').value.trim();

        // Clear any previous inline error
        const prevError = panelElement.querySelector('.xml-error-msg');
        if (prevError) prevError.remove();

        if (!xmlContent) {
          // Show inline error under the textarea instead of alert
          const errDiv = document.createElement('div');
          errDiv.className = 'xml-error-msg';
          errDiv.style.cssText = 'color:#b00020;margin-top:8px;font-size:13px;';
          errDiv.textContent = 'Please paste valid XML content.';
          panelElement.querySelector('#xmlInputArea').insertAdjacentElement('afterend', errDiv);
          panelElement.querySelector('#xmlInputArea').focus();
          return;
        }

        try {
          const htmlContent = transformXmlToHtml(xmlContent);
          const existingData = editor.getData ? (editor.getData() || '') : '';
          const empty = isCKEditorEmpty(editor) || !existingData || /^\s*$/.test(existingData);

          if (empty) {
            editor.setData(htmlContent);
          } else {
            try {
              const viewFragment = editor.data.processor.toView(htmlContent);
              const modelFragment = editor.data.toModel(viewFragment);
              editor.model.change(writer => {
                const selection = editor.model.document.selection;
                editor.model.insertContent(modelFragment, selection.getLastPosition());
              });
            } catch (insertErr) {
              const sep = existingData.trim().endsWith('</') ? '' : '<div></div>';
              editor.setData(existingData + sep + htmlContent);
            }
          }

          closePopup(panelElement, outsideClickHandler);
        } catch (error) {
          // Log for debugging but surface message inline under textarea and keep popup open
          // Extract short parser message without line/column or rendering junk
          function extractShortXmlError(err) {
            let msg = err && err.message ? err.message : String(err);

            // Remove common verbose prefixes
            msg = msg.replace(/^XML parsing error:\s*/i, '');
            msg = msg.replace(/^XSLT parsing error:\s*/i, '');
            msg = msg.replace(/^This page contains the following errors:\s*/i, '');

            // Remove "error on line X at column Y:" fragments
            msg = msg.replace(/error on line\s*\d+\s*at column\s*\d+:\s*/i, '');
            msg = msg.replace(/:\s*error on line\s*\d+/i, '');

            // Strip "Below is a rendering" and anything after it
            msg = msg.split(/Below is a rendering/i)[0].trim();

            // Take first non-empty line
            const firstLine = (msg.split(/\r?\n/).find(Boolean) || '').trim();

            // Try to capture common meaningful parser messages
            const pattern = /(Opening and ending tag mismatch:[^.;\n]+)|(not well-formed[^.;\n]+)|(Entity|Reference|Expected|mismatch)[^.;\n]*/i;
            const match = firstLine.match(pattern);
            if (match && match[0]) return match[0].trim();

            // Fallback: remove any leftover location parentheses and trim
            const cleaned = firstLine.replace(/\(.*line.*\)/i, '').replace(/\(.*\)/, '').trim();
            return cleaned.length ? (cleaned.length > 200 ? cleaned.slice(0,197) + '...' : cleaned) : 'Invalid or malformed XML';
          }

          const shortMsg = extractShortXmlError(error);

          const errDiv = document.createElement('div');
          errDiv.className = 'xml-error-msg';
          errDiv.style.cssText = 'color:#b00020;margin-top:8px;font-size:13px;white-space:pre-wrap;';
          errDiv.textContent = 'Error processing XML: ' + shortMsg;

          // insert or replace after the textarea
          const area = panelElement.querySelector('#xmlInputArea');
          const existing = panelElement.querySelector('.xml-error-msg');
          if (existing) existing.replaceWith(errDiv);
          else area.insertAdjacentElement('afterend', errDiv);

          // keep popup open and focus textarea for correction
          area.focus();
        }
      };

      // Outside click handler
      const outsideClickHandler = event => {
        const balloonEl = balloon.view.element;
        if (balloonEl && !balloonEl.contains(event.target)) {
          closePopup(panelElement, outsideClickHandler);
        }
      };

      if (!balloon.hasView(popupView)) {
        balloon.add({
          view: popupView,
          position: {
            target: () => {
              const editorElement = editor.ui.view.element;
              const xmlButton = editorElement.querySelector('.xml-to-html-button');
              return xmlButton || editor.ui.view.editable.element;
            },
            positions: [
              (targetRect, balloonRect) => ({
                top: targetRect.bottom + 25,
                left: targetRect.left,
                name: 'below'
              })
            ]
          }
        });
        document.addEventListener('mousedown', outsideClickHandler);
      } else {
        closePopup(panelElement, outsideClickHandler);
      }
    });

    return button;
  });
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
                // Get the cursor position information
                const selectionCursor = editor.model.document.selection;
                const cursorPosition = selectionCursor.getLastPosition();
                const viewPosition = editor.editing.mapper.toViewPosition(cursorPosition);
                const domPosition = editor.editing.view.domConverter.viewPositionToDom(viewPosition);
                
                if (domPosition && domPosition.parent) {
                  // Get text from current paragraph/element
                  const currentLineText = domPosition.parent.textContent || '';
                  if (currentLineText.trim() !== '') {
                    actualSelectedText = currentLineText;
                  }
                }
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
          
          const text = elements.input.value.trim();
          if (!text) return;
          let $aiTitle = $('.aiTitle');
          if ($aiTitle.length) {
            $aiTitle.hide();
          }
          // Show loading state
          elements.loading.innerText = 'Loading response from Samaritan...';
          elements.loading.style.display = 'block';
          elements.response.style.display = 'none';
          
          const selectedElements = document.querySelectorAll('.ai-selected-text');
            
            // Collect all HTML content from selectedElements
            let selectedTextValue = '';
            if (selectedElements.length > 0) {
              selectedTextValue = Array.from(selectedElements).map(el => el.innerHTML).join('\n');
            }
          
          // Get new response
          try {
            const newResponse = await getAIAssistantResponse((text == prompt) ? selectedTextValue : text, prompt);
            $aiTitle.show();
            // Display new response
            elements.response.innerHTML = simpleMarkdownToHTML(newResponse);
            response = newResponse; // Update response variable
            elements.response.style.display = 'block';
            elements.loading.style.display = 'none';
          } catch (err) {
            console.error('Error getting new response:', err);
            elements.loading.innerText = 'Error fetching response. Please try again.';
          }
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
        extraPlugins: [ AiAgentPlugin, AiPreDefinedPromptsPlugin, xmlToHtmlPlugin ],
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
            ...(ckEditorAIAssistantEnable ? ["|", "AIPreDefinedPromptsOption"] : [])
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
