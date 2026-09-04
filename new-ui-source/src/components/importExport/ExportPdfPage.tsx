import { useEffect, useId, useRef, useState } from "react";
import { UnsavedChangesModal } from "../../pages/setup/unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "../../pages/setup/useUnsavedChangesNavigationGuard";
import { ensureCoursePreview } from "../../api/adaptAuthoring";
import { useAuth } from "../../context/AuthContext";
import AssetPickerModal from "../common/AssetPickerModal";
import {
  DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS,
  getValidatorEnablerPdfSettings,
  saveValidatorEnablerPdfSettings,
  type ValidatorEnablerPdfSettings,
} from "../../helpers/importExportHelper";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9ca3af]">{children}</div>;
}

function Divider() {
  return <div className="h-px bg-[#e5e7eb]" />;
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 py-1 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-[#d1d5db] accent-[#2d6fa8] cursor-pointer"
      />
      <span className="text-sm text-[#374151] leading-snug group-hover:text-[#111827] transition-colors">{label}</span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#6b7280]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#6b7280]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors resize-y"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#6b7280]">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="w-full appearance-none rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 pr-8 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
        >
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6fa8] ${
        checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "bg-[#e5e7eb] border-[#e5e7eb]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
      <span className="text-sm font-semibold text-[var(--life-base-black)] leading-snug">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </label>
  );
}

function ImageIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function AssetPicker({
  label,
  source,
  onSourceChange,
  url,
  onUrlChange,
  onChooseLibrary,
}: {
  label: string;
  source: "library" | "url";
  onSourceChange: (value: "library" | "url") => void;
  url: string;
  onUrlChange: (value: string) => void;
  onChooseLibrary: () => void;
}) {
  const libraryId = useId();
  const urlId = useId();
  const [urlPreviewFailed, setUrlPreviewFailed] = useState(false);

  useEffect(() => {
    setUrlPreviewFailed(false);
  }, [url]);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <div className="inline-flex self-start overflow-hidden rounded-lg border border-[#d1d5db] bg-white">
        <button
          type="button"
          onClick={() => {
            onSourceChange("library");
            onChooseLibrary();
          }}
          className={`px-4 py-2 text-[13px] font-semibold transition-colors ${
            source === "library" ? "bg-[#2d6fa8] text-white" : "bg-white text-[#374151] hover:bg-[#f8fafc]"
          }`}
          aria-pressed={source === "library"}
        >
          From Asset Library
        </button>
        <button
          type="button"
          onClick={() => onSourceChange("url")}
          className={`border-l border-[#d1d5db] px-4 py-2 text-[13px] font-semibold transition-colors ${
            source === "url" ? "bg-[#2d6fa8] text-white" : "bg-white text-[#374151] hover:bg-[#f8fafc]"
          }`}
          aria-pressed={source === "url"}
        >
          From URL
        </button>
      </div>

      {source === "library" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5">
            <span className="text-[#9ca3af] shrink-0">
              <ImageIcon />
            </span>
            <span className={`flex-1 text-[13px] ${url ? "text-[#374151]" : "text-[#9ca3af]"}`}>
              {url ? "Asset selected" : "No asset selected"}
            </span>
            <button
              id={libraryId}
              type="button"
              onClick={onChooseLibrary}
              className="rounded-md border border-[#d1d5db] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#374151] transition-colors hover:bg-[#f3f4f6]"
            >
              {url ? "Change" : "Browse"}
            </button>
          </div>
          {url && (
            <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f8fafc]">
              <img
                src={url}
                alt={`${label} preview`}
                className="h-36 w-full object-contain bg-white"
              />
            </div>
          )}
        </div>
      ) : (
        <label htmlFor={urlId} className="sr-only">{label} URL</label>
      )}

      {source === "url" && (
        <div className="flex flex-col gap-2">
          <input
            id={urlId}
            type="text"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://example.com/image.png"
            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
          />
          {url.trim() && !urlPreviewFailed && (
            <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f8fafc]">
              <img
                src={url.trim()}
                alt={`${label} URL preview`}
                className="h-36 w-full object-contain bg-white"
                onError={() => setUrlPreviewFailed(true)}
              />
            </div>
          )}
          {url.trim() && urlPreviewFailed && (
            <p className="text-xs text-[#b91c1c]">Unable to load image from this URL.</p>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_SETTINGS: ValidatorEnablerPdfSettings = DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS;

export default function ExportPdfPage({
  courseId,
  courseTitle,
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
}: {
  courseId: string;
  courseTitle?: string;
  onNavigationRequest?: (nav: string) => void;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
}) {
  const { user } = useAuth();
  const exportWindowRef = useRef<Window | null>(null);
  const [cfg, setCfg] = useState<ValidatorEnablerPdfSettings>(DEFAULT_SETTINGS);
  const [savedCfg, setSavedCfg] = useState<ValidatorEnablerPdfSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [assetPickerTarget, setAssetPickerTarget] = useState<"cover" | "footer" | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(savedCfg);

  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } =
    useUnsavedChangesNavigationGuard({
      hasChanges: dirty,
      pendingNavigation,
      onPendingNavigationHandled,
      onNavigate: onNavigationRequest,
    });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      try {
        const loaded = await getValidatorEnablerPdfSettings(courseId);
        if (cancelled) return;
        setCfg(loaded);
        setSavedCfg(loaded);
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load validator enabler PDF settings", error);
          setToast({ type: "error", message: "Failed to load saved settings" });
          setCfg(DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS);
          setSavedCfg(DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    async function refreshFromServer() {
      if (dirty || saving) return;
      try {
        const loaded = await getValidatorEnablerPdfSettings(courseId);
        setCfg(loaded);
        setSavedCfg(loaded);
      } catch {
        // Keep current UI state if background refresh fails.
      }
    }

    function handleFocus() {
      void refreshFromServer();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshFromServer();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [courseId, dirty, saving]);

  function setField<K extends keyof ValidatorEnablerPdfSettings>(key: K, value: ValidatorEnablerPdfSettings[K]) {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }

  function handleCancel() {
    setCfg(savedCfg);
    setToast(null);
  }

  async function handleSave(): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    try {
      await saveValidatorEnablerPdfSettings(courseId, cfg);
      setSavedCfg(cfg);
      setToast({ type: "success", message: "Changes saved successfully" });
      return true;
    } catch (error) {
      console.warn("Failed to save validator enabler PDF settings", error);
      setToast({ type: "error", message: "Failed to save changes" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmSave() {
    const saved = await handleSave();
    if (!saved) return;
    const target = consumePendingNavigation();
    if (target) onNavigationRequest?.(target);
  }

  function handleConfirmDiscard() {
    handleCancel();
    const target = consumePendingNavigation();
    if (target) onNavigationRequest?.(target);
  }

  function triggerRuntimePdfExport(previewWindow: Window): Promise<boolean> {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 80;

      const clickExportButton = () => {
        if (previewWindow.closed) {
          resolve(false);
          return;
        }

        attempts += 1;
        const button = previewWindow.document?.querySelector<HTMLButtonElement>("#pdf-export-btn");
        if (button) {
          button.click();
          resolve(true);
          return;
        }

        if (attempts >= maxAttempts) {
          resolve(false);
          return;
        }

        window.setTimeout(clickExportButton, 500);
      };

      window.setTimeout(clickExportButton, 700);
    });
  }

  async function handleExportAsPdf() {
    if (loading || saving || exporting) return;

    if (!cfg.pdfExportEnabled) {
      setToast({ type: "error", message: "Enable PDF export before exporting" });
      return;
    }

    setExporting(true);
    try {
      if (dirty) {
        const saved = await handleSave();
        if (!saved) return;
      }

      const tenantId = user?._tenantId;
      if (!tenantId) {
        setToast({ type: "error", message: "Unable to start PDF export (missing tenant context)" });
        return;
      }

      const ensured = await ensureCoursePreview(tenantId, courseId);
      if (!ensured?.success) {
        setToast({ type: "error", message: ensured?.message || "Unable to prepare preview for PDF export" });
        return;
      }

      setToast({ type: "success", message: "Starting PDF export..." });
      const previewUrl = `/preview/${tenantId}/${courseId}/?isCDNMode=true&_cs=${Date.now()}`;
      const previewWindow = window.open(previewUrl, "preview");

      if (!previewWindow) {
        setToast({ type: "error", message: "Popup blocked. Allow popups and try PDF export again." });
        return;
      }

      exportWindowRef.current = previewWindow;
      previewWindow.focus();

      const exportStarted = await triggerRuntimePdfExport(previewWindow);
      if (!exportStarted) {
        setToast({ type: "error", message: "Could not start PDF export in Preview. Keep Preview open and try again." });
        return;
      }

      setToast({ type: "success", message: "PDF export started in Preview" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex w-full max-w-[672px] flex-col gap-7">
      <div className="flex flex-col gap-1">
        <h1 className="text-[20px] font-bold text-[#111827]">Export as PDF</h1>
      </div>

      {loading ? (
        <section className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-4 text-sm text-[#6b7280]">
          Loading saved PDF settings...
        </section>
      ) : (
      <>
      <section className="flex flex-col gap-3.5">
        <SectionTitle>PDF Export</SectionTitle>
        <ToggleRow label="Enable PDF Export" checked={cfg.pdfExportEnabled} onChange={(value) => setField("pdfExportEnabled", value)} />
      </section>

      {cfg.pdfExportEnabled && (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3.5">
          <SectionTitle>Cover Page</SectionTitle>
          <AssetPicker
            label="Cover Page Image"
            source={cfg.coverPageSource}
            onSourceChange={(value) => setField("coverPageSource", value)}
            url={cfg.coverPageUrl}
            onUrlChange={(value) => setField("coverPageUrl", value)}
            onChooseLibrary={() => setAssetPickerTarget("cover")}
          />
        </section>

        <Divider />

        <section className="flex flex-col gap-3.5">
          <SectionTitle>Table of Contents</SectionTitle>
          <div className="flex flex-col gap-1.5">
            <CheckboxRow label="Include Page Titles in TOC" checked={cfg.tocPageTitles} onChange={(value) => setField("tocPageTitles", value)} />
            <CheckboxRow label="Include Article Titles in TOC" checked={cfg.tocArticleTitles} onChange={(value) => setField("tocArticleTitles", value)} />
            <CheckboxRow label="Include Block Titles in TOC" checked={cfg.tocBlockTitles} onChange={(value) => setField("tocBlockTitles", value)} />
            <CheckboxRow label="Include Component Titles in TOC" checked={cfg.tocComponentTitles} onChange={(value) => setField("tocComponentTitles", value)} />
          </div>
        </section>

        <Divider />

        <section className="flex flex-col gap-3.5">
          <SectionTitle>Document Metadata</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="PDF Title"
              value={cfg.pdfTitle}
              onChange={(value) => setField("pdfTitle", value)}
              placeholder={courseTitle ? `e.g. ${courseTitle}` : "e.g. Introduction to Digital Marketing"}
            />
            <TextField
              label="PDF Author"
              value={cfg.pdfAuthor}
              onChange={(value) => setField("pdfAuthor", value)}
              placeholder="e.g. Laerdal Medical"
            />
            <TextField
              label="PDF Subject"
              value={cfg.pdfSubject}
              onChange={(value) => setField("pdfSubject", value)}
              placeholder="e.g. Healthcare Training"
            />
            <TextField
              label="PDF Copyright"
              value={cfg.pdfCopyright}
              onChange={(value) => setField("pdfCopyright", value)}
              placeholder="e.g. © 2026 Laerdal Medical"
            />
          </div>
        </section>

        <Divider />

        <section className="flex flex-col gap-3.5">
          <SectionTitle>Footer</SectionTitle>
          <AssetPicker
            label="PDF Footer Logo"
            source={cfg.footerLogoSource}
            onSourceChange={(value) => setField("footerLogoSource", value)}
            url={cfg.footerLogoUrl}
            onUrlChange={(value) => setField("footerLogoUrl", value)}
            onChooseLibrary={() => setAssetPickerTarget("footer")}
          />
        </section>

        <Divider />

        <section className="flex flex-col gap-3.5">
          <SectionTitle>Password Protection</SectionTitle>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Toggle checked={cfg.passwordEnabled} onChange={(value) => setField("passwordEnabled", value)} />
              <span className="text-sm text-[#374151]">Enable Password Protection</span>
            </label>
            {cfg.passwordEnabled && (
              <div className="grid grid-cols-1 gap-4 border-l-2 border-[#e5e7eb] pl-4 md:grid-cols-2">
                <TextField
                  label="User Password"
                  type="password"
                  value={cfg.userPassword}
                  onChange={(value) => setField("userPassword", value)}
                  placeholder="Enter user password"
                />
                <TextField
                  label="Owner Password (Optional)"
                  type="password"
                  value={cfg.ownerPassword}
                  onChange={(value) => setField("ownerPassword", value)}
                  placeholder="Enter owner password"
                />
              </div>
            )}
          </div>
        </section>

        <Divider />

        <section className="flex flex-col gap-3.5">
          <SectionTitle>Security and Watermark</SectionTitle>
          <div className="flex flex-col gap-1.5">
            <SelectField
              label="Encryption Level"
              value={cfg.encryptionLevel}
              onChange={(value) => setField("encryptionLevel", value)}
              options={["AES-256", "AES-128", "RC4-128"]}
            />
            <div className="pt-1" />
            <CheckboxRow label="Disable Printing" checked={cfg.disablePrinting} onChange={(value) => setField("disablePrinting", value)} />
            <CheckboxRow label="Disable Copying" checked={cfg.disableCopying} onChange={(value) => setField("disableCopying", value)} />
            <CheckboxRow label="Disable Annotation" checked={cfg.disableAnnotation} onChange={(value) => setField("disableAnnotation", value)} />
            <CheckboxRow label="Allow watermarking" checked={cfg.allowWatermarking} onChange={(value) => setField("allowWatermarking", value)} />
            <div className="pt-1" />
            <TextAreaField
              label="Watermark Text"
              value={cfg.watermarkText}
              onChange={(value) => setField("watermarkText", value)}
              placeholder="Enter watermark text"
            />
            <SelectField
              label="Watermark Position"
              value={cfg.watermarkPosition}
              onChange={(value) => setField("watermarkPosition", value)}
              options={["Diagonal", "Top Left", "Top Right", "Bottom Left", "Bottom Right"]}
            />
          </div>
        </section>

        <Divider />

        <div>
          <button
            type="button"
            disabled={saving || exporting || loading}
            onClick={() => void handleExportAsPdf()}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#2d6fa8] px-6 text-sm font-bold text-white transition-colors hover:bg-[#245c8f]"
          >
            <DownloadIcon />
            {exporting ? "Exporting..." : "Export as PDF"}
          </button>
        </div>
      </div>
      )}
      </>
      )}

      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-[var(--life-warning-100)] shadow-lg">
          <span className="flex items-center gap-2 text-sm text-[#374151]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-warning-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--life-base-white)] bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-[60] pointer-events-none">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border pointer-events-auto min-w-[260px] max-w-sm ${
            toast.type === "error"
              ? "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]"
              : "bg-[var(--life-positive-050)] border-[var(--life-positive-100)] text-[var(--life-positive-500)]"
          }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={toast.type === "error" ? "#b91c1c" : "var(--life-positive-500)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              {toast.type === "error" ? <path d="M18 6 6 18M6 6l12 12" /> : <polyline points="20 6 9 17 4 12" />}
            </svg>
            <span className="flex-1">{toast.message}</span>
          </div>
        </div>
      )}

      <UnsavedChangesModal
        isOpen={showConfirmModal}
        isSaving={saving}
        onDiscard={handleConfirmDiscard}
        onSave={() => void handleConfirmSave()}
        onClose={clearPendingNavigation}
      />

      {assetPickerTarget && (
        <AssetPickerModal
          assetType="image"
          onClose={() => setAssetPickerTarget(null)}
          onSelect={(asset) => {
            if (assetPickerTarget === "cover") {
              setField("coverPageSource", "library");
              setField("coverPageUrl", asset.url);
            } else {
              setField("footerLogoSource", "library");
              setField("footerLogoUrl", asset.url);
            }
            setAssetPickerTarget(null);
          }}
        />
      )}
    </div>
  );
}