"use client";

import type { ComponentData } from "@/components/course/CourseEditor";

interface ComponentSettingsPanelProps {
  component: ComponentData;
  onUpdate: (patch: Partial<ComponentData>) => void;
  onDelete: () => void;
  onCopy: () => void;
  onSwap?: () => void;
  onClose: () => void;
}

export default function ComponentSettingsPanel({
  component,
  onUpdate,
  onDelete,
  onCopy,
  onSwap,
  onClose,
}: ComponentSettingsPanelProps) {
  const updateSetting = (key: string, value: any) => {
    onUpdate({
      settings: {
        ...component.settings,
        [key]: value,
      },
    });
  };

  return (
    <div className="w-80 h-full bg-white border-l border-[#e5e7eb] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[#e5e7eb] shrink-0">
        <span className="text-xs font-bold tracking-widest text-[#111827] uppercase">
          {component.type} Settings
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
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-6">
        {/* Component Type Badge */}
        <div className="px-3 py-2 bg-[#dbeeff] text-[#2d6fa8] rounded-lg text-xs font-medium">
          {component.type}
        </div>

        {/* Title Setting */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-2">
            Title
          </label>
          <input
            type="text"
            value={component.settings.title || ""}
            onChange={(e) => updateSetting("title", e.target.value)}
            placeholder="Component title"
            className="w-full px-3 py-2 border border-[#d1d5db] rounded-lg bg-white text-sm placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8]"
          />
        </div>

        {/* Description Setting */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-2">
            Description
          </label>
          <textarea
            value={component.settings.description || ""}
            onChange={(e) => updateSetting("description", e.target.value)}
            placeholder="Component description"
            className="w-full px-3 py-2 border border-[#d1d5db] rounded-lg bg-white text-sm placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] resize-none"
            rows={3}
          />
        </div>

        {/* URL Setting (for Image, Video) */}
        {(component.type === "Image" || component.type === "Video") && (
          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-2">
              {component.type === "Image" ? "Image URL" : "Video URL"}
            </label>
            <input
              type="url"
              value={component.settings.url || ""}
              onChange={(e) => updateSetting("url", e.target.value)}
              placeholder={component.type === "Image" ? "Enter image URL" : "Enter video URL (YouTube, Vimeo)"}
              className="w-full px-3 py-2 border border-[#d1d5db] rounded-lg bg-white text-sm placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8]"
            />
          </div>
        )}

        {/* Accordion Items (for Accordion type) */}
        {component.type === "Accordion" && (
          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-2">
              Items (JSON)
            </label>
            <textarea
              value={JSON.stringify(component.settings.items || [], null, 2)}
              onChange={(e) => {
                try {
                  updateSetting("items", JSON.parse(e.target.value));
                } catch (e) {
                  // Invalid JSON, ignore
                }
              }}
              placeholder='[{"title": "Item 1", "content": "..."}]'
              className="w-full px-3 py-2 border border-[#d1d5db] rounded-lg bg-white text-sm placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] resize-none font-mono"
              rows={4}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[#e5e7eb] flex gap-2 shrink-0 flex-col">
        {onSwap && (
          <button
            type="button"
            onClick={onSwap}
            className="px-3 py-2 text-sm font-medium text-[#2d6fa8] border border-[#d1d5db] rounded-lg hover:bg-[#f0f8ff] transition-colors"
          >
            Swap Position
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="px-3 py-2 text-sm font-medium text-[#374151] border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
        >
          Copy Component
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="px-3 py-2 text-sm font-medium text-[#dc2626] border border-[#fecaca] rounded-lg hover:bg-[#fee2e2] transition-colors"
        >
          Delete Component
        </button>
      </div>
    </div>
  );
}
