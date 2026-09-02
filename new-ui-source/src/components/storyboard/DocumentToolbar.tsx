//   Single row: STORYBOARD DOCUMENT · Add Heading · Add Content ·
//          (Refresh from course · Enrich with AI, right-aligned)

import { FileText, RefreshCw, Sparkles } from 'lucide-react';
import type { StoryboardInsertKind } from '@/types/storyboard';
import AddContentMenu from './AddContentMenu';
import HeadingMenu from './HeadingMenu';

export default function DocumentToolbar({
  onInsert,
  onInsertHeading,
  onEnrichAI,
  onRefresh,
}: {
  onInsert: (kind: StoryboardInsertKind) => void;
  onInsertHeading: (level: number) => void;
  onEnrichAI: () => void;
  onRefresh?: () => void;
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
        <div
          className="mr-1 inline-flex items-center gap-1.5"
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--life-color-text-subtle)',
          }}
        >
          <FileText className="h-4 w-4" /> Storyboard Document
        </div>
        <HeadingMenu onSelect={onInsertHeading} />
        <AddContentMenu onInsert={onInsert} />

        <div className="ml-auto flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Reload the storyboard from the latest course content"
              className="sb-toolbar-btn"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh from course
            </button>
          )}
          <button
            type="button"
            onClick={onEnrichAI}
            className="sb-toolbar-btn sb-toolbar-btn-samaritan"
          >
            <Sparkles className="h-3.5 w-3.5" /> Enrich with AI
          </button>
        </div>
      </div>
    </div>
  );
}
