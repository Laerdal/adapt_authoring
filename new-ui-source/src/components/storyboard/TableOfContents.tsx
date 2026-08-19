// TOC tree (spec AC1). Pure projection of document headings, with H1–H4
// badges, expand/collapse, and click-to-navigate.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/utils';
import type { StoryboardHeading } from '@/types/storyboard';

interface TocNode extends StoryboardHeading {
  children: TocNode[];
}

function buildToc(headings: StoryboardHeading[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];
  for (const h of headings) {
    const node: TocNode = { ...h, children: [] };
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
    (stack.length ? stack[stack.length - 1].children : root).push(node);
    stack.push(node);
  }
  return root;
}

function TocItem({
  node,
  activeId,
  onNavigate,
}: {
  node: TocNode;
  activeId?: string;
  onNavigate: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded px-1.5 py-1 text-sm cursor-pointer hover:bg-muted',
          node.id === activeId && 'bg-primary/10 text-primary'
        )}
        style={{ paddingLeft: `${(node.level - 1) * 14 + 4}px` }}
      >
        <button
          type="button"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          onClick={() => setCollapsed((c) => !c)}
          className={cn('grid h-4 w-4 shrink-0 place-items-center text-muted-foreground', !hasChildren && 'invisible')}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
          H{node.level}
        </span>
        <span
          className="min-w-0 flex-1 truncate"
          title={node.text || 'Untitled'}
          onClick={() => onNavigate(node.id)}
        >
          {node.text || <em className="text-muted-foreground">Untitled</em>}
        </span>
      </div>
      {hasChildren && !collapsed && (
        <ul>
          {node.children.map((child) => (
            <TocItem key={child.id} node={child} activeId={activeId} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TableOfContents({
  headings,
  activeId,
  onNavigate,
}: {
  headings: StoryboardHeading[];
  activeId?: string;
  onNavigate: (id: string) => void;
}) {
  const tree = useMemo(() => buildToc(headings), [headings]);

  if (tree.length === 0) {
    return (
      <p className="px-1.5 py-2 text-sm text-muted-foreground">
        Add a heading to build your table of contents.
      </p>
    );
  }

  return (
    <ul>
      {tree.map((node) => (
        <TocItem key={node.id} node={node} activeId={activeId} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}
