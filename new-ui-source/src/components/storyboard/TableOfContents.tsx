// TOC tree (spec AC1, Figma-aligned ADAPT-3842). Pure projection of document
// headings, with H1–H4 chip badges (`.sb-heading-chip`), expand/collapse, and
// click-to-navigate. Selected row uses the LIFE primary-subtle surface.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  const isActive = node.id === activeId;

  return (
    <li>
      <div
        className="group flex items-center gap-1.5 rounded-md py-1 pr-2 cursor-pointer transition-colors"
        style={{
          paddingLeft: `${(node.level - 1) * 14 + 6}px`,
          fontSize: 13,
          fontFamily: 'var(--font-family-primary)',
          color: isActive ? 'var(--life-color-text-primary-strong)' : 'var(--life-color-text-default)',
          background: isActive ? 'var(--life-color-bg-surface-primary-subtle)' : 'transparent',
          fontWeight: isActive ? 600 : 400,
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = 'var(--life-color-bg-surface-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = 'transparent';
        }}
      >
        <button
          type="button"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          onClick={() => setCollapsed((c) => !c)}
          className="grid h-4 w-4 shrink-0 place-items-center"
          style={{
            visibility: hasChildren ? 'visible' : 'hidden',
            color: 'var(--life-color-text-subtle)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <span className="sb-heading-chip" style={{ fontSize: 10, padding: '1px 5px', minWidth: 20 }}>
          H{node.level}
        </span>
        <span
          className="min-w-0 flex-1 truncate"
          title={node.text || 'Untitled'}
          onClick={() => onNavigate(node.id)}
        >
          {node.text || (
            <em style={{ color: 'var(--life-color-text-subtle)', fontStyle: 'italic' }}>Untitled</em>
          )}
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
      <p
        className="px-2 py-3"
        style={{
          fontSize: 13,
          color: 'var(--life-color-text-subtle)',
          fontFamily: 'var(--font-family-primary)',
        }}
      >
        Add a heading to build your table of contents.
      </p>
    );
  }

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {tree.map((node) => (
        <TocItem key={node.id} node={node} activeId={activeId} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}
