import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getCourseCstyle,
  getCourseTechnicalSettings,
  updateCourseCustomStyle,
  updateCourseTechnicalSettings,
  type CourseTechnicalSettings,
} from "../../api/adaptAuthoring";
import { UnsavedChangesModal } from "./UnsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";

const LOG_LEVEL_OPTIONS = ["debug", "info", "warn", "error", "fatal"];

function TsAccordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[var(--life-neutral-200)] rounded-lg overflow-hidden shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-[var(--life-neutral-020)] border-b border-[var(--life-neutral-200)] hover:bg-[var(--life-neutral-050)] transition-colors cursor-pointer"
      >
        <span className="text-sm font-semibold text-[#111827]">{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
      {open && <div className="px-[22px] py-[20px] bg-white flex flex-col gap-4">{children}</div>}
    </div>
  );
}

function TsDropdown({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const syncRect = useCallback(() => {
    if (!btnRef.current) return;
    setRect(btnRef.current.getBoundingClientRect());
  }, []);

  const handleOpen = () => {
    if (!open) syncRect();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    syncRect();
    window.addEventListener("resize", syncRect);
    window.addEventListener("scroll", syncRect, true);
    return () => {
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("scroll", syncRect, true);
    };
  }, [open, syncRect]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-[#374151]">{label}</label>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={handleOpen}
          className="w-full flex items-center justify-between px-3 py-2 border border-[#d1d5db] rounded-[8px] bg-white text-sm text-[#374151] hover:border-[#9ca3af] transition-colors cursor-pointer"
          style={{ borderRadius: 8 }}
        >
          <span>{value}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {open && rect && createPortal(
          <div
            ref={listRef}
            style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
            className="bg-white border border-[#e5e7eb] rounded-[8px] shadow-lg py-1 overflow-hidden max-h-64 overflow-y-auto"
            data-radius="8px"
          >
            {options.map((opt) => (
              <button
                key={opt} type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors cursor-pointer ${
                  value === opt ? "bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"
                }`}
              >
                {opt}
                {value === opt && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

function TsCheckbox({ id, label, description, checked, onChange }: { id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer select-none group">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-[#d1d5db] accent-[#2d6fa8] cursor-pointer"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-[#374151]">{label}</span>
        {description && <span className="text-[13px] text-[var(--life-neutral-300)]">{description}</span>}
      </div>
    </label>
  );
}

export function TechnicalSettingPage({
  courseId,
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
}: {
  courseId?: string;
  onNavigationRequest?: (nav: string) => void;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
}) {
  const logLevelMap: Record<string, string> = { debug: "debug", info: "info", warn: "warn", error: "error", fatal: "fatal" };
  const logLevelReverseMap: Record<string, string> = {
    info: "info",
    debug: "debug",
    warn: "warn",
    error: "error",
    fatal: "fatal",
    Info: "info",
    Debug: "debug",
    Warn: "warn",
    Error: "error",
    Fatal: "fatal",
  };

  const [isLoading, setIsLoading] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [smallBp, setSmallBp] = useState<number>(0);
  const [mediumBp, setMediumBp] = useState<number>(720);
  const [largeBp, setLargeBp] = useState<number>(960);
  const [xlBp, setXlBp] = useState<number>(1280);
  const [optimizedScroll, setOptimizedScroll] = useState(false);
  const [sourceMaps, setSourceMaps] = useState(false);
  const [enableLogging, setEnableLogging] = useState(true);
  const [logLevel, setLogLevel] = useState("info");
  const [strictMode, setStrictMode] = useState(true);
  const [customCss, setCustomCss] = useState("");
  const [cssExpanded, setCssExpanded] = useState(false);

  const [originalValues, setOriginalValues] = useState({
    smallBp: 0, mediumBp: 720, largeBp: 960, xlBp: 1280,
    sourceMaps: false,
    enableLogging: true, logLevel: "info", customCss: "",
  });

  const hasChanges =
    originalValues.smallBp !== smallBp ||
    originalValues.mediumBp !== mediumBp ||
    originalValues.largeBp !== largeBp ||
    originalValues.xlBp !== xlBp ||
    originalValues.sourceMaps !== sourceMaps ||
    originalValues.enableLogging !== enableLogging ||
    originalValues.logLevel !== logLevel ||
    originalValues.customCss !== customCss;

  const {
    showConfirmModal,
    consumePendingNavigation,
  } = useUnsavedChangesNavigationGuard({
    hasChanges,
    pendingNavigation,
    onPendingNavigationHandled,
    onNavigate: onNavigationRequest,
  });

  useEffect(() => {
    if (!courseId) {
      console.warn("[TechnicalSettings] No courseId — skipping DB load");
      setIsLoading(false);
      return;
    }

    const loadSettings = async () => {
      console.log("[TechnicalSettings] Loading settings for courseId:", courseId);
      try {
        setIsLoading(true);
        const [config, style] = await Promise.all([
          getCourseTechnicalSettings(courseId),
          getCourseCstyle(courseId),
        ]);
        console.log("[TechnicalSettings] DB config:", config, "customStyle length:", style?.length);

        if (config._id) setConfigId(config._id);

        const small = config.screenSize?.small ?? 0;
        const medium = config.screenSize?.medium ?? 720;
        const large = config.screenSize?.large ?? 960;
        const xlarge = config.screenSize?.xlarge ?? 1280;
        setSmallBp(small);
        setMediumBp(medium);
        setLargeBp(large);
        setXlBp(xlarge);

        const optimized = config._scrollingContainer?._isEnabled ?? false;
        setOptimizedScroll(optimized);

        const sourceMap = config._generateSourcemap ?? false;
        setSourceMaps(sourceMap);

        const enableLog = config._logging?._isEnabled ?? true;
        const dbLevel = config._logging?._level ?? "info";
        const uiLevel = logLevelReverseMap[dbLevel] || "info";
        setEnableLogging(enableLog);
        setLogLevel(uiLevel);

        const strict = config.build?.strictMode ?? true;
        setStrictMode(strict);

        const customCssValue = style || "";
        setCustomCss(customCssValue);

        setOriginalValues({
          smallBp: small, mediumBp: medium, largeBp: large, xlBp: xlarge,
          sourceMaps: sourceMap,
          enableLogging: enableLog, logLevel: uiLevel,
          customCss: customCssValue,
        });
      } catch (err) {
        console.error("Failed to load technical settings", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [courseId]);

  const handleSave = async () => {
    console.log("[TechnicalSettings] handleSave called — courseId:", courseId, "configId:", configId);
    if (!courseId) {
      console.error("[TechnicalSettings] Cannot save: courseId is missing");
      return;
    }
    if (!configId) {
      console.error("[TechnicalSettings] Cannot save: configId is missing — config record not loaded from DB");
      return;
    }

    try {
      setIsSaving(true);

      const changedFields: Partial<CourseTechnicalSettings> = {
        _id: configId,
        _courseId: courseId,
      };
      if (smallBp !== originalValues.smallBp || mediumBp !== originalValues.mediumBp ||
          largeBp !== originalValues.largeBp || xlBp !== originalValues.xlBp) {
        changedFields.screenSize = { small: smallBp, medium: mediumBp, large: largeBp, xlarge: xlBp };
      }
      if (sourceMaps !== originalValues.sourceMaps) changedFields._generateSourcemap = sourceMaps;
      if (enableLogging !== originalValues.enableLogging || logLevel !== originalValues.logLevel) {
        changedFields._logging = {
          _isEnabled: enableLogging,
          _level: logLevelMap[logLevel] || "info",
          _console: true,
        };
      }

      await Promise.all([
        updateCourseTechnicalSettings(configId, changedFields),
        ...(customCss !== originalValues.customCss ? [updateCourseCustomStyle(courseId, customCss)] : []),
      ]);

      const navTarget = consumePendingNavigation();
      setOriginalValues({
        smallBp, mediumBp, largeBp, xlBp,
        sourceMaps, enableLogging, logLevel, customCss,
      });
      if (navTarget) onNavigationRequest?.(navTarget);
    } catch (err) {
      console.error("Failed to save technical settings", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!originalValues) return;

    setOriginalValues({
      smallBp: originalValues.smallBp,
      mediumBp: originalValues.mediumBp,
      largeBp: originalValues.largeBp,
      xlBp: originalValues.xlBp,
      sourceMaps: originalValues.sourceMaps,
      enableLogging: originalValues.enableLogging,
      logLevel: originalValues.logLevel,
      customCss: originalValues.customCss,
    });
    setSmallBp(originalValues.smallBp);
    setMediumBp(originalValues.mediumBp);
    setLargeBp(originalValues.largeBp);
    setXlBp(originalValues.xlBp);
    setSourceMaps(originalValues.sourceMaps);
    setEnableLogging(originalValues.enableLogging);
    setLogLevel(originalValues.logLevel);
    setCustomCss(originalValues.customCss);

    const navTarget = consumePendingNavigation();
    if (navTarget) onNavigationRequest?.(navTarget);
  };

  useEffect(() => {
    if (!cssExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [cssExpanded]);

  return (
    <div className="max-w-2xl w-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#111827]">Technical Settings</h2>
        <p className="text-sm text-[var(--life-neutral-300)] mt-0.5">Advanced configuration settings for developers and advanced users</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-[#6b7280]">
          <svg className="animate-spin mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          Loading settings…
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <TsAccordion title="Display & Responsiveness" defaultOpen>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-[13px] font-bold text-[var(--life-base-black)]">Screen Size</p>
                  <p className="text-[13px] text-[var(--life-neutral-300)] mt-[4px] mb-[4px]">Default breakpoint to preview and author against.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-normal text-[var(--life-base-black)]">Small</label>
                    <input type="number" value={smallBp} onChange={(e) => setSmallBp(Number(e.target.value))} placeholder="0" className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-[8px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent" style={{ borderRadius: 8 }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-normal text-[var(--life-base-black)]">Medium</label>
                    <input type="number" value={mediumBp} onChange={(e) => setMediumBp(Number(e.target.value))} placeholder="720" className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-[8px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent" style={{ borderRadius: 8 }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-normal text-[var(--life-base-black)]">Large</label>
                    <input type="number" value={largeBp} onChange={(e) => setLargeBp(Number(e.target.value))} placeholder="960" className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-[8px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent" style={{ borderRadius: 8 }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-normal text-[var(--life-base-black)]">Extra Large</label>
                    <input type="number" value={xlBp} onChange={(e) => setXlBp(Number(e.target.value))} placeholder="1280" className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-[8px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent" style={{ borderRadius: 8 }} />
                  </div>
                </div>
              </div>
            </TsAccordion>

            <TsAccordion title="Assistive & Embedded Experience">
              <p className="text-[13px] text-[var(--life-neutral-300)] mb-[6px]">Control how your course behaves in assistive and embedded environments (LMS iframes, WebViews).</p>
              <div className="flex flex-col gap-4">
                <TsCheckbox id="ts-opt-scroll" label="Enable optimized scroll for iFrames" description="Improves scroll behavior when the course is embedded inside an iframe." checked={optimizedScroll} onChange={setOptimizedScroll} />
                <TsCheckbox id="ts-src-maps" label="Generate source maps" description="Ships source maps with the build so devtools can trace runtime issues." checked={sourceMaps} onChange={setSourceMaps} />
              </div>
            </TsAccordion>

            <TsAccordion title="Runtime Behavior">
              <p className="text-[13px] text-[var(--life-neutral-300)] mb-[6px]">Configure how your course operates when run.</p>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <TsCheckbox
                    id="ts-logging"
                    label="Enable logging"
                    description="Emit runtime logs to the browser console for debugging. Enforces strict browser behaviour. Not recommended for legacy IE / Edge."
                    checked={enableLogging}
                    onChange={setEnableLogging}
                  />
                  <div className="pl-7">
                    <TsDropdown label="Log Level" value={logLevel} options={LOG_LEVEL_OPTIONS} onChange={setLogLevel} />
                  </div>
                </div>
                <TsCheckbox id="ts-strict" label="Use strict mode?" checked={strictMode} onChange={setStrictMode} />
              </div>
            </TsAccordion>

            {cssExpanded && <div className="fixed inset-0 z-40 bg-[rgba(26,26,26,0.5)]" aria-hidden="true" />}
            <div className={`border border-[var(--life-neutral-200)] rounded-lg bg-white overflow-hidden shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)] ${cssExpanded ? "fixed inset-8 z-50 flex flex-col" : ""}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--life-neutral-200)] bg-[var(--life-neutral-020)] shrink-0">
                <span className="text-sm font-semibold text-[#111827]">Custom CSS/LESS</span>
                <button
                  type="button"
                  aria-label={cssExpanded ? "Collapse CSS editor" : "Expand CSS editor"}
                  onClick={() => setCssExpanded((o) => !o)}
                  className={`w-8 h-8 flex items-center justify-center rounded-[8px] border transition-colors cursor-pointer ${
                    cssExpanded
                      ? "bg-white text-[#9ca3af] border-transparent hover:bg-[var(--life-critical-050)] hover:text-[var(--life-critical-600)] hover:border-[var(--life-critical-050)]"
                      : "bg-white text-[#9ca3af] border-[var(--life-neutral-200)] hover:bg-[var(--life-primary-020)] hover:text-[var(--life-primary-500)] hover:border-[var(--life-primary-500)]"
                  }`}
                >
                  {cssExpanded ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                  )}
                </button>
              </div>
              <div className={`p-4 ${cssExpanded ? "flex-1 min-h-0" : ""}`}>
                <div className={`border border-[var(--life-neutral-200)] rounded-[8px] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#2d6fa8] focus-within:border-transparent ${cssExpanded ? "h-full" : ""}`}>
                  <textarea
                    value={customCss}
                    onChange={(e) => setCustomCss(e.target.value)}
                    placeholder="/* Add your custom CSS or LESS here */"
                    spellCheck={false}
                    className={`w-full text-sm text-[#374151] px-4 py-3 resize-none focus:outline-none placeholder-[#9ca3af] bg-white font-mono ${cssExpanded ? "h-full" : "h-48"}`}
                  />
                </div>
              </div>
            </div>
          </div>

          <UnsavedChangesModal
            isOpen={showConfirmModal}
            isSaving={isSaving}
            onDiscard={handleDiscard}
            onSave={handleSave}
          />
        </>
      )}
    </div>
  );
}
