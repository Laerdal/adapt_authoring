interface PageEditorTopBarProps {
  courseTitle: string;
  onCourseTitleChange: (title: string) => void;
  onToggleLeftPanel: () => void;
  onBack: () => void;
  onSave: () => void;
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
  onSave,
  isSaving = false,
  isSaveDisabled = false,
}: PageEditorTopBarProps) {
  return (
    <header className="h-[56px] bg-white border-b border-[#d8dde6] flex items-center shrink-0 px-4 md:px-6 gap-3 relative z-10">
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
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

        <div className="flex items-center gap-2 mr-2 shrink-0">
          <img
            src="/adapt-logo.jpeg"
            alt="Adapt logo"
            width={34}
            height={34}
            className="rounded-lg shrink-0"
          />
          <span className="font-semibold text-[#1f2937] text-[15px] tracking-tight hidden lg:block">Adapt Studio</span>
        </div>

        <div className="hidden lg:block w-px h-5 bg-[#d8dde6]" />

        <input
          value={courseTitle}
          onChange={(e) => onCourseTitleChange(e.target.value)}
          className="text-[15px] font-bold text-[#1a1a1a] bg-transparent border-none outline-none focus:ring-0 min-w-0 w-32 sm:w-48 md:w-72 truncate"
          aria-label="Course title"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold text-[#4b5563] border border-transparent rounded-[8px] hover:bg-[#f3f4f6] hover:text-[#111827] transition-colors cursor-pointer"
        >
          <HeaderMaskIcon file="back-icon.svg" />
          <span className="hidden md:inline">Back</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold border-2 border-[var(--life-neutral-200)] text-[var(--life-base-black)] rounded-[8px] bg-white hover:border-[var(--life-primary-700)] hover:text-[var(--life-primary-700)] active:border-[var(--life-primary-800)] active:text-[var(--life-primary-800)] transition-colors cursor-pointer"
        >
          <HeaderMaskIcon file="preview-icon.svg" />
          <span className="hidden lg:inline">Preview</span>
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaveDisabled || isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold border-2 border-[var(--life-neutral-200)] bg-white text-[var(--life-base-black)] rounded-[8px] hover:border-[var(--life-primary-700)] hover:text-[var(--life-primary-700)] active:border-[var(--life-primary-800)] active:text-[var(--life-primary-800)] transition-colors cursor-pointer"
        >
          <HeaderMaskIcon file="save-icon.svg" />
          <span className="hidden lg:inline">{isSaving ? "Saving..." : "Save"}</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold rounded-[8px] transition-colors active:bg-[var(--life-primary-800)] cursor-pointer bg-[var(--life-primary-500)] text-[var(--life-base-white)] hover:bg-[var(--life-primary-700)]"
        >
          <HeaderMaskIcon file="publish-icon.svg" />
          <span className="hidden lg:inline">Publish</span>
        </button>
      </div>
    </header>
  );
}
