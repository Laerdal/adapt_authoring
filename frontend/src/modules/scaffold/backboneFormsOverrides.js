define([
  'core/origin',
  'backbone-forms'
], function(Origin, BackboneForms) {

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

    function AiAgentPlugin(editor) {

  const balloon = editor.plugins.get('ContextualBalloon');

  // DOM panel
  const panelElement = document.createElement('div');
  panelElement.classList.add('ai-agent-popup-panel');
  panelElement.innerHTML = `
    <div class="AiAgent">
      <span id="closePopup">×</span>    
      <label><svg viewBox="0 0 512 512" width="25px" height="25px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title></title> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="icon" fill="#000000" transform="translate(64.000000, 64.000000)"> <path d="M320,64 L320,320 L64,320 L64,64 L320,64 Z M171.749388,128 L146.817842,128 L99.4840387,256 L121.976629,256 L130.913039,230.977 L187.575039,230.977 L196.319607,256 L220.167172,256 L171.749388,128 Z M260.093778,128 L237.691519,128 L237.691519,256 L260.093778,256 L260.093778,128 Z M159.094727,149.47526 L181.409039,213.333 L137.135039,213.333 L159.094727,149.47526 Z M341.333333,256 L384,256 L384,298.666667 L341.333333,298.666667 L341.333333,256 Z M85.3333333,341.333333 L128,341.333333 L128,384 L85.3333333,384 L85.3333333,341.333333 Z M170.666667,341.333333 L213.333333,341.333333 L213.333333,384 L170.666667,384 L170.666667,341.333333 Z M85.3333333,0 L128,0 L128,42.6666667 L85.3333333,42.6666667 L85.3333333,0 Z M256,341.333333 L298.666667,341.333333 L298.666667,384 L256,384 L256,341.333333 Z M170.666667,0 L213.333333,0 L213.333333,42.6666667 L170.666667,42.6666667 L170.666667,0 Z M256,0 L298.666667,0 L298.666667,42.6666667 L256,42.6666667 L256,0 Z M341.333333,170.666667 L384,170.666667 L384,213.333333 L341.333333,213.333333 L341.333333,170.666667 Z M0,256 L42.6666667,256 L42.6666667,298.666667 L0,298.666667 L0,256 Z M341.333333,85.3333333 L384,85.3333333 L384,128 L341.333333,128 L341.333333,85.3333333 Z M0,170.666667 L42.6666667,170.666667 L42.6666667,213.333333 L0,213.333333 L0,170.666667 Z M0,85.3333333 L42.6666667,85.3333333 L42.6666667,128 L0,128 L0,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg> AI Assistant</label><br>
      <textarea id="assistantTextArea" placeholder="Ask AI to edit or generate"></textarea>
      <div id="loadingMsg"></div>
      <div class='generatedResponse'></div>
      <div>
      <button class="btnAiAgent buttonSend" id="assistantSubmitBtn">Submit</button>
      <button class="btnAiAgent buttonInsert" disabled id="assistantInsertBtn">Insert</button>
      </div>
    </div>
  `;

  const assistantTextArea = panelElement.querySelector('#assistantTextArea');
  panelElement.querySelector('#closePopup').onclick = () => {
    if (balloon.hasView(popupView)) {
      balloon.remove(popupView);
    }
  };
    
  const closePopup = () => {
    if (balloon.hasView(popupView)) {
      balloon.remove(popupView);
    }
    assistantTextArea.disabled = false;
    document.removeEventListener('mousedown', outsideClickHandler);
  };

    // Outside click to close
  const outsideClickHandler = (event) => {
    const balloonEl = balloon.view.element;
    // Ensure balloon element and event target exist
    if (!balloonEl || !balloonEl.contains(event.target)) {
      closePopup();
    }
  };

  document.addEventListener('mousedown', outsideClickHandler);

  const popupView = {
    element: panelElement,
    render() {},
    destroy() {}
  };

  editor.ui.componentFactory.add('customPopup', locale => {
    const undoView = editor.ui.componentFactory.create('undo');
    const ButtonView = undoView.constructor;

    const button = new ButtonView(locale);
    button.set({
      label: 'AI Assistant',
      icon: '<svg viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title></title> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="icon" fill="#000000" transform="translate(64.000000, 64.000000)"> <path d="M320,64 L320,320 L64,320 L64,64 L320,64 Z M171.749388,128 L146.817842,128 L99.4840387,256 L121.976629,256 L130.913039,230.977 L187.575039,230.977 L196.319607,256 L220.167172,256 L171.749388,128 Z M260.093778,128 L237.691519,128 L237.691519,256 L260.093778,256 L260.093778,128 Z M159.094727,149.47526 L181.409039,213.333 L137.135039,213.333 L159.094727,149.47526 Z M341.333333,256 L384,256 L384,298.666667 L341.333333,298.666667 L341.333333,256 Z M85.3333333,341.333333 L128,341.333333 L128,384 L85.3333333,384 L85.3333333,341.333333 Z M170.666667,341.333333 L213.333333,341.333333 L213.333333,384 L170.666667,384 L170.666667,341.333333 Z M85.3333333,0 L128,0 L128,42.6666667 L85.3333333,42.6666667 L85.3333333,0 Z M256,341.333333 L298.666667,341.333333 L298.666667,384 L256,384 L256,341.333333 Z M170.666667,0 L213.333333,0 L213.333333,42.6666667 L170.666667,42.6666667 L170.666667,0 Z M256,0 L298.666667,0 L298.666667,42.6666667 L256,42.6666667 L256,0 Z M341.333333,170.666667 L384,170.666667 L384,213.333333 L341.333333,213.333333 L341.333333,170.666667 Z M0,256 L42.6666667,256 L42.6666667,298.666667 L0,298.666667 L0,256 Z M341.333333,85.3333333 L384,85.3333333 L384,128 L341.333333,128 L341.333333,85.3333333 Z M0,170.666667 L42.6666667,170.666667 L42.6666667,213.333333 L0,213.333333 L0,170.666667 Z M0,85.3333333 L42.6666667,85.3333333 L42.6666667,128 L0,128 L0,85.3333333 Z" id="Combined-Shape"> </path> </g> </g> </g></svg>',
      tooltip: true,
      class: 'ai-button',
    });

    button.on('execute', () => {
      if (!balloon.hasView(popupView)) {
        balloon.add({
          view: popupView,
          position: {
            target: editor.ui.view.editable.element
          }
        });

        setTimeout(() => {
          const assistantInput = panelElement.querySelector('#assistantTextArea');
          const assistantSubmitBtn = panelElement.querySelector('#assistantSubmitBtn');
          const assistantInsertBtn = panelElement.querySelector('#assistantInsertBtn');
          const loading = panelElement.querySelector('#loadingMsg');
          const generateResponse = panelElement.querySelector('.generatedResponse');
          let aiTitle = panelElement.querySelector('.aiTitle');

          // ✅ Reset popup content each time it's opened
          assistantInput.value = '';
          loadingMsg.innerText = '';
          loadingMsg.style.display = 'none';
          generateResponse.innerHTML = '';
          generateResponse.style.display = 'none';
          if (aiTitle) {
            aiTitle.style.display = 'none';
          }
          assistantSubmitBtn.disabled = false;
          assistantInsertBtn.disabled = true;
          

          // Event listener for Send
          if (!assistantSubmitBtn._listenerAttached) {
            assistantSubmitBtn.addEventListener('click', async () => {
            const prompt = assistantInput.value.trim();
            if (!prompt) return;

            // Show loading message
            loadingMsg.innerText = 'Loading response from ChatGPT...';
            loadingMsg.style.display = 'block';
          // Disable the send button while waiting for response
            assistantSubmitBtn.disabled = true;
            // Hide the response initially
            generateResponse.style.display = 'none';
            generateResponse.innerHTML = '';

            try {
              const response = await fetch('https://swedencentral.api.cognitive.microsoft.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2025-01-01-preview', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer BFnqoouwofssKH9XwH88loeWMiKzi6TuCCZ4sbyE1xJV0tGKwPhRJQQJ99BBACfhMk5XJ3w3AAAAACOGeO4c'
                  },
                body: JSON.stringify({
                  messages: [{ role: 'user', content: prompt }]
                })
              });

              const result = await response.json();
              const reply = result.choices[0].message.content;
              const formattedHTML = simpleMarkdownToHTML(reply);

              // Show the response
              let titleResponse = `<h1 class='aiTitle'>AI Response</h1>`;
              if (!generateResponse.previousElementSibling || generateResponse.previousElementSibling.tagName !== 'H1') {
                generateResponse.insertAdjacentHTML('beforebegin', titleResponse);
              }
              generateResponse.innerHTML = formattedHTML;
              generateResponse.style.display = 'block';
              assistantInput.disabled = true;
              let aiTitleResponse = panelElement.querySelector('.aiTitle');
              if (aiTitleResponse) {
                aiTitleResponse.style.display = 'block';
              }

              // Hide the loading message
              loadingMsg.style.display = 'none';
              assistantInsertBtn.disabled = false;
              // Bind insert action
              assistantInsertBtn.onclick = () => {
              if (!formattedHTML) return;
              try {
                editor.model.change(() => {
                  const viewFragment = editor.data.processor.toView(formattedHTML);
                  const modelFragment = editor.data.toModel(viewFragment);
                  editor.model.insertContent(modelFragment);
                });

                closePopup();
              } catch (err) {
                console.error('Error inserting HTML content into CKEditor:', err);
              }
            };
            } catch (err) {
              console.error('ChatGPT error:', err);
              loadingMsg.innerText = 'Error fetching response.';
            }
          });
          assistantSubmitBtn._listenerAttached = true;
          }

          document.addEventListener('mousedown', outsideClickHandler);
        }, 0);
      } else {
        balloon.remove(popupView);
        closePopup();
      }
    });

    return button;
  });


}

function simpleMarkdownToHTML(markdown) {
  let html = markdown;

  // Convert ### Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');

  // Convert bold text
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

  // Convert numbered lists (1., 2., etc.)
  html = html.replace(/^\d+\.\s+(.*)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gim, '<ol>$1</ol>'); // wrap in <ol>

  // Convert unordered lists (- item)
  html = html.replace(/^- (.*)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>'); // wrap in <ul>

  // Convert line breaks
  html = html.replace(/\n/g, '<br>');

  return html.trim();
}


    until(isAttached(this.$el)).then(() => {
      return CKEDITOR.create(this.$el[0], {
        dataIndentationChars: "",
        disableNativeSpellChecker: false,
        versionCheck:false,
        enterMode: CKEDITOR[Origin.constants.ckEditorEnterMode],
        entities: false,
        extraPlugins: [ AiAgentPlugin ],
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
            "insertTableLayout","|", "aiAgent", "|", "customPopup"
          ],
          shouldNotGroupWhenFull: true,
        },
        table: {
          contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties']
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
