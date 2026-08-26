// Left panel — "CONTENTS": TOC tree (top) + AI guidance (bottom).
// Spec AC1/AC7, Figma-aligned (ADAPT-3842) — LIFE tokens via .sb-panel utility.

import { ListTree, PanelLeftClose } from 'lucide-react';
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
    <div className="sb-panel" style={{ fontFamily: 'var(--font-family-primary)' }}>
      <div className="sb-panel-header">
        <div className="sb-panel-title">
          <ListTree className="h-4 w-4" />
          Contents
        </div>
        {onCollapse && (
          <button
            type="button"
            aria-label="Collapse contents"
            onClick={onCollapse}
            className="sb-panel-collapse-btn"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <TableOfContents headings={headings} activeId={activeId} onNavigate={onNavigate} />
      </nav>

      <div
        className="p-3"
        style={{ borderTop: '1px solid var(--life-color-border-subtle)', background: 'var(--life-color-bg-surface-default)' }}
      >
        <AiGuidance summary={summary} />
      </div>
    </div>
  );
}
