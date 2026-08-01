// Adapter between the /new UI and the Adapt authoring engine's REST API.
// Maps engine endpoints/shapes to what the UI components expect. Same-origin
// cookie session is handled by ./client. This is the single integration seam:
// keep engine-specific endpoint knowledge here, not in the pages.

import { apiClient } from "./client";

// ── Current user ────────────────────────────────────────────────────────────
// GET /api/user/me → the session user, enriched with rolesAsName by the engine.
export interface CurrentUser {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  rolesAsName?: string[];
  _tenantId?: string;
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiClient.get<CurrentUser>("/api/user/me");
}

export function logout(): Promise<unknown> {
  return apiClient.post("/api/logout");
}

// Instance display name for the header. Reads `domainName` from the client config
// (GET /config/config.json). Falls back to "Local Instance" when unset (local/dev).
export async function getInstanceName(): Promise<string> {
  try {
    const cfg = await apiClient.get<{ domainName?: string }>("/config/config.json");
    return (cfg?.domainName ?? "").trim() || "Local Instance";
  } catch {
    return "Local Instance";
  }
}

// ── Assets ───────────────────────────────────────────────────────────────────
export interface Asset {
  _id: string;
  title?: string;
  filename?: string;
  mimeType?: string;
  thumbnailPath?: string;
  path?: string;
}

// Query image assets from the engine asset manager.
// GET /api/asset/query?search[mimeType]=image
export async function queryImages(search?: string): Promise<Asset[]> {
  const params = new URLSearchParams({ "search[mimeType]": "image" });
  if (search) params.append("search[title]", search);
  try {
    const result = await apiClient.get<Asset[]>(`/api/asset/query?${params}`);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

// Upload a file as a new asset. Returns the new asset's _id.
export async function uploadAsset(file: File, title?: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title ?? file.name);
  const res = await fetch("/api/asset", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`Asset upload failed: ${res.statusText}`);
  const json = await res.json() as { _id: string };
  return json._id;
}

// ── Tags ─────────────────────────────────────────────────────────────────────
// Resolve tag titles to engine tag ObjectIds, creating any that don't exist yet.
// POST /api/content/tag with { title } is idempotent — returns existing if found.
export async function resolveOrCreateTagIds(tagTitles: string[]): Promise<string[]> {
  if (!tagTitles.length) return [];
  const results = await Promise.all(
    tagTitles.map(async (title) => {
      const tag = await apiClient.post<{ _id?: string; id?: string }>("/api/content/tag", { title });
      const id = tag._id ?? tag.id;
      if (!id) throw new Error(`Tag resolve/create did not return an id for "${title}"`);
      return id;
    })
  );
  return results;
}

// ── Dashboard courses ─────────────────────────────────────────────────────────
// Shape consumed by HomePage. `id` is a stable client key; `backendId` is the
// engine _id used for mutations.
export interface DashboardCourse {
  id: number;
  backendId: string;
  title: string;
  description: string;
  savedDate: string;
  savedDateTs: number;
  imageUrl: string | null;
  heroAssetId: string | null;
  theme: "LIFE Theme" | "Vanilla Theme" | "Custom Theme";
  tags: string[];
}

interface EngineCourse {
  _id: string;
  title?: string;
  displayTitle?: string;
  description?: string;
  heroImage?: string | null;
  updatedAt?: string;
  tags?: Array<string | { title?: string }>;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

function toDashboardCourse(doc: EngineCourse, index: number): DashboardCourse {
  const ts = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
  const heroAssetId = doc.heroImage && OBJECT_ID.test(doc.heroImage) ? doc.heroImage : null;
  return {
    id: index + 1,
    backendId: doc._id,
    title: doc.displayTitle || doc.title || "Untitled Course",
    description: doc.description || "",
    savedDate: ts
      ? new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : "",
    savedDateTs: ts,
    // Serve the hero image via the engine's asset-serve endpoint.
    imageUrl: heroAssetId ? `/api/asset/serve/${heroAssetId}` : null,
    heroAssetId,
    theme: "LIFE Theme",
    // Tags come back as refs or populated objects; keep only human-readable names.
    tags: Array.isArray(doc.tags)
      ? doc.tags
          .map((t) => (typeof t === "string" ? t : t?.title ?? ""))
          .filter((s): s is string => !!s && !OBJECT_ID.test(s))
      : [],
  };
}

// shared=false → my courses; shared=true → courses shared with me.
export async function fetchDashboardCourses(shared = false): Promise<DashboardCourse[]> {
  const endpoint = shared ? "/api/shared/course" : "/api/my/course";
  const docs = await apiClient.get<EngineCourse[]>(endpoint);
  return Array.isArray(docs) ? docs.map(toDashboardCourse) : [];
}

// Update course details — resolves tag titles to IDs before sending to the engine.
// Sends both `title` and `displayTitle` to keep the dashboard and course menu in sync.
export async function updateCourse(
  backendId: string,
  patch: {
    title?: string;
    description?: string;
    heroAssetId?: string | null;
    tags?: string[];
  }
): Promise<unknown> {
  const updateData: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    updateData.title = patch.title;
    updateData.displayTitle = patch.title;
  }
  if (patch.description !== undefined) updateData.description = patch.description;
  if (patch.heroAssetId !== undefined) updateData.heroImage = patch.heroAssetId;
  if (patch.tags !== undefined) {
    updateData.tags = await resolveOrCreateTagIds(patch.tags);
  }
  return apiClient.put(`/api/content/course/${backendId}`, updateData);
}

export function duplicateCourse(backendId: string): Promise<unknown> {
  return apiClient.get(`/api/duplicatecourse/${backendId}`);
}

export function deleteCourse(backendId: string): Promise<unknown> {
  return apiClient.delete(`/api/content/course/${backendId}`);
}

export interface CreateCourseInput {
  title: string;
  description?: string;
  instanceId?: string;
  theme?: string;
  menuStyle?: string;
}

export interface CreatedCourse {
  id: string;
  title: string;
  description: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  status: "Draft" | "Published" | "Archived";
  instanceId?: string;
  theme?: string;
  menuStyle?: string;
}

interface EnginePluginType {
  _id: string;
  name?: string;
  displayName?: string;
  theme?: string;
}

interface EngineCourseDetails {
  _id: string;
  title?: string;
  displayTitle?: string;
  description?: string;
  themeVariables?: Record<string, unknown>;
  _themePreset?: string;
}

interface EngineConfigDetails {
  _courseId?: string;
  _theme?: string;
  _menu?: string;
  _themePreset?: string;
}

export interface ThemePreset {
  _id: string;
  displayName: string;
  parentTheme: string;
  properties: Record<string, unknown>;
}

export interface CourseBootstrapData {
  courseId: string;
  title: string;
  description: string;
  themeName: string;
  menuName: string;
  themeVariables: Record<string, unknown>;
  themePresetId: string;
}

function normalize(v?: string): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scorePluginMatch(plugin: EnginePluginType, label: string, kind: "theme" | "menu"): number {
  const target = normalize(label);
  const name = normalize(plugin.name);
  const display = normalize(plugin.displayName);
  if (!target) return 0;

  if (target === name || target === display) return 100;
  if (name.includes(target) || display.includes(target)) return 90;

  const keywordsByLabel: Record<string, string[]> = kind === "theme"
    ? {
        lifetheme: ["life"],
        vanillatheme: ["vanilla"],
        customtheme: ["custom"]
      }
    : {
        lifemenu: ["life"],
        overviewmenu: ["overview"],
        boxmenu: ["box"]
      };

  const keywords = keywordsByLabel[target] || [];
  if (!keywords.length) return 0;

  const hitCount = keywords.filter((k) => name.includes(k) || display.includes(k)).length;
  return hitCount ? 70 + hitCount : 0;
}

function resolvePluginId(options: EnginePluginType[], label: string, kind: "theme" | "menu"): string | null {
  const target = normalize(label);
  let best: { id: string; score: number } | null = null;
  let bestOption: EnginePluginType | null = null;
  for (const option of options) {
    const score = scorePluginMatch(option, label, kind);
    if (!option._id || score <= 0) continue;

    if (!best || score > best.score) {
      best = { id: option._id, score };
      bestOption = option;
      continue;
    }

    if (kind === "theme" && target === "lifetheme" && best && score === best.score && bestOption) {
      const curName = normalize(bestOption.name);
      const curDisplay = normalize(bestOption.displayName);
      const curTheme = normalize(bestOption.theme);
      const nextName = normalize(option.name);
      const nextDisplay = normalize(option.displayName);
      const nextTheme = normalize(option.theme);

      const curIsV2 = curName.includes("v2") || curDisplay.includes("v2") || curTheme.includes("v2") || curDisplay.includes("alpha");
      const nextIsV2 = nextName.includes("v2") || nextDisplay.includes("v2") || nextTheme.includes("v2") || nextDisplay.includes("alpha");

      if (curIsV2 && !nextIsV2) {
        best = { id: option._id, score };
        bestOption = option;
      }
    }
  }
  return best?.id ?? null;
}

async function getThemeTypes(): Promise<EnginePluginType[]> {
  const rows = await apiClient.get<EnginePluginType[]>("/api/themetype");
  return Array.isArray(rows) ? rows : [];
}

async function getMenuTypes(): Promise<EnginePluginType[]> {
  const rows = await apiClient.get<EnginePluginType[]>("/api/menutype");
  return Array.isArray(rows) ? rows : [];
}

function toOptionLabel(row: EnginePluginType): string {
  return (row.displayName || row.name || "").trim();
}

export async function getAuthoringThemeOptions(): Promise<string[]> {
  const rows = await getThemeTypes();
  return rows.map(toOptionLabel).filter(Boolean);
}

export async function getAuthoringMenuOptions(): Promise<string[]> {
  const rows = await getMenuTypes();
  return rows.map(toOptionLabel).filter(Boolean);
}

async function applyThemeToCourse(courseId: string, themeId: string): Promise<void> {
  await apiClient.post(`/api/theme/${themeId}/makeitso/${courseId}`);
}

/** Resolve a theme label (e.g. "Custom Theme") to its plugin ID and apply it to the course. */
export async function saveThemeForCourse(courseId: string, themeLabel: string): Promise<void> {
  const themes = await getThemeTypes();
  const themeId = resolvePluginId(themes, themeLabel, "theme");
  if (themeId) await applyThemeToCourse(courseId, themeId);
}

/** Persist themeVariables into course.themeVariables via PUT /api/content/course/:id */
export async function saveThemeVariables(
  courseId: string,
  themeVariables: Record<string, unknown>
): Promise<void> {
  await apiClient.put(`/api/content/course/${courseId}`, { themeVariables });
}

/** Fetch all theme presets (optionally filter by parentTheme slug). */
export async function getThemePresets(parentTheme?: string): Promise<ThemePreset[]> {
  try {
    const rows = await apiClient.get<ThemePreset[]>("/api/themepreset");
    const all = Array.isArray(rows) ? rows : [];
    if (!parentTheme) return all;
    return all.filter((p) => p.parentTheme === parentTheme);
  } catch {
    return [];
  }
}

/** Save a new preset for the current theme. */
export async function saveThemePreset(
  displayName: string,
  parentTheme: string,
  properties: Record<string, unknown>
): Promise<ThemePreset> {
  return apiClient.post<ThemePreset>("/api/themepreset", { displayName, parentTheme, properties });
}

/** Apply an existing preset to the course. */
export async function applyThemePreset(presetId: string, courseId: string): Promise<void> {
  await apiClient.post(`/api/themepreset/${presetId}/makeitso/${courseId}`);
}

async function applyMenuToCourse(courseId: string, menuId: string): Promise<void> {
  await apiClient.post(`/api/menu/${menuId}/makeitso/${courseId}`);
}

async function applyCourseSelections(courseId: string, themeLabel?: string, menuLabel?: string): Promise<void> {
  const shouldApplyTheme = !!themeLabel?.trim();
  const shouldApplyMenu = !!menuLabel?.trim();
  if (!shouldApplyTheme && !shouldApplyMenu) return;

  const [themes, menus] = await Promise.all([
    shouldApplyTheme ? getThemeTypes() : Promise.resolve([]),
    shouldApplyMenu ? getMenuTypes() : Promise.resolve([]),
  ]);

  if (themeLabel) {
    const themeId = resolvePluginId(themes, themeLabel, "theme");
    if (themeId) {
      await applyThemeToCourse(courseId, themeId);
    }
  }

  if (menuLabel) {
    const menuId = resolvePluginId(menus, menuLabel, "menu");
    if (menuId) {
      await applyMenuToCourse(courseId, menuId);
    }
  }
}

export async function createCourse(input: CreateCourseInput): Promise<CreatedCourse> {
  const created = await apiClient.post<CreatedCourse>("/api/courses", input);
  try {
    await applyCourseSelections(created.id, input.theme, input.menuStyle);
  } catch (err) {
    console.warn("Failed to apply theme/menu selections", err);
  }
  return created;
}

export async function getCourseBootstrapData(courseId: string): Promise<CourseBootstrapData> {
  const [course, config] = await Promise.all([
    apiClient.get<EngineCourseDetails>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails>(`/api/content/config/${courseId}`),
  ]);

  return {
    courseId,
    title: course.displayTitle || course.title || "Untitled Course",
    description: course.description || "",
    themeName: config._theme || "",
    menuName: config._menu || "",
    themeVariables: (course.themeVariables as Record<string, unknown>) || {},
    themePresetId: config._themePreset || "",
  };
}

// ── Course structure (modules / topics / sections / content groups / components)
// The Course Structure screen maps the real Adapt content hierarchy onto a
// 5-level model (see src/types/structure.ts):
//   Module        → menu contentobject (_type:'menu')
//   Topic         → page contentobject (_type:'page'; child of course or a module)
//   Section       → article
//   Content Group → block
//   Component     → component (_component / _componentType)
// Everything persists through the generic /api/content/:type CRUD routes.
import {
  LEVEL_TO_CONTENT_TYPE,
  type StructureLevel,
  type CourseStructure,
  type SModule,
  type STopic,
  type SSection,
  type SContentGroup,
  type SComponent,
} from "../types/structure";

interface EngineContentNode {
  _id: string;
  _courseId?: string;
  _parentId?: string;
  _type?: string;
  title?: string;
  displayTitle?: string;
  _sortOrder?: number;
  _component?: string;
  _componentType?: string;
  _layout?: string;
}

// A component type installed on the instance (GET /api/componenttype).
export interface ComponentTypeOption {
  component: string; // engine `_component` key, e.g. 'text'
  displayName: string;
  description: string;
  icon: string | null;
  _id: string; // componenttype ObjectId (→ component._componentType)
  version?: string; // omitted when the backend doesn't provide one
  properties: Record<string, unknown>;
}

const bySortOrder = (a: EngineContentNode, b: EngineContentNode): number =>
  (a._sortOrder ?? 0) - (b._sortOrder ?? 0);

async function getContentByCourse(
  type: string,
  courseId: string
): Promise<EngineContentNode[]> {
  const rows = await apiClient.get<EngineContentNode[]>(
    `/api/content/${type}?_courseId=${courseId}`
  );
  return Array.isArray(rows) ? rows : [];
}

// Fetch the whole course tree and assemble it into the 5-level structure model.
export async function getCourseStructure(
  courseId: string,
  courseTitle = "Course"
): Promise<CourseStructure> {
  const [contentObjects, articles, blocks, components] = await Promise.all([
    getContentByCourse("contentobject", courseId),
    getContentByCourse("article", courseId),
    getContentByCourse("block", courseId),
    getContentByCourse("component", courseId),
  ]);

  const label = (n: EngineContentNode): string =>
    n.displayTitle || n.title || "Untitled";
  const childrenOf = (rows: EngineContentNode[], parentId: string) =>
    rows.filter((r) => r._parentId === parentId).sort(bySortOrder);

  const menus = contentObjects.filter((c) => c._type === "menu");
  const pages = contentObjects.filter((c) => c._type === "page");
  const childMenus = (parentId: string) =>
    menus.filter((m) => m._parentId === parentId).sort(bySortOrder);
  const childPages = (parentId: string) =>
    pages.filter((p) => p._parentId === parentId).sort(bySortOrder);

  const buildTopic = (page: EngineContentNode): STopic => ({
    id: page._id,
    title: label(page),
    sortOrder: page._sortOrder ?? 0,
    sections: childrenOf(articles, page._id).map(
      (article): SSection => ({
        id: article._id,
        title: label(article),
        contentGroups: childrenOf(blocks, article._id).map(
          (block): SContentGroup => ({
            id: block._id,
            title: label(block),
            components: childrenOf(components, block._id).map(
              (comp): SComponent => ({
                id: comp._id,
                title: label(comp),
                componentKey: comp._component || "",
              })
            ),
          })
        ),
      })
    ),
  });

  // Menus nest recursively; each carries its child menus (sub-modules) + pages.
  const buildModule = (menu: EngineContentNode): SModule => ({
    id: menu._id,
    title: label(menu),
    sortOrder: menu._sortOrder ?? 0,
    modules: childMenus(menu._id).map(buildModule),
    topics: childPages(menu._id).map(buildTopic),
  });

  return {
    courseTitle,
    modules: childMenus(courseId).map(buildModule),
    topics: childPages(courseId).map(buildTopic),
  };
}

// ── Component types (Add Component drawer) ──────────────────────────────────
export async function getAvailableComponents(): Promise<ComponentTypeOption[]> {
  const rows = await apiClient.get<
    Array<Partial<ComponentTypeOption> & { component?: string }>
  >("/api/componenttype");
  return (Array.isArray(rows) ? rows : [])
    .filter((c) => c && c.component)
    .map((c) => ({
      component: c.component as string,
      displayName: c.displayName || (c.component as string),
      description: c.description || "",
      icon: c.icon || null,
      _id: c._id as string,
      version: c.version, // leave undefined if absent — server applies its default
      properties: c.properties || {},
    }));
}

// Merged content schemas keyed by component name (GET /api/content/schema),
// cached for the session. Used to pre-populate a new component's defaults so
// question components (e.g. mcq) get a valid _buttons sub-tree at runtime.
// Ported from adapt-preview-edit/js/contentEditView.js (fetchMergedComponentSchema).
let mergedSchemaCache: Record<string, { properties?: Record<string, unknown> }> | null = null;

async function fetchMergedComponentSchema(
  componentKey: string
): Promise<{ properties?: Record<string, unknown> } | null> {
  if (!componentKey) return null;
  try {
    if (!mergedSchemaCache) {
      mergedSchemaCache = await apiClient.get("/api/content/schema");
    }
    return mergedSchemaCache?.[componentKey] ?? null;
  } catch {
    return null;
  }
}

// Walk a schema `properties` object, producing each property's default value.
// Ported from adapt-preview-edit/js/contentEditView.js (buildSchemaDefaults).
function buildSchemaDefaults(
  schemaProperties: Record<string, unknown> | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!schemaProperties || typeof schemaProperties !== "object") return out;

  for (const key of Object.keys(schemaProperties)) {
    const prop = schemaProperties[key] as {
      type?: string;
      default?: unknown;
      properties?: Record<string, unknown>;
    };
    if (!prop || typeof prop !== "object") continue;

    if (prop.type === "object" && prop.properties) {
      let base: Record<string, unknown> = {};
      if (prop.default && typeof prop.default === "object") {
        try {
          base = JSON.parse(JSON.stringify(prop.default));
        } catch {
          base = {};
        }
      }
      const nested = buildSchemaDefaults(prop.properties);
      const merged = { ...nested, ...base }; // schema-declared default wins
      if (Object.keys(merged).length) out[key] = merged;
      continue;
    }

    if (prop.default !== undefined) {
      try {
        out[key] = JSON.parse(JSON.stringify(prop.default));
      } catch {
        out[key] = prop.default;
      }
      continue;
    }

    if (prop.type === "array") out[key] = [];
  }
  return out;
}

interface CreateContentResult { _id: string }

// _sortOrder is 1-based and appended to the end of the sibling list.
async function createContentNode(
  type: string,
  body: Record<string, unknown>
): Promise<string> {
  const res = await apiClient.post<CreateContentResult>(`/api/content/${type}`, body);
  return res._id;
}

// Module / Sub-Module = menu contentobject. `parentId` is the course (top-level
// module) or another menu (sub-module).
export function createModule(
  courseId: string,
  parentId: string,
  title: string,
  sortOrder: number
): Promise<string> {
  return createContentNode("contentobject", {
    _courseId: courseId,
    _parentId: parentId,
    _type: "menu",
    title,
    displayTitle: title,
    _sortOrder: sortOrder,
  });
}

// Topic = page contentobject; parent is the course (top-level) or a module.
export function createTopic(
  courseId: string,
  parentId: string,
  title: string,
  sortOrder: number
): Promise<string> {
  return createContentNode("contentobject", {
    _courseId: courseId,
    _parentId: parentId,
    _type: "page",
    title,
    displayTitle: title,
    _sortOrder: sortOrder,
  });
}

export function createArticle(
  courseId: string,
  parentId: string,
  title: string,
  sortOrder: number
): Promise<string> {
  return createContentNode("article", {
    _courseId: courseId,
    _parentId: parentId,
    title,
    displayTitle: title,
    _sortOrder: sortOrder,
  });
}

export function createBlock(
  courseId: string,
  parentId: string,
  title: string,
  sortOrder: number
): Promise<string> {
  return createContentNode("block", {
    _courseId: courseId,
    _parentId: parentId,
    title,
    displayTitle: title,
    _sortOrder: sortOrder,
  });
}

// Create a component of the given type inside a content group (block), applying
// schema defaults + a defensive PUT (mirrors adapt-preview-edit contentEditView).
export async function createComponent(
  courseId: string,
  blockId: string,
  componentType: ComponentTypeOption,
  sortOrder: number,
  layout: "full" | "left" | "right" = "full"
): Promise<string> {
  const merged = await fetchMergedComponentSchema(componentType.component);
  const schemaSource =
    (merged && merged.properties) || componentType.properties || {};
  const schemaDefaults = buildSchemaDefaults(
    schemaSource as Record<string, unknown>
  );

  const body: Record<string, unknown> = {
    ...schemaDefaults,
    _courseId: courseId,
    _parentId: blockId,
    _type: "component",
    _component: componentType.component,
    _componentType: componentType._id,
    _componentTypeDisplayName: componentType.displayName,
    _layout: layout,
    title: componentType.displayName,
    displayTitle: componentType.displayName,
    _sortOrder: sortOrder,
  };
  // Only send version when known; otherwise let the server's default apply.
  if (componentType.version) body.version = componentType.version;

  const id = await createContentNode("component", body);

  // Defensive: some POST handlers strip componenttype-specific fields on create;
  // re-apply the schema defaults so nested sub-trees (e.g. _buttons) persist.
  if (Object.keys(schemaDefaults).length) {
    try {
      await apiClient.put(`/api/content/component/${id}`, schemaDefaults);
    } catch {
      /* non-fatal */
    }
  }
  return id;
}

// Resolve the "text" component type (for default seeding). Cached.
let textComponentPromise: Promise<ComponentTypeOption | null> | null = null;
function getTextComponentType(): Promise<ComponentTypeOption | null> {
  if (!textComponentPromise) {
    textComponentPromise = getAvailableComponents()
      .then(
        (list) =>
          list.find((c) => c.component.toLowerCase() === "text") ?? null
      )
      .catch(() => null);
  }
  return textComponentPromise;
}

// Seed a Topic → Section → Content Group → text Component under `parentId`
// (the course, or a module). Returns the new topic id.
export async function seedDefaultTopic(
  courseId: string,
  parentId: string,
  topicTitle = "Untitled Topic",
  sortOrder = 1
): Promise<string> {
  const topicId = await createTopic(courseId, parentId, topicTitle, sortOrder);
  const articleId = await createArticle(courseId, topicId, "Untitled Section", 1);
  const blockId = await createBlock(courseId, articleId, "Untitled Content Group", 1);
  const text = await getTextComponentType();
  // A single component is placed on the left (see design).
  if (text) await createComponent(courseId, blockId, text, 1, "left");
  return topicId;
}

// Change a component's column layout (left | right | full).
export function updateComponentLayout(
  id: string,
  layout: "full" | "left" | "right"
): Promise<unknown> {
  return apiClient.put(`/api/content/component/${id}`, { _layout: layout });
}

// Fresh-course default: one top-level topic with a starter text component.
export function seedDefaultStructure(courseId: string): Promise<string> {
  return seedDefaultTopic(courseId, courseId, "Untitled Topic", 1);
}

// title == displayTitle (the two are kept in sync — see developer notes).
export function renameStructureNode(
  level: StructureLevel,
  id: string,
  title: string
): Promise<unknown> {
  return apiClient.put(`/api/content/${LEVEL_TO_CONTENT_TYPE[level]}/${id}`, {
    title,
    displayTitle: title,
  });
}

export function deleteStructureNode(level: StructureLevel, id: string): Promise<unknown> {
  return apiClient.delete(`/api/content/${LEVEL_TO_CONTENT_TYPE[level]}/${id}`);
}

// Re-parent a node (drag-and-drop across the hierarchy): set its _parentId and
// _sortOrder. The engine's generic PUT accepts a partial update.
export function moveContentNode(
  level: StructureLevel,
  id: string,
  newParentId: string,
  sortOrder: number
): Promise<unknown> {
  return apiClient.put(`/api/content/${LEVEL_TO_CONTENT_TYPE[level]}/${id}`, {
    _parentId: newParentId,
    _sortOrder: sortOrder,
  });
}

// Persist a new sibling order by re-numbering _sortOrder (1-based) for each id.
export async function reorderStructureNodes(
  level: StructureLevel,
  orderedIds: string[]
): Promise<void> {
  const type = LEVEL_TO_CONTENT_TYPE[level];
  await Promise.all(
    orderedIds.map((id, i) =>
      apiClient.put(`/api/content/${type}/${id}`, { _sortOrder: i + 1 })
    )
  );
}

function fmtDate(v?: string): string {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB"); // dd/mm/yyyy
}

// ── Users & roles ─────────────────────────────────────────────────────────────
export type RoleName = "Super Admin" | "Authenticated User" | "Course Creator";
const KNOWN_ROLES: RoleName[] = ["Super Admin", "Authenticated User", "Course Creator"];
const coerceRole = (n?: string): RoleName =>
  (KNOWN_ROLES as string[]).includes(n ?? "") ? (n as RoleName) : "Authenticated User";

export interface AdaptRole { _id: string; name: string }

export interface DashboardUser {
  id: number;
  backendId: string;
  email: string;
  tenant: string;
  role: RoleName;
  roleIds: string[];
  failedLogins: number;
  lastAccess: string;
}

interface EngineUser {
  _id: string;
  email?: string;
  roles?: Array<{ _id: string; name: string }>;
  _tenantId?: { name?: string } | string | null;
  failedLoginCount?: number;
  lastAccess?: string;
}

export async function getRoles(): Promise<AdaptRole[]> {
  const roles = await apiClient.get<AdaptRole[]>("/api/role");
  return Array.isArray(roles) ? roles : [];
}

export async function getUsers(): Promise<DashboardUser[]> {
  const docs = await apiClient.get<EngineUser[]>("/api/user");
  return (Array.isArray(docs) ? docs : []).map((u, i) => {
    const roles = Array.isArray(u.roles) ? u.roles : [];
    const tenant = u._tenantId && typeof u._tenantId === "object" ? u._tenantId.name ?? "" : "";
    return {
      id: i + 1,
      backendId: u._id,
      email: u.email ?? "",
      tenant: tenant || "master",
      role: coerceRole(roles[0]?.name),
      roleIds: roles.map((r) => r._id),
      failedLogins: u.failedLoginCount ?? 0,
      lastAccess: fmtDate(u.lastAccess),
    };
  });
}

// Change a user's role: unassign existing roles, then assign the chosen one.
export async function setUserRole(
  userBackendId: string,
  currentRoleIds: string[],
  newRole: RoleName
): Promise<void> {
  const roles = await getRoles();
  const target = roles.find((r) => r.name === newRole);
  if (!target) throw new Error(`Role not found: ${newRole}`);
  for (const rid of currentRoleIds) {
    if (rid !== target._id) await apiClient.post(`/api/role/${rid}/unassign/${userBackendId}`);
  }
  await apiClient.post(`/api/role/${target._id}/assign/${userBackendId}`);
}

export function deleteUser(userBackendId: string): Promise<unknown> {
  return apiClient.delete(`/api/user/${userBackendId}`);
}

// ── Templates ─────────────────────────────────────────────────────────────────
export type TemplateType = "Page" | "Article" | "Block" | "Component";
// The engine stores the template's content kind in `referenceType`
// (contentobject/article/block/component). A "contentobject" template is a Page.
const coerceTemplateType = (v?: string): TemplateType => {
  switch ((v ?? "").toLowerCase()) {
    case "contentobject":
    case "page":
      return "Page";
    case "article":
      return "Article";
    case "block":
      return "Block";
    case "component":
      return "Component";
    default:
      return "Page";
  }
};

export interface DashboardTemplate {
  id: number;
  backendId: string;
  name: string;
  type: TemplateType;
  description: string;
  timestamp: Date;
  author: string;
}

interface EngineTemplate {
  _id: string;
  title?: string;
  displayName?: string;
  name?: string;
  referenceType?: string;
  description?: string;
  createdBy?: string | { _id?: string };
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

// "mine"   → templates I created            → GET /api/my/templating
// "shared" → templates shared with me        → GET /api/shared/templating
//   (shared with everyone, or explicitly with me — mirrors /shared/course)
export type TemplateScope = "mine" | "shared";

export async function getTemplates(
  scope: TemplateScope = "mine"
): Promise<DashboardTemplate[]> {
  const endpoint = scope === "shared" ? "/api/shared/templating" : "/api/my/templating";
  const docs = await apiClient.get<EngineTemplate[]>(endpoint);
  return (Array.isArray(docs) ? docs : []).map((t, i) => ({
    id: i + 1,
    backendId: t._id,
    name: t.title || t.displayName || t.name || "Untitled",
    type: coerceTemplateType(t.referenceType),
    description: t.description || "",
    timestamp: new Date(t.updatedAt || t.createdAt || 0),
    author: t.author || "",
  }));
}

// Persist a template rename/description edit. Matches the legacy UI which PUTs
// { title, description } to the templating content endpoint.
export function updateTemplate(
  backendId: string,
  patch: { title?: string; description?: string }
): Promise<unknown> {
  return apiClient.put(`/api/content/templating/${backendId}`, patch);
}

export function deleteTemplate(backendId: string): Promise<unknown> {
  return apiClient.delete(`/api/content/templating/${backendId}`);
}

// ── Assets ────────────────────────────────────────────────────────────────────
export type AssetFormat = "image" | "audio" | "video" | "other";
const coerceFormat = (mime?: string, assetType?: string): AssetFormat => {
  const s = `${mime ?? ""} ${assetType ?? ""}`.toLowerCase();
  if (s.includes("image")) return "image";
  if (s.includes("audio")) return "audio";
  if (s.includes("video")) return "video";
  return "other";
};
const fmtSize = (bytes?: number): string => {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export interface DashboardAsset {
  id: number;
  backendId: string;
  title: string;
  description: string;
  size: string;
  format: AssetFormat;
  tags: string[];
  uploadedAt: string;
  thumbnail?: string;
}

interface EngineAsset {
  _id: string;
  title?: string;
  description?: string;
  size?: number;
  mimeType?: string;
  assetType?: string;
  tags?: Array<string | { title?: string }>;
  createdAt?: string;
}

export async function getAssets(): Promise<DashboardAsset[]> {
  const res = await apiClient.get<EngineAsset[] | { assets?: EngineAsset[] }>("/api/asset/query");
  const docs = Array.isArray(res) ? res : res?.assets ?? [];
  return docs.map((a, i) => {
    const format = coerceFormat(a.mimeType, a.assetType);
    return {
      id: i + 1,
      backendId: a._id,
      title: a.title || "Untitled",
      description: a.description || "",
      size: fmtSize(a.size),
      format,
      tags: Array.isArray(a.tags)
        ? a.tags.map((t) => (typeof t === "string" ? t : t?.title ?? "")).filter((s): s is string => !!s && !OBJECT_ID.test(s))
        : [],
      uploadedAt: fmtDate(a.createdAt),
      thumbnail: format === "image" ? `/api/asset/serve/${a._id}` : undefined,
    };
  });
}

export function trashAsset(backendId: string): Promise<unknown> {
  return apiClient.put(`/api/asset/trash/${backendId}`);
}

// ── Plugins (extension types) ─────────────────────────────────────────────────
// Read-only for now: the engine enable/disable contract is not yet defined.
export type PluginStatus = "Enabled" | "Disabled";
export type PluginCategory = "Content" | "Assessment" | "Media" | "Analytics" | "Accessibility";

export interface DashboardPlugin {
  id: number;
  backendId: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: PluginCategory;
  status: PluginStatus;
  installedDate: string;
}

interface EnginePlugin {
  _id: string;
  name?: string;
  displayName?: string;
  description?: string;
  version?: string;
  author?: string;
  _isAvailableInEditor?: boolean;
  createdAt?: string;
}

export async function getPlugins(): Promise<DashboardPlugin[]> {
  const docs = await apiClient.get<EnginePlugin[]>("/api/extensiontype");
  return (Array.isArray(docs) ? docs : []).map((p, i) => ({
    id: i + 1,
    backendId: p._id,
    name: p.displayName || p.name || "Unknown",
    description: p.description || "",
    version: p.version || "",
    author: p.author || "",
    category: "Content",
    status: p._isAvailableInEditor === false ? "Disabled" : "Enabled",
    installedDate: fmtDate(p.createdAt),
  }));
}
