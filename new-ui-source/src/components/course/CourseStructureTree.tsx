'use client';

import React, { useState, useRef, useCallback } from 'react';
import type {
  CourseStructureState,
  StructureModule,
  StructureTopic,
  StructureSection,
  StructureBlock,
} from './CourseStructureMap';
import { AddModal } from './CourseStructureMap';

// ─── Edit target ──────────────────────────────────────────────────────────────

type EditTarget =
  | { type: 'module'; moduleId: string }
  | { type: 'topic'; moduleId: string; topicId: string }
  | { type: 'section'; moduleId: string; topicId: string; sectionId: string }
  | { type: 'block'; moduleId: string; topicId: string; sectionId: string; blockId: string };

// ─── Props ────────────────────────────────────────────────────────────────────

interface CourseStructureTreeProps {
  state: CourseStructureState;
  onChange: (state: CourseStructureState) => void;
}

// ─── Drag state ───────────────────────────────────────────────────────────────

interface DragInfo {
  type: 'module' | 'topic' | 'section' | 'block';
  parentPath: string; // e.g. "" for modules, "mod-1" for topics, "mod-1/topic-1" for sections
  index: number;
}

// ─── Add modal target ─────────────────────────────────────────────────────────

type AddTarget =
  | { type: 'module' }
  | { type: 'topic'; moduleId: string }
  | { type: 'section'; moduleId: string; topicId: string }
  | { type: 'block'; moduleId: string; topicId: string; sectionId: string };

// ─── Delete confirmation state ────────────────────────────────────────────────

type DeleteTarget =
  | { type: 'module'; moduleId: string }
  | { type: 'topic'; moduleId: string; topicId: string }
  | { type: 'section'; moduleId: string; topicId: string; sectionId: string }
  | { type: 'block'; moduleId: string; topicId: string; sectionId: string; blockId: string };

// ─── Keyboard grab state ──────────────────────────────────────────────────────

interface GrabState {
  type: 'module' | 'topic' | 'section' | 'block';
  parentPath: string;
  index: number;
  originalIndex: number;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Reorder helper ───────────────────────────────────────────────────────────

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#9ca3af]">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function PlusIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CourseStructureTree({ state, onChange }: CourseStructureTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'module-1': true,
    'topic-1': true,
  });
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [dropTarget, setDropTarget] = useState<{ parentPath: string; index: number } | null>(null);
  const [grabbed, setGrabbed] = useState<GrabState | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const dragInfo = useRef<DragInfo | null>(null);

  const announce = useCallback((msg: string) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // ── Add modal confirm ──────────────────────────────────────────────────────

  function handleAddConfirm(title: string, description: string) {
    if (!addTarget) return;
    const s = structuredClone(state);
    if (addTarget.type === 'module') {
      s.modules.push({ id: `mod-${uid()}`, title, description, colorIndex: s.modules.length % 6, topics: [] });
    } else if (addTarget.type === 'topic') {
      const mod = s.modules.find(m => m.id === addTarget.moduleId);
      if (mod) mod.topics.push({ id: `topic-${uid()}`, title, description, sections: [] });
    } else if (addTarget.type === 'section') {
      const mod = s.modules.find(m => m.id === addTarget.moduleId);
      const topic = mod?.topics.find(t => t.id === addTarget.topicId);
      if (topic) topic.sections.push({ id: `sec-${uid()}`, title, description, blocks: [] });
    } else if (addTarget.type === 'block') {
      const mod = s.modules.find(m => m.id === addTarget.moduleId);
      const topic = mod?.topics.find(t => t.id === addTarget.topicId);
      const sec = topic?.sections.find(se => se.id === addTarget.sectionId);
      if (sec) sec.blocks.push({ id: `block-${uid()}`, title, description });
    }
    onChange(s);
    setAddTarget(null);
  }

  // ── Edit modal ────────────────────────────────────────────────────────────

  function getEditInitialValues(): { title: string; description: string } {
    if (!editTarget) return { title: '', description: '' };
    if (editTarget.type === 'module') {
      const m = state.modules.find(x => x.id === editTarget.moduleId);
      return { title: m?.title ?? '', description: m?.description ?? '' };
    }
    if (editTarget.type === 'topic') {
      const m = state.modules.find(x => x.id === editTarget.moduleId);
      const t = m?.topics.find(x => x.id === editTarget.topicId);
      return { title: t?.title ?? '', description: t?.description ?? '' };
    }
    if (editTarget.type === 'section') {
      const m = state.modules.find(x => x.id === editTarget.moduleId);
      const t = m?.topics.find(x => x.id === editTarget.topicId);
      const s = t?.sections.find(x => x.id === editTarget.sectionId);
      return { title: s?.title ?? '', description: s?.description ?? '' };
    }
    const m = state.modules.find(x => x.id === editTarget.moduleId);
    const t = m?.topics.find(x => x.id === editTarget.topicId);
    const s = t?.sections.find(x => x.id === editTarget.sectionId);
    const b = s?.blocks.find(x => x.id === editTarget.blockId);
    return { title: b?.title ?? '', description: b?.description ?? '' };
  }

  function handleEditConfirm(newTitle: string, newDescription: string) {
    if (!editTarget) return;
    const s = structuredClone(state);
    if (editTarget.type === 'module') {
      const m = s.modules.find(x => x.id === editTarget.moduleId);
      if (m) { m.title = newTitle; m.description = newDescription; }
    } else if (editTarget.type === 'topic') {
      const m = s.modules.find(x => x.id === editTarget.moduleId);
      const t = m?.topics.find(x => x.id === editTarget.topicId);
      if (t) { t.title = newTitle; t.description = newDescription; }
    } else if (editTarget.type === 'section') {
      const m = s.modules.find(x => x.id === editTarget.moduleId);
      const t = m?.topics.find(x => x.id === editTarget.topicId);
      const sec = t?.sections.find(x => x.id === editTarget.sectionId);
      if (sec) { sec.title = newTitle; sec.description = newDescription; }
    } else if (editTarget.type === 'block') {
      const m = s.modules.find(x => x.id === editTarget.moduleId);
      const t = m?.topics.find(x => x.id === editTarget.topicId);
      const sec = t?.sections.find(x => x.id === editTarget.sectionId);
      const b = sec?.blocks.find(x => x.id === editTarget.blockId);
      if (b) { b.title = newTitle; b.description = newDescription; }
    }
    onChange(s);
    setEditTarget(null);
  }

  // ── Delete confirm ────────────────────────────────────────────────────────

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const s = structuredClone(state);
    if (deleteTarget.type === 'module') {
      s.modules = s.modules.filter(m => m.id !== deleteTarget.moduleId);
    } else if (deleteTarget.type === 'topic') {
      const mod = s.modules.find(m => m.id === deleteTarget.moduleId);
      if (mod) mod.topics = mod.topics.filter(t => t.id !== deleteTarget.topicId);
    } else if (deleteTarget.type === 'section') {
      const mod = s.modules.find(m => m.id === deleteTarget.moduleId);
      const topic = mod?.topics.find(t => t.id === deleteTarget.topicId);
      if (topic) topic.sections = topic.sections.filter(se => se.id !== deleteTarget.sectionId);
    } else if (deleteTarget.type === 'block') {
      const mod = s.modules.find(m => m.id === deleteTarget.moduleId);
      const topic = mod?.topics.find(t => t.id === deleteTarget.topicId);
      const sec = topic?.sections.find(se => se.id === deleteTarget.sectionId);
      if (sec) sec.blocks = sec.blocks.filter(bl => bl.id !== deleteTarget.blockId);
    }
    onChange(s);
    setDeleteTarget(null);
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function onDragStart(info: DragInfo) {
    dragInfo.current = info;
  }

  function onDragOver(e: React.DragEvent, parentPath: string, index: number) {
    e.preventDefault();
    setDropTarget({ parentPath, index });
  }

  function onDrop(e: React.DragEvent, parentPath: string, toIndex: number) {
    e.preventDefault();
    setDropTarget(null);
    const info = dragInfo.current;
    if (!info || info.parentPath !== parentPath) return;
    if (info.index === toIndex) return;
    const s = structuredClone(state);
    if (info.type === 'module') {
      s.modules = reorder(s.modules, info.index, toIndex);
    } else if (info.type === 'topic') {
      const mod = s.modules.find(m => m.id === parentPath);
      if (mod) mod.topics = reorder(mod.topics, info.index, toIndex);
    } else if (info.type === 'section') {
      const [modId, topicId] = parentPath.split('/');
      const mod = s.modules.find(m => m.id === modId);
      const topic = mod?.topics.find(t => t.id === topicId);
      if (topic) topic.sections = reorder(topic.sections, info.index, toIndex);
    } else if (info.type === 'block') {
      const [modId, topicId, secId] = parentPath.split('/');
      const mod = s.modules.find(m => m.id === modId);
      const topic = mod?.topics.find(t => t.id === topicId);
      const sec = topic?.sections.find(se => se.id === secId);
      if (sec) sec.blocks = reorder(sec.blocks, info.index, toIndex);
    }
    onChange(s);
    dragInfo.current = null;
  }

  // ── Keyboard DnD ──────────────────────────────────────────────────────────

  function handleGrabKeyDown(
    e: React.KeyboardEvent,
    type: GrabState['type'],
    parentPath: string,
    index: number,
    siblingCount: number,
  ) {
    if (e.key === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      if (grabbed && grabbed.parentPath === parentPath && grabbed.index === index) {
        // Drop
        setGrabbed(null);
        announce(`${type} dropped at position ${index + 1}`);
        return;
      }
      setGrabbed({ type, parentPath, index, originalIndex: index });
      announce(`${type} grabbed. Use arrow keys to move. Press Space or Enter to drop, Escape to cancel.`);
      return;
    }

    if (!grabbed || grabbed.parentPath !== parentPath || grabbed.index !== index) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      // Revert
      const s = structuredClone(state);
      applyReorder(s, grabbed.type, grabbed.parentPath, grabbed.index, grabbed.originalIndex);
      onChange(s);
      setGrabbed(null);
      announce('Cancelled. Item returned to original position.');
      return;
    }

    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      const newIndex = index - 1;
      const s = structuredClone(state);
      applyReorder(s, grabbed.type, grabbed.parentPath, index, newIndex);
      onChange(s);
      setGrabbed({ ...grabbed, index: newIndex });
      announce(`${type} moved to position ${newIndex + 1} of ${siblingCount}`);
    }

    if (e.key === 'ArrowDown' && index < siblingCount - 1) {
      e.preventDefault();
      const newIndex = index + 1;
      const s = structuredClone(state);
      applyReorder(s, grabbed.type, grabbed.parentPath, index, newIndex);
      onChange(s);
      setGrabbed({ ...grabbed, index: newIndex });
      announce(`${type} moved to position ${newIndex + 1} of ${siblingCount}`);
    }
  }

  function applyReorder(
    s: CourseStructureState,
    type: GrabState['type'],
    parentPath: string,
    from: number,
    to: number,
  ) {
    if (type === 'module') {
      s.modules = reorder(s.modules, from, to);
    } else if (type === 'topic') {
      const mod = s.modules.find(m => m.id === parentPath);
      if (mod) mod.topics = reorder(mod.topics, from, to);
    } else if (type === 'section') {
      const [modId, topicId] = parentPath.split('/');
      const mod = s.modules.find(m => m.id === modId);
      const topic = mod?.topics.find(t => t.id === topicId);
      if (topic) topic.sections = reorder(topic.sections, from, to);
    } else {
      const [modId, topicId, secId] = parentPath.split('/');
      const mod = s.modules.find(m => m.id === modId);
      const topic = mod?.topics.find(t => t.id === topicId);
      const sec = topic?.sections.find(se => se.id === secId);
      if (sec) sec.blocks = reorder(sec.blocks, from, to);
    }
  }

  // ── Drop indicator ────────────────────────────────────────────────────────

  function isDropTarget(parentPath: string, index: number) {
    return dropTarget?.parentPath === parentPath && dropTarget?.index === index;
  }

  // ── Delete confirmation check ─────────────────────────────────────────────

  function isDeleteTarget(id: string) {
    if (!deleteTarget) return false;
    if (deleteTarget.type === 'module') return deleteTarget.moduleId === id;
    if (deleteTarget.type === 'topic') return deleteTarget.topicId === id;
    if (deleteTarget.type === 'section') return deleteTarget.sectionId === id;
    if (deleteTarget.type === 'block') return deleteTarget.blockId === id;
    return false;
  }

  function getDeleteTitle() {
    if (!deleteTarget) return '';
    if (deleteTarget.type === 'module') return state.modules.find(m => m.id === deleteTarget.moduleId)?.title ?? 'this module';
    if (deleteTarget.type === 'topic') {
      const mod = state.modules.find(m => m.id === deleteTarget.moduleId);
      return mod?.topics.find(t => t.id === deleteTarget.topicId)?.title ?? 'this topic';
    }
    if (deleteTarget.type === 'section') {
      const mod = state.modules.find(m => m.id === deleteTarget.moduleId);
      const topic = mod?.topics.find(t => t.id === deleteTarget.topicId);
      return topic?.sections.find(s => s.id === deleteTarget.sectionId)?.title ?? 'this section';
    }
    if (deleteTarget.type === 'block') {
      const mod = state.modules.find(m => m.id === deleteTarget.moduleId);
      const topic = mod?.topics.find(t => t.id === deleteTarget.topicId);
      const sec = topic?.sections.find(se => se.id === deleteTarget.sectionId);
      return sec?.blocks.find(b => b.id === deleteTarget.blockId)?.title ?? 'this block';
    }
    return '';
  }

  // ── Row helpers ───────────────────────────────────────────────────────────

  function DeleteConfirmRow({ label }: { label: string }) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-sm">
        <span className="flex-1 text-[#991b1b] font-medium truncate">Delete {label}?</span>
        <button
          type="button"
          onClick={() => setDeleteTarget(null)}
          className="px-2 py-1 text-xs rounded text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDeleteConfirm}
          className="px-2 py-1 text-xs rounded bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-colors font-medium"
        >
          Delete
        </button>
      </div>
    );
  }

  // ── Block rows ────────────────────────────────────────────────────────────

  function renderBlocks(blocks: StructureBlock[], modId: string, topicId: string, secId: string) {
    const parentPath = `${modId}/${topicId}/${secId}`;
    return (
      <div role="list" className="ml-5 space-y-0.5">
        {blocks.map((block, i) => {
          const isGrabbed = grabbed?.parentPath === parentPath && grabbed?.index === i;
          const deleteKey = block.id;
          if (isDeleteTarget(deleteKey)) {
            return (
              <div key={block.id} role="listitem">
                <DeleteConfirmRow label={block.title} />
              </div>
            );
          }
          return (
            <div key={block.id} role="listitem">
              {isDropTarget(parentPath, i) && (
                <div className="h-0.5 bg-blue-500 rounded mb-0.5" />
              )}
              <div
                draggable
                onDragStart={() => onDragStart({ type: 'block', parentPath, index: i })}
                onDragOver={e => onDragOver(e, parentPath, i)}
                onDrop={e => onDrop(e, parentPath, i)}
                onDragEnd={() => setDropTarget(null)}
                className={`p-2.5 rounded-lg hover:bg-[#f9fafb] flex items-center gap-2 group transition-colors ${isGrabbed ? 'opacity-50 bg-blue-50' : ''}`}
                aria-label={`Block: ${block.title}, ${i + 1} of ${blocks.length} blocks`}
              >
                <button
                  type="button"
                  aria-label={`Drag handle for block ${block.title}`}
                  aria-grabbed={isGrabbed ? 'true' : 'false'}
                  className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-[#e5e7eb] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                  onKeyDown={e => handleGrabKeyDown(e, 'block', parentPath, i, blocks.length)}
                >
                  <GripIcon />
                </button>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                <span className="text-sm text-[#6b7280] truncate flex-1">{block.title}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    type="button"
                    aria-label={`Edit block ${block.title}`}
                    onClick={() => setEditTarget({ type: 'block', moduleId: modId, topicId, sectionId: secId, blockId: block.id })}
                    className="p-1 rounded hover:bg-[#e5e7eb] text-[#9ca3af] hover:text-[#2d6fa8] transition-colors"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete block ${block.title}`}
                    onClick={() => setDeleteTarget({ type: 'block', moduleId: modId, topicId, sectionId: secId, blockId: block.id })}
                    className="p-1 rounded hover:bg-[#fee2e2] text-[#9ca3af] hover:text-[#dc2626] transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
              {i === blocks.length - 1 && isDropTarget(parentPath, i + 1) && (
                <div className="h-0.5 bg-blue-500 rounded mt-0.5" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Section rows ──────────────────────────────────────────────────────────

  function renderSections(sections: StructureSection[], modId: string, topicId: string) {
    const parentPath = `${modId}/${topicId}`;
    return (
      <div role="list" className="ml-5 space-y-0.5 border-l border-[#e5e7eb] pl-3">
        {sections.map((sec, i) => {
          const isGrabbed = grabbed?.parentPath === parentPath && grabbed?.index === i;
          const deleteKey = sec.id;
          if (isDeleteTarget(deleteKey) && deleteTarget?.type === 'section') {
            return (
              <div key={sec.id} role="listitem">
                <DeleteConfirmRow label={sec.title} />
              </div>
            );
          }
          return (
            <div key={sec.id} role="listitem">
              {isDropTarget(parentPath, i) && (
                <div className="h-0.5 bg-blue-500 rounded mb-0.5" />
              )}
              <div
                draggable
                onDragStart={() => onDragStart({ type: 'section', parentPath, index: i })}
                onDragOver={e => onDragOver(e, parentPath, i)}
                onDrop={e => onDrop(e, parentPath, i)}
                onDragEnd={() => setDropTarget(null)}
                className={`rounded-lg ${isGrabbed ? 'opacity-50 bg-blue-50' : ''}`}
              >
                <div
                  className="p-2.5 rounded-lg hover:bg-[#f9fafb] flex items-center justify-between group"
                  aria-label={`Section: ${sec.title}, ${i + 1} of ${sections.length} sections`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      aria-label={`Drag handle for section ${sec.title}`}
                      aria-grabbed={isGrabbed ? 'true' : 'false'}
                      className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-[#e5e7eb] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                      onKeyDown={e => handleGrabKeyDown(e, 'section', parentPath, i, sections.length)}
                    >
                      <GripIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(sec.id)}
                      className="p-0.5 rounded hover:bg-[#e5e7eb] text-[#6b7280] shrink-0"
                      aria-label={expanded[sec.id] ? 'Collapse section' : 'Expand section'}
                    >
                      <ChevronIcon expanded={!!expanded[sec.id]} />
                    </button>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d1a808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    <span className="text-sm text-[#6b7280] truncate">{sec.title}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      aria-label={`Add block to section ${sec.title}`}
                      onClick={() => setAddTarget({ type: 'block', moduleId: modId, topicId, sectionId: sec.id })}
                      className="p-1 rounded hover:bg-[#e5e7eb] text-[#9ca3af] hover:text-[#2d6fa8] transition-colors"
                    >
                      <PlusIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit section ${sec.title}`}
                      onClick={() => setEditTarget({ type: 'section', moduleId: modId, topicId, sectionId: sec.id })}
                      className="p-1 rounded hover:bg-[#e5e7eb] text-[#9ca3af] hover:text-[#2d6fa8] transition-colors"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete section ${sec.title}`}
                      onClick={() => setDeleteTarget({ type: 'section', moduleId: modId, topicId, sectionId: sec.id })}
                      className="p-1 rounded hover:bg-[#fee2e2] text-[#9ca3af] hover:text-[#dc2626] transition-colors"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                {expanded[sec.id] && renderBlocks(sec.blocks, modId, topicId, sec.id)}
                {expanded[sec.id] && (
                  <div className="ml-5 mt-0.5">
                    <button
                      type="button"
                      onClick={() => setAddTarget({ type: 'block', moduleId: modId, topicId, sectionId: sec.id })}
                      aria-label="Add block"
                      className="flex items-center gap-1.5 text-xs text-[#9ca3af] hover:text-[#2d6fa8] px-2 py-1 rounded hover:bg-[#f0f7ff] transition-colors"
                    >
                      <PlusIcon size={11} />
                      Add block
                    </button>
                  </div>
                )}
              </div>
              {i === sections.length - 1 && isDropTarget(parentPath, i + 1) && (
                <div className="h-0.5 bg-blue-500 rounded mt-0.5" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Topic rows ────────────────────────────────────────────────────────────

  function renderTopics(topics: StructureTopic[], modId: string) {
    const parentPath = modId;
    return (
      <div role="list" className="ml-5 space-y-0.5 border-l border-[#e5e7eb] pl-3">
        {topics.map((topic, i) => {
          const isGrabbed = grabbed?.parentPath === parentPath && grabbed?.index === i;
          const deleteKey = topic.id;
          if (isDeleteTarget(deleteKey) && deleteTarget?.type === 'topic') {
            return (
              <div key={topic.id} role="listitem">
                <DeleteConfirmRow label={topic.title} />
              </div>
            );
          }
          return (
            <div key={topic.id} role="listitem">
              {isDropTarget(parentPath, i) && (
                <div className="h-0.5 bg-blue-500 rounded mb-0.5" />
              )}
              <div
                draggable
                onDragStart={() => onDragStart({ type: 'topic', parentPath, index: i })}
                onDragOver={e => onDragOver(e, parentPath, i)}
                onDrop={e => onDrop(e, parentPath, i)}
                onDragEnd={() => setDropTarget(null)}
                className={`rounded-lg ${isGrabbed ? 'opacity-50 bg-blue-50' : ''}`}
              >
                <div
                  className="p-2.5 rounded-lg hover:bg-[#f9fafb] flex items-center justify-between group"
                  aria-label={`Topic: ${topic.title}, ${i + 1} of ${topics.length} topics`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      aria-label={`Drag handle for topic ${topic.title}`}
                      aria-grabbed={isGrabbed ? 'true' : 'false'}
                      className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-[#e5e7eb] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                      onKeyDown={e => handleGrabKeyDown(e, 'topic', parentPath, i, topics.length)}
                    >
                      <GripIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(topic.id)}
                      className="p-0.5 rounded hover:bg-[#e5e7eb] text-[#6b7280] shrink-0"
                      aria-label={expanded[topic.id] ? 'Collapse topic' : 'Expand topic'}
                    >
                      <ChevronIcon expanded={!!expanded[topic.id]} />
                    </button>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    </svg>
                    <span className="text-sm text-[#6b7280] truncate">{topic.title}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      aria-label={`Add section to topic ${topic.title}`}
                      onClick={() => setAddTarget({ type: 'section', moduleId: modId, topicId: topic.id })}
                      className="p-1 rounded hover:bg-[#e5e7eb] text-[#9ca3af] hover:text-[#2d6fa8] transition-colors"
                    >
                      <PlusIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit topic ${topic.title}`}
                      onClick={() => setEditTarget({ type: 'topic', moduleId: modId, topicId: topic.id })}
                      className="p-1 rounded hover:bg-[#e5e7eb] text-[#9ca3af] hover:text-[#2d6fa8] transition-colors"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete topic ${topic.title}`}
                      onClick={() => setDeleteTarget({ type: 'topic', moduleId: modId, topicId: topic.id })}
                      className="p-1 rounded hover:bg-[#fee2e2] text-[#9ca3af] hover:text-[#dc2626] transition-colors"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                {expanded[topic.id] && renderSections(topic.sections, modId, topic.id)}
                {expanded[topic.id] && (
                  <div className="ml-5 mt-0.5">
                    <button
                      type="button"
                      onClick={() => setAddTarget({ type: 'section', moduleId: modId, topicId: topic.id })}
                      aria-label="Add section"
                      className="flex items-center gap-1.5 text-xs text-[#9ca3af] hover:text-[#2d6fa8] px-2 py-1 rounded hover:bg-[#f0f7ff] transition-colors"
                    >
                      <PlusIcon size={11} />
                      Add section
                    </button>
                  </div>
                )}
              </div>
              {i === topics.length - 1 && isDropTarget(parentPath, i + 1) && (
                <div className="h-0.5 bg-blue-500 rounded mt-0.5" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Module rows ───────────────────────────────────────────────────────────

  function renderModules(modules: StructureModule[]) {
    const parentPath = '';
    return (
      <div role="list" className="ml-4 space-y-1 border-l-2 border-[#e5e7eb] pl-4">
        {modules.map((mod, i) => {
          const isGrabbed = grabbed?.parentPath === parentPath && grabbed?.index === i;
          const deleteKey = mod.id;
          if (isDeleteTarget(deleteKey) && deleteTarget?.type === 'module') {
            return (
              <div key={mod.id} role="listitem">
                <DeleteConfirmRow label={mod.title} />
              </div>
            );
          }
          return (
            <div key={mod.id} role="listitem">
              {isDropTarget(parentPath, i) && (
                <div className="h-0.5 bg-blue-500 rounded mb-0.5" />
              )}
              <div
                draggable
                onDragStart={() => onDragStart({ type: 'module', parentPath, index: i })}
                onDragOver={e => onDragOver(e, parentPath, i)}
                onDrop={e => onDrop(e, parentPath, i)}
                onDragEnd={() => setDropTarget(null)}
                className={`rounded-lg ${isGrabbed ? 'opacity-50 bg-blue-50' : ''}`}
              >
                <div
                  className="p-2.5 rounded-lg hover:bg-[#f9fafb] flex items-center justify-between group"
                  aria-label={`Module: ${mod.title}, ${i + 1} of ${modules.length} modules`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      aria-label={`Drag handle for module ${mod.title}`}
                      aria-grabbed={isGrabbed ? 'true' : 'false'}
                      className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-[#e5e7eb] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                      onKeyDown={e => handleGrabKeyDown(e, 'module', parentPath, i, modules.length)}
                    >
                      <GripIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(mod.id)}
                      className="p-0.5 rounded hover:bg-[#e5e7eb] text-[#6b7280] shrink-0"
                      aria-label={expanded[mod.id] ? 'Collapse module' : 'Expand module'}
                    >
                      <ChevronIcon expanded={!!expanded[mod.id]} />
                    </button>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    </svg>
                    <span className="text-sm font-medium text-[#374151] truncate">{mod.title}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      aria-label={`Add topic to module ${mod.title}`}
                      onClick={() => setAddTarget({ type: 'topic', moduleId: mod.id })}
                      className="p-1 rounded hover:bg-[#e5e7eb] text-[#9ca3af] hover:text-[#2d6fa8] transition-colors"
                    >
                      <PlusIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit module ${mod.title}`}
                      onClick={() => setEditTarget({ type: 'module', moduleId: mod.id })}
                      className="p-1 rounded hover:bg-[#e5e7eb] text-[#9ca3af] hover:text-[#2d6fa8] transition-colors"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete module ${mod.title}`}
                      onClick={() => setDeleteTarget({ type: 'module', moduleId: mod.id })}
                      className="p-1 rounded hover:bg-[#fee2e2] text-[#9ca3af] hover:text-[#dc2626] transition-colors"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                {expanded[mod.id] && renderTopics(mod.topics, mod.id)}
                {expanded[mod.id] && (
                  <div className="ml-5 mt-0.5">
                    <button
                      type="button"
                      onClick={() => setAddTarget({ type: 'topic', moduleId: mod.id })}
                      aria-label="Add topic"
                      className="flex items-center gap-1.5 text-xs text-[#9ca3af] hover:text-[#2d6fa8] px-2 py-1 rounded hover:bg-[#f0f7ff] transition-colors"
                    >
                      <PlusIcon size={11} />
                      Add topic
                    </button>
                  </div>
                )}
              </div>
              {i === modules.length - 1 && isDropTarget(parentPath, i + 1) && (
                <div className="h-0.5 bg-blue-500 rounded mt-0.5" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Add / Edit modal labels ────────────────────────────────────────────────

  const addLabel = addTarget
    ? addTarget.type === 'module' ? 'Add Module'
    : addTarget.type === 'topic' ? 'Add Topic'
    : addTarget.type === 'section' ? 'Add Section'
    : 'Add Block'
    : '';

  const editLabel = editTarget
    ? editTarget.type === 'module' ? 'Edit Module'
    : editTarget.type === 'topic' ? 'Edit Topic'
    : editTarget.type === 'section' ? 'Edit Section'
    : 'Edit Block'
    : '';

  const editInitial = editTarget ? getEditInitialValues() : { title: '', description: '' };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Visually hidden live region for DnD announcements */}
      <div
        ref={liveRef}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />

      {addTarget && (
        <AddModal
          title={addLabel}
          onConfirm={handleAddConfirm}
          onCancel={() => setAddTarget(null)}
        />
      )}
      {editTarget && (
        <AddModal
          title={editLabel}
          initialTitle={editInitial.title}
          initialDescription={editInitial.description}
          confirmLabel="Save"
          onConfirm={handleEditConfirm}
          onCancel={() => setEditTarget(null)}
        />
      )}

      <div className="space-y-1">
        {/* Course root */}
        <div className="bg-[#f3f4f6] border border-[#e5e7eb] rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2d6fa8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span className="font-semibold text-[#111827] text-sm">{state.courseTitle}</span>
          </div>
          <button
            type="button"
            aria-label="Add module"
            onClick={() => setAddTarget({ type: 'module' })}
            className="p-1 rounded hover:bg-white text-[#9ca3af] hover:text-[#2d6fa8] transition-colors"
          >
            <PlusIcon />
          </button>
        </div>

        {/* Modules */}
        {renderModules(state.modules)}

        {/* Add module inline link */}
        <div className="ml-4 pl-4">
          <button
            type="button"
            onClick={() => setAddTarget({ type: 'module' })}
            aria-label="Add module"
            className="flex items-center gap-1.5 text-xs text-[#9ca3af] hover:text-[#2d6fa8] px-2 py-1 rounded hover:bg-[#f0f7ff] transition-colors"
          >
            <PlusIcon size={11} />
            Add module
          </button>
        </div>
      </div>
    </>
  );
}
