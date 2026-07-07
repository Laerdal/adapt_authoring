"use client";

import type { ArticleData } from "@/components/course/CourseEditor";

interface ArticleSettingsPanelProps {
  article: ArticleData;
  onUpdate: (patch: Partial<ArticleData>) => void;
  onDelete: () => void;
  onCopy: () => void;
  onClose: () => void;
}

export default function ArticleSettingsPanel({
  article,
  onUpdate,
  onDelete,
  onCopy,
  onClose,
}: ArticleSettingsPanelProps) {
  return (
    <aside className="w-80 h-full bg-white border-l border-[#e5e7eb] flex flex-col shrink-0">
      {/* Panel label */}
      <div className="px-4 h-10 flex items-center border-b border-[#e5e7eb] shrink-0">
        <span className="text-xs font-semibold text-[#6b7280] tracking-wide uppercase">Settings Panel</span>
        <button
          type="button"
          aria-label="Close settings panel"
          onClick={onClose}
          className="ml-auto w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Section header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#e5e7eb] shrink-0">
        <span className="text-sm font-semibold text-[#111827]">Edit Article</span>
        <button
          type="button"
          aria-label="Close edit panel"
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col divide-y divide-[#f3f4f6]">

          {/* Article Title */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151] flex items-center gap-1">
              Article Title
              <span className="text-[#dc2626]">*</span>
            </label>
            <input
              type="text"
              value={article.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Untitled Article"
              className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
            />
          </section>

          {/* Article Description */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Description</label>
            <textarea
              rows={3}
              value={article.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Add a brief description for this article..."
              className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
            />
          </section>

          {/* Article Instruction */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Instruction</label>
            <textarea
              rows={4}
              value={article.instruction}
              onChange={(e) => onUpdate({ instruction: e.target.value })}
              placeholder="Add detailed instructions for this article..."
              className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
            />
          </section>

          {/* Action Buttons */}
          <section className="px-4 py-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#d1d5db] text-[#374151] hover:bg-[#f9fafb] rounded-lg text-sm font-medium transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              Copy Article
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to delete this article?")) {
                  onDelete();
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#dc2626] text-[#dc2626] hover:bg-[#fee2e2] rounded-lg text-sm font-medium transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6h16zM10 11v6M14 11v6" />
              </svg>
              Delete Article
            </button>
          </section>

        </div>
      </div>
    </aside>
  );
}
