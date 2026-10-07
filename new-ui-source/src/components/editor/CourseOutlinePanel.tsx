"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { computeDrop, type Dragged, type RowRef } from "../course/CourseStructureTree";
import { flattenStructure, moveCourseStructure } from "../../hooks/useCourseStructure";
import { StructureIcon, STRUCTURE_ICON_COLOR_CLASS } from "@/components/course/StructureIcons";
import { ConfirmDialog } from "@/components/common";
import type { ContentPageData } from "@/pages/editor/pageEditorWorkspace";
import type { CourseStructure, SModule, StructureLevel } from "@/types/structure";
import { mergedChildren } from "@/types/structure";

const ICON_BASE = "/new/assets/icons";
const INLINE_ADD_BUTTON_CLASS = "h-8 shrink-0 inline-flex items-center justify-center gap-1.5 px-2 rounded-[6px] text-[#2E7FA1] text-xs font-medium hover:bg-[#f0f8ff] transition-colors";

function MaskIcon({ file, className }: { file: string; className?: string }) {
  const iconPath = `${ICON_BASE}/${file}`;
  return (
    <span
      aria-hidden="true"
      className={className ?? "block w-[14px] h-[14px] shrink-0 bg-current"}
      style={{
        WebkitMaskImage: `url(${iconPath})`,
        maskImage: `url(${iconPath})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

interface CourseOutlinePanelProps {
  courseId: string;
  panelWidth: number;
  panelActionsAlignToTitles: boolean;
  onMove?: (level: StructureLevel, id: string, parentId: string, beforeId: string | null) => void;
  onClose: () => void;
  menuPageCreated: boolean;
  menuSelected: boolean;
  onMenuSelect: () => void;
  courseStructure?: CourseStructure | null;
  contentPages: ContentPageData[];
  selectedPageId: string | null;
  selectedSubPageId?: string | null;
  selectedArticleId?: string | null;
  selectedBlockId?: string | null;
  selectedComponentId?: string | null;
  onPageSelect: (pageId: string) => void;
  onSubPageSelect: (pageId: string, subPageId: string) => void;
  onArticleSelect: (pageId: string, articleId: string) => void;
  onBlockSelect: (pageId: string, articleId: string, blockId: string) => void;
  onComponentSelect: (pageId: string, articleId: string, blockId: string, componentId: string) => void;
  onAddModule?: () => void;
  onAddSubModule?: (parentModuleId: string) => void;
  onDeleteModule?: (moduleId: string) => void;
  onAddPage: (moduleId?: string) => void;
  onDeletePage: (pageId: string) => void;
  onAddArticle: (pageId: string) => void;
  onDeleteArticle: (pageId: string, articleId: string) => void;
  onAddSubPage: (pageId: string) => void;
  onAddBlock: (pageId: string, articleId: string) => void;
  onDeleteBlock: (pageId: string, articleId: string, blockId: string) => void;
  onAddComponent: (pageId: string, articleId: string, blockId: string, componentId?: string) => void;
  onDeleteComponent: (pageId: string, articleId: string, blockId: string, componentId: string) => void;
  onUseTemplate?: (target: {
    level: "topic" | "section" | "group" | "component";
    pageId: string;
    articleId?: string;
    blockId?: string;
    moduleId?: string;
    componentId?: string;
  }) => void;
}

type AddMenuTarget = {
  level: "module" | "topic" | "section" | "group" | "component";
  pageId?: string;
  moduleId?: string;
  articleId?: string;
  blockId?: string;
  componentId?: string;
};

type DeleteTarget = {
  level: "module" | "topic" | "section" | "group" | "component";
  name: string;
  pageId?: string;
  moduleId?: string;
  articleId?: string;
  blockId?: string;
  componentId?: string;
};

function getTargetKey(target: AddMenuTarget) {
  return `${target.level}:${target.moduleId ?? ""}:${target.pageId ?? ""}:${target.articleId ?? ""}:${target.blockId ?? ""}:${target.componentId ?? ""}`;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type OutlineDragBindings = HTMLAttributes<HTMLDivElement> & { "data-outline-id": string; "data-outline-drop"?: string };

function TreeRow({
  dragBindings,
  label,
  paddingLeft,
  selected,
  onClick,
  icon,
  canExpand,
  expanded,
  onToggleExpand,
  showAdd = false,
  onAdd,
  showDelete = false,
  onDelete,
  onAddTemplate,
  addLabel = "section",
  toggleLabel = "section",
  labelClassName,
}: {
  dragBindings?: OutlineDragBindings;
  label: string;
  paddingLeft: number;
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  canExpand?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  showAdd?: boolean;
  onAdd?: () => void;
  showDelete?: boolean;
  onDelete?: () => void;
  onAddTemplate?: () => void;
  addLabel?: string;
  toggleLabel?: string;
  labelClassName?: string;
}) {
  return (
    <div
      {...dragBindings}
      data-outline-selected={selected ? "true" : undefined}
      className={`w-full min-h-9 flex items-center gap-[6px] text-left border-l-[3px] transition-colors group relative [&[data-outline-drop=before]]:shadow-[inset_0_2px_0_#2d6fa8] [&[data-outline-drop=into]]:ring-2 [&[data-outline-drop=into]]:ring-[#2d6fa8] ${
        selected
          ? "bg-[var(--life-primary-100)] border-[var(--life-primary-500)]"
          : "border-transparent hover:bg-[var(--life-neutral-100)]"
      }`}
      style={{ paddingLeft, paddingRight: 6, paddingTop: 6, paddingBottom: 6 }}
    >
      {dragBindings && (
        <button type="button" data-outline-grip title={`Drag ${label}`} aria-label={`Drag ${label}`} className="shrink-0 cursor-grab active:cursor-grabbing text-[#9ca3af] opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={event => event.stopPropagation()}>
          <GripVertical size={12} />
        </button>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        className="flex items-center gap-[6px] min-w-0 flex-1 cursor-pointer"
      >
        {canExpand ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand?.();
            }}
            className="w-[14px] h-[14px] shrink-0 self-center flex items-center justify-center text-[#9aa7b2] hover:text-[#1f2937]"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${toggleLabel}`}
            title={`${expanded ? "Collapse" : "Expand"} ${toggleLabel}`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={expanded ? "rotate-90" : ""}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ) : null}

        <span className="w-[18px] shrink-0 self-center flex items-center justify-center">{icon}</span>
        <span
          title={label || "Untitled"}
          className={`min-w-0 flex-1 self-center leading-[1.35] truncate ${
            labelClassName ?? "text-[13px] font-medium"
          } ${
            selected
              ? "text-[var(--life-primary-500)]"
              : "text-[#5b6674] group-hover:text-[#374151]"
          }`}
        >
          {label || "Untitled"}
        </span>
      </div>

      <div className="ml-auto shrink-0 self-center flex items-center gap-1">
        {showAdd && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAdd?.();
            }}
            className="w-6 h-6 rounded-[4px] flex items-center justify-center text-[#2E7FA1] hover:bg-[#e8f3f8] active:bg-[#d4e9f2]"
            aria-label={`Add ${titleCase(addLabel)}`}
            title={`Add ${titleCase(addLabel)}`}
          >
            <MaskIcon file="add-icon.svg" className="block w-[12px] h-[12px] shrink-0 bg-current" />
          </button>
        )}

        {showAdd && onAddTemplate && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddTemplate();
            }}
            className="w-6 h-6 rounded-[4px] flex items-center justify-center text-[var(--life-accent1-500)] hover:bg-[var(--life-accent1-050)] active:bg-[var(--life-accent1-100)]"
            aria-label={`Use ${titleCase(addLabel)} Template`}
            title={`Use ${titleCase(addLabel)} Template`}
          >
            <MaskIcon file="use-template-icon.svg" className="block w-[12px] h-[12px] shrink-0 bg-current" />
          </button>
        )}

        {showDelete && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.();
            }}
            className="w-6 h-6 rounded-[4px] flex items-center justify-center text-[#9aa7b2] hover:text-[#DC3449] hover:bg-[#FDDEE2] transition-colors"
            aria-label="Delete"
          >
            <MaskIcon file="delete-icon.svg" className="block w-[12px] h-[12px] shrink-0 bg-current" />
          </button>
        )}
      </div>

    </div>
  );
}

function InlineAddRow({
  label,
  paddingLeft,
  onClick,
  onAddStartFresh,
  onAddTemplate,
  addLabel = "item",
  panelExpanded = false,
  titleIndent = 0,
  componentActions = false,
}: {
  label: string;
  paddingLeft: number;
  onClick?: () => void;
  onAddStartFresh?: () => void;
  onAddTemplate?: () => void;
  addLabel?: string;
  panelExpanded?: boolean;
  titleIndent?: number;
  componentActions?: boolean;
}) {
  if (componentActions) {
    return (
      <div
        className="w-full h-9 flex items-center justify-start gap-1"
        style={{ paddingLeft: paddingLeft + titleIndent, paddingRight: 6 }}
      >
        <span className="mr-1 text-[13px] font-medium text-[#2E7FA1]">{label}</span>
        <button
          type="button"
          onClick={onAddStartFresh}
          className="w-6 h-6 shrink-0 rounded-[4px] flex items-center justify-center text-[#2E7FA1] hover:bg-[#e8f3f8] active:bg-[#d4e9f2]"
          aria-label="Add Component"
          title="Add Component"
        >
          <StructureIcon level="component" size={14} className={STRUCTURE_ICON_COLOR_CLASS.component} />
        </button>
        <button
          type="button"
          onClick={onAddTemplate}
          disabled={!onAddTemplate}
          className="w-6 h-6 shrink-0 rounded-[4px] flex items-center justify-center text-[var(--life-accent1-500)] hover:bg-[var(--life-accent1-050)] active:bg-[var(--life-accent1-100)] disabled:opacity-40"
          aria-label="Use Component Template"
          title="Use Component Template"
        >
          <MaskIcon file="use-template-icon.svg" className="block w-[12px] h-[12px] shrink-0 bg-current" />
        </button>
      </div>
    );
  }

  if (!onAddStartFresh) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full h-9 flex items-center text-[#2E7FA1] hover:bg-[#f0f8ff] transition-colors"
        style={{ paddingLeft, paddingRight: 6 }}
      >
        <span className="w-[14px] h-[14px] mr-[6px]" aria-hidden="true" />
        <span className="w-[18px] mr-[6px] shrink-0 flex items-center justify-center">
          <MaskIcon file="add-icon.svg" className="block w-[12px] h-[12px] shrink-0 bg-current" />
        </span>
        <span className="text-[13px] font-medium">{label}</span>
      </button>
    );
  }

  return (
    <div
      className={`w-full h-9 flex items-center gap-1 ${panelExpanded ? "justify-start" : "justify-center"}`}
      style={{ paddingLeft: paddingLeft + (panelExpanded ? titleIndent : 0), paddingRight: 6 }}
    >
      <button
        type="button"
        onClick={onAddStartFresh}
        className={`${INLINE_ADD_BUTTON_CLASS} ${onAddTemplate ? "" : "w-full"}`}
        aria-label={`Add ${titleCase(addLabel)}`}
        title={`Add ${titleCase(addLabel)}`}
      >
        <span className="w-[14px] shrink-0 flex items-center justify-center">
          <MaskIcon file="add-icon.svg" className="block w-[12px] h-[12px] shrink-0 bg-current" />
        </span>
        <span className="truncate">{label}</span>
      </button>

      {onAddTemplate && (
        <button
          type="button"
          onClick={onAddTemplate}
          className={INLINE_ADD_BUTTON_CLASS}
          aria-label={`Use ${titleCase(addLabel)} Template`}
          title={`Use ${titleCase(addLabel)} Template`}
        >
          <MaskIcon file="use-template-icon.svg" className="block w-[12px] h-[12px] shrink-0 bg-current" />
          <span>Template</span>
        </button>
      )}
    </div>
  );
}

export default function CourseOutlinePanel({
  courseId,
  panelWidth,
  panelActionsAlignToTitles,
  onMove,
  onClose,
  courseStructure,
  contentPages,
  selectedPageId,
  selectedSubPageId,
  selectedArticleId,
  selectedBlockId,
  selectedComponentId,
  onPageSelect,
  onSubPageSelect,
  onArticleSelect,
  onBlockSelect,
  onComponentSelect,
  onAddModule,
  onAddSubModule,
  onDeleteModule,
  onAddPage,
  onDeletePage,
  onAddArticle,
  onDeleteArticle,
  onAddBlock,
  onDeleteBlock,
  onAddComponent,
  onDeleteComponent,
  onUseTemplate,
}: CourseOutlinePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [, setActiveAddMenu] = useState<AddMenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const draggedRef = useRef<Dragged | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; mode: "before" | "after" | "into" } | null>(null);
  const positions = courseStructure ? flattenStructure(courseStructure, courseId) : [];

  function getDropPlan(draggedRow: Dragged, targetRow: RowRef, position: "before" | "after") {
    if (!courseStructure) return null;
    const siblings = positions.filter((item) => item.parentId === targetRow.parentId);
    const targetIndex = siblings.findIndex((item) => item.id === targetRow.id);
    const row = {
      ...targetRow,
      nextSiblingId: targetIndex >= 0 ? siblings[targetIndex + 1]?.id ?? null : null,
    };
    const plan = computeDrop(draggedRow, row, position);
    if (!plan) return null;

    try {
      const moved = moveCourseStructure(courseStructure, courseId, draggedRow.level, draggedRow.id, plan.newParentId, plan.beforeId);
      if (JSON.stringify(flattenStructure(moved, courseId)) === JSON.stringify(positions)) return null;
      return plan;
    } catch {
      return null;
    }
  }

  function dragBindings(row: RowRef): OutlineDragBindings | undefined {
    if (!onMove) return undefined;
    const clear = () => { draggedRef.current = null; setDropTarget(null); };
    return {
      "data-outline-id": row.id,
      "data-outline-drop": dropTarget?.id === row.id ? dropTarget.mode : undefined,
      draggable: true,
      onDragStart: event => {
        const target = event.target as HTMLElement;
        if (target.closest('button') && !target.closest('[data-outline-grip]')) { event.preventDefault(); return; }
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.id);
        setActiveAddMenu(null);
        draggedRef.current = { id: row.id, level: row.level };
      },
      onDragOver: event => {
        const dragged = draggedRef.current;
        if (!dragged) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        const plan = getDropPlan(dragged, row, position);
        if (!plan) { setDropTarget(null); return; }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setDropTarget((previous) => previous?.id === row.id && previous.mode === plan.mode ? previous : { id: row.id, mode: plan.mode });
      },
      onDrop: event => {
        const dragged = draggedRef.current;
        if (!dragged) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        const plan = getDropPlan(dragged, row, position);
        event.preventDefault();
        event.stopPropagation();
        if (plan) onMove(dragged.level, dragged.id, plan.newParentId, plan.beforeId);
        clear();
      },
      onDragEnd: clear,
    };
  }

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setActiveAddMenu(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // A newly added/copied node becomes the selection while the tree may have
  // grown past the viewport, leaving its marker off-screen. Deferred a frame so
  // the row exists before it is measured.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = treeScrollRef.current;
      const row = container?.querySelector<HTMLElement>('[data-outline-selected="true"]');
      if (!container || !row) return;

      const containerRect = container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const margin = 8;
      // Already fully visible — never fight a scroll position the user chose.
      if (rowRect.top >= containerRect.top + margin && rowRect.bottom <= containerRect.bottom - margin) return;

      row.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    selectedPageId,
    selectedSubPageId,
    selectedArticleId,
    selectedBlockId,
    selectedComponentId,
    contentPages,
    courseStructure,
  ]);

  function isExpanded(state: Record<string, boolean>, id: string) {
    return state[id] ?? true;
  }

  function runAddAction(target: AddMenuTarget) {
    if (target.level === "topic" && target.pageId) {
      onAddPage(target.moduleId);
    } else if (target.level === "section" && target.pageId && target.articleId) {
      onAddArticle(target.pageId);
    } else if (target.level === "group" && target.pageId && target.articleId) {
      onAddBlock(target.pageId, target.articleId);
    } else if (target.level === "component" && target.pageId && target.articleId && target.blockId) {
      onAddComponent(target.pageId, target.articleId, target.blockId);
    }
    setActiveAddMenu(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.level === "module" && deleteTarget.moduleId) {
      onDeleteModule?.(deleteTarget.moduleId);
    } else if (deleteTarget.level === "topic" && deleteTarget.pageId) {
      onDeletePage(deleteTarget.pageId);
    } else if (deleteTarget.level === "section" && deleteTarget.pageId && deleteTarget.articleId) {
      onDeleteArticle(deleteTarget.pageId, deleteTarget.articleId);
    } else if (deleteTarget.level === "group" && deleteTarget.pageId && deleteTarget.articleId && deleteTarget.blockId) {
      onDeleteBlock(deleteTarget.pageId, deleteTarget.articleId, deleteTarget.blockId);
    } else if (deleteTarget.level === "component" && deleteTarget.pageId && deleteTarget.articleId && deleteTarget.blockId && deleteTarget.componentId) {
      onDeleteComponent(
        deleteTarget.pageId,
        deleteTarget.articleId,
        deleteTarget.blockId,
        deleteTarget.componentId
      );
    }

    setDeleteTarget(null);
  }

  function deleteLabel(level: DeleteTarget["level"]) {
    if (level === "module") return "Module";
    if (level === "topic") return "Topic";
    if (level === "section") return "Section";
    if (level === "group") return "Content Group";
    return "Component";
  }

  function deleteMessage(level: DeleteTarget["level"]): ReactNode {
    if (level === "module") return <>Are you sure you want to delete this module?<br />You will lose all the contents of this module.</>;
    if (level === "component") return <>Are you sure you want to delete the component.<br />This action cannot be undone.</>;
    if (level === "section") return <>Are you sure you want to delete this section?<br />This will remove any content groups and components inside this section.</>;
    if (level === "group") return <>Are you sure you want to delete this content group?<br />This will remove any components inside this section.</>;
    return <>Are you sure you want to delete this topic?<br />You will lose all the contents of this topic</>;
  }

  const allKnownPageIds = useMemo(() => {
    const ids = new Set<string>();
    if (!courseStructure) return ids;
    courseStructure.topics.forEach((t) => ids.add(t.id));
    const walkModule = (m: SModule) => {
      m.topics.forEach((t) => ids.add(t.id));
      m.modules.forEach(walkModule);
    };
    courseStructure.modules.forEach(walkModule);
    return ids;
  }, [courseStructure]);

  function renderTopicNode(page: ContentPageData, paddingLeft = 12, depth = 0, moduleId?: string) {
    const topicPadding = paddingLeft + depth * 12;
    const sectionPadding = topicPadding + 16;
    const groupPadding = sectionPadding + 16;
    const componentPadding = groupPadding + 16;

    const pageSelected = selectedPageId === page.id && !selectedSubPageId && !selectedArticleId && !selectedBlockId && !selectedComponentId;
    return (
      <div key={page.id} className="mb-2">
        <TreeRow
          label={page.title}
          dragBindings={dragBindings({ id: page.id, level: 'topic', parentId: moduleId || courseId, parentLevel: moduleId ? 'module' : 'course' })}
          paddingLeft={topicPadding}
          selected={pageSelected}
          labelClassName="text-[13px] font-bold"
          onClick={() => {
            setActiveAddMenu(null);
            onPageSelect(page.id);
          }}
          icon={<StructureIcon level="topic" size={14} className={STRUCTURE_ICON_COLOR_CLASS.topic} />}
          canExpand={true}
          expanded={isExpanded(expandedTopics, page.id)}
          onToggleExpand={() => setExpandedTopics((previous) => ({ ...previous, [page.id]: !isExpanded(previous, page.id) }))}
          showAdd={true}
          onAdd={() => runAddAction({ level: "topic", pageId: page.id, moduleId })}
          showDelete={true}
          onDelete={() => {
            setActiveAddMenu(null);
            setDeleteTarget({
              level: "topic",
              name: page.title || "Untitled",
              pageId: page.id,
            });
          }}
          onAddTemplate={onUseTemplate ? () => {
            onUseTemplate({ level: "topic", pageId: page.id, moduleId });
            setActiveAddMenu(null);
          } : undefined}
          addLabel="topic"
          toggleLabel="topic"
        />

        {isExpanded(expandedTopics, page.id) && page.articles.map((article) => {
          const articleSelected = selectedArticleId === article.id && !selectedBlockId && !selectedComponentId;
          return (
            <div key={article.id}>
              <TreeRow
                label={article.title}
                dragBindings={dragBindings({ id: article.id, level: 'section', parentId: page.id, parentLevel: 'topic' })}
                paddingLeft={sectionPadding}
                selected={articleSelected}
                labelClassName="text-[13px] font-medium"
                onClick={() => {
                  setActiveAddMenu(null);
                  onArticleSelect(page.id, article.id);
                }}
                icon={<StructureIcon level="section" size={14} className={STRUCTURE_ICON_COLOR_CLASS.section} />}
                canExpand={true}
                expanded={isExpanded(expandedSections, article.id)}
                onToggleExpand={() => setExpandedSections((previous) => ({ ...previous, [article.id]: !isExpanded(previous, article.id) }))}
                showAdd={true}
                onAdd={() => runAddAction({ level: "section", pageId: page.id, articleId: article.id })}
                showDelete={true}
                onDelete={() => {
                  setActiveAddMenu(null);
                  setDeleteTarget({
                    level: "section",
                    name: article.title || "Untitled",
                    pageId: page.id,
                    articleId: article.id,
                  });
                }}
                onAddTemplate={onUseTemplate ? () => {
                  onUseTemplate({ level: "section", pageId: page.id, articleId: article.id });
                  setActiveAddMenu(null);
                } : undefined}
                addLabel="section"
                toggleLabel="section"
              />

              {isExpanded(expandedSections, article.id) && article.blocks.length === 0 && (
                <InlineAddRow
                  label="Add Group"
                  paddingLeft={groupPadding}
                  panelExpanded={panelActionsAlignToTitles}
                  titleIndent={65}
                  onAddStartFresh={() => runAddAction({ level: "group", pageId: page.id, articleId: article.id })}
                  onAddTemplate={onUseTemplate ? () => {
                    onUseTemplate({ level: "group", pageId: page.id, articleId: article.id });
                    setActiveAddMenu(null);
                  } : undefined}
                  addLabel="group"
                />
              )}

              {isExpanded(expandedSections, article.id) && article.blocks.map((block) => {
                const blockSelected = selectedBlockId === block.id && !selectedComponentId;
                const canAddComponent = block.components.length < 2;
                return (
                  <div key={block.id}>
                    <TreeRow
                      label={block.title}
                      dragBindings={dragBindings({ id: block.id, level: 'contentGroup', parentId: article.id, parentLevel: 'section' })}
                      paddingLeft={groupPadding}
                      selected={blockSelected}
                      labelClassName="text-[13px] font-normal"
                      onClick={() => {
                        setActiveAddMenu(null);
                        onBlockSelect(page.id, article.id, block.id);
                      }}
                      icon={<StructureIcon level="contentGroup" size={14} className={STRUCTURE_ICON_COLOR_CLASS.contentGroup} />}
                      canExpand={true}
                      expanded={isExpanded(expandedGroups, block.id)}
                      onToggleExpand={() => setExpandedGroups((previous) => ({ ...previous, [block.id]: !isExpanded(previous, block.id) }))}
                      showAdd={true}
                      onAdd={() => runAddAction({ level: "group", pageId: page.id, articleId: article.id, blockId: block.id })}
                      showDelete={true}
                      onDelete={() => {
                        setActiveAddMenu(null);
                        setDeleteTarget({
                          level: "group",
                          name: block.title || "Untitled",
                          pageId: page.id,
                          articleId: article.id,
                          blockId: block.id,
                        });
                      }}
                      onAddTemplate={onUseTemplate ? () => {
                        onUseTemplate({ level: "group", pageId: page.id, articleId: article.id, blockId: block.id });
                        setActiveAddMenu(null);
                      } : undefined}
                      addLabel="content group"
                      toggleLabel="content group"
                    />

                    {isExpanded(expandedGroups, block.id) && block.components.map((component) => (
                      <TreeRow
                        key={component.id}
                        dragBindings={dragBindings({ id: component.id, level: 'component', parentId: block.id, parentLevel: 'contentGroup' })}
                        label={component.settings.title || component.type}
                        paddingLeft={componentPadding}
                        selected={selectedComponentId === component.id}
                        onClick={() => {
                          setActiveAddMenu(null);
                          onComponentSelect(page.id, article.id, block.id, component.id);
                        }}
                        icon={<StructureIcon level="component" size={14} className={STRUCTURE_ICON_COLOR_CLASS.component} />}
                        showDelete={true}
                        onDelete={() => {
                          setActiveAddMenu(null);
                          setDeleteTarget({
                            level: "component",
                            name: component.settings.title || component.type || "Untitled",
                            pageId: page.id,
                            articleId: article.id,
                            blockId: block.id,
                            componentId: component.id,
                          });
                        }}
                      />
                    ))}

                    {isExpanded(expandedGroups, block.id) && canAddComponent && (
                      <InlineAddRow
                        label="Add"
                        paddingLeft={componentPadding}
                        panelExpanded
                        titleIndent={45}
                        componentActions
                        onAddStartFresh={() => runAddAction({ level: "component", pageId: page.id, articleId: article.id, blockId: block.id })}
                        onAddTemplate={onUseTemplate ? () => {
                          onUseTemplate({ level: "component", pageId: page.id, articleId: article.id, blockId: block.id });
                          setActiveAddMenu(null);
                        } : undefined}
                        addLabel="component"
                      />
                    )}
                  </div>
                );
              })}

              {isExpanded(expandedTopics, page.id) && page.articles.length === 0 && (
                <InlineAddRow
                  label="Add Section"
                  paddingLeft={sectionPadding}
                  panelExpanded={panelActionsAlignToTitles}
                  titleIndent={65}
                  onAddStartFresh={() => onAddArticle(page.id)}
                  onAddTemplate={onUseTemplate ? () => {
                    onUseTemplate({ level: "section", pageId: page.id });
                    setActiveAddMenu(null);
                  } : undefined}
                  addLabel="section"
                />
              )}

              {isExpanded(expandedTopics, page.id) && page.subPages.map((subPage) => (
                <TreeRow
                  key={subPage.id}
                  label={subPage.title}
                  paddingLeft={sectionPadding}
                  selected={selectedSubPageId === subPage.id}
                  onClick={() => {
                    setActiveAddMenu(null);
                    onSubPageSelect(page.id, subPage.id);
                  }}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  function renderModuleNode(mod: SModule, paddingLeft = 12, depth = 0) {
    const children = mergedChildren(mod.modules, mod.topics);
    const modulePadding = paddingLeft + depth * 12;
    const childPaddingLeft = modulePadding + 12;

    return (
      <div key={mod.id} className="mb-2">
        <TreeRow
          label={mod.title}
          dragBindings={dragBindings({ id: mod.id, level: 'module', parentId: positions.find(position => position.id === mod.id)?.parentId || courseId, parentLevel: positions.find(position => position.id === mod.id)?.parentId === courseId ? 'course' : 'module' })}
          paddingLeft={modulePadding}
          selected={false}
          labelClassName="text-[13px] font-bold text-[#1d4c60]"
          onClick={() => {
            setActiveAddMenu(null);
            setExpandedModules((previous) => ({ ...previous, [mod.id]: !isExpanded(previous, mod.id) }));
          }}
          icon={<StructureIcon level="module" size={14} className={STRUCTURE_ICON_COLOR_CLASS.module} />}
          canExpand={true}
          expanded={isExpanded(expandedModules, mod.id)}
          onToggleExpand={() => setExpandedModules((previous) => ({ ...previous, [mod.id]: !isExpanded(previous, mod.id) }))}
          showAdd={true}
          onAdd={() => {
            onAddSubModule?.(mod.id);
          }}
          showDelete={true}
          onDelete={() => {
            setActiveAddMenu(null);
            setDeleteTarget({
              level: "module",
              name: mod.title || "Untitled Module",
              moduleId: mod.id,
            });
          }}
          addLabel="submodule"
          toggleLabel="module"
        />

        {isExpanded(expandedModules, mod.id) && (
          <div>
            {children.map((child) => {
              if (child.kind === "module") {
                return renderModuleNode(child.node, 12, depth + 1);
              }
              const page = contentPages.find((p) => p.id === child.node.id);
              if (page) {
                return renderTopicNode(page, childPaddingLeft, 0, mod.id);
              }
              return null;
            })}
            {children.length === 0 && (
              <InlineAddRow
                label="Add Sub-Module"
                paddingLeft={childPaddingLeft}
                onClick={() => onAddSubModule?.(mod.id)}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      style={{ "--outline-panel-width": `${panelWidth}px` } as CSSProperties}
      className="w-[280px] md:w-[var(--outline-panel-width)] h-full bg-white border-r border-[#d8dee6] flex flex-col shrink-0 overflow-x-hidden"
    >
      <div className="px-[14px] py-3 border-b border-[#d8dee6] flex items-center justify-between shrink-0">
        <span className="text-sm tracking-[0.08em] font-semibold text-[#3b4753] uppercase">Structure</span>
        <div className="flex items-center gap-[6px]">
          {onAddModule && (
            <button
              type="button"
              onClick={() => onAddModule()}
              className="w-[26px] h-[26px] rounded-[6px] border border-[#d8dee6] flex items-center justify-center text-[var(--life-accent1-400)] hover:bg-[var(--life-accent1-050)] hover:border-[var(--life-accent1-300)] transition-colors"
              aria-label="Add Module"
              title="Add Module"
            >
              <StructureIcon level="module" size={14} className="text-[var(--life-accent1-400)]" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-[#6b7280] hover:bg-[#f5f7fa]"
            aria-label="Collapse structure"
            title="Collapse structure"
          >
            <MaskIcon file="panel-toggle-icon.svg" className="block w-[16px] h-[16px] shrink-0 bg-current" />
          </button>
        </div>
      </div>

      <div ref={treeScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {courseStructure ? (
          <>
            {mergedChildren(courseStructure.modules, courseStructure.topics).map((child) => {
              if (child.kind === "module") {
                return renderModuleNode(child.node, 12);
              }
              const page = contentPages.find((p) => p.id === child.node.id);
              if (page) {
                return renderTopicNode(page, 12);
              }
              return null;
            })}
            {contentPages
              .filter((page) => !allKnownPageIds.has(page.id))
              .map((page) => renderTopicNode(page, 12))}
          </>
        ) : (
          contentPages.map((page) => renderTopicNode(page, 12))
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          open
          title={`Delete ${deleteLabel(deleteTarget.level)}`}
          message={deleteMessage(deleteTarget.level)}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
