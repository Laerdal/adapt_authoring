"use client";

import type { ContentPageData } from "@/components/course/CourseEditor";

interface ContentPageCanvasProps {
  page: ContentPageData;
  onUpdate: (patch: Partial<ContentPageData>) => void;
  onSelectSection: (e: React.MouseEvent) => void;
  onAddArticle: (pageId: string) => void;
  onAddSubPage: (pageId: string) => void;
  onCopy?: () => void;
  onDelete?: () => void;
  isSelected: boolean;
  isEditingInPanel?: boolean;
  previewMode?: boolean;
}

export default function ContentPageCanvas({
  page,
  onUpdate,
  onSelectSection,
  onAddArticle,
  onAddSubPage,
  onCopy,
  onDelete,
  isSelected,
  isEditingInPanel,
  previewMode = false,
}: ContentPageCanvasProps) {
  function handleCardClick(e: React.MouseEvent) {
    e.stopPropagation();
    onSelectSection(e);
  }

  return (
    <div
      onClick={handleCardClick}
      className={`menu-canvas-card relative w-full max-w-3xl mx-auto cursor-pointer transition-all ${previewMode ? "hover:border-transparent hover:shadow-[0_0_5px_2px_#CBE1E6]" : ""}${isSelected ? " is-selected" : ""}${isEditingInPanel && !isSelected ? " is-editing" : ""}`}
    >
      <div className={`flex flex-col ${previewMode ? "gap-3 px-10 py-6" : "gap-5 px-10 py-8"} items-start text-left`}>

        {/* Top row: chip + action icons */}
        {!previewMode && (
          <div className="w-full flex items-center justify-between">
            <div className="menu-canvas-chip self-start rounded-lg px-3 py-1 text-sm font-medium">
              Topic
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Copy page"
                onClick={(e) => { e.stopPropagation(); onCopy?.(); }}
                className="w-6 h-6 flex items-center justify-center rounded text-[#ABABAB] hover:text-[#474747] hover:bg-[#F2F2F2] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Delete page"
                onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this page?")) onDelete?.(); }}
                className="w-6 h-6 flex items-center justify-center rounded text-[#ABABAB] hover:text-[#DC3449] hover:bg-[#FDDEE2] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6h16zM10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Topic Title */}
        {previewMode ? (
          <h1 className="menu-canvas-title w-full text-5xl font-normal leading-tight font-[Lato]">
            {page.title || "Untitled Topic"}
          </h1>
        ) : (
          <input
            type="text"
            value={page.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Topic Title"
            className="menu-canvas-title w-full bg-transparent border-none outline-none text-4xl font-bold placeholder-[#ABABAB] focus:ring-0 cursor-text leading-tight font-[Lato]"
            aria-label="Topic title"
          />
        )}

      </div>
    </div>
  );
}
