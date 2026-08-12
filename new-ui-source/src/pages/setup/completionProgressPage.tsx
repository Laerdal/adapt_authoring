import { useState, useEffect, useCallback } from "react";
import {
  enableCompletionNotifierInConfig,
  getCourseBookmarkingSettings,
  getCourseCompletionNotifier,
  getCourseEstimatedTimeSettings,
  getCourseTechnicalSettings,
  saveCourseBookmarkingSettings,
  saveCourseCompletionNotifier,
  saveCourseEstimatedTimeSettings,
  updateCourseTechnicalSettings,
  type CourseBookmarkingSettings,
  type CourseCompletionNotifier,
  type CourseEstimatedTimeSettings,
  type CourseTechnicalSettings,
} from "../../api/adaptAuthoring";
import { UnsavedChangesModal } from "./unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";
/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
type CourseCompletionRule =
  | "all-content"
  | "assessment"
  | "submit-every-attempt"
  | "submit-score";
type BookmarkLocation     = "page" | "block" | "component";
type BookmarkReturn       = "previous" | "furthest";
type ProgressType         = "pages" | "questions";
type ProgressFormat       = "bar" | "stepper" | "percentage";
type ProgressIndicator    =
  | "page-completion"
  | "course-completion"
  | "nav-bar"
  | "all-content-objects"
  | "course-level-nav-btn";
interface CompletionProgressSettings {
  courseCompletionRules:           CourseCompletionRule[];
  notifierLine1:        string;
  notifierLine2:        string;
  notifierAriaLabel:    string;
  bookmarkingEnabled:   boolean;
  bookmarkingLevel:     BookmarkLocation;
  bookmarkingReturn:    BookmarkReturn;
  bookmarkingShowPrompt: boolean;
  bookmarkingAutoRestore: boolean;
  bookmarkingPromptTitle: string;
  bookmarkingPromptMessage: string;
  bookmarkingPromptYes: string;
  bookmarkingPromptNo: string;
  resumeEnabled:        boolean;
  resumeTitle:          string;
  resumeMessage:        string;
  progressIndicators:   ProgressIndicator[];
  progressType:         ProgressType;
  progressFormat:       ProgressFormat;
  progressBarStyle:     "continuous" | "compact";
  timeEnabled:          boolean;
  timeAttachTo:         "" | "navigation-footer";
  timeIconClass:        string;
  timeTextBefore:       string;
  timeTextAfter:        string;
  timeTextCompleted:    string;
}

type CompletionCriteriaConfig = NonNullable<CourseTechnicalSettings["_completionCriteria"]>;
type CompletionNotifierConfig = CourseCompletionNotifier;
type BookmarkingConfig = CourseBookmarkingSettings;
type EstimatedTimeConfig = CourseEstimatedTimeSettings;

const COURSE_COMPLETION_RULE_ORDER: CourseCompletionRule[] = [
  "all-content",
  "assessment",
  "submit-every-attempt",
  "submit-score",
];

function normalizeCourseCompletionRules(rules: CourseCompletionRule[]): CourseCompletionRule[] {
  const uniqueRules = new Set(rules);
  return COURSE_COMPLETION_RULE_ORDER.filter((rule) => uniqueRules.has(rule));
}

function rulesFromCompletionCriteria(
  criteria?: CompletionCriteriaConfig | null,
): CourseCompletionRule[] {
  const rules: CourseCompletionRule[] = [];
  if (criteria?._requireContentCompleted !== false) rules.push("all-content");
  if (criteria?._requireAssessmentCompleted) rules.push("assessment");
  if (criteria?._submitOnEveryAssessmentAttempt) rules.push("submit-every-attempt");
  if (criteria?._shouldSubmitScore) rules.push("submit-score");
  return normalizeCourseCompletionRules(rules);
}

function completionCriteriaFromRules(
  rules: CourseCompletionRule[],
  base?: CompletionCriteriaConfig | null,
): CompletionCriteriaConfig {
  const normalizedRules = new Set(normalizeCourseCompletionRules(rules));
  return {
    ...(base ?? {}),
    _requireContentCompleted: normalizedRules.has("all-content"),
    _requireAssessmentCompleted: normalizedRules.has("assessment"),
    _submitOnEveryAssessmentAttempt: normalizedRules.has("submit-every-attempt"),
    _shouldSubmitScore: normalizedRules.has("submit-score"),
  };
}

function completionNotifierFromCourse(
  notifier?: CompletionNotifierConfig | null,
): Pick<CompletionProgressSettings, "notifierLine1" | "notifierLine2" | "notifierAriaLabel"> {
  const message = notifier?._message;
  const ariaLabel = typeof notifier?.ariaLabel === "string"
    ? notifier.ariaLabel
    : typeof notifier?._ariaLabel === "string"
      ? notifier._ariaLabel
      : "Close completion message";

  return {
    notifierLine1: typeof message?.line1 === "string" ? message.line1 : "",
    notifierLine2: typeof message?.line2 === "string" ? message.line2 : "",
    notifierAriaLabel: ariaLabel,
  };
}

function completionNotifierToCourse(
  settings: Pick<CompletionProgressSettings, "notifierLine1" | "notifierLine2" | "notifierAriaLabel">,
  base?: CompletionNotifierConfig | null,
): CompletionNotifierConfig {
  return {
    ...(base ?? {}),
    _message: {
      ...(base?._message ?? {}),
      line1: settings.notifierLine1,
      line2: settings.notifierLine2,
    },
    ariaLabel: settings.notifierAriaLabel,
    _ariaLabel: settings.notifierAriaLabel,
  };
}

const DEFAULT_SETTINGS: CompletionProgressSettings = {
  courseCompletionRules:          ["all-content"],
  notifierLine1:        "",
  notifierLine2:        "",
  notifierAriaLabel:    "Close completion message",
  bookmarkingEnabled:   false,
  bookmarkingLevel:     "component",
  bookmarkingReturn:    "furthest",
  bookmarkingShowPrompt: true,
  bookmarkingAutoRestore: true,
  bookmarkingPromptTitle: "Bookmarking",
  bookmarkingPromptMessage: "Would you like to continue where you left off?",
  bookmarkingPromptYes: "Yes",
  bookmarkingPromptNo: "No",
  resumeEnabled:        false,
  resumeTitle:          "Continue where you left off?",
  resumeMessage:        "Would you like to resume?",
  progressIndicators:   [],
  progressType:         "pages",
  progressFormat:       "bar",
  progressBarStyle:     "continuous",
  timeEnabled:          false,
  timeAttachTo:         "",
  timeIconClass:        "icon-time",
  timeTextBefore:       "Remaining time to complete module:",
  timeTextAfter:        "minutes",
  timeTextCompleted:    "Module completed.",
};
/* ─────────────────────────────────────────────────────────────
   Shared primitive widgets (scoped to this file)
───────────────────────────────────────────────────────────── */
function CpCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-[#f9fafb] group">
      <div
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${
          checked
            ? "bg-[var(--life-primary-500)] border-[var(--life-primary-500)]"
            : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
        }`}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span className="text-sm text-[#374151] leading-snug">{label}</span>
    </label>
  );
}
function CpSelect<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      {hint && <p className="text-[11px] text-[var(--life-neutral-300)] leading-snug">{hint}</p>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          title={label}
          aria-label={label}
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[var(--life-base-black)] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent pr-8"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
function CpTextInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      {hint && <p className="text-[11px] text-[var(--life-neutral-300)] leading-snug">{hint}</p>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent transition-colors"
      />
    </div>
  );
}
function CpToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
      <span className="text-sm font-semibold text-[var(--life-base-black)] leading-snug">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--life-primary-500)] ${
          checked
            ? "bg-[var(--life-primary-500)] border-[var(--life-primary-500)]"
            : "bg-[#e5e7eb] border-[#e5e7eb]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
function CpRadioGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {options.map((opt) => {
        const sel = value === opt.value;
        return (
          <label
            key={opt.value}
            className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-[#f9fafb] transition-colors group"
          >
            <div
              onClick={() => onChange(opt.value)}
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                sel
                  ? "border-[var(--life-primary-500)]"
                  : "border-[#d1d5db] bg-white group-hover:border-[var(--life-primary-300)]"
              }`}
            >
              {sel && <div className="w-2 h-2 rounded-full bg-[var(--life-primary-500)]" />}
            </div>
            <span className="text-sm text-[#374151]">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
function CpCheckboxMulti<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (v: T[]) => void;
}) {
  const toggle = (val: T) => {
    onChange(
      selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val],
    );
  };
  return (
    <div className="flex flex-col gap-0.5">
      {options.map((opt) => {
        const checked = selected.includes(opt.value);
        return (
          <label
            key={opt.value}
            className="flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-[#f9fafb] transition-colors group"
          >
            <div
              onClick={() => toggle(opt.value)}
              className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${
                checked
                  ? "bg-[var(--life-primary-500)] border-[var(--life-primary-500)]"
                  : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
              }`}
            >
              {checked && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span className="text-sm text-[#374151] leading-snug">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
function CpInfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[#eff6ff] border border-[#bfdbfe] px-3 py-2.5 text-xs text-[#1d4ed8]">
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="mt-0.5 shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
/* ─────────────────────────────────────────────────────────────
   Accordion (matches NavAccordion exactly)
───────────────────────────────────────────────────────────── */
function CpAccordion({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[var(--life-primary-020)] transition-colors"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--life-base-black)]">{title}</h3>
          {subtitle && <p className="text-xs text-[#9ca3af] mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        <svg
          className={`shrink-0 ml-auto transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="var(--life-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-[#f3f4f6] flex flex-col gap-4">
          {children}
        </div>
      )}
    </div>
  );
}
function CpInnerCard({
  title,
  subtitle,
  headerSlot,
  children,
}: {
  title?: string;
  subtitle?: string;
  headerSlot?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[#f3f4f6] bg-[#f9fafb]">
        {headerSlot ?? (
          <>
            {title && <p className="text-xs font-semibold text-[#374151]">{title}</p>}
            {subtitle && <p className="text-xs text-[#9ca3af] mt-0.5 leading-snug">{subtitle}</p>}
          </>
        )}
      </div>
      {children && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}
/* ─────────────────────────────────────────────────────────────
   Section content components
───────────────────────────────────────────────────────────── */
function CompletionRulesContent({
  cfg,
  set,
}: {
  cfg: CompletionProgressSettings;
  set: <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) => void;
}) {
  return (
    <>
      <CpInnerCard title="Course Completion" subtitle="Complete course when:">
        <CpCheckboxMulti<CourseCompletionRule>
          selected={cfg.courseCompletionRules}
          onChange={(v) => set("courseCompletionRules", normalizeCourseCompletionRules(v))}
          options={[
            { value: "all-content",           label: "All content in the course must be completed" },
            { value: "assessment",             label: "The assessment must be completed" },
            { value: "submit-every-attempt",   label: "Submit completion on every assessment attempt" },
            { value: "submit-score",           label: "Submit score to LMS" },
          ]}
        />
      </CpInnerCard>
    </>
  );
}
function CompletionFeedbackContent({
  cfg,
  set,
}: {
  cfg: CompletionProgressSettings;
  set: <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) => void;
}) {
  return (
    <>
      <CpInnerCard title="Completion Notifier" subtitle="Message for the course completion notifier">
        <div className="flex flex-col gap-4 pt-1">
          <CpTextInput
            label="Text for message first line"
            value={cfg.notifierLine1}
            onChange={(v) => set("notifierLine1", v)}
            placeholder="e.g. Congratulations!"
          />
          <CpTextInput
            label="Text for message second line"
            value={cfg.notifierLine2}
            onChange={(v) => set("notifierLine2", v)}
            placeholder="e.g. You have completed this course."
          />
          <CpTextInput
            label="Close button aria label"
            hint="Accessible label announced by screen readers for the close button"
            value={cfg.notifierAriaLabel}
            onChange={(v) => set("notifierAriaLabel", v)}
            placeholder="e.g. Close completion message"
          />
        </div>
      </CpInnerCard>
    </>
  );
}
function ResumeBookmarkingContent({
  cfg,
  set,
}: {
  cfg: CompletionProgressSettings;
  set: <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) => void;
}) {
  return (
    <>
      <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        <div className="px-4 py-3.5 border-b border-[#f3f4f6] bg-[#f9fafb]">
          <CpToggle label="Enable Bookmarking" checked={cfg.bookmarkingEnabled} onChange={(v) => set("bookmarkingEnabled", v)} />
        </div>
        {cfg.bookmarkingEnabled && (
          <div className="px-4 py-4 flex flex-col gap-4">
            <CpSelect<BookmarkLocation>
              label="Bookmarking is done at"
              value={cfg.bookmarkingLevel}
              onChange={(v) => set("bookmarkingLevel", v)}
              options={[
                { value: "page",      label: "Page" },
                { value: "block",     label: "Block" },
                { value: "component", label: "Component" },
              ]}
            />
            <CpInfoNote>Bookmarking done at component level will be the most accurate.</CpInfoNote>
            <CpSelect<BookmarkReturn>
              label="Bookmarking location – learner is taken back to"
              hint="Location: where the learner is returned on re-entry"
              value={cfg.bookmarkingReturn}
              onChange={(v) => set("bookmarkingReturn", v)}
              options={[
                { value: "previous", label: "Previous" },
                { value: "furthest", label: "Furthest" },
              ]}
            />
            {cfg.bookmarkingReturn === "furthest" && (
              <CpInfoNote>
                The Furthest option pairs well with sequential navigation, ensuring learners always progress forward.
              </CpInfoNote>
            )}

            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 flex flex-col gap-3">
              <CpCheckbox
                label="Show prompt"
                checked={cfg.bookmarkingShowPrompt}
                onChange={(v) => set("bookmarkingShowPrompt", v)}
              />
              <CpCheckbox
                label="Auto restore"
                checked={cfg.bookmarkingAutoRestore}
                onChange={(v) => set("bookmarkingAutoRestore", v)}
              />
              <CpTextInput
                label="Prompt title"
                value={cfg.bookmarkingPromptTitle}
                onChange={(v) => set("bookmarkingPromptTitle", v)}
                placeholder="Bookmarking"
              />
              <CpTextInput
                label="Prompt message"
                value={cfg.bookmarkingPromptMessage}
                onChange={(v) => set("bookmarkingPromptMessage", v)}
                placeholder="Would you like to continue where you left off?"
              />
              <div className="grid grid-cols-2 gap-3">
                <CpTextInput
                  label="Yes"
                  value={cfg.bookmarkingPromptYes}
                  onChange={(v) => set("bookmarkingPromptYes", v)}
                  placeholder="Yes"
                />
                <CpTextInput
                  label="No"
                  value={cfg.bookmarkingPromptNo}
                  onChange={(v) => set("bookmarkingPromptNo", v)}
                  placeholder="No"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        <div className="px-4 py-3.5 border-b border-[#f3f4f6] bg-[#f9fafb]">
          <CpToggle label="Enable Resume" checked={cfg.resumeEnabled} onChange={(v) => set("resumeEnabled", v)} />
        </div>
        {cfg.resumeEnabled && (
          <div className="px-4 py-4 flex flex-col gap-4">
            <CpTextInput label="Title" value={cfg.resumeTitle} onChange={(v) => set("resumeTitle", v)} placeholder="Continue where you left off?" />
            <CpTextInput label="Message" value={cfg.resumeMessage} onChange={(v) => set("resumeMessage", v)} placeholder="Would you like to resume?" />
            {(cfg.resumeTitle || cfg.resumeMessage) && (
              <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wide mb-3">Dialog Preview</p>
                <div className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm p-4 max-w-xs mx-auto">
                  {cfg.resumeTitle && <p className="text-sm font-bold text-[#111827] mb-1">{cfg.resumeTitle}</p>}
                  {cfg.resumeMessage && <p className="text-sm text-[#6b7280] mb-4">{cfg.resumeMessage}</p>}
                  <div className="flex gap-2">
                    <button type="button" className="flex-1 py-1.5 text-xs font-medium border border-[#e5e7eb] rounded-lg text-[#374151] bg-white">No</button>
                    <button type="button" className="flex-1 py-1.5 text-xs font-semibold rounded-lg text-white bg-[var(--life-primary-500)]">Yes, resume</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
const PROGRESS_INDICATOR_OPTIONS: { value: ProgressIndicator; label: string }[] = [
  { value: "page-completion",      label: "Show page completion" },
  { value: "course-completion",    label: "Show course completion indicator" },
  { value: "nav-bar",              label: "Show progress in the navigation bar" },
  { value: "all-content-objects",  label: "Display all content objects and the current page components" },
  { value: "course-level-nav-btn", label: "Use course-level progress on navigation button" },
];
function ProgressFormatPreview({ format }: { format: ProgressFormat }) {
  if (format === "bar") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#e5e7eb] bg-white">
        <span className="text-xs text-[#6b7280] shrink-0">Progress</span>
        <div className="flex-1 h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-[var(--life-primary-500)] rounded-full" />
        </div>
        <span className="text-xs font-semibold text-[var(--life-primary-500)] shrink-0">66%</span>
      </div>
    );
  }
  if (format === "stepper") {
    return (
      <div className="flex items-center gap-1.5 px-4 py-3 rounded-lg border border-[#e5e7eb] bg-white">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${i <= 3 ? "bg-[var(--life-primary-500)] border-[var(--life-primary-500)] text-white" : "border-[#d1d5db] text-[#9ca3af] bg-white"}`}>
              {i <= 2 ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : i}
            </div>
            {i < 5 && <div className={`h-0.5 w-3 ${i < 3 ? "bg-[var(--life-primary-500)]" : "bg-[#e5e7eb]"}`} />}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#e5e7eb] bg-white">
      <span className="text-xs text-[#6b7280]">Progress</span>
      <span className="text-2xl font-bold text-[var(--life-primary-500)]">66<span className="text-base">%</span></span>
      <span className="text-xs text-[#9ca3af]">complete</span>
    </div>
  );
}
function ProgressBarStylePicker({
  value,
  onChange,
}: {
  value: "continuous" | "compact";
  onChange: (v: "continuous" | "compact") => void;
}) {
  const options: { value: "continuous" | "compact"; label: string; description: string }[] = [
    {
      value: "continuous",
      label: "Continuous bar",
      description: "A single bar spanning the full width beneath the navigation bar.",
    },
    {
      value: "compact",
      label: "Compact indicator",
      description: "A small pill-shaped progress indicator inside the navigation bar.",
    },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-[#374151]">Progress Bar Style</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex flex-col gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                selected
                  ? "border-[var(--life-base-black)] bg-white shadow-sm"
                  : "border-[#e5e7eb] bg-white hover:border-[#d1d5db]"
              }`}
            >
              {/* Nav bar mockup */}
              <div className="w-full rounded-lg border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden">
                {/* Nav row */}
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-[#6b7280]">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                    <span className="font-medium text-[#374151]">Home / Case 1</span>
                  </div>
                  {opt.value === "compact" ? (
                    /* Compact: pill indicator top-right */
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-8 rounded-full bg-[#e5e7eb] overflow-hidden">
                        <div className="h-full w-3/5 rounded-full bg-[var(--life-primary-500)]" />
                      </div>
                      <span className="text-[9px] font-semibold text-[#6b7280]">v0.0.2</span>
                    </div>
                  ) : (
                    <span className="text-[9px] font-semibold text-[#6b7280]">v0.0.2</span>
                  )}
                </div>
                {opt.value === "continuous" && (
                  /* Continuous: full-width bar below nav */
                  <div className="h-1.5 w-full bg-[#e5e7eb]">
                    <div className="h-full w-3/5 bg-[var(--life-primary-500)]" />
                  </div>
                )}
              </div>
              {/* Label row */}
              <div className="flex items-start gap-2">
                <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selected
                    ? "border-[var(--life-primary-500)]"
                    : "border-[#d1d5db]"
                }`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-[var(--life-primary-500)]" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#111827]">{opt.label}</p>
                  <p className="text-[11px] text-[#6b7280] mt-0.5 leading-snug">{opt.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function ProgressIndicatorsContent({
  cfg,
  set,
}: {
  cfg: CompletionProgressSettings;
  set: <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) => void;
}) {
  return (
    <>
      <ProgressBarStylePicker
        value={cfg.progressBarStyle}
        onChange={(v) => set("progressBarStyle", v)}
      />
      <CpInnerCard title="Show progress indicators" subtitle="Select all that apply">
        <CpCheckboxMulti<ProgressIndicator>
          selected={cfg.progressIndicators}
          onChange={(v) => set("progressIndicators", v)}
          options={PROGRESS_INDICATOR_OPTIONS}
        />
      </CpInnerCard>
      <div className="grid grid-cols-2 gap-4">
        <CpSelect<ProgressType>
          label="Progress Type"
          value={cfg.progressType}
          onChange={(v) => set("progressType", v)}
          options={[
            { value: "pages",     label: "Pages" },
            { value: "questions", label: "Questions" },
          ]}
        />
        <CpSelect<ProgressFormat>
          label="Progression Format"
          value={cfg.progressFormat}
          onChange={(v) => set("progressFormat", v)}
          options={[
            { value: "bar",        label: "Bar" },
            { value: "stepper",    label: "Stepper" },
            { value: "percentage", label: "Percentage" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-[#374151]">Format Preview</span>
        <ProgressFormatPreview format={cfg.progressFormat} />
      </div>
    </>
  );
}
function TimeEstimateContent({
  cfg,
  set,
}: {
  cfg: CompletionProgressSettings;
  set: <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) => void;
}) {
  return (
    <>
      <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        <div className="px-4 py-3.5 border-b border-[#f3f4f6] bg-[#f9fafb]">
          <CpToggle label="Enable Time Estimate" checked={cfg.timeEnabled} onChange={(v) => set("timeEnabled", v)} />
        </div>
        {cfg.timeEnabled && (
          <div className="px-4 py-4 flex flex-col gap-4">
            <CpSelect<"" | "navigation-footer">
              label="Where to place on page"
              hint="Leave blank to place at the end of the page; choose navigation-footer only if the Navigation Footer extension is included."
              value={cfg.timeAttachTo}
              onChange={(v) => set("timeAttachTo", v)}
              options={[
                { value: "",                  label: "End of page (default)" },
                { value: "navigation-footer", label: "Navigation footer" },
              ]}
            />
            <CpTextInput label="Icon class" value={cfg.timeIconClass} onChange={(v) => set("timeIconClass", v)} placeholder="icon-time" />
            <CpTextInput label="Text before duration" value={cfg.timeTextBefore} onChange={(v) => set("timeTextBefore", v)} placeholder="Remaining time to complete module:" />
            <CpTextInput label="Text after duration" value={cfg.timeTextAfter} onChange={(v) => set("timeTextAfter", v)} placeholder="minutes" />
            <CpTextInput label="Text shown when module is completed" value={cfg.timeTextCompleted} onChange={(v) => set("timeTextCompleted", v)} placeholder="Module completed." />
          </div>
        )}
      </div>
    </>
  );
}
/* ─────────────────────────────────────────────────────────────
   Page component (exported)
───────────────────────────────────────────────────────────── */
export interface CompletionProgressPageProps {
  courseId: string;
  onNavigationRequest?: (nav: string) => void;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
}
export function CompletionProgressPage({
  courseId,
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
}: CompletionProgressPageProps) {
  const [cfg, setCfg] = useState<CompletionProgressSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<CompletionProgressSettings>(DEFAULT_SETTINGS);
  const [configId, setConfigId] = useState<string | null>(null);
  const [completionCriteria, setCompletionCriteria] = useState<CompletionCriteriaConfig>({
    _requireContentCompleted: true,
    _requireAssessmentCompleted: false,
    _submitOnEveryAssessmentAttempt: false,
    _shouldSubmitScore: false,
  });
  const [completionNotifier, setCompletionNotifier] = useState<CompletionNotifierConfig>({
    _message: {
      line1: DEFAULT_SETTINGS.notifierLine1,
      line2: DEFAULT_SETTINGS.notifierLine2,
    },
    ariaLabel: DEFAULT_SETTINGS.notifierAriaLabel,
    _ariaLabel: DEFAULT_SETTINGS.notifierAriaLabel,
  });
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  type Section = "completionRules" | "completionFeedback" | "resumeBookmarking" | "progressIndicators" | "timeEstimate";
  const [openSection, setOpenSection] = useState<Section | "">("");
  const acc = (id: Section) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((s) => (s === id ? "" : id)),
  });
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const set = useCallback(
    <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) =>
      setCfg((prev) => ({ ...prev, [k]: v })),
    [],
  );
  useEffect(() => {
    let cancelled = false;

    async function loadCompletionCriteria() {
      if (!courseId) {
        if (!cancelled) {
          setConfigId(null);
          setLoadErrorMessage(null);
          setCompletionCriteria(completionCriteriaFromRules(DEFAULT_SETTINGS.courseCompletionRules));
          setCompletionNotifier(completionNotifierToCourse(DEFAULT_SETTINGS));
          setCfg(DEFAULT_SETTINGS);
          setSaved(DEFAULT_SETTINGS);
        }
        return;
      }

      try {
        setLoadErrorMessage(null);
        const [config, notifier, bookmarking, estimatedTime] = await Promise.all([
          getCourseTechnicalSettings(courseId),
          getCourseCompletionNotifier(courseId),
          getCourseBookmarkingSettings(courseId),
          getCourseEstimatedTimeSettings(courseId),
        ]);
        if (cancelled) return;

        const nextCriteria = completionCriteriaFromRules(
          rulesFromCompletionCriteria(config._completionCriteria),
          config._completionCriteria,
        );
        const nextRules = rulesFromCompletionCriteria(nextCriteria);
        const nextNotifier = completionNotifierFromCourse(notifier);
        const nextSettings = {
          ...DEFAULT_SETTINGS,
          courseCompletionRules: nextRules,
          ...nextNotifier,
          bookmarkingEnabled: !!bookmarking._isEnabled,
          bookmarkingLevel: (bookmarking._level ?? DEFAULT_SETTINGS.bookmarkingLevel) as BookmarkLocation,
          bookmarkingReturn: (bookmarking._location ?? DEFAULT_SETTINGS.bookmarkingReturn) as BookmarkReturn,
          bookmarkingShowPrompt: typeof bookmarking._showPrompt === "boolean"
            ? bookmarking._showPrompt
            : DEFAULT_SETTINGS.bookmarkingShowPrompt,
          bookmarkingAutoRestore: typeof bookmarking._autoRestore === "boolean"
            ? bookmarking._autoRestore
            : DEFAULT_SETTINGS.bookmarkingAutoRestore,
          bookmarkingPromptTitle: typeof bookmarking.title === "string"
            ? bookmarking.title
            : DEFAULT_SETTINGS.bookmarkingPromptTitle,
          bookmarkingPromptMessage: typeof bookmarking.body === "string"
            ? bookmarking.body
            : DEFAULT_SETTINGS.bookmarkingPromptMessage,
          bookmarkingPromptYes: typeof bookmarking._buttons?.yes === "string"
            ? bookmarking._buttons.yes
            : DEFAULT_SETTINGS.bookmarkingPromptYes,
          bookmarkingPromptNo: typeof bookmarking._buttons?.no === "string"
            ? bookmarking._buttons.no
            : DEFAULT_SETTINGS.bookmarkingPromptNo,
          timeEnabled:      estimatedTime._isEnabled,
          timeAttachTo:     estimatedTime._attachTo,
          timeIconClass:    estimatedTime.iconClass,
          timeTextBefore:   estimatedTime.textBefore,
          timeTextAfter:    estimatedTime.textAfter,
          timeTextCompleted: estimatedTime.moduleCompleted,
        };

        setConfigId(config._id ?? null);
        setCompletionCriteria(nextCriteria);
        setCompletionNotifier(completionNotifierToCourse(nextSettings, notifier));
        setCfg(nextSettings);
        setSaved(nextSettings);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load completion settings", error);
        setConfigId(null);
        setLoadErrorMessage("Completion settings didn't load. Reload the page before saving.");
      }
    }

    void loadCompletionCriteria();

    return () => {
      cancelled = true;
    };
  }, [courseId]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } =
    useUnsavedChangesNavigationGuard({
      hasChanges: dirty,
      pendingNavigation,
      onPendingNavigationHandled,
      onNavigate: onNavigationRequest,
    });
  function handleCancel() {
    setCfg(saved);
    setToast(null);
  }
  async function handleSave() {
    if (saving) return;
    if (!courseId) {
      setToast({ type: "error", message: "Course id is missing. Reload the page before saving." });
      return;
    }
    if (loadErrorMessage) {
      setToast({ type: "error", message: loadErrorMessage });
      return;
    }
    if (!configId) {
      setToast({ type: "error", message: "Completion criteria config didn't load. Reload the page before saving." });
      return;
    }

    setSaving(true);
    setToast(null);
    try {
      const nextCompletionCriteria = completionCriteriaFromRules(cfg.courseCompletionRules, completionCriteria);
      const nextCompletionNotifier = {
        ...completionNotifierToCourse(cfg, completionNotifier),
        _isEnabled: true,
      };
      const nextBookmarking: BookmarkingConfig = {
        _isEnabled: cfg.bookmarkingEnabled,
        _level: cfg.bookmarkingLevel,
        _location: cfg.bookmarkingReturn,
        _showPrompt: cfg.bookmarkingShowPrompt,
        _autoRestore: cfg.bookmarkingAutoRestore,
        title: cfg.bookmarkingPromptTitle,
        body: cfg.bookmarkingPromptMessage,
        _buttons: {
          yes: cfg.bookmarkingPromptYes,
          no: cfg.bookmarkingPromptNo,
        },
      };
      const changedFields: Partial<CourseTechnicalSettings> = {
        _id: configId,
        _courseId: courseId,
        _completionCriteria: nextCompletionCriteria,
      };

      const nextEstimatedTime: CourseEstimatedTimeSettings = {
        _isEnabled:      cfg.timeEnabled,
        _debugEnabled:   false,
        _attachTo:       cfg.timeAttachTo,
        iconClass:       cfg.timeIconClass,
        textBefore:      cfg.timeTextBefore,
        textAfter:       cfg.timeTextAfter,
        moduleCompleted: cfg.timeTextCompleted,
      };

      await Promise.all([
        updateCourseTechnicalSettings(configId, changedFields),
        saveCourseCompletionNotifier(courseId, nextCompletionNotifier),
        enableCompletionNotifierInConfig(configId, courseId),
        saveCourseBookmarkingSettings(courseId, nextBookmarking),
        saveCourseEstimatedTimeSettings(courseId, nextEstimatedTime),
      ]);
      setCompletionCriteria(nextCompletionCriteria);
      setCompletionNotifier(nextCompletionNotifier);
      setSaved({
        ...cfg,
        courseCompletionRules: normalizeCourseCompletionRules(cfg.courseCompletionRules),
      });
      setToast({ type: "success", message: "Changes saved successfully" });
    } catch (error) {
      console.error("Failed to save completion settings", error);
      setToast({ type: "error", message: "Couldn't save. Please try again." });
    } finally {
      setSaving(false);
    }
  }
  async function handleConfirmSave() {
    await handleSave();
    const target = consumePendingNavigation();
    if (target) onNavigationRequest?.(target);
  }
  function handleConfirmDiscard() {
    handleCancel();
    const target = consumePendingNavigation();
    if (target) onNavigationRequest?.(target);
  }
  return (
    <div className="max-w-3xl w-full px-6 py-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--life-base-black)]">Completion &amp; Progress</h2>
        <p className="text-sm text-[var(--life-neutral-300)] mt-1">
          Configure how course and page completion is tracked and displayed to learners.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <CpAccordion {...acc("completionRules")} title="Completion Rules">
          <CompletionRulesContent cfg={cfg} set={set} />
        </CpAccordion>
        <CpAccordion {...acc("completionFeedback")} title="Completion Feedback">
          <CompletionFeedbackContent cfg={cfg} set={set} />
        </CpAccordion>
        <CpAccordion {...acc("resumeBookmarking")} title="Resume &amp; Bookmarking">
          <ResumeBookmarkingContent cfg={cfg} set={set} />
        </CpAccordion>
        <CpAccordion {...acc("progressIndicators")} title="Progress Indicators">
          <ProgressIndicatorsContent cfg={cfg} set={set} />
        </CpAccordion>
        <CpAccordion {...acc("timeEstimate")} title="Time Estimate">
          <TimeEstimateContent cfg={cfg} set={set} />
        </CpAccordion>

      </div>
      <div className="h-8" />
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
            <button type="button" onClick={handleCancel} disabled={saving} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--life-base-white)] bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:opacity-50 rounded-lg transition-colors">
              {saving && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
              )}
              {saving ? "Saving\u2026" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] pointer-events-none">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border pointer-events-auto min-w-[260px] max-w-sm ${toast.type === "success" ? "bg-[var(--life-positive-050)] border-[var(--life-positive-100)] text-[var(--life-positive-500)]" : "bg-[var(--life-critical-050)] border-[var(--life-critical-100)] text-[var(--life-critical-500)]"}`}>
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
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity ml-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
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
    </div>
  );
}
