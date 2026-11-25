// Source material for "Build with AI": Word / PDF / PowerPoint files the author
// attaches. Reads them through the same server-side import used by the
// storyboard (importStoryboardDocument -> /api/storyboard/documents/import/:format)
// and flattens the result to plain text for the Samaritan prompt. Nothing is
// stored; the text only rides along in the generation messages.

import { importStoryboardDocument, type ImportFormat } from "@/api/adaptAuthoring";
import { isDefaultSchemaTitle } from "@/components/storyboard/placeholderTitles";
import { friendlyFileError } from "@/components/samaritan/friendlyError";

export interface SourceFile {
  // Identifies one attachment, so a late response is matched to ITS entry and never
  // to another file that happens to share the name.
  id?: string;
  // name + size + modified time: the same file attached twice has the same key.
  key?: string;
  name: string;
  status: "reading" | "ready" | "error";
  text: string;
  error?: string;
}

// Keeps the prompt (and token cost) bounded no matter how large the upload is.
export const MAX_SOURCE_CHARS = 12000;

// Per-file and per-request limits shown to the author next to "Attach source material".
// The server accepts far larger uploads, but only the first MAX_SOURCE_CHARS of text are
// used, so a huge file only makes the author wait.
export const MAX_SOURCE_FILE_MB = 25;
// One file only: it gets the whole text budget, so the objectives reflect all of it.
export const MAX_SOURCE_FILES = 1;

// Below this much real text (after scaffolding is dropped) a file is treated as having
// no readable content, which is what a scanned, image-only PDF looks like.
export const MIN_SOURCE_CHARS = 100;

const FORMAT_BY_EXT: Record<string, ImportFormat> = { docx: "word", pdf: "pdf", pptx: "pptx" };
// Plain-text files need no server import: the browser reads them directly.
const PLAIN_TEXT_EXT = new Set(["txt", "md"]);
const KIND_BY_FORMAT: Record<ImportFormat, string> = { word: "Word", pdf: "PDF", pptx: "PowerPoint" } as Record<ImportFormat, string>;

// The extensions plus their MIME types, so pickers that filter by type (and not only by
// extension) hide everything else.
export const ACCEPTED_SOURCE_TYPES = [
  ".docx",
  ".pdf",
  ".pptx",
  ".txt",
  ".md",
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
].join(",");

export const SOURCE_LIMITS_HINT = `One file: Word, PowerPoint, PDF, text (.txt) or Markdown (.md), up to ${MAX_SOURCE_FILE_MB} MB`;

function extOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function formatFor(fileName: string): ImportFormat | null {
  return FORMAT_BY_EXT[extOf(fileName)] ?? null;
}

function isSupported(fileName: string): boolean {
  return !!formatFor(fileName) || PLAIN_TEXT_EXT.has(extOf(fileName));
}

export function sourceKey(f: { name: string; size: number; lastModified?: number }): string {
  return `${f.name.toLowerCase()}|${f.size}|${f.lastModified ?? 0}`;
}

/** Why a file cannot be attached, before anything is uploaded; null when it can. */
export function validateSourceFile(file: { name: string; size: number }): string | null {
  if (!isSupported(file.name)) {
    return `"${file.name}" isn't a supported file type. Attach a Word (.docx), PowerPoint (.pptx), PDF, text (.txt) or Markdown (.md) file.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_SOURCE_FILE_MB * 1024 * 1024) {
    return `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_SOURCE_FILE_MB} MB per file.`;
  }
  return null;
}

// Inline content is an array of runs, or - for a table - an object holding rows
// of cells, each cell being inline content (or a { content } wrapper). Walk all
// of those shapes recursively so table text reaches the prompt too.
function inlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(inlineText).join("");
  if (!content || typeof content !== "object") return "";
  const node = content as { text?: unknown; content?: unknown; rows?: unknown };
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.rows)) {
    return node.rows
      .map((row) => {
        const cells = (row as { cells?: unknown }).cells;
        return Array.isArray(cells) ? cells.map(inlineText).join(" | ") : inlineText(row);
      })
      .join("\n");
  }
  return inlineText(node.content);
}

export function blocksToPlainText(blocks: unknown[], depth = 0): string {
  const lines: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as { type?: string; props?: { level?: number }; content?: unknown; children?: unknown[] };
    const text = inlineText(b.content).trim();
    // The importer scaffolds a document with no text (a scanned PDF, for one) with
    // placeholder headings ("New Section", "New Content"). Those are not the author's words.
    const scaffold = b.type === "heading" && isDefaultSchemaTitle(text);
    if (text && !scaffold) lines.push(b.type === "heading" ? `${"#".repeat(Math.min(b.props?.level ?? 1, 3))} ${text}` : text);
    if (Array.isArray(b.children) && b.children.length) lines.push(blocksToPlainText(b.children, depth + 1));
  }
  return lines.filter(Boolean).join("\n");
}

/** How much real text a file yielded, ignoring whitespace and markdown heading marks. */
export function meaningfulLength(text: string): number {
  return text.replace(/^#+\s/gm, "").replace(/\s+/g, "").length;
}

export async function readSourceFile(file: File): Promise<SourceFile> {
  const key = sourceKey(file);
  const invalid = validateSourceFile(file);
  if (invalid) return { name: file.name, key, status: "error", text: "", error: invalid };
  const format = formatFor(file.name);
  try {
    const text = format ? blocksToPlainText((await importStoryboardDocument(format, file)).blocks ?? []) : (await file.text()).trim();
    if (meaningfulLength(text) < MIN_SOURCE_CHARS) {
      const scanned = format === "pdf" ? " If it is a scanned PDF, its pages are images and can't be read. Attach a text-based version instead." : "";
      return { name: file.name, key, status: "error", text: "", error: `No readable text found in this file.${scanned}` };
    }
    return { name: file.name, key, status: "ready", text };
  } catch (err) {
    console.warn("[build-with-ai] source file could not be read:", err);
    return { name: file.name, key, status: "error", text: "", error: friendlyFileError(err, format ? KIND_BY_FORMAT[format] : "text") };
  }
}

// Splits the character budget evenly across the files so one large document
// cannot crowd out the others.
export function composeSourceText(files: SourceFile[]): { text: string; truncated: boolean } {
  const ready = files.filter((f) => f.status === "ready");
  if (!ready.length) return { text: "", truncated: false };
  const budget = Math.floor(MAX_SOURCE_CHARS / ready.length);
  let truncated = false;
  const parts = ready.map((f) => {
    const clipped = f.text.length > budget;
    if (clipped) truncated = true;
    return `--- ${f.name} ---\n${clipped ? f.text.slice(0, budget) : f.text}`;
  });
  return { text: parts.join("\n\n"), truncated };
}
