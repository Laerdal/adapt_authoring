"use client";

import type { BlockData } from "@/pages/editor/pageEditorWorkspace";
import EditorMaskIcon from "./EditorMaskIcon";

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
    <div className="w-80 h-full bg-white border-l border-[var(--life-neutral-100)] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--life-neutral-100)] shrink-0">
        <span className="text-xs font-bold tracking-widest text-[var(--life-neutral-850)] uppercase">
          Block Settings
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
        {/* Block Title */}
        <div>
          <label className="block text-xs font-semibold text-[var(--life-neutral-850)] mb-2">
            Title
          </label>
          <input
            type="text"
            value={block.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Block title"
            className="life-field"
          />
        </div>

        {/* Block Description */}
        <div>
          <label className="block text-xs font-semibold text-[var(--life-neutral-850)] mb-2">
            Description
          </label>
          <textarea
            value={block.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Block description"
            className="life-field"
            rows={4}
          />
        </div>

        {/* Block Instruction */}
        <div>
          <label className="block text-xs font-semibold text-[var(--life-neutral-850)] mb-2">
            Instruction
          </label>
          <textarea
            value={block.instruction}
            onChange={(e) => onUpdate({ instruction: e.target.value })}
            placeholder="Block instruction"
            className="life-field"
            rows={4}
          />
        </div>
      </div>

      {/* Footer with Action buttons */}
      <div className="px-4 py-4 border-t border-[var(--life-neutral-100)] flex gap-2 shrink-0 flex-col">
        <button
          type="button"
          onClick={onCopy}
          className="flex-1 px-3 py-2 text-sm font-medium text-[var(--life-neutral-700)] border border-[var(--life-neutral-200)] rounded-lg hover:bg-[var(--life-neutral-020)] transition-colors"
        >
          Copy Block
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 px-3 py-2 text-sm font-medium text-[var(--life-critical-600)] border border-[var(--life-critical-100)] rounded-lg hover:bg-[var(--life-critical-100)] transition-colors"
        >
          <EditorMaskIcon file="delete-icon.svg" className="inline-block w-[14px] h-[14px] mr-2 align-[-2px] shrink-0 bg-current" />
          Delete Block
        </button>
      </div>
    </div>
  );
}
