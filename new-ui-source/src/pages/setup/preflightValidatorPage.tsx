// Preflight Validator settings page (Figma: "Publish ▾" → Preflight Validation).
// A single "Course Evaluation" accordion containing three independently
// collapsible sub-sections (all collapsed by default):
//   1. Course Validation — the 5-check static checklist + "Validation" button,
//      real synchronous results from the existing plugins/output/preflight
//      report endpoint.
//   2. Accessibility Report — expanding it silently installs the Laerdal
//      Validator Enabler extension and enables CDN Deployment (preserving any
//      existing CDN settings) if they aren't already, so the user never has to
//      go find those toggles elsewhere in Course Settings.
//   3. SCORM Validation for LMS — expanding it checks whether SPOOR or
//      HyperBridge is configured (read live from the engine config); if
//      neither is, it shows an alert and a shortcut to Tracking & Analytics
//      instead of the validation controls.
// Both #2 and #3 trigger the existing CDN deploy pipeline and open the
// deployed build in a new tab with the adapt-validator-enabler extension's
// query-param contract (isAccessibilityChecker / isSuspendReport). There is no
// machine-readable result channel for these two checks anywhere in the
// platform today (the extension itself only offers an in-page "Download
// Report" button), so results are surfaced there, not in an integrated panel
// here.
import { useEffect, useRef, useState } from "react";
import {
  getPreflightReport,
  getAccessibilityScormPrerequisites,
  ensureValidatorEnablerEnabled,
  getCdnDeploymentSettings,
  saveCdnDeploymentSettings,
  type PreflightReport,
  type PreflightAssessmentArticle,
  type PreflightCheckIssue,
  type PreflightAssessmentComponent,
  type AccessibilityScormPrerequisites,
} from "../../api/adaptAuthoring";
import { API_BASE_URL } from "../../utils/constants";

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// Outer collapsible accordion shell — mirrors the Section pattern used on the
// CDN Deployment settings page (icon + bold title + rotating chevron).
function Accordion({
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
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#f9fafb] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[#2d6fa8]">{icon}</span>
          <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
        </div>
        <svg
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d6fa8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-[#f3f4f6] flex flex-col gap-4">{children}</div>}
    </div>
  );
}

// Inner, lighter-weight collapsible row used for the three validations inside
// Course Evaluation. Controlled by the parent (`open`/`onToggle`) rather than
// owning its own state, so only one of the three can ever be open at a time —
// expanding one collapses whichever other section was open.
function SubAccordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[#f9fafb] hover:bg-[#f3f4f6] transition-colors text-left"
      >
        <span className="text-sm font-semibold text-[#111827]">{title}</span>
        <svg
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open && <div className="px-4 py-4 bg-white flex flex-col gap-3">{children}</div>}
    </div>
  );
}

// One line of a prerequisite checklist — green check when satisfied, red
// warning + an inline fix action (button) when not.
function PrerequisiteRow({
  label,
  satisfied,
  action,
}: {
  label: string;
  satisfied: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
        satisfied ? "border-[var(--life-positive-100)] bg-[var(--life-positive-050)]" : "border-[#fecaca] bg-[#fef2f2]"
      }`}
    >
      <span className={`flex items-center gap-2 text-xs font-medium ${satisfied ? "text-[var(--life-positive-500)]" : "text-[#991b1b]"}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          {satisfied ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
          )}
        </svg>
        {label}
      </span>
      {!satisfied && action}
    </div>
  );
}

type IssueList = PreflightAssessmentArticle[] | PreflightCheckIssue[];

type ResultItem = PreflightAssessmentArticle & PreflightCheckIssue & PreflightAssessmentComponent;

interface ResultCategory {
  key: keyof PreflightReport;
  title: string;
  describe: (item: ResultItem) => string;
}

const RESULT_CATEGORIES: ResultCategory[] = [
  { key: "duplicateErrors", title: "Duplicate assessment IDs", describe: (a) => `${a.articleTitle || a.articleId}: "${a.assessmentId}"` },
  { key: "asciiErrors", title: "Non-ASCII assessment IDs", describe: (a) => `${a.articleTitle || a.articleId}: "${a.assessmentId}"` },
  { key: "whiteSpaceErrors", title: "Assessment IDs containing whitespace", describe: (a) => `${a.articleTitle || a.articleId}: "${a.assessmentId}"` },
  { key: "blankErrors", title: "Blank assessment IDs", describe: (a) => `${a.articleTitle || a.articleId || "Untitled article"}` },
  { key: "extensionConflicts", title: "Extension conflicts", describe: (i) => i.errorDescription || i.title },
  { key: "extensionDependencies", title: "Missing extension dependencies", describe: (i) => i.errorDescription || i.title },
  { key: "completionCriteriaErrors", title: "Completion criteria issues", describe: (i) => i.errorDescription || i.title },
  { key: "assessmentComponents", title: "Assessment result band routing errors", describe: (i) => i.componentTitle || i.componentId },
];

export function PreflightValidatorPage({
  courseId,
  onNavigationRequest,
}: {
  courseId: string;
  onNavigationRequest?: (nav: string) => void;
}) {
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // Which of the three validation sub-sections is open — mutually exclusive,
  // so expanding one collapses whichever other one was previously open.
  const [expandedSection, setExpandedSection] = useState<"course-validation" | "accessibility-report" | "scorm-validation" | null>(null);
  function toggleSection(id: "course-validation" | "accessibility-report" | "scorm-validation", onOpen?: () => void) {
    setExpandedSection((prev) => {
      const next = prev === id ? null : id;
      if (next === id) onOpen?.();
      return next;
    });
  }

  // Live extension state — drives the SCORM/HyperBridge visibility rule and
  // reflects what the Accessibility Report auto-enable step has just done.
  const [extensionState, setExtensionState] = useState<AccessibilityScormPrerequisites | null>(null);

  const [enablingAccessibilityPrereqs, setEnablingAccessibilityPrereqs] = useState(false);
  const [accessibilityPrereqError, setAccessibilityPrereqError] = useState<string | null>(null);
  const [scormPrereqLoading, setScormPrereqLoading] = useState(false);
  const [enablingValidatorFromScorm, setEnablingValidatorFromScorm] = useState(false);
  const [scormValidatorEnableError, setScormValidatorEnableError] = useState<string | null>(null);

  const [checkingPrereqs, setCheckingPrereqs] = useState(false);
  const [building, setBuilding] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Close any in-flight validation-build SSE stream when the page unmounts —
  // mirrors cdnDeploymentPage.tsx's cleanup for the same underlying endpoint.
  useEffect(() => () => eventSourceRef.current?.close(), []);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      try {
        const state = await getAccessibilityScormPrerequisites(courseId);
        if (!cancelled) setExtensionState(state);
      } catch {
        // Leave extensionState null — SCORM/HyperBridge shows the "not
        // configured" alert until it can be confirmed, and both prerequisite
        // checks are re-run from scratch the next time their section expands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function handleRunCourseEvaluation() {
    if (!courseId) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const data = await getPreflightReport(courseId);
      setReport(data);
    } catch {
      setReportError("Couldn't generate the validation report. Please try again.");
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }

  // Expanding "Accessibility Report": auto-provision its two dependencies so
  // the user never has to go find them elsewhere in Course Settings —
  // Laerdal Validator Enabler (install if missing) and CDN Deployment
  // (enable in place, preserving any existing groupid/courseid/version).
  async function handleExpandAccessibility() {
    if (!courseId) return;
    setAccessibilityPrereqError(null);
    setEnablingAccessibilityPrereqs(true);
    try {
      const validatorEnabled = await ensureValidatorEnablerEnabled(courseId);
      if (!validatorEnabled) {
        setAccessibilityPrereqError(
          "Couldn't automatically enable the Laerdal Validator Enabler extension. Please enable it in Course Settings and try again.",
        );
        return;
      }
      setExtensionState((prev) => (prev ? { ...prev, validatorEnablerInstalled: true } : prev));

      const cdnSettings = await getCdnDeploymentSettings(courseId);
      if (!cdnSettings.isEnabled) {
        await saveCdnDeploymentSettings(courseId, { ...cdnSettings, isEnabled: true });
        setExtensionState((prev) => (prev ? { ...prev, cdnConfigEnabled: true } : prev));
      }
    } catch {
      setAccessibilityPrereqError(
        "Couldn't automatically configure prerequisites (Laerdal Validator Enabler / CDN Deployment). Please check Course Settings and try again.",
      );
    } finally {
      setEnablingAccessibilityPrereqs(false);
    }
  }

  // Expanding "SCORM Validation for LMS": just re-checks live config — SPOOR/
  // HyperBridge is the user's own tracking choice, so unlike Accessibility
  // Report this never auto-enables anything, only reports current state.
  async function handleExpandScorm() {
    if (!courseId) return;
    setScormPrereqLoading(true);
    try {
      const state = await getAccessibilityScormPrerequisites(courseId);
      setExtensionState(state);
    } catch {
      // Keep whatever state we had; the row falls back to the "not
      // configured" alert until a successful check says otherwise.
    } finally {
      setScormPrereqLoading(false);
    }
  }

  // "Enable Now" inline action on the Validator Enabler Configuration row —
  // same underlying auto-enable call used by Accessibility Report, offered
  // here too so the user doesn't have to leave the SCORM section to fix it.
  async function handleEnableValidatorFromScorm() {
    if (!courseId) return;
    setScormValidatorEnableError(null);
    setEnablingValidatorFromScorm(true);
    try {
      const validatorEnabled = await ensureValidatorEnablerEnabled(courseId);
      if (!validatorEnabled) {
        setScormValidatorEnableError("Couldn't automatically enable the Laerdal Validator Enabler extension. Please try again.");
        return;
      }
      setExtensionState((prev) => (prev ? { ...prev, validatorEnablerInstalled: true } : prev));
    } catch {
      setScormValidatorEnableError("Couldn't automatically enable the Laerdal Validator Enabler extension. Please try again.");
    } finally {
      setEnablingValidatorFromScorm(false);
    }
  }

  async function runValidation(options: { accessibility: boolean; scorm: boolean }) {
    if (!courseId || (!options.accessibility && !options.scorm)) return;
    setValidationWarning(null);
    setCheckingPrereqs(true);
    try {
      const [prereqs, cdnSettings] = await Promise.all([
        getAccessibilityScormPrerequisites(courseId),
        getCdnDeploymentSettings(courseId),
      ]);
      setExtensionState(prereqs);

      const missing: string[] = [];
      if (options.accessibility && !prereqs.validatorEnablerInstalled) missing.push("Laerdal Validator Enabler");
      if (options.scorm && !prereqs.trackingExtensionInstalled) missing.push("SPOOR/HyperBridge Extension");
      if (!prereqs.cdnConfigEnabled || !cdnSettings.isEnabled) missing.push("CDN config");

      if (missing.length > 0) {
        setValidationWarning(
          `Missing required extensions: ${missing.join(", ")}. Enable them in Course Settings before running this validation.`,
        );
        return;
      }
      if (!cdnSettings.cdnid || !cdnSettings.groupid || !cdnSettings.courseid || !cdnSettings.version) {
        setValidationWarning("CDN Deployment is not fully configured. Complete the CDN Deployment settings before running this validation.");
        return;
      }

      setBuilding(true);
      setBuildStatus("Preparing validation build…");

      const url = new URL(`${API_BASE_URL}/api/cdn/deploy`, window.location.origin);
      url.searchParams.append("courseid", courseId);
      url.searchParams.append("includeExport", "false");
      url.searchParams.append("cdnid", cdnSettings.cdnid);
      url.searchParams.append("groupName", cdnSettings.groupid);
      url.searchParams.append("courseName", cdnSettings.courseid);
      url.searchParams.append("version", cdnSettings.version);

      const es = new EventSource(url.toString());
      eventSourceRef.current = es;
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        setBuilding(false);
        es.close();
        if (eventSourceRef.current === es) eventSourceRef.current = null;
      };

      es.onmessage = (event) => {
        const data = event.data as string;
        const latestMatch = data.match(/<div class="latest">([\s\S]*?)<\/div>/);
        const hrefMatch = latestMatch ? latestMatch[1].match(/href="([^"]+)"/) : null;
        if (hrefMatch) {
          try {
            const deployedUrl = new URL(hrefMatch[1], window.location.origin);
            deployedUrl.searchParams.set("autoComplete", "true");
            if (options.accessibility) deployedUrl.searchParams.set("isAccessibilityChecker", "true");
            if (options.scorm) deployedUrl.searchParams.set("isSuspendReport", "true");
            // noopener,noreferrer: this opens a URL derived from the CDN deploy
            // response — without it, the new tab could reach back into this
            // window via window.opener (reverse tabnabbing).
            window.open(deployedUrl.toString(), "_blank", "noopener,noreferrer");
            setBuildStatus("Validation build opened in a new tab. The report is available from the Course Complete screen once the course finishes auto-completing.");
          } catch {
            setBuildStatus("Build finished, but the deployed link could not be opened automatically.");
          }
          // The stream's only job was to hand us this link — nothing further
          // it emits is needed, so stop listening instead of holding the
          // connection open for the rest of the (possibly long) build.
          stop();
        } else {
          setBuildStatus(data);
        }
      };
      es.onerror = stop;
      es.addEventListener("server-error", (event) => {
        setValidationWarning((event as MessageEvent).data || "Validation build failed.");
        stop();
      });
    } catch {
      setValidationWarning("Couldn't verify prerequisites. Please try again.");
    } finally {
      setCheckingPrereqs(false);
    }
  }

  const hasErrors = !!report && report.hasCourseErrors > 0;
  const scormConfigured = !!extensionState?.trackingExtensionInstalled;
  const validatorEnablerConfigured = !!extensionState?.validatorEnablerInstalled;
  const cdnConfigured = !!extensionState?.cdnConfigEnabled;
  const scormAllPrereqsMet = validatorEnablerConfigured && cdnConfigured && scormConfigured;

  return (
    <div className="max-w-2xl w-full flex flex-col gap-8">
      {/* Heading */}
      <div>
        <h2 className="text-xl font-semibold text-[#111827]">Preflight Validator</h2>
        <p className="text-sm text-[#6b7280] mt-1.5 leading-relaxed">
          The purpose of this preflight report is to identify and assist you in correcting potential issues in the
          course before it's published to the LMS. It facilitates course validation, accessibility checks, and
          ensures compliance with SCORM/HyperBridge standards while helping you generate a report.
        </p>
      </div>

      <Accordion
        title="Course Evaluation"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        }
      >
        <p className="text-sm text-[#374151] leading-relaxed">
          It is recommended to do the Course Validation and correct any findings before proceeding to the Accessibility Report or SCORM/Hyperbridge Validation.
        </p>

        {/* Course Validation */}
        <SubAccordion
          title="Course Validation"
          open={expandedSection === "course-validation"}
          onToggle={() => toggleSection("course-validation")}
        >
          <ul className="flex flex-col gap-2 pl-1">
            {[
              "Identifies duplicate IDs within the course",
              "Validates the syntax of the IDs for Assessments",
              "Finds if all necessary extensions are included; for example, courses with the Hyperbridge extension should also include the CDN Deployment extension",
              "Alerts if both SPOOR and Hyperbridge extensions are included in a course",
              "Alerts when assessment completion is set as the course completion criteria, but assessment extension is not enabled for any article in the course",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-[#6b7280]">
                <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d6fa8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => void handleRunCourseEvaluation()}
              disabled={reportLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-60 rounded-lg transition-colors"
            >
              {reportLoading ? (
                <Spinner />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                </svg>
              )}
              {reportLoading ? "Validating…" : "Validation"}
            </button>
          </div>

          {reportError && (
            <div className="rounded-lg bg-[#fef2f2] border border-[#fecaca] px-4 py-3 text-sm text-[#991b1b]">{reportError}</div>
          )}

          {report && (
            <div className="flex flex-col gap-3">
              <div
                className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                  hasErrors ? "bg-[#fffbeb] border border-[#fcd34d] text-[#92400e]" : "bg-[var(--life-positive-050)] border border-[var(--life-positive-100)] text-[var(--life-positive-500)]"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  {hasErrors ? (
                    <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>
                  ) : (
                    <polyline points="20 6 9 17 4 12" />
                  )}
                </svg>
                {hasErrors ? `${report.hasCourseErrors} issue${report.hasCourseErrors === 1 ? "" : "s"} found` : "No issues found — this course is ready for the next validation step."}
              </div>

              {hasErrors && (
                <div className="flex flex-col gap-3">
                  {RESULT_CATEGORIES.map(({ key, title, describe }) => {
                    const items = report[key] as unknown as IssueList;
                    if (!Array.isArray(items) || items.length === 0) return null;
                    return (
                      <div key={key as string} className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3">
                        <p className="text-xs font-semibold text-[#92400e] uppercase tracking-wide mb-1.5">{title} ({items.length})</p>
                        <ul className="flex flex-col gap-1">
                          {items.map((item, i) => (
                            <li key={i} className="text-xs text-[#78350f]">
                              {describe(item as ResultItem)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </SubAccordion>

        {/* Accessibility Report */}
        <SubAccordion
          title="Accessibility Report"
          open={expandedSection === "accessibility-report"}
          onToggle={() => toggleSection("accessibility-report", () => void handleExpandAccessibility())}
        >
          <p className="text-xs text-[#6b7280] leading-relaxed">
            Runs the course through the AXE library from Deque to identify potential errors and warnings in compliance with WCAG A and AA standards. This includes checks for color contrast ratios, missing alternative text for images, heading structures, and keyboard navigation support.
          </p>
          <p className="text-[11px] text-[#9ca3af]">
            Expanding this section automatically enables the Laerdal Validator Enabler extension and CDN Deployment if they aren't already configured.
          </p>

          {enablingAccessibilityPrereqs && (
            <p className="inline-flex items-center gap-1.5 text-xs text-[#6b7280]">
              <Spinner /> Configuring prerequisites…
            </p>
          )}
          {accessibilityPrereqError && (
            <div className="rounded-lg bg-[#fef2f2] border border-[#fecaca] px-4 py-3 text-sm text-[#991b1b]">{accessibilityPrereqError}</div>
          )}

          <div className="flex flex-col gap-2 items-start">
            <button
              type="button"
              onClick={() => void runValidation({ accessibility: true, scorm: false })}
              disabled={checkingPrereqs || building || enablingAccessibilityPrereqs}
              className="self-start flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-60 rounded-lg transition-colors"
            >
              {(checkingPrereqs || building) ? (
                <Spinner />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                </svg>
              )}
              {checkingPrereqs ? "Checking prerequisites…" : building ? "Building…" : "Run Accessibility Validation"}
            </button>
            <p className="text-xs text-[#9ca3af] leading-relaxed">
              Results and the downloadable report appear on the deployed course's Course Complete screen, opened in a new tab, once it finishes auto-completing.
            </p>
          </div>
        </SubAccordion>

        {/* SCORM Validation for LMS */}
        <SubAccordion
          title="SCORM Validation for LMS"
          open={expandedSection === "scorm-validation"}
          onToggle={() => toggleSection("scorm-validation", () => void handleExpandScorm())}
        >
          {scormPrereqLoading ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-[#6b7280]">
              <Spinner /> Checking configuration…
            </p>
          ) : (
            <>
              {/* Validator Enabler Configuration — both dependencies SCORM/HyperBridge
                  Validation shares with Accessibility Report, checked independently
                  here so this section is self-sufficient even if the user never
                  opens Accessibility Report first. */}
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3.5 flex flex-col gap-2.5">
                <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">Validator Enabler Configuration</p>
                <div className="flex flex-col gap-2">
                  <PrerequisiteRow
                    label="Laerdal Validator Enabler"
                    satisfied={validatorEnablerConfigured}
                    action={
                      <button
                        type="button"
                        onClick={() => void handleEnableValidatorFromScorm()}
                        disabled={enablingValidatorFromScorm}
                        className="inline-flex items-center gap-1.5 rounded border border-[#d1d5db] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-60 transition-colors"
                      >
                        {enablingValidatorFromScorm && <Spinner />}
                        {enablingValidatorFromScorm ? "Enabling…" : "Enable Now"}
                      </button>
                    }
                  />
                  <PrerequisiteRow
                    label="CDN Configuration"
                    satisfied={cdnConfigured}
                    action={
                      <button
                        type="button"
                        onClick={() => onNavigationRequest?.("cdn-deployment")}
                        className="inline-flex items-center gap-1.5 rounded border border-[#d1d5db] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                      >
                        Go to CDN Deployment
                      </button>
                    }
                  />
                </div>
                {scormValidatorEnableError && (
                  <p className="text-xs text-[#991b1b]">{scormValidatorEnableError}</p>
                )}
              </div>

              {scormConfigured ? (
                <ul className="flex flex-col gap-1">
                  {[
                    "Checks the suspend data length varies for SPOOR and HyperBridge.",
                    "Identifies any potential bugs that may occur during LMS deployment.",
                    "Confirms if the course registers completion and if the assessment score is pushed where relevant.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-[#6b7280]">
                      <span className="w-1 h-1 rounded-full bg-[#9ca3af] shrink-0 mt-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg bg-[#fef2f2] border border-[#fecaca] px-4 py-3 flex flex-col gap-2.5">
                  <p className="text-sm font-medium text-[#991b1b]">No SPOOR/HyperBridge Configuration Found.</p>
                  <button
                    type="button"
                    onClick={() => onNavigationRequest?.("tracking")}
                    className="self-start flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#991b1b] hover:bg-[#7f1d1d] rounded-lg transition-colors"
                  >
                    Go to Tracking &amp; Analytics
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}

              {scormAllPrereqsMet ? (
                <div className="flex flex-col gap-2 items-start">
                  <button
                    type="button"
                    onClick={() => void runValidation({ accessibility: false, scorm: true })}
                    disabled={checkingPrereqs || building}
                    className="self-start flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-60 rounded-lg transition-colors"
                  >
                    {(checkingPrereqs || building) ? (
                      <Spinner />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                      </svg>
                    )}
                    {checkingPrereqs ? "Checking prerequisites…" : building ? "Building…" : "Run SCORM/HyperBridge Validation"}
                  </button>
                  <p className="text-xs text-[#9ca3af] leading-relaxed">
                    Results and the downloadable report appear on the deployed course's Course Complete screen, opened in a new tab, once it finishes auto-completing.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Resolve the missing configuration above to run SCORM/HyperBridge Validation.
                </p>
              )}
            </>
          )}
        </SubAccordion>

        {validationWarning && (
          <div className="rounded-lg bg-[#fef2f2] border border-[#fecaca] px-4 py-3 text-sm text-[#991b1b]">{validationWarning}</div>
        )}
        {buildStatus && !validationWarning && (
          <div className="rounded-lg bg-[#eff6ff] border border-[#bfdbfe] px-4 py-3 text-sm text-[#1e40af]">{buildStatus}</div>
        )}
      </Accordion>
    </div>
  );
}

export default PreflightValidatorPage;
