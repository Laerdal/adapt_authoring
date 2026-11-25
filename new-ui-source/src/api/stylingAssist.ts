// Styling-assist API client (Technical Settings -> Custom CSS). Talks to the
// standalone plugins/services/styling-assist server plugin. The resolve
// response is a discriminated union on `resolutionType`, shaped so it can later
// be folded into Samaritan's /api/samaritan/propose.

import { apiClient } from "./client";

/** Levels a reusable class can be attached to (its Classes field). */
export type StylingClassLevel = "block" | "article" | "component";
/**
 * Where the change applies: a class level, or "course" = every instance of one
 * component type / area in the whole course (direct selectors, no class).
 */
export type StylingAppliesTo = StylingClassLevel | "course";
export const STYLING_APPLIES_TO: StylingAppliesTo[] = ["block", "article", "component", "course"];

/** Curated whole-course targets (mirrors the server's COURSE_TARGETS keys). */
export const STYLING_COURSE_TARGETS: Array<{ key: string; label: string }> = [
  { key: "accordion", label: "Accordion" },
  { key: "narrative", label: "Narrative" },
  { key: "hotgrid", label: "Hotgrid" },
  { key: "mcq", label: "MCQ" },
  { key: "gmcq", label: "Graphical MCQ" },
  { key: "slider", label: "Slider" },
  { key: "text", label: "Text" },
  { key: "button", label: "Buttons" },
  { key: "navigation", label: "Navigation bar" },
  { key: "menu-item", label: "Menu items" },
  { key: "page", label: "Page" },
];
export type StylingOutcome = "insert" | "copy" | "cancel" | "undo";

export interface StylingNativeSetting {
  id: string;
  label: string;
  group?: string;
  /** SetupPage nav id to open (present => native_setting). */
  panel?: string;
  /** Guidance text (present => config_guidance). */
  guidance?: string;
  scope: "course" | "component";
  component?: string;
}

export interface StylingExistingClass {
  name: string;
  /** What the class does, from the course CSS. */
  effect?: string;
  /** Levels the class works at; absent when it works at any level. */
  levels?: StylingClassLevel[];
  /** Full compiled selectors for the class (e.g. ".block._bluelight"). */
  selectors?: string[];
  responsive?: boolean;
}

export interface StylingSource {
  title: string;
  path: string;
  snippet: string;
  url?: string;
}

export interface StylingEnvironment {
  studioVersion?: string;
  frameworkVersion?: string;
  themeName?: string;
  themeVersion?: string;
}

interface StylingResultBase {
  requestId: string;
  appliesTo: StylingAppliesTo;
  explanation?: string;
  requestedProperty?: string;
  targetComponent?: string;
  sources: StylingSource[];
  environment: StylingEnvironment;
}

export type StylingResolveResponse =
  | (StylingResultBase & { resolutionType: "native_setting"; status: "NATIVE_SETTING"; nativeSetting: StylingNativeSetting })
  | (StylingResultBase & { resolutionType: "config_guidance"; status: "CONFIG_GUIDANCE"; nativeSetting: StylingNativeSetting })
  | (StylingResultBase & { resolutionType: "existing_class"; status: "EXISTING_CLASS"; reusedClassName: string; existingClass: StylingExistingClass })
  | (StylingResultBase & {
      resolutionType: "ai_css";
      status: "AI_CSS";
      css: string;
      /** The reusable class this CSS defines (absent for a direct-selector fallback). */
      generatedClassName?: string;
      /** True when direct component selectors were used (course scope, or the narrow fallback). */
      usesDirectSelectors: boolean;
      /** "global" when the CSS applies to every instance of targetComponent in the course. */
      scopeKind?: "global";
      /** Always present for course-scope CSS (framework-update review warning). */
      compatibilityWarning?: string;
    })
  | (StylingResultBase & { resolutionType: "no_solution"; status: "NO_SOLUTION" });

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const LEVEL_LABELS: Record<StylingAppliesTo, string> = { block: "Block", article: "Article", component: "Component", course: "Whole course" };

export function levelLabel(level: StylingAppliesTo): string {
  return LEVEL_LABELS[level];
}

/** Display name of a whole-course target (falls back to the raw key). */
export function courseTargetLabel(key?: string): string {
  if (!key) return "component";
  return STYLING_COURSE_TARGETS.find((t) => t.key === key)?.label ?? key;
}

/** "Whole course" - the Apply to option; with a chosen component it names it: "Whole course (all Accordion)". */
export function courseScopeLabel(key?: string): string {
  return key ? `Whole course (all ${courseTargetLabel(key)})` : "Whole course";
}

/** Pre-request hint for whole-course changes (names the component only when one is chosen). */
export function courseChangeHint(key?: string): string {
  const what = key ? `every ${courseTargetLabel(key)}` : "every component Samaritan picks from your request";
  return `Whole-course changes affect ${what} in this course and use custom CSS that may need review after framework updates.`;
}

/** Bold alert shown with whole-course CSS. */
export function courseAlertText(key?: string): string {
  return `Whole-course change: this affects every ${key ? courseTargetLabel(key) : "matching component"} in the course.`;
}

/** Full selector to show for a reused class (first compiled selector, else ".name"). */
export function existingClassSelector(ex: { name: string; selectors?: string[] }): string {
  return ex.selectors && ex.selectors.length ? ex.selectors[0] : `.${ex.name}`;
}

/** Level-aware text for what "Insert" does with a class definition (the class styles only where it is added). */
export function insertClassSummary(level: StylingAppliesTo): string {
  const target = levelLabel(level === "course" ? "component" : level).toLowerCase();
  return `Insert adds the class definition to the editor below. The class only styles a ${target} once you add it to that ${target}.`;
}

/** What the "Scope of change" field shows. */
export function scopeOfChangeText(level: StylingAppliesTo, targetComponent?: string): string {
  if (level === "course") return `${courseScopeLabel(targetComponent)} - every instance in the course`;
  const target = levelLabel(level).toLowerCase();
  return `${levelLabel(level)} - only a ${target} you add the class to`;
}

/** What the "Target component" field shows. */
export function targetComponentText(level: StylingAppliesTo, targetComponent?: string): string {
  if (targetComponent) return courseTargetLabel(targetComponent);
  return level === "component" || level === "course" ? "Any component" : "Not component-specific";
}

const MSG_UNREACHABLE = "Samaritan could not be reached. Check your connection and try again.";
const MSG_BUSY = "Samaritan is busy right now. Please try again in a moment.";

/** Friendly text for an error from the styling-assist call; never exposes raw transport/upstream strings. */
export function friendlyStylingError(e: unknown): string {
  const status = (e as { status?: number } | null)?.status;
  const raw = e instanceof Error ? e.message : "";
  if (status === 400) return raw || "Please check your request and try again.";
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403 || status === 404) return "This course could not be found or you do not have access.";
  if (status === 501) return "Samaritan is not set up on this server.";
  if (typeof status === "number" && status >= 500) return MSG_BUSY;
  if (e instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed/i.test(raw)) return MSG_UNREACHABLE;
  if (/timeout|timed out|abort|azure|openai/i.test(raw)) return MSG_BUSY;
  return raw || "Styling help is unavailable right now.";
}

/** Course-scope CSS needs no class: it applies to every instance. */
export function courseInstruction(key?: string): string {
  return `Applies to every ${courseTargetLabel(key)} in this course.`;
}

/** The author-facing instruction. Studio never edits _classes itself. */
export function classInstruction(className: string, level: StylingAppliesTo): string {
  // A class is only ever added to a Block, Article or Component; reusing one for "course" means a component.
  return `Add class ${className} to the ${levelLabel(level === "course" ? "component" : level)} in its Classes field.`;
}

/** Cap on the editor CSS sent for reuse detection (the server caps at the same size). */
export const MAX_EXISTING_CSS = 200000;

export async function resolveStyling(params: {
  intent: string;
  courseId?: string;
  appliesTo: StylingAppliesTo;
  /** Component type: optional for the direct-selector fallback; for "course" it is the target (the server infers it if omitted). */
  component?: string;
  /** Current Custom CSS editor text (may be unsaved) so existing classes can be reused. */
  existingCss?: string;
}): Promise<StylingResolveResponse> {
  const res = await apiClient.post<Envelope<StylingResolveResponse>>("/api/styling-assist/resolve", {
    intent: params.intent,
    courseId: params.courseId,
    appliesTo: params.appliesTo,
    component: params.component,
    existingCss: params.existingCss ? params.existingCss.slice(0, MAX_EXISTING_CSS) : undefined,
  });
  if (!res.success || !res.data) {
    throw new Error(res.error || "Styling help is unavailable right now.");
  }
  return res.data;
}

/** Fire-and-forget telemetry; never throws into the UI. */
export async function reportStylingOutcome(requestId: string, outcome: StylingOutcome): Promise<boolean> {
  try {
    const res = await apiClient.post<Envelope<unknown>>(
      `/api/styling-assist/events/${encodeURIComponent(requestId)}/outcome`,
      { outcome }
    );
    return res.success === true;
  } catch {
    return false;
  }
}
