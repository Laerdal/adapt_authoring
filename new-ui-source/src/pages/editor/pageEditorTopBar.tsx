import CommonCourseTopBarRow from "../../components/course/CommonCourseTopBarRow";

interface PageEditorTopBarProps {
  courseTitle: string;
  onCourseTitleChange: (title: string) => void;
  onToggleLeftPanel: () => void;
  onBack: () => void;
  onHome: () => void;
  onSave: () => void;
  onPublish: () => void;
  onOpenCourseSettings: () => void;
  onOpenStoryboard: () => void;
  onOpenPreview: (startFromCurrentPage: boolean) => void;
  loginName: string;
  previewDisabled?: boolean;
  isSaving?: boolean;
  isSaveDisabled?: boolean;
}

const ICON_BASE = "/new/assets/icons";

function HeaderMaskIcon({ file, className }: { file: string; className?: string }) {
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

export default function PageEditorTopBar({
  courseTitle,
  onCourseTitleChange,
  onToggleLeftPanel,
  onBack,
  onHome,
  onSave,
  onPublish,
  onOpenCourseSettings,
  onOpenStoryboard,
  onOpenPreview,
  loginName,
  previewDisabled = false,
  isSaving = false,
  isSaveDisabled = false,
}: PageEditorTopBarProps) {
  const leadingSlot = (
    <button
      type="button"
      aria-label="Open course outline"
      onClick={onToggleLeftPanel}
      className="md:hidden p-2 rounded-lg text-[#474747] hover:bg-[#F2F2F2] transition-colors shrink-0"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );

  const trailingActions = (
    <div className="ml-auto flex items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={isSaveDisabled || isSaving}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold bg-transparent text-[var(--life-base-black)] rounded-[8px] hover:bg-[var(--life-primary-050)] hover:text-[var(--life-primary-700)] active:bg-[var(--life-primary-100)] active:text-[var(--life-primary-800)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <HeaderMaskIcon file="save-icon.svg" />
        <span className="hidden lg:inline">{isSaving ? "Saving..." : "Save"}</span>
      </button>

      <button
        type="button"
        onClick={onPublish}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold rounded-[8px] transition-colors active:bg-[var(--life-primary-800)] cursor-pointer bg-[var(--life-primary-500)] text-[var(--life-base-white)] hover:bg-[var(--life-primary-700)]"
      >
        <HeaderMaskIcon file="publish-icon.svg" />
        <span className="hidden lg:inline">Publish</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col shrink-0">
      <CommonCourseTopBarRow
        courseTitle={
          <input
            value={courseTitle}
            onChange={(e) => onCourseTitleChange(e.target.value)}
            className="text-[15px] font-bold text-[#1a1a1a] bg-transparent border-none outline-none focus:ring-0 min-w-0 w-32 sm:w-48 md:w-72 truncate"
            aria-label="Course title"
          />
        }
        loginName={loginName}
        activeNav="editor"
        onBack={onBack}
        onHome={onHome}
        onOpenCourseSettings={onOpenCourseSettings}
        onOpenStoryboard={onOpenStoryboard}
        onOpenEditor={() => undefined}
        onOpenPreview={onOpenPreview}
        previewDisabled={previewDisabled}
        leadingSlot={leadingSlot}
      />

      <div className="h-[56px] bg-white border-b border-[#d8dde6] flex items-center px-4 md:px-6 gap-3">
        <div className="flex items-center gap-2 text-[#111827] min-w-0">
          <HeaderMaskIcon file="component-icon.svg" className="block w-[16px] h-[16px] shrink-0 bg-current opacity-80" />
          <span className="text-base font-semibold truncate">Course Editor</span>
        </div>
        {trailingActions}
      </div>
    </div>
  );
}
