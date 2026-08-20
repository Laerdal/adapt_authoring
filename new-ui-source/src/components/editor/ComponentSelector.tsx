"use client";

import type { ComponentType } from "@/components/course/CourseEditor";

const AVAILABLE_COMPONENTS: { type: ComponentType; label: string; description: string }[] = [
  { type: "Image", label: "Image", description: "Add images to your content" },
  { type: "Video", label: "Video", description: "Embed videos from YouTube or Vimeo" },
  { type: "Accordion", label: "Accordion", description: "Create expandable accordion sections" },
  { type: "Text", label: "Text", description: "Add formatted text content" },
  { type: "Quiz", label: "Quiz", description: "Add quiz questions and answers" },
];

interface ComponentSelectorProps {
  onSelectComponent: (type: ComponentType) => void;
  onClose: () => void;
  maxComponentsReached: boolean;
}

export default function ComponentSelector({
  onSelectComponent,
  onClose,
  maxComponentsReached,
}: ComponentSelectorProps) {
  return (
    <div className="w-80 h-full bg-white border-l border-[#e5e7eb] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[#e5e7eb] shrink-0">
        <span className="text-xs font-bold tracking-widest text-[#111827] uppercase">
          Add Component
        </span>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {maxComponentsReached && (
          <div className="mb-4 p-3 bg-[#fef3c7] border border-[#fcd34d] rounded-lg">
            <p className="text-xs text-[#92400e]">Maximum 2 components per block reached</p>
          </div>
        )}

        <div className="space-y-2">
          {AVAILABLE_COMPONENTS.map((comp) => (
            <button
              key={comp.type}
              onClick={() => {
                onSelectComponent(comp.type);
                onClose();
              }}
              disabled={maxComponentsReached}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                maxComponentsReached
                  ? "border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af] cursor-not-allowed"
                  : "border-[#d1d5db] hover:border-[#2d6fa8] hover:bg-[#f0f8ff] cursor-pointer"
              }`}
            >
              <p className="font-medium text-sm">{comp.label}</p>
              <p className="text-xs text-[#6b7280] mt-1">{comp.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
