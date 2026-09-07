// Types for Storyboard document import (ADAPT-3760 import/re-import).
// Mirrors the plain-JSON NormalizedDocument shape produced by the backend
// normalizers (plugins/content/storyboard/utils/normalize/*.js) — this repo
// has no cross-language type-sharing build step (documentJson's shape is
// likewise independently described on both sides), so these interfaces are
// kept in sync with the backend by convention, not by import.

export type ImportSourceFileType = 'docx' | 'pdf' | 'pptx';
export type ImportFidelity = 'high' | 'lower';

export interface ImportSourceReference {
  pageNumber?: number;
  slideNumber?: number;
  paragraphIndex?: number;
}

export interface ImportWarning {
  code: string;
  message: string;
  sourceReference?: ImportSourceReference;
}

export interface NormalizedDocumentMetadata {
  sourceFileName: string;
  sourceFileType: ImportSourceFileType;
  importedAt: string;
  fidelity: ImportFidelity;
  warnings: ImportWarning[];
  documentTitle?: string;
  courseId?: string;
  storyboardId?: string;
  exportSchemaVersion?: string;
}

export interface NormalizedInlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  link?: string;
}

export type NormalizedBlock =
  | { kind: 'heading'; level: number; inline: NormalizedInlineRun[] }
  | { kind: 'paragraph'; inline: NormalizedInlineRun[] }
  | { kind: 'quote'; inline: NormalizedInlineRun[] }
  | { kind: 'bulletListItem'; inline: NormalizedInlineRun[]; children?: NormalizedBlock[] }
  | { kind: 'numberedListItem'; inline: NormalizedInlineRun[]; children?: NormalizedBlock[] }
  | { kind: 'table'; rows: NormalizedInlineRun[][][] }
  | { kind: 'image'; src: string; alt?: string; sourceReference?: ImportSourceReference }
  | { kind: 'unsupported'; originalTag?: string; note?: string; fallbackText?: string; sourceReference?: ImportSourceReference };

export interface NormalizedSection {
  id: string;
  level: number;
  title: string;
  blocks: NormalizedBlock[];
  children?: NormalizedSection[];
  sourceReference?: ImportSourceReference;
}

export interface NormalizedDocument {
  metadata: NormalizedDocumentMetadata;
  sections: NormalizedSection[];
}

/** How imported content should be merged into the current storyboard. */
export type ImportMode = 'new' | 'append' | 'replace' | 'reimport';

export interface ImportResult {
  normalizedDocument: NormalizedDocument | null;
  blocks: unknown[];
}
