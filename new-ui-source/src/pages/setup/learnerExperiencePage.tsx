import React, { useState } from "react";

/* -------------------------------------------------------------
   LEARNER EXPERIENCE PANEL - Learning Resources accordion
   ------------------------------------------------------------- */

type ResourceFormat = "document" | "media" | "link" | "custom";

interface LearningResource {
  id: string;
  format: ResourceFormat;
  forceDownload: boolean;
  title: string;
  fileName: string;
  description: string;
  sourceType: "asset" | "url";
  assetValue: string;
  urlValue: string;
  displayOnEveryPage: boolean;
}

interface LearningResourcesState {
  enabled: boolean;
  sectionTitle: string;
  description: string;
  resources: LearningResource[];
}

const RESOURCE_FORMAT_OPTIONS: { value: ResourceFormat; label: string }[] = [
  { value: "document", label: "Document" },
  { value: "media",    label: "Media" },
  { value: "link",     label: "Link" },
  { value: "custom",   label: "Custom" },
];

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
  const set = <K extends keyof LearningResource>(k: K, v: LearningResource[K]) =>
    setRes((prev) => ({ ...prev, [k]: v }));

  return (
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
  );
}

/* Resource format icon badge with colored background (matches Figma design) */
const FORMAT_STYLES: Record<ResourceFormat, { bg: string; color: string }> = {
  document: { bg: "#fee2e2", color: "#dc2626" },
  media:    { bg: "#ede9f6", color: "#7c5cbf" },
  link:     { bg: "#dbeeff", color: "#2d6fa8" },
  custom:   { bg: "#d1fae5", color: "#059669" },
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
type CourseFeedbackOption = "autoOpen" | "hideAfterSubmit";

interface CourseFeedbackState {
  enabled: boolean;
  options: CourseFeedbackOption[];
  buttonText: string;
  widgetTitle: string;
  highestRatingLabel: string;
  lowestRatingLabel: string;
  commentTitle: string;
  commentPlaceholder: string;
  thankYouMessage: string;
}

const COURSE_FEEDBACK_OPTIONS: { value: CourseFeedbackOption; label: string }[] = [
  { value: "autoOpen",        label: "Auto-open on course complete" },
  { value: "hideAfterSubmit", label: "Hide button after submission" },
];

/* -- Ask AI Tutor types -- */
type AiTutorCapability = "allPages" | "answerFromContent" | "useLearnerNotes" | "stepByStep";
type AiTutorKnowledge  = "concise" | "detailed";
type AiTutorControl    = "drawer" | "floating";

interface AiTutorDocument {
  id: string;
  name: string;
}

interface AiTutorState {
  enabled: boolean;
  title: string;
  availability: string;
  capabilities: AiTutorCapability[];
  knowledge: AiTutorKnowledge;
  documents: AiTutorDocument[];
  control: AiTutorControl;
  promptPlaceholder: string;
}

const AI_TUTOR_CAPABILITIES: { value: AiTutorCapability; label: string }[] = [
  { value: "allPages",          label: "Available on all pages" },
  { value: "answerFromContent", label: "Answer question from course content" },
  { value: "useLearnerNotes",   label: "Use learner notes" },
  { value: "stepByStep",        label: "Provide step-by-step guidance" },
];

const AI_TUTOR_KNOWLEDGE_OPTIONS: { value: AiTutorKnowledge; label: string }[] = [
  { value: "concise",  label: "Concise" },
  { value: "detailed", label: "Detailed" },
];

const AI_TUTOR_CONTROL_OPTIONS: { value: AiTutorControl; label: string }[] = [
  { value: "drawer",   label: "Drawer" },
  { value: "floating", label: "Floating button" },
];

/* -- Learner Notes types -- */
type NotesAvailability = "all" | "selected";
type NotesFeature = "create" | "upload" | "download" | "search";

interface LearnerNotesState {
  enabled: boolean;
  sectionTitle: string;
  helperText: string;
  availability: NotesAvailability;
  features: NotesFeature[];
  editorPlaceholder: string;
}

const NOTES_AVAILABILITY_OPTIONS: { value: NotesAvailability; label: string }[] = [
  { value: "all",      label: "Available on all pages" },
  { value: "selected", label: "Only on selected pages" },
];

const NOTES_FEATURES: { value: NotesFeature; label: string }[] = [
  { value: "create",   label: "Allow note creation" },
  { value: "upload",   label: "Allow file upload" },
  { value: "download", label: "Allow download / export" },
  { value: "search",   label: "Enable search" },
];

/* -- Learner Search types -- */
type SearchMatchRule =
  | "begins"
  | "contains"
  | "equals"
  | "startsWith";

type SearchFeature = "highlight" | "showKeywords";
type SearchResultPreview = "short" | "medium" | "long";

interface LearnerSearchState {
  enabled: boolean;
  sectionTitle: string;
  helperText: string;
  matchRules: SearchMatchRule[];
  features: SearchFeature[];
  resultPreview: SearchResultPreview;
  searchPlaceholder: string;
  noResultMessage: string;
  loadingMessage: string;
}

const SEARCH_MATCH_RULES: { value: SearchMatchRule; label: string }[] = [
  { value: "begins",     label: "A word in the content begins the search phrase word" },
  { value: "contains",   label: "A word in the content contains the search phrase word" },
  { value: "equals",     label: "A word in the content equals the search phrase word" },
  { value: "startsWith", label: "A word in the content starts with the search phrase word" },
];

const SEARCH_FEATURES: { value: SearchFeature; label: string }[] = [
  { value: "highlight",    label: "Highlight search terms in result" },
  { value: "showKeywords", label: "Show matching keywords" },
];

const SEARCH_RESULT_PREVIEW_OPTIONS: { value: SearchResultPreview; label: string }[] = [
  { value: "short",  label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long",   label: "Long" },
];

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

export function LearnerExperiencePanel() {
  /* -- Learning Resources state -- */
  const [lrState, setLrState] = useState<LearningResourcesState>({
    enabled: false,
    sectionTitle: "",
    description: "",
    resources: [],
  });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [lrOpen, setLrOpen] = useState(false);

  const setLr = <K extends keyof LearningResourcesState>(k: K, v: LearningResourcesState[K]) =>
    setLrState((prev) => ({ ...prev, [k]: v }));

  function handleAddResource(r: LearningResource) {
    setLrState((prev) => ({ ...prev, resources: [...prev.resources, r] }));
    setShowAddDialog(false);
  }

  function handleRemoveResource(id: string) {
    setLrState((prev) => ({ ...prev, resources: prev.resources.filter((r) => r.id !== id) }));
  }

  /* -- Learner Search state -- */
  const [lsOpen, setLsOpen] = useState(false);
  const [lsState, setLsState] = useState<LearnerSearchState>({
    enabled: false,
    sectionTitle: "Search",
    helperText: "",
    matchRules: [],
    features: [],
    resultPreview: "medium",
    searchPlaceholder: "",
    noResultMessage: "",
    loadingMessage: "",
  });

  const setLs = <K extends keyof LearnerSearchState>(k: K, v: LearnerSearchState[K]) =>
    setLsState((prev) => ({ ...prev, [k]: v }));

  /* -- Learner Notes state -- */
  const [lnOpen, setLnOpen] = useState(false);
  const [lnState, setLnState] = useState<LearnerNotesState>({
    enabled: false,
    sectionTitle: "",
    helperText: "",
    availability: "all",
    features: [],
    editorPlaceholder: "",
  });

  const setLn = <K extends keyof LearnerNotesState>(k: K, v: LearnerNotesState[K]) =>
    setLnState((prev) => ({ ...prev, [k]: v }));

  /* -- Ask AI Tutor state -- */
  const [atOpen, setAtOpen] = useState(false);
  const [atState, setAtState] = useState<AiTutorState>({
    enabled: false,
    title: "",
    availability: "",
    capabilities: [],
    knowledge: "concise",
    documents: [],
    control: "drawer",
    promptPlaceholder: "",
  });

  const setAt = <K extends keyof AiTutorState>(k: K, v: AiTutorState[K]) =>
    setAtState((prev) => ({ ...prev, [k]: v }));

  /* -- Course Feedback state -- */
  const [cfOpen, setCfOpen] = useState(false);
  const [cfState, setCfState] = useState<CourseFeedbackState>({
    enabled: false,
    options: [],
    buttonText: "",
    widgetTitle: "",
    highestRatingLabel: "",
    lowestRatingLabel: "",
    commentTitle: "",
    commentPlaceholder: "",
    thankYouMessage: "",
  });

  const setCf = <K extends keyof CourseFeedbackState>(k: K, v: CourseFeedbackState[K]) =>
    setCfState((prev) => ({ ...prev, [k]: v }));

  function handleAddDocument() {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        setAtState((prev) => ({
          ...prev,
          documents: [...prev.documents, { id: Math.random().toString(36).slice(2), name: file.name }],
        }));
      }
    };
    input.click();
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
          <div className={`pt-3${lrState.enabled ? " pb-4 border-b border-[#e5e7eb]" : ""}`}>
            <LrToggle
              checked={lrState.enabled}
              onChange={(v) => setLr("enabled", v)}
              label="Enable Learning Resources"
            />
          </div>

          {lrState.enabled && (
            <>
              {/* Section Title */}
              <LrField label="Section Title">
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

              {/* Resources list */}
              {lrState.resources.length > 0 && (
                <div className="space-y-2">
                  {lrState.resources.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
                      <ResourceFormatIcon format={r.format} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">{r.title || <span className="text-[#9ca3af] font-normal">Untitled resource</span>}</p>
                        <p className="text-xs text-[#6b7280] capitalize">{r.format}{r.displayOnEveryPage ? " · Every page" : ""}</p>
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
          {/* Enable toggle */}
          <DemoVideoPlaceholder label="See how Learner Search works" />
          <div className={`pt-3${lsState.enabled ? " pb-4 border-b border-[#e5e7eb]" : ""}`}>
            <LrToggle
              checked={lsState.enabled}
              onChange={(v) => setLs("enabled", v)}
              label="Enable Search"
            />
          </div>

          {lsState.enabled && (
            <>
              {/* Section Title */}
              <LrField label="Section Title">
                <input
                  type="text"
                  value={lsState.sectionTitle}
                  onChange={(e) => setLs("sectionTitle", e.target.value)}
                  placeholder="Search"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Helper Text */}
              <LrField label="Helper Text">
                <textarea
                  value={lsState.helperText}
                  onChange={(e) => setLs("helperText", e.target.value)}
                  placeholder="Add helper text shown to learners above the search input"
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Search Scope -- Match On Rules */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Search Scope</p>
                  <p className="text-xs font-semibold text-[#111827] mt-2 mb-0.5">Match On Rules</p>
                  <p className="text-xs text-[#6b7280]">Select which word-matching strategies are active.</p>
                </div>
                <div className="px-4 py-2">
                  <LrCheckList<SearchMatchRule>
                    options={SEARCH_MATCH_RULES}
                    selected={lsState.matchRules}
                    onChange={(v) => setLs("matchRules", v)}
                  />
                </div>
              </div>

              {/* Features */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Features</p>
                  <p className="text-xs text-[#6b7280] mt-1">Enable optional search result display features.</p>
                </div>
                <div className="px-4 py-2">
                  <LrCheckList<SearchFeature>
                    options={SEARCH_FEATURES}
                    selected={lsState.features}
                    onChange={(v) => setLs("features", v)}
                  />
                </div>
              </div>

              {/* Result Preview */}
              <LrField label="Result Preview">
                <LrRadioList<SearchResultPreview>
                  options={SEARCH_RESULT_PREVIEW_OPTIONS}
                  selected={lsState.resultPreview}
                  onChange={(v) => setLs("resultPreview", v)}
                />
              </LrField>

              {/* Search Placeholder */}
              <LrField label="Search Placeholder">
                <input
                  type="text"
                  value={lsState.searchPlaceholder}
                  onChange={(e) => setLs("searchPlaceholder", e.target.value)}
                  placeholder="e.g. Type to search..."
                  className={LR_INPUT}
                />
              </LrField>

              {/* No Result Message */}
              <LrField label="No Result Message">
                <input
                  type="text"
                  value={lsState.noResultMessage}
                  onChange={(e) => setLs("noResultMessage", e.target.value)}
                  placeholder="e.g. No results found for your search."
                  className={LR_INPUT}
                />
              </LrField>

              {/* Loading Message */}
              <LrField label="Loading Message">
                <input
                  type="text"
                  value={lsState.loadingMessage}
                  onChange={(e) => setLs("loadingMessage", e.target.value)}
                  placeholder="e.g. Searching..."
                  className={LR_INPUT}
                />
              </LrField>
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
          {/* Enable toggle */}
          <DemoVideoPlaceholder label="See how Learner Notes works" />
          <div className={`pt-3${lnState.enabled ? " pb-4 border-b border-[#e5e7eb]" : ""}`}>
            <LrToggle
              checked={lnState.enabled}
              onChange={(v) => setLn("enabled", v)}
              label="Enable Notes"
            />
          </div>

          {lnState.enabled && (
            <>
              {/* Section Title */}
              <LrField label="Section Title">
                <input
                  type="text"
                  value={lnState.sectionTitle}
                  onChange={(e) => setLn("sectionTitle", e.target.value)}
                  placeholder="e.g. My Notes"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Helper Text */}
              <LrField label="Helper Text">
                <textarea
                  value={lnState.helperText}
                  onChange={(e) => setLn("helperText", e.target.value)}
                  placeholder="Add helper text shown to learners above the notes editor"
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Notes Availability */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Notes Availability</p>
                  <p className="text-xs text-[#6b7280] mt-1">Choose which pages the notes panel is available on.</p>
                </div>
                <div className="px-4 py-3 space-y-1">
                  {NOTES_AVAILABILITY_OPTIONS.map(({ value, label }) => {
                    const active = lnState.availability === value;
                    return (
                      <label
                        key={value}
                        className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[#f9fafb] cursor-pointer group"
                      >
                        <div
                          onClick={() => setLn("availability", value)}
                          className={`w-4 h-4 rounded-full shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${
                            active
                              ? "border-[#2d6fa8] bg-[#2d6fa8]"
                              : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
                          }`}
                        >
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                        </div>
                        <span className="text-sm text-[#374151]">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Features */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Features</p>
                  <p className="text-xs text-[#6b7280] mt-1">Enable optional note-taking capabilities.</p>
                </div>
                <div className="px-4 py-2">
                  <LrCheckList<NotesFeature>
                    options={NOTES_FEATURES}
                    selected={lnState.features}
                    onChange={(v) => setLn("features", v)}
                  />
                </div>
              </div>

              {/* Editor Placeholder Text */}
              <LrField label="Editor Placeholder Text">
                <input
                  type="text"
                  value={lnState.editorPlaceholder}
                  onChange={(e) => setLn("editorPlaceholder", e.target.value)}
                  placeholder="e.g. Start typing your notes here..."
                  className={LR_INPUT}
                />
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

              {/* Availability */}
              <LrField label="Availability">
                <textarea
                  value={atState.availability}
                  onChange={(e) => setAt("availability", e.target.value)}
                  placeholder="Describe when and where the AI Tutor is available to learners"
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Capabilities */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Capabilities</p>
                  <p className="text-xs text-[#6b7280] mt-1">Select what the AI Tutor is allowed to do.</p>
                </div>
                <div className="px-4 py-2">
                  <LrCheckList<AiTutorCapability>
                    options={AI_TUTOR_CAPABILITIES}
                    selected={atState.capabilities}
                    onChange={(v) => setAt("capabilities", v)}
                  />
                </div>
              </div>

              {/* Knowledge Sources */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Knowledge Sources</p>
                  <p className="text-xs text-[#6b7280] mt-1">Choose the response style for the AI Tutor.</p>
                </div>
                <div className="px-4 py-3">
                  <LrRadioList<AiTutorKnowledge>
                    options={AI_TUTOR_KNOWLEDGE_OPTIONS}
                    selected={atState.knowledge}
                    onChange={(v) => setAt("knowledge", v)}
                  />
                </div>
              </div>

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

              {/* Controls */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Controls</p>
                  <p className="text-xs text-[#6b7280] mt-1">Choose how learners open the AI Tutor.</p>
                </div>
                <div className="px-4 py-3">
                  <LrRadioList<AiTutorControl>
                    options={AI_TUTOR_CONTROL_OPTIONS}
                    selected={atState.control}
                    onChange={(v) => setAt("control", v)}
                  />
                </div>
              </div>

              {/* Prompt Placeholder */}
              <LrField label="Prompt Placeholder">
                <textarea
                  value={atState.promptPlaceholder}
                  onChange={(e) => setAt("promptPlaceholder", e.target.value)}
                  placeholder="e.g. Ask me anything about this course..."
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>
            </>
          )}
        </LeAccordion>

        {/* -- Course Feedback accordion -- */}
        <LeAccordion
          open={cfOpen}
          onToggle={() => setCfOpen((o) => !o)}
          title="Course Feedback"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          }
        >
          {/* Enable toggle */}
          <DemoVideoPlaceholder label="See how Course Feedback works" />
          <div className={`pt-3${cfState.enabled ? " pb-4 border-b border-[#e5e7eb]" : ""}`}>
            <LrToggle
              checked={cfState.enabled}
              onChange={(v) => setCf("enabled", v)}
              label="Enable Course Feedback"
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

              {/* Button text */}
              <LrField label="Text displayed on the feedback button">
                <input
                  type="text"
                  value={cfState.buttonText}
                  onChange={(e) => setCf("buttonText", e.target.value)}
                  placeholder="e.g. Give Feedback"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Widget title */}
              <LrField label="Title for the feedback widget">
                <input
                  type="text"
                  value={cfState.widgetTitle}
                  onChange={(e) => setCf("widgetTitle", e.target.value)}
                  placeholder="e.g. How did we do?"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Rating labels */}
              <div className="grid grid-cols-2 gap-3">
                <LrField label="Highest rating label">
                  <input
                    type="text"
                    value={cfState.highestRatingLabel}
                    onChange={(e) => setCf("highestRatingLabel", e.target.value)}
                    placeholder="e.g. Excellent"
                    className={LR_INPUT}
                  />
                </LrField>
                <LrField label="Lowest rating label">
                  <input
                    type="text"
                    value={cfState.lowestRatingLabel}
                    onChange={(e) => setCf("lowestRatingLabel", e.target.value)}
                    placeholder="e.g. Poor"
                    className={LR_INPUT}
                  />
                </LrField>
              </div>

              {/* Comment title */}
              <LrField label="Comment title">
                <textarea
                  value={cfState.commentTitle}
                  onChange={(e) => setCf("commentTitle", e.target.value)}
                  placeholder="e.g. Tell us more about your experience"
                  rows={2}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Comment placeholder */}
              <LrField label="Placeholder text for the comment section">
                <textarea
                  value={cfState.commentPlaceholder}
                  onChange={(e) => setCf("commentPlaceholder", e.target.value)}
                  placeholder="e.g. Share your thoughts..."
                  rows={2}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Thank you message */}
              <LrField label="Message shown on the Thank you screen">
                <textarea
                  value={cfState.thankYouMessage}
                  onChange={(e) => setCf("thankYouMessage", e.target.value)}
                  placeholder="e.g. Thank you for your feedback! We really appreciate it."
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>
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
    </div>
  );
}
