// Marker blocks that let the Custom CSS editor track AI-inserted CSS so each
// block can be listed and removed individually:
//
//   /* samaritan-css:start id=.. component=.. scope=.. fw=.. [class=.. applies=..] */
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
  /** Level the author was told to add the class to. */
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
}

export const COMPATIBILITY_WARNING =
  "Custom CSS may require review after future framework updates if underlying component structures or class names change.";

// Optional trailing fields: ` class=<c> applies=<level>` (class blocks) or ` applies=course` (whole-course blocks,
// with component=<type>). Legacy markers without them still parse.
const BLOCK_RE =
  /\/\* samaritan-css:start id=(\S+) component=(\S+) scope=(\S+) fw=(\S+)(?: class=(\S+))?(?: applies=(\S+))? \*\/\r?\n?([\s\S]*?)\r?\n?\/\* samaritan-css:end id=\1 \*\//g;

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
  const classPart = cls
    ? ` class=${cls} applies=${token(meta.appliesTo, "block")}`
    : meta.appliesTo === "course"
      ? " applies=course"
      : "";
  return `/* samaritan-css:start id=${id} component=${component} scope=${meta.scope} fw=${fw}${classPart} */\n${body}\n/* samaritan-css:end id=${id} */`;
}

/** Appends a new marker block to existing editor text (never replaces anything). */
export function appendBlock(existing: string, css: string, meta: CssBlockInsertMeta): string {
  const block = wrapBlock(css, meta);
  const base = existing.replace(/\s+$/, "");
  return base ? `${base}\n\n${block}\n` : `${block}\n`;
}

export function parseBlocks(text: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  const re = new RegExp(BLOCK_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    blocks.push({
      id: m[1],
      component: m[2],
      scope: m[3] === "component" ? "component" : "course",
      fw: m[4],
      ...(m[5] ? { className: m[5], appliesTo: (["block", "article", "component", "course"].includes(m[6]) ? m[6] : "block") as StylingLevel } : {}),
      ...(!m[5] && m[6] === "course" ? { appliesTo: "course" as StylingLevel } : {}),
      css: m[7],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return blocks;
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
