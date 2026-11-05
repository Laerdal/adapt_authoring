// Plain-text detail of what an action will write, so an author can read the actual
// content (text, question, answer options) before approving, not just its title.

import type { SamaritanAction } from "@/api/samaritan";

export function htmlToText(html: unknown): string {
  return String(html ?? "")
    .replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface McqItem {
  text?: string;
  _shouldBeSelected?: boolean;
  feedback?: string;
}

/** The full content an action would write, or "" for actions that only create structure. */
export function actionDetail(a: SamaritanAction): string {
  const p = a.parameters as Record<string, any>;
  if (a.actionType === "REWRITE_CONTENT") return htmlToText(p.content);
  if (a.actionType !== "ADD_COMPONENT") return "";

  const parts: string[] = [];
  const body = htmlToText(p.body);
  if (body) parts.push(body);
  const items: McqItem[] = Array.isArray(p.properties?._items) ? p.properties._items : [];
  if (items.length) {
    if (p.displayTitle && !body.includes(String(p.displayTitle))) parts.push(String(p.displayTitle));
    items.forEach((item) => {
      const feedback = item.feedback ? ` (${item.feedback})` : "";
      parts.push(`${item._shouldBeSelected ? "[correct] " : "[ ] "}${item.text ?? ""}${feedback}`);
    });
  }
  return parts.join("\n");
}
