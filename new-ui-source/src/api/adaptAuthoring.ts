// Adapter between the /new UI and the Adapt authoring engine's REST API.
// Maps engine endpoints/shapes to what the UI components expect. Same-origin
// cookie session is handled by ./client. This is the single integration seam:
// keep engine-specific endpoint knowledge here, not in the pages.

import { apiClient } from "./client";
export {
  TRACKING_ANALYTICS_EXTENSION_NAME_BY_KEY,
  defaultTrackingAnalyticsSettings,
  getTrackingAnalyticsSettings,
  saveTrackingAnalyticsSettings,
} from "../helpers/trackingAnalyticsHelper";
export type { TrackingAnalyticsSettings } from "../helpers/trackingAnalyticsHelper";

// ── Current user ────────────────────────────────────────────────────────────
// GET /api/user/me → the session user, enriched with rolesAsName by the engine.
export interface CurrentUser {
  _id: string;
  email: string;
  username?: string;
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

// ── User lookup ──────────────────────────────────────────────────────────────

export interface UserSummary {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Search users by partial email address within the current instance.
 * Uses GET /api/user?search[email]=... and returns up to `limit` users.
 */
export async function searchUsersByEmailQuery(query: string, limit = 8): Promise<UserSummary[]> {
  const trimmedQuery = query.trim();
  try {
    const users = trimmedQuery
      ? await apiClient.get<UserSummary[]>(
          `/api/user?search[email]=${encodeURIComponent(trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))}`
        )
      : await apiClient.get<UserSummary[]>("/api/user");
    if (!Array.isArray(users)) return [];

    const normalizedQuery = trimmedQuery.toLowerCase();
    const deduped = users.filter((user, index, array) => {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      return array.findIndex((u) => u.email?.toLowerCase() === email) === index;
    });

    return deduped
      .sort((a, b) => {
        const aEmail = a.email.toLowerCase();
        const bEmail = b.email.toLowerCase();
        const aStartsWith = aEmail.startsWith(normalizedQuery);
        const bStartsWith = bEmail.startsWith(normalizedQuery);
        if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;
        return aEmail.localeCompare(bEmail);
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Find a user by exact email address.
 * Uses GET /api/user?search[email]=... which does a case-insensitive regex search;
 * we then filter client-side for an exact match.
 * Returns null if no user found or on error.
 */
export async function findUserByEmail(email: string): Promise<UserSummary | null> {
  try {
    // Escape regex metacharacters before the backend uses this value in new RegExp().
    // encodeURIComponent alone does not escape chars like ( ) . * + ? [ { \ ^ $ |
    // which would cause the server's RegExp constructor to throw or enable ReDoS.
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await apiClient.get<UserSummary[]>(
      `/api/user?search[email]=${encodeURIComponent(escapedEmail)}`
    );
    if (!Array.isArray(users)) return null;
    return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch a single user by their ObjectId.
 * Uses GET /api/user/:id
 */
export async function getUserById(userId: string): Promise<UserSummary | null> {
  try {
    const user = await apiClient.get<UserSummary>(`/api/user/${userId}`);
    return user ?? null;
  } catch {
    return null;
  }
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
    displayTitle?: string;
    subtitle?: string;
    description?: string;
    body?: string;
    heroAssetId?: string | null;
    tags?: string[];
    isShared?: boolean;
    shareWithUserIds?: string[];
    language?: string;
  }
): Promise<unknown> {
  const updateData: Record<string, unknown> = {};
  if (patch.title !== undefined) updateData.title = patch.title;
  if (patch.displayTitle !== undefined) updateData.displayTitle = patch.displayTitle;
  if (patch.subtitle !== undefined) {
    updateData.subtitle = patch.subtitle;
    updateData._subtitle = patch.subtitle;
  }
  // Keep title and displayTitle in sync when only one is provided
  if (patch.title !== undefined && patch.displayTitle === undefined && patch.subtitle === undefined) {
    updateData.displayTitle = patch.title;
  }
  if (patch.description !== undefined) updateData.description = patch.description;
  if (patch.body !== undefined) updateData.body = patch.body;
  if (patch.heroAssetId !== undefined) updateData.heroImage = patch.heroAssetId;
  if (patch.tags !== undefined) {
    updateData.tags = await resolveOrCreateTagIds(patch.tags);
  }
  if (patch.isShared !== undefined) updateData._isShared = patch.isShared;
  if (patch.shareWithUserIds !== undefined) updateData._shareWithUsers = patch.shareWithUserIds;

  const coursePromise = apiClient.put(`/api/content/course/${backendId}`, updateData);

  // _defaultLanguage lives on the config document — fetch it by courseId to get its _id
  if (patch.language !== undefined) {
    const config = await apiClient.get<EngineConfigDetails>(`/api/content/config/${backendId}`);
    if (config._id) {
      await apiClient.put(`/api/content/config/${config._id}`, {
        _courseId: backendId,
        _defaultLanguage: patch.language,
      });
    }
  }

  return coursePromise;
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
  subtitle?: string;
  _subtitle?: string;
  description?: string;
  body?: string;
  heroImage?: string | null;
  tags?: Array<string | { _id: string; title?: string }>;
  _isShared?: boolean;
  _shareWithUsers?: string[];
  themeVariables?: Record<string, unknown>;
  _themePreset?: string;
  menuSettings?: CourseMenuSettings;
}

interface EngineConfigDetails {
  _id?: string;
  _courseId?: string;
  _theme?: string;
  _menu?: string;
  _themePreset?: string;
  _defaultLanguage?: string;
  // Map of installed extensions, keyed by the plugin's bower `extension` field
  // (e.g. "course-menu"); each entry carries the full bower `name`.
  _enabledExtensions?: Record<string, { _id: string; name: string; version?: string; targetAttribute?: string }>;
  // Config-location extension settings (enable toggles etc.).
  _extensions?: Record<string, unknown>;
}

export interface CourseBootstrapData {
  courseId: string;
  title: string;
  displayTitle: string;
  description: string;
  body: string;
  heroAssetId: string | null;
  tags: string[];
  isShared: boolean;
  shareWithUserIds: string[];
  themeName: string;
  menuName: string;
  themeVariables: Record<string, unknown>;
  themePresetId: string;
  language: string;
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

function resolveBestPluginOption(options: EnginePluginType[], label: string, kind: "theme" | "menu"): EnginePluginType | null {
  let best: { score: number; option: EnginePluginType } | null = null;

  for (const option of options) {
    const score = scorePluginMatch(option, label, kind);
    if (score <= 0) continue;

    if (!best || score > best.score) {
      best = { score, option };
    }
  }

  return best?.option ?? null;
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

export interface ThemePreset {
  _id: string;
  displayName: string;
  parentTheme: string;
  properties: Record<string, unknown>;
}

// Applies a theme plugin to the course by resolving human-readable theme label.
export async function saveThemeForCourse(courseId: string, themeLabel: string): Promise<void> {
  const themes = await getThemeTypes();
  const themeId = resolvePluginId(themes, themeLabel, "theme");
  if (themeId) {
    await applyThemeToCourse(courseId, themeId);
  }
}

// Returns the legacy parentTheme key used by preset APIs.
export async function getThemePresetParentTheme(themeLabel: string): Promise<string | null> {
  const themes = await getThemeTypes();
  const bestTheme = resolveBestPluginOption(themes, themeLabel, "theme");
  if (!bestTheme) return null;
  return bestTheme.theme || null;
}

export async function saveThemeVariables(
  courseId: string,
  themeVariables: Record<string, unknown>
): Promise<void> {
  await apiClient.put(`/api/content/course/${courseId}`, { themeVariables });
}

export async function getThemePresets(parentTheme?: string): Promise<ThemePreset[]> {
  try {
    const rows = await apiClient.get<ThemePreset[]>("/api/content/themepreset");
    const all = Array.isArray(rows) ? rows : [];
    if (!parentTheme) return all;
    return all.filter((preset) => preset.parentTheme === parentTheme);
  } catch {
    return [];
  }
}

export async function saveThemePreset(
  displayName: string,
  parentTheme: string,
  properties: Record<string, unknown>
): Promise<ThemePreset> {
  return apiClient.post<ThemePreset>("/api/content/themepreset", { displayName, parentTheme, properties });
}

export async function applyThemePreset(presetId: string, courseId: string): Promise<void> {
  await apiClient.post(`/api/themepreset/${presetId}/makeitso/${courseId}`);
}

export async function renameThemePreset(presetId: string, displayName: string): Promise<void> {
  await apiClient.put(`/api/content/themepreset/${presetId}`, { displayName });
}

export async function deleteThemePreset(presetId: string): Promise<void> {
  await apiClient.delete(`/api/content/themepreset/${presetId}`);
}

async function applyThemeToCourse(courseId: string, themeId: string): Promise<void> {
  await apiClient.post(`/api/theme/${themeId}/makeitso/${courseId}`);
}

async function applyMenuToCourse(courseId: string, menuId: string): Promise<void> {
  await apiClient.post(`/api/menu/${menuId}/makeitso/${courseId}`);
}

export async function applyMenuSelectionToCourse(courseId: string, menuLabel: string): Promise<void> {
  const label = (menuLabel || "").trim();
  if (!label) return;
  const menus = await getMenuTypes();
  const menuId = resolvePluginId(menus, label, "menu");
  if (!menuId) return;
  await applyMenuToCourse(courseId, menuId);
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
    await seedDefaultStructure(created.id);
  } catch (err) {
    console.warn("Failed to seed default course structure", err);
  }

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

  const rawHero = course.heroImage ?? null;
  const heroAssetId = rawHero && OBJECT_ID.test(rawHero) ? rawHero : null;
  const tags = Array.isArray(course.tags)
    ? course.tags
        .map((t) => (typeof t === "string" ? t : t?.title ?? ""))
        .filter((s): s is string => !!s && !OBJECT_ID.test(s))
    : [];

  return {
    courseId,
    title: course.title || "Untitled Course",
    displayTitle: course.subtitle ?? course._subtitle ?? course.displayTitle ?? "",
    description: course.description || "",
    body: course.body || "",
    heroAssetId,
    tags,
    isShared: course._isShared ?? false,
    shareWithUserIds: Array.isArray(course._shareWithUsers)
      ? course._shareWithUsers.filter((id): id is string => typeof id === "string")
      : [],
    themeName: config._theme || "",
    menuName: config._menu || "",
    themeVariables: (course.themeVariables as Record<string, unknown>) || {},
    themePresetId: config._themePreset || "",
    language: config._defaultLanguage || "",
  };
}

// ── Navigation Settings ───────────────────────────────────────────────────────
// The Adapt Studio "Navigation" panel edits a mix of CORE course fields and three
// togglable extensions, spread across two engine documents:
//   • course._start / course._lockType / course._navigation            (core)
//   • course._extensions._topbarLogos._items                            (adapt-topbar-logos)
//   • course._extensions._navigationFooter.*                            (adapt-navigation-footer)
//   • config._extensions._courseMenu.*                                  (adapt-course-menu)
//   • config._extensions._{topbarLogos,navigationFooter}._isEnabled     (enable toggles)
// Config is retrieved by courseId (the config plugin swaps :id→_courseId on read)
// but UPDATED by its own _id (only `retrieve` is overridden server-side), so we
// PUT config to `/api/content/config/<config._id>`.
// Extensions are auto-installed on demand via POST /api/extension/enable/:courseId.
//
// "Installed" detection: config._enabledExtensions is keyed by the plugin's bower
// `extension` field ("course-menu", not "_courseMenu"), and each entry stores the
// full bower `name`. We match on `name` so we don't depend on the exact key format.

const EXTENSION_NAME_BY_KEY: Record<string, string> = {
  _courseMenu: "adapt-course-menu",
  _topbarLogos: "adapt-topbar-logos",
  _navigationFooter: "adapt-navigation-footer",
};

function isExtensionInstalled(config: EngineConfigDetails, extensionName: string): boolean {
  const map = config._enabledExtensions ?? {};
  return Object.values(map).some((e) => e && e.name === extensionName);
}

export interface NavStartId {
  _id: string;
  _skipIfComplete: boolean;
  _className: string;
}

export interface NavFooterButton {
  _isEnabled: boolean;
  btnText: string;
  _classes: string;
}

export type NavFooterButtonKey = "_home" | "_up" | "_previous" | "_next" | "_close" | "_custom";

export interface NavigationSettings {
  start: {
    _isEnabled: boolean;
    _startIds: NavStartId[];
    _force: boolean;
    _isMenuDisabled: boolean;
  };
  lockType: "" | "custom" | "lockLast" | "sequential" | "unlockFirst";
  courseMenu: {
    enabled: boolean;
    includeSubmenuInNavigation: boolean;
  };
  headerLogo: {
    enabled: boolean;
    src: string;
    tooltip: string;
  };
  navigation: {
    isDefaultNavigationDisabled: boolean;
    navigationAlignment: "top" | "bottom";
    isBottomOnTouchDevices: boolean;
    showLabel: boolean;
    showLabelAtWidth: "any" | "small" | "medium" | "large";
    labelPosition: "auto" | "top" | "bottom" | "left" | "right";
  };
  navFooter: {
    enabled: boolean;
    footerText: string;
    btnNotifyPopupText: string;
    isLogicalBackNavigation: boolean;
    includeSubmenuInNavigation: boolean;
    buttons: Record<NavFooterButtonKey, NavFooterButton>;
  };
}

// Schema defaults for the six footer buttons (adapt-navigation-footer/properties.schema).
function defaultFooterButtons(): Record<NavFooterButtonKey, NavFooterButton> {
  return {
    _home: { _isEnabled: true, btnText: "", _classes: "" },
    _up: { _isEnabled: true, btnText: "Up", _classes: "btn-secondary" },
    _previous: { _isEnabled: true, btnText: "Previous", _classes: "btn-secondary" },
    _next: { _isEnabled: true, btnText: "Next", _classes: "" },
    _close: { _isEnabled: false, btnText: "Close", _classes: "" },
    _custom: { _isEnabled: false, btnText: "Custom", _classes: "" },
  };
}

export function defaultNavigationSettings(): NavigationSettings {
  return {
    start: { _isEnabled: false, _startIds: [], _force: false, _isMenuDisabled: false },
    lockType: "",
    courseMenu: { enabled: false, includeSubmenuInNavigation: false },
    headerLogo: { enabled: false, src: "", tooltip: "" },
    navigation: {
      isDefaultNavigationDisabled: false,
      navigationAlignment: "top",
      isBottomOnTouchDevices: false,
      showLabel: false,
      showLabelAtWidth: "medium",
      labelPosition: "auto",
    },
    navFooter: {
      enabled: false,
      footerText: "",
      btnNotifyPopupText: "Need to complete current page",
      isLogicalBackNavigation: false,
      includeSubmenuInNavigation: false,
      buttons: defaultFooterButtons(),
    },
  };
}

// Pages (page-type contentobjects) for the Start-page picker.
export interface CoursePageOption {
  id: string;
  title: string;
}

export async function getCoursePages(courseId: string): Promise<CoursePageOption[]> {
  const rows = await apiClient.get<EngineContentNode[]>(`/api/content/contentobject?_courseId=${courseId}`);
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r._type === "page")
    .sort(bySortOrder)
    .map((r) => ({ id: r._id, title: r.displayTitle || r.title || "Untitled Page" }));
}

type AnyRecord = Record<string, unknown>;
function obj(v: unknown): AnyRecord {
  return v && typeof v === "object" ? (v as AnyRecord) : {};
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export async function getNavigationSettings(courseId: string): Promise<NavigationSettings> {
  const [course, config] = await Promise.all([
    apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
  ]);

  const d = defaultNavigationSettings();
  const courseExt = obj(course._extensions);
  const cfgExt = obj(config._extensions);

  // Start settings (core)
  const start = obj(course._start);
  const startIds = Array.isArray(start._startIds) ? (start._startIds as AnyRecord[]) : [];
  d.start = {
    _isEnabled: bool(start._isEnabled, false),
    _startIds: startIds.map((it) => ({
      _id: str(it._id),
      _skipIfComplete: bool(it._skipIfComplete, false),
      _className: str(it._className),
    })),
    _force: bool(start._force, false),
    _isMenuDisabled: bool(start._isMenuDisabled, false),
  };

  // Menu lock (core)
  d.lockType = str(course._lockType) as NavigationSettings["lockType"];

  // Core navigation bar
  const nav = obj(course._navigation);
  d.navigation = {
    isDefaultNavigationDisabled: bool(nav._isDefaultNavigationDisabled, false),
    navigationAlignment: (str(nav._navigationAlignment, "top") as "top" | "bottom"),
    isBottomOnTouchDevices: bool(nav._isBottomOnTouchDevices, false),
    showLabel: bool(nav._showLabel, false),
    showLabelAtWidth: (str(nav._showLabelAtWidth, "medium") as NavigationSettings["navigation"]["showLabelAtWidth"]),
    labelPosition: (str(nav._labelPosition, "auto") as NavigationSettings["navigation"]["labelPosition"]),
  };

  // Course menu extension (config location)
  const courseMenu = obj(cfgExt._courseMenu);
  d.courseMenu = {
    enabled: isExtensionInstalled(config, EXTENSION_NAME_BY_KEY._courseMenu) && bool(courseMenu._isEnabled, true),
    includeSubmenuInNavigation: bool(courseMenu._includeSubmenuInNavigation, false),
  };

  // Header logo extension (enable in config, item in course)
  const topbarCfg = obj(cfgExt._topbarLogos);
  const topbar = obj(courseExt._topbarLogos);
  const firstLogo = Array.isArray(topbar._items) && topbar._items[0] ? obj(topbar._items[0]) : {};
  d.headerLogo = {
    enabled: isExtensionInstalled(config, EXTENSION_NAME_BY_KEY._topbarLogos) && bool(topbarCfg._isEnabled, true),
    src: str(firstLogo.src),
    tooltip: str(firstLogo.tooltip),
  };

  // Navigation footer extension (enable in config, settings in course)
  const nfCfg = obj(cfgExt._navigationFooter);
  const nf = obj(courseExt._navigationFooter);
  const toggle = obj(nf._toggleNavigation);
  const footerText = obj(nf._footerText);
  const buttons = obj(nf._buttons);
  const mergedButtons = defaultFooterButtons();
  (Object.keys(mergedButtons) as NavFooterButtonKey[]).forEach((k) => {
    const b = obj(buttons[k]);
    mergedButtons[k] = {
      _isEnabled: bool(b._isEnabled, mergedButtons[k]._isEnabled),
      btnText: str(b.btnText, mergedButtons[k].btnText),
      _classes: str(b._classes, mergedButtons[k]._classes),
    };
  });
  d.navFooter = {
    enabled: isExtensionInstalled(config, EXTENSION_NAME_BY_KEY._navigationFooter) && bool(nfCfg._isEnabled, true),
    footerText: str(footerText.text),
    btnNotifyPopupText: str(footerText._btnNotifyPopupText, "Need to complete current page"),
    isLogicalBackNavigation: bool(toggle._isLogicalBackNavigation, false),
    includeSubmenuInNavigation: bool(toggle._includeSubmenuInNavigation, false),
    buttons: mergedButtons,
  };

  return d;
}

async function resolveExtensionTypeIds(names: string[]): Promise<string[]> {
  const rows = await apiClient.get<{ _id: string; name?: string }[]>("/api/extensiontype");
  const byName = new Map((Array.isArray(rows) ? rows : []).map((r) => [r.name, r._id] as const));
  return names.map((n) => byName.get(n)).filter((x): x is string => !!x);
}

export async function saveNavigationSettings(courseId: string, s: NavigationSettings): Promise<void> {
  let course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
  let config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);

  // 1. Reconcile plugin installation with the UI toggles:
  //      ON  + not installed → enable  (create + initialize the plugin settings)
  //      OFF + installed     → disable (remove the plugin from the backend)
  const toEnable: string[] = [];
  const toDisable: string[] = [];
  const reconcile = (on: boolean, name: string) => {
    const installed = isExtensionInstalled(config, name);
    if (on && !installed) toEnable.push(name);
    else if (!on && installed) toDisable.push(name);
  };
  reconcile(s.courseMenu.enabled, EXTENSION_NAME_BY_KEY._courseMenu);
  reconcile(s.headerLogo.enabled, EXTENSION_NAME_BY_KEY._topbarLogos);
  reconcile(s.navFooter.enabled, EXTENSION_NAME_BY_KEY._navigationFooter);

  if (toEnable.length || toDisable.length) {
    if (toEnable.length) {
      const ids = await resolveExtensionTypeIds(toEnable);
      if (ids.length) await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
    }
    if (toDisable.length) {
      const ids = await resolveExtensionTypeIds(toDisable);
      if (ids.length) await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
    }
    // Re-read: enable seeds schema-default _extensions; disable removes the plugin's
    // _extensions blocks and its _enabledExtensions entry.
    course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
    config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  }
  const hasCourseMenu = isExtensionInstalled(config, EXTENSION_NAME_BY_KEY._courseMenu);
  const hasTopbarLogos = isExtensionInstalled(config, EXTENSION_NAME_BY_KEY._topbarLogos);
  const hasNavFooter = isExtensionInstalled(config, EXTENSION_NAME_BY_KEY._navigationFooter);

  // 2. Config document: merge onto existing _extensions so other plugins survive.
  const cfgExt: AnyRecord = { ...obj(config._extensions) };
  if (hasCourseMenu) {
    cfgExt._courseMenu = {
      ...obj(cfgExt._courseMenu),
      _isEnabled: s.courseMenu.enabled,
      _includeSubmenuInNavigation: s.courseMenu.includeSubmenuInNavigation,
    };
  }
  if (hasTopbarLogos) {
    cfgExt._topbarLogos = { ...obj(cfgExt._topbarLogos), _isEnabled: s.headerLogo.enabled };
  }
  if (hasNavFooter) {
    cfgExt._navigationFooter = { ...obj(cfgExt._navigationFooter), _isEnabled: s.navFooter.enabled };
  }
  if (config._id) {
    // Include _courseId: the config update's permission check (hasCoursePermission)
    // resolves the owning course from the delta; without it the check falls back to
    // the config _id as a course id, fails the lookup, and returns "not permitted".
    await apiClient.put(`/api/content/config/${config._id}`, { _courseId: courseId, _extensions: cfgExt });
  }

  // 3. Course document: core fields + course-location extension settings.
  const courseExt: AnyRecord = { ...obj(course._extensions) };
  if (hasTopbarLogos) {
    const src = s.headerLogo.src.trim();
    courseExt._topbarLogos = {
      ...obj(courseExt._topbarLogos),
      _items: src ? [{ src, tooltip: s.headerLogo.tooltip }] : [],
    };
  }
  if (hasNavFooter) {
    courseExt._navigationFooter = {
      ...obj(courseExt._navigationFooter),
      _toggleNavigation: {
        _isLogicalBackNavigation: s.navFooter.isLogicalBackNavigation,
        _includeSubmenuInNavigation: s.navFooter.includeSubmenuInNavigation,
      },
      _footerText: {
        text: s.navFooter.footerText,
        _btnNotifyPopupText: s.navFooter.btnNotifyPopupText,
      },
      _buttons: s.navFooter.buttons,
    };
  }

  await apiClient.put(`/api/content/course/${courseId}`, {
    _start: {
      _isEnabled: s.start._isEnabled,
      // Drop any entry without a page reference — a start id must point to a page.
      _startIds: s.start._startIds.filter((it) => !!it._id),
      _force: s.start._force,
      _isMenuDisabled: s.start._isMenuDisabled,
    },
    _lockType: s.lockType,
    _navigation: {
      _isDefaultNavigationDisabled: s.navigation.isDefaultNavigationDisabled,
      _navigationAlignment: s.navigation.navigationAlignment,
      _isBottomOnTouchDevices: s.navigation.isBottomOnTouchDevices,
      _showLabel: s.navigation.showLabel,
      _showLabelAtWidth: s.navigation.showLabelAtWidth,
      _labelPosition: s.navigation.labelPosition,
    },
    _extensions: courseExt,
  });
}

// ── Technical Settings ─────────────────────────────────────────────────────────
// Interfaces for course configuration and technical settings.
export interface CourseTechnicalSettings {
  _id?: string;
  _courseId?: string;
  screenSize?: {
    small?: number;
    medium?: number;
    large?: number;
    xlarge?: number;
  };
  _generateSourcemap?: boolean;
  _scrollingContainer?: {
    _isEnabled?: boolean;
    _limitToSelector?: string;
  };
  _logging?: {
    _isEnabled?: boolean;
    _level?: string;
    _console?: boolean;
    _warnFirstOnly?: boolean;
  };
  build?: {
    strictMode?: boolean;
    targets?: string;
  };
}

export interface CourseCustomStyle {
  customStyle?: string;
}

export interface CourseMenuSettingsEntry {
  _graphic?: {
    _src?: string;
    alt?: string;
  };
  _skipSubmenuView?: boolean;
  lockedNotification?: string;
  _backgroundImage?: {
    _xlarge?: string;
    _large?: string;
    _medium?: string;
    _small?: string;
  };
  _backgroundStyles?: {
    _backgroundRepeat?: string | null;
    _backgroundSize?: string | null;
    _backgroundPosition?: string | null;
  };
  _menuHeader?: {
    _displayAboveHeader?: boolean;
    _textAlignment?: {
      _title?: string;
      _subtitle?: string;
      _body?: string;
      _instruction?: string;
    };
    _backgroundImage?: {
      _xlarge?: string;
      _large?: string;
      _medium?: string;
      _small?: string;
    };
    _backgroundStyles?: {
      _backgroundRepeat?: string | null;
      _backgroundSize?: string | null;
      _backgroundPosition?: string | null;
    };
    _minimumHeights?: {
      _xlarge?: number | null;
      _large?: number | null;
      _medium?: number | null;
      _small?: number | null;
    };
  };
}

export interface CourseMenuSettings {
  _boxMenu?: CourseMenuSettingsEntry;
  _lifeMenu?: CourseMenuSettingsEntry;
  _overviewMenu?: CourseMenuSettingsEntry;
  [key: string]: CourseMenuSettingsEntry | undefined;
}

// Fetch technical settings for a course by courseId
export async function getCourseTechnicalSettings(courseId: string): Promise<CourseTechnicalSettings> {
  try {
    const result = await apiClient.get<CourseTechnicalSettings>(
      `/api/content/config/${courseId}`
    );
    return result ?? ({} as CourseTechnicalSettings);
  } catch (err) {
    console.warn("Failed to fetch technical settings", err);
    return {} as CourseTechnicalSettings;
  }
}

// Update technical settings — PATCH only changed fields, matching old authoring tool approach
export async function updateCourseTechnicalSettings(
  configId: string,
  settings: Partial<CourseTechnicalSettings>
): Promise<unknown> {
  return apiClient.patch(`/api/content/config/${configId}`, settings);
}

// Update custom CSS/LESS style in course
export async function updateCourseCustomStyle(courseId: string, customStyle: string): Promise<unknown> {
  return apiClient.put(`/api/content/course/${courseId}`, { customStyle });
}

// Fetch custom CSS/LESS from course
export async function getCourseCstyle(courseId: string): Promise<string> {
  try {
    const result = await apiClient.get<CourseCustomStyle>(`/api/content/course/${courseId}`);
    return result?.customStyle || "";
  } catch (err) {
    console.warn("Failed to fetch custom style", err);
    return "";
  }
}

export async function getCourseMenuSettings(courseId: string): Promise<CourseMenuSettings> {
  try {
    const result = await apiClient.get<EngineCourseDetails>(`/api/content/course/${courseId}`);
    return result?.menuSettings ?? {};
  } catch (err) {
    console.warn("Failed to fetch course menu settings", err);
    return {};
  }
}

export async function updateCourseMenuSettings(courseId: string, menuSettings: CourseMenuSettings): Promise<unknown> {
  return apiClient.put(`/api/content/course/${courseId}`, { menuSettings });
}

// ── Accessibility (_globals) ─────────────────────────────────────────────────
// Every accessibility text override lives in the course document's `_globals`
// object: core ARIA labels + instructions under `_accessibility`, plus per-plugin
// strings the framework injects under `_globals._extensions._<name>` and
// `_globals._components._<name>` when a plugin is installed. We read the whole
// object and write it back wholesale (a plain object, keyed exactly as stored) so
// no existing key is lost and no other subsystem (config, extensions) is touched.
export type GlobalsObject = { [key: string]: unknown };

export async function getCourseGlobals(courseId: string): Promise<GlobalsObject> {
  // Deliberately does NOT swallow errors: the Accessibility panel writes `_globals`
  // back wholesale, so if a transient fetch failure returned {} here, the next save
  // would overwrite the stored globals with defaults/empty (data loss). Let the
  // caller catch the failure and block saving until globals load successfully.
  const course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
  const g = course?._globals;
  return g && typeof g === "object" ? (g as GlobalsObject) : {};
}

export async function saveCourseGlobals(courseId: string, globals: GlobalsObject): Promise<unknown> {
  return apiClient.put(`/api/content/course/${courseId}`, { _globals: globals });
}

// ── Accessibility config (config document `_accessibility`) ──────────────────
// Distinct from the `_globals` text: the config doc holds the accessibility
// feature toggle (`_isEnabled`) and the ARIA heading levels (`_ariaLevels`).
// Loaded/saved via /api/content/config, mirroring getCourseTechnicalSettings. The
// caller passes the FULL `_accessibility` object back so unrelated flags (e.g.
// _shouldSupportLegacyBrowsers) are preserved regardless of merge semantics.
export interface AccessibilityConfigResult {
  configId: string | null;
  accessibility: Record<string, unknown>;
}

export async function getAccessibilityConfig(courseId: string): Promise<AccessibilityConfigResult> {
  try {
    const cfg = await apiClient.get<AnyRecord>(`/api/content/config/${courseId}`);
    const acc = cfg?._accessibility;
    return {
      configId: typeof cfg?._id === "string" ? (cfg._id as string) : null,
      accessibility: acc && typeof acc === "object" ? (acc as Record<string, unknown>) : {},
    };
  } catch (err) {
    console.warn("Failed to fetch accessibility config", err);
    return { configId: null, accessibility: {} };
  }
}

export async function saveAccessibilityConfig(
  configId: string,
  courseId: string,
  accessibility: Record<string, unknown>
): Promise<unknown> {
  // Include _courseId so the config permission check can resolve the owning course
  // (same requirement as updateCourseTechnicalSettings / the navigation config PUT).
  return apiClient.patch(`/api/content/config/${configId}`, {
    _id: configId,
    _courseId: courseId,
    _accessibility: accessibility,
  });
}

interface CourseAssetRecord {
  _id: string;
  _fieldName?: string;
  _assetId?: string;
}

export async function getCourseAssetMappings(courseId: string): Promise<Record<string, string>> {
  const records = await apiClient.get<CourseAssetRecord[]>(
    `/api/content/courseasset?_contentTypeId=${encodeURIComponent(courseId)}&_contentType=course`
  );

  if (!Array.isArray(records)) return {};

  const mappings: Record<string, string> = {};
  for (const record of records) {
    if (!record?._fieldName || !record?._assetId) continue;
    mappings[record._fieldName] = record._assetId;
  }
  return mappings;
}

export async function createCourseAssetMapping(courseId: string, fieldName: string, assetId: string): Promise<void> {
  await apiClient.post("/api/content/courseasset", {
    _courseId: courseId,
    _contentType: "course",
    _contentTypeId: courseId,
    _fieldName: fieldName,
    _assetId: assetId,
    _contentTypeParentId: courseId,
  });
}

export async function removeCourseAssetMappings(courseId: string, fieldName: string): Promise<void> {
  const records = await apiClient.get<CourseAssetRecord[]>(
    `/api/content/courseasset?_contentTypeId=${encodeURIComponent(courseId)}&_contentType=course&_fieldName=${encodeURIComponent(fieldName)}`
  );

  if (!Array.isArray(records) || records.length === 0) return;

  await Promise.all(
    records
      .filter((r): r is CourseAssetRecord & { _id: string } => !!r?._id)
      .map((r) => apiClient.delete(`/api/content/courseasset/${r._id}`))
  );
}

// Tracking/analytics helpers and API calls live in src/helpers/trackingAnalyticsHelper.ts.

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

// ── Accessibility globals defaults (schema-seeded) ──────────────────────────
// A freshly created course has no `_globals` persisted yet; the legacy settings
// form still shows every field because it applies the course schema defaults.
// Mirror that here: seed from `/api/content/schema` (course._globals, which the
// server builds with core + per-plugin globals merged in) and overlay the stored
// values, so all Global/Extensions/Components strings are visible and editable —
// and get persisted on the next save.
function deepMergeGlobals(base: GlobalsObject, override: GlobalsObject): GlobalsObject {
  const out: GlobalsObject = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = out[k];
    if (v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object" && !Array.isArray(b)) {
      out[k] = deepMergeGlobals(b as GlobalsObject, v as GlobalsObject);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function getGlobalsDefaults(): Promise<GlobalsObject> {
  try {
    if (!mergedSchemaCache) {
      mergedSchemaCache = await apiClient.get("/api/content/schema");
    }
    // The filtered course schema exposes `_globals` directly; guard the alternate
    // `.properties._globals` shape too, in case the server response changes.
    const courseSchema = (mergedSchemaCache as Record<string, unknown> | null)?.course as
      | {
          _globals?: { properties?: Record<string, unknown> };
          properties?: { _globals?: { properties?: Record<string, unknown> } };
        }
      | undefined;
    const globalsNode = courseSchema?._globals ?? courseSchema?.properties?._globals;
    return buildSchemaDefaults(globalsNode?.properties) as GlobalsObject;
  } catch (err) {
    console.warn("Failed to fetch globals schema defaults", err);
    return {};
  }
}

// Course `_globals` prepared for editing: schema defaults as the base, the stored
// course values overlaid on top (stored wins). This is what the Accessibility
// panel loads so a never-saved course still shows the full field set.
export async function getCourseGlobalsMerged(courseId: string): Promise<GlobalsObject> {
  const [stored, defaults] = await Promise.all([getCourseGlobals(courseId), getGlobalsDefaults()]);
  return deepMergeGlobals(defaults, stored);
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
