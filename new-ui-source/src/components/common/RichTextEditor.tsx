// Real CKEditor 5 rich-text field — replaces the plain <textarea> previously
// used for every schema field with `inputType: "TextArea"` (the old tool's
// Backbone Forms override at frontend/src/modules/scaffold/backboneFormsOverrides.js
// globally replaces `editors.TextArea.render` with a CKEditor instance for
// EXACTLY those fields, nothing else — so mirroring that inputType check is
// enough to know where CKEditor belongs vs a plain input).
//
// Toolbar mirrors ckEditorManager.js (Laerdal-Medical/adapt-framework-plugins
// extensions/adapt-preview-edit — the same CDN-loaded CKEditor 5 build used by
// Quick Edit) plus a "Samaritan Assistance" button wired to the existing
// AiAssistPopover/samaritanAssist (already built for Storyboard) instead of
// re-porting the old tool's bespoke AiAgentPlugin.
import { useEffect, useRef, useState } from "react";
import AiAssistPopover from "../storyboard/AiAssistPopover";
import { loadCKEditor5, CKEDITOR_STANDARD_COLOUR_PALETTE } from "../../utils/ckEditor5Loader";

const TOOLBAR_ITEMS = [
  "sourceEditing", "showBlocks", "|",
  "undo", "redo", "|",
  "findAndReplace", "|",
  "heading", "|",
  "bold", "italic", "underline", "strikethrough", "subscript", "superscript", "|",
  "alignment", "|",
  "numberedList", "bulletedList", "outdent", "indent", "|",
  "blockQuote", "insertTable", "link", "|",
  "fontColor", "fontBackgroundColor", "|",
  "specialCharacters", "uploadImage", "|",
  "samaritan",
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  courseContext,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  courseContext?: string;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [samaritanOpen, setSamaritanOpen] = useState(false);
  const [samaritanSeedText, setSamaritanSeedText] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadCKEditor5();
        if (cancelled || !containerRef.current) return;
        const CKEDITOR = (window as any).CKEDITOR;
        const editor = await CKEDITOR.create(containerRef.current, {
          plugins: [...CKEDITOR.pluginsConfig, CKEDITOR.SamaritanPlugin],
          toolbar: { items: TOOLBAR_ITEMS, shouldNotGroupWhenFull: true },
          fontColor: { colors: CKEDITOR_STANDARD_COLOUR_PALETTE },
          fontBackgroundColor: { colors: CKEDITOR_STANDARD_COLOUR_PALETTE },
          htmlSupport: { allow: [{ name: /.*/, attributes: true, classes: true, style: true, styles: true }] },
          initialData: value || "",
          samaritanOnClick: (ed: any) => {
            const selection = ed.model.document.selection;
            const selectedText = !selection.isCollapsed
              ? Array.from(selection.getFirstRange()?.getItems() ?? [])
                  .map((item: any) => (item.is?.("$textProxy") ? item.data : ""))
                  .join("")
              : "";
            setSamaritanSeedText(selectedText || ed.getData().replace(/<[^>]+>/g, " ").trim());
            setSamaritanOpen(true);
          },
        });
        if (cancelled) {
          editor.destroy();
          return;
        }
        editor.model.document.on("change:data", () => {
          onChangeRef.current(editor.getData());
        });
        editorRef.current = editor;
        setReady(true);
      } catch (err) {
        console.warn("Failed to load CKEditor 5", err);
      }
    })();
    return () => {
      cancelled = true;
      if (editorRef.current) {
        editorRef.current.destroy().catch(() => {});
        editorRef.current = null;
      }
    };
    // Only ever created once per mount — external `value` changes after
    // creation are intentionally not pushed back in (matches the old tool:
    // the field is the source of truth once the editor exists).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.isReadOnly = !!disabled;
    }
  }, [disabled]);

  const applySamaritanResult = (text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = /<[a-z][\s\S]*>/i.test(text)
      ? text
      : text.split(/\n{2,}/).map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`).join("");
    editor.setData(html);
    onChangeRef.current(html);
  };

  return (
    <div className="rich-text-editor-field">
      <div ref={containerRef} />
      {!ready && <div className="text-[12px] text-[#9ca3af] px-1 py-1">Loading editor…</div>}
      {samaritanOpen && (
        <AiAssistPopover
          initialText={samaritanSeedText}
          courseContext={courseContext}
          onInsert={applySamaritanResult}
          onReplace={applySamaritanResult}
          onClose={() => setSamaritanOpen(false)}
        />
      )}
    </div>
  );
}
