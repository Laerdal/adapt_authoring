// "Build with AI" wizard - the interaction pattern (Describe -> Objectives ->
// Course Setup, pill stepper, editable objective rows, settings cards) follows
// the reference design (Adapt Studio DAMS 4.0's BuildWithAIWizard), but every
// generation step here is real: DAMS's own wizard is a client-side mock
// (setTimeout + canned templates, no backend call at all) - this one calls
// the real Samaritan endpoints and, unlike DAMS, keeps an explicit approval
// step before anything is written (see the Review step below) - Samaritan
// never writes without a human approving the exact plan first.
import { useRef, useState } from "react";
import { createCourse, createTopic } from "@/api/adaptAuthoring";
import { proposeRequest, approvePlan, type SamaritanAction, type ApprovePlanResponse } from "@/api/samaritan";

interface Props {
  onClose: () => void;
  onComplete: (courseId: string) => void;
  defaultTheme: string;
  defaultMenu: string;
}

const STEPS = ["Describe", "Objectives", "Course Setup", "Review"] as const;

type AudienceLevel = "beginner" | "intermediate" | "advanced";
type CourseType = "knowledge" | "skills" | "compliance" | "assessment" | "awareness";
type AssessmentLevel = "none" | "knowledge_check" | "formal";
type InteractivityLevel = "minimal" | "moderate" | "high";

function RadioPills<T extends string>({
  options,
  value,
  onChange,
  cols = 3
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-medium transition-colors ${
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

function describeChange(plan: SamaritanAction): string {
  if (plan.actionType === "ADD_COMPONENT") return `Add a ${(plan.parameters as any)._component} component`;
  if (plan.actionType === "CREATE_PAGE") return `Add page "${(plan.parameters as any).title}"`;
  if (plan.actionType === "CREATE_ARTICLE") return `Add article "${(plan.parameters as any).title}"`;
  return plan.actionType;
}

export default function BuildWithAiWizard({ onClose, onComplete, defaultTheme, defaultMenu }: Props) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [objectives, setObjectives] = useState<string[]>([]);

  const [audienceLevel, setAudienceLevel] = useState<AudienceLevel>("beginner");
  const [courseType, setCourseType] = useState<CourseType>("knowledge");
  const [assessmentLevel, setAssessmentLevel] = useState<AssessmentLevel>("none");
  const [interactivityLevel, setInteractivityLevel] = useState<InteractivityLevel>("moderate");

  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null);
  const [reviewActions, setReviewActions] = useState<SamaritanAction[] | null>(null);
  const [reviewRisk, setReviewRisk] = useState<string>("");
  const [result, setResult] = useState<ApprovePlanResponse | null>(null);

  const courseIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function ensureCourse(): Promise<string> {
    if (courseIdRef.current) return courseIdRef.current;
    const created = await createCourse(
      { title: title.trim() || "Untitled Course", description, theme: defaultTheme, menuStyle: defaultMenu },
      { skipDefaultSeed: true }
    );
    await createTopic(created.id, created.id, title.trim() || "Untitled Course", 1);
    courseIdRef.current = created.id;
    return created.id;
  }

  async function generateObjectives() {
    if (!description.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const courseId = await ensureCourse();
      const response = await proposeRequest({
        courseId,
        message: `Draft learning objectives for a course about: ${description}`
      });
      if (response.status === "OBJECTIVES_DRAFTED") {
        setObjectives(response.objectives);
        setStep(1);
      } else if (response.status === "DECLINED") {
        setError(response.declined.reason);
      } else {
        setError("Samaritan didn't return a usable list of objectives - try rephrasing the description.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach Samaritan");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateObjectives() {
    if (!description.trim() || busy || !courseIdRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const response = await proposeRequest({
        courseId: courseIdRef.current,
        message: `Draft learning objectives for a course about: ${description}`
      });
      if (response.status === "OBJECTIVES_DRAFTED") setObjectives(response.objectives);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach Samaritan");
    } finally {
      setBusy(false);
    }
  }

  function buildGenerationMessage(): string {
    const assessmentLabel = assessmentLevel === "formal" ? "Formal Assessment" : "Knowledge Check";
    const lines = [
      `Create a course outline about: ${description}`,
      title.trim() ? `Course title: ${title.trim()}` : "",
      objectives.length
        ? `Learning objectives (already approved by the user - use these exactly, do not invent new ones):\n${objectives.map((o) => `- ${o}`).join("\n")}`
        : "",
      `Course settings: Audience=${audienceLevel}, Course type=${courseType}.`,
      interactivityLevel !== "minimal"
        ? `Interactivity=${interactivityLevel}: include one multiple-choice knowledge-check question (3-4 options, exactly one marked correct, brief per-option feedback) for each article.`
        : "Interactivity=minimal: do not include any multiple-choice questions.",
      assessmentLevel !== "none"
        ? `Assessment=${assessmentLabel}: also include a final "${assessmentLabel}" page with multiple-choice questions covering the objectives.`
        : "Assessment=none: do not include a final assessment page."
    ];
    return lines.filter(Boolean).join("\n\n");
  }

  async function generatePlan() {
    if (busy || !courseIdRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const response = await proposeRequest({ courseId: courseIdRef.current, message: buildGenerationMessage() });
      if (response.status === "PLAN_PROPOSED") {
        setReviewRequestId(response.requestId);
        setReviewActions(response.plan.actions);
        setReviewRisk(response.risk);
        setStep(3);
      } else if (response.status === "DECLINED") {
        setError(response.declined.reason);
      } else {
        setError("Samaritan didn't return a generated plan - try adjusting the description or settings.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach Samaritan");
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
      setResult(response);
      if (approved && response.status === "completed" && courseIdRef.current) {
        onComplete(courseIdRef.current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#111827]">Build with AI</span>
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
          {error && <div className="mb-4 px-4 py-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-sm text-[#991b1b]">{error}</div>}

          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#111827] mb-1">Describe your course</h2>
                <p className="text-sm text-[#6b7280]">Tell Samaritan what the course should cover - it will draft objectives and a structure for you to review.</p>
              </div>
              <textarea
                ref={textareaRef}
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={9}
                placeholder='e.g. Create a beginner course on airway management for first-year nursing students. Cover assessment, basic manoeuvres and when to escalate.'
                className="w-full px-4 py-3 text-sm border-[1.5px] border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent resize-none"
              />
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Course title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Airway Management for Nursing Students"
                  className="w-full px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"
                />
                <p className="text-xs text-[#9ca3af] mt-1">Leave blank and Samaritan will suggest a title.</p>
              </div>
              <div className="flex items-center justify-between mt-2">
                <button type="button" onClick={onClose} className="text-sm text-[#6b7280] hover:text-[#111827]">
                  &larr; Cancel
                </button>
                <button
                  type="button"
                  onClick={generateObjectives}
                  disabled={!description.trim() || busy}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {busy ? "Generating..." : "Generate objectives"}
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
                  onClick={regenerateObjectives}
                  disabled={busy}
                  className="px-3 py-2 text-xs font-semibold text-[#2d6fa8] border border-[#c4b5f4] rounded-full hover:bg-[#f5f0ff] disabled:opacity-40"
                >
                  {busy ? "Regenerating..." : "✨ Regenerate"}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <button type="button" onClick={() => setStep(0)} className="text-sm text-[#6b7280] hover:text-[#111827]">
                  &larr; Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
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
                <p className="text-sm text-[#6b7280]">A few more choices so Samaritan can shape the content.</p>
              </div>

              <SettingCard label="Who is this course for?">
                <RadioPills
                  value={audienceLevel}
                  onChange={setAudienceLevel}
                  options={[
                    { value: "beginner", label: "Beginner" },
                    { value: "intermediate", label: "Intermediate" },
                    { value: "advanced", label: "Advanced" }
                  ]}
                />
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

              <SettingCard label="Level of interactivity" hint="Moderate/High adds a knowledge-check question to each article.">
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
                    <p className="text-sm font-semibold text-[#111827] mb-2">{reviewActions.length} actions &middot; Risk: {reviewRisk}</p>
                    <ul className="text-xs text-[#374151] max-h-64 overflow-y-auto flex flex-col gap-1">
                      {reviewActions.map((a) => (
                        <li key={a.actionId}>&bull; {describeChange(a)}</li>
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
                  Plan {result.status} - the course was created but not everything finished. Open it from the dashboard to review what was written.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
