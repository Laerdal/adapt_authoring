"use client";

import type { ComponentData } from "@/components/course/CourseEditor";

interface ComponentCanvasProps {
  component: ComponentData;
  onSelect: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  isSelected: boolean;
}

export default function ComponentCanvas({
  component,
  onSelect,
  onCopy,
  onDelete,
  isSelected,
}: ComponentCanvasProps) {
  const getComponentPreview = () => {
    switch (component.type) {
      case "Image":
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#ABABAB]">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-xs text-[#5E5E5E] font-[Lato]">{component.settings.title || "Image"}</span>
          </div>
        );
      case "Video":
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#ABABAB]">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <span className="text-xs text-[#5E5E5E] font-[Lato]">{component.settings.title || "Video"}</span>
          </div>
        );
      case "Accordion":
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#ABABAB]">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
            </svg>
            <span className="text-xs text-[#5E5E5E] font-[Lato]">{component.settings.title || "Accordion"}</span>
          </div>
        );
      case "Text":
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#ABABAB]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-xs text-[#5E5E5E] font-[Lato]">{component.settings.title || "Text"}</span>
          </div>
        );
      case "Quiz":
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#ABABAB]">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span className="text-xs text-[#5E5E5E] font-[Lato]">{component.settings.title || "Quiz"}</span>
          </div>
        );
      default:
        return <span className="text-xs text-[#5E5E5E] font-[Lato]">{component.type}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-1">
      <button
        type="button"
        onClick={onSelect}
        className={`w-full flex flex-col items-center justify-center py-6 rounded-lg border-2 transition-all cursor-pointer ${
          isSelected
            ? "border-[#2E7FA1] bg-[#D4E9F2]"
            : "border-[#E5E5E5] bg-white hover:border-[#ABABAB] hover:bg-[#FAFAFA]"
        }`}
      >
        {getComponentPreview()}
      </button>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          aria-label="Copy component"
          onClick={(e) => { e.stopPropagation(); onCopy?.(); }}
          className="w-6 h-6 flex items-center justify-center rounded text-[#ABABAB] hover:text-[#474747] hover:bg-[#F2F2F2] transition-colors"
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
          className="w-6 h-6 flex items-center justify-center rounded text-[#ABABAB] hover:text-[#DC3449] hover:bg-[#FDDEE2] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6h16zM10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
