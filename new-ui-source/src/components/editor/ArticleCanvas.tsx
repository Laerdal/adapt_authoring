"use client";

import BlockCanvas from "./BlockCanvas";
import EditorMaskIcon from "./EditorMaskIcon";
import type { ArticleData, BlockData } from "@/pages/editor/pageEditorWorkspace";

interface ArticleCanvasProps {
  article: ArticleData;
  onUpdate: (patch: Partial<ArticleData>) => void;
  onSelectSection: (e: React.MouseEvent) => void;
  onAddBlock?: () => void;
  onBlockUpdate?: (blockId: string, patch: Partial<BlockData>) => void;
  onSelectBlock?: (blockId: string) => void;
  onAddComponent?: (blockId: string) => void;
  onSelectComponent?: (blockId: string, componentId: string) => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onCopyBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onCopyComponent?: (blockId: string, componentId: string) => void;
  onDeleteComponent?: (blockId: string, componentId: string) => void;
  selectedBlockId?: string | null;
  selectedComponentId?: string | null;
  isSelected: boolean;
  isEditingInPanel?: boolean;
  previewMode?: boolean;
}

export default function ArticleCanvas({
  article,
  onUpdate,
  onSelectSection,
  onAddBlock,
  onBlockUpdate,
  onSelectBlock,
  onAddComponent,
  onSelectComponent,
  onCopy,
  onDelete,
  onCopyBlock,
  onDeleteBlock,
  onCopyComponent,
  onDeleteComponent,
  selectedBlockId,
  selectedComponentId,
  isSelected,
  isEditingInPanel,
  previewMode = false,
}: ArticleCanvasProps) {
  function handleCardClick(e: React.MouseEvent) {
    e.stopPropagation();
    onSelectSection(e);
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Article header with drag handle */}
      <div
        onClick={handleCardClick}
        className={`menu-canvas-card relative w-full max-w-3xl mx-auto cursor-pointer transition-all border-2 ${
          isSelected
            ? "border-[#2E7FA1] bg-[#D4E9F2]"
            : "border-transparent bg-white hover:border-transparent hover:shadow-[0_0_5px_2px_#CBE1E6]"
        }`}
      >
        <div className={`flex items-start ${previewMode ? "gap-0 px-6 py-4" : "gap-4 px-6 py-6"}`}>
          {/* Drag handle */}
          {!previewMode && (
            <div className="text-[#ABABAB] flex-shrink-0 mt-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="5" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="9" cy="19" r="1.5" />
                <circle cx="16" cy="5" r="1.5" />
                <circle cx="16" cy="12" r="1.5" />
                <circle cx="16" cy="19" r="1.5" />
              </svg>
            </div>
          )}

          <div className="flex-1 flex flex-col gap-4">
            {/* "Article" chip */}
            {!previewMode && (
              <div className="menu-canvas-chip self-start rounded-lg px-3 py-1 text-sm font-medium">
                Article
              </div>
            )}

            {/* Article Title */}
            {previewMode ? (
              <h2 className="w-full text-4xl font-normal leading-tight font-[Lato] text-[#1f2937]">
                {article.title || "Untitled Section"}
              </h2>
            ) : (
              <input
                type="text"
                value={article.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="Article Title"
                className="w-full bg-transparent border-none outline-none text-2xl font-bold placeholder-[#ABABAB] focus:ring-0 cursor-text font-[Lato]"
                aria-label="Article title"
              />
            )}
          </div>

          {/* Action icons */}
          {!previewMode && <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              aria-label="Copy article"
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
              aria-label="Delete article"
              onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this article?")) onDelete?.(); }}
              className="w-6 h-6 flex items-center justify-center rounded text-[#ABABAB] hover:text-[#DC3449] hover:bg-[#FDDEE2] transition-colors"
            >
              <EditorMaskIcon file="delete-icon.svg" className="block w-[16px] h-[16px] shrink-0 bg-current" />
            </button>
          </div>}
        </div>
      </div>

      {/* Blocks section */}
      <div className="w-full flex flex-col gap-6">
        {article.blocks.length === 0 ? (
          <div className="w-full max-w-3xl mx-auto border-2 border-dashed border-[#E5E5E5] rounded-lg bg-white p-8 flex flex-col items-center justify-center gap-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CCCCCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <g>
                <path d="M12 3v18" />
                <path d="M3 12h18" />
              </g>
              <g opacity="0.5">
                <rect x="4" y="4" width="16" height="16" />
              </g>
            </svg>
            <p className="text-sm text-[#ABABAB]">No blocks in this article yet.</p>
          </div>
        ) : (
          article.blocks.map((block) => (
            <BlockCanvas
              key={block.id}
              block={block}
              onUpdate={(patch) => onBlockUpdate?.(block.id, patch)}
              onSelectSection={() => onSelectBlock?.(block.id)}
              onAddComponent={() => onAddComponent?.(block.id)}
              onSelectComponent={(componentId) => onSelectComponent?.(block.id, componentId)}
              onCopy={() => onCopyBlock?.(block.id)}
              onDelete={() => onDeleteBlock?.(block.id)}
              onCopyComponent={(componentId) => onCopyComponent?.(block.id, componentId)}
              onDeleteComponent={(componentId) => onDeleteComponent?.(block.id, componentId)}
              selectedComponentId={selectedComponentId}
              isSelected={selectedBlockId === block.id}
              isEditingInPanel={isEditingInPanel}
              previewMode={previewMode}
            />
          ))
        )}

        {onAddBlock && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddBlock();
            }}
            className="w-full max-w-3xl mx-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E7FA1] hover:bg-[#266580] active:bg-[#1D4C60] text-white text-base font-bold rounded-lg transition-colors font-[Lato]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Block</span>
          </button>
        )}
      </div>
    </div>
  );
}
