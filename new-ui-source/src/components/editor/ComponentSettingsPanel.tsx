"use client";

import type { ComponentData } from "@/pages/editor/pageEditorWorkspace";
import EditorMaskIcon from "./EditorMaskIcon";

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
    <div className="w-80 h-full bg-white border-l border-[var(--life-neutral-100)] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--life-neutral-100)] shrink-0">
        <span className="text-xs font-bold tracking-widest text-[var(--life-neutral-850)] uppercase">
          {component.type} Settings
        </span>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="life-icon-btn life-icon-btn--xs"
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
        <div className="px-3 py-2 bg-[var(--life-primary-100)] text-[var(--life-primary-500)] rounded-lg text-xs font-medium">
          {component.type}
        </div>

        {/* Title Setting */}
        <div>
          <label className="block text-xs font-semibold text-[var(--life-neutral-850)] mb-2">
            Title
          </label>
          <input
            type="text"
            value={component.settings.title || ""}
            onChange={(e) => updateSetting("title", e.target.value)}
            placeholder="Component title"
            className="life-field"
          />
        </div>

        {/* Description Setting */}
        <div>
          <label className="block text-xs font-semibold text-[var(--life-neutral-850)] mb-2">
            Description
          </label>
          <textarea
            value={component.settings.description || ""}
            onChange={(e) => updateSetting("description", e.target.value)}
            placeholder="Component description"
            className="life-field"
            rows={3}
          />
        </div>

        {/* URL Setting (for Image, Video) */}
        {(component.type === "Image" || component.type === "Video") && (
          <div>
            <label className="block text-xs font-semibold text-[var(--life-neutral-850)] mb-2">
              {component.type === "Image" ? "Image URL" : "Video URL"}
            </label>
            <input
              type="url"
              value={component.settings.url || ""}
              onChange={(e) => updateSetting("url", e.target.value)}
              placeholder={component.type === "Image" ? "Enter image URL" : "Enter video URL (YouTube, Vimeo)"}
              className="life-field"
            />
          </div>
        )}

        {/* Accordion Items (for Accordion type) */}
        {component.type === "Accordion" && (
          <div>
            <label className="block text-xs font-semibold text-[var(--life-neutral-850)] mb-2">
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
              className="life-field"
              rows={4}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[var(--life-neutral-100)] flex gap-2 shrink-0 flex-col">
        {onSwap && (
          <button
            type="button"
            onClick={onSwap}
            className="px-3 py-2 text-sm font-medium text-[var(--life-primary-500)] border border-[var(--life-neutral-200)] rounded-lg hover:bg-[#f0f8ff] transition-colors"
          >
            Swap Position
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="px-3 py-2 text-sm font-medium text-[var(--life-neutral-700)] border border-[var(--life-neutral-200)] rounded-lg hover:bg-[var(--life-neutral-020)] transition-colors"
        >
          Copy Component
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="px-3 py-2 text-sm font-medium text-[var(--life-critical-600)] border border-[var(--life-critical-100)] rounded-lg hover:bg-[var(--life-critical-100)] transition-colors"
        >
          <EditorMaskIcon file="delete-icon.svg" className="inline-block w-[14px] h-[14px] mr-2 align-[-2px] shrink-0 bg-current" />
          Delete Component
        </button>
      </div>
    </div>
  );
}
