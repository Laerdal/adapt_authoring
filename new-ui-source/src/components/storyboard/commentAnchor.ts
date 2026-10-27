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

export function resolveCommentAnchor(
  document: readonly MinimalBlock[],
  targetBlockId: string
): ActiveBlockInfo | null {
  const block = document.find((item) => item.id === targetBlockId);
  if (!block) return null;
  const props = block.props as { title?: string; kind?: string } | undefined;
  return { id: block.id, text: inlineText(block.content) || props?.title || props?.kind || '', type: block.type };
}
