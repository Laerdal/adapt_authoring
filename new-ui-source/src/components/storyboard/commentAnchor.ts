// Comments only ever anchor to a Page (H1) or Article (H2) heading, never a
// Block/Component (H3/H4 heading, paragraph, component/assessment card) — per
// the storyboard spec, a comment is a Page/Article-level concern. Both the
// cursor-driven Review Center composer (BlockNoteStoryboardEditor) and the
// per-card "Comment" actions (componentBlock, assessmentBlock) resolve
// through this one function so the rule can't drift between call sites.

import type { ActiveBlockInfo } from '@/types/storyboard';

interface MinimalBlock {
  id: string;
  type: string;
  props?: unknown;
  content?: unknown;
}

export function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((node) =>
      node && typeof node === 'object' && typeof (node as { text?: unknown }).text === 'string'
        ? (node as { text: string }).text
        : ''
    )
    .join('');
}

/** Walk `document` up to (and including) `targetBlockId`, tracking the most
 *  recent level-1/2 heading seen (itself, if the target is one). Null if the
 *  target sits before any such heading. */
export function resolveCommentAnchor(
  document: readonly MinimalBlock[],
  targetBlockId: string
): ActiveBlockInfo | null {
  let anchor: ActiveBlockInfo | null = null;
  for (const block of document) {
    if (block.type === 'heading') {
      const level = Number((block.props as { level?: number })?.level ?? 1);
      if (level <= 2) anchor = { id: block.id, text: inlineText(block.content), type: block.type };
    }
    if (block.id === targetBlockId) break;
  }
  return anchor;
}
