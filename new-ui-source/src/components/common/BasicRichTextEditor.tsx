// Lightweight rich-text editor for simple inline formatting (bold, italic,
// underline, strikethrough, subscript, superscript) and AI assistance.
// Intended as a reusable drop-in for any form field that previously used a
// plain <textarea> but needs basic formatting parity with the legacy CKEditor
// Body field (Course Overview → Body, article summaries, etc.).
//
// This is intentionally NOT the full CKEditor 5 wrapper (see RichTextEditor.tsx).
// Use this when you want a small, dependency-free surface with just the core
// character-formatting commands.
//
// Design notes:
//   • contentEditable is uncontrolled internally so typing preserves the caret.
//     Parent should force a remount via `key` when the value must be reset
//     (e.g. after loading from the server or discarding unsaved changes).
//   • Paste is coerced to plain text so arbitrary markup/inline styles from the
//     source app cannot leak into the persisted HTML.
//   • Formatting uses `document.execCommand`, mirroring the existing
//     RichTextEditor used inside SetupPage's menu panel.

import { useCallback, useRef, useState } from "react";
import AiAssistPopover from "../storyboard/AiAssistPopover";
import SamaritanIcon from "../storyboard/SamaritanIcon";
import { aiResultToHtml, htmlToPlainText, normalizeAssistantText } from "../../utils/ckEditorSamaritan";

// ── Public helpers ──────────────────────────────────────────────────────────

/** True when a stored value already contains HTML markup. */
export function isProbablyHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/**
 * Normalize incoming value for the contentEditable surface. Plain text with
 * line breaks is converted to `<br>` so paragraph structure survives the
 * round-trip; existing HTML values are sanitized to a safe allowlist before
 * being assigned to `innerHTML`.
 */
export function normalizeHtmlForEditor(value: string): string {
  if (!value) return "";
  if (isProbablyHtml(value)) return sanitizeEditorHtml(value);
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br>");
}

export function sanitizeEditorHtml(rawHtml: string): string {
  const value = (rawHtml ?? "").trim();
  if (!value) return "";

  if (typeof document === "undefined") {
    const cleaned = value
      .replace(/<\s*(script|iframe|object|embed|svg|math|style|meta|link|base)\b[\s\S]*?(?:<\s*\/\s*\1\s*>|\/>)/gi, "")
      .replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+(style|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/(\s+(?:href|src)\s*=\s*)(?:"\s*(?:javascript:|vbscript:|data:text\/html)[^"]*"|'\s*(?:javascript:|vbscript:|data:text\/html)[^']*'|\s*(?:javascript:|vbscript:|data:text\/html)[^\s>]+)/gi, " ");

    return cleaned.trim() || "";
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = value;

  const allowedTags = new Set([
    "a", "b", "blockquote", "br", "code", "em", "i", "img", "li", "ol", "p",
    "s", "span", "strike", "strong", "sub", "sup", "table", "tbody", "td", "th",
    "thead", "tr", "u", "ul"
  ]);

  const allowedAttributes = new Set(["alt", "colspan", "href", "rowspan", "src", "title"]);

  const nodes = Array.from(wrapper.querySelectorAll("*"));
  for (const node of nodes) {
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (!allowedTags.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim();

      if (name.startsWith("on") || name === "style" || name === "srcdoc") {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (!allowedAttributes.has(name)) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if ((name === "href" || name === "src") && /^(javascript:|vbscript:|data:text\/html)/i.test(attributeValue)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  const sanitizedHtml = wrapper.innerHTML.trim();
  return sanitizedHtml && sanitizedHtml !== "<br>" ? sanitizedHtml : "";
}

/**
 * Treat browser-noise HTML like `<p><br></p>` or whitespace-only markup as
 * empty, so an untouched editor persists as an empty string rather than a
 * cosmetic paragraph node.
 */
export function isEditorEmpty(html: string): boolean {
  const source = (html ?? "").trim();
  if (!source) return true;

  const container = document.createElement("div");
  container.innerHTML = source;

  const meaningfulElement = container.querySelector(
    "img, video, audio, iframe, object, embed, svg, canvas, table, ul, ol, li, blockquote, hr, pre, code"
  );
  if (meaningfulElement) return false;

  const stripped = (container.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return stripped.length === 0;
}

// ── Component ───────────────────────────────────────────────────────────────

export interface BasicRichTextEditorProps {
  /** Current HTML value. Only read on mount / remount. */
  html: string;
  /** Called with the latest inner HTML after every user edit. */
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Minimum height of the editable area. Defaults to 96px. */
  minHeight?: number;
  /** Extra formatting commands to show alongside the defaults. */
  extraCommands?: FormatCommand[];
  /** Optional aria-label for the editable region. */
  ariaLabel?: string;
  /** Optional course context to send to Samaritan when the AI-action is used. */
  courseContext?: string;
}

export interface FormatCommand {
  cmd: string;
  title: string;
  icon: React.ReactNode;
}

// Two-tone x-with-baseline icons — mirrors the visual of CKEditor's sub/sup
// buttons without pulling in a heavier icon set.
const SubscriptIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6l7 10" />
    <path d="M11 6l-7 10" />
    <text x="15" y="20" fontSize="9" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="700">2</text>
  </svg>
);

const SuperscriptIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10l7 10" />
    <path d="M11 10l-7 10" />
    <text x="15" y="10" fontSize="9" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="700">2</text>
  </svg>
);

const ListBulletIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="7" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="7" cy="17" r="1.5" fill="currentColor" stroke="none" />
    <path d="M11 7h9" />
    <path d="M11 12h9" />
    <path d="M11 17h9" />
  </svg>
);

const ListNumberIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 7h10" />
    <path d="M10 12h10" />
    <path d="M10 17h10" />
    <path d="M4 7h.01" />
    <path d="M4 12h.01" />
    <path d="M4 17h.01" />
    <path d="M3 7V5h1" />
    <path d="M3 12h2" />
    <path d="M3 17h2" />
  </svg>
);

const DEFAULT_COMMANDS: FormatCommand[] = [
  {
    cmd: "bold", title: "Bold (Ctrl+B)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
        <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      </svg>
    ),
  },
  {
    cmd: "italic", title: "Italic (Ctrl+I)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="4" x2="10" y2="4" />
        <line x1="14" y1="20" x2="5" y2="20" />
        <line x1="15" y1="4" x2="9" y2="20" />
      </svg>
    ),
  },
  {
    cmd: "underline", title: "Underline (Ctrl+U)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
        <line x1="4" y1="21" x2="20" y2="21" />
      </svg>
    ),
  },
  {
    cmd: "strikeThrough", title: "Strikethrough",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.3 12H6.7" />
        <path d="M10 7.5C10 6.1 11.1 5 12.5 5c1 0 1.9.6 2.3 1.5" />
        <path d="M6 16.5C6 17.9 7.1 19 8.5 19h5.5a3 3 0 0 0 0-6H6" />
      </svg>
    ),
  },
  { cmd: "subscript", title: "Subscript", icon: SubscriptIcon },
  { cmd: "superscript", title: "Superscript", icon: SuperscriptIcon },
  { cmd: "insertUnorderedList", title: "Bullet list", icon: ListBulletIcon },
  { cmd: "insertOrderedList", title: "Numbered list", icon: ListNumberIcon },
];

// Commands whose active state we mirror in the toolbar.
const TOGGLE_COMMANDS = new Set([
  "bold", "italic", "underline", "strikeThrough", "subscript", "superscript",
]);

function sanitizeAiHtml(rawHtml: string): string {
  return sanitizeEditorHtml(rawHtml);
}

export default function BasicRichTextEditor({
  html,
  onChange,
  disabled,
  placeholder,
  minHeight = 96,
  extraCommands,
  ariaLabel,
  courseContext,
}: BasicRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const [focused, setFocused] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [samaritanOpen, setSamaritanOpen] = useState(false);
  const [samaritanSeedText, setSamaritanSeedText] = useState("");
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const initRef = useCallback((node: HTMLDivElement | null) => {
    editorRef.current = node;
    if (node) node.innerHTML = normalizeHtmlForEditor(html);
    // Only run when the node mounts; `html` is intentionally excluded so we
    // don't stomp on the caret while typing. Parent should bump `key` to reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncFormats = useCallback(() => {
    if (typeof document === "undefined") return;
    const next = new Set<string>();
    for (const cmd of TOGGLE_COMMANDS) {
      try {
        if (document.queryCommandState(cmd)) next.add(cmd);
      } catch {
        /* queryCommandState throws in some contexts; ignore */
      }
    }
    setActiveFormats(next);
  }, []);

  const emit = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const applyFormat = useCallback((cmd: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    syncFormats();
    emit();
  }, [disabled, emit, syncFormats]);

  const insertText = useCallback((text: string) => {
    if (disabled || !text) return;
    editorRef.current?.focus();
    // execCommand("insertText") preserves the caret, respects the current
    // formatting, and integrates with the browser's undo stack — the same
    // behaviour we get from typing.
    document.execCommand("insertText", false, text);
    emit();
    syncFormats();
  }, [disabled, emit, syncFormats]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "b") { e.preventDefault(); applyFormat("bold"); }
      else if (key === "i") { e.preventDefault(); applyFormat("italic"); }
      else if (key === "u") { e.preventDefault(); applyFormat("underline"); }
    }
  }, [disabled, applyFormat]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
    syncFormats();
  }, [emit, syncFormats]);

  const getEditorPlainText = useCallback(() => {
    const htmlText = editorRef.current?.innerHTML ?? "";
    return htmlToPlainText(htmlText);
  }, []);

  const getSeedTextForSamaritan = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return normalizeAssistantText(getEditorPlainText());
    }
    const range = selection.getRangeAt(0);
    if (!selection.isCollapsed && range.toString().trim()) {
      return normalizeAssistantText(range.toString());
    }
    return normalizeAssistantText(getEditorPlainText());
  }, [getEditorPlainText]);

  const storeSelectionForSamaritan = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      selectionRangeRef.current = null;
      return;
    }

    const range = selection.getRangeAt(0);
    if (editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
      selectionRangeRef.current = range.cloneRange();
      return;
    }

    selectionRangeRef.current = null;
  }, []);

  const applySamaritanResult = useCallback((text: string, mode: "insert" | "replace") => {
    if (!editorRef.current || !text) return;

    const html = sanitizeAiHtml(aiResultToHtml(text));
    if (!html) return;

    const editor = editorRef.current;
    const fallbackSelection = window.getSelection();
    const rangeFromSelection = fallbackSelection && fallbackSelection.rangeCount > 0
      ? fallbackSelection.getRangeAt(0)
      : null;

    const activeRange = selectionRangeRef.current && editor.contains(selectionRangeRef.current.startContainer)
      ? selectionRangeRef.current.cloneRange()
      : rangeFromSelection && editor.contains(rangeFromSelection.startContainer) && editor.contains(rangeFromSelection.endContainer)
        ? rangeFromSelection.cloneRange()
        : null;

    editor.focus();

    if (activeRange) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(activeRange);
      const finalRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      if (!finalRange) {
        if (mode === "replace") editor.innerHTML = html;
        else editor.insertAdjacentHTML("beforeend", html);
      } else if (mode === "replace") {
        if (finalRange.collapsed) {
          editor.innerHTML = html;
        } else {
          finalRange.deleteContents();
          finalRange.insertNode(finalRange.createContextualFragment(html));
        }
      } else {
        finalRange.insertNode(finalRange.createContextualFragment(html));
        finalRange.collapse(false);
      }
    } else if (mode === "replace") {
      editor.innerHTML = html;
    } else {
      editor.insertAdjacentHTML("beforeend", html);
    }

    emit();
    syncFormats();
  }, [emit, syncFormats]);

  const commands = extraCommands ? [...DEFAULT_COMMANDS, ...extraCommands] : DEFAULT_COMMANDS;

  const containerStyle: React.CSSProperties = {
    fontFamily: '"Lato", sans-serif',
    fontSize: 14,
    color: "var(--life-base-black)",
    background: disabled ? "var(--life-neutral-050)" : "#ffffff",
    border: `1px solid ${focused ? "var(--life-primary-500)" : "var(--life-neutral-400)"}`,
    borderRadius: 8,
    overflow: "hidden",
    transition: "border-color 0.15s",
    boxSizing: "border-box",
    opacity: disabled ? 0.7 : 1,
  };

  const buttonBaseStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background-color 0.12s, color 0.12s",
    padding: 0,
  };

  return (
    <div
      style={containerStyle}
      onMouseEnter={() => setToolbarVisible((value) => value || focused)}
      onMouseLeave={() => setToolbarVisible(focused)}
    >
      {toolbarVisible && (
        <div
          ref={toolbarRef}
          onFocusCapture={() => setToolbarVisible(true)}
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget as Node | null;
            const containsFocus = !!nextTarget && (
              (editorRef.current?.contains(nextTarget) ?? false) ||
              (toolbarRef.current?.contains(nextTarget) ?? false)
            );
            if (!containsFocus) setToolbarVisible(false);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "6px 8px",
            borderBottom: "1px solid var(--life-neutral-200)",
            background: "var(--life-neutral-020)",
          }}
        >
          {commands.map(({ cmd, title, icon }) => {
            const active = activeFormats.has(cmd);
            return (
              <button
                key={cmd}
                type="button"
                title={title}
                aria-label={title}
                aria-pressed={TOGGLE_COMMANDS.has(cmd) ? active : undefined}
                disabled={disabled}
                onMouseDown={(e) => { e.preventDefault(); applyFormat(cmd); }}
                style={{
                  ...buttonBaseStyle,
                  background: active ? "var(--life-primary-500)" : "transparent",
                  color: active ? "#ffffff" : "var(--life-neutral-500)",
                }}
                onMouseEnter={(e) => {
                  if (disabled || active) return;
                  e.currentTarget.style.background = "var(--life-neutral-100)";
                  e.currentTarget.style.color = "var(--life-base-black)";
                }}
                onMouseLeave={(e) => {
                  if (disabled || active) return;
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--life-neutral-500)";
                }}
              >
                {icon}
              </button>
            );
          })}

          <button
            type="button"
            title="Samaritan Assistance"
            aria-label="Samaritan Assistance"
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (disabled) return;
              storeSelectionForSamaritan();
              setSamaritanSeedText(getSeedTextForSamaritan());
              setSamaritanOpen(true);
            }}
            style={{
              ...buttonBaseStyle,
              background: "transparent",
              color: "var(--samaritan)",
            }}
            onMouseEnter={(e) => {
              if (disabled) return;
              e.currentTarget.style.background = "var(--life-neutral-100)";
              e.currentTarget.style.color = "var(--samaritan)";
            }}
            onMouseLeave={(e) => {
              if (disabled) return;
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--samaritan)";
            }}
          >
            <SamaritanIcon className="h-4 w-4" monochrome />
          </button>
        </div>
      )}

      {samaritanOpen && (
        <AiAssistPopover
          initialText={samaritanSeedText}
          courseContext={courseContext}
          onInsert={(text) => {
            applySamaritanResult(text, "insert");
            setSamaritanOpen(false);
          }}
          onReplace={(text) => {
            applySamaritanResult(text, "replace");
            setSamaritanOpen(false);
          }}
          onClose={() => setSamaritanOpen(false)}
        />
      )}

      {/* Editable surface */}
      <div
        ref={initRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        dir="ltr"
        data-placeholder={placeholder}
        onInput={() => { emit(); syncFormats(); }}
        onKeyDown={handleKeyDown}
        onKeyUp={syncFormats}
        onMouseUp={syncFormats}
        onPaste={handlePaste}
        onFocus={() => { setFocused(true); setToolbarVisible(true); syncFormats(); }}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget as Node | null;
          const containsFocus = !!nextTarget && (
            (editorRef.current?.contains(nextTarget) ?? false) ||
            (toolbarRef.current?.contains(nextTarget) ?? false)
          );
          setFocused(false);
          setToolbarVisible(containsFocus);
        }}
        className="empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--life-neutral-400)]"
        style={{
          minHeight,
          padding: "10px 14px",
          outline: "none",
          wordBreak: "break-word",
          direction: "ltr",
          unicodeBidi: "plaintext",
          textAlign: "left",
          lineHeight: 1.5,
          fontFamily: "inherit",
          fontSize: 14,
          color: "var(--life-base-black)",
        }}
      />
    </div>
  );
}
