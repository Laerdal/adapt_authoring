import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAvailableComponents } from "../../api/adaptAuthoring";
import {
  STYLING_APPLIES_TO,
  STYLING_COURSE_TARGETS,
  courseAlertText,
  courseChangeHint,
  courseInstruction,
  courseScopeLabel,
  courseTargetLabel,
  existingClassSelector,
  friendlyStylingError,
  insertClassSummary,
  levelLabel,
  reportStylingOutcome,
  resolveStyling,
  scopeOfChangeText,
  targetComponentText,
  type StylingAppliesTo,
  type StylingEnvironment,
  type StylingResolveResponse,
} from "../../api/stylingAssist";
import { COMPATIBILITY_WARNING } from "../../utils/customCssBlocks";
import Button from "../common/Button";
import { useDialogFocus } from "../common/useDialogFocus";

const MAX_INTENT = 500;

export interface InsertCssRequest {
  requestId: string;
  css: string;
  /** "course" for class definitions and whole-course CSS; "component" for the direct-selector fallback. */
  scope: "course" | "component";
  component?: string;
  frameworkVersion?: string;
  /** The reusable class this CSS defines (absent for the direct-selector fallback). */
  className?: string;
  appliesTo: StylingAppliesTo;
  usesDirectSelectors: boolean;
}

interface StylingHelpPanelProps {
  courseId: string;
  /** Current Custom CSS editor text (may be unsaved); used to detect classes that can be reused. */
  currentCss: string;
  onClose: () => void;
  /** Appends the CSS to the editor STATE only - the parent must never save or auto-insert. */
  onInsertCss: (request: InsertCssRequest) => void;
  /** Deep link into a SetupPage panel (e.g. "theme"). */
  onOpenSetting: (panel: string) => void;
}

function Card({ title, tone, children }: { title: string; tone: "native" | "config" | "css" | "none"; children: React.ReactNode }) {
  const toneClass =
    tone === "css"
      ? "border-[#fed7aa] bg-[#fff7ed]"
      : tone === "none"
        ? "border-[var(--life-neutral-200)] bg-[var(--life-neutral-020)]"
        : "border-[var(--life-primary-500)] bg-[var(--life-primary-020)]";
  return (
    <section className={`rounded-lg border px-4 py-3 flex flex-col gap-2 ${toneClass}`} aria-label={title}>
      <h3 className="text-sm font-semibold text-[var(--life-neutral-850)]">{title}</h3>
      {children}
    </section>
  );
}

function Sources({ result }: { result: StylingResolveResponse }) {
  if (!result.sources.length) return null;
  return (
    <details className="text-xs text-[var(--life-neutral-600)]">
      <summary className="cursor-pointer">Based on the Help &amp; How-To course</summary>
      <ul className="mt-1 list-disc pl-4 flex flex-col gap-0.5">
        {result.sources.map((s, i) => (
          <li key={`${s.path}-${i}`}>
            <span className="font-medium">{s.title}</span>
            {s.snippet ? ` - ${s.snippet}` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** A labelled read-only field ("Target component", "Class name", ...). */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-sm text-[var(--life-neutral-850)]">
      <dt className="font-semibold">{label}:</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The "what to do next" line plus the class name with a copy button. */
function ClassInstruction({ className, appliesTo, onCopy, copied }: { className: string; appliesTo: StylingAppliesTo; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[var(--life-neutral-200)] bg-white px-3 py-2">
      <p className="text-sm text-[var(--life-neutral-850)] flex-1 min-w-[220px]">
        Add class <code className="font-mono font-semibold">{className}</code> to the {levelLabel(appliesTo === "course" ? "component" : appliesTo)} in its Classes field.
      </p>
      <Button variant="secondary" onClick={onCopy}>
        {copied ? "Copied" : "Copy class name"}
      </Button>
    </div>
  );
}

export function StylingHelpPanel({ courseId, currentCss, onClose, onInsertCss, onOpenSetting }: StylingHelpPanelProps) {
  const [intent, setIntent] = useState("");
  const [appliesTo, setAppliesTo] = useState<StylingAppliesTo>("block");
  const [component, setComponent] = useState("");
  const [components, setComponents] = useState<Array<{ component: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StylingResolveResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [classCopied, setClassCopied] = useState(false);
  const [inserted, setInserted] = useState(false);
  const settled = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // The control that opened the panel (read during the first render, before focus moves).
  const triggerRef = useRef<HTMLElement | null>(typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null);
  // Components the curated whole-course list already covers (incl. Laerdal aliases of core types).
  const curatedComponentKeys = new Set([...STYLING_COURSE_TARGETS.map((t) => t.key), "laerdal-narrative", "laerdal-slider", "laerdal-text"]);

  useEffect(() => {
    let cancelled = false;
    getAvailableComponents()
      .then((rows) => {
        if (!cancelled) setComponents(rows.map((r) => ({ component: r.component, displayName: r.displayName })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Closing (button, Escape, backdrop) with an unresolved CSS/reuse suggestion counts as a cancel.
  const close = () => {
    if (result && (result.resolutionType === "ai_css" || result.resolutionType === "existing_class") && !settled.current) {
      settled.current = true;
      void reportStylingOutcome(result.requestId, "cancel");
    }
    onClose();
  };

  // Initial focus inside the panel, Tab/Shift+Tab trap, focus returned to the trigger on close.
  // Escape is handled below (it needs the latest result to report a cancel), so it is not passed here.
  useDialogFocus(dialogRef);

  // Background inertness: everything else under <body> is inert while the modal is open.
  // Declared after useDialogFocus: on close its focus restore runs first, then (here) the
  // background becomes interactive again and the trigger is focused.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return undefined;
    const states = new Map<HTMLElement, boolean>();
    for (const child of Array.from(document.body.children)) {
      if (child === overlay || !(child instanceof HTMLElement)) continue;
      states.set(child, child.inert);
      child.inert = true;
    }
    return () => {
      for (const [element, wasInert] of states) element.inert = wasInert;
      const trigger = triggerRef.current;
      if (trigger?.isConnected) requestAnimationFrame(() => trigger.focus());
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const canAsk = intent.trim().length > 0 && !loading;

  const ask = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    setClassCopied(false);
    setInserted(false);
    settled.current = false;
    try {
      setResult(
        await resolveStyling({
          intent: intent.trim().slice(0, MAX_INTENT),
          courseId,
          appliesTo,
          component: (appliesTo === "component" || appliesTo === "course") && component ? component : undefined,
          existingCss: currentCss,
        })
      );
    } catch (e) {
      setError(friendlyStylingError(e));
    } finally {
      setLoading(false);
    }
  };

  const settle = (outcome: "insert" | "copy" | "cancel") => {
    if (!result || settled.current) return;
    settled.current = true;
    void reportStylingOutcome(result.requestId, outcome);
  };

  const env: StylingEnvironment = result?.environment ?? {};
  const isGlobal = result?.resolutionType === "ai_css" && (result.scopeKind === "global" || result.appliesTo === "course");

  const insert = () => {
    if (!result || result.resolutionType !== "ai_css" || inserted) return;
    onInsertCss({
      requestId: result.requestId,
      css: result.css,
      // Whole-course CSS is course-wide by definition; only the class-level fallback is marked "component".
      scope: result.usesDirectSelectors && result.appliesTo !== "course" ? "component" : "course",
      // Component-level and whole-course CSS record the chosen component in the marker.
      component: result.targetComponent ?? ((appliesTo === "component" || appliesTo === "course") && component ? component : undefined),
      frameworkVersion: env.frameworkVersion,
      className: result.generatedClassName,
      appliesTo: result.appliesTo,
      usesDirectSelectors: result.usesDirectSelectors,
    });
    settle("insert");
    // Stay open: the author still needs the "add this class" instruction.
    setInserted(true);
  };

  const copy = async () => {
    if (!result || result.resolutionType !== "ai_css") return;
    try {
      await navigator.clipboard.writeText(result.css);
      setCopied(true);
      settle("copy");
    } catch {
      setError("Could not copy to the clipboard. Select the CSS and copy it manually.");
    }
  };

  const copyClassName = async (name: string, countAsCopy: boolean) => {
    try {
      await navigator.clipboard.writeText(name);
      setClassCopied(true);
      if (countAsCopy) settle("copy");
    } catch {
      setError("Could not copy to the clipboard. Select the class name and copy it manually.");
    }
  };

  const cancelCss = () => {
    settle("cancel");
    onClose();
  };

  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(26,26,26,0.5)]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Ask Samaritan for Styling Help"
        className="w-[640px] max-w-[92vw] max-h-[88vh] overflow-y-auto rounded-lg bg-white shadow-xl p-5 flex flex-col gap-4 outline-none"
      >
        <div>
          <h2 className="text-lg font-bold text-[var(--life-neutral-850)]">Ask Samaritan for Styling Help</h2>
          <p className="text-sm text-[var(--life-neutral-600)] mt-0.5">
            Describe the look you want. Samaritan checks for a built-in setting, then for a class already in your Custom CSS, and only then creates one reusable class using Life theme variables.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="styling-intent" className="text-sm font-semibold text-[var(--life-neutral-850)]">
            What would you like to change?
          </label>
          <textarea
            id="styling-intent"
            className="life-field"
            style={{ borderRadius: 8, minHeight: 72 }}
            maxLength={MAX_INTENT}
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="e.g. Give images rounded corners and a soft shadow"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-[var(--life-neutral-850)] flex items-center gap-2">
              Apply to
              <select
                className="life-field"
                style={{ borderRadius: 8 }}
                aria-label="Apply to"
                value={appliesTo}
                onChange={(e) => {
                  setAppliesTo(e.target.value as StylingAppliesTo);
                  setComponent("");
                }}
              >
                {STYLING_APPLIES_TO.map((level) => (
                  <option key={level} value={level}>
                    {level === "course" ? courseScopeLabel(component || undefined) : levelLabel(level)}
                  </option>
                ))}
              </select>
            </label>
            {appliesTo === "course" && (
              <label className="text-sm text-[var(--life-neutral-850)] flex items-center gap-2">
                Component type
                <select
                  className="life-field"
                  style={{ borderRadius: 8 }}
                  aria-label="Component type for whole course"
                  value={component}
                  onChange={(e) => setComponent(e.target.value)}
                >
                  <option value="">Let Samaritan decide from my request</option>
                  {STYLING_COURSE_TARGETS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                  {components
                    .filter((c) => !curatedComponentKeys.has(c.component.toLowerCase()))
                    .map((c) => (
                      <option key={c.component} value={c.component}>
                        {c.displayName}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {appliesTo === "component" && (
              <label className="text-sm text-[var(--life-neutral-850)] flex items-center gap-2">
                Component type (optional)
                <select className="life-field" style={{ borderRadius: 8 }} value={component} onChange={(e) => setComponent(e.target.value)}>
                  <option value="">Any</option>
                  {components.map((c) => (
                    <option key={c.component} value={c.component}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="ml-auto text-xs text-[var(--life-neutral-600)]">
              {intent.length}/{MAX_INTENT}
            </span>
          </div>
          {appliesTo === "course" ? (
            <p className="text-xs text-[#9a3412]">
              {courseChangeHint(component || undefined)}
            </p>
          ) : (
            <p className="text-xs text-[var(--life-neutral-600)]">
              Samaritan never edits Classes for you. You add the class to the {levelLabel(appliesTo)} yourself.
            </p>
          )}
          <div>
            <Button onClick={ask} disabled={!canAsk} isLoading={loading}>
              Ask Samaritan
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-[var(--life-critical-600)]">
            {error}
          </p>
        )}

        {result?.resolutionType === "native_setting" && (
          <Card title="Use a built-in setting" tone="native">
            <p className="text-sm text-[var(--life-neutral-850)]">{result.explanation}</p>
            <p className="text-xs text-[var(--life-neutral-600)]">
              {result.nativeSetting.group ? `${result.nativeSetting.group} > ` : ""}
              {result.nativeSetting.label}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (result.nativeSetting.panel) onOpenSetting(result.nativeSetting.panel);
                }}
              >
                Open Setting
              </Button>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
            </div>
            <Sources result={result} />
          </Card>
        )}

        {result?.resolutionType === "config_guidance" && (
          <Card title="Configuration guidance" tone="config">
            <p className="text-sm text-[var(--life-neutral-850)]">{result.explanation || result.nativeSetting.guidance}</p>
            <p className="text-xs text-[var(--life-neutral-600)]">
              {result.nativeSetting.group ? `${result.nativeSetting.group} > ` : ""}
              {result.nativeSetting.label}
            </p>
            <div>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
            </div>
            <Sources result={result} />
          </Card>
        )}

        {result?.resolutionType === "existing_class" && (
          <Card title="Reuse an existing class" tone="native">
            <p className="text-sm text-[var(--life-neutral-850)]">{result.explanation}</p>
            {result.existingClass.effect && (
              <pre className="text-xs bg-white border border-[var(--life-neutral-200)] rounded-[8px] p-3 overflow-x-auto whitespace-pre-wrap">
                {`${existingClassSelector(result.existingClass)} { ${result.existingClass.effect} }`}
              </pre>
            )}
            <ClassInstruction
              className={result.reusedClassName}
              appliesTo={result.appliesTo}
              copied={classCopied}
              onCopy={() => void copyClassName(result.reusedClassName, true)}
            />
            <p className="text-xs text-[var(--life-neutral-600)]">No new CSS is needed - this class is already defined in your Custom CSS.</p>
            <div>
              <Button variant="secondary" onClick={close}>
                Close
              </Button>
            </div>
            <Sources result={result} />
          </Card>
        )}

        {result?.resolutionType === "ai_css" && (
          <Card
            title={isGlobal ? `Whole-course CSS (all ${courseTargetLabel(result.targetComponent)})` : result.generatedClassName ? "New reusable class" : "Suggested custom CSS"}
            tone="css"
          >
            <p className="text-sm text-[var(--life-neutral-850)]">{result.explanation}</p>
            <dl className="flex flex-col gap-0.5">
              <Field label="Target component">{targetComponentText(result.appliesTo, result.targetComponent)}</Field>
              <Field label="Scope of change">{scopeOfChangeText(result.appliesTo, result.targetComponent)}</Field>
              {result.generatedClassName && (
                <Field label="Class name">
                  <code className="font-mono font-semibold">{result.generatedClassName}</code>
                </Field>
              )}
            </dl>
            {result.generatedClassName && (
              <ClassInstruction
                className={result.generatedClassName}
                appliesTo={result.appliesTo}
                copied={classCopied}
                onCopy={() => void copyClassName(result.generatedClassName as string, false)}
              />
            )}
            {isGlobal && (
              <>
                <p className="text-sm text-[var(--life-neutral-850)] font-semibold">{courseInstruction(result.targetComponent)}</p>
                <div role="alert" className="rounded-[8px] border-2 border-[#ea580c] bg-[#ffedd5] px-3 py-2 flex flex-col gap-1">
                  <p className="text-sm font-bold text-[#9a3412]">
                    {courseAlertText(result.targetComponent)}
                  </p>
                  <p className="text-sm text-[#9a3412]">
                    It targets framework class names directly, so it is more fragile than a class. {result.compatibilityWarning ?? COMPATIBILITY_WARNING}
                  </p>
                </div>
              </>
            )}
            {!isGlobal && result.usesDirectSelectors && (
              <p role="note" className="text-sm text-[#9a3412] font-semibold">
                Fallback: a class could not express this change, so the CSS targets the {result.targetComponent ?? "component"} component directly. It affects every one of them in the course and no class is needed.
              </p>
            )}
            <p id="styling-suggested-css-label" className="text-sm font-semibold text-[var(--life-neutral-850)]">
              Suggested CSS
            </p>
            <pre aria-labelledby="styling-suggested-css-label" className="text-xs bg-white border border-[var(--life-neutral-200)] rounded-[8px] p-3 overflow-x-auto whitespace-pre-wrap">{result.css}</pre>
            {!isGlobal && <p className="text-sm text-[#9a3412]">{COMPATIBILITY_WARNING}</p>}
            {inserted ? (
              <>
                <p role="status" className="text-sm text-[var(--life-neutral-850)] font-semibold">
                  Inserted into the Custom CSS editor below. Save your changes to keep it.
                  {result.generatedClassName && (
                    <>
                      {" "}
                      Then add <code className="font-mono">{result.generatedClassName}</code> to the {levelLabel(result.appliesTo === "course" ? "component" : result.appliesTo)}.
                    </>
                  )}
                </p>
                <div>
                  <Button variant="secondary" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={insert}>Insert CSS</Button>
                  <Button variant="secondary" onClick={copy}>
                    {copied ? "Copied" : "Copy CSS"}
                  </Button>
                  <Button variant="ghost" onClick={cancelCss}>
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-[var(--life-neutral-600)]">
                  {result.generatedClassName
                    ? `${insertClassSummary(result.appliesTo)} Nothing is saved until you save your changes.`
                    : isGlobal
                      ? `Insert adds this whole-course CSS (${courseScopeLabel(result.targetComponent)}) to the editor below. No class is needed. Nothing is saved until you save your changes.`
                      : "Insert adds the CSS to the editor below. Nothing is saved until you save your changes."}
                </p>
              </>
            )}
            <Sources result={result} />
          </Card>
        )}

        {result?.resolutionType === "no_solution" && (
          <Card title="No suggestion available" tone="none">
            <p className="text-sm text-[var(--life-neutral-850)]">{result.explanation}</p>
            <div>
              <Button variant="secondary" onClick={close}>
                Close
              </Button>
            </div>
            <Sources result={result} />
          </Card>
        )}

        {!result && (
          <div>
            <Button variant="ghost" onClick={close}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default StylingHelpPanel;
