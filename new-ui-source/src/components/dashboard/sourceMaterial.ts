// Source material for "Build with AI": Word / PDF / PowerPoint files the author
// attaches. Reads them through the same server-side import used by the
// storyboard (importStoryboardDocument -> /api/storyboard/documents/import/:format)
// and flattens the result to plain text for the Samaritan prompt. Nothing is
// stored; the text only rides along in the generation messages.

import { importStoryboardDocument, type ImportFormat } from "@/api/adaptAuthoring";

export interface SourceFile {
  name: string;
  status: "reading" | "ready" | "error";
  text: string;
  error?: string;
}

// Keeps the prompt (and token cost) bounded no matter how large the upload is.
export const MAX_SOURCE_CHARS = 12000;

const FORMAT_BY_EXT: Record<string, ImportFormat> = { docx: "word", pdf: "pdf", pptx: "pptx" };

export const ACCEPTED_SOURCE_TYPES = ".docx,.pdf,.pptx";

export function formatFor(fileName: string): ImportFormat | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return FORMAT_BY_EXT[ext] ?? null;
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
    if (text) lines.push(b.type === "heading" ? `${"#".repeat(Math.min(b.props?.level ?? 1, 3))} ${text}` : text);
    if (Array.isArray(b.children) && b.children.length) lines.push(blocksToPlainText(b.children, depth + 1));
  }
  return lines.filter(Boolean).join("\n");
}

export async function readSourceFile(file: File): Promise<SourceFile> {
  const format = formatFor(file.name);
  if (!format) return { name: file.name, status: "error", text: "", error: "Only Word (.docx), PDF and PowerPoint (.pptx) files are supported." };
  try {
    const result = await importStoryboardDocument(format, file);
    const text = blocksToPlainText(result.blocks ?? []);
    if (!text.trim()) return { name: file.name, status: "error", text: "", error: "No readable text was found in this file." };
    return { name: file.name, status: "ready", text };
  } catch (err) {
    return { name: file.name, status: "error", text: "", error: err instanceof Error ? err.message : "Could not read this file." };
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
