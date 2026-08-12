// Storyboard authoring — engine-agnostic types (ADAPT-3760).
//
// These types deliberately do NOT reference BlockNote. They are the seam
// described in the spike brief: TOC / toolbar / review / (future) generation
// code depends only on this module, so swapping the editor engine (BlockNote →
// TipTap) is a contained change in `components/storyboard/`.

/** Adapt content level a storyboard heading maps to (spec AC4). */
export type AdaptStructureType = 'topic' | 'section' | 'contentGroup' | 'component';

/**
 * Heading level → Adapt structure (spec AC4):
 *   H1 → Topic (contentobject/page), H2 → Section (article),
 *   H3 → Content Group (block), H4 → Component title.
 */
export const HEADING_LEVEL_TO_ADAPT: Record<number, AdaptStructureType> = {
  1: 'topic',
  2: 'section',
  3: 'contentGroup',
  4: 'component',
};

/** Heading levels the storyboard editor exposes (H1–H4 → the 4-level map). */
export const STORYBOARD_HEADING_LEVELS: readonly number[] = [1, 2, 3, 4];

/** Clamp any heading level to a known Adapt structure type. */
export function adaptTypeForLevel(level: number): AdaptStructureType {
  return HEADING_LEVEL_TO_ADAPT[level] ?? 'component';
}

/** A heading extracted from the document (drives the TOC — AC1). */
export interface StoryboardHeading {
  /** Stable block id — TOC scroll/anchor + comment anchoring (AC9). */
  id: string;
  level: number;
  text: string;
  adaptType: AdaptStructureType;
}

/** Review workflow status (spec AC8). */
export type ReviewStatus = 'draft' | 'in_review' | 'approved';

/**
 * Content that can be inserted from the "Add Content" menu (spec AC3/AC5/AC6).
 * Neutral kinds; the editor maps each to its concrete block(s).
 */
export type StoryboardInsertKind =
  // text & visual
  | 'text'
  | 'groupedContent'
  | 'image'
  // media
  | 'video'
  | 'audio'
  | 'h5p'
  // survey
  | 'laerdalForm'
  // assessment (AC5)
  | 'mcq'
  | 'gmcq'
  | 'matching'
  | 'reorder'
  | 'textInput'
  | 'slider'
  // interactive placeholders (AC6)
  | 'hotgraphic'
  | 'hotgrid'
  | 'actionplan'
  // structural / helper
  | 'heading'
  | 'instruction';

/** Category a placeholder block belongs to (drives its rendered style). */
export type PlaceholderCategory =
  | 'group'
  | 'media'
  | 'survey'
  | 'assessment'
  | 'interactive'
  | 'instruction';

/** Metadata for every non-native insert kind: label, category, Adapt component. */
export const INSERT_META: Record<
  Exclude<StoryboardInsertKind, 'text' | 'image' | 'video' | 'audio' | 'heading'>,
  { label: string; category: PlaceholderCategory; adaptComponent: string }
> = {
  groupedContent: { label: 'Grouped Content', category: 'group', adaptComponent: 'block' },
  h5p: { label: 'H5P', category: 'media', adaptComponent: 'adapt-laerdal-h5p' },
  laerdalForm: { label: 'Laerdal Form', category: 'survey', adaptComponent: 'adapt-laerdal-form' },
  mcq: { label: 'MCQ', category: 'assessment', adaptComponent: 'adapt-contrib-mcq' },
  gmcq: { label: 'Graphic MCQ', category: 'assessment', adaptComponent: 'adapt-contrib-gmcq' },
  matching: { label: 'Matching', category: 'assessment', adaptComponent: 'adapt-contrib-matching' },
  reorder: { label: 'Sentence Reordering', category: 'assessment', adaptComponent: 'adapt-contrib-textInput' },
  textInput: { label: 'Text Input', category: 'assessment', adaptComponent: 'adapt-contrib-textInput' },
  slider: { label: 'Slider', category: 'assessment', adaptComponent: 'adapt-contrib-slider' },
  hotgraphic: { label: 'Hot Graphic', category: 'interactive', adaptComponent: 'adapt-contrib-hotgraphic' },
  hotgrid: { label: 'Hot Grid', category: 'interactive', adaptComponent: 'adapt-laerdal-hotgrid' },
  actionplan: { label: 'Laerdal Action Plan', category: 'interactive', adaptComponent: 'adapt-laerdal-actionplan' },
  instruction: { label: 'Instruction', category: 'instruction', adaptComponent: 'instruction' },
};

// ── Assessment authoring model (spec AC5) ───────────────────────────────────
// Simplified, generation-ready data captured by the assessment block. Advanced
// settings (feedback, scoring, attempts) are deliberately omitted — they are
// configured later in the Page Editor. The Phase 4 generator maps this onto the
// concrete Adapt component `properties`.

export const ASSESSMENT_KINDS = ['mcq', 'gmcq', 'matching', 'reorder', 'textInput', 'slider'] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

export function isAssessmentKind(kind: string): kind is AssessmentKind {
  return (ASSESSMENT_KINDS as readonly string[]).includes(kind);
}

export interface McqOption {
  text: string;
  correct: boolean;
  /** Optional image reference for Graphic MCQ (gmcq). */
  image?: string;
}
export interface MatchPair {
  prompt: string;
  answer: string;
}
export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  correct: number;
}

export interface AssessmentData {
  question: string;
  options?: McqOption[]; // mcq, gmcq
  pairs?: MatchPair[]; // matching
  items?: string[]; // reorder — array order is the correct order
  answers?: string[]; // textInput — acceptable answers
  slider?: SliderConfig; // slider
}

export function defaultAssessmentData(kind: AssessmentKind): AssessmentData {
  switch (kind) {
    case 'mcq':
    case 'gmcq':
      return {
        question: '',
        options: [
          { text: '', correct: true },
          { text: '', correct: false },
        ],
      };
    case 'matching':
      return { question: '', pairs: [{ prompt: '', answer: '' }] };
    case 'reorder':
      return { question: '', items: ['', ''] };
    case 'textInput':
      return { question: '', answers: [''] };
    case 'slider':
      return { question: '', slider: { min: 0, max: 10, step: 1, correct: 5 } };
    default:
      return { question: '' };
  }
}

/** Return a list of human-readable issues; empty ⇒ generation-ready (AC5). */
export function validateAssessment(kind: AssessmentKind, data: AssessmentData): string[] {
  const issues: string[] = [];
  if (!data.question || !data.question.trim()) issues.push('Question text is required.');

  switch (kind) {
    case 'mcq':
    case 'gmcq': {
      const opts = data.options ?? [];
      const filled = opts.filter((o) => o.text.trim());
      if (filled.length < 2) issues.push('Add at least two answer options.');
      if (!filled.some((o) => o.correct)) issues.push('Mark at least one option correct.');
      break;
    }
    case 'matching': {
      const pairs = (data.pairs ?? []).filter((p) => p.prompt.trim() && p.answer.trim());
      if (pairs.length < 1) issues.push('Add at least one complete prompt/answer pair.');
      break;
    }
    case 'reorder': {
      const items = (data.items ?? []).filter((i) => i.trim());
      if (items.length < 2) issues.push('Add at least two items to reorder.');
      break;
    }
    case 'textInput': {
      const answers = (data.answers ?? []).filter((a) => a.trim());
      if (answers.length < 1) issues.push('Add at least one acceptable answer.');
      break;
    }
    case 'slider': {
      const s = data.slider;
      if (!s) issues.push('Configure the slider range.');
      else {
        if (s.min >= s.max) issues.push('Minimum must be less than maximum.');
        if (s.correct < s.min || s.correct > s.max) issues.push('Correct value must be within the range.');
        if (s.step <= 0) issues.push('Step must be greater than zero.');
      }
      break;
    }
  }
  return issues;
}

/** Rollup counts for the Review Center summary + AI guidance (AC7/AC8). */
export interface StoryboardSummary {
  topics: number;
  sections: number;
  contentItems: number;
  assets: number;
  textBlocks: number;
  hasVisual: boolean;
  hasAssessment: boolean;
}

/** Persisted document — opaque; owned by the active editor engine. */
export type StoryboardDocument = unknown;

/** Imperative handle exposed by any storyboard editor implementation. */
export interface StoryboardEditorHandle {
  getDocument(): StoryboardDocument;
  setDocument(doc: StoryboardDocument): void;
  getHeadings(): StoryboardHeading[];
  getSummary(): StoryboardSummary;
  /** Insert content at the cursor (Add Heading / Add Content / Add Instruction).
   *  `opts.level` sets the heading level (H1–H3) when `kind === 'heading'`. */
  insert(kind: StoryboardInsertKind, opts?: { level?: number }): void;
  /** Plain text of the block at the cursor (for AI actions, AC7). */
  getActiveText(): string;
  /** Replace the cursor block's content with `text` (Improve / Rewrite). */
  replaceActive(text: string): void;
  /** Insert a paragraph after the cursor block (Summarize / Suggest). */
  insertAfterActive(text: string): void;
  /** Scroll to / select a block by id (TOC navigation, AC1). */
  focusBlock(blockId: string): void;
}

/** The block the cursor is currently in (drives block-anchored comments, AC9). */
export interface ActiveBlockInfo {
  id: string;
  text: string;
  type: string;
}

/** Props accepted by any storyboard editor implementation. */
export interface StoryboardEditorProps {
  initialDocument?: StoryboardDocument;
  editable?: boolean;
  onChange?: (doc: StoryboardDocument, headings: StoryboardHeading[]) => void;
  /** Reports the active (cursor) block so the Review panel can anchor comments. */
  onActiveBlock?: (block: ActiveBlockInfo | null) => void;
}
