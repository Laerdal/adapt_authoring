'use client';

import React, { useState } from 'react';
import {
  type CourseStructure,
  type StructureLevel,
  type ContainerLevel,
  type SModule,
  type STopic,
  type SSection,
  type SContentGroup,
  type SComponent,
  mergedChildren,
  acceptsChild,
} from '../../types/structure';
import { StructureIcon, STRUCTURE_ICON_COLOR_CLASS } from './StructureIcons';

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
  // Drag-and-drop: move `id` under `newParentId`, before `beforeId` (null = append).
  onMove: (level: StructureLevel, id: string, newParentId: string, beforeId: string | null) => void;
  // Open a topic in the Page Editor (the "→" affordance on topic rows).
  onOpenTopic: (topicId: string) => void;
}

interface Dragged { level: StructureLevel; id: string; }
interface RowRef { level: StructureLevel; id: string; parentId: string; parentLevel: ContainerLevel; }
type DropPlan = { newParentId: string; beforeId: string | null; mode: 'before' | 'into' };

// Resolve a drop of `dragged` onto `row`:
//  • same level          → reorder / move as a sibling before that row
//  • different level, row is a valid container for it → move INTO the row
//  • different level, but a sibling is valid          → move as a sibling
function computeDrop(dragged: Dragged, row: RowRef): DropPlan | null {
  if (dragged.id === row.id) return null;
  if (dragged.level === row.level) {
    return acceptsChild(row.parentLevel, dragged.level)
      ? { newParentId: row.parentId, beforeId: row.id, mode: 'before' }
      : null;
  }
  if (acceptsChild(row.level, dragged.level)) {
    return { newParentId: row.id, beforeId: null, mode: 'into' };
  }
  if (acceptsChild(row.parentLevel, dragged.level)) {
    return { newParentId: row.parentId, beforeId: row.id, mode: 'before' };
  }
  return null;
}

const LEVEL_ICON_COLOR: Record<StructureLevel, string> = {
  module: 'text-[#3d8f7c]',
  topic: STRUCTURE_ICON_COLOR_CLASS.topic,
  section: STRUCTURE_ICON_COLOR_CLASS.section,
  contentGroup: STRUCTURE_ICON_COLOR_CLASS.contentGroup,
  component: STRUCTURE_ICON_COLOR_CLASS.component,
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
function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
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
  const [drag, setDrag] = useState<Dragged | null>(null);
  const [dropTarget, setDropTarget] = useState<{ rowId: string; mode: 'before' | 'into' } | null>(null);

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
  function clearDrag() { setDrag(null); setDropTarget(null); }

  // ── Row chrome (shared across every level) ──────────────────────────────────
  interface RowProps {
    level: StructureLevel;
    id: string;
    title: string;
    parentId: string;
    parentLevel: ContainerLevel;
    expandable?: boolean;
    deleteWarning?: string;
    onOpen?: () => void;
  }

  // Plain render function (not a nested component) so the inline <input> keeps
  // focus across re-renders while typing.
  function renderRow(p: RowProps): React.ReactNode {
    const editing = inlineId === p.id;
    const isModule = p.level === 'module';
    const rowRef: RowRef = { level: p.level, id: p.id, parentId: p.parentId, parentLevel: p.parentLevel };
    const isDropInto = dropTarget?.rowId === p.id && dropTarget.mode === 'into';
    const isDropBefore = dropTarget?.rowId === p.id && dropTarget.mode === 'before';

    if (deleteId === p.id) {
      return (
        <div className="px-2 py-2 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-sm">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[#991b1b] font-medium truncate">Delete “{p.title}”?</span>
            <button type="button" onClick={() => setDeleteId(null)} className="px-2 py-1 text-xs rounded text-[#6b7280] hover:bg-[#f3f4f6]">Cancel</button>
            <button type="button" onClick={() => { setDeleteId(null); props.onRemove(p.level, p.id); }} className="px-2 py-1 text-xs rounded bg-[#dc2626] text-white hover:bg-[#b91c1c] font-medium">Delete</button>
          </div>
          {p.deleteWarning && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-[#b45309]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {p.deleteWarning}
            </p>
          )}
        </div>
      );
    }

    return (
      <>
        {isDropBefore && <div className="h-0.5 bg-[#2d6fa8] rounded mb-0.5" />}
        <div
          draggable={!editing}
          onDragStart={() => setDrag({ level: p.level, id: p.id })}
          onDragOver={(e) => {
            if (!drag) return;
            const plan = computeDrop(drag, rowRef);
            if (plan) { e.preventDefault(); setDropTarget({ rowId: p.id, mode: plan.mode }); }
          }}
          onDrop={(e) => {
            if (!drag) return;
            const plan = computeDrop(drag, rowRef);
            if (plan) { e.preventDefault(); props.onMove(drag.level, drag.id, plan.newParentId, plan.beforeId); }
            clearDrag();
          }}
          onDragEnd={clearDrag}
          className={`group flex items-center gap-1.5 px-2 py-2 rounded-lg transition-colors ${isModule ? 'border-l-2 border-[#3d8f7c]' : ''} ${isDropInto ? 'ring-2 ring-[#2d6fa8] bg-[#f0f7ff]' : 'hover:bg-[#f9fafb]'}`}
          aria-label={`${labels[p.level]}: ${p.title}`}
        >
          <button type="button" aria-label={`Drag ${p.title}`} className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-[#e5e7eb] opacity-0 group-hover:opacity-100 transition-opacity">
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

          {/* Title + level label grouped on the left (label sits right after the title). */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
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
            ) : (
              <button
                type="button"
                onClick={() => startRename(p.id, p.title)}
                title="Click to rename"
                className={`min-w-0 truncate text-left text-sm hover:text-[#2d6fa8] ${isModule ? 'font-bold uppercase tracking-wide text-[#374151]' : p.level === 'topic' ? 'font-semibold text-[#111827]' : 'text-[#374151]'}`}
              >
                {p.title}
              </button>
            )}

            {!editing && (isModule ? (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#3d8f7c] bg-[#e6f4f1] rounded px-1.5 py-0.5">{labels.module}</span>
            ) : (
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-[#c5cad1]">{labels[p.level]}</span>
            ))}
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button type="button" aria-label={`Delete ${p.title}`} onClick={() => setDeleteId(p.id)} className="p-1 rounded hover:bg-[#fee2e2] text-[#9ca3af] hover:text-[#dc2626]">
              <Trash />
            </button>
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

  // Tighter per-level indent so the hierarchy stays left-aligned (per Figma).
  const indent = 'ml-3 border-l border-[#e5e7eb] pl-2 space-y-0.5';

  // ── Level renderers ─────────────────────────────────────────────────────────
  function renderComponents(components: SComponent[], blockId: string) {
    return (
      <div className={indent}>
        {components.map((c) => (
          <React.Fragment key={c.id}>
            {renderRow({ level: 'component', id: c.id, title: c.title, parentId: blockId, parentLevel: 'contentGroup', deleteWarning: components.length === 1 ? `This is the only component — the ${labels.contentGroup.toLowerCase()} will be left empty.` : undefined })}
          </React.Fragment>
        ))}
        <div className="ml-1"><AddLink label={`Add ${labels.component}`} onClick={() => props.onAddComponent(blockId)} /></div>
      </div>
    );
  }

  function renderContentGroups(groups: SContentGroup[], sectionId: string) {
    return (
      <div className={indent}>
        {groups.map((cg) => (
          <div key={cg.id}>
            {renderRow({ level: 'contentGroup', id: cg.id, title: cg.title, parentId: sectionId, parentLevel: 'section', expandable: true })}
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
        {sections.map((sec) => (
          <div key={sec.id}>
            {renderRow({ level: 'section', id: sec.id, title: sec.title, parentId: topicId, parentLevel: 'topic', expandable: true })}
            {isOpen(sec.id) && renderContentGroups(sec.contentGroups, sec.id)}
          </div>
        ))}
        <div className="ml-1"><AddLink label={`Add ${labels.section}`} onClick={() => props.onAddSection(topicId)} /></div>
      </div>
    );
  }

  function renderTopic(topic: STopic, containerId: string, parentLevel: ContainerLevel) {
    return (
      <div key={topic.id}>
        {renderRow({ level: 'topic', id: topic.id, title: topic.title, parentId: containerId, parentLevel, expandable: true, onOpen: () => props.onOpenTopic(topic.id) })}
        {isOpen(topic.id) && renderSections(topic.sections, topic.id)}
      </div>
    );
  }

  function renderModule(mod: SModule, containerId: string, parentLevel: ContainerLevel) {
    return (
      <div key={mod.id}>
        {renderRow({ level: 'module', id: mod.id, title: mod.title, parentId: containerId, parentLevel, expandable: true })}
        {isOpen(mod.id) && (
          <div className={indent}>
            {renderChildren(mod.id, mod.modules, mod.topics, 'module')}
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
  function renderChildren(containerId: string, modules: SModule[], topics: STopic[], parentLevel: ContainerLevel) {
    const children = mergedChildren(modules, topics);
    return (
      <>
        {children.map((child) =>
          child.kind === 'module'
            ? renderModule(child.node, containerId, parentLevel)
            : renderTopic(child.node, containerId, parentLevel)
        )}
      </>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="border border-[#e5e7eb] rounded-xl p-4 space-y-1">
      {renderChildren(courseId, structure.modules, structure.topics, 'course')}

      {/* Course-level add actions */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#e5e7eb]">
        <AddLink label={`Add ${labels.topic}`} onClick={() => props.onAddTopic(null)} />
        <AddLink label={`Add ${labels.module}`} onClick={() => props.onAddModule()} />
      </div>
    </div>
  );
}
