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
            <option value="select">Select a prompt</option>
            <option value="ImproveWriting">Improve Writing</option>
            <option value="makeShorter">Make shorter</option>
            <option value="makeLonger">Make longer</option>
            <option value="spellChecker">Spell Checker</option>
            <option value="generateAI">Generate AI</option>
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
          elements.loading.innerText = 'Loading response from AI Assistant...';
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
      
      
      // Set up event listeners for editor content changes
      editor.model.document.on('change:data', () => toggleAiButtonState(editor));
      editor.on('ready', () => toggleAiButtonState(editor));
      setTimeout(() => toggleAiButtonState(editor), 100);
      
      // Register toolbar button
      editor.ui.componentFactory.add('AIPreDefinedPromptsOption', locale => {
        const undoView = editor.ui.componentFactory.create('undo');
        const ButtonView = undoView.constructor;
        
        const button = new ButtonView(locale);
        button.set({
          label: 'AI Assistant',
          icon: '<svg viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title></title> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="icon" fill="#000000"> <path d="M320,64 L320,320 L64,320 L64,64 L320,64 Z M171.749388,128 L146.817842,128 L99.4840387,256 L121.976629,256 L130.913039,230.977 L187.575039,230.977 L196.319607,256 L220.167172,256 L171.749388,128 Z M260.093778,128 L237.691519,128 L237.691519,256 L260.093778,256 L260.093778,128 Z M159.094727,149.47526 L181.409039,213.333 L137.135039,213.333 L159.094727,149.47526 Z M341.333333,256 L384,256 L384,298.666667 L341.333333,298.666667 L341.333333,256 Z M85.3333333,341.333333 L128,341.333333 L128,384 L85.3333333,384 L85.3333333,341.333333 Z M170.666667,341.333333 L213.333333,341.333333 L213.333333,384 L170.666667,384 L170.666667,341.333333 Z M85.3333333,0 L128,0 L128,42.6666667 L85.3333333,42.6666667 L85.3333333,0 Z M256,341.333333 L298.666667,341.333333 L298.666667,384 L256,384 L256,341.333333 Z M170.666667,0 L213.333333,0 L213.333333,42.6666667 L170.666667,42.6666667 L170.666667,0 Z M256,0 L298.666667,0 L298.666667,42.6666667 L256,42.6666667 L256,0 Z M341.333333,170.666667 L384,170.666667 L384,213.333333 L341.333333,213.333333 L341.333333,170.666667 Z M0,256 L42.6666667,256 L42.6666667,298.666667 L0,298.666667 L0,256 Z M341.333333,85.3333333 L384,85.3333333 L384,128 L341.333333,128 L341.333333,85.3333333 Z M0,170.666667 L42.6666667,170.666667 L42.6666667,213.333333 L0,213.333333 L0,170.666667 Z M0,85.3333333 L42.6666667,85.3333333 L42.6666667,128 L0,128 L0,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg>',
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
      
      // Toggle AI button state based on editor content
      function toggleAiButtonState(editor) {
        const editorElement = editor.ui.view.element;
        const aiButton = editorElement.querySelector('.ai-predefined-button');
        if (aiButton) {
          aiButton.classList.toggle('ck-disabled', isCKEditorEmpty(editor));
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
          <label><svg viewBox="0 0 512 512" width="25px" height="25px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title></title> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="icon" fill="#000000" transform="translate(32.000000, 32.000000)"> <path d="M320,64 L320,320 L64,320 L64,64 L320,64 Z M171.749388,128 L146.817842,128 L99.4840387,256 L121.976629,256 L130.913039,230.977 L187.575039,230.977 L196.319607,256 L220.167172,256 L171.749388,128 Z M260.093778,128 L237.691519,128 L237.691519,256 L260.093778,256 L260.093778,128 Z M159.094727,149.47526 L181.409039,213.333 L137.135039,213.333 L159.094727,149.47526 Z M341.333333,256 L384,256 L384,298.666667 L341.333333,298.666667 L341.333333,256 Z M85.3333333,341.333333 L128,341.333333 L128,384 L85.3333333,384 L85.3333333,341.333333 Z M170.666667,341.333333 L213.333333,341.333333 L213.333333,384 L170.666667,384 L170.666667,341.333333 Z M85.3333333,0 L128,0 L128,42.6666667 L85.3333333,42.6666667 L85.3333333,0 Z M256,341.333333 L298.666667,341.333333 L298.666667,384 L256,384 L256,341.333333 Z M170.666667,0 L213.333333,0 L213.333333,42.6666667 L170.666667,42.6666667 L170.666667,0 Z M256,0 L298.666667,0 L298.666667,42.6666667 L256,42.6666667 L256,0 Z M341.333333,170.666667 L384,170.666667 L384,213.333333 L341.333333,213.333333 L341.333333,170.666667 Z M0,256 L42.6666667,256 L42.6666667,298.666667 L0,298.666667 L0,256 Z M341.333333,85.3333333 L384,85.3333333 L384,128 L341.333333,128 L341.333333,85.3333333 Z M0,170.666667 L42.6666667,170.666667 L42.6666667,213.333333 L0,213.333333 L0,170.666667 Z M0,85.3333333 L42.6666667,85.3333333 L42.6666667,128 L0,128 L0,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg> AI Assistant</label><br>
          <textarea id="assistantTextArea" placeholder="Ask AI to edit or generate"></textarea>
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
          elements.loading.innerText = 'Loading response from AI Assistant...';
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
          elements.loading.innerText = 'Loading response from AI Assistant...';
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
        extraPlugins: [ AiAgentPlugin, AiPreDefinedPromptsPlugin ],
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
