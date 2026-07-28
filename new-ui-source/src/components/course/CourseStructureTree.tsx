'use client';

import React, { useState } from 'react';
import {
  type CourseStructure,
  type StructureLevel,
  type SModule,
  type STopic,
  type SSection,
  type SContentGroup,
  type SComponent,
  mergedChildren,
} from '../../types/structure';
import { StructureIcon } from './structureIcons';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CourseStructureTreeProps {
  structure: CourseStructure;
  courseId: string;
  labels: Record<StructureLevel, string>;
  onAddModule: () => void;
  onAddSubModule: (moduleId: string) => void;
  onAddTopic: (parentId: string | null) => void;
  onAddSection: (topicId: string) => void;
  onAddContentGroup: (sectionId: string) => void;
  onAddComponent: (blockId: string) => void;
  onRename: (level: StructureLevel, id: string, title: string) => void;
  onRemove: (level: StructureLevel, id: string) => void;
  // Single-kind reorder (sections / content groups / components).
  onReorder: (level: 'section' | 'contentGroup' | 'component', parentId: string, from: number, to: number) => void;
  // Reorder a container's merged children (modules + topics).
  onReorderChildren: (containerId: string, from: number, to: number) => void;
  onOpenTopic: (topicId: string) => void;
}

interface DragInfo { group: string; index: number; }

const LEVEL_ICON_COLOR: Record<StructureLevel, string> = {
  module: 'text-[#3d8f7c]',
  topic: 'text-[#2d6fa8]',
  section: 'text-[#d1a808]',
  contentGroup: 'text-[#3d8f7c]',
  component: 'text-[#6b7280]',
};

// ─── Icons ────────────────────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-90' : ''}`}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function Grip() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#9ca3af]">
      <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
function Pencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function Trash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
function Plus({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CourseStructureTree(props: CourseStructureTreeProps) {
  const { structure, courseId, labels } = props;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const [dropAt, setDropAt] = useState<DragInfo | null>(null);

  const isOpen = (id: string) => collapsed[id] !== true;
  const toggle = (id: string) => setCollapsed((p) => ({ ...p, [id]: p[id] ? false : true }));

  function startRename(id: string, title: string) { setInlineId(id); setInlineValue(title); }
  function commitRename(level: StructureLevel) {
    if (!inlineId) return;
    const v = inlineValue.trim();
    const id = inlineId;
    setInlineId(null);
    if (v) props.onRename(level, id, v);
  }

  // ── Row chrome (shared across every level) ──────────────────────────────────
  interface RowProps {
    level: StructureLevel;
    id: string;
    title: string;
    group: string;
    index: number;
    count: number;
    reorderGroup: (from: number, to: number) => void;
    expandable?: boolean;
    navigateTopicId?: string;
    quickAddLabel?: string;
    onQuickAdd?: () => void;
    deletable?: boolean;
  }

  // Plain render function (not a nested component) so the inline <input> keeps
  // focus across re-renders while typing.
  function renderRow(p: RowProps): React.ReactNode {
    const editing = inlineId === p.id;
    const isModule = p.level === 'module';

    if (deleteId === p.id) {
      return (
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-sm">
          <span className="flex-1 text-[#991b1b] font-medium truncate">Delete “{p.title}”?</span>
          <button type="button" onClick={() => setDeleteId(null)} className="px-2 py-1 text-xs rounded text-[#6b7280] hover:bg-[#f3f4f6]">Cancel</button>
          <button type="button" onClick={() => { setDeleteId(null); props.onRemove(p.level, p.id); }} className="px-2 py-1 text-xs rounded bg-[#dc2626] text-white hover:bg-[#b91c1c] font-medium">Delete</button>
        </div>
      );
    }

    const showDrop = dropAt?.group === p.group && dropAt?.index === p.index;

    return (
      <>
        {showDrop && <div className="h-0.5 bg-blue-500 rounded mb-0.5" />}
        <div
          draggable
          onDragStart={() => setDrag({ group: p.group, index: p.index })}
          onDragOver={(e) => { e.preventDefault(); if (drag?.group === p.group) setDropAt({ group: p.group, index: p.index }); }}
          onDrop={(e) => { e.preventDefault(); if (drag?.group === p.group && drag.index !== p.index) p.reorderGroup(drag.index, p.index); setDrag(null); setDropAt(null); }}
          onDragEnd={() => { setDrag(null); setDropAt(null); }}
          className={`group flex items-center gap-1.5 px-2 py-2 rounded-lg hover:bg-[#f9fafb] transition-colors ${isModule ? 'border-l-2 border-[#3d8f7c]' : ''}`}
          aria-label={`${labels[p.level]}: ${p.title}, ${p.index + 1} of ${p.count}`}
        >
          <button type="button" aria-label={`Reorder ${p.title}`} className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-[#e5e7eb] opacity-0 group-hover:opacity-100 transition-opacity">
            <Grip />
          </button>

          {p.expandable ? (
            <button type="button" onClick={() => toggle(p.id)} aria-label={isOpen(p.id) ? 'Collapse' : 'Expand'} className="p-0.5 rounded hover:bg-[#e5e7eb] text-[#6b7280] shrink-0">
              <Chevron open={isOpen(p.id)} />
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <span className="shrink-0"><StructureIcon level={p.level} size={15} className={LEVEL_ICON_COLOR[p.level]} /></span>

          {editing ? (
            <input
              autoFocus
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRename(p.level); } else if (e.key === 'Escape') { e.preventDefault(); setInlineId(null); } }}
              onBlur={() => commitRename(p.level)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Edit title"
              className="flex-1 min-w-0 text-sm border border-[#2d6fa8] rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : p.navigateTopicId ? (
            <button type="button" onClick={() => props.onOpenTopic(p.navigateTopicId!)} className="flex-1 min-w-0 text-left text-sm truncate font-semibold text-[#111827] hover:text-[#2d6fa8] hover:underline" title="Open in editor">
              {p.title}
            </button>
          ) : (
            <span className={`flex-1 min-w-0 text-sm truncate ${isModule ? 'font-bold uppercase tracking-wide text-[#374151]' : 'text-[#374151]'}`}>{p.title}</span>
          )}

          {isModule ? (
            <span className="ml-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#3d8f7c] bg-[#e6f4f1] rounded px-1.5 py-0.5">{labels.module}</span>
          ) : (
            <span className="ml-1 shrink-0 text-[11px] uppercase tracking-wide text-[#c5cad1] hidden sm:inline">{labels[p.level]}</span>
          )}

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {p.onQuickAdd && (
              <button type="button" aria-label={p.quickAddLabel} title={p.quickAddLabel} onClick={p.onQuickAdd} className="p-1 rounded hover:bg-[#e5e7eb] text-[#9ca3af] hover:text-[#2d6fa8]">
                <Plus />
              </button>
            )}
            <button type="button" aria-label={`Rename ${p.title}`} onClick={() => startRename(p.id, p.title)} className="p-1 rounded hover:bg-[#e5e7eb] text-[#9ca3af] hover:text-[#2d6fa8]">
              <Pencil />
            </button>
            {p.deletable !== false && (
              <button type="button" aria-label={`Delete ${p.title}`} onClick={() => setDeleteId(p.id)} className="p-1 rounded hover:bg-[#fee2e2] text-[#9ca3af] hover:text-[#dc2626]">
                <Trash />
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  function AddLink({ label, onClick }: { label: string; onClick: () => void }) {
    return (
      <button type="button" onClick={onClick} aria-label={label} className="flex items-center gap-1.5 text-xs text-[#9ca3af] hover:text-[#2d6fa8] px-2 py-1 rounded hover:bg-[#f0f7ff] transition-colors">
        <Plus size={11} />
        {label}
      </button>
    );
  }

  const indent = 'ml-6 border-l border-[#e5e7eb] pl-3 space-y-0.5';

  // ── Level renderers ─────────────────────────────────────────────────────────
  function renderComponents(components: SComponent[], blockId: string) {
    return (
      <div className={indent}>
        {components.map((c, i) => (
          <React.Fragment key={c.id}>
            {renderRow({ level: 'component', id: c.id, title: c.title, group: `comp:${blockId}`, index: i, count: components.length, reorderGroup: (f, t) => props.onReorder('component', blockId, f, t) })}
          </React.Fragment>
        ))}
        {components.length < 2 && <div className="ml-1"><AddLink label={`Add ${labels.component}`} onClick={() => props.onAddComponent(blockId)} /></div>}
      </div>
    );
  }

  function renderContentGroups(groups: SContentGroup[], sectionId: string) {
    return (
      <div className={indent}>
        {groups.map((cg, i) => (
          <div key={cg.id}>
            {renderRow({ level: 'contentGroup', id: cg.id, title: cg.title, group: `cg:${sectionId}`, index: i, count: groups.length, reorderGroup: (f, t) => props.onReorder('contentGroup', sectionId, f, t), expandable: true, quickAddLabel: `Add ${labels.component}`, onQuickAdd: cg.components.length < 2 ? () => props.onAddComponent(cg.id) : undefined })}
            {isOpen(cg.id) && renderComponents(cg.components, cg.id)}
          </div>
        ))}
        <div className="ml-1"><AddLink label={`Add ${labels.contentGroup}`} onClick={() => props.onAddContentGroup(sectionId)} /></div>
      </div>
    );
  }

  function renderSections(sections: SSection[], topicId: string) {
    return (
      <div className={indent}>
        {sections.map((sec, i) => (
          <div key={sec.id}>
            {renderRow({ level: 'section', id: sec.id, title: sec.title, group: `sec:${topicId}`, index: i, count: sections.length, reorderGroup: (f, t) => props.onReorder('section', topicId, f, t), navigateTopicId: topicId, expandable: true, quickAddLabel: `Add ${labels.contentGroup}`, onQuickAdd: () => props.onAddContentGroup(sec.id) })}
            {isOpen(sec.id) && renderContentGroups(sec.contentGroups, sec.id)}
          </div>
        ))}
        <div className="ml-1"><AddLink label={`Add ${labels.section}`} onClick={() => props.onAddSection(topicId)} /></div>
      </div>
    );
  }

  function renderTopic(topic: STopic, containerId: string, index: number, count: number) {
    return (
      <div key={topic.id}>
        {renderRow({ level: 'topic', id: topic.id, title: topic.title, group: `children:${containerId}`, index, count, reorderGroup: (f, t) => props.onReorderChildren(containerId, f, t), navigateTopicId: topic.id, expandable: true, quickAddLabel: `Add ${labels.section}`, onQuickAdd: () => props.onAddSection(topic.id) })}
        {isOpen(topic.id) && renderSections(topic.sections, topic.id)}
      </div>
    );
  }

  function renderModule(mod: SModule, containerId: string, index: number, count: number) {
    return (
      <div key={mod.id}>
        {renderRow({ level: 'module', id: mod.id, title: mod.title, group: `children:${containerId}`, index, count, reorderGroup: (f, t) => props.onReorderChildren(containerId, f, t), expandable: true, quickAddLabel: `Add ${labels.topic}`, onQuickAdd: () => props.onAddTopic(mod.id) })}
        {isOpen(mod.id) && (
          <div className={indent}>
            {renderChildren(mod.id, mod.modules, mod.topics)}
            <div className="ml-1 flex items-center gap-3">
              <AddLink label={`Add ${labels.topic}`} onClick={() => props.onAddTopic(mod.id)} />
              <AddLink label="Add Sub-Module" onClick={() => props.onAddSubModule(mod.id)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render a container's merged children (modules + topics) in sort order.
  function renderChildren(containerId: string, modules: SModule[], topics: STopic[]) {
    const children = mergedChildren(modules, topics);
    return (
      <>
        {children.map((child, i) =>
          child.kind === 'module'
            ? renderModule(child.node, containerId, i, children.length)
            : renderTopic(child.node, containerId, i, children.length)
        )}
      </>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="border border-[#e5e7eb] rounded-xl p-4 space-y-1">
      {renderChildren(courseId, structure.modules, structure.topics)}

      {/* Course-level add actions */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#e5e7eb]">
        <AddLink label={`Add ${labels.topic}`} onClick={() => props.onAddTopic(null)} />
        <AddLink label={`Add ${labels.module}`} onClick={() => props.onAddModule()} />
      </div>
    </div>
  );
}
