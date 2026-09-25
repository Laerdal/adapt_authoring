// Loads CKEditor 5 from the CDN exactly the way the framework's Quick Edit
// bridge does (extensions/adapt-preview-edit/js/ckEditorManager.js in
// Laerdal-Medical/adapt-framework-plugins) so both surfaces share one proven,
// working loading mechanism and toolbar/plugin set. Cached — only ever loads
// once per page, regardless of how many editors get created.
export const CKEDITOR_VERSION = "42.0.0";

declare global {
  interface Window {
    CKEDITOR?: any;
    CKEDITOR_LOADED?: boolean;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadCKEditor5(): Promise<void> {
  return loadCKEditor5In(window);
}

// Same loader, but targets an arbitrary window (e.g. the page editor canvas's
// same-origin iframe) instead of the top-level document — needed so the
// canvas's live "body" fields can get a real CKEditor 5 instance running
// inside the framework preview's own document, not this app's document.
const iframeLoadPromises = new WeakMap<Window, Promise<void>>();

export function loadCKEditor5In(targetWindow: Window): Promise<void> {
  const isTop = targetWindow === window;
  if (isTop) {
    if (window.CKEDITOR_LOADED && window.CKEDITOR && Array.isArray((window as any).CKEDITOR.pluginsConfig) && (window as any).CKEDITOR.PasteToolsPlugin) return Promise.resolve();
    if (loadPromise) return loadPromise;
  } else {
    if ((targetWindow as any).CKEDITOR_LOADED && (targetWindow as any).CKEDITOR && Array.isArray((targetWindow as any).CKEDITOR.pluginsConfig) && (targetWindow as any).CKEDITOR.PasteToolsPlugin) return Promise.resolve();
    const existing = iframeLoadPromises.get(targetWindow);
    // If the window has changed or document is fresh, don't return a stale promise
    if (existing && (targetWindow as any).CKEDITOR_LOADED && Array.isArray((targetWindow as any).CKEDITOR?.pluginsConfig) && (targetWindow as any).CKEDITOR?.PasteToolsPlugin) return existing;
  }

  const targetDocument = targetWindow.document;
  if (!targetDocument) return Promise.reject(new Error("No target document available"));
  const promise = new Promise<void>((resolve, reject) => {
    try {
      if (!targetDocument.querySelector('link[href*="ckeditor5.css"]')) {
        const link = targetDocument.createElement("link");
        link.rel = "stylesheet";
        link.href = `https://cdn.ckeditor.com/ckeditor5/${CKEDITOR_VERSION}/ckeditor5.css`;
        targetDocument.head.appendChild(link);
      }

      // Canvas iframe target only: this app's own index.css can't reach into
      // the framework preview's document, so give the toolbar the same
      // fit/overflow rules there directly (native wrap is already enabled
      // via shouldNotGroupWhenFull:true; this is just the width constraint).
      // !important because the real course template/theme CSS the editor's
      // source element sits inside (e.g. a flex column) otherwise wins and
      // shrinks the editor to fit-content width — visible as text wrapping
      // one character per line ("broken" narrow column).
      if (!isTop && !targetDocument.getElementById("adapt-authoring-ckeditor-fit-style")) {
        const style = targetDocument.createElement("style");
        style.id = "adapt-authoring-ckeditor-fit-style";
        style.textContent = `
          .ck.ck-editor { display: block !important; width: 100% !important; max-width: 100% !important; }
          .ck-sticky-panel, .ck-sticky-panel__content { position: static !important; top: auto !important; width: 100% !important; }
          .ck.ck-editor__main, .ck.ck-editor__editable, .ck.ck-content {
            display: block !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important;
          }
          :root { --ckeditor-toolbar-bg: #F2F2F2; }
          .ck.ck-toolbar { width: 100% !important; box-sizing: border-box !important; background-color: var(--ckeditor-toolbar-bg) !important; flex-wrap: wrap !important; row-gap: 2px; }
          .ck.ck-toolbar__items { flex-wrap: wrap !important; }
          .ck.ck-toolbar .ck-button__icon,
          .ck.ck-toolbar .ck-button__icon svg { width: 20px !important; height: 20px !important; display: block !important; visibility: visible !important; }
          .ck.ck-toolbar .ck-button[data-cke-tooltip-text="Paste your XML"] .ck-button__icon { width: 22.15px !important; height: 22.15px !important; }
          .ck.ck-toolbar .ck-button__icon path { fill: currentColor !important; opacity: 1 !important; }
          .ck.ck-toolbar .ck-button__icon[viewBox="0 0 20 20"],
          .ck.ck-toolbar .ck-button__icon[viewBox="0 0 115.28 122.88"] { overflow: visible !important; }
          .ck.ck-toolbar .ck-button__icon[viewBox="0 0 20 20"] path,
          .ck.ck-toolbar .ck-button__icon[viewBox="0 0 115.28 122.88"] path { fill: #333333 !important; }
          .ck.ck-content { word-break: break-word; }
          .ck.ck-editor__editable.ck-focused:not(.ck-editor__nested-editable) {
            outline: 0 !important;
            box-shadow: none !important;
          }
        `;
        targetDocument.head.appendChild(style);
      }

      if (!targetDocument.querySelector('script[type="importmap"]')) {
        const importMap = targetDocument.createElement("script");
        importMap.type = "importmap";
        importMap.textContent = JSON.stringify({
          imports: {
            ckeditor5: `https://cdn.ckeditor.com/ckeditor5/${CKEDITOR_VERSION}/ckeditor5.js`,
            "ckeditor5/": `https://cdn.ckeditor.com/ckeditor5/${CKEDITOR_VERSION}/`,
          },
        });
        targetDocument.head.appendChild(importMap);
      }

      const moduleScript = targetDocument.createElement("script");
      moduleScript.type = "module";
      moduleScript.addEventListener(
        "error",
        () => {
          if (isTop) loadPromise = null;
          else iframeLoadPromises.delete(targetWindow);
          reject(new Error("Failed to load CKEditor 5 module script"));
        },
        { once: true }
      );
      moduleScript.textContent = `
        import {
          ClassicEditor, Alignment, Autoformat, AutoLink, Autosave, BalloonToolbar,
          BlockQuote, BlockToolbar, Bold, Clipboard, Code, Essentials,
          FindAndReplace, Font, GeneralHtmlSupport, Heading, Highlight, Indent, IndentBlock,
          Image, ImageCaption, ImageResize, ImageStyle, ImageToolbar, ImageUpload,
          Base64UploadAdapter, Italic, Link, List, ListProperties, Paragraph,
          PasteFromOffice,
          SelectAll, ShowBlocks, SourceEditing, SpecialCharacters,
          SpecialCharactersArrows, SpecialCharactersCurrency, SpecialCharactersEssentials,
          SpecialCharactersLatin, SpecialCharactersMathematical, SpecialCharactersText,
          Strikethrough, Subscript, Superscript, TextTransformation,
          Table, TableCaption, TableCellProperties, TableProperties, TableToolbar,
          Underline, Undo, Plugin, ButtonView
        } from 'https://cdn.ckeditor.com/ckeditor5/${CKEDITOR_VERSION}/ckeditor5.js';

        // "Samaritan Assistance" toolbar button — matches the old tool's
        // AiAgentPlugin in spirit (a single toolbar entry point), but the
        // actual AI popover UI lives in React (RichTextEditor.tsx). This
        // plugin just wires the button up to whatever callback the host
        // component supplied via config.samaritanOnClick, per editor instance.
        class SamaritanPlugin extends Plugin {
          init() {
            const editor = this.editor;
            editor.ui.componentFactory.add('samaritan', (locale) => {
              const button = new ButtonView(locale);
              // Icon-only. Uses the branded Samaritan puzzle-heart mark
              // (see /public/assets/icons/Samaritan-icon-light-mode.svg) so
              // the AI action reads consistently everywhere it appears —
              // storyboard toolbar, RTE toolbar, and the global assistant.
              // Rendered monochrome via currentColor so CKEditor's toolbar
              // icon theming (hover/active states) works normally.
              button.set({
                label: 'Samaritan Assistance',
                icon: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M24 11.8244L26.1215 9.70303C30.4172 5.40726 37.3821 5.40726 41.6778 9.70303C45.9736 13.9988 45.9736 20.9636 41.6778 25.2594L36.8384 30.0988L36.7354 30.2015C36.7329 30.2041 36.7303 30.2066 36.7278 30.2092L26.421 40.516C25.0839 41.8531 22.9159 41.8531 21.5788 40.516L6.32223 25.2594C2.02646 20.9636 2.02646 13.9988 6.32223 9.70303C10.618 5.40726 17.5828 5.40726 21.8786 9.70303L24 11.8244ZM25.0068 39.1018C24.4507 39.6578 23.5491 39.6578 22.993 39.1018L7.73644 23.8452C4.22172 20.3304 4.22172 14.632 7.73644 11.1172C11.2512 7.60252 16.9496 7.60252 20.4644 11.1172L22.5857 13.2386L19.7572 16.0669C17.414 18.4101 17.414 22.209 19.7572 24.5522C22.1003 26.8953 25.8993 26.8953 28.2424 24.5522L29.6567 23.1381C31.2188 21.576 33.7515 21.576 35.3136 23.1381C36.8743 24.6988 36.8757 27.2283 35.3178 28.7907C35.3164 28.7921 35.315 28.7935 35.3136 28.7949L25.0068 39.1018ZM40.2636 23.8452L38.4759 25.6328C38.3972 24.2103 37.8145 22.8105 36.7278 21.7239C34.3847 19.3807 30.5856 19.3806 28.2425 21.7238L26.8282 23.138C25.2661 24.7001 22.7335 24.7001 21.1714 23.138C19.6093 21.5759 19.6093 19.0432 21.1714 17.4811L27.5357 11.1172C31.0504 7.60252 36.7489 7.60252 40.2636 11.1172C43.7783 14.632 43.7783 20.3304 40.2636 23.8452Z" fill="currentColor"/></svg>',
                tooltip: true,
              });
              button.on('execute', () => {
                const onClick = editor.config.get('samaritanOnClick');
                if (typeof onClick === 'function') onClick(editor);
              });
              return button;
            });
          }
        }

        class PasteToolsPlugin extends Plugin {
          init() {
            const editor = this.editor;
            const openPasteDialog = (xmlOnly) => {
              const overlay = document.createElement('div');
              overlay.setAttribute('data-adapt-authoring-paste-dialog', 'true');
              overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:20px;';
              const dialog = document.createElement('div');
              dialog.style.cssText = 'width:min(680px,100%);background:#fff;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 12px 30px rgba(0,0,0,.2);padding:16px;font-family:Arial,sans-serif;';
              const title = document.createElement('h2'); title.textContent = xmlOnly ? 'Paste XML' : 'Paste with formatting'; title.style.cssText = 'margin:0 0 10px;font-size:16px;color:#1f2937;';
              const input = document.createElement(xmlOnly ? 'textarea' : 'div');
              input.setAttribute('aria-label', xmlOnly ? 'XML content' : 'Formatted content');
              if (!xmlOnly) input.contentEditable = 'true';
              input.style.cssText = 'display:block;width:100%;min-height:180px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:4px;padding:10px;font-size:14px;overflow:auto;outline:none !important;box-shadow:none !important;';
              const actions = document.createElement('div'); actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:12px;';
              const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
              const apply = document.createElement('button'); apply.type = 'button'; apply.textContent = 'Insert'; apply.style.cssText = 'background:#2e7fa1;color:#fff;border:0;border-radius:4px;padding:6px 14px;';
              cancel.onclick = () => overlay.remove();
              apply.onclick = () => { const raw = xmlOnly ? input.value : input.innerHTML; const escaped = raw.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); const value = xmlOnly ? '<pre>' + escaped + '</pre>' : raw; editor.model.change(() => editor.model.insertContent(editor.data.toModel(editor.data.processor.toView(value)), editor.model.document.selection)); overlay.remove(); };
              actions.append(cancel, apply); dialog.append(title, input, actions); overlay.append(dialog); document.body.append(overlay); input.focus();
            };
            const legacyXmlIcon = '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 115.28 122.88" style="enable-background:new 0 0 115.28 122.88; width: 50px; height: auto;" xml:space="preserve"><style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style><g><path class="st0" d="M25.38,57h64.88V37.34H69.59c-2.17,0-5.19-1.17-6.62-2.6c-1.43-1.43-2.3-4.01-2.3-6.17V7.64l0,0H8.15 c-0.18,0-.32,0.09-.41,0.18C7.59,7.92,7.55,8.05,7.55,8.24v106.45c0,.14.09.32.18.41c.09.14.28.18.41.18c22.78,0,58.09,0,81.51,0c.18,0,.17-.09.27-.18c.14-.09.33-.28.33-.41v-11.16H25.38c-4.14,0-7.56-3.4-7.56-7.56V64.55C17.82,60.4,21.22,57,25.38,57L25.38,57z M29.98,68.76h7.76l4.03,7l3.92-7h7.66l-7.07,11.02l7.74,11.73h-7.91l-4.47-7.31l-4.5,7.31h-7.85l7.85-11.86L29.98,68.76L29.98,68.76z M55.72,68.76H65l3.53,13.85l3.54-13.85h9.23v22.76h-5.75V74.17l-4.44,17.35H65.9l-4.43-17.35v17.35h-5.75V68.76L55.72,68.76z M85.31,68.76h7.03v17.16h11v5.59H85.31V68.76L85.31,68.76z M97.79,57h9.93c4.16,0,7.56,3.41,7.56,7.56v31.42c0,4.15-3.41,7.56-7.56,7.56h-9.93v13.55c0,1.61-.65,3.04-1.7,4.1c-1.06,1.06-2.49,1.7-4.1,1.7c-29.44,0-56.59,0-86.18,0c-1.61,0-3.04-.64-4.1-1.7c-1.06-1.06-1.7-2.49-1.7-4.1V5.85c0-1.61.65-3.04,1.7-4.1C2.77.69,4.2.05,5.81.05h58.72C64.66,0,64.8,0,64.94,0c.64,0,1.29.28,1.75.69h.09c.09.05.14.09.23.18l29.99,30.36c.51.51.88,1.2.88,1.98c0,.23-.05.41-.09.65V57L97.79,57z M67.52,27.97V8.94l21.43,21.7H70.19c-.74,0-1.38-.32-1.89-.78C67.84,29.4,67.52,28.71,67.52,27.97L67.52,27.97z"/></g></svg>';
            const addButton = (name, label, icon, xmlOnly) => editor.ui.componentFactory.add(name, (locale) => {
              const button = new ButtonView(locale);
              button.set({ label, icon: xmlOnly ? legacyXmlIcon : icon, tooltip: true });
              button.on('execute', () => openPasteDialog(xmlOnly));
              return button;
            });
            addButton('pasteWithFormatting', 'Paste with formatting', '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M16 3h-1.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H8a2 2 0 0 0-2 2v1H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8v-2H5V8h1v1a2 2 0 0 0 2 2h4v2h2v-2h2a2 2 0 0 0 2-2V8h1v5h2V8a2 2 0 0 0-2-2h-1V5a2 2 0 0 0-2-2m-4-1a1 1 0 0 1 1 1h-2a1 1 0 0 1 1-1m4 7H8V5h8zm6.71 8.29l-3 3a1 1 0 0 1-1.42 0l-1.5-1.5l1.42-1.42l.79.79L21.29 15z"/></svg>', false);
            addButton('xmlToHtml', 'Paste your XML', '<svg viewBox="0 0 115.28 122.88"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M25.38 57h64.88V37.34H69.59c-2.17 0-5.19-1.17-6.62-2.6-1.43-1.43-2.3-4.01-2.3-6.17V7.64H8.15c-.18 0-.32.09-.41.18-.15.14-.19.27-.19.42v106.45c0 .14.09.32.18.41.09.14.28.18.41.18h81.51c.18 0 .17-.09.27-.18.14-.09.33-.28.33-.41v-11.16H25.38c-4.14 0-7.56-3.4-7.56-7.56V64.55c0-4.15 3.4-7.55 7.56-7.55zm4.6 11.76h7.76l4.03 7 3.92-7h7.66l-7.07 11.02 7.74 11.73h-7.91l-4.47-7.31-4.5 7.31h-7.85l7.85-11.86-7.63-11.89zm25.74 0H65l3.53 13.85 3.54-13.85h9.23v22.76h-5.75V74.17l-4.44 17.35H65.9l-4.43-17.35v17.35h-5.75V68.76zm29.59 0h7.03v17.16h11v5.59H85.31V68.76zM97.79 57h9.93c4.16 0 7.56 3.41 7.56 7.56v31.42c0 4.15-3.41 7.56-7.56 7.56h-9.93v13.55c0 1.61-.65 3.04-1.7 4.1-1.06 1.06-2.49 1.7-4.1 1.7H5.81c-1.61 0-3.04-.64-4.1-1.7-1.06-1.06-1.7-2.49-1.7-4.1V5.85c0-1.61.65-3.04 1.7-4.1C2.77.69 4.2.05 5.81.05h58.72c.14 0 .28 0 .42.04.64 0 1.29.28 1.75.69h.09c.09.05.14.09.23.18l29.99 30.36c.51.51.88 1.2.88 1.98 0 .23-.05.41-.09.65V57zM67.52 27.97V8.94l21.43 21.7H70.19c-.74 0-1.38-.32-1.89-.78-.46-.46-.78-1.15-.78-1.89z"/></svg>', true);
          }
        }

        window.CKEDITOR = ClassicEditor;
        window.CKEDITOR.SamaritanPlugin = SamaritanPlugin;
        window.CKEDITOR.PasteToolsPlugin = PasteToolsPlugin;
        window.CKEDITOR.pluginsConfig = [
          Alignment, Autoformat, AutoLink, Autosave, BalloonToolbar, BlockQuote,
          BlockToolbar, Bold, Clipboard, Code, Essentials, FindAndReplace,
          Font, GeneralHtmlSupport, Heading, Highlight, Indent, IndentBlock, Image,
          ImageCaption, ImageResize, ImageStyle, ImageToolbar, ImageUpload,
          Base64UploadAdapter, Italic, Link, List, ListProperties, Paragraph,
          PasteFromOffice,
          SelectAll, ShowBlocks, SourceEditing, SpecialCharacters,
          SpecialCharactersArrows, SpecialCharactersCurrency, SpecialCharactersEssentials,
          SpecialCharactersLatin, SpecialCharactersMathematical, SpecialCharactersText,
          Strikethrough, Subscript, Superscript, TextTransformation,
          Table, TableCaption, TableCellProperties, TableProperties, TableToolbar,
          Underline, Undo
        ];
        window.CKEDITOR.instances = window.CKEDITOR.instances || [];
        window.CKEDITOR_LOADED = true;
        window.dispatchEvent(new Event('ckeditor5-loaded'));
      `;
      targetDocument.head.appendChild(moduleScript);

      const checkLoaded = () => {
        if (
          (targetWindow as any).CKEDITOR_LOADED &&
          (targetWindow as any).CKEDITOR &&
          Array.isArray((targetWindow as any).CKEDITOR.pluginsConfig) &&
          (targetWindow as any).CKEDITOR.PasteToolsPlugin
        ) {
          resolve();
          return true;
        }
        return false;
      };

      if (!checkLoaded()) {
        const onLoaded = () => {
          if (!checkLoaded()) return;
          targetWindow.removeEventListener("ckeditor5-loaded", onLoaded);
        };
        targetWindow.addEventListener("ckeditor5-loaded", onLoaded);
        const interval = setInterval(() => {
          if (checkLoaded()) {
            clearInterval(interval);
            targetWindow.removeEventListener("ckeditor5-loaded", onLoaded);
          }
        }, 30);
        setTimeout(() => {
          clearInterval(interval);
          targetWindow.removeEventListener("ckeditor5-loaded", onLoaded);
          if (!checkLoaded()) {
            if (isTop) loadPromise = null;
            else iframeLoadPromises.delete(targetWindow);
            reject(new Error("Timed out loading CKEditor 5"));
          }
        }, 4000);
      }
    } catch (err) {
      if (isTop) loadPromise = null;
      else iframeLoadPromises.delete(targetWindow);
      reject(err);
    }
  });

  if (isTop) {
    loadPromise = promise;
  } else {
    iframeLoadPromises.set(targetWindow, promise);
  }
  return promise;
}

// Standard colour palette shared by font colour/background colour and table
// border/background colour pickers — matches ckEditorManager.js exactly.
export const CKEDITOR_STANDARD_COLOUR_PALETTE = [
  { color: "hsl(0, 0%, 0%)", label: "Black" },
  { color: "hsl(0, 0%, 30%)", label: "Dim grey" },
  { color: "hsl(0, 0%, 60%)", label: "Grey" },
  { color: "hsl(0, 0%, 90%)", label: "Light grey" },
  { color: "hsl(0, 0%, 100%)", label: "White", hasBorder: true },
  { color: "hsl(0, 75%, 60%)", label: "Red" },
  { color: "hsl(30, 75%, 60%)", label: "Orange" },
  { color: "hsl(60, 75%, 60%)", label: "Yellow" },
  { color: "hsl(90, 75%, 60%)", label: "Light green" },
  { color: "hsl(120, 75%, 60%)", label: "Green" },
  { color: "hsl(150, 75%, 60%)", label: "Aquamarine" },
  { color: "hsl(180, 75%, 60%)", label: "Turquoise" },
  { color: "hsl(210, 75%, 60%)", label: "Light blue" },
  { color: "hsl(240, 75%, 60%)", label: "Blue" },
  { color: "hsl(270, 75%, 60%)", label: "Purple" },
];

// Shared with Quick Edit: keep every CKEditor surface on the same complete
// toolbar so paste/formatting/table/image options do not vary by location.
export const CKEDITOR_FULL_TOOLBAR_ITEMS = [
  "sourceEditing", "showBlocks", "|",
  "undo", "redo", "|",
  "findAndReplace", "selectAll", "|",
  "heading", "|",
  "insertTable", "|",
  "numberedList", "bulletedList", "|",
  "blockQuote", "|",
  "outdent", "indent", "|",
  "bold", "italic", "underline", "strikethrough", "|",
  "subscript", "superscript", "|",
  "alignment", "|",
  "link", "|",
  "fontColor", "fontBackgroundColor", "|",
  "specialCharacters", "|",
  "uploadImage", "|",
  "samaritan",
];

export const CKEDITOR_HEADING_CONFIG = {
  options: [
    { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
    ...[1, 2, 3, 4, 5, 6].map((level) => ({
      model: `heading${level}`,
      view: `h${level}`,
      title: `Heading ${level}`,
      class: `ck-heading_heading${level}`,
    })),
  ],
};

export const CKEDITOR_LIST_CONFIG = {
  properties: { styles: true, startIndex: true, reversed: true },
};

export const CKEDITOR_TABLE_CONFIG = {
  contentToolbar: [
    "tableColumn", "tableRow", "mergeTableCells", "|",
    "tableProperties", "tableCellProperties", "|", "toggleTableCaption",
  ],
};

export const CKEDITOR_IMAGE_CONFIG = {
  toolbar: [
    "imageStyle:inline", "imageStyle:block", "imageStyle:side", "|",
    "toggleImageCaption", "imageTextAlternative",
  ],
};
