import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import CommonCourseTopBarRow from "../components/course/CommonCourseTopBarRow";
import { ensureCoursePreview, ensurePreviewEditEnabledForCourse, getCourseBootstrapData, seedMissingCourseDefaults } from "../api/adaptAuthoring";
import { useAuth } from "../context/AuthContext";
import { UnsavedChangesModal } from "./setup/unsavedChangesModal";
import { getCourseBootstrapData, seedMissingCourseDefaults, ensureCoursePreview, publishCoursePackage } from "../api/adaptAuthoring";
import { useAuth } from "../context/AuthContext";
import ExportDialog from "../components/common/ExportDialog";
import PublishMenuButton from "../components/publish/PublishMenuButton";
import PublishCourseDialog, { type PublishCoursePhase } from "../components/publish/PublishCourseDialog";

type DeviceMode = "desktop" | "tablet" | "mobile";
type QuickEditGuardMode = "leave-preview" | "course-navigation";

const deviceButtonBase = "h-full w-9 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer";
const ICON_BASE = "/new/assets/icons";

function MaskIcon({ file, className }: { file: string; className?: string }) {
  const iconPath = `${ICON_BASE}/${file}`;
  return (
    <span
      aria-hidden="true"
      className={className ?? "block w-[18px] h-[18px] shrink-0 bg-current"}
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

export default function CoursePreviewPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [courseTitle, setCourseTitle] = useState("Untitled Course");
  const [courseDescription, setCourseDescription] = useState("");
  const [themeName, setThemeName] = useState("");
  const [menuName, setMenuName] = useState("");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [fullscreen, setFullscreen] = useState(false);
  const [quickEditEnabled, setQuickEditEnabled] = useState(false);
  const [quickEditDirty, setQuickEditDirty] = useState(false);
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditAvailable, setQuickEditAvailable] = useState(false);
  const [currentPreviewPageId, setCurrentPreviewPageId] = useState<string | null>(null);
  const [fullscreenPageId, setFullscreenPageId] = useState<string | null>(null);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenFrameRef = useRef<HTMLIFrameElement | null>(null);
  const pendingGuardedActionRef = useRef<(() => void) | null>(null);
  const runPendingActionAfterSaveRef = useRef(false);
  const pendingGuardModeRef = useRef<QuickEditGuardMode | null>(null);
  // Track when the one-shot defaults seed has resolved so the iframe waits for
  // the possibly-issued PUT to complete before the framework loads course.json.
  const [defaultsReady, setDefaultsReady] = useState(false);
  const [previewState, setPreviewState] = useState<"preparing" | "ready" | "error">("preparing");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [publishDialogPhase, setPublishDialogPhase] = useState<PublishCoursePhase | null>(null);
  const [publishResult, setPublishResult] = useState<{ zipName?: string; downloadUrl?: string; message?: string }>({});

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await getCourseBootstrapData(id);
        if (cancelled) return;
        setCourseTitle(data.displayTitle || data.title || "Untitled Course");
        setCourseDescription(data.description || "");
        setThemeName(data.themeName || "");
        setMenuName(data.menuName || "");
      } catch {
        if (cancelled) return;
        setCourseTitle("Untitled Course");
        setCourseDescription("");
        setThemeName("");
        setMenuName("");
      }
    })();

    // Heal older courses (or courses freshly created via the minimal
    // POST /api/courses flow) whose top-level fields the Adapt runtime
    // dereferences — `_buttons`, `_globals`, `themeVariables._components`, … —
    // are absent or empty. Idempotent + non-blocking on failure.
    (async () => {
      try {
        await seedMissingCourseDefaults(id);
      } catch {
        /* seeding is best-effort */
      } finally {
        if (!cancelled) setDefaultsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Ensure a render shell exists before loading the preview. On a never-built course
  // this builds the shell once (matching its current fingerprint); otherwise it is an
  // instant cache hit. Prevents the blank/"unavailable" state on first preview.
  useEffect(() => {
    const tenantId = user?._tenantId;
    if (!id || !tenantId || !defaultsReady) return;
    let cancelled = false;
    setPreviewState("preparing");
    (async () => {
      try {
        await ensurePreviewEditEnabledForCourse(id);
        if (cancelled) return;
        const result = await ensureCoursePreview(tenantId, id);
        if (!cancelled) setPreviewState(result?.success ? "ready" : "error");
      } catch {
        if (!cancelled) setPreviewState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultsReady, id, user?._tenantId]);

  const pageId = (params.get("pageId") || "").trim();

  const previewUrl = useMemo(() => {
    if (!id || !user?._tenantId || !defaultsReady || previewState !== "ready") return "";
    const baseUrl = `/studio/${user._tenantId}/${id}/?embedded=1`;
    return pageId
      ? `${baseUrl}&_cs=${Date.now()}#/id/${pageId}`
      : `${baseUrl}&_cs=${Date.now()}`;
  }, [id, pageId, user?._tenantId, defaultsReady, previewState]);

  const fullscreenPreviewUrl = useMemo(() => {
    if (!previewUrl || !fullscreenPageId) return previewUrl;
    return `${previewUrl.split("#")[0]}#/id/${fullscreenPageId}`;
  }, [fullscreenPageId, previewUrl]);

  const frameSizeClass = useMemo(() => {
    if (deviceMode === "mobile") return "w-[390px]";
    if (deviceMode === "tablet") return "w-[820px]";
    return "w-full";
  }, [deviceMode]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const activePageId =
        getFramePageId(fullscreenFrameRef.current) ?? currentPreviewPageId;
      if (activePageId) {
        sendPreviewEditCommand("adapt-preview-edit:navigate-to-page", activePageId);
      }
      setFullscreenPageId(null);
      setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const sendPreviewEditCommand = (type: string, pageId?: string | null) => {
    previewFrameRef.current?.contentWindow?.postMessage({ type, pageId }, window.location.origin);
  };

  const getFramePageId = (frame: HTMLIFrameElement | null) => {
    try {
      const match = frame?.contentWindow?.location.hash.match(/^#\/id\/([^/?]+)/);
      return match?.[1] ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent<{ type?: string; canEditText?: boolean; pageId?: string | null }>) => {
      const isNormalPreview = event.source === previewFrameRef.current?.contentWindow;
      const isFullscreenPreview = event.source === fullscreenFrameRef.current?.contentWindow;
      if (event.origin !== window.location.origin || (!isNormalPreview && !isFullscreenPreview)) return;
      switch (event.data?.type) {
        case "adapt-preview-edit:text-only-route":
          if (isNormalPreview) setQuickEditAvailable(event.data.canEditText === true);
          setCurrentPreviewPageId(event.data.canEditText ? event.data.pageId ?? null : null);
          break;
        case "adapt-preview-edit:text-only-dirty":
          setQuickEditDirty(true);
          break;
        case "adapt-preview-edit:text-only-saved":
          setQuickEditDirty(false);
          setQuickEditSaving(false);
          if (runPendingActionAfterSaveRef.current) {
            runPendingActionAfterSaveRef.current = false;
            setQuickEditEnabled(false);
            setShowUnsavedChangesModal(false);
            const action = pendingGuardedActionRef.current;
            pendingGuardedActionRef.current = null;
            pendingGuardModeRef.current = null;
            action?.();
          }
          break;
        case "adapt-preview-edit:text-only-save-failed":
          setQuickEditSaving(false);
          runPendingActionAfterSaveRef.current = false;
          break;
        case "adapt-preview-edit:text-only-disabled":
          setQuickEditEnabled(false);
          setQuickEditDirty(false);
          setQuickEditSaving(false);
          break;
        case "adapt-preview-edit:text-only-navigation-blocked":
          pendingGuardedActionRef.current = () => {
            sendPreviewEditCommand("adapt-preview-edit:text-only-continue-navigation");
          };
          pendingGuardModeRef.current = "course-navigation";
          setShowUnsavedChangesModal(true);
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!previewUrl || quickEditAvailable) return;
    let attempts = 0;
    let retryId: number | undefined;

    const requestRouteState = () => {
      sendPreviewEditCommand("adapt-preview-edit:text-only-route-request");
      attempts += 1;
      if (attempts < 10) {
        retryId = window.setTimeout(requestRouteState, 500);
      }
    };

    requestRouteState();
    return () => {
      if (retryId !== undefined) window.clearTimeout(retryId);
    };
  }, [previewUrl, quickEditAvailable]);

  const startQuickEdit = () => {
    if (!quickEditAvailable) return;
    setQuickEditEnabled(true);
    setQuickEditDirty(false);
    sendPreviewEditCommand("adapt-preview-edit:text-only-enable");
  };

  const saveQuickEdit = () => {
    if (!quickEditDirty || quickEditSaving) return;
    setQuickEditSaving(true);
    sendPreviewEditCommand("adapt-preview-edit:text-only-save");
  };

  const runPendingGuardedAction = () => {
    const action = pendingGuardedActionRef.current;
    pendingGuardedActionRef.current = null;
    pendingGuardModeRef.current = null;
    setShowUnsavedChangesModal(false);
    action?.();
  };

  const runWithQuickEditGuard = (action: () => void) => {
    if (quickEditEnabled && quickEditDirty) {
      pendingGuardedActionRef.current = action;
      pendingGuardModeRef.current = "leave-preview";
      setShowUnsavedChangesModal(true);
      return;
    }
    if (quickEditEnabled) {
      setQuickEditEnabled(false);
      sendPreviewEditCommand("adapt-preview-edit:text-only-disable");
    }
    action();
  };

  const saveAndRunPendingAction = () => {
    if (!pendingGuardedActionRef.current || quickEditSaving) return;
    runPendingActionAfterSaveRef.current = true;
    saveQuickEdit();
  };

  const discardAndRunPendingAction = () => {
    runPendingActionAfterSaveRef.current = false;
    setQuickEditEnabled(false);
    if (pendingGuardModeRef.current !== "course-navigation") {
      sendPreviewEditCommand("adapt-preview-edit:text-only-discard");
    }
    setQuickEditDirty(false);
    runPendingGuardedAction();
  };

  const cancelGuardedAction = () => {
    runPendingActionAfterSaveRef.current = false;
    pendingGuardedActionRef.current = null;
    pendingGuardModeRef.current = null;
    setShowUnsavedChangesModal(false);
  };

  const finishQuickEdit = () => {
    if (quickEditDirty) {
      pendingGuardedActionRef.current = () => {
        sendPreviewEditCommand("adapt-preview-edit:text-only-disable");
        setQuickEditEnabled(false);
      };
      pendingGuardModeRef.current = "leave-preview";
      setShowUnsavedChangesModal(true);
      return;
    }
    setQuickEditEnabled(false);
    sendPreviewEditCommand("adapt-preview-edit:text-only-disable");
  };
  function openPublishDialog() {
    setPublishResult({});
    setPublishDialogPhase("confirm");
  }

  function closePublishDialog() {
    setPublishDialogPhase(null);
  }

  async function handleConfirmPublish() {
    const tenantId = user?._tenantId;
    if (!id || !tenantId) {
      setPublishResult({ message: "No course or tenant context available." });
      setPublishDialogPhase("error");
      return;
    }
    setPublishDialogPhase("running");
    try {
      const result = await publishCoursePackage(tenantId, id);
      if (result.success) {
        setPublishResult({ zipName: result.zipName, downloadUrl: result.downloadUrl });
        setPublishDialogPhase("success");
      } else {
        setPublishResult({ message: result.message });
        setPublishDialogPhase("error");
      }
    } catch (err) {
      setPublishResult({ message: err instanceof Error ? err.message : "Publish failed." });
      setPublishDialogPhase("error");
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] overflow-hidden">
      <CommonCourseTopBarRow
        courseTitle={courseTitle}
        loginName={user?.username || user?.email || "Not signed in"}
        activeNav="preview"
        onBack={() => runWithQuickEditGuard(() => window.history.length > 1 ? navigate(-1) : navigate("/"))}
        onHome={() => runWithQuickEditGuard(() => navigate("/"))}
        onOpenCourseSettings={() => runWithQuickEditGuard(() => navigate(`/course/${id}/setup`))}
        onOpenStoryboard={() => runWithQuickEditGuard(() => navigate(`/course/${id}/setup?panel=storyboarding`))}
        onOpenEditor={() => runWithQuickEditGuard(() => navigate(`/course/${id}`, { state: { title: courseTitle, description: courseDescription, theme: themeName, menu: menuName, pageId: currentPreviewPageId ?? (pageId || undefined) } }))}
        onOpenPreview={() => undefined}
        previewDisabled={!id || !user?._tenantId}
        previewMode="button"
      />

      <div className="h-[56px] bg-white border-b border-[#d8dde6] flex items-center px-4 md:px-6 shrink-0">
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 inline-flex items-center gap-1 p-[2px] rounded-[8px] border border-[#d8dde6] bg-[#f3f6f9]">
            {(["desktop", "tablet", "mobile"] as const).map((mode) => {
              const active = mode === deviceMode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDeviceMode(mode)}
                  disabled={quickEditEnabled}
                  aria-label={`Switch to ${mode} preview`}
                  title={quickEditEnabled ? "Preview size is locked during Quick Edit" : `Switch to ${mode} preview`}
                  className={`${deviceButtonBase} ${active ? "bg-[var(--life-primary-500)] text-white" : "text-[#1f2937] hover:bg-white active:bg-[var(--life-primary-100)]"} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                >
                  <MaskIcon file={`${mode}-icon.svg`} className="block w-4 h-4 shrink-0 bg-current" />
                </button>
              );
            })}
          </div>

          {!quickEditEnabled ? (
            <button
              type="button"
              onClick={startQuickEdit}
              disabled={!quickEditAvailable}
              title={quickEditAvailable ? "Edit text on this page" : "Open a course page to edit text"}
              className="h-9 px-4 rounded-[8px] border border-[#d8dde6] bg-white text-[#111827] text-[13px] font-bold hover:bg-[var(--life-neutral-020)] hover:border-[#c4cfda] active:bg-[var(--life-neutral-100)] transition-colors cursor-pointer inline-flex items-center disabled:bg-[#e5e7eb] disabled:text-[#9ca3af] disabled:cursor-not-allowed disabled:hover:bg-[#e5e7eb] disabled:hover:border-[#d8dde6]"
            >
              Quick Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={saveQuickEdit}
                disabled={!quickEditDirty || quickEditSaving}
                className="h-9 px-4 rounded-[8px] bg-[var(--life-primary-500)] text-white text-[13px] font-bold hover:bg-[var(--life-primary-700)] transition-colors cursor-pointer inline-flex items-center disabled:bg-[#e5e7eb] disabled:text-[#9ca3af] disabled:cursor-not-allowed"
              >
                {quickEditSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={finishQuickEdit}
                className="h-9 px-4 rounded-[8px] border border-[#d8dde6] bg-white text-[#374151] text-[13px] font-bold hover:bg-[var(--life-neutral-020)] hover:border-[#c4cfda] transition-colors cursor-pointer inline-flex items-center"
              >
                Done Editing
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate(`/course/${id}`, { state: { title: courseTitle, description: courseDescription, theme: themeName, menu: menuName } })}
            className="h-9 px-4 rounded-[8px] border border-[#d8dde6] bg-white text-[#111827] text-[13px] font-bold hover:bg-[var(--life-neutral-020)] hover:border-[#c4cfda] active:bg-[var(--life-neutral-100)] transition-colors cursor-pointer inline-flex items-center"
          >
            Quick Edit
          </button>

          <button
            type="button"
            onClick={() => setShowExportDialog(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-bold bg-transparent text-[var(--life-base-black)] rounded-[8px] hover:bg-[var(--life-primary-050)] hover:text-[var(--life-primary-700)] active:bg-[var(--life-primary-100)] active:text-[var(--life-primary-800)] transition-colors cursor-pointer"
          >
            <MaskIcon file="export-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
            Export
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <PublishMenuButton
            onSelectPreflight={() => navigate(`/course/${id}/setup?panel=publish`)}
            onSelectPublish={openPublishDialog}
          />
        </div>
      </div>

      <main className="flex-1 overflow-auto bg-[#e9edf2] p-2">
        {!previewUrl ? (
          // Four distinct states share the empty-preview slot:
          //   1. "unavailable"  — no `id` in the URL, no tenant on the user, or the
          //      Studio render-shell build failed (`previewState === "error"`).
          //      Nothing to preview, and no amount of waiting will make it appear.
          //   2. "preparing"    — id + tenant are known but `defaultsReady` is still
          //      false while `seedMissingCourseDefaults` runs, or the Studio shell is
          //      still building on a cache miss. Showing "unavailable" here would
          //      mis-communicate a transient state.
          //   3. (implicit)     — once both flip ready, `previewUrl` is built and the
          //      iframe branch below renders instead.
          <div className="h-full flex items-center justify-center text-sm text-[#6b7280]">
            {(!id || !user?._tenantId || previewState === "error")
              ? "Preview is unavailable for this course."
              : "Preparing preview…"}
          </div>
        ) : (
          <div className="relative h-full w-full flex justify-center">
            <div className={`${frameSizeClass} h-full bg-white rounded-[10px] overflow-hidden shadow-[0_8px_30px_rgba(15,41,52,0.14)]`}>
              <iframe
                ref={previewFrameRef}
                title="Course Preview"
                src={previewUrl}
                onLoad={() => {
                  setQuickEditAvailable(false);
                  setCurrentPreviewPageId(null);
                  sendPreviewEditCommand("adapt-preview-edit:text-only-available");
                  sendPreviewEditCommand("adapt-preview-edit:text-only-route-request");
                  if (quickEditEnabled) sendPreviewEditCommand("adapt-preview-edit:text-only-enable");
                }}
                className="w-full h-full border-0"
              />
            </div>
            <button
              type="button"
              disabled={quickEditEnabled}
              onClick={() => {
                if (quickEditEnabled) return;
                setFullscreenPageId(
                  getFramePageId(previewFrameRef.current) ?? currentPreviewPageId
                );
                setFullscreen(true);
              }}
              aria-label="Open fullscreen preview"
              title={quickEditEnabled ? "Fullscreen is disabled during Quick Edit" : "Open fullscreen"}
              className="absolute right-0 top-0 z-10 -translate-y-[32%] translate-x-[10%] p-1.5 rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] shadow-sm hover:text-[#2d6fa8] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-[#6b7280]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        )}
      </main>

      {fullscreen && previewUrl && (
        <div className="fixed inset-0 z-50 bg-white">
          <iframe
            ref={fullscreenFrameRef}
            title="Fullscreen Course Preview"
            src={fullscreenPreviewUrl}
            className="block h-full w-full border-0"
          />
          <button
            type="button"
            onClick={() => {
              const activePageId =
                getFramePageId(fullscreenFrameRef.current) ?? currentPreviewPageId;
              if (activePageId) {
                sendPreviewEditCommand(
                  "adapt-preview-edit:navigate-to-page",
                  activePageId
                );
              }
              setFullscreenPageId(null);
              setFullscreen(false);
            }}
            aria-label="Close fullscreen preview"
            title="Close fullscreen"
            className="absolute right-0 top-0 z-10 p-1 rounded-md border border-[#e5e7eb] bg-white/95 text-[#4b5563] shadow-md hover:bg-white hover:text-[#111827] transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <UnsavedChangesModal
        isOpen={showUnsavedChangesModal}
        isSaving={quickEditSaving}
        onDiscard={discardAndRunPendingAction}
        onSave={saveAndRunPendingAction}
        onClose={cancelGuardedAction}
        title="Unsaved Quick Edit Changes"
        message="Save your Quick Edit changes before leaving Preview?"
        discardLabel="Discard"
        saveLabel="Save"
      />
      {showExportDialog && <ExportDialog onClose={() => setShowExportDialog(false)} />}

      {publishDialogPhase && (
        <PublishCourseDialog
          phase={publishDialogPhase}
          courseTitle={courseTitle}
          zipName={publishResult.zipName}
          downloadUrl={publishResult.downloadUrl}
          errorMessage={publishResult.message}
          onConfirm={() => void handleConfirmPublish()}
          onClose={closePublishDialog}
        />
      )}
    </div>
  );
}
