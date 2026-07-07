"use client";

import type { BlockData } from "@/components/course/CourseEditor";

interface BlockSettingsPanelProps {
  block: BlockData;
  onUpdate: (patch: Partial<BlockData>) => void;
  onDelete: () => void;
  onCopy: () => void;
  onClose: () => void;
}

export default function BlockSettingsPanel({
  block,
  onUpdate,
  onDelete,
  onCopy,
  onClose,
}: BlockSettingsPanelProps) {
  return (
    <div className="w-80 h-full bg-white border-l border-[#e5e7eb] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[#e5e7eb] shrink-0">
        <span className="text-xs font-bold tracking-widest text-[#111827] uppercase">
          Block Settings
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
        {/* Block Title */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-2">
            Title
          </label>
          <input
            type="text"
            value={block.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Block title"
            className="w-full px-3 py-2 border border-[#d1d5db] rounded-lg bg-white text-sm placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8]"
          />
        </div>

        {/* Block Description */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-2">
            Description
          </label>
          <textarea
            value={block.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Block description"
            className="w-full px-3 py-2 border border-[#d1d5db] rounded-lg bg-white text-sm placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] resize-none"
            rows={4}
          />
        </div>

        {/* Block Instruction */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-2">
            Instruction
          </label>
          <textarea
            value={block.instruction}
            onChange={(e) => onUpdate({ instruction: e.target.value })}
            placeholder="Block instruction"
            className="w-full px-3 py-2 border border-[#d1d5db] rounded-lg bg-white text-sm placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] resize-none"
            rows={4}
          />
        </div>
      </div>

      {/* Footer with Action buttons */}
      <div className="px-4 py-4 border-t border-[#e5e7eb] flex gap-2 shrink-0 flex-col">
        <button
          type="button"
          onClick={onCopy}
          className="flex-1 px-3 py-2 text-sm font-medium text-[#374151] border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
        >
          Copy Block
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 px-3 py-2 text-sm font-medium text-[#dc2626] border border-[#fecaca] rounded-lg hover:bg-[#fee2e2] transition-colors"
        >
          Delete Block
        </button>
      </div>
    </div>
  );
}
