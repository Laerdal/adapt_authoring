import { useState, useEffect, useCallback } from "react";
import { UnsavedChangesModal } from "./unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */

type PageCompletionRule   = "all-content" | "required-interaction";
type CourseCompletionRule = "all-content" | "assessment";
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
  /* 1 – Completion Rules */
  pageCompletionRule:   PageCompletionRule;
  courseCompletionRule: CourseCompletionRule;

  /* 2 – Completion Feedback */
  notifierLine1: string;
  notifierLine2: string;

  /* 3 – Resume & Bookmarking */
  bookmarkingEnabled:  boolean;
  bookmarkingLevel:    BookmarkLocation;
  bookmarkingReturn:   BookmarkReturn;
  resumeEnabled:       boolean;
  resumeTitle:         string;
  resumeMessage:       string;

  /* 4 – Progress Indicators */
  progressIndicators: ProgressIndicator[];
  progressType:       ProgressType;
  progressFormat:     ProgressFormat;

  /* 5 – Time Estimate */
  timeIconClass:      string;
  timeTextBefore:     string;
  timeTextAfter:      string;
  timeTextCompleted:  string;
}

const DEFAULT_SETTINGS: CompletionProgressSettings = {
  pageCompletionRule:   "all-content",
  courseCompletionRule: "all-content",
  notifierLine1:        "",
  notifierLine2:        "",
  bookmarkingEnabled:   false,
  bookmarkingLevel:     "component",
  bookmarkingReturn:    "furthest",
  resumeEnabled:        false,
  resumeTitle:          "Continue where you left off?",
  resumeMessage:        "Would you like to resume?",
  progressIndicators:   [],
  progressType:         "pages",
  progressFormat:       "bar",
  timeIconClass:        "icon-time",
  timeTextBefore:       "Remaining time to complete module",
  timeTextAfter:        "minutes",
  timeTextCompleted:    "Module completed",
};

/* ─────────────────────────────────────────────────────────────
   Shared primitives
───────────────────────────────────────────────────────────── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-[#111827] mb-0.5">{children}</h2>;
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <span className="text-xs font-semibold text-[#374151]">{children}</span>
      {hint && <p className="text-xs text-[#6b7280] mt-0.5">{hint}</p>}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[#f3f4f6] my-6" />;
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[#f0f7ff] border border-[#bfdbfe] px-3 py-2.5 text-xs text-[#1e40af]">
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="mt-0.5 shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

function TextInput({
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
    <div className="flex flex-col gap-1">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
      />
    </div>
  );
}

function SelectField<T extends string>({
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
    <div className="flex flex-col gap-1">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          title={label}
          aria-label={label}
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[#111827] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent pr-8"
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5 cursor-pointer group">
      <span className="text-sm text-[#374151] leading-snug">{label}</span>
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
    </label>
  );
}

function RadioGroup<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label?: string;
  hint?: string;
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
      <div className="flex flex-col gap-0.5">
        {options.map((opt) => {
          const sel = value === opt.value;
          return (
            <label
              key={opt.value}
              className="flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-[#f9fafb] transition-colors"
            >
              <div
                onClick={() => onChange(opt.value)}
                className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  sel ? "border-[#2d6fa8] bg-white" : "border-[#d1d5db] bg-white"
                }`}
              >
                {sel && <div className="w-2 h-2 rounded-full bg-[#2d6fa8]" />}
              </div>
              <div className="min-w-0">
                <span className="text-sm text-[#374151]">{opt.label}</span>
                {opt.description && (
                  <p className="text-xs text-[#6b7280] mt-0.5">{opt.description}</p>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CheckboxMulti<T extends string>({
  label,
  hint,
  options,
  selected,
  onChange,
}: {
  label?: string;
  hint?: string;
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
    <div className="flex flex-col gap-1">
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
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
                    ? "bg-[#2d6fa8] border-[#2d6fa8]"
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
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Accordion card – collapsible section wrapper
───────────────────────────────────────────────────────────── */

function AccordionCard({
  open,
  onToggle,
  title,
  icon,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#e5e7eb] rounded-xl overflow-hidden bg-white transition-shadow hover:shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#f9fafb] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#2d6fa8]">{icon}</span>
          <span className="text-sm font-bold text-[#111827]">{title}</span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-[#f3f4f6] space-y-5">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Inner card wrapper for sub-sections
───────────────────────────────────────────────────────────── */

function InnerCard({
  title,
  subtitle,
  children,
  headerSlot,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  headerSlot?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#f3f4f6] bg-[#f9fafb]">
        {headerSlot ?? (
          <>
            <p className="text-xs font-bold text-[#374151]">{title}</p>
            {subtitle && <p className="text-xs text-[#6b7280] mt-0.5">{subtitle}</p>}
          </>
        )}
      </div>
      {children && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section icons
───────────────────────────────────────────────────────────── */

const ICONS = {
  completionRules: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  completionFeedback: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  resumeBookmarking: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  progressIndicators: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  timeEstimate: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

/* ─────────────────────────────────────────────────────────────
   Section 1 – Completion Rules
───────────────────────────────────────────────────────────── */

function CompletionRulesSection({
  cfg,
  set,
}: {
  cfg: CompletionProgressSettings;
  set: <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) => void;
}) {
  return (
    <div className="pt-2 space-y-4">
      <p className="text-sm text-[#6b7280]">Define what counts as a completed page and a completed course.</p>

      {/* Page Completion */}
      <InnerCard title="Page Completion" subtitle="Complete page when:">
        <RadioGroup<PageCompletionRule>
          value={cfg.pageCompletionRule}
          onChange={(v) => set("pageCompletionRule", v)}
          options={[
            { value: "all-content",          label: "All content viewed" },
            { value: "required-interaction", label: "Required interaction completed" },
          ]}
        />
      </InnerCard>

      {/* Course Completion */}
      <InnerCard title="Course Completion" subtitle="Complete course when:">
        <RadioGroup<CourseCompletionRule>
          value={cfg.courseCompletionRule}
          onChange={(v) => set("courseCompletionRule", v)}
          options={[
            { value: "all-content", label: "All content in the course must be completed" },
            { value: "assessment",  label: "The assessment must be completed" },
          ]}
        />
      </InnerCard>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section 2 – Completion Feedback
───────────────────────────────────────────────────────────── */

function CompletionFeedbackSection({
  cfg,
  set,
}: {
  cfg: CompletionProgressSettings;
  set: <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) => void;
}) {
  return (
    <div className="pt-2 space-y-4">
      <p className="text-sm text-[#6b7280]">Customise the message shown to learners when they complete the course.</p>

      <InnerCard title="Completion Notifier" subtitle="Message for the course completion notifier">
        <div className="space-y-4">
          <TextInput
            label="Text for message first line"
            value={cfg.notifierLine1}
            onChange={(v) => set("notifierLine1", v)}
            placeholder="e.g. Congratulations!"
          />
          <TextInput
            label="Text for message second line"
            value={cfg.notifierLine2}
            onChange={(v) => set("notifierLine2", v)}
            placeholder="e.g. You have completed this course."
          />
        </div>
      </InnerCard>

      {/* Live preview of notifier */}
      {(cfg.notifierLine1 || cfg.notifierLine2) && (
        <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide mb-3">Preview</p>
          <div className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm p-5 flex flex-col items-center gap-2 text-center max-w-xs mx-auto">
            <div className="w-10 h-10 rounded-full bg-[#d1fae5] flex items-center justify-center mb-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            {cfg.notifierLine1 && (
              <p className="text-sm font-bold text-[#111827]">{cfg.notifierLine1}</p>
            )}
            {cfg.notifierLine2 && (
              <p className="text-sm text-[#6b7280]">{cfg.notifierLine2}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section 3 – Resume & Bookmarking
───────────────────────────────────────────────────────────── */

function ResumeBookmarkingSection({
  cfg,
  set,
}: {
  cfg: CompletionProgressSettings;
  set: <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) => void;
}) {
  return (
    <div className="pt-2 space-y-4">
      <p className="text-sm text-[#6b7280]">Control where learners return to when they re-enter the course.</p>

      {/* Bookmarking */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f3f4f6] bg-[#f9fafb]">
          <Toggle
            label="Enable Bookmarking"
            checked={cfg.bookmarkingEnabled}
            onChange={(v) => set("bookmarkingEnabled", v)}
          />
        </div>

        {cfg.bookmarkingEnabled && (
          <div className="px-4 py-4 space-y-5">
            <SelectField<BookmarkLocation>
              label="Bookmarking is done at"
              value={cfg.bookmarkingLevel}
              onChange={(v) => set("bookmarkingLevel", v)}
              options={[
                { value: "page",      label: "Page" },
                { value: "block",     label: "Block" },
                { value: "component", label: "Component" },
              ]}
            />
            <InfoNote>Bookmarking done at component level will be the most accurate.</InfoNote>

            <SelectField<BookmarkReturn>
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
              <InfoNote>
                The Furthest option pairs well with sequential navigation, ensuring learners always
                progress forward.
              </InfoNote>
            )}
          </div>
        )}
      </div>

      {/* Resume */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f3f4f6] bg-[#f9fafb]">
          <Toggle
            label="Enable Resume"
            checked={cfg.resumeEnabled}
            onChange={(v) => set("resumeEnabled", v)}
          />
        </div>

        {cfg.resumeEnabled && (
          <div className="px-4 py-4 space-y-4">
            <TextInput
              label="Title"
              value={cfg.resumeTitle}
              onChange={(v) => set("resumeTitle", v)}
              placeholder="Continue where you left off?"
            />
            <TextInput
              label="Message"
              value={cfg.resumeMessage}
              onChange={(v) => set("resumeMessage", v)}
              placeholder="Would you like to resume?"
            />

            {/* Resume dialog preview */}
            {(cfg.resumeTitle || cfg.resumeMessage) && (
              <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
                <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide mb-3">Dialog Preview</p>
                <div className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm p-4 max-w-xs mx-auto">
                  {cfg.resumeTitle && (
                    <p className="text-sm font-bold text-[#111827] mb-1">{cfg.resumeTitle}</p>
                  )}
                  {cfg.resumeMessage && (
                    <p className="text-sm text-[#6b7280] mb-4">{cfg.resumeMessage}</p>
                  )}
                  <div className="flex gap-2">
                    <button type="button" className="flex-1 py-1.5 text-xs font-medium border border-[#e5e7eb] rounded-lg text-[#374151] bg-white">
                      No
                    </button>
                    <button type="button" className="flex-1 py-1.5 text-xs font-semibold rounded-lg text-white bg-[#2d6fa8]">
                      Yes, resume
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section 4 – Progress Indicators
───────────────────────────────────────────────────────────── */

const PROGRESS_INDICATOR_OPTIONS: { value: ProgressIndicator; label: string }[] = [
  { value: "page-completion",      label: "Show page completion" },
  { value: "course-completion",    label: "Show course completion indicator" },
  { value: "nav-bar",              label: "Show progress in the navigation bar" },
  { value: "all-content-objects",  label: "Display all content objects and the current page components" },
  { value: "course-level-nav-btn", label: "Use course-level progress on navigation button" },
];

const PROGRESS_TYPE_OPTIONS: { value: ProgressType; label: string }[] = [
  { value: "pages",     label: "Pages" },
  { value: "questions", label: "Questions" },
];

const PROGRESS_FORMAT_OPTIONS: { value: ProgressFormat; label: string }[] = [
  { value: "bar",        label: "Bar" },
  { value: "stepper",    label: "Stepper" },
  { value: "percentage", label: "Percentage" },
];

function ProgressFormatPreview({ format }: { format: ProgressFormat }) {
  if (format === "bar") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#e5e7eb]">
        <span className="text-xs text-[#6b7280] shrink-0">Progress</span>
        <div className="flex-1 h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-[#2d6fa8] rounded-full" />
        </div>
        <span className="text-xs font-semibold text-[#2d6fa8] shrink-0">66%</span>
      </div>
    );
  }
  if (format === "stepper") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-[#e5e7eb]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                i <= 3
                  ? "bg-[#2d6fa8] border-[#2d6fa8] text-white"
                  : "border-[#d1d5db] text-[#9ca3af] bg-white"
              }`}
            >
              {i <= 2 ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : i}
            </div>
            {i < 5 && <div className={`h-0.5 w-3 ${i < 3 ? "bg-[#2d6fa8]" : "bg-[#e5e7eb]"}`} />}
          </div>
        ))}
      </div>
    );
  }
  // percentage
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#e5e7eb]">
      <span className="text-xs text-[#6b7280]">Progress</span>
      <span className="text-2xl font-bold text-[#2d6fa8]">66<span className="text-base">%</span></span>
      <span className="text-xs text-[#9ca3af]">complete</span>
    </div>
  );
}

function ProgressIndicatorsSection({
  cfg,
  set,
}: {
  cfg: CompletionProgressSettings;
  set: <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) => void;
}) {
  return (
    <div className="pt-2 space-y-4">
      <p className="text-sm text-[#6b7280]">Choose which progress elements are visible to learners.</p>

      {/* Show indicators multi-select */}
      <InnerCard
        title="Show progress indicators"
        subtitle="Select all that apply"
      >
        <CheckboxMulti<ProgressIndicator>
          selected={cfg.progressIndicators}
          onChange={(v) => set("progressIndicators", v)}
          options={PROGRESS_INDICATOR_OPTIONS}
        />
      </InnerCard>

      {/* Type + Format */}
      <div className="grid grid-cols-2 gap-4">
        <SelectField<ProgressType>
          label="Progress Type"
          value={cfg.progressType}
          onChange={(v) => set("progressType", v)}
          options={PROGRESS_TYPE_OPTIONS}
        />
        <SelectField<ProgressFormat>
          label="Progression Format"
          value={cfg.progressFormat}
          onChange={(v) => set("progressFormat", v)}
          options={PROGRESS_FORMAT_OPTIONS}
        />
      </div>

      {/* Format preview */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#374151]">Format Preview</p>
        <ProgressFormatPreview format={cfg.progressFormat} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section 5 – Time Estimate
───────────────────────────────────────────────────────────── */

function TimeEstimateSection({
  cfg,
  set,
}: {
  cfg: CompletionProgressSettings;
  set: <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) => void;
}) {
  return (
    <div className="pt-2 space-y-4">
      <p className="text-sm text-[#6b7280]">Configure the time estimate display shown to learners.</p>

      <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
        <div className="px-4 py-4 space-y-4">
          <TextInput
            label="Icon class"
            value={cfg.timeIconClass}
            onChange={(v) => set("timeIconClass", v)}
            placeholder="icon-time"
          />
          <TextInput
            label="Text before duration"
            value={cfg.timeTextBefore}
            onChange={(v) => set("timeTextBefore", v)}
            placeholder="Remaining time to complete module"
          />
          <TextInput
            label="Text after duration"
            value={cfg.timeTextAfter}
            onChange={(v) => set("timeTextAfter", v)}
            placeholder="minutes"
          />
          <TextInput
            label="Text shown when module is completed"
            value={cfg.timeTextCompleted}
            onChange={(v) => set("timeTextCompleted", v)}
            placeholder="Module completed"
          />
        </div>
      </div>

      {/* Live preview chip */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-[#374151]">Live Preview</p>

        {/* In-progress state */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#f9fafb] border border-[#e5e7eb]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-xs text-[#374151]">
            <span className="font-medium">{cfg.timeTextBefore || "Remaining time to complete module"}</span>
            {" "}
            <span className="text-[#2d6fa8] font-bold">15</span>
            {" "}
            <span>{cfg.timeTextAfter || "minutes"}</span>
          </span>
        </div>

        {/* Completed state */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
          </svg>
          <span className="text-xs font-medium text-[#15803d]">
            {cfg.timeTextCompleted || "Module completed"}
          </span>
        </div>
      </div>
    </div>
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
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
}: CompletionProgressPageProps) {
  /* ── State ── */
  const [cfg, setCfg] = useState<CompletionProgressSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<CompletionProgressSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* Track which accordions are open (all closed by default) */
  type Section = "completionRules" | "completionFeedback" | "resumeBookmarking" | "progressIndicators" | "timeEstimate";
  const [openSections, setOpenSections] = useState<Set<Section>>(new Set(["completionRules"]));

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);

  /* ── Helpers ── */
  const set = useCallback(
    <K extends keyof CompletionProgressSettings>(k: K, v: CompletionProgressSettings[K]) =>
      setCfg((prev) => ({ ...prev, [k]: v })),
    [],
  );

  function toggleSection(s: Section) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  /* ── Unsaved-changes navigation guard ── */
  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } =
    useUnsavedChangesNavigationGuard({
      hasChanges: dirty,
      pendingNavigation,
      onPendingNavigationHandled,
      onNavigate: onNavigationRequest,
    });

  /* ── Save / Discard ── */
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      // Future: wire to API  e.g. await saveCompletionProgressSettings(courseId, cfg)
      await new Promise((r) => setTimeout(r, 300)); // optimistic stub
      setSaved(cfg);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setCfg(saved);
    setSaveError(null);
  }

  async function handleConfirmSave() {
    await handleSave();
    const target = consumePendingNavigation();
    if (target) onNavigationRequest?.(target);
  }

  function handleConfirmDiscard() {
    handleDiscard();
    const target = consumePendingNavigation();
    if (target) onNavigationRequest?.(target);
  }

  /* Reset local state whenever courseId changes (future: load from API) */
  useEffect(() => {
    setCfg(DEFAULT_SETTINGS);
    setSaved(DEFAULT_SETTINGS);
    setSaveError(null);
  }, []);

  /* ─────────────────────────────────────────────────────────────
     Render
  ───────────────────────────────────────────────────────────── */

  return (
    <div className="max-w-3xl w-full">

      {/* ── Page header ── */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#111827]">Completion &amp; Progress</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">
          Configure how course and page completion is tracked and displayed to learners.
        </p>
      </div>

      {/* ── Unsaved changes bar ── */}
      {dirty && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-white shadow-sm px-4 py-2.5">
          <div className="flex items-center gap-2">
            <svg className="shrink-0 text-[#f59e0b]" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" /><path d="M12 17h.01" />
            </svg>
            <span className="text-sm text-[#4b5563]">You have unsaved changes</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded-lg text-[#374151] bg-white border border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-3.5 py-1.5 text-sm font-semibold rounded-lg text-white bg-[#2d6fa8] hover:bg-[#235694] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* ── Save error ── */}
      {saveError && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          {saveError}
        </div>
      )}

      {/* ── Accordion list ── */}
      <div className="space-y-3">

        {/* 1 – Completion Rules */}
        <AccordionCard
          open={openSections.has("completionRules")}
          onToggle={() => toggleSection("completionRules")}
          title="Completion Rules"
          icon={ICONS.completionRules}
        >
          <CompletionRulesSection cfg={cfg} set={set} />
        </AccordionCard>

        {/* 2 – Completion Feedback */}
        <AccordionCard
          open={openSections.has("completionFeedback")}
          onToggle={() => toggleSection("completionFeedback")}
          title="Completion Feedback"
          icon={ICONS.completionFeedback}
        >
          <CompletionFeedbackSection cfg={cfg} set={set} />
        </AccordionCard>

        {/* 3 – Resume & Bookmarking */}
        <AccordionCard
          open={openSections.has("resumeBookmarking")}
          onToggle={() => toggleSection("resumeBookmarking")}
          title="Resume &amp; Bookmarking"
          icon={ICONS.resumeBookmarking}
        >
          <ResumeBookmarkingSection cfg={cfg} set={set} />
        </AccordionCard>

        {/* 4 – Progress Indicators */}
        <AccordionCard
          open={openSections.has("progressIndicators")}
          onToggle={() => toggleSection("progressIndicators")}
          title="Progress Indicators"
          icon={ICONS.progressIndicators}
        >
          <ProgressIndicatorsSection cfg={cfg} set={set} />
        </AccordionCard>

        {/* 5 – Time Estimate */}
        <AccordionCard
          open={openSections.has("timeEstimate")}
          onToggle={() => toggleSection("timeEstimate")}
          title="Time Estimate"
          icon={ICONS.timeEstimate}
        >
          <TimeEstimateSection cfg={cfg} set={set} />
        </AccordionCard>

      </div>

      {/* ── Bottom save button ── */}
      <div className="mt-8 flex items-center justify-end gap-3 border-t border-[#f3f4f6] pt-5">
        <button
          type="button"
          onClick={handleDiscard}
          disabled={!dirty || saving}
          className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Discard Changes
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!dirty || saving}
          className="px-5 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#235694] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* ── Bottom padding ── */}
      <div className="h-8" />

      {/* ── Unsaved changes navigation modal ── */}
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
