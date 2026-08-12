// Course generation engine (ADAPT-3760, Phase 4 / AC4 / AC11).
//
// Reconciles a storyboard document into real Adapt course content. The document
// is parsed into an intended Topic→Section→Content Group→Component tree (H1–H4,
// with implicit parents for edge cases such as content-before-H1 or skipped
// levels), diffed against the live course by block-id ↔ content-id, and applied
// via the existing content CRUD: existing nodes are updated + reparented +
// reordered, new nodes created, removed nodes deleted. Idempotent — the caller
// re-seeds the document from the course afterwards so every block carries a
// content id, so a second run is a no-op.

import { apiClient } from "./client";
import {
  getContentByCourse,
  getAvailableComponents,
  createTopic,
  createArticle,
  createBlock,
  createComponent,
  linkContentAsset,
} from "./adaptAuthoring";
import { isAssessmentKind, validateAssessment, type AssessmentData } from "@/types/storyboard";
import {
  buildGraphicField,
  buildMediaField,
  filenameFromLink,
  type ImageData,
  type MediaData,
} from "@/components/storyboard/mediaMapping";

export interface GenerationPlan {
  topics: number;
  sections: number;
  groups: number;
  components: number;
  willDelete: number;
  issues: string[]; // blocking
  warnings: string[]; // non-blocking (e.g. incomplete assessments)
}

export interface GenerationResult {
  created: number;
  updated: number;
  deleted: number;
  blockToContent: Record<string, string>;
}

// Neutral kind → Adapt component key (`_component`) for creation.
const ASSESS_KEY: Record<string, string> = {
  mcq: "mcq",
  gmcq: "gmcq",
  matching: "matching",
  reorder: "textInput",
  textInput: "textInput",
  slider: "slider",
};
const PLACEHOLDER_KEY: Record<string, string> = {
  hotgraphic: "hotgraphic",
  hotgrid: "hotgrid",
  h5p: "h5p",
  actionplan: "actionplan",
  groupedContent: "text",
  laerdalForm: "text",
  instruction: "text",
};
// Rich component-card kind → Adapt component key.
const COMPONENT_KEY: Record<string, string> = {
  text: "text",
  groupedContent: "text",
  image: "graphic",
  video: "media",
  audio: "media",
  h5p: "h5p",
  laerdalForm: "text",
};

interface ContentNode {
  _id: string;
  _type?: string;
  _parentId?: string;
}

interface GenBlock {
  id?: string;
  type?: string;
  props?: { level?: number; kind?: string; data?: string; title?: string; label?: string };
  content?: unknown;
}

interface GenComponent {
  sourceBlockId?: string;
  existingId?: string;
  componentKey: string;
  title: string;
  body?: string;
  // Media components: the `_graphic`/`_media` patch + the chosen asset, so
  // generation writes the asset fields and links the courseasset for publish.
  mediaPatch?: Record<string, unknown>;
  assetLink?: string;
  assetId?: string;
}
interface GenGroup {
  sourceBlockId?: string;
  existingId?: string;
  title: string;
  components: GenComponent[];
}
interface GenSection {
  sourceBlockId?: string;
  existingId?: string;
  title: string;
  groups: GenGroup[];
}
interface GenTopic {
  sourceBlockId?: string;
  existingId?: string;
  title: string;
  sections: GenSection[];
}

function inlineToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((n) => (n && typeof (n as { text?: unknown }).text === "string" ? (n as { text: string }).text : ""))
    .join("");
}

function escapeHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeParseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Parse the ordered document into the intended course tree.
function parseDocToTree(doc: unknown[], resolveExisting: (id: string) => string | undefined): GenTopic[] {
  const topics: GenTopic[] = [];
  let topic: GenTopic | null = null;
  let section: GenSection | null = null;
  let group: GenGroup | null = null;
  let pending: GenComponent | null = null;

  const ensureTopic = () => {
    if (!topic) {
      topic = { title: "Untitled Topic", sections: [] };
      topics.push(topic);
      section = null;
      group = null;
    }
    return topic;
  };
  const ensureSection = () => {
    ensureTopic();
    if (!section) {
      section = { title: "Untitled Section", groups: [] };
      topic!.sections.push(section);
      group = null;
    }
    return section;
  };
  const ensureGroup = () => {
    ensureSection();
    if (!group) {
      group = { title: "Untitled Content Group", components: [] };
      section!.groups.push(group);
    }
    return group;
  };

  for (const raw of doc as GenBlock[]) {
    const id = typeof raw.id === "string" ? raw.id : undefined;
    const type = raw.type;
    const existingId = id ? resolveExisting(id) : undefined;

    if (type === "heading") {
      const level = (raw.props && raw.props.level) || 1;
      const title = inlineToText(raw.content).trim() || "Untitled";
      if (level <= 1) {
        topic = { sourceBlockId: id, existingId, title, sections: [] };
        topics.push(topic);
        section = null;
        group = null;
        pending = null;
      } else if (level === 2) {
        ensureTopic();
        section = { sourceBlockId: id, existingId, title, groups: [] };
        topic!.sections.push(section);
        group = null;
        pending = null;
      } else if (level === 3) {
        ensureSection();
        group = { sourceBlockId: id, existingId, title, components: [] };
        section!.groups.push(group);
        pending = null;
      } else {
        ensureGroup();
        pending = { sourceBlockId: id, existingId, componentKey: "text", title, body: "" };
        group!.components.push(pending);
      }
      continue;
    }

    if (type === "paragraph") {
      const text = inlineToText(raw.content);
      if (pending && pending.componentKey === "text") {
        pending.body = (pending.body ? `${pending.body}\n` : "") + text;
        if (id && !id.endsWith("::body") && !pending.sourceBlockId) pending.sourceBlockId = id;
        continue;
      }
      ensureGroup();
      const comp: GenComponent = {
        sourceBlockId: id,
        existingId,
        componentKey: "text",
        title: text.slice(0, 40) || "Text",
        body: text,
      };
      group!.components.push(comp);
      pending = comp;
      continue;
    }

    // Non-text content → its own component.
    ensureGroup();
    let comp: GenComponent | null = null;
    if (type === "sbComponent") {
      const kind = (raw.props && raw.props.kind) || "text";
      const data = safeParseJson<{ description?: string; image?: ImageData; media?: MediaData }>(
        raw.props && raw.props.data,
        {}
      );
      comp = {
        sourceBlockId: id,
        existingId,
        componentKey: COMPONENT_KEY[kind] || "text",
        title: ((raw.props && raw.props.title) || "").trim() || "Component",
        body: data.description || "",
      };
      if (kind === "image") {
        comp.mediaPatch = buildGraphicField(data.image);
        comp.assetLink = data.image?.link;
        comp.assetId = data.image?.assetId;
      } else if (kind === "video" || kind === "audio") {
        comp.mediaPatch = buildMediaField(kind, data.media);
        comp.assetLink = data.media?.asset?.link;
        comp.assetId = data.media?.asset?.assetId;
      }
    } else if (type === "sbAssessment") {
      const kind = (raw.props && raw.props.kind) || "mcq";
      const data = safeParseJson<{ question?: string }>(raw.props && raw.props.data, {});
      comp = {
        sourceBlockId: id,
        existingId,
        componentKey: ASSESS_KEY[kind] || "mcq",
        title: (data.question || "").trim() || "Question",
      };
    } else if (type === "sbPlaceholder") {
      const label = (raw.props && (raw.props.title || raw.props.label)) || "Placeholder";
      comp = {
        sourceBlockId: id,
        existingId,
        componentKey: PLACEHOLDER_KEY[(raw.props && raw.props.label) || ""] || "text",
        title: label,
      };
    } else if (type === "image") {
      comp = { sourceBlockId: id, existingId, componentKey: "graphic", title: "Image" };
    } else if (type === "video" || type === "audio") {
      comp = { sourceBlockId: id, existingId, componentKey: "media", title: type };
    }
    if (comp) {
      group!.components.push(comp);
      pending = null;
    }
  }

  return topics;
}

// Adapt blocks hold at most 2 components. If the author put more components
// under one Content Group (H3), split them across additional blocks — each a
// Content Group Heading carrying the same title — keeping ≤2 per block. The
// first chunk keeps the original group (its source/existing id); overflow
// blocks are synthetic (recreated each generation until re-seeded from course).
const MAX_COMPONENTS_PER_BLOCK = 2;

function enforceMaxComponentsPerBlock(topics: GenTopic[]): void {
  for (const t of topics) {
    for (const s of t.sections) {
      const out: GenGroup[] = [];
      for (const g of s.groups) {
        if (g.components.length <= MAX_COMPONENTS_PER_BLOCK) {
          out.push(g);
          continue;
        }
        const rest = g.components.slice(MAX_COMPONENTS_PER_BLOCK);
        g.components = g.components.slice(0, MAX_COMPONENTS_PER_BLOCK);
        out.push(g);
        for (let i = 0; i < rest.length; i += MAX_COMPONENTS_PER_BLOCK) {
          out.push({
            // Continuation Content Group Heading — same title so it stays
            // associated with the same group of components.
            title: g.title,
            components: rest.slice(i, i + MAX_COMPONENTS_PER_BLOCK),
          });
        }
      }
      s.groups = out;
    }
  }
}

async function fetchCourseIndex(courseId: string) {
  const [contentObjects, articles, blocks, components] = await Promise.all([
    getContentByCourse("contentobject", courseId),
    getContentByCourse("article", courseId),
    getContentByCourse("block", courseId),
    getContentByCourse("component", courseId),
  ]);
  return {
    contentObjects: contentObjects as unknown as ContentNode[],
    articles: articles as unknown as ContentNode[],
    blocks: blocks as unknown as ContentNode[],
    components: components as unknown as ContentNode[],
  };
}

function makeResolver(index: { [k: string]: ContentNode[] }, map: Record<string, string>) {
  const existingIds = new Set<string>(
    [...index.contentObjects, ...index.articles, ...index.blocks, ...index.components].map((n) => n._id)
  );
  return {
    existingIds,
    resolve: (blockId: string) =>
      existingIds.has(blockId)
        ? blockId
        : map[blockId] && existingIds.has(map[blockId])
          ? map[blockId]
          : undefined,
  };
}

/** Validate + summarise what generation would do — shown before applying. */
export async function planStoryboardGeneration(
  courseId: string,
  doc: unknown[],
  generatedContentMap: Record<string, string> = {}
): Promise<GenerationPlan> {
  const index = await fetchCourseIndex(courseId);
  const { resolve } = makeResolver(index as never, generatedContentMap);
  const tree = parseDocToTree(doc, resolve);
  enforceMaxComponentsPerBlock(tree);

  let sections = 0;
  let groups = 0;
  let components = 0;
  const referenced = new Set<string>();
  for (const t of tree) {
    if (t.existingId) referenced.add(t.existingId);
    for (const s of t.sections) {
      sections += 1;
      if (s.existingId) referenced.add(s.existingId);
      for (const g of s.groups) {
        groups += 1;
        if (g.existingId) referenced.add(g.existingId);
        for (const c of g.components) {
          components += 1;
          if (c.existingId) referenced.add(c.existingId);
        }
      }
    }
  }

  const pages = index.contentObjects.filter((c) => c._type === "page");
  const willDelete =
    pages.filter((p) => !referenced.has(p._id)).length +
    index.articles.filter((a) => !referenced.has(a._id)).length +
    index.blocks.filter((b) => !referenced.has(b._id)).length +
    index.components.filter((c) => !referenced.has(c._id)).length;

  const issues: string[] = [];
  const warnings: string[] = [];
  if (tree.length === 0) issues.push("Add at least one H1 heading (a Topic) before generating.");

  for (const raw of doc as GenBlock[]) {
    if (raw.type === "sbAssessment") {
      const kind = (raw.props && raw.props.kind) || "";
      const data = safeParseJson<AssessmentData>(raw.props && raw.props.data, { question: "" });
      if (isAssessmentKind(kind)) {
        const problems = validateAssessment(kind, data);
        if (problems.length) warnings.push(`Assessment "${data.question || kind}": ${problems[0]}`);
      }
    }
  }

  return { topics: tree.length, sections, groups, components, willDelete, issues, warnings };
}

/** Apply the storyboard to the course: create/update/reparent/reorder/delete. */
export async function generateStoryboardCourse(
  courseId: string,
  doc: unknown[],
  generatedContentMap: Record<string, string> = {}
): Promise<GenerationResult> {
  const [index, availableTypes] = await Promise.all([fetchCourseIndex(courseId), getAvailableComponents()]);
  const { resolve } = makeResolver(index as never, generatedContentMap);
  const tree = parseDocToTree(doc, resolve);
  enforceMaxComponentsPerBlock(tree);

  const typeByKey = new Map(availableTypes.map((t) => [t.component, t]));
  const getType = (key: string) => typeByKey.get(key) || typeByKey.get("text") || null;

  const resolved = new Set<string>();
  const blockToContent: Record<string, string> = {};
  let created = 0;
  let updated = 0;
  let deleted = 0;

  const put = (type: string, id: string, body: Record<string, unknown>) =>
    apiClient.put(`/api/content/${type}/${id}`, body);
  const bodyHtmlOf = (c: GenComponent) => (c.body && c.body.trim() ? `<p>${escapeHtml(c.body.trim())}</p>` : undefined);

  let tSort = 1;
  for (const t of tree) {
    let topicId = t.existingId;
    if (topicId) {
      await put("contentobject", topicId, { title: t.title, displayTitle: t.title, _parentId: courseId, _sortOrder: tSort });
      updated += 1;
    } else {
      topicId = await createTopic(courseId, courseId, t.title, tSort);
      created += 1;
    }
    resolved.add(topicId);
    if (t.sourceBlockId) blockToContent[t.sourceBlockId] = topicId;
    tSort += 1;

    let sSort = 1;
    for (const s of t.sections) {
      let secId = s.existingId;
      if (secId) {
        await put("article", secId, { title: s.title, displayTitle: s.title, _parentId: topicId, _sortOrder: sSort });
        updated += 1;
      } else {
        secId = await createArticle(courseId, topicId, s.title, sSort);
        created += 1;
      }
      resolved.add(secId);
      if (s.sourceBlockId) blockToContent[s.sourceBlockId] = secId;
      sSort += 1;

      let gSort = 1;
      for (const g of s.groups) {
        let grpId = g.existingId;
        if (grpId) {
          await put("block", grpId, { title: g.title, displayTitle: g.title, _parentId: secId, _sortOrder: gSort });
          updated += 1;
        } else {
          grpId = await createBlock(courseId, secId, g.title, gSort);
          created += 1;
        }
        resolved.add(grpId);
        if (g.sourceBlockId) blockToContent[g.sourceBlockId] = grpId;
        gSort += 1;

        let cSort = 1;
        for (const c of g.components) {
          const bodyHtml = bodyHtmlOf(c);
          // Default component alignment is Right (spec: newly generated blocks
          // hold up to 2 right-aligned components).
          const layout: "right" = "right";
          let compId = c.existingId;
          if (compId) {
            const upd: Record<string, unknown> = { title: c.title, displayTitle: c.title, _parentId: grpId, _sortOrder: cSort, _layout: layout };
            if (bodyHtml !== undefined) upd.body = bodyHtml;
            if (c.mediaPatch) Object.assign(upd, c.mediaPatch);
            await put("component", compId, upd);
            updated += 1;
          } else {
            const ctype = getType(c.componentKey);
            if (!ctype) {
              cSort += 1;
              continue; // no installed component type and no text fallback
            }
            compId = await createComponent(courseId, grpId, ctype, cSort, layout);
            const upd: Record<string, unknown> = { title: c.title, displayTitle: c.title, _layout: layout };
            if (bodyHtml !== undefined) upd.body = bodyHtml;
            if (c.mediaPatch) Object.assign(upd, c.mediaPatch);
            await put("component", compId, upd);
            created += 1;
          }
          resolved.add(compId);
          if (c.sourceBlockId) blockToContent[c.sourceBlockId] = compId;
          // Link the chosen DAM asset to this component so publish resolves it.
          if (c.assetId && c.assetLink) {
            const fn = filenameFromLink(c.assetLink);
            if (fn) {
              try {
                await linkContentAsset(courseId, "component", compId, grpId, fn, c.assetId);
              } catch {
                /* non-fatal: publish asset-copy link is best-effort */
              }
            }
          }
          cSort += 1;
        }
      }
    }
  }

  // Delete pages/articles/blocks/components removed from the storyboard
  // (leaves first; page deletes cascade — 404s on already-removed are ignored).
  const pages = index.contentObjects.filter((c) => c._type === "page");
  const removals: Array<[string, string]> = [
    ...index.components.filter((c) => !resolved.has(c._id)).map((c) => ["component", c._id] as [string, string]),
    ...index.blocks.filter((b) => !resolved.has(b._id)).map((b) => ["block", b._id] as [string, string]),
    ...index.articles.filter((a) => !resolved.has(a._id)).map((a) => ["article", a._id] as [string, string]),
    ...pages.filter((p) => !resolved.has(p._id)).map((p) => ["contentobject", p._id] as [string, string]),
  ];
  for (const [type, id] of removals) {
    try {
      await apiClient.delete(`/api/content/${type}/${id}`);
      deleted += 1;
    } catch {
      /* already removed by a cascade */
    }
  }

  return { created, updated, deleted, blockToContent };
}
