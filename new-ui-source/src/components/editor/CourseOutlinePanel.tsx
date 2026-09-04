"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { StructureIcon, STRUCTURE_ICON_COLOR_CLASS } from "@/components/course/StructureIcons";
import { ConfirmDialog } from "@/components/common";
import type { ContentPageData } from "@/pages/editor/pageEditorWorkspace";

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
  level: "topic" | "section" | "group" | "component";
  pageId: string;
  articleId?: string;
  blockId?: string;
};

type DeleteTarget = {
  level: "topic" | "section" | "group" | "component";
  name: string;
  pageId: string;
  articleId?: string;
  blockId?: string;
  componentId?: string;
};

function getTargetKey(target: AddMenuTarget) {
  return `${target.level}:${target.pageId}:${target.articleId ?? ""}:${target.blockId ?? ""}`;
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
          className={`min-w-0 flex-1 self-center leading-[1.35] break-words line-clamp-2 ${
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
    if (target.level === "topic") {
      onAddPage();
    } else if (target.level === "section" && target.articleId) {
      onAddArticle(target.pageId);
    } else if (target.level === "group" && target.articleId) {
      onAddBlock(target.pageId, target.articleId);
    } else if (target.level === "component" && target.articleId && target.blockId) {
      onAddComponent(target.pageId, target.articleId, target.blockId);
    }
    setActiveAddMenu(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.level === "topic") {
      onDeletePage(deleteTarget.pageId);
    } else if (deleteTarget.level === "section" && deleteTarget.articleId) {
      onDeleteArticle(deleteTarget.pageId, deleteTarget.articleId);
    } else if (deleteTarget.level === "group" && deleteTarget.articleId && deleteTarget.blockId) {
      onDeleteBlock(deleteTarget.pageId, deleteTarget.articleId, deleteTarget.blockId);
    } else if (deleteTarget.level === "component" && deleteTarget.articleId && deleteTarget.blockId && deleteTarget.componentId) {
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
    if (level === "topic") return "Topic";
    if (level === "section") return "Section";
    if (level === "group") return "Group";
    return "Component";
  }

  return (
    <div ref={panelRef} className="w-[280px] h-full bg-white border-r border-[#d8dee6] flex flex-col shrink-0 overflow-x-hidden">
      <div className="px-[14px] py-3 border-b border-[#d8dee6] flex items-center justify-between shrink-0">
        <span className="text-sm tracking-[0.08em] font-semibold text-[#3b4753] uppercase">Structure</span>
        <button type="button" onClick={onClose} className="w-8 h-8 rounded flex items-center justify-center text-[#6b7280] hover:bg-[#f5f7fa]" aria-label="Collapse structure" title="Collapse structure">
          <MaskIcon file="back-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {contentPages.map((page) => {
          const pageSelected = selectedPageId === page.id && !selectedSubPageId && !selectedArticleId && !selectedBlockId && !selectedComponentId;
          return (
            <div key={page.id} className="mb-2">
              <TreeRow
                label={page.title}
                paddingLeft={12}
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
                  if (onUseTemplate) {
                    onUseTemplate(target);
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
                      paddingLeft={28}
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
                        if (onUseTemplate) {
                          onUseTemplate(target);
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
                        paddingLeft={44}
                        onClick={() => {
                          const target: AddMenuTarget = { level: "group", pageId: page.id, articleId: article.id };
                          setActiveAddMenu((previous) => (previous && getTargetKey(previous) === getTargetKey(target) ? null : target));
                        }}
                        menuOpen={activeAddKey === getTargetKey({ level: "group", pageId: page.id, articleId: article.id })}
                        onAddStartFresh={() => runAddAction({ level: "group", pageId: page.id, articleId: article.id })}
                        onAddTemplate={() => {
                          const target: AddMenuTarget = { level: "group", pageId: page.id, articleId: article.id };
                          if (onUseTemplate) {
                            onUseTemplate(target);
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
                            paddingLeft={44}
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
                              if (onUseTemplate) {
                                onUseTemplate(target);
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
                              paddingLeft={60}
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
                              paddingLeft={60}
                              onClick={() => {
                                const target: AddMenuTarget = { level: "component", pageId: page.id, articleId: article.id, blockId: block.id };
                                setActiveAddMenu((previous) => (previous && getTargetKey(previous) === getTargetKey(target) ? null : target));
                              }}
                              menuOpen={activeAddKey === getTargetKey({ level: "component", pageId: page.id, articleId: article.id, blockId: block.id })}
                              onAddStartFresh={() => runAddAction({ level: "component", pageId: page.id, articleId: article.id, blockId: block.id })}
                              onAddTemplate={() => {
                                const target: AddMenuTarget = { level: "component", pageId: page.id, articleId: article.id, blockId: block.id };
                                if (onUseTemplate) {
                                  onUseTemplate(target);
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
                  </div>
                );
              })}

              {isExpanded(expandedTopics, page.id) && page.articles.length === 0 && (
                <InlineAddRow
                  label="Add Section"
                  paddingLeft={28}
                  onClick={() => onAddArticle(page.id)}
                />
              )}

              {isExpanded(expandedTopics, page.id) && page.subPages.map((subPage) => (
                <TreeRow
                  key={subPage.id}
                  label={subPage.title}
                  paddingLeft={28}
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
