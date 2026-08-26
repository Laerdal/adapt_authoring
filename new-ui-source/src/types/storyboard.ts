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
  | 'checklist'
  // results / summary — configured on the storyboard, rendered as a component
  | 'assessmentResult'
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
  groupedContent: { label: 'Grouped Content', category: 'group', adaptComponent: 'laerdal-narrative' },
  h5p: { label: 'H5P', category: 'media', adaptComponent: 'adapt-laerdal-h5p' },
  laerdalForm: { label: 'Laerdal Form', category: 'survey', adaptComponent: 'adapt-laerdal-form' },
  mcq: { label: 'MCQ', category: 'assessment', adaptComponent: 'adapt-contrib-mcq' },
  gmcq: { label: 'Graphic MCQ', category: 'assessment', adaptComponent: 'adapt-contrib-gmcq' },
  matching: { label: 'Matching', category: 'assessment', adaptComponent: 'adapt-contrib-matching' },
  reorder: { label: 'Sentence Reordering', category: 'assessment', adaptComponent: 'adapt-contrib-resequence' },
  textInput: { label: 'Text Input', category: 'assessment', adaptComponent: 'adapt-contrib-textInput' },
  slider: { label: 'Slider', category: 'assessment', adaptComponent: 'adapt-contrib-slider' },
  checklist: { label: 'Checklist', category: 'assessment', adaptComponent: 'adapt-laerdal-checklist' },
  assessmentResult: { label: 'Assessment Result', category: 'assessment', adaptComponent: 'adapt-contrib-assessmentResults' },
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

export const ASSESSMENT_KINDS = ['mcq', 'gmcq', 'matching', 'reorder', 'textInput', 'slider', 'checklist'] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

export function isAssessmentKind(kind: string): kind is AssessmentKind {
  return (ASSESSMENT_KINDS as readonly string[]).includes(kind);
}

export interface McqOption {
  text: string;
  correct: boolean;
  /** Optional image reference for Graphic MCQ (gmcq).
   *  `image` is the persisted link written to `_graphic.src` (either
   *  `course/assets/<file>` for a DAM asset or an external URL).
   *  `imageUrl` is the servable preview URL (`/api/asset/serve/<id>`) — not
   *  persisted; used only to render the picked asset in the editor.
   *  `imageAssetId` is the DAM asset id, retained so generation can create
   *  the courseasset publish link. */
  image?: string;
  imageUrl?: string;
  imageAssetId?: string;
  /** Answer-specific feedback shown when this option is selected. */
  feedback?: string;
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
/** Whole-question feedback (maps to Adapt `_feedback`). */
export interface AssessmentFeedback {
  correct: string;
  incorrect: string;
  incorrectNotFinal: string;
  partlyCorrectFinal: string;
  partlyCorrectNotFinal: string;
}

export interface AssessmentData {
  question: string;
  showTitle?: boolean;
  options?: McqOption[]; // mcq, gmcq, checklist
  pairs?: MatchPair[]; // matching
  items?: string[]; // reorder — array order is the correct order
  answers?: string[]; // textInput — acceptable answers
  slider?: SliderConfig; // slider
  feedback?: AssessmentFeedback; // whole-question feedback (all kinds)
  /** checklist only: how many items the learner may select (1 → single-choice). */
  selectable?: number;
}

export function emptyFeedback(): AssessmentFeedback {
  return { correct: '', incorrect: '', incorrectNotFinal: '', partlyCorrectFinal: '', partlyCorrectNotFinal: '' };
}

export function defaultAssessmentData(kind: AssessmentKind): AssessmentData {
  const base = { showTitle: true, feedback: emptyFeedback() };
  switch (kind) {
    case 'mcq':
    case 'gmcq':
      return {
        ...base,
        question: '',
        options: [
          { text: 'Correct answer', correct: true, feedback: '' },
          { text: 'Incorrect option', correct: false, feedback: '' },
          { text: 'Incorrect option', correct: false, feedback: '' },
        ],
      };
    case 'checklist':
      // Checklist behaves like MCQ but drives the `_selectable` count (how many
      // items are correct). Default: single-selection, one correct.
      return {
        ...base,
        question: '',
        selectable: 1,
        options: [
          { text: 'Correct answer', correct: true, feedback: '' },
          { text: 'Incorrect option', correct: false, feedback: '' },
          { text: 'Incorrect option', correct: false, feedback: '' },
        ],
      };
    case 'matching':
      return { ...base, question: '', pairs: [{ prompt: '', answer: '' }] };
    case 'reorder':
      return { ...base, question: '', items: ['', ''] };
    case 'textInput':
      return { ...base, question: '', answers: [''] };
    case 'slider':
      return { ...base, question: '', slider: { min: 0, max: 10, step: 1, correct: 5 } };
    default:
      return { ...base, question: '' };
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
    case 'checklist': {
      const opts = data.options ?? [];
      const filled = opts.filter((o) => o.text.trim());
      if (filled.length < 2) issues.push('Add at least two checklist items.');
      const correctCount = filled.filter((o) => o.correct).length;
      if (correctCount < 1) issues.push('Mark at least one item correct.');
      const selectable = Math.max(1, Number(data.selectable ?? 1));
      if (selectable > filled.length) issues.push('"Selectable" cannot exceed the number of items.');
      if (correctCount > selectable) issues.push('More correct items than the "Selectable" limit — raise the limit or unmark items.');
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

// Assessment card → Adapt question-component fields (`_items` + `_feedback` +
// per-kind extras). Shapes follow adapt-contrib question components; approximate
// where the exact Laerdal schema differs (verify against the installed plugin).
export function buildAssessmentFields(kind: AssessmentKind, data: AssessmentData): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const fb = data.feedback;
  if (fb) {
    patch._feedback = {
      correct: fb.correct,
      _incorrect: { final: fb.incorrect, notFinal: fb.incorrectNotFinal },
      _partlyCorrect: { final: fb.partlyCorrectFinal, notFinal: fb.partlyCorrectNotFinal },
    };
  }
  if (kind === 'mcq' || kind === 'gmcq') {
    patch._items = (data.options ?? []).map((o) => ({
      text: o.text,
      _shouldBeSelected: !!o.correct,
      feedback: o.feedback ?? '',
      ...(o.image ? { _graphic: { src: o.image, large: o.image, small: o.image, alt: o.text || '', attribution: '' } } : {}),
    }));
  } else if (kind === 'checklist') {
    // adapt-laerdal-checklist: `_items[].{ text, altText, _shouldBeSelected,
    // feedback }` + top-level `_selectable`.
    patch._items = (data.options ?? []).map((o) => ({
      text: o.text,
      altText: o.text,
      _shouldBeSelected: !!o.correct,
      feedback: o.feedback ?? '',
    }));
    patch._selectable = Math.max(1, Number(data.selectable ?? 1));
  } else if (kind === 'matching') {
    patch._items = (data.pairs ?? []).map((p) => ({
      text: p.prompt,
      _options: [{ text: p.answer, _isCorrect: true }],
    }));
  } else if (kind === 'reorder') {
    // adapt-laerdal-sentenceOrdering: `_items[].{ sentence, position }`.
    patch._items = (data.items ?? []).map((t, i) => ({ sentence: t, position: i + 1 }));
  } else if (kind === 'textInput') {
    patch._items = (data.answers ?? []).map((a) => ({ _answers: [a] }));
  } else if (kind === 'slider') {
    const s = data.slider;
    if (s) {
      patch._scaleStart = s.min;
      patch._scaleEnd = s.max;
      patch._scaleStep = s.step;
      patch._correctAnswer = s.correct;
    }
  }
  return patch;
}

// Inverse of buildAssessmentFields: reconstruct an AssessmentData card from a
// saved Adapt question component's `properties` (+ its `body` = question). Used
// by the reload/read-back path so questions round-trip as cards, not H4+text.
export function parseAssessmentData(
  kind: AssessmentKind,
  props: Record<string, unknown>,
  question: string
): AssessmentData {
  const p = props || {};
  const fb = (p._feedback as Record<string, unknown>) || {};
  const inc = (fb._incorrect as Record<string, unknown>) || {};
  const part = (fb._partlyCorrect as Record<string, unknown>) || {};
  const feedback: AssessmentFeedback = {
    correct: String(fb.correct ?? ''),
    incorrect: String(inc.final ?? ''),
    incorrectNotFinal: String(inc.notFinal ?? ''),
    partlyCorrectFinal: String(part.final ?? ''),
    partlyCorrectNotFinal: String(part.notFinal ?? ''),
  };
  const items = Array.isArray(p._items) ? (p._items as Array<Record<string, unknown>>) : [];
  const data: AssessmentData = { question, showTitle: true, feedback };

  if (kind === 'mcq' || kind === 'gmcq') {
    data.options = items.map((it) => {
      const g = (it._graphic as { large?: string; small?: string; src?: string }) || {};
      const link = g.large || g.small || g.src || undefined;
      // `image` is the persisted link and can legitimately be a
      // `course/assets/<file>` path (DAM-picked) which the authoring UI
      // cannot fetch directly. `imageUrl` is used to render the picker
      // preview via a plain `<img src>`, so it must be directly loadable
      // (external URL or absolute path). Leave it unset for DAM links so
      // the picker shows an empty tile rather than a broken image icon;
      // re-picking the asset repopulates a servable URL.
      const isServable = !!link && (/^(https?:)?\/\//i.test(link) || link.startsWith('/'));
      return {
        text: String(it.text ?? ''),
        correct: !!it._shouldBeSelected,
        feedback: it.feedback ? String(it.feedback) : undefined,
        image: link,
        imageUrl: isServable ? link : undefined,
      } as McqOption;
    });
  } else if (kind === 'checklist') {
    data.options = items.map((it) => ({
      text: String(it.text ?? ''),
      correct: !!it._shouldBeSelected,
      feedback: it.feedback ? String(it.feedback) : undefined,
    }));
    data.selectable = Math.max(1, Number(p._selectable ?? 1));
  } else if (kind === 'matching') {
    data.pairs = items.map((it) => {
      const opts = Array.isArray(it._options) ? (it._options as Array<Record<string, unknown>>) : [];
      return { prompt: String(it.text ?? ''), answer: String(opts[0]?.text ?? '') };
    });
  } else if (kind === 'reorder') {
    data.items = items
      .slice()
      .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
      .map((it) => String(it.sentence ?? it.text ?? ''));
  } else if (kind === 'textInput') {
    data.answers = items.map((it) => {
      const ans = Array.isArray(it._answers) ? (it._answers as unknown[]) : [];
      return String(ans[0] ?? '');
    });
  } else if (kind === 'slider') {
    data.slider = {
      min: Number(p._scaleStart ?? 0),
      max: Number(p._scaleEnd ?? 10),
      step: Number(p._scaleStep ?? 1),
      correct: Number(p._correctAnswer ?? 0),
    };
  }
  return data;
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
  /** Insert a pre-populated component card at the cursor (AI Assistance →
   *  Insert). `title` seeds the card title; `data` is merged into the card's
   *  default data (e.g. `{ description }` for a Text component). Returns the new
   *  block id so the caller can anchor follow-up actions (comments). */
  insertComponent(
    kind: StoryboardInsertKind,
    opts?: { title?: string; data?: Record<string, unknown> }
  ): string | null;
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
