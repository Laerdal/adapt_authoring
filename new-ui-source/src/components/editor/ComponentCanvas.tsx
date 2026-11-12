"use client";

import EditorMaskIcon from "./EditorMaskIcon";
import type { ComponentData } from "@/pages/editor/pageEditorWorkspace";

interface ComponentCanvasProps {
  component: ComponentData;
  onSelect: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  isSelected: boolean;
  previewMode?: boolean;
}

export default function ComponentCanvas({
  component,
  onSelect,
  onCopy,
  onDelete,
  isSelected,
  previewMode = false,
}: ComponentCanvasProps) {
  const getComponentPreview = () => {
    switch (component.type) {
      case "Image":
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--life-neutral-300)]">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-xs text-[var(--life-neutral-600)] font-[Lato]">{component.settings.title || "Image"}</span>
          </div>
        );
      case "Video":
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--life-neutral-300)]">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <span className="text-xs text-[var(--life-neutral-600)] font-[Lato]">{component.settings.title || "Video"}</span>
          </div>
        );
      case "Accordion":
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--life-neutral-300)]">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
            </svg>
            <span className="text-xs text-[var(--life-neutral-600)] font-[Lato]">{component.settings.title || "Accordion"}</span>
          </div>
        );
      case "Text":
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--life-neutral-300)]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-xs text-[var(--life-neutral-600)] font-[Lato]">{component.settings.title || "Text"}</span>
          </div>
        );
      case "Quiz":
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--life-neutral-300)]">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span className="text-xs text-[var(--life-neutral-600)] font-[Lato]">{component.settings.title || "Quiz"}</span>
          </div>
        );
      default:
        return <span className="text-xs text-[var(--life-neutral-600)] font-[Lato]">{component.type}</span>;
    }
  };

  return (
    <div className="w-full flex flex-col gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`w-full flex flex-col items-center justify-center py-6 rounded-lg border-2 transition-all cursor-pointer ${
          isSelected
            ? "border-[var(--life-primary-500)] bg-[#D4E9F2]"
            : "border-transparent bg-white hover:border-transparent hover:shadow-[0_0_5px_2px_#CBE1E6] hover:bg-[var(--life-neutral-020)]"
        }`}
      >
        {previewMode ? (
          <div className="w-full text-left px-0 flex flex-col gap-3">
            <div className="text-2xl font-normal leading-tight text-[var(--life-neutral-850)] font-[Lato]">
              {component.settings.title || component.type}
            </div>
            <div className="text-base leading-relaxed text-[var(--life-neutral-850)] font-[Lato]">
              {component.settings.description || "Add your content here..."}
            </div>
          </div>
        ) : (
          getComponentPreview()
        )}
      </button>
      {!previewMode && <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          aria-label="Copy component"
          onClick={(e) => { e.stopPropagation(); onCopy?.(); }}
          className="life-icon-btn life-icon-btn--xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Delete component"
          onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this component?")) onDelete?.(); }}
          className="life-icon-btn life-icon-btn--xs life-icon-btn--critical"
        >
          <EditorMaskIcon file="delete-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
        </button>
      </div>}
    </div>
  );
}
