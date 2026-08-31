// Storyboard placeholder-title filtering (ADAPT-3785).
//
// Adapt's content model.schema falls back to placeholder titles ("New Article
// Title", "New Block Title", "New Component Title", "New Menu/Page Title",
// "New Course Title") whenever a node is created without an explicit title,
// and the new UI's Course Structure panel seeds nodes with its own
// Topic/Section/Content Group terminology (see constants/structureDefaults).
// Those are scaffolding, not authored content — the Storyboard must not
// project them as if the author had typed them.
//
// The Storyboard editor's own historical seed content and the editor's input
// placeholders land in this same list so any legacy storyboard record that
// captured them as heading text is also cleaned up on load and on export.
//
// Kept in sync with plugins/content/storyboard/utils/documentConvert.js::
// DEFAULT_PLACEHOLDER_TITLES (the server-side export filter).

import {
  NEW_TOPIC_TITLE,
  NEW_SECTION_TITLE,
  NEW_CONTENT_GROUP_TITLE,
} from '@/constants/structureDefaults';

export const DEFAULT_SCHEMA_TITLES = new Set([
  // Backend model.schema defaults
  'New Article Title',
  'New Block Title',
  'New Component Title',
  'New Menu/Page Title',
  'New Course Title',
  'New Page Title',
  // New-UI structure terminology (Topic / Section / Content Group / Component)
  NEW_TOPIC_TITLE,
  NEW_SECTION_TITLE,
  NEW_CONTENT_GROUP_TITLE,
  // Editor input placeholders / historical seed text
  'Article Title',
  'Block Title',
  'Component title',
  'Component Title',
  'Section Title',
  'Page Title',
  'Topic Title',
  'Content Group Title',
]);

export function isDefaultSchemaTitle(text: string | undefined | null): boolean {
  const t = (text || '').trim();
  return !t || DEFAULT_SCHEMA_TITLES.has(t);
}

// Resolve the display label for a backend content node, treating schema
// defaults as "untitled" so they never surface in the storyboard document.
export const storyboardLabel = (n: { displayTitle?: string; title?: string }): string => {
  const t = (n.displayTitle || n.title || '').trim();
  return DEFAULT_SCHEMA_TITLES.has(t) ? '' : t;
};

// Strip empty and schema-default heading blocks from a persisted storyboard
// document. Legacy records — created before the storyboard projector filtered
// placeholder titles — captured "New Article Title", "New Block Title" etc.
// as heading text; those bleed into Preview and the Word export until the
// document is regenerated. Called at load time on any doc used as the editor
// seed so the user never sees inherited placeholder scaffolding.
//
// A block is dropped when it is a heading whose plain-text content is empty or
// exactly matches one of the known placeholder titles. Every other block
// (paragraph, sbComponent, sbAssessment, sbPlaceholder, list, etc.) is
// preserved verbatim.
export function stripPlaceholderHeadings(blocks: unknown[]): unknown[] {
  if (!Array.isArray(blocks)) return blocks;
  const inline = (content: unknown): string => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
      .map((n) => (n && typeof (n as { text?: unknown }).text === 'string' ? (n as { text: string }).text : ''))
      .join('');
  };
  return blocks.filter((b) => {
    if (!b || typeof b !== 'object') return true;
    const block = b as { type?: string; content?: unknown };
    if (block.type !== 'heading') return true;
    return !isDefaultSchemaTitle(inline(block.content));
  });
}
