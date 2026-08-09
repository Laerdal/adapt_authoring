import { useEffect, useState } from "react";
import {
  type CourseStructure,
  type SModule,
  type STopic,
  type StructureLevel,
  mergedChildren,
} from "../../types/structure";
import { StructureIcon } from "./StructureIcons";

// Top-down org-chart of the real course hierarchy:
//   Course → Module → Sub-Module → Topic → Section → Content Group → Component
// Menus (modules/sub-modules) nest recursively. Connectors use the classic CSS
// ::before/::after technique so the layout is correct for any breadth/depth.

interface Props {
  structure: CourseStructure;
  labels: Record<StructureLevel, string>;
  onOpenTopic: (topicId: string) => void;
  onAddModule: () => void;
  onAddSubModule: (moduleId: string) => void;
  onAddTopic: (parentId: string | null) => void;
  onAddSection: (topicId: string) => void;
  onAddContentGroup: (sectionId: string) => void;
  onAddComponent: (blockId: string) => void;
  onRename: (level: StructureLevel, id: string, title: string) => void;
}

const TREE_CSS = `
.csm-tree, .csm-tree ul, .csm-tree li { margin: 0; padding: 0; }
.csm-tree ul { position: relative; padding-top: 28px; white-space: nowrap; text-align: center; }
.csm-tree li { display: inline-block; vertical-align: top; text-align: center; list-style: none; position: relative; padding: 28px 14px 0 14px; }
.csm-tree li::before, .csm-tree li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 1.5px solid #cbd5e1; width: 50%; height: 28px; }
.csm-tree li::after { right: auto; left: 50%; border-left: 1.5px solid #cbd5e1; }
.csm-tree li:only-child::before, .csm-tree li:only-child::after { display: none; }
.csm-tree li:only-child { padding-top: 28px; }
.csm-tree li:first-child::before, .csm-tree li:last-child::after { border: 0 none; }
.csm-tree li:last-child::before { border-right: 1.5px solid #cbd5e1; border-radius: 0 6px 0 0; }
.csm-tree li:first-child::after { border-radius: 6px 0 0 0; }
.csm-tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 1.5px solid #cbd5e1; width: 0; height: 28px; }
.csm-tree > ul { padding-top: 0; }
.csm-tree > ul > li { padding-top: 0; }
.csm-tree > ul > li::before, .csm-tree > ul > li::after { display: none; }
.csm-card { white-space: normal; }
`;

export default function CourseStructureMapView(props: Props) {
  const { structure, labels } = props;
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    document.addEventListener("keyup", onKey);
    return () => document.removeEventListener("keyup", onKey);
  }, [fullscreen]);

  function startRename(id: string, title: string) { setInlineId(id); setInlineValue(title); }
  function commitRename(level: StructureLevel) {
    if (!inlineId) return;
    const v = inlineValue.trim();
    const id = inlineId;
    setInlineId(null);
    if (v) props.onRename(level, id, v);
  }

  function card(level: StructureLevel | "course", id: string, title: string, onOpen?: () => void) {
    const editing = inlineId === id;
    const levelLabel = level === "course" ? "Course" : labels[level];
    return (
      <div className={`csm-card inline-block w-[156px] rounded-xl border border-[#cfe0ef] bg-white shadow-sm overflow-hidden align-top ${onOpen ? "hover:shadow-md transition-shadow" : ""}`}>
        <div className="h-14 bg-[#dbeaf5] flex items-center justify-center text-[#3d6b91]">
          {level === "course" ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          ) : (
            <StructureIcon level={level} size={24} />
          )}
        </div>
        <div className="px-3 py-2 flex items-start justify-between gap-1 text-left group">
          <div className="min-w-0">
            {editing ? (
              <input
                autoFocus
                value={inlineValue}
                onChange={(e) => setInlineValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitRename(level as StructureLevel); } else if (e.key === "Escape") { e.preventDefault(); setInlineId(null); } }}
                onBlur={() => commitRename(level as StructureLevel)}
                aria-label="Edit title"
                className="w-full text-xs border border-[#2d6fa8] rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : onOpen ? (
              <button type="button" onClick={onOpen} title="Open in editor" className="w-full text-left text-xs font-semibold text-[#111827] truncate hover:text-[#2d6fa8] hover:underline">
                {title}
              </button>
            ) : (
              <p className="text-xs font-semibold text-[#111827] truncate">{title}</p>
            )}
            <p className="text-[10px] uppercase tracking-wide text-[#4a7fa5] mt-0.5">{levelLabel}</p>
          </div>
          {level !== "course" && !editing && (
            <button
              type="button"
              aria-label={`Rename ${title}`}
              onClick={(e) => { e.stopPropagation(); startRename(id, title); }}
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[#eef2f7] text-[#9ca3af] hover:text-[#2d6fa8]"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  function addLi(key: string, label: string, onClick: () => void) {
    return (
      <li key={key}>
        <div className="inline-flex flex-col items-center gap-1 align-top">
          <button
            type="button"
            title={label}
            aria-label={label}
            onClick={onClick}
            className="w-10 h-10 rounded-full bg-white border-2 border-dashed border-[#cbd5e1] hover:border-[#2d6fa8] hover:bg-[#f0f7ff] text-[#9ca3af] hover:text-[#2d6fa8] flex items-center justify-center transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <span className="text-[10px] text-[#9ca3af] whitespace-nowrap">{label}</span>
        </div>
      </li>
    );
  }

  // ── Recursive renderers ─────────────────────────────────────────────────────
  function componentsUl(cg: { id: string; components: { id: string; title: string }[] }) {
    return (
      <ul>
        {cg.components.map((comp) => (
          <li key={comp.id}>{card("component", comp.id, comp.title)}</li>
        ))}
        {addLi(`addcomp-${cg.id}`, labels.component, () => props.onAddComponent(cg.id))}
      </ul>
    );
  }

  function sectionUl(topic: STopic) {
    return (
      <ul>
        {topic.sections.map((section) => (
          <li key={section.id}>
            {card("section", section.id, section.title)}
            <ul>
              {section.contentGroups.map((cg) => (
                <li key={cg.id}>
                  {card("contentGroup", cg.id, cg.title)}
                  {componentsUl(cg)}
                </li>
              ))}
              {addLi(`addcg-${section.id}`, labels.contentGroup, () => props.onAddContentGroup(section.id))}
            </ul>
          </li>
        ))}
        {addLi(`addsec-${topic.id}`, labels.section, () => props.onAddSection(topic.id))}
      </ul>
    );
  }

  function topicLi(topic: STopic) {
    return (
      <li key={topic.id}>
        {card("topic", topic.id, topic.title, () => props.onOpenTopic(topic.id))}
        {sectionUl(topic)}
      </li>
    );
  }

  function moduleLi(mod: SModule) {
    return (
      <li key={mod.id}>
        {card("module", mod.id, mod.title)}
        <ul>
          {childrenNodes(mod.id, mod.modules, mod.topics)}
          {addLi(`addsub-${mod.id}`, "Sub-Module", () => props.onAddSubModule(mod.id))}
          {addLi(`addtopic-${mod.id}`, labels.topic, () => props.onAddTopic(mod.id))}
        </ul>
      </li>
    );
  }

  function childrenNodes(_containerId: string, modules: SModule[], topics: STopic[]) {
    return mergedChildren(modules, topics).map((child) =>
      child.kind === "module" ? moduleLi(child.node) : topicLi(child.node)
    );
  }

  const treeBody = (
    <div className="csm-tree inline-block min-w-full px-8 py-8">
      <ul>
        <li>
          {card("course", "__course", structure.courseTitle)}
          <ul>
            {childrenNodes("__course", structure.modules, structure.topics)}
            {addLi("add-module", labels.module, () => props.onAddModule())}
            {addLi("add-topic", labels.topic, () => props.onAddTopic(null))}
          </ul>
        </li>
      </ul>
    </div>
  );

  // Map view is a read-only visualization; editing/reordering lives in Tree view.
  const mapNote = (
    <div className="flex items-center gap-2 rounded-lg bg-[#eff6ff] border border-[#bfdbfe] px-3.5 py-2 text-sm text-[#1e5a91]">
      <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span>This Map shows your current course structure. Drag-and-drop reordering is available in <span className="font-medium">Tree view</span>.</span>
    </div>
  );

  return (
    <>
      <style>{TREE_CSS}</style>

      {/* Toolbar: Fullscreen toggle */}
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          Fullscreen
        </button>
      </div>

      <div className="mb-2">{mapNote}</div>

      <div className="w-full bg-[#fbfbfc] border border-[#e5e7eb] rounded-xl overflow-auto max-h-[560px]">
        {!fullscreen && treeBody}
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col">
          <div className="h-14 shrink-0 border-b border-[#e5e7eb] flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2d6fa8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
              <span className="text-sm font-semibold text-[#111827]">Course Map</span>
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              aria-label="Close fullscreen"
              className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="px-4 pt-3">{mapNote}</div>
          <div className="flex-1 overflow-auto">{treeBody}</div>
        </div>
      )}
    </>
  );
}
