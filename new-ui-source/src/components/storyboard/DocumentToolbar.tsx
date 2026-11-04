//   Single row: Add Heading · Add Content · (Enrich with AI, right-aligned)

import type { StoryboardInsertKind } from '@/types/storyboard';
import AddContentMenu from './AddContentMenu';
import HeadingMenu from './HeadingMenu';
import SamaritanIcon from './SamaritanIcon';

export default function DocumentToolbar({
  onInsert,
  onInsertHeading,
  onEnrichAI,
  enrichOpen = false,
}: {
  onInsert: (kind: StoryboardInsertKind) => void;
  onInsertHeading: (level: number) => void;
  onEnrichAI: () => void;
  enrichOpen?: boolean;
}) {
  return (
    <div
      className="px-8 py-2.5"
      style={{
        background: 'var(--life-color-bg-surface-default)',
        borderBottom: '1px solid var(--life-color-border-subtle)',
        fontFamily: 'var(--font-family-primary)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <HeadingMenu onSelect={onInsertHeading} />
        <AddContentMenu onInsert={onInsert} />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onEnrichAI}
            aria-pressed={enrichOpen}
            className="sb-toolbar-btn sb-toolbar-btn-samaritan"
          >
            <SamaritanIcon className="h-3.5 w-3.5" /> Enrich with AI
          </button>
        </div>
      </div>
    </div>
  );
}
