// "Publish Course" dialog — confirm → building → result, triggered from the
// Publish ▾ dropdown ("Publish Course" item). Mirrors the visual language and
// confirm/running/result shape already used for ExportDialog/GenerateDialog
// (components/storyboard/GenerateDialog.tsx), styled to match the rest of the
// Course Settings surface (SetupPage.tsx's ExportDialog uses the same overlay/
// panel classes).
//
// The actual build+zip work is the EXISTING legacy `/download/:tenant/:course`
// route (routes/download/index.js), which already runs `plugin.publish(...,
// Constants.Modes.Publish, ...)` and returns `{ success, zipName }` — this
// dialog is a thin, parent-driven state machine around that one call plus the
// existing `/download/:tenant/:course/:title/download.zip` file route.

import { useEffect } from "react";

export type PublishCoursePhase = "confirm" | "running" | "success" | "error";

export default function PublishCourseDialog({
  phase,
  courseTitle,
  zipName,
  downloadUrl,
  errorMessage,
  onConfirm,
  onClose,
}: {
  phase: PublishCoursePhase;
  courseTitle: string;
  zipName?: string;
  downloadUrl?: string;
  errorMessage?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const running = phase === "running";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !running) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, running]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onMouseDown={running ? undefined : onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#e5e7eb] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Publish course"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f6] shrink-0">
          <h3 className="text-base font-semibold text-[#111827]">Publish Course</h3>
          {!running && (
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] transition-colors" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="px-5 py-6">
          {phase === "confirm" && (
            <>
              <p className="text-sm text-[#374151] leading-relaxed">
                This will build and package <span className="font-semibold">{courseTitle}</span> for LMS / CDN deployment.
                Depending on the course size, this can take a minute or two.
              </p>
            </>
          )}

          {phase === "running" && (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <svg className="animate-spin text-[#2d6fa8]" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <p className="text-sm font-medium text-[#374151]">Publishing course…</p>
              <p className="text-xs text-[#9ca3af] max-w-xs">Building the course package. This can take a minute or two for larger courses.</p>
            </div>
          )}

          {phase === "success" && (
            <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
              <span className="w-12 h-12 rounded-full bg-[var(--life-positive-050)] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--life-positive-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <p className="text-sm font-semibold text-[#111827]">Course published successfully</p>
              {zipName && <p className="text-xs text-[#6b7280]">{zipName}.zip</p>}
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2E7FA1] hover:bg-[#266580] rounded-lg transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Package
                </a>
              )}
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
              <span className="w-12 h-12 rounded-full bg-[var(--life-critical-050)] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--life-critical-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <p className="text-sm font-semibold text-[#111827]">Publish failed</p>
              <p className="text-xs text-[#6b7280] max-w-xs">{errorMessage || "Something went wrong while publishing the course. Please try again."}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#f3f4f6] bg-[#f9fafb]">
          {phase === "confirm" && (
            <>
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f3f4f6] transition-colors">
                Cancel
              </button>
              <button type="button" onClick={onConfirm} className="px-4 py-2 text-sm font-semibold text-white bg-[#2E7FA1] hover:bg-[#266580] rounded-lg transition-colors">
                Publish
              </button>
            </>
          )}
          {phase === "running" && (
            <button type="button" disabled className="px-4 py-2 text-sm font-medium text-[#9ca3af] bg-white border border-[#e5e7eb] rounded-lg cursor-not-allowed">
              Publishing…
            </button>
          )}
          {phase === "success" && (
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-white bg-[#2E7FA1] hover:bg-[#266580] rounded-lg transition-colors">
              Done
            </button>
          )}
          {phase === "error" && (
            <>
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f3f4f6] transition-colors">
                Close
              </button>
              <button type="button" onClick={onConfirm} className="px-4 py-2 text-sm font-semibold text-white bg-[#2E7FA1] hover:bg-[#266580] rounded-lg transition-colors">
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
