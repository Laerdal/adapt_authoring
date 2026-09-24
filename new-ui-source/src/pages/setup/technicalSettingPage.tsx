import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getCourseCstyle,
  getCourseTechnicalSettings,
  updateCourseCustomStyle,
  updateCourseTechnicalSettings,
  type CourseTechnicalSettings,
} from "../../api/adaptAuthoring";
import { UnsavedChangesModal } from "./unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";
import { CheckboxIndicator } from "../../components/common/Checkbox";

const LOG_LEVEL_OPTIONS = ["debug", "info", "warn", "error", "fatal"];

declare global {
  interface Window {
    ace?: any;
    cssValueCompleterRegistered?: boolean;
  }
}

const aceScripts = [
  "/js/ace/ace.js",
  "/js/ace/ext-language_tools.js",
  "/js/ace/mode-less.js",
  "/js/ace/theme-chrome.js",
];

const cssValueSuggestions: Record<string, string[]> = {
  color: ["aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "black", "blue", "currentColor", "transparent", "#000000", "#ffffff", "rgb(0, 0, 0)", "rgba(0, 0, 0, 0.5)"],
  "background-color": ["transparent", "#ffffff", "#f7f9fb", "rgb(255, 255, 255)", "rgba(0, 0, 0, 0.5)"],
  "border-color": ["transparent", "#d1d5db", "#e5e7eb", "currentColor"],
  display: ["block", "inline", "inline-block", "flex", "inline-flex", "grid", "inline-grid", "none", "contents"],
  position: ["static", "relative", "absolute", "fixed", "sticky"],
  "flex-direction": ["row", "row-reverse", "column", "column-reverse"],
  "justify-content": ["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"],
  "align-items": ["stretch", "flex-start", "flex-end", "center", "baseline"],
  "text-align": ["left", "center", "right", "justify"],
};

const cssValueCompleter = {
  getCompletions(editor: any, session: any, position: { row: number; column: number }, prefix: string, callback: (error: null, results: unknown[]) => void) {
    const beforeCursor = session.getLine(position.row).slice(0, position.column);
    const property = beforeCursor.match(/([\w-]+)\s*:\s*[^;]*$/)?.[1]?.toLowerCase();
    const suggestions = property ? cssValueSuggestions[property] || [] : [];
    callback(null, suggestions.map((value) => ({ caption: value, value, filterText: prefix, meta: "CSS value", score: 1000 })));
  },
};

function loadAceScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

function CustomCssEditor({ value, onChange, expanded }: { value: string; onChange: (value: string) => void; expanded: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const valueRef = useRef(value);
  const layoutSizeRef = useRef({ width: 0, height: 0 });
  valueRef.current = value;

  useEffect(() => {
    let disposed = false;

    const initialize = async () => {
      try {
        for (const src of aceScripts) await loadAceScript(src);
        if (disposed || !containerRef.current || !window.ace) return;

        window.ace.config.set("basePath", "/js/ace");
        const editor = window.ace.edit(containerRef.current, {
          maxLines: 30,
          minLines: 10,
          mode: "ace/mode/less",
          theme: "ace/theme/chrome",
        });
        editorRef.current = editor;
        editor.setTheme("ace/theme/chrome");
        editor.setValue(valueRef.current, -1);
        editor.setOptions({
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: false,
          fontSize: "14px",
          tabSize: 2,
          useSoftTabs: true,
          showPrintMargin: false,
        });
        const languageTools = window.ace.require("ace/ext/language_tools");
        if (!window.cssValueCompleterRegistered) {
          languageTools.addCompleter(cssValueCompleter);
          window.cssValueCompleterRegistered = true;
        }
        editor.on("change", () => {
          const nextValue = editor.getValue();
          valueRef.current = nextValue;
          onChange(nextValue);
        });
      } catch (error) {
        console.error("Failed to initialize CSS editor", error);
      }
    };

    initialize();
    return () => {
      disposed = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const container = containerRef.current;
    if (!editor || !container || editor.getValue() === value) return;

    // Do not replace the document while the user is typing; setValue resets
    // Ace's cursor and selection and can overwrite a newer local edit.
    if (container.contains(document.activeElement)) return;
    editor.setValue(value, -1);
  }, [value]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeEditor = () => {
      const parent = container.parentElement;
      const width = parent?.clientWidth ?? container.clientWidth;
      const height = expanded ? parent?.clientHeight ?? container.clientHeight : 0;
      if (layoutSizeRef.current.width === width && layoutSizeRef.current.height === height) return;
      layoutSizeRef.current = { width, height };

      if (expanded && container.parentElement) {
        container.style.height = `${height}px`;
        editorRef.current?.resize(true);
        container.style.height = `${height}px`;
      } else {
        container.style.removeProperty("height");
        editorRef.current?.resize(true);
      }
    };

    resizeEditor();
    const observer = new ResizeObserver(resizeEditor);
    observer.observe(container.parentElement ?? container);
    return () => observer.disconnect();
  }, [expanded]);

  return <div ref={containerRef} className="relative w-full" aria-label="Custom CSS/LESS editor" />;
}

function TsAccordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#e5e7eb] rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group w-full flex items-center justify-between gap-3 px-5 py-4 text-left bg-white text-[#111827] hover:bg-[#eaf8fb] hover:text-[#0f5f75] active:bg-[#d6edf6] transition-colors cursor-pointer"
      >
        <span className="text-sm font-semibold text-current">{title}</span>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 ml-auto text-current"
        >
          <polyline points={open ? "6 9 12 15 18 9" : "9 6 15 12 9 18"} />
        </svg>
      </button>
      {open && <div className="px-[22px] py-[20px] border-t border-[#f3f4f6] bg-white flex flex-col gap-4">{children}</div>}
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
        aria-label={label}
        className="sr-only peer"
      />
      <CheckboxIndicator checked={checked} className="mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors peer-checked:bg-[var(--life-primary-500)] peer-checked:border-[var(--life-primary-500)] border-[#d1d5db] bg-white group-hover:border-[#93c5fd]" />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-[#374151]">{label}</span>
        {description && <span className="text-[13px] text-[var(--life-neutral-300)]">{description}</span>}
      </div>
    </label>
  );
}

export function TechnicalSettingPage({
  courseId,
  courseTitle,
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
}: {
  courseId?: string;
  courseTitle?: string;
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
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [smallBp, setSmallBp] = useState<number>(0);
  const [mediumBp, setMediumBp] = useState<number>(720);
  const [largeBp, setLargeBp] = useState<number>(960);
  const [xlBp, setXlBp] = useState<number>(1280);
  const [optimizedScroll, setOptimizedScroll] = useState(false);
  const [sourceMaps, setSourceMaps] = useState(false);
  const [enableLogging, setEnableLogging] = useState(true);
  const [logLevel, setLogLevel] = useState("info");
  const [strictMode, setStrictMode] = useState(true);
  const [buildSettings, setBuildSettings] = useState<CourseTechnicalSettings["build"]>({});
  const [customCss, setCustomCss] = useState("");
  const [cssExpanded, setCssExpanded] = useState(false);

  const [originalValues, setOriginalValues] = useState({
    smallBp: 0, mediumBp: 720, largeBp: 960, xlBp: 1280,
    optimizedScroll: false, sourceMaps: false,
    enableLogging: true, logLevel: "info", customCss: "", strictMode: true,
  });

  const hasChanges =
    originalValues.smallBp !== smallBp ||
    originalValues.mediumBp !== mediumBp ||
    originalValues.largeBp !== largeBp ||
    originalValues.xlBp !== xlBp ||
    originalValues.optimizedScroll !== optimizedScroll ||
    originalValues.sourceMaps !== sourceMaps ||
    originalValues.enableLogging !== enableLogging ||
    originalValues.logLevel !== logLevel ||
    originalValues.customCss !== customCss ||
    originalValues.strictMode !== strictMode;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const {
    showConfirmModal,
    consumePendingNavigation,
    clearPendingNavigation,
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
        setBuildSettings(config.build ?? {});
        setStrictMode(strict);

        const customCssValue = style || "";
        setCustomCss(customCssValue);

        setOriginalValues({
          smallBp: small, mediumBp: medium, largeBp: large, xlBp: xlarge,
          optimizedScroll: optimized,
          sourceMaps: sourceMap,
          enableLogging: enableLog, logLevel: uiLevel,
          customCss: customCssValue, strictMode: strict,
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
      setToast(null);

      const changedFields: Partial<CourseTechnicalSettings> = {
        _id: configId,
        _courseId: courseId,
      };
      if (smallBp !== originalValues.smallBp || mediumBp !== originalValues.mediumBp ||
          largeBp !== originalValues.largeBp || xlBp !== originalValues.xlBp) {
        changedFields.screenSize = { small: smallBp, medium: mediumBp, large: largeBp, xlarge: xlBp };
      }
      if (sourceMaps !== originalValues.sourceMaps) changedFields._generateSourcemap = sourceMaps;
      if (optimizedScroll !== originalValues.optimizedScroll) {
        changedFields._scrollingContainer = { _isEnabled: optimizedScroll };
      }
      if (enableLogging !== originalValues.enableLogging || logLevel !== originalValues.logLevel) {
        changedFields._logging = {
          _isEnabled: enableLogging,
          _level: logLevelMap[logLevel] || "info",
          _console: true,
        };
      }
      if (strictMode !== originalValues.strictMode) {
        changedFields.build = { ...buildSettings, strictMode };
      }

      await Promise.all([
        updateCourseTechnicalSettings(configId, changedFields),
        ...(customCss !== originalValues.customCss ? [updateCourseCustomStyle(courseId, customCss)] : []),
      ]);

      const navTarget = consumePendingNavigation();
      setOriginalValues({
        smallBp, mediumBp, largeBp, xlBp,
        optimizedScroll, sourceMaps, enableLogging, logLevel, customCss, strictMode,
      });
      setBuildSettings((current) => ({ ...current, strictMode }));
      setToast({ type: "success", message: "Changes saved successfully" });
      if (navTarget) onNavigationRequest?.(navTarget);
    } catch (err) {
      console.error("Failed to save technical settings", err);
      setToast({ type: "error", message: "Couldn't save. Please try again." });
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
      optimizedScroll: originalValues.optimizedScroll,
      sourceMaps: originalValues.sourceMaps,
      enableLogging: originalValues.enableLogging,
      logLevel: originalValues.logLevel,
      customCss: originalValues.customCss,
      strictMode: originalValues.strictMode,
    });
    setSmallBp(originalValues.smallBp);
    setMediumBp(originalValues.mediumBp);
    setLargeBp(originalValues.largeBp);
    setXlBp(originalValues.xlBp);
    setOptimizedScroll(originalValues.optimizedScroll);
    setSourceMaps(originalValues.sourceMaps);
    setEnableLogging(originalValues.enableLogging);
    setLogLevel(originalValues.logLevel);
    setCustomCss(originalValues.customCss);
    setStrictMode(originalValues.strictMode);

    const navTarget = consumePendingNavigation();
    if (navTarget) onNavigationRequest?.(navTarget);
  };

  const handleExportCss = () => {
    if (!customCss) {
      alert("No custom CSS found for this course.");
      return;
    }

    const blob = new Blob([customCss], { type: "text/css" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${courseTitle || "course"}.css`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
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
    <div className="flex flex-col h-full w-full bg-[#f7f9fb]">
      <div className="shrink-0 px-6 py-5 bg-white border-b border-[#e5e7eb]">
        <h2 className="text-xl font-bold text-[#111827]">Technical Settings</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Advanced configuration settings for developers and advanced users</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-2xl px-6 py-6">
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Export CSS"
                    onClick={handleExportCss}
                    className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-[var(--life-primary-500)] bg-[var(--life-primary-500)] text-white transition-colors cursor-pointer hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-700)]"
                    title="Export"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
                    </svg>
                  </button>
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
              </div>
              <div className={`p-4 ${cssExpanded ? "flex-1 min-h-0" : ""}`}>
                <div className={`border border-[var(--life-neutral-200)] rounded-[8px] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#2d6fa8] focus-within:border-transparent ${cssExpanded ? "h-full" : ""}`}>
                  <CustomCssEditor value={customCss} onChange={setCustomCss} expanded={cssExpanded} />
                </div>
              </div>
            </div>
          </div>

          {!isLoading && hasChanges && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-[var(--life-warning-100)] shadow-lg animate-fade-in-down">
              <span className="flex items-center gap-2 text-sm text-[#374151]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-warning-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Unsaved changes
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleDiscard} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] disabled:opacity-50 transition-colors">Cancel</button>
                <button type="button" onClick={handleSave} disabled={isSaving || !courseId} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:opacity-50 rounded-lg transition-colors">
                  {isSaving && <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
                  {isSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {toast && (
            <div className="fixed top-4 right-4 z-[60] pointer-events-none">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border pointer-events-auto animate-fade-in-down min-w-[260px] max-w-sm ${toast.type === "success" ? "bg-[var(--life-positive-050)] border-[var(--life-positive-100)] text-[var(--life-positive-500)]" : "bg-[var(--life-critical-050)] border-[var(--life-critical-100)] text-[var(--life-critical-500)]"}`}>
                {toast.type === "success" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                <span className="flex-1">{toast.message}</span>
                <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity ml-1">&times;</button>
              </div>
            </div>
          )}

          <UnsavedChangesModal
            isOpen={showConfirmModal}
            isSaving={isSaving}
            onDiscard={handleDiscard}
            onSave={handleSave}
            onClose={clearPendingNavigation}
          />
        </>
      )}
      </div>
      </div>
    </div>
  );
}
