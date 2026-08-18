import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../utils/constants";
import {
  getCdnDeploymentSettings,
  saveCdnDeploymentSettings,
  getCdnVersion,
  getCdnPreviousLinks,
  checkCdnLinkStatuses,
  restoreCdnLink,
  setCdnLinkExpiry,
  CDN_STORAGE_CONTAINERS,
  type CdnDeploymentSettings,
  type CdnLinkEntry,
} from "../../api/adaptAuthoring";
import { UnsavedChangesModal } from "./unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";

/* ── Shared bits (mirrors NavigationPage's conventions) ─────────────────── */

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function Toast({ toast, onDismiss }: { toast: { type: "success" | "error"; message: string }; onDismiss: () => void }) {
  return (
    <div className="fixed top-4 right-4 z-[60] pointer-events-none">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border pointer-events-auto animate-fade-in-down min-w-[260px] max-w-sm ${
          toast.type === "success"
            ? "bg-[var(--life-positive-050)] border-[var(--life-positive-100)] text-[var(--life-positive-500)]"
            : "bg-[var(--life-critical-050)] border-[var(--life-critical-100)] text-[var(--life-critical-500)]"
        }`}
      >
        {toast.type === "success" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-positive-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-critical-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
        <span className="flex-1">{toast.message}</span>
        <button type="button" onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity ml-1" aria-label="Dismiss">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Collapsible card — same visual language as NavigationPage's NavAccordion, but
// independently toggleable (both CDN Config and Course Deployment default open).
function Section({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[var(--life-primary-020)] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[#6b7280]">{icon}</span>
          <h3 className="text-sm font-bold text-[var(--life-base-black)]">{title}</h3>
        </div>
        <svg
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--life-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-[#f3f4f6] flex flex-col gap-3">{children}</div>}
    </div>
  );
}

function CheckboxRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 py-1 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
          checked ? "bg-[var(--life-primary-500)] border-[var(--life-primary-500)]" : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
        }`}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span className="text-sm font-semibold text-[var(--life-base-black)]">{label}</span>
    </label>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <span className="text-xs font-semibold text-[#374151] flex items-center gap-1">
      {label}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </span>
  );
}

function TextField({
  label, hint, value, onChange, placeholder,
}: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel label={label} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent transition-colors"
      />
      {hint && <p className="text-[11px] text-[#9ca3af] leading-snug">{hint}</p>}
    </div>
  );
}

function SelectField({
  label, hint, value, onChange, options,
}: { label: string; hint?: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel label={label} />
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[#111827] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent pr-8"
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {hint && <p className="text-[11px] text-[#9ca3af] leading-snug">{hint}</p>}
    </div>
  );
}

/* ── URL rewriting (mirrors cdnCourseView.js) ───────────────────────────────
   Deployed course links are opened in "CDN mode" so the served build knows it's
   being previewed from the authoring tool, not accessed directly. */
function appendIsCDNModeParam(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("isCDNMode", "true");
    if (url.startsWith("//")) return "//" + u.host + u.pathname + u.search + u.hash;
    if (url.startsWith("/")) return u.pathname + u.search + u.hash;
    return u.toString();
  } catch {
    return url;
  }
}

function appendCDNParamsToHtml(html: string): string {
  return html.replace(/href="([^"]+)"/g, (match, url) => {
    const updated = appendIsCDNModeParam(url);
    return updated !== url ? `href="${updated}"` : match;
  });
}

type LogEventType = "open" | "message" | "link" | "close" | "server-error";

interface LogEntry {
  id: number;
  eventType: LogEventType;
  timestamp: string;
  message?: string;
  specificHtml?: string;
  latestHtml?: string;
  comment?: string;
  triggeredBy?: string;
}

type LinkStatus = "active" | "not-found" | "network-error" | "inactive";

interface DisplayLinkEntry extends CdnLinkEntry {
  href: string;
  status: LinkStatus;
}

function classifyStatus(statusCode: number | undefined): LinkStatus {
  if (statusCode === undefined || statusCode === 0) return "network-error";
  if (statusCode >= 200 && statusCode < 400) return "active";
  if (statusCode === 404) return "not-found";
  return "inactive";
}

const STATUS_BADGE: Record<LinkStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "text-[var(--life-positive-500)]" },
  "not-found": { label: "Not found", className: "text-[var(--life-critical-500)]" },
  "network-error": { label: "Network error", className: "text-[var(--life-warning-500)]" },
  inactive: { label: "Inactive", className: "text-[#9ca3af]" },
};

/* ── CDN Deployment Page ─────────────────────────────────────────────────── */

export function CdnDeploymentPage({
  courseId,
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
}: {
  courseId: string;
  onNavigationRequest?: (nav: string) => void;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
}) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<CdnDeploymentSettings | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<CdnDeploymentSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [cdnCliVersion, setCdnCliVersion] = useState("");

  const [includeExport, setIncludeExport] = useState(false);

  const [building, setBuilding] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logIdRef = useRef(0);

  const [linksLoading, setLinksLoading] = useState(false);
  const [links, setLinks] = useState<DisplayLinkEntry[]>([]);
  const [restoringEntry, setRestoringEntry] = useState<string | null>(null);
  const [restoredEntries, setRestoredEntries] = useState<Set<string>>(new Set());
  const [expiryTarget, setExpiryTarget] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [expirySaving, setExpirySaving] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const dirty = !!cfg && !!savedSnapshot && JSON.stringify(cfg) !== JSON.stringify(savedSnapshot);

  async function loadPreviousLinks(settings: CdnDeploymentSettings) {
    setLinksLoading(true);
    try {
      const data = await getCdnPreviousLinks(settings.groupid, settings.courseid, settings.cdnid);
      const statuses = await checkCdnLinkStatuses(data.map((entry) => entry.link));
      const statusMap = new Map(statuses.map((s) => [s.url, s.statusCode] as const));
      setLinks(
        data.map((entry) => ({
          ...entry,
          href: appendIsCDNModeParam(entry.link),
          status: classifyStatus(statusMap.get(entry.link)),
        })),
      );
    } catch {
      setLinks([]);
    } finally {
      setLinksLoading(false);
    }
  }

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [settings, version] = await Promise.all([
          getCdnDeploymentSettings(courseId),
          getCdnVersion().catch(() => ""),
        ]);
        if (cancelled) return;
        setCfg(settings);
        setSavedSnapshot(settings);
        setCdnCliVersion(version);
        if (settings.isEnabled) void loadPreviousLinks(settings);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Close any open SSE stream when the panel unmounts.
  useEffect(() => () => eventSourceRef.current?.close(), []);

  function set(patch: Partial<CdnDeploymentSettings>) {
    setCfg((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function persist(next: CdnDeploymentSettings): Promise<boolean> {
    if (!courseId) return false;
    setSaving(true);
    try {
      await saveCdnDeploymentSettings(courseId, next);
      setSavedSnapshot(next);
      if (next.isEnabled) void loadPreviousLinks(next);
      else setLinks([]);
      return true;
    } catch {
      setToast({ type: "error", message: "Couldn't save. Please try again." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!cfg) return;
    const ok = await persist(cfg);
    setToast(ok ? { type: "success", message: "Changes saved successfully" } : null);
  }

  function handleCancel() {
    setCfg(savedSnapshot);
  }

  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } =
    useUnsavedChangesNavigationGuard({
      hasChanges: dirty,
      pendingNavigation,
      onPendingNavigationHandled,
      onNavigate: onNavigationRequest,
    });

  async function handleConfirmSave() {
    if (!cfg) return;
    const ok = await persist(cfg);
    const navTarget = consumePendingNavigation();
    setToast(ok ? { type: "success", message: "Changes saved successfully" } : null);
    if (ok && navTarget) onNavigationRequest?.(navTarget);
  }

  function handleConfirmDiscard() {
    setCfg(savedSnapshot);
    const navTarget = consumePendingNavigation();
    if (navTarget) onNavigationRequest?.(navTarget);
  }

  function appendLog(entry: Omit<LogEntry, "id" | "timestamp">) {
    setLogEntries((prev) => [...prev, { ...entry, id: ++logIdRef.current, timestamp: new Date().toLocaleString() }]);
  }

  function handleTriggerBuild() {
    if (!cfg || building) return;
    setBuilding(true);
    setLogEntries([]);

    const url = new URL(`${API_BASE_URL}/api/cdn/deploy`, window.location.origin);
    // "courseid" must be the authoring tool's real course _id (used server-side to
    // look up and export/publish the course); "courseName" is the CDN config's own
    // textual course identifier, passed through to the `cdndeploy` CLI as --courseid.
    url.searchParams.append("courseid", courseId);
    url.searchParams.append("includeExport", String(includeExport));
    url.searchParams.append("cdnid", cfg.cdnid);
    url.searchParams.append("groupName", cfg.groupid);
    url.searchParams.append("courseName", cfg.courseid);
    url.searchParams.append("version", cfg.version);

    const es = new EventSource(url.toString());
    eventSourceRef.current = es;

    es.onopen = () => appendLog({ eventType: "open", message: "🟢 Connection open" });

    es.onmessage = (event) => {
      const data = event.data as string;
      const urlMatch = data.match(/(https?:\/\/[^\s]+)/g);
      if (urlMatch) {
        const specificMatch = data.match(/<div class="specific">([\s\S]*?)<\/div>/);
        const latestMatch = data.match(/<div class="latest">([\s\S]*?)<\/div>/);
        appendLog({
          eventType: "link",
          specificHtml: specificMatch ? appendCDNParamsToHtml(specificMatch[1]) : undefined,
          latestHtml: latestMatch ? appendCDNParamsToHtml(latestMatch[1]) : undefined,
          comment: cfg.buildTriggerComment,
          triggeredBy: user?.email,
        });
      } else {
        appendLog({ eventType: "message", message: data });
      }
    };

    const stop = () => {
      appendLog({ eventType: "close", message: "⚫ Connection closed" });
      setBuilding(false);
      es.close();
      void loadPreviousLinks(cfg);
    };
    es.onerror = stop;
    es.addEventListener("server-error", (event) => {
      appendLog({ eventType: "server-error", message: (event as MessageEvent).data });
      stop();
    });
  }

  async function handleRestore(entry: DisplayLinkEntry) {
    if (!cfg) return;
    setRestoringEntry(entry.entry);
    try {
      const result = await restoreCdnLink(cfg.groupid, cfg.courseid, cfg.cdnid, entry.entry);
      if (!result.length) throw new Error("No links found.");
      setRestoredEntries((prev) => new Set(prev).add(entry.entry));
      setToast({ type: "success", message: "Link restored successfully" });
    } catch {
      setToast({
        type: "error",
        message: "Restore unsuccessful. Please refresh the previous links and try again.",
      });
    } finally {
      setRestoringEntry(null);
    }
  }

  async function handleSetExpiry(entry: DisplayLinkEntry) {
    if (!cfg || !expiryDate) return;
    setExpirySaving(true);
    try {
      const result = await setCdnLinkExpiry(cfg.groupid, cfg.courseid, cfg.cdnid, entry.entry, expiryDate);
      if (!result.length) throw new Error("No links found.");
      setToast({ type: "success", message: "Expiry date set successfully for this version" });
      setExpiryTarget(null);
      setExpiryDate("");
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to set expiry." });
    } finally {
      setExpirySaving(false);
    }
  }

  const canTrigger = !!cfg?.isEnabled && !!cfg.cdnid && !!cfg.groupid && !!cfg.courseid && !!cfg.version && !building;

  return (
    <div className="flex flex-col h-full w-full bg-[#f7f9fb]">
      {/* Header */}
      <div className="shrink-0 px-6 py-5 bg-white border-b border-[#e5e7eb]">
        <h2 className="text-xl font-bold text-[var(--life-base-black)]">CDN Deployment</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Configure CDN targets and deploy this course to the storage container.</p>
        {cdnCliVersion && (
          <p className="text-xs text-[#9ca3af] mt-2">NPM <span className="font-mono">cdndeploy</span> version: {cdnCliVersion}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl px-6 py-6 flex flex-col gap-3">
          {loading || !cfg ? (
            <div className="flex items-center justify-center py-16 text-sm text-[#6b7280] gap-2">
              <Spinner /> Loading CDN deployment settings…
            </div>
          ) : (
            <>
              {/* CDN Config */}
              <Section
                title="CDN Config"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                }
              >
                <CheckboxRow checked={cfg.isEnabled} onChange={(v) => set({ isEnabled: v })} label="Is Enabled" />

                {cfg.isEnabled && (
                  <div className="flex flex-col gap-3 mt-1">
                    <SelectField
                      label="CDN Storage Container"
                      hint="Name of the storage container."
                      value={cfg.cdnid}
                      onChange={(v) => set({ cdnid: v })}
                      options={CDN_STORAGE_CONTAINERS}
                    />
                    <TextField
                      label="Project"
                      hint="The program this module/course belongs to."
                      value={cfg.groupid}
                      onChange={(v) => set({ groupid: v })}
                    />
                    <TextField
                      label="Course Id"
                      hint="Name of the course in the program."
                      value={cfg.courseid}
                      onChange={(v) => set({ courseid: v })}
                    />
                    <TextField
                      label="Version"
                      hint="Version string, appears in course pages."
                      value={cfg.version}
                      onChange={(v) => set({ version: v })}
                    />
                    <TextField
                      label="Build Trigger Comment"
                      hint="Message recorded with this deployment."
                      value={cfg.buildTriggerComment}
                      onChange={(v) => set({ buildTriggerComment: v })}
                    />
                  </div>
                )}
              </Section>

              {/* Course Deployment */}
              <Section
                title="Course Deployment"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                }
              >
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includeExport}
                    onChange={(e) => setIncludeExport(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--life-primary-500)]"
                  />
                  <span className="text-sm text-[#374151]">
                    Include the <strong>source code*</strong> as part of the CDN deployment.
                    <span className="block mt-1 text-xs text-[#9ca3af]">
                      *Same bundle as when you "Export" a course from the Authoring Tool. Useful for debugging courses after they have been deployed.
                      <span className="block mt-0.5"><strong>Note:</strong> This extra build step will slow down CDN deployment.</span>
                    </span>
                  </span>
                </label>

                <div className="flex items-center justify-between gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => void loadPreviousLinks(cfg)}
                    disabled={!cfg.isEnabled || linksLoading}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-[var(--life-base-black)] bg-white border border-[#e5e7eb] hover:bg-[#f9fafb] disabled:opacity-50 transition-colors"
                  >
                    {linksLoading ? (
                      <Spinner />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                    )}
                    Get Previous Links
                  </button>
                  <button
                    type="button"
                    onClick={handleTriggerBuild}
                    disabled={!canTrigger}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:opacity-50 transition-colors"
                  >
                    {building && <Spinner />}
                    {building ? "Building…" : "Trigger CDN Build"}
                  </button>
                </div>
                {!cfg.isEnabled && <p className="text-xs text-[#9ca3af] -mt-1">Enable the CDN config above to deploy.</p>}

                {/* Build output */}
                {logEntries.length > 0 && (
                  <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2.5 flex flex-col gap-2.5 max-h-64 overflow-y-auto">
                    {logEntries.map((entry) => (
                      <div key={entry.id} className="text-xs text-[#374151] border-b border-[#f3f4f6] pb-2 last:border-b-0 last:pb-0">
                        <span className="text-[#9ca3af] mr-2">{entry.timestamp}</span>
                        {entry.eventType === "link" ? (
                          <div className="mt-1 flex flex-col gap-1">
                            {entry.triggeredBy && <p className="text-[#6b7280]">Triggered by: {entry.triggeredBy}</p>}
                            {entry.comment && <p className="italic text-[#6b7280]">Comment: {entry.comment}</p>}
                            {entry.specificHtml && <div dangerouslySetInnerHTML={{ __html: entry.specificHtml }} />}
                            {entry.latestHtml && <div dangerouslySetInnerHTML={{ __html: entry.latestHtml }} />}
                          </div>
                        ) : (
                          <span>{entry.message}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Previous versions */}
                {cfg.isEnabled && (
                  <div className="rounded-lg border border-[#e5e7eb] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-[#f9fafb] text-left">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-[#374151]">Version</th>
                          <th className="px-3 py-2 font-semibold text-[#374151]">Date of build</th>
                          <th className="px-3 py-2 font-semibold text-[#374151]">Link Status</th>
                          <th className="px-3 py-2 font-semibold text-[#374151]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linksLoading ? (
                          <tr><td colSpan={4} className="px-3 py-4 text-center text-[#6b7280]"><Spinner className="inline mr-2" />Loading previous versions…</td></tr>
                        ) : links.length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-4 text-center text-[#6b7280]">No previous versions found.</td></tr>
                        ) : (
                          links.map((entry) => {
                            const isLatest = entry.entry === "latest";
                            const restored = restoredEntries.has(entry.entry);
                            const status: LinkStatus = restored ? "active" : entry.status;
                            const badge = STATUS_BADGE[status];
                            return (
                              <tr key={entry.entry} className="border-t border-[#f3f4f6]">
                                <td className="px-3 py-2">
                                  <a href={entry.href} target="_blank" rel="noreferrer" className="underline text-[var(--life-primary-500)]">
                                    {entry.version ?? entry.entry}
                                  </a>
                                </td>
                                <td className="px-3 py-2 text-[#6b7280]">{entry.timestampPretty ?? "—"}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center gap-1 font-semibold ${badge.className}`}>
                                    {status === "active" && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    )}
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={isLatest || restored || restoringEntry === entry.entry}
                                      onClick={() => void handleRestore(entry)}
                                      className="inline-flex items-center gap-1 rounded border border-[#d1d5db] px-2 py-0.5 text-[11px] text-[#374151] hover:bg-[#f9fafb] disabled:opacity-40 transition-colors"
                                    >
                                      {restoringEntry === entry.entry && <Spinner />}
                                      Restore
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isLatest}
                                      onClick={() => setExpiryTarget((t) => (t === entry.entry ? null : entry.entry))}
                                      className="inline-flex items-center gap-1 rounded border border-[#d1d5db] px-2 py-0.5 text-[11px] text-[#374151] hover:bg-[#f9fafb] disabled:opacity-40 transition-colors"
                                    >
                                      Set Expiry
                                    </button>
                                  </div>
                                  {expiryTarget === entry.entry && (
                                    <div className="mt-2 flex items-center gap-1.5">
                                      <input
                                        type="date"
                                        value={expiryDate}
                                        onChange={(e) => setExpiryDate(e.target.value)}
                                        className="px-2 py-1 text-[11px] rounded border border-[#e5e7eb]"
                                      />
                                      <button
                                        type="button"
                                        disabled={!expiryDate || expirySaving}
                                        onClick={() => void handleSetExpiry(entry)}
                                        className="rounded bg-[var(--life-primary-500)] text-white px-2 py-1 text-[11px] disabled:opacity-50"
                                      >
                                        {expirySaving ? "Saving…" : "Save"}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Tip */}
              <div className="flex items-start gap-2.5 rounded-lg bg-[#fff7ed] border border-[#fed7aa] px-4 py-3">
                <span className="text-base leading-none mt-0.5" aria-hidden="true">💡</span>
                <p className="text-sm text-[#9a3412] leading-snug">
                  <span className="font-semibold">Tip:</span> Edit the config above and click Trigger CDN Build to publish a new version. Use Restore on a previous version to promote it back to active.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating "Unsaved changes" bar */}
      {!loading && dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-[var(--life-warning-100)] shadow-lg animate-fade-in-down">
          <span className="flex items-center gap-2 text-sm text-[#374151]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-warning-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCancel} disabled={saving} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--life-base-white)] bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:opacity-50 rounded-lg transition-colors">
              {saving && <Spinner />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}

      <UnsavedChangesModal
        isOpen={showConfirmModal}
        isSaving={saving}
        onDiscard={handleConfirmDiscard}
        onSave={() => void handleConfirmSave()}
        onClose={clearPendingNavigation}
      />
    </div>
  );
}
