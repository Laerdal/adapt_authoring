"use client";

import type { SubPageData } from "@/pages/editor/pageEditorWorkspace";
import EditorMaskIcon from "./EditorMaskIcon";

interface SubPageSettingsPanelProps {
  subPage: SubPageData;
  onUpdate: (patch: Partial<SubPageData>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function SubPageSettingsPanel({
  subPage,
  onUpdate,
  onDelete,
  onClose,
}: SubPageSettingsPanelProps) {
  return (
    <aside className="w-80 h-full bg-white border-l border-[var(--life-neutral-100)] flex flex-col shrink-0">
      {/* Panel label */}
      <div className="px-4 h-10 flex items-center border-b border-[var(--life-neutral-100)] shrink-0">
        <span className="text-xs font-semibold text-[var(--life-neutral-600)] tracking-wide uppercase">Settings Panel</span>
        <button
          type="button"
          aria-label="Close settings panel"
          onClick={onClose}
          className="life-icon-btn life-icon-btn--xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Section header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--life-neutral-100)] shrink-0">
        <span className="text-sm font-semibold text-[var(--life-neutral-850)]">Edit Sub Page</span>
        <button
          type="button"
          aria-label="Close edit panel"
          onClick={onClose}
          className="life-icon-btn life-icon-btn--xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col divide-y divide-[var(--life-neutral-050)]">

          {/* Sub Page Title */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--life-neutral-700)] flex items-center gap-1">
              Sub Page Title
              <span className="text-[var(--life-critical-600)]">*</span>
            </label>
            <input
              type="text"
              value={subPage.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Untitled Sub Page"
              className="life-field"
            />
          </section>

          {/* Sub Page Description */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--life-neutral-700)]">Description</label>
            <textarea
              rows={4}
              value={subPage.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Add a description for this sub page..."
              className="life-field"
            />
          </section>

          {/* Delete Button */}
          <section className="px-4 py-4">
            <button
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to delete this sub page?")) {
                  onDelete();
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--life-critical-600)] text-[var(--life-critical-600)] hover:bg-[var(--life-critical-100)] rounded-lg text-sm font-medium transition-colors"
            >
                <EditorMaskIcon file="delete-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
              Delete Sub Page
            </button>
          </section>

        </div>
      </div>
    </aside>
  );
}
