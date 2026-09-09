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
    if (window.CKEDITOR_LOADED && window.CKEDITOR) return Promise.resolve();
    if (loadPromise) return loadPromise;
  } else {
    if ((targetWindow as any).CKEDITOR_LOADED && (targetWindow as any).CKEDITOR) return Promise.resolve();
    const existing = iframeLoadPromises.get(targetWindow);
    if (existing) return existing;
  }

  const targetDocument = targetWindow.document;
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
          .ck.ck-editor__main, .ck.ck-editor__editable, .ck.ck-content {
            display: block !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important;
          }
          .ck.ck-toolbar { width: 100% !important; box-sizing: border-box !important; flex-wrap: wrap !important; row-gap: 2px; }
          .ck.ck-toolbar__items { flex-wrap: wrap !important; }
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
          ClassicEditor, Alignment, AutoLink, BlockQuote, Bold, Code, Essentials,
          FindAndReplace, Font, GeneralHtmlSupport, Heading, Indent, IndentBlock,
          Image, ImageCaption, ImageResize, ImageStyle, ImageToolbar, ImageUpload,
          Base64UploadAdapter, Italic, Link, List, ListProperties, Paragraph,
          SelectAll, ShowBlocks, SourceEditing, SpecialCharacters,
          SpecialCharactersEssentials, Strikethrough, Subscript, Superscript,
          Table, TableCaption, TableCellProperties, TableProperties, TableToolbar,
          Underline, Undo, Plugin, ButtonView
        } from 'ckeditor5';

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
              // Icon-only, matching every other toolbar button (a sparkle,
              // consistent with the app's existing Samaritan AI branding).
              button.set({
                label: 'Samaritan Assistance',
                icon: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 1.5l1.9 5.7 5.7 1.9-5.7 1.9L10 16.7l-1.9-5.7-5.7-1.9 5.7-1.9L10 1.5z" fill="currentColor"/></svg>',
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

        window.CKEDITOR = ClassicEditor;
        window.CKEDITOR.SamaritanPlugin = SamaritanPlugin;
        window.CKEDITOR.pluginsConfig = [
          Alignment, AutoLink, BlockQuote, Bold, Code, Essentials, FindAndReplace,
          Font, GeneralHtmlSupport, Heading, Indent, IndentBlock, Image,
          ImageCaption, ImageResize, ImageStyle, ImageToolbar, ImageUpload,
          Base64UploadAdapter, Italic, Link, List, ListProperties, Paragraph,
          SelectAll, ShowBlocks, SourceEditing, SpecialCharacters,
          SpecialCharactersEssentials, Strikethrough, Subscript, Superscript,
          Table, TableCaption, TableCellProperties, TableProperties, TableToolbar,
          Underline, Undo
        ];
        window.CKEDITOR.instances = window.CKEDITOR.instances || [];
        window.CKEDITOR_LOADED = true;
        window.dispatchEvent(new Event('ckeditor5-loaded'));
      `;
      targetDocument.head.appendChild(moduleScript);

      if ((targetWindow as any).CKEDITOR_LOADED) {
        resolve();
      } else {
        targetWindow.addEventListener("ckeditor5-loaded", () => resolve(), { once: true });
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
