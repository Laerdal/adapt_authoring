// Shared CKEditor 5 helpers used by EVERY CKEditor surface in the new UI
// (the right panel's RichTextEditor and the page editor canvas's inline body
// editors) so Samaritan Assistance and the link tool behave identically
// everywhere, and match the old authoring tool
// (frontend/src/modules/scaffold/backboneFormsOverrides.js).
//
// Quick Edit (Laerdal-Medical/adapt-framework-plugins, extensions/
// adapt-preview-edit/js/ckEditorManager.js) keeps a plain-JS copy of the same
// logic — it has no bundler and cannot import from here.

// Link config copied verbatim from the old tool's CKEditor.create options, so
// the link balloon offers the same "Open in a new tab" decorator and applies
// the same default protocol/target handling.
export const CKEDITOR_LINK_CONFIG = {
  addTargetToExternalLinks: true,
  defaultProtocol: "https://",
  decorators: {
    openInNewTab: {
      mode: "manual",
      label: "Open in a new tab",
      attributes: {
        target: "_blank",
        rel: "noopener noreferrer",
      },
    },
  },
} as const;

// Windows-1252 code points that a UTF-8 byte in 0x80-0x9F turns into when it
// has been mis-decoded — needed to map mojibake back to its original bytes.
const CP1252_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

// Repair text whose UTF-8 bytes were decoded as Latin-1/Windows-1252
// somewhere upstream ("naïve" arriving as "naÃ¯ve"). Deliberately
// conservative: it only runs when a classic mojibake marker is present, and
// any character that cannot be mapped back to a single byte — or a byte
// sequence that is not valid UTF-8 — leaves the text completely untouched, so
// genuinely accented content is never mangled.
export function repairMojibake(text: string): string {
  const value = String(text ?? "");
  if (!value || !/[ÃÂÐÑ×Øâ]/.test(value)) return value;
  try {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code <= 0xff) bytes[i] = code;
      else if (CP1252_TO_BYTE[code] !== undefined) bytes[i] = CP1252_TO_BYTE[code];
      else return value;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

// Normalise text for display/processing in the Samaritan popover: repair any
// mojibake, turn non-breaking spaces into ordinary ones and drop zero-width
// characters, then tidy runs of whitespace.
export function normalizeAssistantText(text: string): string {
  return repairMojibake(text)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Convert editor HTML to plain text the way the old tool's getEditorPlainText
// does — via a real DOM node, so HTML entities (&nbsp;, &amp;, &#233;, …) are
// decoded instead of surviving as literal text the way a regex tag-strip
// leaves them.
export function htmlToPlainText(html: string): string {
  const source = String(html ?? "");
  if (!source) return "";
  const holder = document.createElement("div");
  holder.innerHTML = source
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(?:p|div|li|h[1-6]|tr|blockquote)\s*>/gi, "\n");
  return normalizeAssistantText(holder.textContent || "");
}

// Text to seed the Samaritan popover with: the current selection if there is
// one, otherwise the whole field (matching the old tool's select-all-on-open
// behaviour).
export function getSamaritanSeedText(editor: any): string {
  try {
    const selection = editor?.model?.document?.selection;
    let selected = "";
    if (selection && !selection.isCollapsed) {
      const range = selection.getFirstRange();
      for (const item of range ? range.getItems() : []) {
        if (item?.is?.("$textProxy")) selected += item.data;
      }
    }
    if (selected.trim()) return normalizeAssistantText(selected);
    return htmlToPlainText(typeof editor?.getData === "function" ? editor.getData() : "");
  } catch {
    return "";
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Samaritan returns plain text (or, occasionally, HTML). Wrap plain text in
// paragraphs per blank line, like the old tool's markdown-to-HTML step.
export function aiResultToHtml(text: string): string {
  const value = String(text ?? "");
  if (!value.trim()) return "";
  if (/<[a-z][\s\S]*>/i.test(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function toModelFragment(editor: any, html: string) {
  return editor.data.toModel(editor.data.processor.toView(html));
}

// Insert the result at the caret, keeping the rest of the field intact
// (old tool: AiAgentPlugin's Insert button).
export function insertAiResultIntoEditor(editor: any, text: string): void {
  const html = aiResultToHtml(text);
  if (!editor || !html) return;
  try {
    editor.model.change(() => {
      const position = editor.model.document.selection.getLastPosition();
      editor.model.insertContent(toModelFragment(editor, html), position);
    });
  } catch {
    editor.setData(`${editor.getData() || ""}${html}`);
  }
}

// Replace the selection with the result — or the whole field when nothing is
// selected (old tool: AiAgentPlugin's Replace button, which selects the whole
// document when the popover opens with no selection).
export function replaceAiResultInEditor(editor: any, text: string): void {
  const html = aiResultToHtml(text);
  if (!editor || !html) return;
  try {
    if (editor.model.document.selection.isCollapsed) {
      editor.setData(html);
      return;
    }
    editor.model.change(() => {
      editor.model.deleteContent(editor.model.document.selection);
      editor.model.insertContent(toModelFragment(editor, html));
    });
  } catch {
    editor.setData(html);
  }
}
