// Plain-language wording for what Samaritan proposes, shared by the Build with AI
// review step and the Ask Samaritan panel, so an author never reads raw action
// types ("CREATE_BLOCK") or a bare "Risk: HIGH".
//
// The authoring tool stores a Topic as a page, a Section as an article and a
// Content Group as a block. That data model stays as it is; authors only ever see
// the Studio names.

import type { SamaritanAction } from "@/api/samaritan";

const COMPONENT_NAMES: Record<string, string> = {
  text: "text",
  "laerdal-text": "text",
  mcq: "multiple-choice question",
  gmcq: "graphical multiple-choice question",
  narrative: "narrative",
  accordion: "accordion",
  graphic: "image",
  media: "media"
};

export function componentName(component: unknown): string {
  const key = String(component ?? "").trim();
  if (!key) return "component";
  return COMPONENT_NAMES[key] ?? key.replace(/^adapt-contrib-/, "").replace(/[-_]+/g, " ");
}

function quoted(title: unknown): string {
  const t = String(title ?? "").trim();
  return t ? `“${t}”` : "(untitled)";
}

/** One readable sentence for an action. */
export function describeAction(a: SamaritanAction): string {
  const p = a.parameters as Record<string, any>;
  switch (a.actionType) {
    case "CREATE_COURSE": return `Create the course ${quoted(p.title)}`;
    case "CREATE_PAGE": return `Add the topic ${quoted(p.title)}`;
    case "CREATE_ARTICLE": return `Add the section ${quoted(p.title)}`;
    case "CREATE_BLOCK": return `Add the content group ${quoted(p.title)}`;
    case "ADD_COMPONENT": return `Add a ${componentName(p._component)} component ${quoted(p.title)}`;
    case "REWRITE_CONTENT": return "Rewrite the text of an existing component";
    case "REMOVE_COMPONENT": return "Remove the selected component";
    case "REPLACE_COMPONENT": return `Replace the selected component with a ${componentName(p.targetComponentType)} component`;
    case "ENABLE_PLUGIN": return "Turn on an extension for this course";
    case "DISABLE_PLUGIN": return "Turn off an extension for this course";
    default: return a.reason?.trim() || "Change the course";
  }
}

/** The kind of item an action concerns, for result lists that carry no parameters. */
export function actionKindLabel(actionType: string): string {
  switch (actionType) {
    case "CREATE_COURSE": return "Course";
    case "CREATE_PAGE": return "Topic";
    case "CREATE_ARTICLE": return "Section";
    case "CREATE_BLOCK": return "Content group";
    case "ADD_COMPONENT": return "Component";
    case "REWRITE_CONTENT": return "Rewrite";
    case "REMOVE_COMPONENT": return "Removal";
    case "REPLACE_COMPONENT": return "Replacement";
    case "ENABLE_PLUGIN":
    case "DISABLE_PLUGIN": return "Extension";
    default: return "Change";
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "executed": return "done";
    case "failed": return "failed";
    case "rolled_back": return "undone";
    default: return status.replace(/_/g, " ");
  }
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "This will add 1 topic, 4 sections, ..." - what approving will do, in numbers. */
export function summarizePlan(actions: SamaritanAction[]): string {
  const count = (type: string) => actions.filter((a) => a.actionType === type).length;
  const adds: string[] = [];
  if (count("CREATE_COURSE")) adds.push("a new course");
  if (count("CREATE_PAGE")) adds.push(plural(count("CREATE_PAGE"), "topic"));
  if (count("CREATE_ARTICLE")) adds.push(plural(count("CREATE_ARTICLE"), "section"));
  if (count("CREATE_BLOCK")) adds.push(plural(count("CREATE_BLOCK"), "content group"));
  if (count("ADD_COMPONENT")) adds.push(plural(count("ADD_COMPONENT"), "component"));

  const parts: string[] = [];
  if (adds.length) parts.push(`add ${joinList(adds)}`);
  if (count("REWRITE_CONTENT")) parts.push(`rewrite ${plural(count("REWRITE_CONTENT"), "existing component")}`);
  const removed = count("REMOVE_COMPONENT") + count("REPLACE_COMPONENT");
  if (removed) parts.push(`remove or replace ${plural(removed, "existing component")}`);
  const ext = count("ENABLE_PLUGIN") + count("DISABLE_PLUGIN");
  if (ext) parts.push(`turn ${plural(ext, "extension")} on or off`);
  if (!parts.length) return "";
  return `Approving will ${joinList(parts)}.`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const RISK: Record<string, { headline: string; meaning: string }> = {
  LOW: { headline: "Low risk", meaning: "This only reads or summarises and changes nothing in the course." },
  MEDIUM: { headline: "Medium risk", meaning: "This adds or edits course content." },
  HIGH: { headline: "High risk", meaning: "This is a large or far-reaching change, so read it through before approving." },
  VERY_HIGH: { headline: "Very high risk", meaning: "This goes beyond routine course authoring, so check it carefully before approving." }
};

const riskKey = (risk: string) => String(risk || "").toUpperCase();

export function riskHeadline(risk: string): string {
  return RISK[riskKey(risk)]?.headline ?? `${risk} risk`;
}

/** What the rating means. The specific reasons for a plan come from the server (riskReasons). */
export function riskMeaning(risk: string): string {
  return RISK[riskKey(risk)]?.meaning ?? "";
}
