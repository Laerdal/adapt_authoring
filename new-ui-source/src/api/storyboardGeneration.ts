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
  seedMissingCourseDefaults,
} from "./adaptAuthoring";
import {
  buildAssessmentFields,
  isAssessmentKind,
  validateAssessment,
  INSERT_META,
  type AssessmentData,
  type AssessmentKind,
} from "@/types/storyboard";
import {
  buildGraphicField,
  buildImageAsMedia,
  buildMediaField,
  filenameFromLink,
  mergeProperties,
  type ImageData,
  type MediaData,
} from "@/components/storyboard/mediaMapping";
import { resolveAdaptComponent } from "./componentMapping";

// sbPlaceholder blocks store the human label; map it back to the storyboard
// kind so it can be resolved to a component (or reported unsupported).
const PLACEHOLDER_LABEL_TO_KIND: Record<string, string> = Object.fromEntries(
  (Object.keys(INSERT_META) as (keyof typeof INSERT_META)[]).map((k) => [INSERT_META[k].label, k])
);

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
  /** Storyboard kinds that map to NO installed Adapt plugin — reported so the
   *  author can install the plugin. These are SKIPPED during generation (never
   *  silently persisted as Text); their content remains in the storyboard. */
  missingTypes: string[];
}

// Storyboard kind → Adapt `_component` is resolved at generation time against
// the tenant's installed component types via resolveAdaptComponent (see
// api/componentMapping.ts) — the single source of truth. No hard-coded key maps
// live here anymore, and there is NO silent "text" fallback for unmapped kinds.

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
  // Assessment components: `_items` + `_feedback` + per-kind extras.
  assessmentPatch?: Record<string, unknown>;
  // Original storyboard kind + parsed data, retained so we can rebuild the
  // persistence patch once we know which Adapt component-type the generator
  // resolves to (e.g. image can persist to graphic OR laerdal-media OR media).
  pendingKind?: "image" | "video" | "audio" | "groupedContent";
  pendingImage?: ImageData;
  pendingMedia?: MediaData;
  pendingItems?: Array<{ title?: string; body?: string; image?: string; imageAssetId?: string }>;
  /** GMCQ per-option images that came from the DAM — linked as courseassets
   *  after the component is created so publish resolves them. */
  pendingOptionImages?: Array<{ image?: string; imageAssetId?: string }>;
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

// Grouped Content items → laerdal-narrative `properties._items`. The item's
// Grouped Content items → `_items[]` for the Accordion / Narrative components.
// Both accordion and (laerdal-)narrative use `_items[].{title, body, _graphic:
// {src, alt, attribution}}` (verbatim from the installed schemas). A course
// asset persists as `_graphic.src`; otherwise `_graphic` is left empty.
// Returns a RAW plugin-field patch (`{_items: [...]}`) — the caller nests it
// under `properties` via mergeProperties.
function buildGroupedItemsPatch(
  items?: Array<{ title?: string; body?: string; image?: string }>
): { _items: Array<Record<string, unknown>> } {
  const list = Array.isArray(items) ? items : [];
  return {
    _items: list.map((it) => {
      const rawBody = (it?.body || "").trim();
      const body = rawBody
        ? rawBody.startsWith("<")
          ? rawBody
          : `<p>${escapeHtml(rawBody)}</p>`
        : "";
      // `image` is the persisted link (course/assets/<file> or an external URL).
      const imgLink = (it?.image || "").trim();
      return {
        title: it?.title || "",
        body,
        _graphic: { alt: "", src: imgLink, attribution: "" },
      };
    }),
  };
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
      // Blank spacer paragraphs (BlockNote inserts them around cards, and the
      // starter/seed docs contain a trailing one) must NOT become Text
      // components — that was the phantom "extra Text component". A Text
      // component is created ONLY from a paragraph the author actually typed
      // into, or the H4-heading body below.
      if (!text.trim()) continue;
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
      const data = safeParseJson<{
        description?: string;
        image?: ImageData;
        media?: MediaData;
        items?: Array<{ title?: string; body?: string; image?: string }>;
        fields?: Array<{ control?: string; label?: string; placeholder?: string; mandatory?: boolean }>;
        result?: {
          assessmentId?: string;
          completionBody?: string;
          retryButton?: string;
          retryFeedback?: string;
          bands?: Array<{ score?: number; feedback?: string; allowRetry?: boolean }>;
        };
      }>(raw.props && raw.props.data, {});
      // `componentKey` now holds the STORYBOARD KIND; the Adapt _component is
      // resolved later via resolveAdaptComponent against installed types.
      comp = {
        sourceBlockId: id,
        existingId,
        componentKey: kind,
        title: ((raw.props && raw.props.title) || "").trim() || "Component",
        body: data.description || "",
      };
      if (kind === "image") {
        comp.pendingKind = "image";
        comp.pendingImage = data.image;
        comp.assetLink = data.image?.link;
        comp.assetId = data.image?.assetId;
      } else if (kind === "video" || kind === "audio") {
        comp.pendingKind = kind;
        comp.pendingMedia = data.media;
        comp.assetLink = data.media?.asset?.link;
        comp.assetId = data.media?.asset?.assetId;
      } else if (kind === "groupedContent") {
        comp.pendingKind = "groupedContent";
        comp.pendingItems = data.items;
      } else if (kind === "h5p") {
        // laerdal-h5p accepts EITHER a DAM asset (`h5pAsset`) OR an external
        // embed URL (`_h5pExternalAsset`). External asset refs write the URL;
        // picked DAM assets write the course-relative link AND record a
        // courseasset link below so publish can resolve it.
        const asset = data.media?.asset;
        const patch: Record<string, unknown> = { instruction: "" };
        if (asset?.external || (asset?.link && /^https?:\/\//i.test(asset.link))) {
          patch._h5pExternalAsset = asset.link || asset.url || "";
        } else if (asset?.link) {
          patch.h5pAsset = asset.link;
        }
        comp.assessmentPatch = patch;
        comp.assetLink = asset?.link;
        comp.assetId = asset?.assetId;
      } else if (kind === "laerdalForm") {
        // laerdal-form `_items[]` mirrors the sbComponent form-field editor.
        // Backend accepts these `_inputType` values:
        // text|textarea|email|url|range|hidden|tel|options|number.
        const inputTypeFor = (ctl: string): string => {
          switch ((ctl || "").toLowerCase()) {
            case "multi-line text":
              return "textarea";
            case "number":
              return "number";
            case "dropdown":
              return "options";
            case "checkbox":
              // No boolean type on the backend; render as a single-option
              // multi-select so the field persists and validates.
              return "options";
            case "single-line text":
            default:
              return "text";
          }
        };
        const slugify = (s: string, i: number) =>
          (s || `field-${i + 1}`)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || `field-${i + 1}`;
        const items = (data.fields || []).map((f, i) => {
          const _inputType = inputTypeFor(f.control || "");
          const item: Record<string, unknown> = {
            _inputType,
            _label: f.label || "",
            _name: slugify(f.label || "", i),
            _isRequired: !!f.mandatory,
            _placeholder: f.placeholder || "",
          };
          if (_inputType === "options" && (f.control || "").toLowerCase() === "checkbox") {
            item.options = [{ text: f.placeholder || "Yes", value: "yes" }];
          }
          return item;
        });
        comp.assessmentPatch = { _items: items };
      } else if (kind === "assessmentResult") {
        // adapt-contrib-assessmentResults: bind to an article-level assessment
        // (`_assessmentId`), render bands ordered high\u2192low, offer retry, and
        // template the completion body with `{{scoreAsPercent}}` etc.
        const r = data.result || {};
        const bands = Array.isArray(r.bands) ? r.bands : [];
        comp.assessmentPatch = {
          _assessmentId: (r.assessmentId || "").trim() || undefined,
          _completionBody: r.completionBody || "",
          _isVisibleBeforeCompletion: false,
          _setCompletionOn: "pass",
          _resetType: "hard",
          _retry: {
            button: r.retryButton || "Try again",
            feedback: r.retryFeedback || "",
            _routeToAssessment: true,
          },
          _bands: bands
            .slice()
            .sort((a, b) => (Number(a.score) || 0) - (Number(b.score) || 0))
            .map((b) => ({
              _score: Math.max(0, Math.min(100, Number(b.score) || 0)),
              feedback: b.feedback || "",
              feedbackNotFinal: b.feedback || "",
              _allowRetry: !!b.allowRetry,
            })),
        };
      }
    } else if (type === "sbAssessment") {
      const kind = ((raw.props && raw.props.kind) || "mcq") as AssessmentKind;
      const data = safeParseJson<AssessmentData>(raw.props && raw.props.data, { question: "" });
      comp = {
        sourceBlockId: id,
        existingId,
        componentKey: kind,
        title: ((raw.props && raw.props.title) || data.question || "").trim() || "Question",
        body: data.question || "",
        assessmentPatch: buildAssessmentFields(kind, data),
      };
      // GMCQ: record per-option DAM-asset ids so we can create the courseasset
      // publish links after the component is created.
      if (kind === "gmcq" && Array.isArray(data.options)) {
        comp.pendingOptionImages = data.options
          .filter((o) => o.image && o.imageAssetId)
          .map((o) => ({ image: o.image, imageAssetId: o.imageAssetId }));
      }
    } else if (type === "sbPlaceholder") {
      const label = (raw.props && (raw.props.title || raw.props.label)) || "Placeholder";
      const rawLabel = (raw.props && raw.props.label) || "";
      comp = {
        sourceBlockId: id,
        existingId,
        componentKey: PLACEHOLDER_LABEL_TO_KIND[rawLabel] || "instruction",
        title: label,
      };
    } else if (type === "image") {
      comp = { sourceBlockId: id, existingId, componentKey: "image", title: "Image" };
    } else if (type === "video" || type === "audio") {
      comp = { sourceBlockId: id, existingId, componentKey: type, title: type };
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

/** Apply the storyboard to the course: create/update/reparent/reorder/delete.
 *  `options.skipDeletes` (used by Save) reconciles additively — it never removes
 *  course content, only creates/updates/reorders. */
export async function generateStoryboardCourse(
  courseId: string,
  doc: unknown[],
  generatedContentMap: Record<string, string> = {},
  options: { skipDeletes?: boolean } = {}
): Promise<GenerationResult> {
  const [index, availableTypes] = await Promise.all([fetchCourseIndex(courseId), getAvailableComponents()]);
  const { resolve } = makeResolver(index as never, generatedContentMap);
  const tree = parseDocToTree(doc, resolve);
  enforceMaxComponentsPerBlock(tree);

  const typeByKey = new Map(availableTypes.map((t) => [t.component, t]));
  const installed = new Set(availableTypes.map((t) => t.component));
  // Storyboard kinds that map to NO installed Adapt plugin. These are reported
  // (never silently persisted as Text) so the author can install the plugin.
  const unsupported = new Set<string>();

  // Resolve a storyboard KIND to an installed Adapt component-type (the single
  // source of truth is /api/componenttype via componentMapping). Returns null
  // (and records the kind as unsupported) when no candidate is installed — there
  // is NO "text" fallback.
  const getType = (kind: string): { type: ReturnType<typeof typeByKey.get>; component: string } | null => {
    const component = resolveAdaptComponent(kind, installed);
    if (!component) {
      unsupported.add(kind);
      return null;
    }
    const type = typeByKey.get(component);
    if (!type) {
      unsupported.add(kind);
      return null;
    }
    return { type, component };
  };

  // Build the plugin-property patch for a media/grouped component, shaped to the
  // ACTUAL resolved Adapt `_component`. Called for both new and existing nodes.
  const buildPatchFor = (c: GenComponent, component: string): void => {
    if (!c.pendingKind) return;
    if (c.pendingKind === "image") {
      c.mediaPatch = component === "graphic" ? buildGraphicField(c.pendingImage) : buildImageAsMedia(c.pendingImage);
      return;
    }
    if (c.pendingKind === "video" || c.pendingKind === "audio") {
      if (component === "graphic") {
        c.mediaPatch = buildGraphicField({
          link: c.pendingMedia?.poster?.link || "",
          url: c.pendingMedia?.poster?.url || "",
          alt: "",
        });
      } else {
        c.mediaPatch = buildMediaField(c.pendingKind, c.pendingMedia);
      }
      return;
    }
    if (c.pendingKind === "groupedContent") {
      // accordion / narrative / laerdal-narrative all take `_items[]` with a
      // `_graphic.src` image (verbatim from the installed schemas).
      c.mediaPatch = buildGroupedItemsPatch(c.pendingItems);
    }
  };

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
          // Default component alignment is Left. New components added to the
          // Storyboard are always generated (and saved) with left alignment so
          // the Storyboard sequence and layout match the generated course.
          const layout: "left" = "left";
          // Resolve the storyboard kind → installed Adapt component (source of
          // truth). null = unsupported (NO text fallback).
          const resolvedType = getType(c.componentKey);
          // Shape the media/grouped patch to the resolved `_component`.
          if (resolvedType) buildPatchFor(c, resolvedType.component);
          let compId = c.existingId;
          if (compId) {
            // Existing node: always keep title/body; only write plugin fields
            // when the kind resolves to an installed component.
            const upd: Record<string, unknown> = { title: c.title, displayTitle: c.title, _parentId: grpId, _sortOrder: cSort, _layout: layout };
            if (bodyHtml !== undefined) upd.body = bodyHtml;
            // Plugin fields (_graphic/_media/_items/_feedback) nest under
            // `properties` — top-level would be dropped by the content model.
            if (resolvedType && c.mediaPatch) mergeProperties(upd, c.mediaPatch);
            if (resolvedType && c.assessmentPatch) mergeProperties(upd, c.assessmentPatch);
            await put("component", compId, upd);
            updated += 1;
          } else {
            if (!resolvedType || !resolvedType.type) {
              // Unsupported: report it (see `unsupported`), never create a Text
              // stand-in. The content stays in the storyboard (source of truth).
              cSort += 1;
              continue;
            }
            compId = await createComponent(courseId, grpId, resolvedType.type, cSort, layout);
            const upd: Record<string, unknown> = { title: c.title, displayTitle: c.title, _layout: layout };
            if (bodyHtml !== undefined) upd.body = bodyHtml;
            if (c.mediaPatch) mergeProperties(upd, c.mediaPatch);
            if (c.assessmentPatch) mergeProperties(upd, c.assessmentPatch);
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
          // Grouped Content / Accordion item images each need their own
          // courseasset link (multiple images per component).
          if (c.pendingKind === "groupedContent" && Array.isArray(c.pendingItems)) {
            for (const it of c.pendingItems) {
              const fn = filenameFromLink(it?.image);
              if (fn && it?.imageAssetId) {
                try {
                  await linkContentAsset(courseId, "component", compId, grpId, fn, it.imageAssetId);
                } catch {
                  /* best-effort */
                }
              }
            }
          }
          // GMCQ per-option images need their own courseasset link so publish
          // can copy the image into the exported course.
          if (Array.isArray(c.pendingOptionImages)) {
            for (const opt of c.pendingOptionImages) {
              const fn = filenameFromLink(opt?.image);
              if (fn && opt?.imageAssetId) {
                try {
                  await linkContentAsset(courseId, "component", compId, grpId, fn, opt.imageAssetId);
                } catch {
                  /* best-effort */
                }
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
  // Skipped for additive Save reconciliation.
  if (!options.skipDeletes) {
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
  }

  // Seed the course's top-level schema defaults (`_globals`, `_buttons`,
  // `_navigation`, `_start`, `_tooltips`, `themeVariables`, …) into any branches
  // still missing on the course document. The Adapt runtime templates and views
  // dereference these directly at render time:
  //   • questionModel/buttonsView → `Adapt.course.get('_buttons')._<state>.ariaLabel`
  //   • themeComponentView        → `Adapt.course.get('themeVariables')._components...`
  //   • mcq template / a11y       → `_globals._accessibility._ariaLabels.*`
  //   • buttons/question globals  → `_globals._components._<plugin>.aria*`
  // Missing branches used to crash preview with
  //   TypeError: Cannot read properties of undefined (reading '_ariaLabels' | 'ariaLabel' | '_components')
  // Existing authored values are ALWAYS preserved (deep-merge, existing wins),
  // and the call is idempotent. Non-fatal to the generation itself.
  try {
    await seedMissingCourseDefaults(courseId);
  } catch (err) {
    console.warn("Storyboard generation: failed to seed course schema defaults", err);
  }

  return { created, updated, deleted, blockToContent, missingTypes: [...unsupported] };
}
