"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { StructureIcon, STRUCTURE_ICON_COLOR_CLASS } from "@/components/course/StructureIcons";
import { ConfirmDialog } from "@/components/common";
import type { ContentPageData } from "@/pages/editor/pageEditorWorkspace";
import type { CourseStructure, SModule } from "@/types/structure";
import { mergedChildren } from "@/types/structure";

const ICON_BASE = "/new/assets/icons";

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
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
  onAddArticle: (pageId: string) => void;
  onDeleteArticle: (pageId: string, articleId: string) => void;
  onAddSubPage: (pageId: string) => void;
  onAddBlock: (pageId: string, articleId: string) => void;
  onDeleteBlock: (pageId: string, articleId: string, blockId: string) => void;
  onAddComponent: (pageId: string, articleId: string, blockId: string) => void;
  onDeleteComponent: (pageId: string, articleId: string, blockId: string, componentId: string) => void;
  onUseTemplate?: (target: {
    level: "topic" | "section" | "group" | "component";
    pageId: string;
    articleId?: string;
    blockId?: string;
  }) => void;
}

type AddMenuTarget = {
  level: "module" | "topic" | "section" | "group" | "component";
  pageId?: string;
  moduleId?: string;
  articleId?: string;
  blockId?: string;
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
  return `${target.level}:${target.moduleId ?? ""}:${target.pageId ?? ""}:${target.articleId ?? ""}:${target.blockId ?? ""}`;
}

function TreeRow({
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
  menuOpen = false,
  onAddStartFresh,
  onAddTemplate,
  addLabel = "section",
  toggleLabel = "section",
  labelClassName,
}: {
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
  menuOpen?: boolean;
  onAddStartFresh?: () => void;
  onAddTemplate?: () => void;
  addLabel?: string;
  toggleLabel?: string;
  labelClassName?: string;
}) {
  return (
    <div
      className={`w-full min-h-9 flex items-center gap-[6px] text-left border-l-[3px] transition-colors group relative ${
        selected
          ? "bg-[var(--life-primary-100)] border-[var(--life-primary-500)]"
          : "border-transparent hover:bg-[var(--life-neutral-100)]"
      }`}
      style={{ paddingLeft, paddingRight: 6, paddingTop: 6, paddingBottom: 6 }}
    >
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
        <span className="w-[14px] h-[14px] shrink-0 self-center flex items-center justify-center text-[#b8c4cf] group-hover:text-[#6b7280] cursor-grab hover:text-[#4b5563]">
          <MaskIcon file="drag-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
        </span>

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
            aria-label={`Add ${addLabel}`}
            title={`Add ${addLabel}`}
          >
            <MaskIcon file="add-icon.svg" className="block w-[12px] h-[12px] shrink-0 bg-current" />
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

      {menuOpen && (
        <div className="absolute left-8 top-[36px] z-30 min-w-[210px] rounded-[var(--radius-md)] border border-[var(--life-neutral-100)] bg-[var(--life-base-white)] p-[6px] shadow-[0_4px_20px_rgba(0,0,0,0.12)] flex flex-col gap-[2px]">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddStartFresh?.();
            }}
            className="w-full flex items-center gap-[10px] rounded-[var(--radius-sm)] px-[10px] py-[8px] text-left hover:bg-[var(--life-primary-020)] transition-colors"
          >
            <span className="w-[30px] h-[30px] rounded-[var(--radius-sm)] bg-[var(--life-primary-050)] flex items-center justify-center text-[var(--life-primary-600)] shrink-0">
              <MaskIcon file="add-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
            </span>
            <span className="text-left">
              <span className="block text-[12px] leading-[1.2] font-semibold text-[var(--life-base-black)]">Start fresh</span>
              <span className="block text-[11px] leading-[1.2] text-[var(--life-neutral-500)]">Blank {addLabel}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddTemplate?.();
            }}
            className="w-full flex items-center gap-[10px] rounded-[var(--radius-sm)] px-[10px] py-[8px] text-left hover:bg-[var(--life-primary-020)] transition-colors"
          >
            <span className="w-[30px] h-[30px] rounded-[var(--radius-sm)] bg-[var(--life-accent1-050)] flex items-center justify-center text-[var(--life-accent1-600)] shrink-0">
              <MaskIcon file="use-template-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
            </span>
            <span className="text-left">
              <span className="block text-[12px] leading-[1.2] font-semibold text-[var(--life-base-black)]">Use template</span>
              <span className="block text-[11px] leading-[1.2] text-[var(--life-neutral-500)]">Pick a pre-built structure</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function InlineAddRow({
  label,
  paddingLeft,
  onClick,
  menuOpen = false,
  onAddStartFresh,
  onAddTemplate,
  addLabel = "item",
}: {
  label: string;
  paddingLeft: number;
  onClick: () => void;
  menuOpen?: boolean;
  onAddStartFresh?: () => void;
  onAddTemplate?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="relative">
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

      {menuOpen && (
        <div className="absolute left-8 top-[36px] z-30 min-w-[210px] rounded-[var(--radius-md)] border border-[var(--life-neutral-100)] bg-[var(--life-base-white)] p-[6px] shadow-[0_4px_20px_rgba(0,0,0,0.12)] flex flex-col gap-[2px]">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddStartFresh?.();
            }}
            className="w-full flex items-center gap-[10px] rounded-[var(--radius-sm)] px-[10px] py-[8px] text-left hover:bg-[var(--life-primary-020)] transition-colors"
          >
            <span className="w-[30px] h-[30px] rounded-[var(--radius-sm)] bg-[var(--life-primary-050)] flex items-center justify-center text-[var(--life-primary-600)] shrink-0">
              <MaskIcon file="add-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
            </span>
            <span className="text-left">
              <span className="block text-[12px] leading-[1.2] font-semibold text-[var(--life-base-black)]">Start fresh</span>
              <span className="block text-[11px] leading-[1.2] text-[var(--life-neutral-500)]">Blank {addLabel}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddTemplate?.();
            }}
            className="w-full flex items-center gap-[10px] rounded-[var(--radius-sm)] px-[10px] py-[8px] text-left hover:bg-[var(--life-primary-020)] transition-colors"
          >
            <span className="w-[30px] h-[30px] rounded-[var(--radius-sm)] bg-[var(--life-accent1-050)] flex items-center justify-center text-[var(--life-accent1-600)] shrink-0">
              <MaskIcon file="use-template-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
            </span>
            <span className="text-left">
              <span className="block text-[12px] leading-[1.2] font-semibold text-[var(--life-base-black)]">Use template</span>
              <span className="block text-[11px] leading-[1.2] text-[var(--life-neutral-500)]">Pick a pre-built structure</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function CourseOutlinePanel({
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
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [activeAddMenu, setActiveAddMenu] = useState<AddMenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setActiveAddMenu(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const activeAddKey = useMemo(() => {
    if (!activeAddMenu) return null;
    return getTargetKey(activeAddMenu);
  }, [activeAddMenu]);

  function isExpanded(state: Record<string, boolean>, id: string) {
    return state[id] ?? true;
  }

  function runAddAction(target: AddMenuTarget) {
    if (target.level === "topic" && target.pageId) {
      onAddPage();
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
    if (level === "group") return "Group";
    return "Component";
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

  function renderTopicNode(page: ContentPageData, paddingLeft = 12, depth = 0) {
    const topicPadding = paddingLeft + depth * 12;
    const sectionPadding = topicPadding + 16;
    const groupPadding = sectionPadding + 16;
    const componentPadding = groupPadding + 16;

    const pageSelected = selectedPageId === page.id && !selectedSubPageId && !selectedArticleId && !selectedBlockId && !selectedComponentId;
    return (
      <div key={page.id} className="mb-2">
        <TreeRow
          label={page.title}
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
          onAdd={() => {
            const target: AddMenuTarget = { level: "topic", pageId: page.id };
            setActiveAddMenu((previous) => (previous && getTargetKey(previous) === getTargetKey(target) ? null : target));
          }}
          showDelete={true}
          onDelete={() => {
            setActiveAddMenu(null);
            setDeleteTarget({
              level: "topic",
              name: page.title || "Untitled",
              pageId: page.id,
            });
          }}
          menuOpen={activeAddKey === getTargetKey({ level: "topic", pageId: page.id })}
          onAddStartFresh={() => runAddAction({ level: "topic", pageId: page.id })}
          onAddTemplate={() => {
            const target: AddMenuTarget = { level: "topic", pageId: page.id };
            if (onUseTemplate && target.pageId) {
              onUseTemplate({ level: "topic", pageId: target.pageId });
              setActiveAddMenu(null);
              return;
            }
            runAddAction(target);
          }}
          addLabel="topic"
          toggleLabel="topic"
        />

        {isExpanded(expandedTopics, page.id) && page.articles.map((article) => {
          const articleSelected = selectedArticleId === article.id && !selectedBlockId && !selectedComponentId;
          return (
            <div key={article.id}>
              <TreeRow
                label={article.title}
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
                onAdd={() => {
                  const target: AddMenuTarget = { level: "section", pageId: page.id, articleId: article.id };
                  setActiveAddMenu((previous) => (previous && getTargetKey(previous) === getTargetKey(target) ? null : target));
                }}
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
                menuOpen={activeAddKey === getTargetKey({ level: "section", pageId: page.id, articleId: article.id })}
                onAddStartFresh={() => runAddAction({ level: "section", pageId: page.id, articleId: article.id })}
                onAddTemplate={() => {
                  const target: AddMenuTarget = { level: "section", pageId: page.id, articleId: article.id };
                  if (onUseTemplate && target.pageId) {
                    onUseTemplate({ level: "section", pageId: target.pageId, articleId: target.articleId });
                    setActiveAddMenu(null);
                    return;
                  }
                  runAddAction(target);
                }}
                addLabel="section"
                toggleLabel="section"
              />

              {isExpanded(expandedSections, article.id) && article.blocks.length === 0 && (
                <InlineAddRow
                  label="Add Group"
                  paddingLeft={groupPadding}
                  onClick={() => {
                    const target: AddMenuTarget = { level: "group", pageId: page.id, articleId: article.id };
                    setActiveAddMenu((previous) => (previous && getTargetKey(previous) === getTargetKey(target) ? null : target));
                  }}
                  menuOpen={activeAddKey === getTargetKey({ level: "group", pageId: page.id, articleId: article.id })}
                  onAddStartFresh={() => runAddAction({ level: "group", pageId: page.id, articleId: article.id })}
                  onAddTemplate={() => {
                    const target: AddMenuTarget = { level: "group", pageId: page.id, articleId: article.id };
                    if (onUseTemplate && target.pageId) {
                      onUseTemplate({ level: "group", pageId: target.pageId, articleId: target.articleId });
                      setActiveAddMenu(null);
                      return;
                    }
                    runAddAction(target);
                  }}
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
                      onAdd={() => {
                        const target: AddMenuTarget = { level: "group", pageId: page.id, articleId: article.id, blockId: block.id };
                        setActiveAddMenu((previous) => (previous && getTargetKey(previous) === getTargetKey(target) ? null : target));
                      }}
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
                      menuOpen={activeAddKey === getTargetKey({ level: "group", pageId: page.id, articleId: article.id, blockId: block.id })}
                      onAddStartFresh={() => runAddAction({ level: "group", pageId: page.id, articleId: article.id, blockId: block.id })}
                      onAddTemplate={() => {
                        const target: AddMenuTarget = { level: "group", pageId: page.id, articleId: article.id, blockId: block.id };
                        if (onUseTemplate && target.pageId) {
                          onUseTemplate({ level: "group", pageId: target.pageId, articleId: target.articleId, blockId: target.blockId });
                          setActiveAddMenu(null);
                          return;
                        }
                        runAddAction(target);
                      }}
                      addLabel="content group"
                      toggleLabel="content group"
                    />

                    {isExpanded(expandedGroups, block.id) && block.components.map((component) => (
                      <TreeRow
                        key={component.id}
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
                        label="Add Component"
                        paddingLeft={componentPadding}
                        onClick={() => {
                          const target: AddMenuTarget = { level: "component", pageId: page.id, articleId: article.id, blockId: block.id };
                          setActiveAddMenu((previous) => (previous && getTargetKey(previous) === getTargetKey(target) ? null : target));
                        }}
                        menuOpen={activeAddKey === getTargetKey({ level: "component", pageId: page.id, articleId: article.id, blockId: block.id })}
                        onAddStartFresh={() => runAddAction({ level: "component", pageId: page.id, articleId: article.id, blockId: block.id })}
                        onAddTemplate={() => {
                          const target: AddMenuTarget = { level: "component", pageId: page.id, articleId: article.id, blockId: block.id };
                          if (onUseTemplate && target.pageId) {
                            onUseTemplate({ level: "component", pageId: target.pageId, articleId: target.articleId, blockId: target.blockId });
                            setActiveAddMenu(null);
                            return;
                          }
                          runAddAction(target);
                        }}
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
                  onClick={() => onAddArticle(page.id)}
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
                return renderTopicNode(page, childPaddingLeft, 0);
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
    <div ref={panelRef} className="w-[280px] h-full bg-white border-r border-[#d8dee6] flex flex-col shrink-0 overflow-x-hidden">
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
            <MaskIcon file="back-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
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
          message={
            <>
              Are you sure you want to delete <span className="font-medium text-[#111827]">"{deleteTarget.name}"</span>? This action cannot be undone.
            </>
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
