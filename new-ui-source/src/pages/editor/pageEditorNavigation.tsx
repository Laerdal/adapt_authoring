import { CourseOutlinePanel } from "../../components/editor/index";
import { useNavigate } from "react-router-dom";
import type { ContentPageData } from "./pageEditorWorkspace";

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

interface PageEditorNavigationProps {
  courseId: string;
  leftPanelOpen: boolean;
  onClosePanels: () => void;
  onOpenPanels: () => void;
  menuPageCreated: boolean;
  menuSelected: boolean;
  contentPages: ContentPageData[];
  selectedPageId: string | null;
  selectedSubPageId: string | null;
  selectedArticleId: string | null;
  selectedBlockId: string | null;
  selectedComponentId: string | null;
  onMenuSelect: () => void;
  onPageSelect: (pageId: string) => void;
  onSubPageSelect: (pageId: string, subPageId: string) => void;
  onArticleSelect: (pageId: string, articleId: string) => void;
  onBlockSelect: (pageId: string, articleId: string, blockId: string) => void;
  onComponentSelect: (pageId: string, articleId: string, blockId: string, componentId: string) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
  onAddArticle: (pageId: string) => void;
  onDeleteArticle: (pageId: string, articleId: string) => void;
  onAddSubPage: (pageId: string) => void;
  onAddBlock: (pageId: string, articleId: string) => void;
  onDeleteBlock: (pageId: string, articleId: string, blockId: string) => void;
  onAddComponent: (pageId: string, articleId: string, blockId: string) => void;
  onDeleteComponent: (pageId: string, articleId: string, blockId: string, componentId: string) => void;
  onUseTemplate?: (target: {
    level: "topic" | "section" | "group" | "component";
    pageId: string;
    articleId?: string;
    blockId?: string;
  }) => void;
}

export default function PageEditorNavigation({
  courseId,
  leftPanelOpen,
  onClosePanels,
  onOpenPanels,
  menuPageCreated,
  menuSelected,
  contentPages,
  selectedPageId,
  selectedSubPageId,
  selectedArticleId,
  selectedBlockId,
  selectedComponentId,
  onMenuSelect,
  onPageSelect,
  onSubPageSelect,
  onArticleSelect,
  onBlockSelect,
  onComponentSelect,
  onAddPage,
  onDeletePage,
  onAddArticle,
  onDeleteArticle,
  onAddSubPage,
  onAddBlock,
  onDeleteBlock,
  onAddComponent,
  onDeleteComponent,
  onUseTemplate,
}: PageEditorNavigationProps) {
  const navigate = useNavigate();

  return (
    <>
      {leftPanelOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={onClosePanels}
          aria-hidden="true"
        />
      )}

      {leftPanelOpen && (
        <div className="flex md:relative fixed inset-y-0 left-0 z-40 md:z-auto h-full md:h-auto shrink-0">
          <CourseOutlinePanel
            courseId={courseId}
            onClose={onClosePanels}
            menuPageCreated={menuPageCreated}
            menuSelected={menuSelected}
            onMenuSelect={onMenuSelect}
            contentPages={contentPages}
            selectedPageId={selectedPageId}
            selectedSubPageId={selectedSubPageId}
            selectedArticleId={selectedArticleId}
            selectedBlockId={selectedBlockId}
            selectedComponentId={selectedComponentId}
            onPageSelect={onPageSelect}
            onSubPageSelect={onSubPageSelect}
            onArticleSelect={onArticleSelect}
            onBlockSelect={onBlockSelect}
            onComponentSelect={onComponentSelect}
            onAddPage={onAddPage}
            onDeletePage={onDeletePage}
            onAddArticle={onAddArticle}
            onDeleteArticle={onDeleteArticle}
            onAddSubPage={onAddSubPage}
            onAddBlock={onAddBlock}
            onDeleteBlock={onDeleteBlock}
            onAddComponent={onAddComponent}
            onDeleteComponent={onDeleteComponent}
            onUseTemplate={onUseTemplate}
          />
        </div>
      )}

      {!leftPanelOpen && (
        <aside className="hidden md:flex h-full w-[56px] bg-white border-r border-[#d8dee6] shrink-0 flex-col items-center py-3">
          <div className="w-full flex flex-col items-center pb-3 border-b border-[#d8dee6]">
            <button
              type="button"
              onClick={onOpenPanels}
              className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#5f6d79] hover:bg-[#f1f5f9] transition-colors"
              aria-label="Expand structure"
              title="Expand structure"
            >
              <MaskIcon file="chevron-right.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
            </button>
          </div>

          <div className="mt-auto">
            <button
              type="button"
onClick={() => {
  navigate(`/course/${courseId}/setup`);
}}
              className="w-8 h-8 rounded-[6px] flex items-center justify-center bg-[var(--life-primary-500)] text-[var(--life-base-white)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] transition-colors"
              aria-label="Course Config"
              title="Course Config"
            >
              <MaskIcon file="back-icon.svg" className="block w-[13px] h-[13px] shrink-0 bg-current" />
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
