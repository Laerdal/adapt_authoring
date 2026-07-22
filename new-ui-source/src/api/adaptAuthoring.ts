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
}

interface EngineCourseDetails {
  _id: string;
  title?: string;
  displayTitle?: string;
  description?: string;
}

interface EngineConfigDetails {
  _courseId?: string;
  _theme?: string;
  _menu?: string;
}

export interface CourseBootstrapData {
  courseId: string;
  title: string;
  description: string;
  themeName: string;
  menuName: string;
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
  let best: { id: string; score: number } | null = null;
  for (const option of options) {
    const score = scorePluginMatch(option, label, kind);
    if (!option._id || score <= 0) continue;
    if (!best || score > best.score) {
      best = { id: option._id, score };
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
  };
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
