// Marker blocks that let the Custom CSS editor track AI-inserted CSS so each
// block can be listed and removed individually:
//
//   /* samaritan-css:start id=.. component=.. scope=.. fw=.. [class=..] [applies=<block|article|component|course>] */
//   ...css...
//   /* samaritan-css:end id=.. */
//
// Pure string helpers - nothing here touches the editor or saves anything.

export interface CssBlockMeta {
  id: string;
  /** Component type, or "-" for course-wide CSS. */
  component: string;
  scope: "course" | "component";
  /** Framework version the block was written against ("unknown" when not known). */
  fw: string;
  /** Generated reusable utility class this block defines (class-based blocks only). */
  className?: string;
  /** Level the change applies to (absent on legacy markers). */
  appliesTo?: StylingLevel;
}

/** Class levels, or "course" for CSS that applies to every instance of `component` in the course. */
export type StylingLevel = "block" | "article" | "component" | "course";

export interface CssBlockInsertMeta {
  id: string;
  component?: string;
  scope: "course" | "component";
  fw?: string;
  className?: string;
  appliesTo?: StylingLevel;
}

export interface CssBlock extends CssBlockMeta {
  css: string;
  /** Offsets of the whole block (markers included) inside the source text. */
  start: number;
  end: number;
  /** Offset just after the start marker comment. */
  markerEnd: number;
  /** True when the end marker is missing (hand-deleted); extent is a best guess. */
  broken?: boolean;
}

export const COMPATIBILITY_WARNING =
  "Custom CSS may require review after future framework updates if underlying component structures or class names change.";

// Optional trailing fields: ` class=<c> applies=<level>` (class blocks) or ` applies=course` (whole-course blocks,
// with component=<type>). Legacy markers without them still parse.
const BLOCK_RE =
  /\/\* samaritan-css:start id=(\S+) component=(\S+) scope=(\S+) fw=(\S+)(?: class=(\S+))?(?: applies=(\S+))? \*\/\r?\n?([\s\S]*?)\r?\n?\/\* samaritan-css:end id=\1 \*\//g;

const START_RE = /\/\* samaritan-css:start id=(\S+) component=(\S+) scope=(\S+) fw=(\S+)(?: class=(\S+))?(?: applies=(\S+))? \*\//g;
const ANY_MARKER_RE = /\/\* samaritan-css:(?:start|end) [^*]*\*\//g;
const LEVELS = ["block", "article", "component", "course"];

// Marker values are whitespace-delimited tokens; keep them to a safe charset.
function token(value: string | undefined, fallback: string): string {
  const cleaned = String(value ?? "").replace(/[^A-Za-z0-9._-]/g, "");
  return cleaned || fallback;
}

export function newBlockId(): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return rand.slice(0, 12);
}

export function wrapBlock(css: string, meta: CssBlockInsertMeta): string {
  const id = token(meta.id, newBlockId());
  const component = token(meta.component, "-");
  const fw = token(meta.fw, "unknown");
  // The end marker must not be forgeable from inside the CSS body.
  const body = css.replace(/\/\*\s*samaritan-css:(start|end)[\s\S]*?\*\//g, "").trim();
  const cls = meta.className ? token(meta.className, "") : "";
  const applies = meta.appliesTo ? ` applies=${token(meta.appliesTo, "block")}` : "";
  const classPart = cls ? ` class=${cls}${applies || " applies=block"}` : applies;
  return `/* samaritan-css:start id=${id} component=${component} scope=${meta.scope} fw=${fw}${classPart} */\n${body}\n/* samaritan-css:end id=${id} */`;
}

/** Appends a new marker block to existing editor text (never replaces anything). */
export function appendBlock(existing: string, css: string, meta: CssBlockInsertMeta): string {
  const block = wrapBlock(css, meta);
  const base = existing.replace(/\s+$/, "");
  return base ? `${base}\n\n${block}\n` : `${block}\n`;
}

function appliesOf(value: string | undefined): StylingLevel | undefined {
  return value && LEVELS.includes(value) ? (value as StylingLevel) : undefined;
}

export function parseBlocks(text: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  const re = new RegExp(BLOCK_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const applies = appliesOf(m[6]);
    blocks.push({
      id: m[1],
      component: m[2],
      scope: m[3] === "component" ? "component" : "course",
      fw: m[4],
      ...(m[5] ? { className: m[5], appliesTo: applies ?? "block" } : {}),
      ...(!m[5] && applies ? { appliesTo: applies } : {}),
      css: m[7],
      start: m.index,
      end: m.index + m[0].length,
      markerEnd: m.index + m[0].indexOf("*/") + 2,
    });
  }

  // Orphan start markers (end marker hand-deleted): not inside a complete block.
  const markers = Array.from(text.matchAll(new RegExp(ANY_MARKER_RE.source, "g"))).map((x) => x.index ?? 0);
  const starts = new RegExp(START_RE.source, "g");
  while ((m = starts.exec(text))) {
    const at = m.index;
    if (blocks.some((b) => !b.broken && at >= b.start && at < b.end)) continue;
    const markerEnd = at + m[0].length;
    let end = text.length;
    const nextMarker = markers.find((i) => i >= markerEnd);
    if (nextMarker !== undefined) end = Math.min(end, nextMarker);
    const blank = /\r?\n[ \t]*\r?\n/.exec(text.slice(markerEnd));
    if (blank) end = Math.min(end, markerEnd + blank.index);
    const body = text.slice(markerEnd, end);
    const applies = appliesOf(m[6]);
    blocks.push({
      id: m[1],
      component: m[2],
      scope: m[3] === "component" ? "component" : "course",
      fw: m[4],
      ...(m[5] ? { className: m[5], appliesTo: applies ?? "block" } : {}),
      ...(!m[5] && applies ? { appliesTo: applies } : {}),
      css: body.replace(/^\r?\n/, "").replace(/\s+$/, ""),
      start: at,
      end: markerEnd + body.replace(/\s+$/, "").length,
      markerEnd,
      broken: true,
    });
  }
  return blocks.sort((a, b) => a.start - b.start);
}

/** Removes one marker block (and the blank line it leaves behind). No-op if the id is absent. */
export function removeBlock(text: string, id: string): string {
  const block = parseBlocks(text).find((b) => b.id === id);
  if (!block) return text;
  const before = text.slice(0, block.start).replace(/\s+$/, "");
  const after = text.slice(block.end).replace(/^\s+/, "");
  if (!before) return after;
  if (!after) return `${before}\n`;
  return `${before}\n\n${after}`;
}

/** For a damaged block (missing end marker): removes ONLY the start marker comment, keeping the CSS. */
export function removeMarkerOnly(text: string, id: string): string {
  const block = parseBlocks(text).find((b) => b.id === id && b.broken);
  if (!block) return text;
  return text.slice(0, block.start) + text.slice(block.markerEnd).replace(/^[ \t]*\r?\n/, "");
}
