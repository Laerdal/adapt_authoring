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

function headingLevel(block: MinimalBlock): number | null {
  if (block.type !== 'heading') return null;
  const level = Number((block.props as { level?: number } | undefined)?.level ?? 1);
  return Number.isFinite(level) && level > 0 ? level : null;
}

/** Return the last block in the target block's current structural container.
 *
 * This keeps inserts at the end of the active Topic/Section/Content Group rather
 * than letting them land in the middle of an existing paragraph or component body
 * when the author clicks an Add Content or Add Heading action after focus has
 * moved away from the editor.
 */
export function resolveInsertionAnchor(document: readonly MinimalBlock[], targetBlockId?: string): string | null {
  if (!Array.isArray(document) || !document.length) return null;

  const safeTarget = targetBlockId && document.some((block) => block.id === targetBlockId) ? targetBlockId : null;
  const startIndex = safeTarget ? document.findIndex((block) => block.id === safeTarget) : document.length - 1;
  if (startIndex < 0) return document[document.length - 1]?.id ?? null;

  const targetLevel = headingLevel(document[startIndex]);
  const containerLevel = targetLevel ?? (() => {
    for (let i = startIndex - 1; i >= 0; i -= 1) {
      const level = headingLevel(document[i]);
      if (level) return level;
    }
    return 1;
  })();

  let anchorId = document[startIndex]?.id ?? null;
  for (let i = startIndex + 1; i < document.length; i += 1) {
    const nextLevel = headingLevel(document[i]);
    if (nextLevel !== null && nextLevel <= containerLevel) break;
    anchorId = document[i].id;
  }

  return anchorId ?? document[document.length - 1]?.id ?? null;
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
