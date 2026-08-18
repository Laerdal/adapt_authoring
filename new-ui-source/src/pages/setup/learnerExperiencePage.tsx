import React, { useEffect, useState } from "react";
import AssetPickerModal from "../../components/common/AssetPickerModal";
import {
  defaultAiTutorSettings,
  defaultCourseFeedbackSettings,
  defaultLearnerNotesSettings,
  defaultLearnerSearchSettings,
  defaultLearningResourcesSettings,
  getAiTutorSettings,
  getCourseFeedbackSettings,
  getLearnerNotesSettings,
  getLearnerSearchSettings,
  getLearningResourcesSettings,
  saveAiTutorSettings,
  saveCourseFeedbackSettings,
  saveLearnerNotesSettings,
  saveLearnerSearchSettings,
  saveLearningResourcesSettings,
  type AiTutorSettings,
  type CourseFeedbackOption,
  type CourseFeedbackSettings,
  type LearnerNotesSettings,
  type LearnerSearchSettings,
  type LearningResourceItem,
  type LearningResourcesSettings,
  type LearningResourceFilterText as LrFilterTextHelper,
} from "../../helpers/learnerExperienceHelper";
import { UnsavedChangesModal } from "./unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";

/* -------------------------------------------------------------
   LEARNER EXPERIENCE PANEL - Learning Resources accordion
   ------------------------------------------------------------- */

type ResourceFormat = LearningResourceItem["format"];

// Re-use imported types under local names for backwards compat with existing JSX
type LearningResource = LearningResourceItem;
type LearningResourcesState = LearningResourcesSettings;

type LearningResourceFilterText = LrFilterTextHelper;

const LEARNING_RESOURCE_FILTER_FIELDS: { key: keyof LearningResourceFilterText; label: string }[] = [
  { key: "all", label: "All" },
  { key: "document", label: "Document" },
  { key: "media", label: "Media" },
  { key: "link", label: "Link" },
  { key: "customType1", label: "Custom type 1" },
  { key: "customType2", label: "Custom type 2" },
  { key: "customType3", label: "Custom type 3" },
  { key: "customType4", label: "Custom type 4" },
  { key: "customType5", label: "Custom type 5" },
  { key: "customType6", label: "Custom type 6" },
  { key: "customType7", label: "Custom type 7" },
  { key: "customType8", label: "Custom type 8" },
  { key: "customType9", label: "Custom type 9" },
  { key: "customType10", label: "Custom type 10" },
];

const RESOURCE_FORMAT_OPTIONS: { value: ResourceFormat; label: string }[] = [
  { value: "document", label: "Document" },
  { value: "media",    label: "Media" },
  { value: "link",     label: "Link" },
  { value: "custom1",   label: "Custom 1" },
  { value: "custom2",   label: "Custom 2" },
  { value: "custom3",   label: "Custom 3" },
  { value: "custom4",   label: "Custom 4" },
  { value: "custom5",   label: "Custom 5" },
  { value: "custom6",   label: "Custom 6" },
  { value: "custom7",   label: "Custom 7" },
  { value: "custom8",   label: "Custom 8" },
  { value: "custom9",   label: "Custom 9" },
  { value: "custom10",  label: "Custom 10" },
];

function getResourceFormatLabel(format: ResourceFormat): string {
  if (format === "document") return "Document";
  if (format === "media") return "Media";
  if (format === "link") return "Link";
  return `Custom ${format.slice(6)}`;
}

function newResource(): LearningResource {
  return {
    id: Math.random().toString(36).slice(2),
    format: "document",
    forceDownload: false,
    title: "",
    fileName: "",
    description: "",
    sourceType: "asset",
    assetValue: "",
    urlValue: "",
    displayOnEveryPage: false,
  };
}

/* small helpers */
function LrToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6fa8] ${checked ? "bg-[#2d6fa8]" : "bg-[#d1d5db]"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150 ${checked ? "translate-x-4" : ""}`} />
      </button>
      <span className="text-sm text-[#374151]">{label}</span>
    </label>
  );
}

function LrField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[#374151]">{label}</label>
      {children}
    </div>
  );
}

const LR_INPUT = "w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent";
const LR_TEXTAREA = `${LR_INPUT} resize-none`;

/* Demo video placeholder shown at top of each accordion section */
function DemoVideoPlaceholder({ label }: { label?: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-[#e5e7eb]">
      <div className="relative bg-[#1b3a4b] flex flex-col items-center justify-center gap-2.5" style={{ aspectRatio: '16/9' }}>
        <div className="w-12 h-12 rounded-full bg-white/15 border-2 border-white/35 flex items-center justify-center backdrop-blur-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
        <span className="text-xs text-white/50 font-medium">{label ?? 'Demo video coming soon'}</span>
      </div>
    </div>
  );
}

/* Add Resource modal/drawer */
function AddResourceDialog({
  initial,
  onAdd,
  onCancel,
}: {
  initial?: LearningResource;
  onAdd: (r: LearningResource) => void;
  onCancel: () => void;
}) {
  const [res, setRes] = useState<LearningResource>(initial ?? newResource());
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const set = <K extends keyof LearningResource>(k: K, v: LearningResource[K]) =>
    setRes((prev) => ({ ...prev, [k]: v }));

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f6] shrink-0">
          <h3 className="text-base font-bold text-[#111827]">Add Resource</h3>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Resource Format */}
          <LrField label="Resource Format">
            <div className="relative">
              <select
                value={res.format}
                onChange={(e) => set("format", e.target.value as ResourceFormat)}
                aria-label="Resource Format"
                className={`${LR_INPUT} appearance-none pr-8`}
              >
                {RESOURCE_FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </LrField>

          {/* Force Download */}
          <LrToggle
            checked={res.forceDownload}
            onChange={(v) => set("forceDownload", v)}
            label="Force download"
          />

          {/* Title */}
          <LrField label="Title">
            <input
              type="text"
              value={res.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Enter resource title"
              className={LR_INPUT}
            />
          </LrField>

          {/* File Name */}
          <LrField label="File Name">
            <input
              type="text"
              value={res.fileName}
              onChange={(e) => set("fileName", e.target.value)}
              placeholder="Enter file name"
              className={LR_INPUT}
            />
          </LrField>

          {/* Description */}
          <LrField label="Description">
            <textarea
              value={res.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Enter resource description"
              rows={3}
              className={LR_TEXTAREA}
            />
          </LrField>

          {/* Source - asset vs URL tabs */}
          <LrField label="Source">
            <div className="flex rounded-lg border border-[#e5e7eb] overflow-hidden mb-2">
              {(["asset", "url"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("sourceType", t)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    res.sourceType === t ? "bg-[#2d6fa8] text-white" : "bg-white text-[#6b7280] hover:bg-[#f9fafb]"
                  }`}
                >
                  {t === "asset" ? "Select from Asset" : "URL"}
                </button>
              ))}
            </div>
            {res.sourceType === "asset" ? (
              <button
                type="button"
                onClick={() => setAssetPickerOpen(true)}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#d1d5db] rounded-xl py-4 text-sm text-[#6b7280] hover:border-[#2d6fa8] hover:text-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                {res.assetValue ? res.assetValue : "Browse assets..."}
              </button>
            ) : (
              <input
                type="url"
                value={res.urlValue}
                onChange={(e) => set("urlValue", e.target.value)}
                placeholder="https://example.com/resource"
                className={LR_INPUT}
              />
            )}
          </LrField>

          {/* Display on every page */}
          <LrToggle
            checked={res.displayOnEveryPage}
            onChange={(v) => set("displayOnEveryPage", v)}
            label="Is display on every page?"
          />
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#f3f4f6] shrink-0 bg-[#f9fafb]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#e5e7eb] rounded-lg hover:bg-[#f3f4f6] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onAdd(res)}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>

    {assetPickerOpen && (
      <AssetPickerModal
        onSelect={(asset) => {
          set("assetValue", asset.assetLink);
          setAssetPickerOpen(false);
        }}
        onClose={() => setAssetPickerOpen(false)}
      />
    )}
    </>
  );
}

/* Resource format icon badge with colored background (matches Figma design) */
const FORMAT_STYLES: Record<ResourceFormat, { bg: string; color: string }> = {
  document: { bg: "#fee2e2", color: "#dc2626" },
  media:    { bg: "#ede9f6", color: "#7c5cbf" },
  link:     { bg: "#dbeeff", color: "#2d6fa8" },
  custom1:  { bg: "#d1fae5", color: "#059669" },
  custom2:  { bg: "#d1fae5", color: "#059669" },
  custom3:  { bg: "#d1fae5", color: "#059669" },
  custom4:  { bg: "#d1fae5", color: "#059669" },
  custom5:  { bg: "#d1fae5", color: "#059669" },
  custom6:  { bg: "#d1fae5", color: "#059669" },
  custom7:  { bg: "#d1fae5", color: "#059669" },
  custom8:  { bg: "#d1fae5", color: "#059669" },
  custom9:  { bg: "#d1fae5", color: "#059669" },
  custom10: { bg: "#d1fae5", color: "#059669" },
};

function ResourceFormatIcon({ format }: { format: ResourceFormat }) {
  const { bg, color } = FORMAT_STYLES[format];
  const icon = format === "document" ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ) : format === "media" ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ) : format === "link" ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
  return (
    <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: bg, color }}>
      {icon}
    </span>
  );
}

/* -- Course Feedback types -- */
type CourseFeedbackState = CourseFeedbackSettings;

const COURSE_FEEDBACK_OPTIONS: { value: CourseFeedbackOption; label: string }[] = [
  { value: "autoOpen",        label: "Auto-open on course complete" },
  { value: "hideAfterSubmit", label: "Hide button after submission" },
];

/* -- Ask AI Tutor types -- */

type AiTutorState = AiTutorSettings;

/* -- Learner Notes types -- */
type LearnerNotesState = LearnerNotesSettings;

/* -- Learner Search types -- */
type LearnerSearchState = LearnerSearchSettings;

/* shared multi-select checkbox list */
function LrCheckList<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (v: T[]) => void;
}) {
  function toggle(val: T) {
    onChange(
      selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val],
    );
  }
  return (
    <div className="space-y-1">
      {options.map(({ value, label }) => {
        const checked = selected.includes(value);
        return (
          <label
            key={value}
            className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-[#f9fafb] cursor-pointer group"
          >
            <div
              onClick={() => toggle(value)}
              className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${
                checked
                  ? "bg-[#2d6fa8] border-[#2d6fa8]"
                  : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
              }`}
            >
              {checked && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <span className="text-sm text-[#374151] leading-snug">{label}</span>
          </label>
        );
      })}
    </div>
  );
}

/* shared single-select radio list */
function LrRadioList<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {options.map(({ value, label }) => {
        const active = selected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              active
                ? "bg-[#2d6fa8] border-[#2d6fa8] text-white"
                : "bg-white border-[#e5e7eb] text-[#374151] hover:border-[#93c5fd] hover:bg-[#f0f7ff]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* -- Ignored words tag input -- */
function IgnoredWordsInput({ words, onChange }: { words: string[]; onChange: (w: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function addWord(raw: string) {
    const word = raw.trim().toLowerCase();
    if (word && !words.includes(word)) onChange([...words, word]);
    setDraft("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addWord(draft);
    } else if (e.key === "Backspace" && draft === "" && words.length > 0) {
      onChange(words.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 min-h-[44px] w-full px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white focus-within:ring-2 focus-within:ring-[#2d6fa8] focus-within:border-transparent transition-all">
      {words.map((w) => (
        <span key={w} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#dbeeff] text-[#1e4f7a] text-xs font-medium">
          {w}
          <button type="button" onClick={() => onChange(words.filter((x) => x !== w))} className="text-[#2d6fa8] hover:text-[#1e4f7a] leading-none">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (draft.trim()) addWord(draft); }}
        placeholder={words.length === 0 ? "Type a word and press Enter" : ""}
        className="flex-1 min-w-[120px] text-sm text-[#111827] outline-none bg-transparent placeholder-[#9ca3af]"
      />
    </div>
  );
}

/* reusable accordion shell used by both Learning Resources and Learner Search */
function LeAccordion({
  open,
  onToggle,
  icon,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#e5e7eb] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-[#f9fafb] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[#2d6fa8]">{icon}</span>
          <span className="text-sm font-semibold text-[#111827]">{title}</span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="px-[22px] py-[20px] border-t border-[#f3f4f6] bg-white space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function LearnerExperiencePanel({
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
  /* -- Learning Resources state -- */
  const [lrState, setLrState] = useState<LearningResourcesState>(defaultLearningResourcesSettings);
  const [savedLrState, setSavedLrState] = useState<LearningResourcesState>(defaultLearningResourcesSettings);
  const [lrLoading, setLrLoading] = useState(false);
  const [lrSaving, setLrSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [lrOpen, setLrOpen] = useState(false);

  const setLr = <K extends keyof LearningResourcesState>(k: K, v: LearningResourcesState[K]) =>
    setLrState((prev) => ({ ...prev, [k]: v }));

  function setLrFilterButton<K extends keyof LearningResourceFilterText>(k: K, v: LearningResourceFilterText[K]) {
    setLrState((prev) => ({ ...prev, filterButtons: { ...prev.filterButtons, [k]: v } }));
  }

  function setLrAriaLabel<K extends keyof LearningResourceFilterText>(k: K, v: LearningResourceFilterText[K]) {
    setLrState((prev) => ({ ...prev, ariaLabels: { ...prev.ariaLabels, [k]: v } }));
  }

  function handleAddResource(r: LearningResource) {
    setLrState((prev) => ({ ...prev, resources: [...prev.resources, r] }));
    setShowAddDialog(false);
  }

  function handleRemoveResource(id: string) {
    setLrState((prev) => ({ ...prev, resources: prev.resources.filter((r) => r.id !== id) }));
  }

  /* -- Learner Notes state -- */
  const [lnOpen, setLnOpen] = useState(false);
  const [lnState, setLnState] = useState<LearnerNotesState>(defaultLearnerNotesSettings());
  const [savedLnState, setSavedLnState] = useState<LearnerNotesState>(defaultLearnerNotesSettings());
  const [lnLoading, setLnLoading] = useState(false);
  const [lsLoading, setLsLoading] = useState(false);
  const [atLoading, setAtLoading] = useState(false);
  const [cfLoading, setCfLoading] = useState(false);
  const [lnSaving, setLnSaving] = useState(false);
  const [lnToast, setLnToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [lsOpen, setLsOpen] = useState(false);
  const [lsState, setLsState] = useState<LearnerSearchState>(defaultLearnerSearchSettings());
  const [savedLsState, setSavedLsState] = useState<LearnerSearchState>(defaultLearnerSearchSettings());
  const [cfOpen, setCfOpen] = useState(false);
  const [cfState, setCfState] = useState<CourseFeedbackState>(defaultCourseFeedbackSettings());
  const [savedCfState, setSavedCfState] = useState<CourseFeedbackState>(defaultCourseFeedbackSettings());
  const [atOpen, setAtOpen] = useState(false);
  const [atState, setAtState] = useState<AiTutorState>(defaultAiTutorSettings());
  const [savedAtState, setSavedAtState] = useState<AiTutorState>(defaultAiTutorSettings());
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const setLn = <K extends keyof LearnerNotesState>(k: K, v: LearnerNotesState[K]) =>
    setLnState((prev) => ({ ...prev, [k]: v }));
  const setLs = <K extends keyof LearnerSearchState>(k: K, v: LearnerSearchState[K]) =>
    setLsState((prev) => ({ ...prev, [k]: v }));
  const setCf = <K extends keyof CourseFeedbackState>(k: K, v: CourseFeedbackState[K]) =>
    setCfState((prev) => ({ ...prev, [k]: v }));
  const setAt = <K extends keyof AiTutorState>(k: K, v: AiTutorState[K]) =>
    setAtState((prev) => ({ ...prev, [k]: v }));

  function setMatchOn(key: keyof LearnerSearchState["matchOn"], value: boolean) {
    setLsState((prev) => ({ ...prev, matchOn: { ...prev.matchOn, [key]: value } }));
  }

  useEffect(() => {
    if (!courseId) {
      const defaults = defaultLearningResourcesSettings();
      setLrState(defaults);
      setSavedLrState(defaults);
      return;
    }

    let cancelled = false;
    (async () => {
      setLrLoading(true);
      try {
        const loaded = await getLearningResourcesSettings(courseId);
        if (cancelled) return;
        setLrState(loaded);
        setSavedLrState(loaded);
      } catch {
        if (cancelled) return;
        const defaults = defaultLearningResourcesSettings();
        setLrState(defaults);
        setSavedLrState(defaults);
      } finally {
        if (!cancelled) setLrLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [courseId]);

  useEffect(() => {
    if (!courseId) {
      const defaults = defaultLearnerNotesSettings();
      setLnState(defaults);
      setSavedLnState(defaults);
      return;
    }

    let cancelled = false;
    (async () => {
      setLnLoading(true);
      try {
        const loaded = await getLearnerNotesSettings(courseId);
        if (cancelled) return;
        setLnState(loaded);
        setSavedLnState(loaded);
      } catch {
        if (cancelled) return;
        const defaults = defaultLearnerNotesSettings();
        setLnState(defaults);
        setSavedLnState(defaults);
      } finally {
        if (!cancelled) setLnLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!courseId) {
      const defaults = defaultCourseFeedbackSettings();
      setCfState(defaults);
      setSavedCfState(defaults);
      return;
    }

    let cancelled = false;
    (async () => {
      setCfLoading(true);
      try {
        const loaded = await getCourseFeedbackSettings(courseId);
        if (cancelled) return;
        setCfState(loaded);
        setSavedCfState(loaded);
      } catch {
        if (cancelled) return;
        const defaults = defaultCourseFeedbackSettings();
        setCfState(defaults);
        setSavedCfState(defaults);
      } finally {
        if (!cancelled) setCfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!courseId) {
      const defaults = defaultLearnerSearchSettings();
      setLsState(defaults);
      setSavedLsState(defaults);
      return;
    }

    let cancelled = false;
    (async () => {
      setLsLoading(true);
      try {
        const loaded = await getLearnerSearchSettings(courseId);
        if (cancelled) return;
        setLsState(loaded);
        setSavedLsState(loaded);
      } catch {
        if (cancelled) return;
        const defaults = defaultLearnerSearchSettings();
        setLsState(defaults);
        setSavedLsState(defaults);
      } finally {
        if (!cancelled) setLsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!courseId) {
      const defaults = defaultAiTutorSettings();
      setAtState(defaults);
      setSavedAtState(defaults);
      return;
    }

    let cancelled = false;
    (async () => {
      setAtLoading(true);
      try {
        const loaded = await getAiTutorSettings(courseId);
        if (cancelled) return;
        setAtState(loaded);
        setSavedAtState(loaded);
      } catch {
        if (cancelled) return;
        const defaults = defaultAiTutorSettings();
        setAtState(defaults);
        setSavedAtState(defaults);
      } finally {
        if (!cancelled) setAtLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!lnToast) return;
    const t = setTimeout(() => setLnToast(null), 3500);
    return () => clearTimeout(t);
  }, [lnToast]);

  const lnDirty = JSON.stringify(lnState) !== JSON.stringify(savedLnState);
  const lsDirty = JSON.stringify(lsState) !== JSON.stringify(savedLsState);
  const cfDirty = JSON.stringify(cfState) !== JSON.stringify(savedCfState);
  const lrDirty = JSON.stringify(lrState) !== JSON.stringify(savedLrState);
  const atDirty = JSON.stringify(atState) !== JSON.stringify(savedAtState);
  const hasChanges = lnDirty || lsDirty || cfDirty || lrDirty || atDirty;

  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } =
    useUnsavedChangesNavigationGuard({
      hasChanges,
      pendingNavigation,
      onPendingNavigationHandled,
      onNavigate: onNavigationRequest,
    });

  function handleLnCancel() {
    setLnState(savedLnState);
    setLsState(savedLsState);
    setCfState(savedCfState);
    setLrState(savedLrState);
    setAtState(savedAtState);
  }

  async function handleLnSave() {
    if (!courseId || lnSaving) return;
    setLnSaving(true);
    setLnToast(null);
    try {
      await saveLearnerNotesSettings(courseId, lnState as LearnerNotesSettings);
      await saveLearnerSearchSettings(courseId, lsState);
      await saveCourseFeedbackSettings(courseId, cfState);
      await saveLearningResourcesSettings(courseId, lrState);
      await saveAiTutorSettings(courseId, atState);
      setSavedLnState(lnState);
      setSavedLsState(lsState);
      setSavedCfState(cfState);
      setSavedLrState(lrState);
      setSavedAtState(atState);
      setLnToast({ type: "success", message: "Changes saved successfully" });
    } catch {
      setLnToast({ type: "error", message: "Couldn't save. Please try again." });
    } finally {
      setLnSaving(false);
    }
  }

  async function handleConfirmSave() {
    if (!courseId || lnSaving) return;
    setLnSaving(true);
    setLnToast(null);
    try {
      await saveLearnerNotesSettings(courseId, lnState);
      await saveLearnerSearchSettings(courseId, lsState);
      await saveCourseFeedbackSettings(courseId, cfState);
      await saveLearningResourcesSettings(courseId, lrState);
      await saveAiTutorSettings(courseId, atState);
      setSavedLnState(lnState);
      setSavedLsState(lsState);
      setSavedCfState(cfState);
      setSavedLrState(lrState);
      setSavedAtState(atState);
      const navTarget = consumePendingNavigation();
      setLnToast({ type: "success", message: "Changes saved successfully" });
      if (navTarget) onNavigationRequest?.(navTarget);
    } catch {
      setLnToast({ type: "error", message: "Couldn't save. Please try again." });
    } finally {
      setLnSaving(false);
    }
  }

  function handleConfirmDiscard() {
    setLnState(savedLnState);
    setLsState(savedLsState);
    setCfState(savedCfState);
    setLrState(savedLrState);
    setAtState(savedAtState);
    const navTarget = consumePendingNavigation();
    if (navTarget) onNavigationRequest?.(navTarget);
  }

  function handleAddDocument() {
    setAssetPickerOpen(true);
  }

  function handleRemoveDocument(id: string) {
    setAtState((prev) => ({ ...prev, documents: prev.documents.filter((d) => d.id !== id) }));
  }

  return (
    <div className="max-w-2xl w-full">
      {/* header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#111827]">Learner Experience</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Configure what learners see and can access throughout the course.</p>
      </div>

      <div className="space-y-3">

        {/* -- Learning Resources accordion -- */}
        <LeAccordion
          open={lrOpen}
          onToggle={() => setLrOpen((o) => !o)}
          title="Learning Resources"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          }
        >
          {/* Enable toggle */}
          <DemoVideoPlaceholder label="See how Learning Resources works" />
          {lrLoading && (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-sm text-[#6b7280]">
              Loading Learning Resources settings...
            </div>
          )}
          <div className={`pt-3${lrState.enabled ? " pb-4 border-b border-[#e5e7eb]" : ""}`}>
            <LrToggle
              checked={lrState.enabled}
              onChange={(v) => setLr("enabled", v)}
              label="Enable Learning Resources"
            />
          </div>

          {lrState.enabled && (
            <>
              {/* Drawer order */}
              <LrField label="Drawer order">
                <input
                  type="number"
                  min={0}
                  value={lrState.drawerOrder}
                  onChange={(e) => setLr("drawerOrder", Number(e.target.value))}
                  className={LR_INPUT}
                />
              </LrField>

              {/* Section Title */}
              <LrField label="Title">
                <input
                  type="text"
                  value={lrState.sectionTitle}
                  onChange={(e) => setLr("sectionTitle", e.target.value)}
                  placeholder="e.g. Additional Resources"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Description */}
              <LrField label="Description">
                <textarea
                  value={lrState.description}
                  onChange={(e) => setLr("description", e.target.value)}
                  placeholder="Briefly describe the resources available to learners"
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>

              <LrField label="Display Title">
                <input
                  type="text"
                  value={lrState.displayTitle}
                  onChange={(e) => setLr("displayTitle", e.target.value)}
                  placeholder="e.g. Resources"
                  className={LR_INPUT}
                />
              </LrField>

              <LrField label="Body">
                <input
                  type="text"
                  value={lrState.body}
                  onChange={(e) => setLr("body", e.target.value)}
                  placeholder="e.g. Explore additional learner resources"
                  className={LR_INPUT}
                />
              </LrField>

              <LrField label="Instruction">
                <input
                  type="text"
                  value={lrState.instruction}
                  onChange={(e) => setLr("instruction", e.target.value)}
                  placeholder="e.g. Select a filter to narrow resources"
                  className={LR_INPUT}
                />
              </LrField>

              <LrToggle
                checked={lrState.enableFilterButton}
                onChange={(v) => setLr("enableFilterButton", v)}
                label="Enable filter button"
              />

              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Filter Buttons</p>
                </div>
                <div className="px-4 py-4 space-y-3">
                  {LEARNING_RESOURCE_FILTER_FIELDS.map(({ key, label }) => (
                    <LrField key={key} label={label}>
                      <input
                        type="text"
                        value={lrState.filterButtons[key]}
                        onChange={(e) => setLrFilterButton(key, e.target.value)}
                        placeholder={`e.g. ${label}`}
                        className={LR_INPUT}
                      />
                    </LrField>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Aria Labels</p>
                </div>
                <div className="px-4 py-4 space-y-3">
                  {LEARNING_RESOURCE_FILTER_FIELDS.map(({ key, label }) => (
                    <LrField key={`aria-${key}`} label={key === "link" ? "Links" : label}>
                      <input
                        type="text"
                        value={lrState.ariaLabels[key]}
                        onChange={(e) => setLrAriaLabel(key, e.target.value)}
                        placeholder={key === "link" ? "e.g. Links" : `e.g. ${label}`}
                        className={LR_INPUT}
                      />
                    </LrField>
                  ))}
                </div>
              </div>

              {/* Resources list */}
              {lrState.resources.length > 0 && (
                <div className="space-y-2">
                  {lrState.resources.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
                      <ResourceFormatIcon format={r.format} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">{r.title || <span className="text-[#9ca3af] font-normal">Untitled resource</span>}</p>
                        <p className="text-xs text-[#6b7280]">{getResourceFormatLabel(r.format)}{r.displayOnEveryPage ? " · Every page" : ""}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveResource(r.id)}
                        className="p-1 rounded text-[#9ca3af] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-colors shrink-0"
                        title="Remove resource"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add resource button */}
              <button
                type="button"
                onClick={() => setShowAddDialog(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-[#d1d5db] text-sm text-[#6b7280] hover:border-[#2d6fa8] hover:text-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors w-full justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add resource
              </button>
            </>
          )}
        </LeAccordion>

        {/* -- Learner Notes accordion -- */}
        <LeAccordion
          open={lnOpen}
          onToggle={() => setLnOpen((o) => !o)}
          title="Learner Notes"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          }
        >
          <DemoVideoPlaceholder label="See how Learner Notes works" />
          {lnLoading && (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-sm text-[#6b7280]">
              Loading Learner Notes settings...
            </div>
          )}
          <div className={`pt-3${lnState.enabled ? " pb-4 border-b border-[#e5e7eb]" : ""}`}>
            <LrToggle
              checked={lnState.enabled}
              onChange={(v) => setLn("enabled", v)}
              label="Enable Notes"
            />
          </div>

          {lnState.enabled && (
            <>
              <LrField label="Title">
                <input type="text" value={lnState.title} onChange={(e) => setLn("title", e.target.value)} placeholder="e.g. My Notes" className={LR_INPUT} />
              </LrField>
              <LrField label="Instruction">
                <input type="text" value={lnState.instruction} onChange={(e) => setLn("instruction", e.target.value)} placeholder="e.g. Write your notes here" className={LR_INPUT} />
              </LrField>
              <LrField label="Placeholder">
                <input type="text" value={lnState.placeholder} onChange={(e) => setLn("placeholder", e.target.value)} placeholder="e.g. Start typing your notes..." className={LR_INPUT} />
              </LrField>
              <LrField label="Search Error Message">
                <input type="text" value={lnState.searchErrorMessage} onChange={(e) => setLn("searchErrorMessage", e.target.value)} placeholder="e.g. Sorry, no results were found" className={LR_INPUT} />
              </LrField>
              <LrField label="Success Message">
                <input type="text" value={lnState.successMessage} onChange={(e) => setLn("successMessage", e.target.value)} placeholder="e.g. Note saved successfully" className={LR_INPUT} />
              </LrField>
              <LrField label="Error Message">
                <input type="text" value={lnState.errorMessage} onChange={(e) => setLn("errorMessage", e.target.value)} placeholder="e.g. An error occurred. Please try again." className={LR_INPUT} />
              </LrField>
              <LrField label="Create a New Note">
                <input type="text" value={lnState.createANewNote} onChange={(e) => setLn("createANewNote", e.target.value)} placeholder="e.g. Create a new note" className={LR_INPUT} />
              </LrField>
              <LrField label="Export a Note">
                <input type="text" value={lnState.exportANote} onChange={(e) => setLn("exportANote", e.target.value)} placeholder="e.g. Export note" className={LR_INPUT} />
              </LrField>
              <LrField label="Save Note">
                <input type="text" value={lnState.saveNote} onChange={(e) => setLn("saveNote", e.target.value)} placeholder="e.g. Save note" className={LR_INPUT} />
              </LrField>
              <LrField label="Download a Note">
                <input type="text" value={lnState.downloadANote} onChange={(e) => setLn("downloadANote", e.target.value)} placeholder="e.g. Download note" className={LR_INPUT} />
              </LrField>
              <LrField label="Upload a Note">
                <input type="text" value={lnState.uploadANote} onChange={(e) => setLn("uploadANote", e.target.value)} placeholder="e.g. Upload note" className={LR_INPUT} />
              </LrField>
              <LrField label="Search Note">
                <input type="text" value={lnState.searchNote} onChange={(e) => setLn("searchNote", e.target.value)} placeholder="e.g. Search notes" className={LR_INPUT} />
              </LrField>
              <LrField label="Delete Note">
                <input type="text" value={lnState.deleteNote} onChange={(e) => setLn("deleteNote", e.target.value)} placeholder="e.g. Delete note" className={LR_INPUT} />
              </LrField>
              <LrField label="Cancel">
                <input type="text" value={lnState.cancel} onChange={(e) => setLn("cancel", e.target.value)} placeholder="e.g. Cancel" className={LR_INPUT} />
              </LrField>
              <LrField label="Edit Note">
                <input type="text" value={lnState.editNote} onChange={(e) => setLn("editNote", e.target.value)} placeholder="e.g. Edit note" className={LR_INPUT} />
              </LrField>
            </>
          )}
        </LeAccordion>

        {/* -- Learner Search accordion -- */}
        <LeAccordion
          open={lsOpen}
          onToggle={() => setLsOpen((o) => !o)}
          title="Learner Search"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          }
        >
          <DemoVideoPlaceholder label="See how Learner Search works" />
          {lsLoading && (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-sm text-[#6b7280]">
              Loading Learner Search settings...
            </div>
          )}
          <div className={`pt-3${lsState.enabled ? " pb-4 border-b border-[#e5e7eb]" : ""}`}>
            <LrToggle checked={lsState.enabled} onChange={(v) => setLs("enabled", v)} label="Enable Search" />
          </div>

          {lsState.enabled && (
            <>
              {/* Match On Rules */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Match On Rules</p>
                  <p className="text-xs text-[#6b7280] mt-1">Select which word-matching strategies are active.</p>
                </div>
                <div className="px-4 py-4 space-y-3">
                  <LrToggle checked={lsState.matchOn.contentWordBeginsPhraseWord} onChange={(v) => setMatchOn("contentWordBeginsPhraseWord", v)} label="A word in the content begins the search phrase word" />
                  <LrToggle checked={lsState.matchOn.contentWordContainsPhraseWord} onChange={(v) => setMatchOn("contentWordContainsPhraseWord", v)} label="A word in the content contains the search phrase word" />
                  <LrToggle checked={lsState.matchOn.contentWordEqualsPhraseWord} onChange={(v) => setMatchOn("contentWordEqualsPhraseWord", v)} label="A word in the content equals the search phrase word" />
                  <LrToggle checked={lsState.matchOn.phraseWordBeginsContentWord} onChange={(v) => setMatchOn("phraseWordBeginsContentWord", v)} label="A word in the content starts with the search phrase word" />
                </div>
              </div>

              {/* Preview */}
              <div className="grid grid-cols-2 gap-4">
                <LrField label="Preview Words">
                  <input type="number" min={0} value={lsState.previewWords} onChange={(e) => setLs("previewWords", Number(e.target.value))} className={LR_INPUT} />
                </LrField>
                <LrField label="Preview Characters">
                  <input type="number" min={0} value={lsState.previewCharacters} onChange={(e) => setLs("previewCharacters", Number(e.target.value))} className={LR_INPUT} />
                </LrField>
              </div>

              {/* Display options */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Display Options</p>
                </div>
                <div className="px-4 py-4 space-y-3">
                  <LrToggle checked={lsState.showFoundWords} onChange={(v) => setLs("showFoundWords", v)} label="Show found words" />
                  <LrToggle checked={lsState.showHighlights} onChange={(v) => setLs("showHighlights", v)} label="Show highlights" />
                </div>
              </div>

              {/* Ignored Words */}
              <LrField label="Ignored Words">
                <IgnoredWordsInput words={lsState.ignoredWords} onChange={(w) => setLs("ignoredWords", w)} />
                <p className="text-xs text-[#9ca3af] mt-1">Type a word and press Enter to add. These words are excluded from search indexing.</p>
              </LrField>

              {/* Numeric settings */}
              <div className="grid grid-cols-2 gap-4">
                <LrField label="Minimum Word Length">
                  <input type="number" min={1} value={lsState.minimumWordLength} onChange={(e) => setLs("minimumWordLength", Number(e.target.value))} className={LR_INPUT} />
                </LrField>
                <LrField label="Frequency Importance">
                  <input type="number" min={0} value={lsState.frequencyImportance} onChange={(e) => setLs("frequencyImportance", Number(e.target.value))} className={LR_INPUT} />
                </LrField>
              </div>

              {/* Text fields */}
              <LrField label="Title">
                <input type="text" value={lsState.title} onChange={(e) => setLs("title", e.target.value)} placeholder="e.g. How can we help?" className={LR_INPUT} />
              </LrField>
              <LrField label="Placeholder">
                <input type="text" value={lsState.placeholder} onChange={(e) => setLs("placeholder", e.target.value)} placeholder="e.g. Type in search words" className={LR_INPUT} />
              </LrField>
              <LrField label="Placeholder Text for the Search Box">
                <input type="text" value={lsState.searchBoxPlaceholder} onChange={(e) => setLs("searchBoxPlaceholder", e.target.value)} placeholder="e.g. Enter search criteria" className={LR_INPUT} />
              </LrField>
              <LrField label="No Results Message">
                <input type="text" value={lsState.noResultsMessage} onChange={(e) => setLs("noResultsMessage", e.target.value)} placeholder="e.g. Sorry, no results were found" className={LR_INPUT} />
              </LrField>
              <LrField label="Processing Results Message">
                <input type="text" value={lsState.processingResultsMessage} onChange={(e) => setLs("processingResultsMessage", e.target.value)} placeholder="e.g. Formulating results..." className={LR_INPUT} />
              </LrField>
            </>
          )}
        </LeAccordion>

        {/* -- Ask AI Tutor accordion -- */}
        <LeAccordion
          open={atOpen}
          onToggle={() => setAtOpen((o) => !o)}
          title="Ask AI Tutor"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        >
          {/* Enable toggle */}
          <DemoVideoPlaceholder label="See how Ask AI Tutor works" />
          {atLoading && (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-sm text-[#6b7280]">
              Loading Ask AI Tutor settings...
            </div>
          )}
          <div className={`pt-3${atState.enabled ? " pb-4 border-b border-[#e5e7eb]" : ""}`}>
            <LrToggle
              checked={atState.enabled}
              onChange={(v) => setAt("enabled", v)}
              label="Enable AI Tutor"
            />
          </div>

          {atState.enabled && (
            <>
              {/* Title */}
              <LrField label="Title">
                <input
                  type="text"
                  value={atState.title}
                  onChange={(e) => setAt("title", e.target.value)}
                  placeholder="e.g. Ask the AI Tutor"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Placeholder Text */}
              <LrField label="Placeholder Text">
                <input
                  type="text"
                  value={atState.placeholderText}
                  onChange={(e) => setAt("placeholderText", e.target.value)}
                  placeholder="e.g. Ask me anything about this course..."
                  className={LR_INPUT}
                />
              </LrField>

              {/* Language Code */}
              <LrField label="Language Code">
                <input
                  type="text"
                  value={atState.languageCode}
                  onChange={(e) => setAt("languageCode", e.target.value)}
                  placeholder="e.g. en-US"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Documents */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Documents</p>
                  <p className="text-xs text-[#6b7280] mt-1">Upload reference documents for the AI Tutor to draw from.</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {atState.documents.length > 0 && (
                    <div className="space-y-1.5">
                      {atState.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                          <span className="flex-1 text-sm text-[#374151] truncate">{doc.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="p-1 rounded text-[#9ca3af] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-colors shrink-0"
                            title="Remove document"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleAddDocument}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-[#d1d5db] text-sm text-[#6b7280] hover:border-[#2d6fa8] hover:text-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors w-full justify-center"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add document
                  </button>
                </div>
              </div>
            </>
          )}
        </LeAccordion>

        {/* -- Laerdal Course Feedback accordion -- */}
        <LeAccordion
          open={cfOpen}
          onToggle={() => setCfOpen((o) => !o)}
          title="Laerdal Course Feedback"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          }
        >
          {/* Enable toggle */}
          <DemoVideoPlaceholder label="See how Laerdal Course Feedback works" />
          <div className={`pt-3${cfState.enabled ? " pb-4 border-b border-[#e5e7eb]" : ""}`}>
            <LrToggle
              checked={cfState.enabled}
              onChange={(v) => setCf("enabled", v)}
              label="Enable Laerdal Course Feedback"
            />
          </div>

          {cfState.enabled && (
            <>
              {/* Options - multi-select */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Options</p>
                </div>
                <div className="px-4 py-2">
                  <LrCheckList<CourseFeedbackOption>
                    options={COURSE_FEEDBACK_OPTIONS}
                    selected={cfState.options}
                    onChange={(v) => setCf("options", v)}
                  />
                </div>
              </div>

              {/* Trigger button */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Trigger Button</p>
                </div>
                <div className="px-4 py-4 space-y-3">
                  <LrField label="Button text">
                    <input
                      type="text"
                      value={cfState.buttonText}
                      onChange={(e) => setCf("buttonText", e.target.value)}
                      placeholder="e.g. Give Feedback"
                      className={LR_INPUT}
                    />
                  </LrField>
                  <LrField label="Aria label">
                    <input
                      type="text"
                      value={cfState.buttonAriaLabel}
                      onChange={(e) => setCf("buttonAriaLabel", e.target.value)}
                      placeholder="e.g. Open course feedback"
                      className={LR_INPUT}
                    />
                  </LrField>
                </div>
              </div>

              {/* Feedback widget */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Feedback Widget</p>
                </div>
                <div className="px-4 py-4 space-y-4">
                  <div className="rounded-lg border border-[#e5e7eb] overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-[#fafafa] border-b border-[#f3f4f6]">
                      <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">Rating Step</p>
                    </div>
                    <div className="px-3.5 py-3 space-y-3">
                      <LrField label="Title">
                        <input
                          type="text"
                          value={cfState.ratingTitle}
                          onChange={(e) => setCf("ratingTitle", e.target.value)}
                          placeholder="e.g. How was your learning experience?"
                          className={LR_INPUT}
                        />
                      </LrField>
                      <LrField label="Aria label">
                        <input
                          type="text"
                          value={cfState.ratingAriaLabel}
                          onChange={(e) => setCf("ratingAriaLabel", e.target.value)}
                          placeholder="e.g. Rate your experience"
                          className={LR_INPUT}
                        />
                      </LrField>
                      <div className="grid grid-cols-2 gap-3">
                        <LrField label="Lowest rating label">
                          <input
                            type="text"
                            value={cfState.lowestRatingLabel}
                            onChange={(e) => setCf("lowestRatingLabel", e.target.value)}
                            placeholder="e.g. Poor"
                            className={LR_INPUT}
                          />
                        </LrField>
                        <LrField label="Highest rating label">
                          <input
                            type="text"
                            value={cfState.highestRatingLabel}
                            onChange={(e) => setCf("highestRatingLabel", e.target.value)}
                            placeholder="e.g. Excellent"
                            className={LR_INPUT}
                          />
                        </LrField>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e5e7eb] overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-[#fafafa] border-b border-[#f3f4f6]">
                      <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">Common Step</p>
                    </div>
                    <div className="px-3.5 py-3 space-y-3">
                      <LrField label="Title">
                        <input
                          type="text"
                          value={cfState.commonTitle}
                          onChange={(e) => setCf("commonTitle", e.target.value)}
                          placeholder="e.g. Tell us more"
                          className={LR_INPUT}
                        />
                      </LrField>
                      <LrField label="Placeholder">
                        <input
                          type="text"
                          value={cfState.commonPlaceholder}
                          onChange={(e) => setCf("commonPlaceholder", e.target.value)}
                          placeholder="e.g. Share your feedback..."
                          className={LR_INPUT}
                        />
                      </LrField>
                      <LrField label="Aria label">
                        <input
                          type="text"
                          value={cfState.commonAriaLabel}
                          onChange={(e) => setCf("commonAriaLabel", e.target.value)}
                          placeholder="e.g. Feedback comment"
                          className={LR_INPUT}
                        />
                      </LrField>
                      <LrField label="Maximum character length">
                        <input
                          type="number"
                          min={0}
                          value={cfState.maximumCharacterLength}
                          onChange={(e) => setCf("maximumCharacterLength", Number(e.target.value))}
                          className={LR_INPUT}
                        />
                      </LrField>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e5e7eb] overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-[#fafafa] border-b border-[#f3f4f6]">
                      <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">Buttons</p>
                    </div>
                    <div className="px-3.5 py-3 space-y-3">
                      <LrField label="Next button text">
                        <input
                          type="text"
                          value={cfState.nextButtonText}
                          onChange={(e) => setCf("nextButtonText", e.target.value)}
                          placeholder="e.g. Next"
                          className={LR_INPUT}
                        />
                      </LrField>
                      <LrField label="Close button text">
                        <input
                          type="text"
                          value={cfState.closeButtonText}
                          onChange={(e) => setCf("closeButtonText", e.target.value)}
                          placeholder="e.g. Close"
                          className={LR_INPUT}
                        />
                      </LrField>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thankyou message */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Thankyou Message</p>
                </div>
                <div className="px-4 py-4">
                  <LrField label="Body">
                    <textarea
                      value={cfState.thankYouBody}
                      onChange={(e) => setCf("thankYouBody", e.target.value)}
                      placeholder="e.g. Thank you for your feedback!"
                      rows={3}
                      className={LR_TEXTAREA}
                    />
                  </LrField>
                </div>
              </div>
            </>
          )}
        </LeAccordion>

      </div>

      {showAddDialog && (
        <AddResourceDialog
          onAdd={handleAddResource}
          onCancel={() => setShowAddDialog(false)}
        />
      )}

      <div className="h-8" />

      {!lnLoading && !lsLoading && !cfLoading && !atLoading && hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-[var(--life-warning-100)] shadow-lg animate-fade-in-down">
          <span className="flex items-center gap-2 text-sm text-[#374151]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-warning-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLnCancel}
              disabled={lnSaving}
              className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLnSave}
              disabled={lnSaving || !courseId}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--life-base-white)] bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:opacity-50 rounded-lg transition-colors"
            >
              {lnSaving && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {lnSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {lnToast && (
        <div className="fixed top-4 right-4 z-[60] pointer-events-none">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border pointer-events-auto animate-fade-in-down min-w-[260px] max-w-sm ${
              lnToast.type === "success"
                ? "bg-[var(--life-positive-050)] border-[var(--life-positive-100)] text-[var(--life-positive-500)]"
                : "bg-[var(--life-critical-050)] border-[var(--life-critical-100)] text-[var(--life-critical-500)]"
            }`}
          >
            {lnToast.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-positive-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-critical-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span className="flex-1">{lnToast.message}</span>
            <button
              type="button"
              onClick={() => setLnToast(null)}
              className="opacity-60 hover:opacity-100 transition-opacity ml-1"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {assetPickerOpen && (
        <AssetPickerModal
          onSelect={(asset) => {
            const name = asset.assetLink.split("/").pop() ?? asset.assetLink;
            setAtState((prev) => ({
              ...prev,
              documents: [...prev.documents, { id: asset.id, name, document: asset.assetLink }],
            }));
            setAssetPickerOpen(false);
          }}
          onClose={() => setAssetPickerOpen(false)}
        />
      )}

      <UnsavedChangesModal
        isOpen={showConfirmModal}
        isSaving={lnSaving}
        onDiscard={handleConfirmDiscard}
        onSave={handleConfirmSave}
        onClose={clearPendingNavigation}
      />
    </div>
  );
}
