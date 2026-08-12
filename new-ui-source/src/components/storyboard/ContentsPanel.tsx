// Left panel — "CONTENTS": TOC tree (top) + AI guidance (bottom). Spec AC1/AC7.

import { ListTree, ChevronDown } from 'lucide-react';
import type { StoryboardHeading, StoryboardSummary } from '@/types/storyboard';
import TableOfContents from './TableOfContents';
import AiGuidance from './AiGuidance';

export default function ContentsPanel({
  headings,
  summary,
  activeId,
  onNavigate,
  onCollapse,
}: {
  headings: StoryboardHeading[];
  summary: StoryboardSummary;
  activeId?: string;
  onNavigate: (id: string) => void;
  onCollapse?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ListTree className="h-4 w-4" />
          Contents
        </div>
        {onCollapse && (
          <button
            type="button"
            aria-label="Collapse contents"
            onClick={onCollapse}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <TableOfContents headings={headings} activeId={activeId} onNavigate={onNavigate} />
      </nav>

      <div className="border-t p-3">
        <AiGuidance summary={summary} />
      </div>
    </div>
  );
}
