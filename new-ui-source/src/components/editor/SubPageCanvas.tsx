"use client";

import type { SubPageData } from "@/pages/editor/pageEditorWorkspace";

interface SubPageCanvasProps {
  subPage: SubPageData;
  onUpdate: (patch: Partial<SubPageData>) => void;
  onSelectSection: (e: React.MouseEvent) => void;
  isSelected: boolean;
  isEditingInPanel?: boolean;
  previewMode?: boolean;
}

export default function SubPageCanvas({
  subPage,
  onUpdate,
  onSelectSection,
  isSelected,
  isEditingInPanel,
  previewMode = false,
}: SubPageCanvasProps) {
  function handleCardClick(e: React.MouseEvent) {
    e.stopPropagation();
    onSelectSection(e);
  }

  return (
    <div
      onClick={handleCardClick}
      className={`menu-canvas-card relative w-full max-w-3xl mx-auto cursor-pointer transition-all${isSelected ? " is-selected" : ""}${isEditingInPanel && !isSelected ? " is-editing" : ""}`}
    >
      <div className={`flex flex-col ${previewMode ? "gap-3 px-10 py-6" : "gap-5 px-10 py-8"} items-start text-left`}>

        {!previewMode && (
          <div className="menu-canvas-chip self-start rounded-lg px-3 py-1 text-sm font-medium">
            Sub Page
          </div>
        )}

        {previewMode ? (
          <h2 className="menu-canvas-title w-full text-4xl font-normal leading-tight font-[Lato] text-[#1f2937]">
            {subPage.title || "Untitled Sub Page"}
          </h2>
        ) : (
          <input
            type="text"
            value={subPage.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Sub Page Title"
            className="menu-canvas-title w-full bg-transparent border-none outline-none text-4xl font-bold placeholder-[#9ca3af] focus:ring-0 cursor-text leading-tight"
            aria-label="Sub page title"
          />
        )}

        {previewMode ? (
          subPage.description ? (
            <p className="menu-canvas-subtitle w-full text-lg leading-relaxed text-[#4b5563] font-[Lato]">
              {subPage.description}
            </p>
          ) : null
        ) : (
          <input
            type="text"
            value={subPage.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Add a description..."
            className="menu-canvas-subtitle w-full bg-transparent border-none outline-none text-lg placeholder-[#9ca3af] focus:ring-0 cursor-text -mt-3"
            aria-label="Sub page description"
          />
        )}

      </div>
    </div>
  );
}
