// BlockNote schema for the storyboard editor.
//
// Default block set + headings limited to H1–H4 (spec AC4) + one generic
// placeholder block covering all non-native content kinds (spec AC5/AC6).

import {
  BlockNoteSchema,
  createHeadingBlockSpec,
  createStyleSpecFromTipTapMark,
  defaultBlockSpecs,
  defaultStyleSpecs,
} from '@blocknote/core';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { STORYBOARD_HEADING_LEVELS } from '@/types/storyboard';
import { placeholderBlock } from './blocks/placeholderBlock';
import { assessmentBlock } from './blocks/assessmentBlock';
import { componentBlock } from './blocks/componentBlock';

export const storyboardSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    // H1–H4 only (spec AC4). Default BlockNote exposes H1–H3.
    heading: createHeadingBlockSpec({ levels: STORYBOARD_HEADING_LEVELS }),
    // createReactBlockSpec returns a spec *factory* in v0.52 — call it here.
    sbComponent: componentBlock(), // rich content cards: Text/Grouped/Image/Video/Audio/H5P/Form (AC3)
    sbPlaceholder: placeholderBlock(), // interactive placeholders (AC6)
    sbAssessment: assessmentBlock(), // simplified assessment authoring (AC5)
  },
  // BlockNote ships NO subscript/superscript style at all (default set is
  // bold/italic/underline/strike/code/textColor/backgroundColor) — add them
  // via the same createStyleSpecFromTipTapMark wrapper BlockNote's own
  // bold/italic/underline/strike use, so parsing, rendering, and the
  // formatting toolbar's toggle behavior all come for free from the
  // official Tiptap extensions rather than a hand-rolled implementation.
  styleSpecs: {
    ...defaultStyleSpecs,
    subscript: createStyleSpecFromTipTapMark(Subscript, 'boolean'),
    superscript: createStyleSpecFromTipTapMark(Superscript, 'boolean'),
  },
});

export type StoryboardSchema = typeof storyboardSchema;
