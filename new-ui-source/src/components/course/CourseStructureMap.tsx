import React, { useState, useCallback, useId } from 'react';
import type { Course } from '../../types/course';

// ─── Data model ──────────────────────────────────────────────────────────────

export interface StructureSection {
  id: string;
  title: string;
  description: string;
  blocks: StructureBlock[];
}

export interface StructureBlock {
  id: string;
  title: string;
  description: string;
}

export interface StructureTopic {
  id: string;
  title: string;
  description: string;
  sections: StructureSection[];
}

export interface StructureModule {
  id: string;
  title: string;
  description: string;
  colorIndex: number;
  topics: StructureTopic[];
}

export interface CourseStructureState {
  courseTitle: string;
  modules: StructureModule[];
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLORS = [
  { light: 'bg-[#dbeaf5]', icon: 'text-[#4a7fa5]', border: 'border-[#4a7fa5]' },
  { light: 'bg-[#d4ede8]', icon: 'text-[#3d8f7c]', border: 'border-[#3d8f7c]' },
  { light: 'bg-[#e6ddf5]', icon: 'text-[#7c5cbf]', border: 'border-[#7c5cbf]' },
  { light: 'bg-[#f5dddd]', icon: 'text-[#bf5c5c]', border: 'border-[#bf5c5c]' },
  { light: 'bg-[#f5ebda]', icon: 'text-[#b07d3a]', border: 'border-[#b07d3a]' },
  { light: 'bg-[#dde5f5]', icon: 'text-[#5c7abf]', border: 'border-[#5c7abf]' },
];

// ─── Layout constants (px) ────────────────────────────────────────────────────
const CW   = 160;  // card width
const CH   = 148;  // card height (thumbnail 96 + label 52)
const ADDW = 48;   // "+" add button size
const GAP  = 28;   // horizontal gap between siblings
const VSTEM = 36;  // vertical stem height between rows
const HSTEM = 16;  // extra horizontal padding each side of group

// ─── Node modal (add or edit) ─────────────────────────────────────────────────

interface AddModalProps {
  title: string;
  initialTitle?: string;
  initialDescription?: string;
  confirmLabel?: string;
  onConfirm: (title: string, description: string) => void;
  onCancel: () => void;
}

export function AddModal({
  title,
  initialTitle = '',
  initialDescription = '',
  confirmLabel = 'Add',
  onConfirm,
  onCancel,
}: AddModalProps) {
  const [t, setT] = useState(initialTitle);
  const [d, setD] = useState(initialDescription);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-[360px] p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              autoFocus
              value={t}
              onChange={e => setT(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && t.trim() && onConfirm(t.trim(), d.trim())}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter title…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={d}
              onChange={e => setD(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter description…"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!t.trim()}
            onClick={() => t.trim() && onConfirm(t.trim(), d.trim())}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add placeholder button ───────────────────────────────────────────────────

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="w-full h-full flex items-center justify-center rounded-full bg-white border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors"
    >
      <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    </button>
  );
}

// ─── SVG connector helpers ───────────────────────────────────────────────────

function VLine({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return <line x1={x} y1={y1} x2={x} y2={y2} stroke="#d1d5db" strokeWidth={1.5} />;
}
function HLine({ y, x1, x2 }: { y: number; x1: number; x2: number }) {
  return <line x1={x1} y1={y} x2={x2} y2={y} stroke="#d1d5db" strokeWidth={1.5} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface CourseStructureMapProps {
  initialState?: CourseStructureState;
  courseTitle?: string;
  onChange?: (state: CourseStructureState) => void;
  course?: Course;
  onNodeClick?: (pageId: string) => void;
}

type ModalTarget =
  | { type: 'module' }
  | { type: 'topic'; moduleId: string }
  | { type: 'section'; moduleId: string; topicId: string }
  | { type: 'block'; moduleId: string; topicId: string; sectionId: string };

type EditTarget =
  | { type: 'course' }
  | { type: 'module'; moduleId: string }
  | { type: 'topic'; moduleId: string; topicId: string }
  | { type: 'section'; moduleId: string; topicId: string; sectionId: string }
  | { type: 'block'; moduleId: string; topicId: string; sectionId: string; blockId: string };

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function CourseStructureMap({
  initialState,
  courseTitle = 'Course',
  onChange,
  course,
  onNodeClick,
}: CourseStructureMapProps) {
  const [state, setState] = useState<CourseStructureState>(
    initialState ?? { courseTitle, modules: [] }
  );
  const [modal, setModal] = useState<ModalTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const update = useCallback((next: CourseStructureState) => {
    setState(next);
    onChange?.(next);
  }, [onChange]);

  function handleConfirm(title: string, description: string) {
    if (!modal) return;
    const s = structuredClone(state);

    if (modal.type === 'module') {
      s.modules.push({
        id: `mod-${uid()}`,
        title,
        description,
        colorIndex: s.modules.length % COLORS.length,
        topics: [],
      });
    } else if (modal.type === 'topic') {
      const mod = s.modules.find(m => m.id === modal.moduleId);
      if (mod) mod.topics.push({ id: `topic-${uid()}`, title, description, sections: [] });
    } else if (modal.type === 'section') {
      const mod = s.modules.find(m => m.id === modal.moduleId);
      const topic = mod?.topics.find(t => t.id === modal.topicId);
      if (topic) topic.sections.push({ id: `sec-${uid()}`, title, description, blocks: [] });
    } else if (modal.type === 'block') {
      const mod = s.modules.find(m => m.id === modal.moduleId);
      const topic = mod?.topics.find(t => t.id === modal.topicId);
      const sec = topic?.sections.find(se => se.id === modal.sectionId);
      if (sec) sec.blocks.push({ id: `block-${uid()}`, title, description });
    }

    update(s);
    setModal(null);
  }

  function getEditInitialValues(): { title: string; description: string } {
    if (!editTarget) return { title: '', description: '' };
    if (editTarget.type === 'course') return { title: state.courseTitle, description: '' };
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
    // block
    const m = state.modules.find(x => x.id === editTarget.moduleId);
    const t = m?.topics.find(x => x.id === editTarget.topicId);
    const s = t?.sections.find(x => x.id === editTarget.sectionId);
    const b = s?.blocks.find(x => x.id === editTarget.blockId);
    return { title: b?.title ?? '', description: b?.description ?? '' };
  }

  function handleEditConfirm(newTitle: string, newDescription: string) {
    if (!editTarget) return;
    const s = structuredClone(state);
    if (editTarget.type === 'course') {
      s.courseTitle = newTitle;
    } else if (editTarget.type === 'module') {
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
    update(s);
    setEditTarget(null);
  }

  // ── Layout geometry ──────────────────────────────────────────────────────

  // Compute per-module layout: column width, x offset, internal node positions
  interface ModuleLayout {
    mod: StructureModule;
    colW: number;        // total column width including topics
    colX: number;        // left edge of this column in SVG
    modCX: number;       // center x of the module card
    topics: TopicLayout[];
    addTopicX: number;   // center x of "add topic" btn
  }
  interface TopicLayout {
    topic: StructureTopic;
    topicX: number;      // left edge of topic card
    topicCX: number;
    sections: SectionLayout[];
    addSectionX: number;
  }
  interface SectionLayout {
    section: StructureSection;
    sectionX: number;
    sectionCX: number;
    blocks: BlockLayout[];
    addBlockX: number;
  }
  interface BlockLayout {
    block: StructureBlock;
    blockX: number;
    blockCX: number;
  }

  // Bottom of each card type (top of card + card height)
  const MOD_TOP    = CH + VSTEM;           // Y top of module cards row
  const TOPIC_TOP  = MOD_TOP + CH + VSTEM; // Y top of topic cards row
  const SEC_TOP    = TOPIC_TOP + CH + VSTEM;
  const BLOCK_TOP  = SEC_TOP + CH + VSTEM;

  // For a group of N items: total width = N * CW + (N-1) * GAP, or ADDW if N=0
  function groupW(n: number) {
    return n === 0 ? ADDW : n * CW + (n - 1) * GAP;
  }

  // Build layout
  const modLayouts: ModuleLayout[] = [];
  let curX = 0;

  for (const mod of state.modules) {
    const c = COLORS[mod.colorIndex];
    const topicLayouts: TopicLayout[] = [];
    let topicCurX = 0;

    for (const topic of mod.topics) {
      const secLayouts: SectionLayout[] = [];
      let secCurX = 0;

      for (const section of topic.sections) {
        const blockLayouts: BlockLayout[] = [];
        let blockCurX = 0;
        for (const block of section.blocks) {
          blockLayouts.push({
            block,
            blockX: blockCurX,
            blockCX: blockCurX + CW / 2,
          });
          blockCurX += CW + GAP;
        }
        // + add block button
        const addBlockX = blockCurX + (section.blocks.length > 0 ? 0 : 0);
        const secColW = Math.max(groupW(section.blocks.length), ADDW);
        const addBlockCX = section.blocks.length > 0 ? blockCurX + ADDW / 2 : secCurX + ADDW / 2;

        secLayouts.push({
          section,
          sectionX: secCurX,
          sectionCX: secCurX + CW / 2,
          blocks: blockLayouts,
          addBlockX: secCurX + groupW(section.blocks.length) + (section.blocks.length > 0 ? GAP : 0),
        });
        secCurX += Math.max(CW, groupW(section.blocks.length + 0)) + GAP;
      }

      const addSectionX = secCurX; // left edge of "add section" button
      const topicColW = Math.max(groupW(topic.sections.length), CW);

      topicLayouts.push({
        topic,
        topicX: topicCurX,
        topicCX: topicCurX + CW / 2,
        sections: secLayouts,
        addSectionX: topicCurX + topicColW + (topic.sections.length > 0 ? GAP : 0),
      });
      topicCurX += topicColW + GAP;
    }

    const addTopicX = topicCurX; // left edge of "add topic" button
    const modColW = Math.max(groupW(mod.topics.length), CW);
    const modCX = modColW / 2;

    modLayouts.push({
      mod,
      colW: modColW,
      colX: curX,
      modCX: curX + modCX,
      topics: topicLayouts.map(tl => ({
        ...tl,
        topicX: curX + tl.topicX,
        topicCX: curX + tl.topicCX,
        sections: tl.sections.map(sl => ({
          ...sl,
          sectionX: curX + sl.sectionX,
          sectionCX: curX + sl.sectionCX,
          addBlockX: curX + sl.addBlockX,
          blocks: sl.blocks.map(bl => ({
            ...bl,
            blockX: curX + bl.blockX,
            blockCX: curX + bl.blockCX,
          })),
        })),
        addSectionX: curX + tl.addSectionX,
      })),
      addTopicX: curX + addTopicX,
    });
    curX += modColW + GAP;
  }

  // Total SVG width: all modules + "add module" btn
  const addModuleX = curX;
  const totalW = curX + ADDW + HSTEM * 2;
  const courseCX = totalW / 2;

  // Height: deepest row used
  const hasTopics    = state.modules.some(m => m.topics.length > 0);
  const hasSections  = state.modules.some(m => m.topics.some(t => t.sections.length > 0));
  const hasBlocks    = state.modules.some(m => m.topics.some(t => t.sections.some(s => s.blocks.length > 0)));

  let svgH = CH + VSTEM;  // at minimum: course card + stem for add module row
  if (state.modules.length > 0)  svgH = MOD_TOP + CH + 24;
  if (hasTopics)   svgH = TOPIC_TOP + CH + VSTEM + ADDW + 24;
  if (hasSections) svgH = SEC_TOP + CH + VSTEM + ADDW + 24;
  if (hasBlocks)   svgH = BLOCK_TOP + CH + VSTEM + ADDW + 24;

  const modalLabel = modal
    ? modal.type === 'module'  ? 'Add Module'
    : modal.type === 'topic'   ? 'Add Topic'
    : modal.type === 'section' ? 'Add Section'
    : 'Add Block'
    : '';

  const editLabel = editTarget
    ? editTarget.type === 'course'  ? 'Edit Course'
    : editTarget.type === 'module'  ? 'Edit Module'
    : editTarget.type === 'topic'   ? 'Edit Topic'
    : editTarget.type === 'section' ? 'Edit Section'
    : 'Edit Block'
    : '';

  const editInitial = editTarget ? getEditInitialValues() : { title: '', description: '' };

  return (
    <>
      {modal && (
        <AddModal
          title={modalLabel}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
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

      <div className="w-full bg-[#f5f5f5] rounded-xl overflow-x-auto">
        <div className="min-w-max px-8 py-10">
          <svg
            width={totalW}
            height={svgH}
            className="overflow-visible"
            aria-label="Course structure map"
          >
            {/* ── Course card (centred) ── */}
            <foreignObject x={courseCX - CW / 2} y={0} width={CW} height={CH}>
              <div className="w-full h-full group/card">
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm h-full flex flex-col relative">
                  <div className="flex-1 bg-[#3d5f82] flex items-center justify-center">
                    <svg className="w-9 h-9 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <div className="px-3 py-2 shrink-0 flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{state.courseTitle}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Course</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Edit course title"
                      onClick={() => setEditTarget({ type: 'course' })}
                      className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </foreignObject>

            {/* ── Vertical stem: course → module row ── */}
            <VLine x={courseCX} y1={CH} y2={MOD_TOP - ADDW / 2 - 4} />

            {/* ── "Add module" button — always visible below course card ── */}
            {state.modules.length === 0 ? (
              /* No modules yet: centre the + under the course card */
              <foreignObject x={courseCX - ADDW / 2} y={MOD_TOP - ADDW / 2 - 4} width={ADDW} height={ADDW}>
                <div className="w-full h-full flex items-center justify-center">
                  <AddBtn label="Add Module" onClick={() => setModal({ type: 'module' })} />
                </div>
              </foreignObject>
            ) : (
              <>
                {/* T-bar across all modules */}
                <HLine
                  y={MOD_TOP - VSTEM / 2}
                  x1={modLayouts[0].modCX}
                  x2={addModuleX + ADDW / 2 + HSTEM}
                />

                {/* "Add module" at the end of the row */}
                <VLine x={addModuleX + ADDW / 2 + HSTEM} y1={MOD_TOP - VSTEM / 2} y2={MOD_TOP} />
                <foreignObject x={addModuleX + HSTEM} y={MOD_TOP} width={ADDW} height={ADDW}>
                  <div className="w-full h-full flex items-center justify-center">
                    <AddBtn label="Add Module" onClick={() => setModal({ type: 'module' })} />
                  </div>
                </foreignObject>

                {/* Each module column */}
                {modLayouts.map((ml) => {
                  const c = COLORS[ml.mod.colorIndex];
                  return (
                    <g key={ml.mod.id}>
                      {/* drop stem to module card */}
                      <VLine x={ml.modCX} y1={MOD_TOP - VSTEM / 2} y2={MOD_TOP} />

                      {/* Module card */}
                      <foreignObject x={ml.modCX - CW / 2} y={MOD_TOP} width={CW} height={CH}>
                        <div className="w-full h-full group/card">
                          <div className={`bg-white border-2 ${c.border} rounded-xl overflow-hidden shadow-sm h-full flex flex-col`}>
                            <div className={`flex-1 ${c.light} flex items-center justify-center`}>
                              <svg className={`w-9 h-9 ${c.icon} opacity-60`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
                              </svg>
                            </div>
                            <div className="px-3 py-2 shrink-0 flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate">{ml.mod.title}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Module</p>
                              </div>
                              <button
                                type="button"
                                aria-label={`Edit module ${ml.mod.title}`}
                                onClick={() => setEditTarget({ type: 'module', moduleId: ml.mod.id })}
                                className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </foreignObject>

                      {/* Stem down from module to topic row */}
                      <VLine x={ml.modCX} y1={MOD_TOP + CH} y2={TOPIC_TOP - VSTEM / 2} />

                      {/* T-bar across topics + add btn */}
                      {(() => {
                        const rightmost = ml.topics.length > 0
                          ? ml.topics[ml.topics.length - 1].topicCX
                          : ml.addTopicX + ADDW / 2;
                        const addBtnCX = ml.addTopicX + ADDW / 2;
                        const barLeft = ml.topics.length > 0 ? ml.topics[0].topicCX : addBtnCX;
                        const barRight = addBtnCX;
                        return (
                          <>
                            <HLine y={TOPIC_TOP - VSTEM / 2} x1={barLeft} x2={barRight} />
                            {/* "Add topic" btn */}
                            <VLine x={addBtnCX} y1={TOPIC_TOP - VSTEM / 2} y2={TOPIC_TOP} />
                            <foreignObject x={ml.addTopicX} y={TOPIC_TOP} width={ADDW} height={ADDW}>
                              <div className="w-full h-full flex items-center justify-center">
                                <AddBtn label="Add Topic" onClick={() => setModal({ type: 'topic', moduleId: ml.mod.id })} />
                              </div>
                            </foreignObject>
                          </>
                        );
                      })()}

                      {/* Each topic */}
                      {ml.topics.map((tl) => {
                        return (
                          <g key={tl.topic.id}>
                            {/* drop stem to topic */}
                            <VLine x={tl.topicCX} y1={TOPIC_TOP - VSTEM / 2} y2={TOPIC_TOP} />

                            {/* Topic card */}
                            <foreignObject x={tl.topicX} y={TOPIC_TOP} width={CW} height={CH}>
                              <div className="w-full h-full group/card">
                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                                  <div className={`flex-1 ${c.light} flex items-center justify-center`}>
                                    <svg className={`w-8 h-8 ${c.icon} opacity-60`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                    </svg>
                                  </div>
                                  <div className="px-3 py-2 shrink-0 flex items-start justify-between gap-1">
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-gray-900 truncate">{tl.topic.title}</p>
                                      <p className="text-[10px] text-gray-400 mt-0.5">Topic</p>
                                    </div>
                                    <button
                                      type="button"
                                      aria-label={`Edit topic ${tl.topic.title}`}
                                      onClick={() => setEditTarget({ type: 'topic', moduleId: ml.mod.id, topicId: tl.topic.id })}
                                      className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </foreignObject>

                            {/* Stem down from topic to section row */}
                            <VLine x={tl.topicCX} y1={TOPIC_TOP + CH} y2={SEC_TOP - VSTEM / 2} />

                            {/* T-bar + add section */}
                            {(() => {
                              const addSecCX = tl.addSectionX + ADDW / 2;
                              const barLeft = tl.sections.length > 0 ? tl.sections[0].sectionCX : addSecCX;
                              return (
                                <>
                                  <HLine y={SEC_TOP - VSTEM / 2} x1={barLeft} x2={addSecCX} />
                                  <VLine x={addSecCX} y1={SEC_TOP - VSTEM / 2} y2={SEC_TOP} />
                                  <foreignObject x={tl.addSectionX} y={SEC_TOP} width={ADDW} height={ADDW}>
                                    <div className="w-full h-full flex items-center justify-center">
                                      <AddBtn label="Add Section" onClick={() => setModal({ type: 'section', moduleId: ml.mod.id, topicId: tl.topic.id })} />
                                    </div>
                                  </foreignObject>
                                </>
                              );
                            })()}

                            {/* Each section */}
                            {tl.sections.map((sl) => (
                              <g key={sl.section.id}>
                                <VLine x={sl.sectionCX} y1={SEC_TOP - VSTEM / 2} y2={SEC_TOP} />

                                {/* Section card */}
                                <foreignObject x={sl.sectionX} y={SEC_TOP} width={CW} height={CH}>
                                  <div className="w-full h-full group/card">
                                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                                      <div className={`flex-1 ${c.light} flex items-center justify-center opacity-70`}>
                                        <svg className={`w-7 h-7 ${c.icon} opacity-50`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5" />
                                        </svg>
                                      </div>
                                      <div className="px-3 py-2 shrink-0 flex items-start justify-between gap-1">
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-gray-900 truncate">{sl.section.title}</p>
                                          <p className="text-[10px] text-gray-400 mt-0.5">Section</p>
                                        </div>
                                        <button
                                          type="button"
                                          aria-label={`Edit section ${sl.section.title}`}
                                          onClick={() => setEditTarget({ type: 'section', moduleId: ml.mod.id, topicId: tl.topic.id, sectionId: sl.section.id })}
                                          className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </foreignObject>

                                {/* Stem + add block */}
                                <VLine x={sl.sectionCX} y1={SEC_TOP + CH} y2={BLOCK_TOP - VSTEM / 2} />
                                {(() => {
                                  const addBlockCX = sl.addBlockX + ADDW / 2;
                                  const barLeft = sl.blocks.length > 0 ? sl.blocks[0].blockCX : addBlockCX;
                                  return (
                                    <>
                                      <HLine y={BLOCK_TOP - VSTEM / 2} x1={barLeft} x2={addBlockCX} />
                                      <VLine x={addBlockCX} y1={BLOCK_TOP - VSTEM / 2} y2={BLOCK_TOP} />
                                      <foreignObject x={sl.addBlockX} y={BLOCK_TOP} width={ADDW} height={ADDW}>
                                        <div className="w-full h-full flex items-center justify-center">
                                          <AddBtn label="Add Block" onClick={() => setModal({ type: 'block', moduleId: ml.mod.id, topicId: tl.topic.id, sectionId: sl.section.id })} />
                                        </div>
                                      </foreignObject>
                                    </>
                                  );
                                })()}

                                {/* Blocks */}
                                {sl.blocks.map((bl) => (
                                  <g key={bl.block.id}>
                                    <VLine x={bl.blockCX} y1={BLOCK_TOP - VSTEM / 2} y2={BLOCK_TOP} />
                                    <foreignObject x={bl.blockX} y={BLOCK_TOP} width={CW} height={CH}>
                                      <div className="w-full h-full group/card">
                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                                          <div className={`flex-1 ${c.light} flex items-center justify-center opacity-60`}>
                                            <svg className={`w-6 h-6 ${c.icon} opacity-50`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                                            </svg>
                                          </div>
                                          <div className="px-3 py-2 shrink-0 flex items-start justify-between gap-1">
                                            <div className="min-w-0">
                                              <p className="text-xs font-semibold text-gray-900 truncate">{bl.block.title}</p>
                                              <p className="text-[10px] text-gray-400 mt-0.5">Block</p>
                                            </div>
                                            <button
                                              type="button"
                                              aria-label={`Edit block ${bl.block.title}`}
                                              onClick={() => setEditTarget({ type: 'block', moduleId: ml.mod.id, topicId: tl.topic.id, sectionId: sl.section.id, blockId: bl.block.id })}
                                              className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                                            >
                                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                              </svg>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </foreignObject>
                                  </g>
                                ))}
                              </g>
                            ))}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </>
            )}
          </svg>
        </div>
      </div>
    </>
  );
}
