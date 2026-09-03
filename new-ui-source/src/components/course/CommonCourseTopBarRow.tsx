import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { canManageCourses, useAuth } from "@/context/AuthContext";

type PrimaryTopNav = "settings" | "storyboard" | "editor";
type TopBarNav = PrimaryTopNav | "preview";
type PreviewButtonMode = "menu" | "button";

interface CommonCourseTopBarRowProps {
  courseTitle: ReactNode;
  loginName: string;
  activeNav: TopBarNav;
  onBack: () => void;
  onHome: () => void;
  onOpenCourseSettings: () => void;
  onOpenStoryboard: () => void;
  onOpenEditor: () => void;
  onOpenPreview?: (startFromCurrentPage: boolean) => void;
  previewDisabled?: boolean;
  editorDisabled?: boolean;
  previewMode?: PreviewButtonMode;
  leadingSlot?: ReactNode;
  trailingActions?: ReactNode;
  className?: string;
}

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

function navButtonClass(active: boolean) {
  if (active) {
    return "inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold rounded-[8px] transition-colors cursor-pointer bg-[var(--life-primary-100)] text-[var(--life-primary-700)] hover:bg-[var(--life-primary-100)]";
  }

  return "inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold text-[var(--life-base-black)] rounded-[8px] bg-transparent hover:bg-[var(--life-primary-050)] hover:text-[var(--life-primary-700)] active:bg-[var(--life-primary-100)] active:text-[var(--life-primary-800)] transition-colors cursor-pointer";
}

function previewButtonClass(active: boolean) {
  return navButtonClass(active);
}

export default function CommonCourseTopBarRow({
  courseTitle,
  loginName,
  activeNav,
  onBack,
  onHome,
  onOpenCourseSettings,
  onOpenStoryboard,
  onOpenEditor,
  onOpenPreview,
  previewDisabled = false,
  editorDisabled = false,
  previewMode = "menu",
  leadingSlot,
  trailingActions,
  className,
}: CommonCourseTopBarRowProps) {
  const [previewMenuOpen, setPreviewMenuOpen] = useState(false);
  const previewMenuRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const canOpenCourseSettings = canManageCourses(user);

  useEffect(() => {
    if (!previewMenuOpen || previewMode !== "menu") return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (previewMenuRef.current?.contains(target)) return;
      setPreviewMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [previewMenuOpen, previewMode]);

  return (
    <header className={className ?? "h-[64px] bg-white border-b border-[#d8dde6] flex items-center shrink-0 px-4 md:px-6 gap-3 relative z-20"}>
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        {leadingSlot}
        <button
          type="button"
          onClick={onHome}
          aria-label="Go to course dashboard"
          title="Course dashboard"
          className="shrink-0 rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--life-primary-500)]"
        >
          <img src="/adapt-logo.jpeg" alt="Adapt Studio" width={34} height={34} className="rounded-lg" />
        </button>
        <div className="min-w-0 flex items-center gap-3">
          <p className="text-[15px] leading-none font-semibold text-[#1f2937] tracking-tight hidden lg:block">Adapt Studio</p>
          <div className="hidden lg:block w-px h-5 bg-[#d8dde6]" />
          <div className="text-[15px] font-[700] text-[#1a1a1a] truncate max-w-[320px]">{courseTitle}</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold text-[#4b5563] rounded-[8px] bg-transparent hover:bg-[var(--life-neutral-050)] hover:text-[#111827] active:bg-[var(--life-neutral-100)] transition-colors cursor-pointer"
        >
          <MaskIcon file="back-icon.svg" />
          <span className="hidden md:inline">Back</span>
        </button>

        <div className="w-px h-8 bg-[#d8dde6] mx-1" />

        {canOpenCourseSettings && (
          <button
            type="button"
            onClick={onOpenCourseSettings}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold rounded-[8px] transition-colors cursor-pointer ${
              activeNav === "settings"
                ? "bg-[var(--life-primary-100)] text-[var(--life-primary-700)] hover:bg-[var(--life-primary-100)]"
                : "bg-transparent text-[var(--life-base-black)] hover:bg-[var(--life-primary-050)] hover:text-[var(--life-primary-700)] active:bg-[var(--life-primary-100)] active:text-[var(--life-primary-800)]"
            }`}
          >
            <MaskIcon file="setting-icon.svg" />
            <span className="hidden md:inline">Course Settings</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenStoryboard}
          className={navButtonClass(activeNav === "storyboard")}
        >
          <MaskIcon file="storyboard-icon.svg" />
          <span className="hidden lg:inline">Storyboard</span>
        </button>

        <button
          type="button"
          disabled={editorDisabled}
          onClick={onOpenEditor}
          className={`${navButtonClass(activeNav === "editor")} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <MaskIcon file="component-icon.svg" />
          <span className="hidden lg:inline">Editor</span>
        </button>

        <div ref={previewMenuRef} className="relative">
          {previewMode === "menu" ? (
            <>
              <button
                type="button"
                onClick={() => setPreviewMenuOpen((open) => !open)}
                disabled={previewDisabled}
                className={`${previewButtonClass(activeNav === "preview")} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <MaskIcon file="preview-icon.svg" />
                <span className="hidden lg:inline">Preview</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${previewMenuOpen ? "rotate-180" : ""}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {previewMenuOpen ? (
                <div className="absolute right-0 mt-2 w-[270px] rounded-[12px] border border-[#d8dde6] bg-white shadow-[0_8px_24px_rgba(2,32,51,0.14)] p-2 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenPreview?.(false);
                      setPreviewMenuOpen(false);
                    }}
                    className="w-full px-3 py-3 rounded-[8px] text-left text-[15px] text-[#1f2937] hover:bg-[var(--life-primary-020)] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <MaskIcon file="chevron-right.svg" />
                    <span>Start from Beginning</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenPreview?.(true);
                      setPreviewMenuOpen(false);
                    }}
                    className="w-full px-3 py-3 rounded-[8px] text-left text-[15px] text-[#1f2937] hover:bg-[var(--life-primary-020)] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <MaskIcon file="chevron-right.svg" />
                    <span>Start from Current Page</span>
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={() => onOpenPreview?.(false)}
              disabled={previewDisabled}
              className={`${previewButtonClass(activeNav === "preview")} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <MaskIcon file="preview-icon.svg" />
              <span className="hidden lg:inline">Preview</span>
            </button>
          )}
        </div>

        {trailingActions}

        <div className="hidden xl:flex items-center pl-3 border-l border-[#d8dde6]">
          <span className="max-w-[260px] truncate text-[13px] font-medium text-[#9ca3af] select-none">{loginName}</span>
        </div>
      </div>
    </header>
  );
}
