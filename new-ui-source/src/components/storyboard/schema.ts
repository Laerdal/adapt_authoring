// BlockNote schema for the storyboard editor.
//
// Default block set + headings limited to H1–H4 (spec AC4) + one generic
// placeholder block covering all non-native content kinds (spec AC5/AC6).

import {
  BlockNoteSchema,
  createHeadingBlockSpec,
  defaultBlockSpecs,
} from '@blocknote/core';
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
});

export type StoryboardSchema = typeof storyboardSchema;
