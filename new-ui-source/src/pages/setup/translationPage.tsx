import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  cancelMediaLocateTranslation,
  downloadMediaLocateTranslation,
  downloadSmartlingTranslation,
  exportTranslationStrings,
  exportXliffFile,
  getLeatsConfig,
  getLeatsPrompt,
  getLeatsStatus,
  getMediaLocateDetails,
  getMediaLocateStatus,
  getSmartlingDetails,
  getTranslationHealth,
  getTranslationMemory,
  importXliffFile,
  startLeatsTranslation,
  startMediaLocateUpload,
  startSmartlingUpload,
  type LeatsConfig,
  type LeatsJobStatus,
  type MediaLocateDetails,
  type SmartlingProjectDetails,
  type TranslationHealth,
  type TranslationStringEntry,
} from "@/api/translation";

type Step = 1 | 2 | 3;
type Tab = "preview" | "xliff" | "partners" | "ai";

const TRANSLATION_LOCALES = [
  { locales: "ar", description: "Arabic [ar]" },
  { locales: "da", description: "Danish [da]" },
  { locales: "de", description: "German [de]" },
  { locales: "en", description: "English [en]" },
  { locales: "en-GB", description: "English (United Kingdom) [en-GB]" },
  { locales: "en-US", description: "English (United States) [en-US]" },
  { locales: "es", description: "Spanish [es]" },
  { locales: "fi", description: "Finnish [fi]" },
  { locales: "fr", description: "French [fr]" },
  { locales: "he", description: "Hebrew [he]" },
  { locales: "it", description: "Italian [it]" },
  { locales: "ja", description: "Japanese [ja]" },
  { locales: "ko", description: "Korean [ko]" },
  { locales: "nb", description: "Norwegian [nb]" },
  { locales: "nl", description: "Dutch [nl]" },
  { locales: "pl", description: "Polish [pl]" },
  { locales: "pt", description: "Portuguese [pt]" },
  { locales: "pt-BR", description: "Portuguese (Brazil) [pt-BR]" },
  { locales: "ro", description: "Romanian [ro]" },
  { locales: "ru", description: "Russian [ru]" },
  { locales: "sv", description: "Swedish [sv]" },
  { locales: "uk", description: "Ukrainian [uk]" },
  { locales: "zh", description: "Chinese [zh]" },
  { locales: "zh-CN", description: "Chinese (China-Simplified) [zh-CN]" },
  { locales: "zh-TW", description: "Chinese (Taiwan) [zh-TW]" },
];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readFilenameFromContentDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const normalMatch = header.match(/filename="?([^";]+)"?/i);
  return normalMatch?.[1] || fallback;
}

function inferSection(entry: TranslationStringEntry) {
  if (entry.section) return String(entry.section);
  if (entry.file) return String(entry.file);
  if (entry.isGlobal) return "Global";
  const path = String(entry.path || "");
  if (path.includes("/_globals/")) return "Global";
  return "Course";
}

function inferIsGlobal(entry: TranslationStringEntry) {
  if (typeof entry.isGlobal === "boolean") return entry.isGlobal;
  const path = String(entry.path || "");
  return /\/_globals\//.test(path) || path.includes("globals.");
}

function resolveMemoryTranslation(path: string, memory: Record<string, unknown> | undefined): string {
  if (!memory || !path) return "";
  try {
    let current: unknown = memory;
    const cleanPath = path.replace(/^\/+|\/+$/g, "").replace(/\//g, ".").replace(/^_globals\./, "");
    for (const part of cleanPath.split(".").filter(Boolean)) {
      if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return "";
      }
    }
    return typeof current === "string" ? current : "";
  } catch {
    return "";
  }
}

function statusTone(status?: string | null) {
  switch (status) {
    case "ok":
    case "completed":
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "running":
    case "pending":
    case "checking":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
    case "down":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatProgressPercent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function Card({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#d8dde6] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e5e7eb] px-4 py-4 sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-[#152332]">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-[#667085]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="px-4 py-5 sm:px-5">{children}</div>
    </section>
  );
}

function TabButton({ active, children, description, onClick }: { active: boolean; children: ReactNode; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex min-w-[180px] flex-1 flex-col rounded-xl border px-5 py-4 text-left transition-all",
        active
          ? "border-[#2fa4d6] bg-[#f4fbff] text-[#17384a] shadow-[inset_0_0_0_1px_rgba(47,164,214,0.08)]"
          : "border-[#dbe3ea] bg-white text-[#344054] hover:border-[#a7c7d8] hover:bg-[#f8fbfd]",
      )}
    >
      <span className={clsx("text-[16px] font-semibold leading-6 tracking-[0.01em]", active ? "text-[#17384a]" : "text-[#344054]")}>{children}</span>
      <span className="mt-1.5 text-[14px] leading-6 text-[#667085]">{description}</span>
    </button>
  );
}

function Notice({ tone, title, children }: { tone: "info" | "success" | "warning" | "error"; title: string; children: ReactNode }) {
  const toneClass = {
    info: "border-[#bfd8e5] bg-[#f5fbff] text-[#27566f]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-rose-200 bg-rose-50 text-rose-700",
  }[tone];

  return (
    <div className={clsx("rounded-2xl border px-4 py-3", toneClass)}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm leading-6">{children}</div>
    </div>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-[#f8fafc] px-4 py-3">
      <span className="text-sm text-[#667085]">{label}</span>
      <span className={clsx("text-right text-sm font-semibold text-[#152332]", tone)}>{value}</span>
    </div>
  );
}

function MetricTile({ label, value, caption }: { label: string; value: ReactNode; caption?: string }) {
  return (
    <div className="rounded-2xl border border-[#e4eaf0] bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#667085]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[#152332]">{value}</div>
      {caption ? <div className="mt-1 text-xs text-[#667085]">{caption}</div> : null}
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  busy,
  label,
  busyLabel,
  variant = "primary",
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
  busyLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  title?: string;
}) {
  const variantClass = {
    primary: "border-[#2fa4d6] bg-[#2fa4d6] text-white hover:bg-[#278db9]",
    secondary: "border-[#d0d9e2] bg-white text-[#344054] hover:bg-[#f9fafb]",
    danger: "border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={clsx(
        "rounded-xl border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variantClass,
      )}
    >
      {busy ? busyLabel || label : label}
    </button>
  );
}

function StepButton({
  step,
  title,
  description,
  active,
  completed,
  locked,
  onClick,
}: {
  step: Step;
  title: string;
  description: string;
  active: boolean;
  completed: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={clsx(
        "group flex min-w-0 flex-1 items-start gap-3 rounded-2xl border px-4 py-4 text-left transition",
        active
          ? "border-[#2fa4d6] bg-[#eff7fb] shadow-[0_1px_2px_rgba(47,164,214,0.08)]"
          : "border-[#d8dde6] bg-white hover:border-[#bfd0db] hover:bg-[#fbfdff]",
        locked && "cursor-not-allowed opacity-60 hover:border-[#d8dde6] hover:bg-white",
      )}
    >
      <div
        className={clsx(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
          active || completed ? "border-[#2fa4d6] bg-[#2fa4d6] text-white" : "border-[#d0d9e2] bg-[#f8fafc] text-[#667085]",
        )}
      >
        {completed ? "✓" : step}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-semibold leading-6 text-[#152332]">{title}</span>
          {locked ? <span className="rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[11px] font-medium text-[#667085]">Locked</span> : null}
        </div>
        <p className="mt-1 text-[14px] leading-6 text-[#667085]">{description}</p>
      </div>
    </button>
  );
}

function SectionField({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-[#667085]">{hint}</span> : null}
    </label>
  );
}

function MethodCard({
  title,
  subtitle,
  active,
  onClick,
  badge,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex h-full flex-col items-start rounded-2xl border px-4 py-4 text-left transition",
        active ? "border-[#2fa4d6] bg-[#eff7fb]" : "border-[#d8dde6] bg-white hover:border-[#b7cedb] hover:bg-[#fbfdff]",
      )}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#152332]">{title}</span>
        {badge ? <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2fa4d6]">{badge}</span> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-[#667085]">{subtitle}</p>
    </button>
  );
}

const STEP_COPY: Record<Step, { title: string; description: string }> = {
  1: {
    title: "Preview String",
    description: "Inspect the course strings, choose a target language, and review translation-memory coverage.",
  },
  2: {
    title: "Translation Method",
    description: "Export, submit, or generate translations using the workflow that matches your delivery process.",
  },
  3: {
    title: "Preview & Confirm",
    description: "Review the outcome, capture the new course id, and confirm the translated course is ready.",
  },
};

export function TranslationPage({ courseId, courseTitle }: { courseId?: string; courseTitle?: string }) {
  const navigate = useNavigate();
  const [health, setHealth] = useState<TranslationHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [activeTab, setActiveTab] = useState<Tab>("preview");

  const [previewLanguage, setPreviewLanguage] = useState("en-US");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<TranslationStringEntry[]>([]);
  const [previewMemory, setPreviewMemory] = useState<Record<string, unknown>>({});
  const [previewPage, setPreviewPage] = useState(1);
  const [showGlobalStrings, setShowGlobalStrings] = useState(true);
  const [showCourseStrings, setShowCourseStrings] = useState(true);
  const [missingOnly, setMissingOnly] = useState(false);

  const [xliffIncludeExternalAssets, setXliffIncludeExternalAssets] = useState(false);
  const [xliffIncludeEmptyTarget, setXliffIncludeEmptyTarget] = useState(true);
  const [xliffUploadLanguage, setXliffUploadLanguage] = useState("en-US");
  const [xliffFile, setXliffFile] = useState<File | null>(null);
  const [xliffBusy, setXliffBusy] = useState(false);
  const [xliffMessage, setXliffMessage] = useState<string | null>(null);
  const [xliffError, setXliffError] = useState<string | null>(null);

  const [smartlingProjectId, setSmartlingProjectId] = useState("");
  const [smartlingLanguage, setSmartlingLanguage] = useState("en-US");
  const [smartlingLocaleToDownload, setSmartlingLocaleToDownload] = useState("en-US");
  const [smartlingDetails, setSmartlingDetails] = useState<SmartlingProjectDetails | null>(null);
  const [smartlingBusy, setSmartlingBusy] = useState(false);
  const [smartlingMessage, setSmartlingMessage] = useState<string | null>(null);
  const [smartlingError, setSmartlingError] = useState<string | null>(null);

  const [mediaLocateDetails, setMediaLocateDetails] = useState<MediaLocateDetails | null>(null);
  const [mediaLocateLanguage, setMediaLocateLanguage] = useState("en-US");
  const [mediaLocateProjectName, setMediaLocateProjectName] = useState("");
  const [mediaLocateDescription, setMediaLocateDescription] = useState("");
  const [mediaLocateTrackingCode, setMediaLocateTrackingCode] = useState("");
  const [mediaLocateLocale, setMediaLocateLocale] = useState("en-US");
  const [mediaLocateBusy, setMediaLocateBusy] = useState(false);
  const [mediaLocateMessage, setMediaLocateMessage] = useState<string | null>(null);
  const [mediaLocateError, setMediaLocateError] = useState<string | null>(null);

  const [leatsConfig, setLeatsConfig] = useState<LeatsConfig | null>(null);
  const [leatsPrompt, setLeatsPrompt] = useState("");
  const [leatsPromptDraft, setLeatsPromptDraft] = useState("");
  const [leatsEditingPrompt, setLeatsEditingPrompt] = useState(false);
  const [leatsLanguage, setLeatsLanguage] = useState("en-US");
  const [leatsIncludeExternalAssets, setLeatsIncludeExternalAssets] = useState(false);
  const [leatsJob, setLeatsJob] = useState<LeatsJobStatus | null>(null);
  const [leatsBusy, setLeatsBusy] = useState(false);
  const [leatsMessage, setLeatsMessage] = useState<string | null>(null);
  const [leatsError, setLeatsError] = useState<string | null>(null);
  const leatsPollerRef = useRef<number | null>(null);

  const [translationUploaded, setTranslationUploaded] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<"smartling" | "medialocate">("smartling");
  const [translationMethod, setTranslationMethod] = useState("");
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState("");
  const [translationGlobalCount, setTranslationGlobalCount] = useState(0);
  const [translationCourseCount, setTranslationCourseCount] = useState(0);
  const [translationCourseResultId, setTranslationCourseResultId] = useState<string | null>(null);

  const previewPerPage = 10;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getTranslationHealth();
        if (!cancelled) {
          setHealth(result);
          setHealthError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setHealthError(error instanceof Error ? error.message : "Failed to load translation health.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    if (leatsPollerRef.current) {
      window.clearInterval(leatsPollerRef.current);
    }
  }, []);

  useEffect(() => {
    setXliffUploadLanguage(previewLanguage);
    setSmartlingLanguage(previewLanguage);
    setSmartlingLocaleToDownload(previewLanguage);
    setMediaLocateLanguage(previewLanguage);
    setMediaLocateLocale(previewLanguage);
    setTranslationTargetLanguage(previewLanguage);
  }, [previewLanguage]);

  useEffect(() => {
    if (!leatsConfig?.languages.length) {
      setLeatsLanguage(previewLanguage);
      return;
    }

    const hasPreviewLanguage = leatsConfig.languages.some((language) => language.locales === previewLanguage);
    setLeatsLanguage((current) => {
      if (hasPreviewLanguage) {
        return previewLanguage;
      }
      return current && leatsConfig.languages.some((language) => language.locales === current)
        ? current
        : leatsConfig.languages[0].locales;
    });
  }, [leatsConfig, previewLanguage]);

  useEffect(() => {
    if (currentStep !== 2 || activeTab !== "ai" || leatsConfig) return;
    let cancelled = false;
    void (async () => {
      const [configResult, promptResult] = await Promise.allSettled([getLeatsConfig(), getLeatsPrompt()]);
      if (cancelled) return;

      if (configResult.status === "fulfilled") {
        const config = configResult.value;
        setLeatsConfig(config);
        if (config.languages.length > 0) {
          setLeatsLanguage((current) => {
            const hasPreviewLanguage = config.languages.some((language) => language.locales === previewLanguage);
            const hasCurrent = config.languages.some((language) => language.locales === current);
            if (hasPreviewLanguage) {
              return previewLanguage;
            }
            return hasCurrent ? current : config.languages[0].locales;
          });
        }
      }

      if (promptResult.status === "fulfilled") {
        const prompt = promptResult.value;
        setLeatsPrompt(prompt);
        setLeatsPromptDraft(prompt);
      }

      if (configResult.status === "rejected" || promptResult.status === "rejected") {
        const error = configResult.status === "rejected"
          ? configResult.reason
          : promptResult.status === "rejected"
            ? promptResult.reason
            : null;
        setLeatsError(error instanceof Error ? error.message : "Failed to load AI translation config.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, currentStep, leatsConfig]);

  useEffect(() => {
    if (currentStep !== 2 || activeTab !== "partners" || mediaLocateDetails || !courseId) return;
    let cancelled = false;
    void (async () => {
      try {
        const details = await getMediaLocateDetails(courseId);
        if (!cancelled) {
          setMediaLocateDetails(details);
          setMediaLocateError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setMediaLocateError(error instanceof Error ? error.message : "Failed to load MediaLocate details.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, courseId, currentStep, mediaLocateDetails]);

  const filteredPreviewRows = useMemo(() => {
    return previewRows.filter((entry) => {
      const isGlobal = inferIsGlobal(entry);
      const hasMemory = Boolean(resolveMemoryTranslation(String(entry.path || ""), previewMemory));
      return ((isGlobal && showGlobalStrings) || (!isGlobal && showCourseStrings)) && (!missingOnly || !hasMemory);
    });
  }, [missingOnly, previewMemory, previewRows, showCourseStrings, showGlobalStrings]);

  const previewTotalPages = Math.max(1, Math.ceil(filteredPreviewRows.length / previewPerPage));
  const previewStartIndex = (previewPage - 1) * previewPerPage;
  const previewPageRows = filteredPreviewRows.slice(previewStartIndex, previewStartIndex + previewPerPage);
  const selectedPreviewCount = filteredPreviewRows.length;
  const previewSummary = selectedPreviewCount > 0 ? `${previewStartIndex + 1}-${Math.min(previewStartIndex + previewPerPage, selectedPreviewCount)} of ${selectedPreviewCount}` : "0";
  const previewMemoryCoverage = previewRows.filter((entry) => Boolean(entry.memoryTranslation)).length;
  const previewMissingCoverage = previewRows.length - previewMemoryCoverage;
  const previewGlobalRows = previewRows.filter((entry) => inferIsGlobal(entry)).length;
  const previewCourseRows = previewRows.length - previewGlobalRows;
  const previewCharacterCount = previewRows.reduce((total, entry) => total + String(entry.value || "").length, 0);

  useEffect(() => {
    if (previewPage > previewTotalPages) {
      setPreviewPage(previewTotalPages);
    }
  }, [previewPage, previewTotalPages]);

  async function loadPreviewStrings() {
    if (!courseId) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const [strings, memory] = await Promise.all([exportTranslationStrings(courseId), getTranslationMemory(previewLanguage)]);
      const translations = memory.translations || {};
      const normalised = strings.map((entry) => ({
        ...entry,
        section: entry.section || inferSection(entry),
        isGlobal: inferIsGlobal(entry),
        memoryTranslation: resolveMemoryTranslation(String(entry.path || ""), translations),
      }));
      setPreviewRows(normalised);
      setPreviewMemory(translations);
      setPreviewPage(1);
      setTranslationTargetLanguage(previewLanguage);
      setTranslationGlobalCount(normalised.filter((entry) => inferIsGlobal(entry)).length);
      setTranslationCourseCount(normalised.filter((entry) => !inferIsGlobal(entry)).length);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Failed to load translation strings.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleExportXliff() {
    if (!courseId) return;
    setXliffBusy(true);
    setXliffError(null);
    setXliffMessage(null);
    try {
      const response = await exportXliffFile(courseId, {
        includeExternalAssets: xliffIncludeExternalAssets,
        includeEmptyTarget: xliffIncludeEmptyTarget,
        targetLanguage: xliffUploadLanguage || previewLanguage,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || error.message || response.statusText);
      }
      const blob = await response.blob();
      const filename = readFilenameFromContentDisposition(response.headers.get("content-disposition"), `${courseTitle || "translation"}.xliff`);
      triggerDownload(blob, filename);
      setXliffMessage(`Exported ${filename}`);
      setTranslationMethod("XLIFF export");
      setTranslationTargetLanguage(xliffUploadLanguage || previewLanguage);
    } catch (error) {
      setXliffError(error instanceof Error ? error.message : "Failed to export XLIFF.");
    } finally {
      setXliffBusy(false);
    }
  }

  async function handleImportXliff() {
    if (!courseId || !xliffFile) return;
    setXliffBusy(true);
    setXliffError(null);
    setXliffMessage(null);
    try {
      const result = await importXliffFile(courseId, xliffFile, xliffUploadLanguage || previewLanguage, false);
      setXliffMessage(`Imported successfully. New course id: ${result.newCourseId}`);
      setTranslationUploaded(true);
      setTranslationMethod("XLIFF import");
      setTranslationTargetLanguage(result.targetLanguage || xliffUploadLanguage || previewLanguage);
      setTranslationCourseResultId(result.newCourseId);
      setXliffFile(null);
    } catch (error) {
      setXliffError(error instanceof Error ? error.message : "Failed to import XLIFF.");
    } finally {
      setXliffBusy(false);
    }
  }

  async function handleLoadSmartlingDetails() {
    if (!smartlingProjectId.trim()) {
      setSmartlingError("Enter a Smartling project id first.");
      return;
    }
    setSmartlingBusy(true);
    setSmartlingError(null);
    setSmartlingMessage(null);
    try {
      const details = await getSmartlingDetails(smartlingProjectId.trim());
      setSmartlingDetails(details);
      setSmartlingMessage("Smartling project details loaded.");
    } catch (error) {
      setSmartlingError(error instanceof Error ? error.message : "Failed to load Smartling details.");
    } finally {
      setSmartlingBusy(false);
    }
  }

  async function handleSmartlingUpload() {
    if (!courseId || !smartlingProjectId.trim()) return;
    setSmartlingBusy(true);
    setSmartlingError(null);
    setSmartlingMessage(null);
    try {
      await startSmartlingUpload(courseId, smartlingProjectId.trim(), smartlingLanguage, xliffIncludeExternalAssets);
      setSmartlingMessage("Course uploaded to Smartling.");
      setTranslationMethod("Smartling");
      setTranslationTargetLanguage(smartlingLanguage);
    } catch (error) {
      setSmartlingError(error instanceof Error ? error.message : "Failed to upload to Smartling.");
    } finally {
      setSmartlingBusy(false);
    }
  }

  async function handleSmartlingDownload() {
    if (!courseId || !smartlingProjectId.trim()) return;
    setSmartlingBusy(true);
    setSmartlingError(null);
    try {
      const result = await downloadSmartlingTranslation(courseId, smartlingProjectId.trim(), smartlingLocaleToDownload);
      const data = result as { newCourseId?: string; targetLanguage?: string };
      setSmartlingMessage(`Smartling import completed${data.newCourseId ? `, new course ${data.newCourseId}` : ""}.`);
      setTranslationUploaded(true);
      setTranslationMethod("Smartling");
      setTranslationTargetLanguage(data.targetLanguage || smartlingLocaleToDownload || smartlingLanguage);
      setTranslationCourseResultId(data.newCourseId || null);
    } catch (error) {
      setSmartlingError(error instanceof Error ? error.message : "Failed to download Smartling translation.");
    } finally {
      setSmartlingBusy(false);
    }
  }

  async function handleLoadMediaLocateDetails() {
    if (!courseId) return;
    setMediaLocateBusy(true);
    setMediaLocateError(null);
    setMediaLocateMessage(null);
    try {
      const details = await getMediaLocateDetails(courseId);
      setMediaLocateDetails(details);
      setMediaLocateMessage("MediaLocate configuration loaded.");
    } catch (error) {
      setMediaLocateError(error instanceof Error ? error.message : "Failed to load MediaLocate details.");
    } finally {
      setMediaLocateBusy(false);
    }
  }

  async function handleMediaLocateUpload() {
    if (!courseId) return;
    setMediaLocateBusy(true);
    setMediaLocateError(null);
    setMediaLocateMessage(null);
    try {
      const result = await startMediaLocateUpload(
        courseId,
        mediaLocateLanguage,
        xliffIncludeExternalAssets,
        mediaLocateProjectName.trim() || undefined,
        mediaLocateDescription.trim() || undefined,
      );
      setMediaLocateTrackingCode(result.trackingCode);
      setMediaLocateMessage(`MediaLocate submission started. Tracking code: ${result.trackingCode}`);
      setTranslationMethod("MediaLocate");
      setTranslationTargetLanguage(mediaLocateLanguage);
    } catch (error) {
      setMediaLocateError(error instanceof Error ? error.message : "Failed to submit to MediaLocate.");
    } finally {
      setMediaLocateBusy(false);
    }
  }

  async function handleMediaLocateStatus() {
    if (!courseId || !mediaLocateTrackingCode.trim()) return;
    setMediaLocateBusy(true);
    setMediaLocateError(null);
    try {
      await getMediaLocateStatus(courseId, mediaLocateTrackingCode.trim(), mediaLocateLocale);
      setMediaLocateMessage(`Status fetched for ${mediaLocateTrackingCode.trim()}.`);
    } catch (error) {
      setMediaLocateError(error instanceof Error ? error.message : "Failed to check MediaLocate status.");
    } finally {
      setMediaLocateBusy(false);
    }
  }

  async function handleMediaLocateDownload() {
    if (!courseId || !mediaLocateTrackingCode.trim()) return;
    setMediaLocateBusy(true);
    setMediaLocateError(null);
    try {
      const result = await downloadMediaLocateTranslation(courseId, mediaLocateTrackingCode.trim(), mediaLocateLocale);
      const data = result as { newCourseId?: string; targetLanguage?: string };
      setMediaLocateMessage(`MediaLocate import completed${data.newCourseId ? `, new course ${data.newCourseId}` : ""}.`);
      setTranslationUploaded(true);
      setTranslationMethod("MediaLocate");
      setTranslationTargetLanguage(data.targetLanguage || mediaLocateLocale || mediaLocateLanguage);
      setTranslationCourseResultId(data.newCourseId || null);
    } catch (error) {
      setMediaLocateError(error instanceof Error ? error.message : "Failed to download MediaLocate translation.");
    } finally {
      setMediaLocateBusy(false);
    }
  }

  async function handleMediaLocateCancel() {
    if (!courseId || !mediaLocateTrackingCode.trim()) return;
    setMediaLocateBusy(true);
    setMediaLocateError(null);
    try {
      await cancelMediaLocateTranslation(courseId, mediaLocateTrackingCode.trim());
      setMediaLocateMessage(`Cancelled ${mediaLocateTrackingCode.trim()}.`);
    } catch (error) {
      setMediaLocateError(error instanceof Error ? error.message : "Failed to cancel MediaLocate project.");
    } finally {
      setMediaLocateBusy(false);
    }
  }

  async function handleStartAiTranslation() {
    if (!courseId) return;
    setLeatsBusy(true);
    setLeatsError(null);
    setLeatsMessage(null);
    setTranslationUploaded(false);
    setTranslationCourseResultId(null);
    setTranslationMethod("LEATS");
    setTranslationTargetLanguage(leatsLanguage);
    setTranslationGlobalCount(0);
    setTranslationCourseCount(0);
    try {
      const result = await startLeatsTranslation(courseId, leatsLanguage, leatsIncludeExternalAssets, leatsEditingPrompt ? leatsPromptDraft : undefined);
      setLeatsJob({
        jobId: result.jobId,
        status: "pending",
        courseId,
        targetLanguage: leatsLanguage,
        totalUnique: 0,
        totalStrings: 0,
        translated: 0,
        globalReused: 0,
        totalChunks: 0,
        chunksDone: 0,
        retried: 0,
        failed: 0,
        newCourseId: null,
        error: null,
      });
      setLeatsMessage(`AI translation job ${result.jobId} started.`);
      if (leatsPollerRef.current) {
        window.clearInterval(leatsPollerRef.current);
      }
      leatsPollerRef.current = window.setInterval(async () => {
        try {
          const status = await getLeatsStatus(result.jobId);
          setLeatsJob(status);
          setTranslationGlobalCount(status.globalReused || 0);
          setTranslationCourseCount(status.totalStrings || 0);

          if (status.status === "failed") {
            setLeatsError(status.error || "AI translation failed.");
            setLeatsMessage("AI translation failed. Review the error details and retry with a different prompt or locale.");
            if (leatsPollerRef.current) {
              window.clearInterval(leatsPollerRef.current);
              leatsPollerRef.current = null;
            }
            return;
          }

          if (status.status === "completed") {
            if (leatsPollerRef.current) {
              window.clearInterval(leatsPollerRef.current);
              leatsPollerRef.current = null;
            }
            setTranslationUploaded(true);
            setTranslationMethod("LEATS");
            setTranslationTargetLanguage(status.targetLanguage || leatsLanguage);
            setTranslationCourseResultId(status.newCourseId || null);
            setLeatsMessage("Translation complete. Click Next to review it.");
          }
        } catch (pollError) {
          setLeatsError(pollError instanceof Error ? pollError.message : "Failed to poll AI translation status.");
          if (leatsPollerRef.current) {
            window.clearInterval(leatsPollerRef.current);
            leatsPollerRef.current = null;
          }
        }
      }, 2500);
    } catch (error) {
      setLeatsError(error instanceof Error ? error.message : "Failed to start AI translation.");
    } finally {
      setLeatsBusy(false);
    }
  }

  const healthLabel = health?.status || (healthError ? "down" : "checking");
  const stepThreeLocked = !translationUploaded;
  const hasPreview = previewRows.length > 0;
  const canMoveToMethods = true;
  const canMoveToConfirm = translationUploaded;
  const canExportXliff = Boolean(courseId && (xliffUploadLanguage || previewLanguage));
  const canImportXliff = Boolean(courseId && xliffFile && (xliffUploadLanguage || previewLanguage));
  const canLoadSmartling = Boolean(smartlingProjectId.trim());
  const canUploadSmartling = Boolean(courseId && smartlingProjectId.trim() && smartlingLanguage);
  const canDownloadSmartling = Boolean(courseId && smartlingProjectId.trim() && smartlingLocaleToDownload);
  const canUploadMediaLocate = Boolean(courseId && mediaLocateLanguage);
  const canCheckMediaLocate = Boolean(courseId && mediaLocateTrackingCode.trim() && mediaLocateLocale);
  const canCancelMediaLocate = Boolean(courseId && mediaLocateTrackingCode.trim());
  const canStartAi = Boolean(courseId && leatsLanguage && (leatsConfig?.configured ?? true));
  const aiStatusLabel = leatsJob?.status ? leatsJob.status[0].toUpperCase() + leatsJob.status.slice(1) : "Idle";
  const methodLabel = translationMethod || (selectedPartner === "smartling" ? "Smartling" : "MediaLocate");
  const aiProgressPercent = leatsJob
    ? leatsJob.totalUnique > 0
      ? (leatsJob.translated / leatsJob.totalUnique) * 100
      : leatsJob.totalChunks > 0
        ? (leatsJob.chunksDone / leatsJob.totalChunks) * 100
        : 0
    : 0;
  const aiProgressTranslated = leatsJob?.translated ?? 0;
  const aiProgressTotal = leatsJob?.totalUnique || leatsJob?.totalStrings || 0;
  const aiProgressChunksDone = leatsJob?.chunksDone ?? 0;
  const aiProgressChunksTotal = leatsJob?.totalChunks || 0;

  function openTranslatedCourse() {
    if (!translationCourseResultId) return;
    navigate(`/course/${translationCourseResultId}`);
  }

  function goToPreviousStep() {
    setCurrentStep((step) => (step === 3 ? 2 : 1));
  }

  function goToNextStep() {
    if (currentStep === 1 && canMoveToMethods) {
      setActiveTab("partners");
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2 && canMoveToConfirm) {
      setCurrentStep(3);
    }
  }

  function handleStepChange(step: Step) {
    if (step === 3 && !translationUploaded) return;
    setCurrentStep(step);
    if (step === 2 && activeTab === "preview") {
      setActiveTab("partners");
    }
  }

  if (!courseId) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-8 py-10">
        <div className="max-w-2xl rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-6 py-5 text-sm text-[#991b1b] shadow-sm">
          No course is associated with this setup flow, so translation cannot be opened.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f6f8fb] px-4 py-4 lg:px-5 lg:py-5" style={{ fontFamily: "Lato, sans-serif" }}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <section className="rounded-[20px] border border-[#dfe6ee] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-5">
          <div className="flex flex-wrap items-center gap-4">
            {([1, 2, 3] as Step[]).map((step, index) => {
              const active = currentStep === step;
              const completed = step < currentStep || (step === 3 && translationUploaded);
              const locked = step === 3 && !translationUploaded;
              return (
                <div key={step} className="flex min-w-0 flex-1 items-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleStepChange(step)}
                    disabled={locked}
                    className={clsx("flex min-w-0 items-center gap-3 text-left transition", locked && "cursor-not-allowed opacity-70")}
                  >
                    <span
                      className={clsx(
                        "flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold",
                        completed || active ? "bg-[#2fa4d6] text-white" : "border-4 border-[#dce4ec] bg-[#f7fafc] text-[#a8b3bf]",
                      )}
                    >
                      {completed ? "✓" : step}
                    </span>
                    <span className={clsx("whitespace-nowrap text-[15px] font-medium tracking-[0.01em]", active ? "text-[#152332]" : "text-[#8893a0]")}>{STEP_COPY[step].title}</span>
                  </button>
                  {index < 2 ? <div className="h-px flex-1 bg-[#d9e1ea]" /> : null}
                </div>
              );
            })}
          </div>
        </section>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-5 pb-2">
            {healthError ? <Notice tone="error" title="Translation service issue">{healthError}</Notice> : null}
            {health?.error ? <Notice tone="warning" title="Plugin warning">{health.error}</Notice> : null}

            {currentStep === 1 ? (
              <>
                <section className="rounded-[18px] border border-[#e3e8ef] bg-white px-4 py-10 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-6">
                  <div className="mx-auto max-w-3xl text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#33a2d6] text-white shadow-[0_10px_24px_rgba(51,162,214,0.28)]">
                      <svg viewBox="0 0 24 24" className="h-9 w-9 fill-none stroke-current stroke-[1.8]">
                        <circle cx="12" cy="12" r="9" />
                        <ellipse cx="12" cy="12" rx="4.2" ry="9" />
                        <path d="M3 12h18" />
                      </svg>
                    </div>
                    <h2 className="mt-6 text-[22px] font-semibold tracking-tight text-[#152332]">Preview Course Strings</h2>
                    <p className="mt-4 text-[16px] leading-7 text-[#667085]">Load Global and Course strings to see what content is available for translation.</p>

                    <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-center">
                      <label className="block text-left">
                        <span className="mb-2 block text-[14px] font-medium text-[#152332]">Select Language *</span>
                        <select
                          value={previewLanguage}
                          onChange={(event) => setPreviewLanguage(event.target.value)}
                          className="h-14 w-full min-w-[290px] rounded-xl border border-[#d8e1ea] bg-white px-4 text-base text-[#152332] outline-none transition focus:border-[#2fa4d6] sm:w-[420px]"
                        >
                          {TRANSLATION_LOCALES.map((locale) => (
                            <option key={locale.locales} value={locale.locales}>
                              {locale.description}
                            </option>
                          ))}
                        </select>
                      </label>
                      <ActionButton onClick={() => void loadPreviewStrings()} disabled={false} busy={previewLoading} label="Preview Course Strings" busyLabel="Loading strings..." />
                    </div>
                  </div>
                </section>

                <section className="rounded-[18px] border border-[#cfe0f3] bg-[#eff6ff] px-4 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:px-5">
                  <h3 className="text-[22px] font-semibold tracking-tight text-[#152332]">Strings Overview</h3>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                      <div className="text-[16px] text-[#52606d]">Total Strings</div>
                      <div className="mt-2 text-4xl font-semibold text-[#2fa4d6]">{previewRows.length}</div>
                    </div>
                    <div className="rounded-2xl bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                      <div className="text-[16px] text-[#52606d]">Total Characters</div>
                      <div className="mt-2 text-4xl font-semibold text-[#2fa4d6]">{previewCharacterCount}</div>
                    </div>
                  </div>
                </section>

                <div className="flex items-center justify-between gap-4 px-1 pt-1">
                  <h3 className="text-[22px] font-semibold tracking-tight text-[#152332]">
                    Course Strings Overview: <span className="font-normal text-[#2fa4d6]">{courseTitle || "Preview Course"}</span>
                  </h3>
                </div>

                <section className="rounded-[16px] border border-[#e2e8f0] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:px-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-6">
                      <label className="inline-flex items-center gap-3 text-[15px] text-[#152332]">
                        <input type="checkbox" checked={showGlobalStrings} onChange={(event) => setShowGlobalStrings(event.target.checked)} className="h-5 w-5 rounded border-[#98a2b3] text-[#2fa4d6] focus:ring-[#2fa4d6]" />
                        Global Strings
                      </label>
                      <label className="inline-flex items-center gap-3 text-[15px] text-[#152332]">
                        <input type="checkbox" checked={showCourseStrings} onChange={(event) => setShowCourseStrings(event.target.checked)} className="h-5 w-5 rounded border-[#98a2b3] text-[#2fa4d6] focus:ring-[#2fa4d6]" />
                        Course Strings
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-[15px] text-[#152332]">
                      <div className="font-semibold">Translation Memory</div>
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="translation-memory-filter" checked={!missingOnly} onChange={() => setMissingOnly(false)} className="h-5 w-5 border-[#98a2b3] text-[#2fa4d6] focus:ring-[#2fa4d6]" />
                        Show All
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="translation-memory-filter" checked={missingOnly} onChange={() => setMissingOnly(true)} className="h-5 w-5 border-[#98a2b3] text-[#2fa4d6] focus:ring-[#2fa4d6]" />
                        Missing Translation
                      </label>
                    </div>
                  </div>
                </section>

                {previewError ? <Notice tone="error" title="Preview failed">{previewError}</Notice> : null}
                {!previewError && !hasPreview ? <Notice tone="info" title="Preview not loaded">Load strings to see the content available for translation.</Notice> : null}

                <section className="overflow-hidden rounded-[16px] border border-[#e1e7ef] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-[15px]">
                      <thead className="bg-white text-xs uppercase tracking-[0.12em] text-[#667085]">
                        <tr>
                          <th className="border-b border-r border-[#d9e1ea] px-4 py-4 font-medium">Type</th>
                          <th className="border-b border-r border-[#d9e1ea] px-4 py-4 font-medium">Section</th>
                          <th className="border-b border-r border-[#d9e1ea] px-4 py-4 font-medium">Route</th>
                          <th className="border-b border-r border-[#d9e1ea] px-4 py-4 font-medium">Original</th>
                          <th className="border-b border-[#d9e1ea] px-4 py-4 font-medium">Translated Strings</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white text-[#152332]">
                        {previewPageRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#98a2b3]">
                              Load strings to preview the translation scope and memory coverage.
                            </td>
                          </tr>
                        ) : (
                          previewPageRows.map((entry, index) => {
                            const isGlobal = inferIsGlobal(entry);
                            const memoryTranslation = entry.memoryTranslation || resolveMemoryTranslation(String(entry.path || ""), previewMemory);
                            const sectionLabel = entry.section || inferSection(entry);
                            return (
                              <tr key={`${entry.path || entry.value || index}`} className="align-top">
                                <td className="border-b border-r border-[#d9e1ea] px-4 py-5">
                                  <span className={clsx("inline-flex rounded-full px-3 py-1 text-[12px] font-semibold", isGlobal ? "bg-[#dbeafe] text-[#1d4ed8]" : "bg-[#dbeafe] text-[#1d4ed8]")}>{isGlobal ? "Global" : "Course"}</span>
                                </td>
                                <td className="border-b border-r border-[#d9e1ea] px-4 py-5">
                                  <div className="font-medium text-[#152332]">{sectionLabel}</div>
                                  {!isGlobal ? <button type="button" className="mt-2 text-[14px] text-[#2fa4d6] underline">Edit Course</button> : null}
                                </td>
                                <td className="border-b border-r border-[#d9e1ea] px-4 py-5 text-[#152332]">{String(entry.path || "")}</td>
                                <td className="border-b border-r border-[#d9e1ea] px-4 py-5 text-[#152332]">{String(entry.value || "")}</td>
                                <td className="border-b border-[#d9e1ea] px-4 py-5 italic text-[#667085]">{memoryTranslation || "No previous translation"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e7ef] px-4 py-4 text-[14px] text-[#475467] sm:px-5">
                    <span>Page {previewPage} of {previewTotalPages}</span>
                    <div className="flex items-center gap-2">
                      <ActionButton onClick={() => setPreviewPage((page) => Math.max(1, page - 1))} disabled={previewPage <= 1} variant="secondary" label="Previous" />
                      <ActionButton onClick={() => setPreviewPage((page) => Math.min(previewTotalPages, page + 1))} disabled={previewPage >= previewTotalPages} variant="secondary" label="Next" />
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                <section className="grid grid-cols-1 overflow-hidden rounded-[16px] border border-[#d8dde6] bg-white md:grid-cols-3">
                  <TabButton active={activeTab === "partners"} description="Use Smartling or MediaLocate for vendor-managed translation." onClick={() => setActiveTab("partners")}>Translation Partners</TabButton>
                  <TabButton active={activeTab === "xliff"} description="Export and re-import XLIFF files for offline translation." onClick={() => setActiveTab("xliff")}>XLIFF Export &amp; Upload</TabButton>
                  <TabButton active={activeTab === "ai"} description="Run the AI-assisted translation workflow in Adapt Studio." onClick={() => setActiveTab("ai")}>AI Translation</TabButton>
                </section>

                {activeTab === "partners" ? (
                  <>
                    <section className="rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                      <h3 className="text-[22px] font-semibold tracking-tight text-[#152332]">Translation Partners</h3>
                      <p className="mt-3 text-[16px] leading-7 text-[#475467]">Translate your Adapt content seamlessly using our integrated translation partners.</p>
                      <p className="mt-4 max-w-4xl text-[16px] leading-7 text-[#475467]">This workflow enables a hassle-free translation process by automatically exporting translation strings to the selected vendor and allowing you to import translated strings back into Adapt to create localized translation courses.</p>
                      <div className="mt-8 space-y-5">
                        <label className="flex items-center gap-4 text-[16px] font-medium text-[#152332]">
                          <input type="radio" name="partner-choice" checked={selectedPartner === "smartling"} onChange={() => setSelectedPartner("smartling")} className="h-6 w-6 border-[#98a2b3] text-[#2fa4d6] focus:ring-[#2fa4d6]" />
                          SmartLing Integration
                        </label>
                        <label className="flex items-center gap-4 text-[16px] font-medium text-[#152332]">
                          <input type="radio" name="partner-choice" checked={selectedPartner === "medialocate"} onChange={() => setSelectedPartner("medialocate")} className="h-6 w-6 border-[#98a2b3] text-[#2fa4d6] focus:ring-[#2fa4d6]" />
                          MediaLocate Integration
                        </label>
                      </div>
                    </section>

                    <div className="grid gap-5 xl:grid-cols-2">
                      {selectedPartner === "smartling" ? (
                        <>
                          <section className="rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                            <h4 className="text-[20px] font-semibold tracking-tight text-[#152332]">Smartling Config</h4>
                            <div className="mt-8 space-y-5">
                              <SectionField label="Project ID">
                                <input value={smartlingProjectId} onChange={(event) => setSmartlingProjectId(event.target.value)} placeholder="Smartling project id" className="h-14 w-full rounded-xl border border-[#d8e1ea] bg-white px-4 text-[16px] outline-none focus:border-[#2fa4d6]" />
                              </SectionField>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <SectionField label="Target language">
                                  <select value={smartlingLanguage} onChange={(event) => setSmartlingLanguage(event.target.value)} className="h-14 w-full rounded-xl border border-[#d8e1ea] bg-white px-4 text-[16px] outline-none focus:border-[#2fa4d6]">
                                    {TRANSLATION_LOCALES.map((locale) => <option key={locale.locales} value={locale.locales}>{locale.description}</option>)}
                                  </select>
                                </SectionField>
                                <SectionField label="Download locale">
                                  <select value={smartlingLocaleToDownload} onChange={(event) => setSmartlingLocaleToDownload(event.target.value)} className="h-14 w-full rounded-xl border border-[#d8e1ea] bg-white px-4 text-[16px] outline-none focus:border-[#2fa4d6]">
                                    {TRANSLATION_LOCALES.map((locale) => <option key={locale.locales} value={locale.locales}>{locale.description}</option>)}
                                  </select>
                                </SectionField>
                              </div>
                              <div className="flex flex-wrap gap-3">
                                <ActionButton onClick={() => void handleLoadSmartlingDetails()} disabled={!canLoadSmartling} busy={smartlingBusy} variant="secondary" label="Load details" busyLabel="Loading details..." title={!canLoadSmartling ? "Enter a project id first" : undefined} />
                                <ActionButton onClick={() => void handleSmartlingUpload()} disabled={!canUploadSmartling} busy={smartlingBusy} label="Upload to Smartling" busyLabel="Uploading..." title={!canUploadSmartling ? "Project id and target language are required" : undefined} />
                                <ActionButton onClick={() => void handleSmartlingDownload()} disabled={!canDownloadSmartling} busy={smartlingBusy} variant="secondary" label="Download translation" busyLabel="Downloading..." title={!canDownloadSmartling ? "Project id and download locale are required" : undefined} />
                              </div>
                              {smartlingMessage ? <Notice tone="success" title="Smartling update">{smartlingMessage}</Notice> : null}
                              {smartlingError ? <Notice tone="error" title="Smartling issue">{smartlingError}</Notice> : null}
                            </div>
                          </section>

                          <section className="rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                            <h4 className="text-[20px] font-semibold tracking-tight text-[#152332]">Smartling Project Details</h4>
                            <p className="mt-4 text-[16px] leading-7 text-[#475467]">Project details from Smartling API</p>
                            {smartlingDetails ? <pre className="mt-5 max-h-64 overflow-auto rounded-2xl bg-[#0f172a] px-4 py-3 text-xs text-[#cbd5e1]">{JSON.stringify(smartlingDetails, null, 2)}</pre> : null}
                          </section>
                        </>
                      ) : (
                        <>
                          <section className="rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                            <h4 className="text-[20px] font-semibold tracking-tight text-[#152332]">MediaLocate Config</h4>
                            <div className="mt-8 space-y-5">
                              <SectionField label="Target language">
                                <select value={mediaLocateLanguage} onChange={(event) => setMediaLocateLanguage(event.target.value)} className="h-14 w-full rounded-xl border border-[#d8e1ea] bg-white px-4 text-[16px] outline-none focus:border-[#2fa4d6]">
                                  {TRANSLATION_LOCALES.map((locale) => <option key={locale.locales} value={locale.locales}>{locale.description}</option>)}
                                </select>
                              </SectionField>
                              <SectionField label="Project Name">
                                <input value={mediaLocateProjectName} onChange={(event) => setMediaLocateProjectName(event.target.value)} placeholder="Optional project name" className="h-14 w-full rounded-xl border border-[#d8e1ea] bg-white px-4 text-[16px] outline-none focus:border-[#2fa4d6]" />
                              </SectionField>
                              <SectionField label="Project Description">
                                <textarea value={mediaLocateDescription} onChange={(event) => setMediaLocateDescription(event.target.value)} rows={5} className="w-full rounded-xl border border-[#d8e1ea] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#2fa4d6]" />
                              </SectionField>
                              <SectionField label="Tracking code">
                                <input value={mediaLocateTrackingCode} onChange={(event) => setMediaLocateTrackingCode(event.target.value)} placeholder="Tracking code" className="h-14 w-full rounded-xl border border-[#d8e1ea] bg-white px-4 text-[16px] outline-none focus:border-[#2fa4d6]" />
                              </SectionField>
                              <SectionField label="Locale">
                                <input value={mediaLocateLocale} onChange={(event) => setMediaLocateLocale(event.target.value)} placeholder="Locale" className="h-14 w-full rounded-xl border border-[#d8e1ea] bg-white px-4 text-[16px] outline-none focus:border-[#2fa4d6]" />
                              </SectionField>
                              <div className="flex flex-wrap gap-3">
                                <ActionButton onClick={() => void handleLoadMediaLocateDetails()} disabled={!courseId} busy={mediaLocateBusy} variant="secondary" label="Load details" busyLabel="Loading details..." />
                                <ActionButton onClick={() => void handleMediaLocateUpload()} disabled={!canUploadMediaLocate} busy={mediaLocateBusy} label="Submit for translation" busyLabel="Submitting..." title={!canUploadMediaLocate ? "A target language is required" : undefined} />
                                <ActionButton onClick={() => void handleMediaLocateStatus()} disabled={!canCheckMediaLocate} busy={mediaLocateBusy} variant="secondary" label="Check status" busyLabel="Checking..." title={!canCheckMediaLocate ? "Tracking code and locale are required" : undefined} />
                                <ActionButton onClick={() => void handleMediaLocateDownload()} disabled={!canCheckMediaLocate} busy={mediaLocateBusy} variant="secondary" label="Get translation" busyLabel="Downloading..." title={!canCheckMediaLocate ? "Tracking code and locale are required" : undefined} />
                                <ActionButton onClick={() => void handleMediaLocateCancel()} disabled={!canCancelMediaLocate} busy={mediaLocateBusy} variant="danger" label="Cancel project" busyLabel="Cancelling..." title={!canCancelMediaLocate ? "Tracking code is required" : undefined} />
                              </div>
                              {mediaLocateMessage ? <Notice tone="success" title="MediaLocate update">{mediaLocateMessage}</Notice> : null}
                              {mediaLocateError ? <Notice tone="error" title="MediaLocate issue">{mediaLocateError}</Notice> : null}
                            </div>
                          </section>

                          <section className="rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                            <h4 className="text-[20px] font-semibold tracking-tight text-[#152332]">MediaLocate Service</h4>
                            <p className="mt-4 text-[16px] leading-7 text-[#475467]">Endpoint configured on the server</p>
                            <div className="mt-6 space-y-5 text-[16px] text-[#152332]">
                              <div className="flex items-start justify-between gap-4"><span>Environment:</span><strong>{mediaLocateDetails?.environment || "Test"}</strong></div>
                              <div className="flex items-start justify-between gap-4 break-all"><span>Endpoint:</span><strong>{mediaLocateDetails?.baseUrl || "https://tma-test.medialocate.com/TMAService.asmx/"}</strong></div>
                              <div className="flex items-start justify-between gap-4"><span>Credentials:</span><strong>{mediaLocateDetails ? "Available" : "Missing"}</strong></div>
                              <div className="flex items-start justify-between gap-4"><span>Format:</span><strong>XLIFF 1.2 (zipped)</strong></div>
                            </div>
                          </section>
                        </>
                      )}
                    </div>
                  </>
                ) : null}

                {activeTab === "xliff" ? (
                  <section className="rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                    <h3 className="text-[22px] font-semibold tracking-tight text-[#152332]">XLIFF Export &amp; Upload</h3>
                    <div className="mt-8 space-y-8">
                      <div>
                        <h4 className="text-[20px] font-semibold tracking-tight text-[#152332]">Export Translation File</h4>
                        <div className="mt-5 space-y-4 text-[16px] text-[#152332]">
                          <label className="flex items-center gap-3">
                            <input type="checkbox" checked={xliffIncludeExternalAssets} onChange={(event) => setXliffIncludeExternalAssets(event.target.checked)} className="h-5 w-5 rounded border-[#98a2b3] text-[#2fa4d6] focus:ring-[#2fa4d6]" />
                            Include links to external assets
                          </label>
                          <label className="flex items-center gap-3">
                            <input type="checkbox" checked={xliffIncludeEmptyTarget} onChange={(event) => setXliffIncludeEmptyTarget(event.target.checked)} className="h-5 w-5 rounded border-[#98a2b3] text-[#2fa4d6] focus:ring-[#2fa4d6]" />
                            Include empty <code className="rounded bg-[#f2f4f7] px-1 py-0.5 text-sm">&lt;target&gt;</code> tag attributes
                          </label>
                          <ActionButton onClick={() => void handleExportXliff()} disabled={!canExportXliff} busy={xliffBusy} label="Export XLIFF File" busyLabel="Exporting XLIFF..." title={!canExportXliff ? "Choose a target language first" : undefined} />
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[20px] font-semibold tracking-tight text-[#152332]">Upload Translated File</h4>
                        <div className="mt-5 space-y-4">
                          <SectionField label="Translation Language">
                            <select value={xliffUploadLanguage} onChange={(event) => setXliffUploadLanguage(event.target.value)} className="h-14 w-full rounded-xl border border-[#d8e1ea] bg-white px-4 text-[16px] outline-none focus:border-[#2fa4d6]">
                              {TRANSLATION_LOCALES.map((locale) => <option key={locale.locales} value={locale.locales}>{locale.description}</option>)}
                            </select>
                          </SectionField>
                          <label className="flex min-h-[88px] cursor-pointer items-center justify-between rounded-[14px] border-2 border-dashed border-[#cfd8e3] bg-[#fafcff] px-5 py-4 text-[16px] text-[#475467] transition hover:border-[#2fa4d6] hover:bg-[#f5fbfe]">
                            <span>{xliffFile ? xliffFile.name : "Choose a translated .xliff or .xlf file"}</span>
                            <input type="file" accept=".xliff,.xlf" className="hidden" onChange={(event) => setXliffFile(event.target.files?.[0] || null)} />
                          </label>
                          <div className="flex flex-wrap gap-3">
                            <ActionButton onClick={() => void handleImportXliff()} disabled={!canImportXliff} busy={xliffBusy} label="Import translation" busyLabel="Importing translation..." title={!xliffFile ? "Select a translated XLIFF file first" : undefined} />
                            <ActionButton onClick={() => setXliffFile(null)} disabled={!xliffFile} variant="secondary" label="Clear file" />
                          </div>
                          {!translationUploaded ? <Notice tone="info" title="Confirm step remains locked">Step 3 unlocks only after the translated file has been imported successfully.</Notice> : null}
                          {xliffMessage ? <Notice tone="success" title="Import completed">{xliffMessage}</Notice> : null}
                          {xliffError ? <Notice tone="error" title="Import failed">{xliffError}</Notice> : null}
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {activeTab === "ai" ? (
                  <>
                    <section className="rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                      <h3 className="text-[22px] font-semibold tracking-tight text-[#152332]">AI Translation (LEATS)</h3>
                      <p className="mt-4 text-[16px] leading-7 text-[#475467]">Translate this course automatically with Azure OpenAI (gpt-4o-mini). Strings are sent to the model in chunks and a new translated course is created on completion - no manual export/import required.</p>
                    </section>

                    {translationUploaded ? (
                      <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-5 py-5 text-emerald-900 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                        <div className="flex items-start gap-4">
                          <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xl font-semibold text-white">✓</div>
                          <div>
                            <div className="text-[20px] font-semibold">Translation Complete</div>
                            <p className="mt-2 text-[16px] leading-7">The translated course has been created. Click "Next" to review it.</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <section className="rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                      <h4 className="text-[22px] font-semibold tracking-tight text-[#152332]">Customize AI Translation Instructions</h4>
                      <p className="mt-4 text-[16px] leading-7 text-[#475467]">The default prompt controls how the AI translates your course strings. If you want to adjust tone, terminology, or formatting:</p>
                      <ul className="mt-4 list-disc space-y-2 pl-6 text-[16px] leading-7 text-[#475467]">
                        <li>Select <strong>Edit</strong> to update the prompt.</li>
                        <li>Select <strong>Save</strong> to keep your changes during this workflow.</li>
                        <li>Select <strong>Download</strong> to export the prompt as a text file for future courses.</li>
                      </ul>
                      <p className="mt-4 text-[16px] leading-7 text-[#475467]">These instructions will be used when the AI translation runs.</p>

                      <div className="mt-5 space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <SectionField label="Target language">
                            <select value={leatsLanguage} onChange={(event) => setLeatsLanguage(event.target.value)} className="h-14 w-full rounded-xl border border-[#d8e1ea] bg-white px-4 text-[16px] outline-none focus:border-[#2fa4d6]">
                              {(leatsConfig?.languages.length ? leatsConfig.languages : TRANSLATION_LOCALES.map((locale) => ({ locales: locale.locales, description: locale.description }))).map((locale) => <option key={locale.locales} value={locale.locales}>{locale.description}</option>)}
                            </select>
                          </SectionField>
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Prompt mode</span>
                            <div className="flex items-center gap-3 rounded-2xl border border-[#e4eaf0] bg-[#f8fafc] px-4 py-4 text-[15px] text-[#344054]"><input type="checkbox" checked={leatsEditingPrompt} onChange={(event) => setLeatsEditingPrompt(event.target.checked)} /> Use custom prompt for this run</div>
                          </label>
                        </div>
                        <label className="flex items-center gap-3 rounded-2xl border border-[#e4eaf0] bg-[#f8fafc] px-4 py-4 text-[15px] text-[#344054]"><input type="checkbox" checked={leatsIncludeExternalAssets} onChange={(event) => setLeatsIncludeExternalAssets(event.target.checked)} /> Include external asset links</label>
                        <SectionField label={leatsEditingPrompt ? "Custom prompt" : "Prompt preview"} hint="Save or reset the prompt content before starting the translation run.">
                          {leatsEditingPrompt ? (
                            <textarea value={leatsPromptDraft} onChange={(event) => setLeatsPromptDraft(event.target.value)} rows={14} className="w-full rounded-2xl border border-[#d0d9e2] bg-white px-4 py-3 text-[15px] leading-6 text-[#152332] outline-none focus:border-[#236585]" />
                          ) : (
                            <textarea value={leatsPrompt || leatsPromptDraft} readOnly rows={14} className="w-full rounded-2xl border border-[#e4eaf0] bg-[#f8fafc] px-4 py-3 text-[15px] leading-6 text-[#152332] outline-none" />
                          )}
                        </SectionField>
                        <div className="flex flex-wrap gap-3">
                          <ActionButton onClick={() => void handleStartAiTranslation()} disabled={!canStartAi} busy={leatsBusy} label="Start translation" busyLabel="Starting translation..." title={!canStartAi ? "AI configuration and target language are required" : undefined} />
                          <ActionButton onClick={() => { setLeatsPromptDraft(leatsPrompt); setLeatsEditingPrompt(false); }} disabled={!leatsPrompt && !leatsPromptDraft} variant="secondary" label="Reset prompt" />
                          <ActionButton onClick={() => triggerDownload(new Blob([leatsPromptDraft || leatsPrompt || ""], { type: "text/plain;charset=utf-8" }), "leats-translation-prompt.txt")} disabled={!leatsPromptDraft && !leatsPrompt} variant="secondary" label="Download prompt" />
                        </div>
                        <section className="rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                          <h4 className="text-[22px] font-semibold tracking-tight text-[#152332]">Translation Progress</h4>
                          <div className="mt-6 h-4 overflow-hidden rounded-full bg-[#e5e7eb]">
                            <div className="h-full rounded-full bg-[#2c6d88] transition-all duration-500" style={{ width: formatProgressPercent(aiProgressPercent) }} />
                          </div>
                          <div className="mt-5 grid gap-3 text-[15px] text-[#344054] md:grid-cols-3 md:items-center">
                            <span className="font-semibold text-[#1f6a94]">{formatProgressPercent(aiProgressPercent)}</span>
                            <span className="text-center md:text-center">Translated: {aiProgressTranslated} / {aiProgressTotal}</span>
                            <span className="text-right md:text-right">Chunks: {aiProgressChunksDone} / {aiProgressChunksTotal}</span>
                          </div>
                        </section>
                        {leatsMessage ? <Notice tone="success" title="AI workflow update">{leatsMessage}</Notice> : null}
                        {leatsError ? <Notice tone="error" title="AI workflow issue">{leatsError}</Notice> : null}
                      </div>
                    </section>
                  </>
                ) : null}

              </>
            ) : null}

            {currentStep === 3 ? (
              <div className="space-y-5">
                {translationUploaded ? (
                  <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-5 py-5 text-emerald-900 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xl font-semibold text-white">✓</div>
                      <div>
                        <div className="text-[20px] font-semibold">Translation Complete</div>
                        <p className="mt-2 text-[16px] leading-7">The translated course has been created. Click "Finish" to open it.</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <section className="rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                  <h3 className="text-[22px] font-semibold tracking-tight text-[#152332]">Translation Details</h3>
                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <div className="rounded-[16px] border border-[#dbe3ec] bg-[#f8fbff] px-8 py-7">
                      <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#58739a]">Target language</div>
                      <div className="mt-4 text-[20px] font-semibold text-[#152332]">{translationTargetLanguage || previewLanguage}</div>
                    </div>
                    <div className="rounded-[16px] border border-[#dbe3ec] bg-[#f8fbff] px-8 py-7">
                      <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#58739a]">Translation method</div>
                      <div className="mt-4 text-[20px] font-semibold text-[#152332]">{methodLabel}</div>
                    </div>
                    <div className="rounded-[16px] border border-[#dbe3ec] bg-[#f8fbff] px-8 py-7">
                      <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#58739a]">Global strings</div>
                      <div className="mt-4 text-[20px] font-semibold text-[#152332]">{translationGlobalCount} strings</div>
                    </div>
                    <div className="rounded-[16px] border border-[#dbe3ec] bg-[#f8fbff] px-8 py-7">
                      <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#58739a]">Course strings</div>
                      <div className="mt-4 text-[20px] font-semibold text-[#152332]">{translationCourseCount} strings</div>
                    </div>
                  </div>
                  <div className="mt-8 border-t border-[#e4e7ec] pt-6">
                    {translationCourseResultId ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <SummaryItem label="Result course id" value={translationCourseResultId} tone="break-all" />
                        <SummaryItem label="Ready state" value="Ready" tone="text-emerald-700" />
                        {leatsJob ? <SummaryItem label="Translated unique strings" value={`${leatsJob.translated} / ${leatsJob.totalUnique || leatsJob.totalStrings}`} /> : null}
                        {leatsJob ? <SummaryItem label="Chunks processed" value={`${leatsJob.chunksDone} / ${leatsJob.totalChunks || 0}`} /> : null}
                      </div>
                    ) : (
                      <Notice tone="warning" title="Awaiting translation result">Complete an import, partner download, or AI run in step 2 to populate the translated course details here.</Notice>
                    )}
                  </div>
                </section>
              </div>
            ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#e1e7ef] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <ActionButton onClick={goToPreviousStep} disabled={currentStep === 1} variant="secondary" label="Previous" />
                <div className="flex flex-wrap items-center gap-3">
                  {currentStep === 1 ? <ActionButton onClick={goToNextStep} disabled={!canMoveToMethods} label="Next" /> : null}
                  {currentStep === 2 ? <ActionButton onClick={goToNextStep} disabled={!canMoveToConfirm} label={translationUploaded ? "Next" : "Complete a translation first"} title={!translationUploaded ? "Import or download a translated course to unlock the confirm step" : undefined} /> : null}
                  {currentStep === 3 ? <ActionButton onClick={openTranslatedCourse} disabled={!translationCourseResultId} label="Finish" title={!translationCourseResultId ? "No translated course is available yet" : undefined} /> : null}
                </div>
              </div>
          </div>
        </div>
      </div>
  );
}

export default TranslationPage;