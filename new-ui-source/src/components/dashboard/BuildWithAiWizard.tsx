// "Build with AI" wizard - the interaction pattern (Describe -> Objectives ->
// Course Setup, pill stepper, editable objective rows, settings cards) follows
// the reference design (Adapt Studio DAMS 4.0's BuildWithAIWizard), but every
// generation step here is real: DAMS's own wizard is a client-side mock
// (setTimeout + canned templates, no backend call at all) - this one calls
// the real Samaritan endpoints and, unlike DAMS, keeps an explicit approval
// step before anything is written (see the Review step below) - Samaritan
// never writes without a human approving the exact plan first.
import { useRef, useState } from "react";
import { createCourse, createTopic, updateCourse } from "@/api/adaptAuthoring";
import { apiClient } from "@/api/client";
import {
  ACCEPTED_SOURCE_TYPES,
  MAX_SOURCE_FILES,
  SOURCE_LIMITS_HINT,
  composeSourceText,
  readSourceFile,
  sourceKey,
  validateSourceFile,
  type SourceFile
} from "./sourceMaterial";
import {
  setupLines,
  type AssessmentLevel,
  type AudienceLevel,
  type ContentSource,
  type CourseLength,
  type CourseType,
  type InteractivityLevel,
  type LearningExperience
} from "./courseSetup";
import { useDialogFocus } from "../common/useDialogFocus";
import { actionDetail } from "../samaritan/actionDetail";
import { describeAction, riskHeadline, riskMeaning, summarizePlan } from "../samaritan/reviewText";
import { friendlyError } from "../samaritan/friendlyError";
import { proposeRequest, approvePlan, type SamaritanAction, type ApprovePlanResponse, type SourceUse } from "@/api/samaritan";

interface Props {
  onClose: () => void;
  onComplete: (courseId: string) => void;
  defaultTheme: string;
  defaultMenu: string;
}

const STEPS = ["Describe", "Objectives", "Course Setup", "Review"] as const;

function RadioPills<T extends string>({
  options,
  value,
  onChange,
  cols = 3,
  disabledValues = []
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  cols?: number;
  disabledValues?: T[];
}) {
  return (
    <div role="group" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          disabled={disabledValues.includes(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            value === opt.value ? "border-[#2d6fa8] bg-[#eaf3fa] text-[#2d6fa8]" : "border-[#d1d5db] text-[#374151] hover:bg-[#f9fafb]"
          }`}
        >
          <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${value === opt.value ? "border-[#2d6fa8]" : "border-[#9ca3af]"}`}>
            {value === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-[#2d6fa8]" />}
          </span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SettingCard({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#e5e7eb] rounded-xl p-4">
      <p className="text-sm font-semibold text-[#111827] mb-2.5">{label}</p>
      {children}
      {hint && <p className="text-xs text-[#9ca3af] mt-2">{hint}</p>}
    </div>
  );
}

// The full text, question and answer options an action will write, so the author
// reviews real content and not just titles before approving.
function ActionReviewItem({ action }: { action: SamaritanAction }) {
  const detail = actionDetail(action);
  if (!detail) return <li>&bull; {describeAction(action)}</li>;
  return (
    <li>
      <details>
        <summary className="cursor-pointer">&bull; {describeAction(action)}</summary>
        <pre className="mt-1 mb-2 ml-4 whitespace-pre-wrap font-sans text-[11px] text-[#4b5563] bg-[#f9fafb] border border-[#e5e7eb] rounded p-2 max-h-40 overflow-y-auto">{detail}</pre>
      </details>
    </li>
  );
}

export default function BuildWithAiWizard({ onClose, onComplete, defaultTheme, defaultMenu }: Props) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  // The latest title as typed. A suggestion that arrives after the author typed their
  // own title must not replace it, and state captured before the request is stale.
  const titleRef = useRef("");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceSeq = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const topicIdRef = useRef<string | null>(null);
  // The title the saved course and root topic currently carry.
  const savedTitleRef = useRef<string>("");

  const [audienceLevel, setAudienceLevel] = useState<AudienceLevel>("beginner");
  const [customAudience, setCustomAudience] = useState("");
  const audienceTouched = useRef(false);
  const contentSourceTouched = useRef(false);
  const [courseType, setCourseType] = useState<CourseType>("knowledge");
  const [learningExperience, setLearningExperience] = useState<LearningExperience>("self_paced");
  const [courseLength, setCourseLength] = useState<CourseLength>("15_30");
  const [contentSource, setContentSource] = useState<ContentSource>("sources_only");
  const [assessmentLevel, setAssessmentLevel] = useState<AssessmentLevel>("none");
  const [interactivityLevel, setInteractivityLevel] = useState<InteractivityLevel>("moderate");

  // Files that were not attached (wrong type, too big, duplicate), shown above the list.
  const [notices, setNotices] = useState<string[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  // Whether Samaritan could use the attached source for the objectives it drafted.
  const [sourceWarning, setSourceWarning] = useState<{ use: SourceUse; note: string } | null>(null);
  // The objectives as last generated, to tell whether the author has edited them since.
  const generatedObjectives = useRef<string>("[]");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null);
  const [reviewActions, setReviewActions] = useState<SamaritanAction[] | null>(null);
  const [reviewRisk, setReviewRisk] = useState<string>("");
  const [reviewRiskReasons, setReviewRiskReasons] = useState<string[]>([]);
  const [reviewAssumptions, setReviewAssumptions] = useState<string[]>([]);
  const [result, setResult] = useState<ApprovePlanResponse | null>(null);

  const courseIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function ensureCourse(): Promise<string> {
    const courseTitle = title.trim() || "Untitled Course";
    if (!courseIdRef.current) {
      const created = await createCourse(
        { title: courseTitle, description, theme: defaultTheme, menuStyle: defaultMenu },
        { skipDefaultSeed: true }
      );
      // Remembered immediately: if the topic below fails, a retry must reuse this
      // course instead of creating a second one and orphaning the first.
      courseIdRef.current = created.id;
      savedTitleRef.current = courseTitle;
    }
    if (!topicIdRef.current) {
      topicIdRef.current = await createTopic(courseIdRef.current, courseIdRef.current, savedTitleRef.current, 1);
    }
    return courseIdRef.current;
  }

  // Source files are read server-side (the storyboard's own Word/PDF/PowerPoint
  // import) and only their text is kept, to ground the generation prompts.
  async function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    if (!incoming.length) return;

    // Checked before anything is uploaded, so a wrong type, an oversized file, a duplicate
    // or one file too many is explained at once instead of after a wait.
    const problems: string[] = [];
    const files: File[] = [];
    const seen = new Set(sources.map((s) => s.key).filter(Boolean));
    for (const f of incoming) {
      const key = sourceKey(f);
      const invalid = validateSourceFile(f);
      if (invalid) problems.push(invalid);
      else if (seen.has(key)) problems.push(`"${f.name}" is already attached.`);
      else if (sources.length + files.length >= MAX_SOURCE_FILES) {
        problems.push(`"${f.name}" was not added: only one file can be attached. ${sources.length ? "Remove the current file to attach a different one." : "The first file was kept."}`);
      } else {
        files.push(f);
        seen.add(key);
      }
    }
    setNotices(problems);
    if (!files.length) return;

    const entries = files.map((f) => ({ id: `src-${++sourceSeq.current}`, key: sourceKey(f), name: f.name, status: "reading" as const, text: "" }));
    setSources((prev) => [...prev, ...entries]);
    const results = await Promise.all(files.map((f) => readSourceFile(f)));
    // Each response goes to ITS entry. Matching by file name would hand a late
    // response to a different attachment that reuses the name (remove, re-add).
    // An entry the author removed meanwhile no longer exists, so its response is dropped.
    const byId = new Map(entries.map((entry, i) => [entry.id, { ...results[i], id: entry.id }]));
    setSources((prev) => prev.map((x) => (x.id && byId.has(x.id) && x.status === "reading" ? byId.get(x.id)! : x)));
  }

  function sourceBlock(): string {
    const { text, truncated } = composeSourceText(sources);
    if (!text) return "";
    const readyCount = sources.filter((s) => s.status === "ready").length;
    const coverage = readyCount > 1 ? ` There are ${readyCount} files: draw on every one of them, not only the first.` : "";
    return `Source material (supporting material for the description; do not invent facts beyond it${truncated ? "; it was shortened to fit" : ""}.${coverage}):\n${text}`;
  }

  const sourcesReading = sources.some((s) => s.status === "reading");
  const hasReadySources = sources.some((s) => s.status === "ready");

  // The same request for the first draft and for Regenerate.
  function objectivesMessage(): string {
    return [
      `Draft learning objectives for a course about: ${description}`,
      sourceBlock(),
      hasReadySources ? "Set sourceUse to say honestly whether the source material was usable for this description." : ""
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  // The warning shown when the attached source could not be used as the author expects.
  function noteSourceUse(response: { sourceUse?: SourceUse; sourceNote?: string }) {
    setSourceWarning(hasReadySources && response.sourceUse && response.sourceUse !== "used" ? { use: response.sourceUse, note: response.sourceNote ?? "" } : null);
  }

  // Renames the already-created course and its root topic. Used for Samaritan's
  // suggestion when the title was left blank, and again before the outline is
  // generated if the author edited the title after the course was created.
  async function syncTitle(courseId: string, next: string) {
    const value = next.trim();
    if (!value || value === savedTitleRef.current) return;
    try {
      await updateCourse(courseId, { title: value, displayTitle: value });
      if (topicIdRef.current) await apiClient.put(`/api/content/contentobject/${topicIdRef.current}`, { title: value, displayTitle: value });
      savedTitleRef.current = value;
    } catch {
      /* cosmetic - the title can still be edited later in Course Settings */
    }
  }

  // A blank title is filled from Samaritan's suggestion and shown to the author.
  async function applySuggestedTitle(courseId: string, suggested?: string) {
    const next = suggested?.trim();
    if (!next || titleRef.current.trim()) return;
    titleRef.current = next;
    setTitle(next);
    await syncTitle(courseId, next);
  }

  async function generateObjectives() {
    if (!description.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const courseId = await ensureCourse();
      const response = await proposeRequest({ courseId, message: objectivesMessage() });
      if (response.status === "OBJECTIVES_DRAFTED") {
        setObjectives(response.objectives);
        generatedObjectives.current = JSON.stringify(response.objectives);
        noteSourceUse(response);
        await applySuggestedTitle(courseId, response.title);
        setStep(1);
      } else if (response.status === "DECLINED") {
        setError(response.declined.reason);
      } else {
        setError("Samaritan didn't return a usable list of objectives - try rephrasing the description.");
      }
    } catch (err) {
      setError(friendlyError(err, "Couldn't reach Samaritan. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  }

  // Regenerate replaces every objective, including any the author edited or added, and
  // nothing is saved until the plan is approved, so edits could not be recovered.
  const objectivesEdited = () => JSON.stringify(objectives) !== generatedObjectives.current;

  function onRegenerateClick() {
    if (objectivesEdited()) setConfirmRegenerate(true);
    else void regenerateObjectives();
  }

  async function regenerateObjectives() {
    setConfirmRegenerate(false);
    if (!description.trim() || busy || !courseIdRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const response = await proposeRequest({ courseId: courseIdRef.current, message: objectivesMessage() });
      if (response.status === "OBJECTIVES_DRAFTED") {
        setObjectives(response.objectives);
        generatedObjectives.current = JSON.stringify(response.objectives);
        noteSourceUse(response);
      } else {
        setError("Samaritan didn't return new objectives, so your current list is unchanged. Try again.");
      }
    } catch (err) {
      setError(friendlyError(err, "Couldn't reach Samaritan. Your current objectives are unchanged."));
    } finally {
      setBusy(false);
    }
  }

  // Moving on to Course Setup: a level the description states outright is preselected,
  // unless the author has already chosen one themselves.
  function goToSetup() {
    // Without a source file there is nothing for "uploaded sources only" to draw on, so
    // the default follows whether one is attached, until the author chooses.
    if (!contentSourceTouched.current) setContentSource(hasReadySources ? "sources_only" : "sources_plus_research");
    setStep(2);
  }

  function buildGenerationMessage(): string {
    const lines = [
      `Create a course outline about: ${description}`,
      title.trim() ? `Course title: ${title.trim()}` : "",
      sourceBlock(),
      objectives.length
        ? `Learning objectives (already approved by the user - use these exactly, do not invent new ones):\n${objectives.map((o) => `- ${o}`).join("\n")}`
        : "",
      ...setupLines({ audienceLevel, customAudience, courseType, learningExperience, courseLength, contentSource, assessmentLevel, interactivityLevel }, hasReadySources)
    ];
    return lines.filter(Boolean).join("\n\n");
  }

  async function generatePlan() {
    if (busy || !courseIdRef.current) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await syncTitle(courseIdRef.current, title);
      const response = await proposeRequest({ courseId: courseIdRef.current, message: buildGenerationMessage() });
      if (response.status === "PLAN_PROPOSED") {
        setReviewRequestId(response.requestId);
        setReviewActions(response.plan.actions);
        setReviewRisk(response.risk);
        setReviewRiskReasons(response.riskReasons ?? []);
        setReviewAssumptions(response.intent?.assumptions ?? []);
        setStep(3);
      } else if (response.status === "DECLINED") {
        setError(response.declined.reason);
      } else {
        setError("Samaritan didn't return a generated plan - try adjusting the description or settings.");
      }
    } catch (err) {
      setError(friendlyError(err, "Couldn't reach Samaritan. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  }

  async function decidePlan(approved: boolean) {
    if (!reviewRequestId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await approvePlan(reviewRequestId, approved);
      if (!approved) {
        // Cancelled: nothing was written, so go back to the settings rather than
        // showing a failure. The empty course made earlier is still on the dashboard.
        setReviewActions(null);
        setReviewRequestId(null);
        setStep(2);
        setInfo("Cancelled. Nothing was added to the course. You can change the settings and generate again.");
        return;
      }
      setResult(response);
      if (response.status === "completed" && courseIdRef.current) {
        onComplete(courseIdRef.current);
      }
    } catch (err) {
      setError(friendlyError(err, "The plan couldn't be applied. Check the course before trying again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="build-ai-title" tabIndex={-1} className="fixed inset-0 z-50 bg-white flex flex-col focus:outline-none">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] shrink-0">
        <div className="flex items-center gap-3">
          <span id="build-ai-title" className="text-sm font-semibold text-[#111827]">Build with AI</span>
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${
                    i === step ? "border-[#111827] text-[#111827]" : "border-[#e5e7eb] text-[#9ca3af]"
                  }`}
                >
                  {i + 1} &middot; {label}
                </span>
                {i < STEPS.length - 1 && <span className="w-6 h-px bg-[#e5e7eb]" />}
              </div>
            ))}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex justify-center">
        <div className="w-full max-w-2xl px-6 py-8">
          {error && <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-sm text-[#991b1b]">{error}</div>}
          {info && <div role="status" className="mb-4 px-4 py-3 rounded-lg bg-[#eff6ff] border border-[#bfdbfe] text-sm text-[#1e40af]">{info}</div>}

          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#111827] mb-2">Describe the course you want to build</h2>
                <p className="text-base text-[#4b5563]">
                  Tell us the topic, audience and anything the course must cover. Attach source material and AI will draft the learning objectives for you.
                </p>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  void addFiles(e.dataTransfer.files);
                }}
                className={`rounded-2xl border-[1.5px] bg-white transition-colors ${isDragging ? "border-[#2d6fa8] bg-[#eaf3fa]" : "border-[#d1d5db]"}`}
              >
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={9}
                  placeholder="e.g. Create a beginner course on airway management for first-year nursing students. Cover assessment, basic manoeuvres and when to escalate. Use the attached protocol document as the primary source."
                  className="w-full px-5 py-4 text-sm bg-transparent rounded-t-2xl focus:outline-none resize-none"
                />
                {notices.length > 0 && (
                  <div role="alert" className="mx-5 mb-3 flex items-start justify-between gap-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
                    <ul className="flex flex-col gap-0.5">
                      {notices.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                    <button type="button" aria-label="Dismiss" onClick={() => setNotices([])} className="text-[#92400e] hover:text-[#78350f]">
                      &times;
                    </button>
                  </div>
                )}
                {sources.length > 0 && (
                  <ul className="flex flex-wrap gap-2 px-5 pb-3">
                    {sources.map((f, i) => (
                      <li
                        key={f.id ?? `${f.name}-${i}`}
                        title={f.error ? `${f.name} - ${f.error}` : f.name}
                        className={`flex items-start gap-2 rounded-2xl border px-3 py-1 text-xs ${
                          f.status === "error" ? "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]" : "border-[#d1d5db] bg-[#f9fafb] text-[#374151]"
                        }`}
                      >
                        <span className="max-w-[220px] truncate" title={f.name}>{f.name}</span>
                        <span className={f.status === "error" ? "max-w-[340px] whitespace-normal" : "text-[#9ca3af]"}>{f.status === "reading" ? "Reading..." : f.status === "error" ? f.error : "Ready"}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${f.name}`}
                          onClick={() => setSources((prev) => prev.filter((x) => x !== f))}
                          className="text-[#6b7280] hover:text-[#111827]"
                        >
                          &times;
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {sourcesReading && (
                  <div className="px-5 pb-3" role="status">
                    <div className="h-1 w-full overflow-hidden rounded bg-[#e5e7eb]">
                      <div className="h-full w-1/3 animate-pulse rounded bg-[#2d6fa8]" />
                    </div>
                    <p className="mt-1 text-xs text-[#6b7280]">Reading your file... this can take a few minutes for large files.</p>
                  </div>
                )}
                <div className="flex items-center gap-3 border-t border-[#e5e7eb] px-4 py-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_SOURCE_TYPES}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) void addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:bg-[#f9fafb] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Attach source material
                  </button>
                  <span className="flex-1 text-sm text-[#6b7280]">
                    Drag &amp; drop files here
                    <span className="block text-xs text-[#9ca3af]">{SOURCE_LIMITS_HINT}</span>
                  </span>
                  <button
                    type="button"
                    onClick={generateObjectives}
                    disabled={!description.trim() || busy || sourcesReading}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:bg-[#e5e7eb] disabled:text-[#9ca3af] disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {busy ? "Generating..." : "Generate objectives"}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#111827] mb-1.5">
                  Course title <span className="font-normal text-[#6b7280]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  disabled={busy}
                  onChange={(e) => {
                    titleRef.current = e.target.value;
                    setTitle(e.target.value);
                  }}
                  placeholder="e.g. Airway Management for Nursing Students"
                  className="w-full px-4 py-3 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent disabled:opacity-60"
                />
                <p className="text-xs text-[#6b7280] mt-1.5">Leave blank and AI will suggest a title from your description.</p>
              </div>
              <div className="mt-2">
                <button type="button" onClick={onClose} className="rounded-lg border border-[#d1d5db] px-5 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#f9fafb] transition-colors">
                  &larr; Cancel
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#111827] mb-1">Learning objectives</h2>
                <p className="text-sm text-[#6b7280]">Drafted from your description. Edit, remove or add objectives before continuing.</p>
              </div>
              {sourceWarning && (
                <div role="alert" className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
                  <p className="font-semibold">
                    {sourceWarning.use === "partly"
                      ? "Your source file only partly matches the description."
                      : sourceWarning.use === "unusable"
                        ? "Your source file had no readable content, so it wasn't used."
                        : "Your source file doesn't match the description, so it wasn't used."}
                  </p>
                  {sourceWarning.note && <p className="mt-0.5">{sourceWarning.note}</p>}
                  <p className="mt-0.5">The objectives follow your description. To base them on the file, change the description to match it, or attach a different file, then go back and generate again.</p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {objectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-2 border border-[#e5e7eb] rounded-lg px-3 py-2">
                    <span className="text-xs text-[#9ca3af] w-5 text-right shrink-0">{i + 1}</span>
                    <input
                      value={obj}
                      onChange={(e) => setObjectives((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                      className="flex-1 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setObjectives((prev) => prev.filter((_, j) => j !== i))}
                      aria-label="Remove objective"
                      className="text-[#9ca3af] hover:text-[#dc2626] transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setObjectives((prev) => [...prev, ""])}
                  className="px-3 py-2 text-xs font-semibold text-[#374151] border border-dashed border-[#d1d5db] rounded-full hover:bg-[#f9fafb]"
                >
                  + Add objective
                </button>
                <button
                  type="button"
                  onClick={onRegenerateClick}
                  disabled={busy || confirmRegenerate}
                  className="px-3 py-2 text-xs font-semibold text-[#2d6fa8] border border-[#c4b5f4] rounded-full hover:bg-[#f5f0ff] disabled:opacity-40"
                >
                  {busy ? "Regenerating..." : "✨ Regenerate"}
                </button>
              </div>
              {confirmRegenerate && (
                <div role="alertdialog" aria-label="Replace your edits?" className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
                  <p className="font-semibold">Replace your edited objectives?</p>
                  <p className="mt-0.5">Regenerating writes a new list over the current one, including anything you edited, added or removed. Edits aren't saved anywhere, so they can't be brought back.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => void regenerateObjectives()} className="rounded-lg bg-[#2d6fa8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#245c8f]">
                      Replace with new objectives
                    </button>
                    <button type="button" onClick={() => setConfirmRegenerate(false)} className="rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#f9fafb]">
                      Keep my edits
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <button type="button" onClick={() => setStep(0)} className="text-sm text-[#6b7280] hover:text-[#111827]">
                  &larr; Back
                </button>
                <button
                  type="button"
                  onClick={goToSetup}
                  disabled={objectives.filter((o) => o.trim()).length === 0}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  Continue &rarr;
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#111827] mb-1">Course setup</h2>
                <p className="text-sm text-[#6b7280]">A few more choices so Samaritan can shape the storyboard.</p>
              </div>

              <SettingCard label="Course title" hint="Suggested from your learning objectives. Edit it if you'd like.">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    titleRef.current = e.target.value;
                    setTitle(e.target.value);
                  }}
                  aria-label="Course title"
                  className="w-full px-3 py-2 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"
                />
              </SettingCard>

              <SettingCard
                label="Content source strategy"
                hint={
                  hasReadySources
                    ? "Choose how much Samaritan should draw on beyond your inputs. Your description always comes first."
                    : "No source file is attached, so Samaritan will use its own knowledge of your topic. Attach a file on the first step to use \"Uploaded sources only\"."
                }
              >
                <RadioPills
                  cols={2}
                  value={contentSource}
                  disabledValues={hasReadySources ? [] : ["sources_only"]}
                  onChange={(v) => {
                    contentSourceTouched.current = true;
                    setContentSource(v);
                  }}
                  options={[
                    { value: "sources_only", label: "Uploaded sources only" },
                    { value: "sources_plus_research", label: "Uploaded sources + AI research" }
                  ]}
                />
              </SettingCard>

              <SettingCard
                label="Who is this course for?"
              >
                <RadioPills
                  value={audienceLevel}
                  onChange={(v) => {
                    audienceTouched.current = true;
                    setAudienceLevel(v);
                  }}
                  options={[
                    { value: "beginner", label: "Beginner" },
                    { value: "intermediate", label: "Intermediate" },
                    { value: "advanced", label: "Advanced" }
                  ]}
                />
                <label className="mt-3 block text-xs text-[#6b7280]">
                  Custom audience
                  <input
                    type="text"
                    value={customAudience}
                    onChange={(e) => setCustomAudience(e.target.value)}
                    placeholder="e.g. First-year nursing students"
                    className="mt-1 w-full px-3 py-2 text-sm text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"
                  />
                </label>
              </SettingCard>

              <SettingCard label="Course type">
                <RadioPills
                  cols={5}
                  value={courseType}
                  onChange={setCourseType}
                  options={[
                    { value: "knowledge", label: "Knowledge" },
                    { value: "skills", label: "Skills" },
                    { value: "compliance", label: "Compliance" },
                    { value: "assessment", label: "Assessment" },
                    { value: "awareness", label: "Awareness" }
                  ]}
                />
              </SettingCard>

              <SettingCard label="Learning experience">
                <RadioPills
                  value={learningExperience}
                  onChange={setLearningExperience}
                  options={[
                    { value: "self_paced", label: "Self-paced" },
                    { value: "instructor_led", label: "Instructor-led" },
                    { value: "blended", label: "Blended" }
                  ]}
                />
              </SettingCard>

              <SettingCard label="Expected course length" hint="A rough target for how much content to generate. You review the plan before anything is created.">
                <RadioPills
                  cols={4}
                  value={courseLength}
                  onChange={setCourseLength}
                  options={[
                    { value: "under_15", label: "<15 min" },
                    { value: "15_30", label: "15-30 min" },
                    { value: "30_60", label: "30-60 min" },
                    { value: "over_60", label: ">60 min" }
                  ]}
                />
              </SettingCard>

              <SettingCard label="Assessment required?" hint="Adds a final assessment page with multiple-choice questions.">
                <RadioPills
                  cols={3}
                  value={assessmentLevel}
                  onChange={setAssessmentLevel}
                  options={[
                    { value: "none", label: "No assessment" },
                    { value: "knowledge_check", label: "Knowledge check" },
                    { value: "formal", label: "Formal assessment" }
                  ]}
                />
              </SettingCard>

              <SettingCard label="Level of interactivity" hint="Moderate/High adds a knowledge-check question to each section. These choices shape the instructional design of the generated course.">
                <RadioPills
                  value={interactivityLevel}
                  onChange={setInteractivityLevel}
                  options={[
                    { value: "minimal", label: "Minimal" },
                    { value: "moderate", label: "Moderate" },
                    { value: "high", label: "High" }
                  ]}
                />
              </SettingCard>

              <div className="flex items-center justify-between mt-2">
                <button type="button" onClick={() => setStep(1)} className="text-sm text-[#6b7280] hover:text-[#111827]">
                  &larr; Back
                </button>
                <button
                  type="button"
                  onClick={generatePlan}
                  disabled={busy}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {busy ? "Generating storyboard..." : "✨ Generate storyboard"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#111827] mb-1">Review the generated storyboard</h2>
                <p className="text-sm text-[#6b7280]">Nothing has been created yet - approve to write this to the course, or go back and adjust the settings.</p>
              </div>

              {!result && reviewActions && (
                <>
                  <div className="border border-[#e5e7eb] rounded-xl p-4">
                    <p className="text-sm font-semibold text-[#111827]">{summarizePlan(reviewActions) || `${reviewActions.length} changes`}</p>
                    <div className="mt-2 mb-3 rounded-lg bg-[#f9fafb] border border-[#e5e7eb] px-3 py-2 text-xs text-[#374151]">
                      <p className="font-semibold">
                        {riskHeadline(reviewRisk)}
                        <span className="font-normal"> - {riskMeaning(reviewRisk)}</span>
                      </p>
                      {reviewRiskReasons.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 flex flex-col gap-0.5">
                          {reviewRiskReasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-1 text-[#6b7280]">Nothing is saved until you approve.</p>
                    </div>
                    {reviewAssumptions.length > 0 && (
                      <div className="mb-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
                        <p className="font-semibold">What Samaritan assumed</p>
                        <ul className="mt-0.5 list-disc pl-4 flex flex-col gap-0.5">
                          {reviewAssumptions.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <ul className="text-xs text-[#374151] max-h-64 overflow-y-auto flex flex-col gap-1">
                      {reviewActions.map((a) => (
                        <ActionReviewItem key={a.actionId} action={a} />
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={() => setStep(2)} className="text-sm text-[#6b7280] hover:text-[#111827]">
                      &larr; Back to settings
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decidePlan(false)}
                        disabled={busy}
                        className="px-4 py-2.5 text-sm font-semibold text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => decidePlan(true)}
                        disabled={busy}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-40 rounded-lg transition-colors"
                      >
                        {busy ? "Creating course..." : "Approve plan"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {result && result.status !== "completed" && (
                <div className="px-4 py-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-sm text-[#991b1b]">
                  {result.status === "rolled_back"
                    ? "The changes couldn't be completed, so they were undone. Your course is still on the dashboard, with nothing added to it. Close this window and try again."
                    : "Some of the changes were made but not all of them finished. Open the course from the dashboard to see what was added, then try again for the rest."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
