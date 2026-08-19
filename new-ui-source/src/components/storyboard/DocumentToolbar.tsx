// Center toolbar above the canvas (spec AC2/AC3/AC7).
//   Row 1: STORYBOARD DOCUMENT · Add Heading · Add Content · Add Instruction
//   Row 2: Enrich with AI
// (References and JSON state are hidden for Phase 1.)

import { FileText, Info, RefreshCw, Sparkles } from 'lucide-react';
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
    <div className="border-b bg-background/95 px-8 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <FileText className="h-4 w-4" /> Storyboard Document
        </div>
        <HeadingMenu onSelect={onInsertHeading} />
        <AddContentMenu onInsert={onInsert} />
        <button
          type="button"
          onClick={() => onInsert('instruction')}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          <Info className="h-3.5 w-3.5" /> Add Instruction
        </button>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            title="Reload the storyboard from the latest course content"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh from course
          </button>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onEnrichAI}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:opacity-90"
          style={{
            borderColor: 'color-mix(in oklab, var(--samaritan) 30%, transparent)',
            background: 'color-mix(in oklab, var(--samaritan) 8%, transparent)',
            color: 'var(--samaritan)',
          }}
        >
          <Sparkles className="h-3.5 w-3.5" /> Enrich with AI
        </button>
      </div>
    </div>
  );
}
