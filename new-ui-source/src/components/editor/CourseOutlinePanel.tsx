"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { ContentPageData } from "@/components/course/CourseEditor";

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
  courseId: string;
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
}

type AddMenuTarget = {
  level: "topic" | "section" | "group";
  pageId: string;
  articleId?: string;
  blockId?: string;
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
}) {
  return (
    <div
      className={`w-full h-9 flex items-center gap-[6px] text-left border-l-[3px] transition-colors group relative ${
        selected
          ? "bg-[#d9eefb] border-[#2E7FA1] text-[#1f2937]"
          : "border-transparent text-[#1f2937] hover:bg-[#f7fafc]"
      }`}
      style={{ paddingLeft, paddingRight: 6 }}
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
        <span className="w-[14px] h-[14px] shrink-0 flex items-center justify-center text-[#b8c4cf] group-hover:text-[#6b7280] cursor-grab hover:text-[#4b5563]">
          <MaskIcon file="drag-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
        </span>

        {canExpand ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand?.();
            }}
            className="w-[14px] h-[14px] shrink-0 flex items-center justify-center text-[#9aa7b2] hover:text-[#1f2937]"
            aria-label={expanded ? "Collapse" : "Expand"}
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

        <span className="w-[18px] shrink-0 flex items-center justify-center text-[#8ca0b0]">{icon}</span>
        <span className={`text-[13px] ${selected ? "font-semibold" : "font-medium"} truncate`}>{label || "Untitled"}</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {showAdd && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAdd?.();
            }}
            className="w-6 h-6 rounded-[4px] flex items-center justify-center text-[#2E7FA1] hover:bg-[#e8f3f8] active:bg-[#d4e9f2]"
            aria-label={`Add ${addLabel}`}
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
        <div className="absolute left-8 top-[36px] z-30 w-[230px] rounded-xl border border-[#d8dee6] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.14)] p-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddStartFresh?.();
            }}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 hover:bg-[#f7fafc]"
          >
            <span className="w-9 h-9 rounded-lg bg-[#e8f3f8] flex items-center justify-center text-[#2E7FA1] shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
            <span className="text-left">
              <span className="block text-[17px] leading-[1.1] font-semibold text-[#1f2937]">Start fresh</span>
              <span className="block text-[12px] text-[#586473]">Blank {addLabel}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddTemplate?.();
            }}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 hover:bg-[#f7fafc]"
          >
            <span className="w-9 h-9 rounded-lg bg-[#eaf9f7] flex items-center justify-center text-[#0f7f7b] shrink-0">
              <MaskIcon file="add-icon.svg" className="block w-[16px] h-[16px] shrink-0 bg-current" />
            </span>
            <span className="text-left">
              <span className="block text-[17px] leading-[1.1] font-semibold text-[#1f2937]">Use template</span>
              <span className="block text-[12px] text-[#586473]">Pick a pre-built structure</span>
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
}: {
  label: string;
  paddingLeft: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-9 flex items-center text-[#2E7FA1] hover:bg-[#f0f8ff] transition-colors"
      style={{ paddingLeft, paddingRight: 6 }}
    >
      <span className="w-[14px] h-[14px] mr-[6px]" aria-hidden="true" />
      <span className="w-[18px] mr-[6px] shrink-0 flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      <span className="text-[13px] font-medium">{label}</span>
    </button>
  );
}

export default function CourseOutlinePanel({
  courseId,
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
}: CourseOutlinePanelProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [activeAddMenu, setActiveAddMenu] = useState<AddMenuTarget | null>(null);

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
    } else if (target.level === "group" && target.articleId && target.blockId) {
      onAddBlock(target.pageId, target.articleId);
    }
    setActiveAddMenu(null);
  }

  function handleCourseConfigClick() {
    const params = new URLSearchParams({ courseId });
    navigate(`/course/${courseId}/setup?${params.toString()}`);
  }

  return (
    <div ref={panelRef} className="w-[280px] h-full bg-white border-r border-[#d8dee6] flex flex-col shrink-0 overflow-x-hidden">
      <div className="px-[14px] py-3 border-b border-[#d8dee6] flex items-center justify-between shrink-0">
        <span className="text-sm tracking-[0.08em] font-semibold text-[#3b4753] uppercase">Structure</span>
        <button type="button" onClick={onClose} className="w-8 h-8 rounded flex items-center justify-center text-[#6b7280] hover:bg-[#f5f7fa]" aria-label="Collapse structure">
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
                onClick={() => {
                  setActiveAddMenu(null);
                  onPageSelect(page.id);
                }}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
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
                  if (window.confirm("Delete this topic?")) {
                    onDeletePage(page.id);
                  }
                }}
                menuOpen={activeAddKey === getTargetKey({ level: "topic", pageId: page.id })}
                onAddStartFresh={() => runAddAction({ level: "topic", pageId: page.id })}
                onAddTemplate={() => runAddAction({ level: "topic", pageId: page.id })}
                addLabel="topic"
              />

              {isExpanded(expandedTopics, page.id) && page.articles.map((article) => {
                const articleSelected = selectedArticleId === article.id && !selectedBlockId && !selectedComponentId;
                return (
                  <div key={article.id}>
                    <TreeRow
                      label={article.title}
                      paddingLeft={28}
                      selected={articleSelected}
                      onClick={() => {
                        setActiveAddMenu(null);
                        onArticleSelect(page.id, article.id);
                      }}
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
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
                        if (window.confirm("Delete this section?")) {
                          onDeleteArticle(page.id, article.id);
                        }
                      }}
                      menuOpen={activeAddKey === getTargetKey({ level: "section", pageId: page.id, articleId: article.id })}
                      onAddStartFresh={() => runAddAction({ level: "section", pageId: page.id, articleId: article.id })}
                      onAddTemplate={() => runAddAction({ level: "section", pageId: page.id, articleId: article.id })}
                      addLabel="section"
                    />

                    {isExpanded(expandedSections, article.id) && article.blocks.length === 0 && (
                      <InlineAddRow
                        label="Add Group"
                        paddingLeft={44}
                        onClick={() => onAddBlock(page.id, article.id)}
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
                            onClick={() => {
                              setActiveAddMenu(null);
                              onBlockSelect(page.id, article.id, block.id);
                            }}
                            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg>}
                            canExpand={true}
                            expanded={isExpanded(expandedGroups, block.id)}
                            onToggleExpand={() => setExpandedGroups((previous) => ({ ...previous, [block.id]: !isExpanded(previous, block.id) }))}
                            showAdd={canAddComponent}
                            onAdd={() => {
                              const target: AddMenuTarget = { level: "group", pageId: page.id, articleId: article.id, blockId: block.id };
                              setActiveAddMenu((previous) => (previous && getTargetKey(previous) === getTargetKey(target) ? null : target));
                            }}
                            showDelete={true}
                            onDelete={() => {
                              if (window.confirm("Delete this group?")) {
                                onDeleteBlock(page.id, article.id, block.id);
                              }
                            }}
                            menuOpen={canAddComponent && activeAddKey === getTargetKey({ level: "group", pageId: page.id, articleId: article.id, blockId: block.id })}
                            onAddStartFresh={() => runAddAction({ level: "group", pageId: page.id, articleId: article.id, blockId: block.id })}
                            onAddTemplate={() => runAddAction({ level: "group", pageId: page.id, articleId: article.id, blockId: block.id })}
                            addLabel="group"
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
                              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
                              showDelete={true}
                              onDelete={() => {
                                if (window.confirm("Delete this component?")) {
                                  onDeleteComponent(page.id, article.id, block.id, component.id);
                                }
                              }}
                            />
                          ))}

                          {isExpanded(expandedGroups, block.id) && canAddComponent && (
                            <InlineAddRow
                              label="Add Component"
                              paddingLeft={60}
                              onClick={() => {
                                const target: AddMenuTarget = { level: "group", pageId: page.id, articleId: article.id, blockId: block.id };
                                setActiveAddMenu((previous) => (previous && getTargetKey(previous) === getTargetKey(target) ? null : target));
                              }}
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

      <div className="px-3 pb-4 pt-3 border-t border-[#d8dee6] shrink-0">
        <button
          type="button"
          onClick={handleCourseConfigClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-[var(--life-base-white)] bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Course Config"
          title="Course Config"
          disabled={!courseId}
        >
          <MaskIcon file="back-icon.svg" className="block w-[13px] h-[13px] shrink-0 bg-current" />
          <span>Course Config</span>
        </button>
      </div>
    </div>
  );
}
