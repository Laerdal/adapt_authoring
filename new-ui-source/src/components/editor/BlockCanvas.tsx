"use client";

import ComponentCanvas from "./ComponentCanvas";
import EditorMaskIcon from "./EditorMaskIcon";
import type { BlockData } from "@/pages/editor/pageEditorWorkspace";

const ICON_BASE = "/new/assets/icons";

function MaskIcon({ file, className }: { file: string; className?: string }) {
  const iconPath = `${ICON_BASE}/${file}`;
  return (
    <span
      aria-hidden="true"
      className={className ?? "block w-[14px] h-[14px] shrink-0 bg-current"}
      style={{
        WebkitMaskImage: `url(${iconPath})`,
        maskImage: `url(${iconPath})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

interface BlockCanvasProps {
  block: BlockData;
  onUpdate: (patch: Partial<BlockData>) => void;
  onSelectSection?: (e: React.MouseEvent) => void;
  onAddComponent?: () => void;
  onSelectComponent?: (componentId: string) => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onCopyComponent?: (componentId: string) => void;
  onDeleteComponent?: (componentId: string) => void;
  selectedComponentId?: string | null;
  isSelected: boolean;
  isEditingInPanel?: boolean;
  previewMode?: boolean;
}

export default function BlockCanvas({
  block,
  onUpdate,
  onSelectSection,
  onAddComponent,
  onSelectComponent,
  onCopy,
  onDelete,
  onCopyComponent,
  onDeleteComponent,
  selectedComponentId,
  isSelected,
  isEditingInPanel,
  previewMode = false,
}: BlockCanvasProps) {
  const canAddComponent = block.components.length < 2;

  function handleCardClick(e: React.MouseEvent) {
    e.stopPropagation();
    onSelectSection?.(e);
  }

  return (
    <div
      onClick={handleCardClick}
      className={`w-full max-w-3xl mx-auto border-2 rounded-lg bg-white ${previewMode ? "p-4" : "p-6"} cursor-pointer transition-all ${
        isSelected
          ? "border-[#2E7FA1] bg-[#D4E9F2]"
          : "border-transparent hover:border-transparent hover:shadow-[0_0_5px_2px_#CBE1E6]"
      }`}
    >
      <div className="flex flex-col gap-4">
        {/* Header row: chip + action icons */}
        <div className="flex items-center justify-between">
          {!previewMode && <div className="rounded-lg px-3 py-1 text-xs font-semibold bg-[#F2F2F2] text-[#5E5E5E] self-start font-[Lato]">
            Block
          </div>}
          {!previewMode && <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Copy block"
              onClick={(e) => { e.stopPropagation(); onCopy?.(); }}
              className="w-6 h-6 flex items-center justify-center rounded text-[#ABABAB] hover:text-[#474747] hover:bg-[#F2F2F2] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Delete block"
              onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this block?")) onDelete?.(); }}
              className="w-6 h-6 flex items-center justify-center rounded text-[#ABABAB] hover:text-[#DC3449] hover:bg-[#FDDEE2] transition-colors"
            >
              <EditorMaskIcon file="delete-icon.svg" className="block w-[16px] h-[16px] shrink-0 bg-current" />
            </button>
          </div>}
        </div>

        {/* Block Title */}
        {previewMode ? (
          <h3 className="w-full text-3xl font-normal leading-tight font-[Lato] text-[#1f2937]">
            {block.title || "Untitled Content Group"}
          </h3>
        ) : (
          <input
            type="text"
            value={block.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Block Title"
            className="w-full bg-transparent border-none outline-none text-xl font-bold placeholder-[#ABABAB] focus:ring-0 cursor-text font-[Lato]"
            aria-label="Block title"
          />
        )}

        {/* Block Description */}
        {!previewMode && (
          <input
            type="text"
            value={block.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Block Description"
            className="w-full bg-transparent border-none outline-none text-base placeholder-[#ABABAB] focus:ring-0 cursor-text font-[Lato]"
            aria-label="Block description"
          />
        )}

        {/* Block Instruction */}
        {!previewMode && (
          <textarea
            value={block.instruction}
            onChange={(e) => onUpdate({ instruction: e.target.value })}
            placeholder="Block Instruction"
            className="w-full bg-transparent border-none outline-none text-base placeholder-[#ABABAB] focus:ring-0 cursor-text resize-none font-[Lato]"
            rows={3}
            aria-label="Block instruction"
          />
        )}

        {/* Components Section */}
        {block.components.length > 0 && (
          <div className={`${previewMode ? "mt-2 pt-0 border-t-0" : "mt-6 pt-6 border-t border-[#E5E5E5]"}`}>
            {!previewMode && <p className="text-xs font-semibold text-[#5E5E5E] mb-4 font-[Lato]">Components ({block.components.length})</p>}
            <div className="flex flex-col gap-4">
              {block.components.map((component) => (
                <ComponentCanvas
                  key={component.id}
                  component={component}
                  onSelect={() => onSelectComponent?.(component.id)}
                  onCopy={() => onCopyComponent?.(component.id)}
                  onDelete={() => onDeleteComponent?.(component.id)}
                  isSelected={isSelected && selectedComponentId === component.id}
                  previewMode={previewMode}
                />
              ))}
            </div>
          </div>
        )}

        {/* Add Component Button */}
        {!previewMode && canAddComponent && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddComponent?.();
            }}
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E7FA1] hover:bg-[#266580] active:bg-[#1D4C60] text-white text-base font-bold rounded-lg transition-colors font-[Lato]"
          >
              <MaskIcon file="add-icon.svg" className="block w-[16px] h-[16px] shrink-0 bg-current" />
            <span>Add Component</span>
          </button>
        )}
      </div>
    </div>
  );
}
