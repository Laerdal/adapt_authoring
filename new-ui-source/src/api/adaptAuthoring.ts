// Adapter between the /new UI and the Adapt authoring engine's REST API.
// Maps engine endpoints/shapes to what the UI components expect. Same-origin
// cookie session is handled by ./client. This is the single integration seam:
// keep engine-specific endpoint knowledge here, not in the pages.

import { apiClient } from "./client";
import {
  buildGraphicField,
  buildImageAsMedia,
  buildMediaField,
  classifyLaerdalMedia,
  filenameFromLink,
  imageFromGraphic,
  imageFromMediaPoster,
  LAERDAL_MEDIA_COMPONENT,
  mediaFromComponent,
  mergeProperties,
  resolveAssetUrl,
  type ImageData,
  type MediaData,
} from "@/components/storyboard/mediaMapping";
import { reverseKind, isAssessmentComponentKind } from "./componentMapping";
import { parseAssessmentData, type AssessmentKind } from "@/types/storyboard";
export {
  TRACKING_ANALYTICS_EXTENSION_NAME_BY_KEY,
  defaultTrackingAnalyticsSettings,
  getTrackingAnalyticsSettings,
  saveTrackingAnalyticsSettings,
} from "../helpers/trackingAnalyticsHelper";
export type { TrackingAnalyticsSettings } from "../helpers/trackingAnalyticsHelper";
import {
  NEW_CONTENT_GROUP_TITLE,
  NEW_SECTION_TITLE,
  NEW_TOPIC_TITLE,
} from "../constants/structureDefaults";

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

export type AssetKind = "image" | "audio" | "video" | "h5p";

// Query assets of a given kind from the engine asset manager.
// GET /api/asset/query?search[mimeType]=<kind>
// H5P is a `.h5p` (zip) file — the DAM stores those under the generic
// `application/…` mimetypes rather than a well-known prefix. So for `h5p` we
// query WITHOUT the mimeType filter and narrow to .h5p files client-side.
export async function queryAssets(kind: AssetKind, search?: string): Promise<Asset[]> {
  const params = new URLSearchParams();
  if (kind !== "h5p") params.append("search[mimeType]", kind);
  if (search) params.append("search[title]", search);
  try {
    const result = await apiClient.get<Asset[]>(`/api/asset/query?${params}`);
    const list = Array.isArray(result) ? result : [];
    if (kind === "h5p") {
      return list.filter((a) => /\.h5p$/i.test(a.filename || a.title || ""));
    }
    return list;
  } catch {
    return [];
  }
}

// Query image assets (back-compat wrapper used by the cover-image picker).
export async function queryImages(search?: string): Promise<Asset[]> {
  return queryAssets("image", search);
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
    instruction?: string;
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
  if (patch.instruction !== undefined) updateData.instruction = patch.instruction;
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
  instruction?: string;
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
  subtitle: string;
  description: string;
  instruction: string;
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
    displayTitle: course.displayTitle ?? "",
    subtitle: course.subtitle ?? course._subtitle ?? "",
    description: course.description || "",
    instruction: course.instruction ?? "",
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
  _completionCriteria?: {
    _requireContentCompleted?: boolean;
    _requireAssessmentCompleted?: boolean;
    _submitOnEveryAssessmentAttempt?: boolean;
    _shouldSubmitScore?: boolean;
  };
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

export interface CourseCompletionNotifier {
  _isEnabled?: boolean;
  _message?: {
    line1?: string;
    line2?: string;
  };
  ariaLabel?: string;
  _ariaLabel?: string;
  [key: string]: unknown;
}

const COMPLETION_NOTIFIER_EXTENSION_NAME = "adapt-completion-notifier";

export async function getCourseCompletionNotifier(courseId: string): Promise<CourseCompletionNotifier> {
  const course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
  const rootNotifier = obj(course._completionNotifier);
  const extensionNotifier = obj(obj(course._extensions)._completionNotifier);
  const notifier = Object.keys(extensionNotifier).length ? extensionNotifier : rootNotifier;
  return notifier as CourseCompletionNotifier;
}

export async function saveCourseCompletionNotifier(
  courseId: string,
  completionNotifier: CourseCompletionNotifier,
): Promise<unknown> {
  const course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
  const config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  const courseExtensions = {
    ...obj(course._extensions),
    _completionNotifier: completionNotifier,
  };

  // Old UI extension editor binds to config model values; keep notifier message
  // mirrored on config._completionNotifier for cross-UI parity.
  const configNotifier = {
    ...obj(config._completionNotifier),
    ...completionNotifier,
    _message: {
      ...obj(obj(config._completionNotifier)._message),
      ...obj(completionNotifier._message),
    },
  };

  const configExtensions = obj(config._extensions);
  const configExtensionNotifier = {
    ...obj(configExtensions._completionNotifier),
    ...completionNotifier,
    _isEnabled: bool(obj(configExtensions._completionNotifier)._isEnabled, bool(completionNotifier._isEnabled, false)),
    _message: {
      ...obj(obj(configExtensions._completionNotifier)._message),
      ...obj(completionNotifier._message),
    },
  };

  await apiClient.put(`/api/content/course/${courseId}`, {
    _extensions: courseExtensions,
    _completionNotifier: completionNotifier,
  });

  return apiClient.patch(`/api/content/config/${config._id}`, {
    _id: config._id,
    _courseId: courseId,
    _completionNotifier: configNotifier,
    _extensions: {
      ...configExtensions,
      _completionNotifier: configExtensionNotifier,
    },
  });
}

export async function setCompletionNotifierEnabledInConfig(
  configId: string,
  courseId: string,
  isEnabled: boolean,
): Promise<unknown> {
  const config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  const installed = isExtensionInstalledByName(config, COMPLETION_NOTIFIER_EXTENSION_NAME);

  if (isEnabled && !installed) {
    const ids = await resolveExtensionTypeIdsByNames([COMPLETION_NOTIFIER_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
    }
  } else if (!isEnabled && installed) {
    const ids = await resolveExtensionTypeIdsByNames([COMPLETION_NOTIFIER_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
    }
  }

  return apiClient.patch(`/api/content/config/${configId}`, {
    _id: configId,
    _courseId: courseId,
    _extensions: {
      ...obj(config._extensions),
      _completionNotifier: {
        ...obj(obj(config._extensions)._completionNotifier),
        _isEnabled: isEnabled,
      },
    },
  });
}

const PAGE_LEVEL_PROGRESS_EXTENSION_NAME = "adapt-contrib-pageLevelProgress";
const LAERDAL_PAGE_LEVEL_PROGRESS_EXTENSION_NAME = "adapt-laerdal-pageLevelProgress";
const PROGRESSION_INDICATOR_EXTENSION_NAME = "adapt-progression-indicator";
const PROGRESSION_INDICATOR_EXTENSION_TARGET = "_progressionIndicator";

export type CourseProgressBarStyle = "continuous" | "compact" | "";
export type CourseProgressIndicatorKey =
  | "page-completion"
  | "course-completion"
  | "nav-bar"
  | "all-content-objects"
  | "course-level-nav-btn";
export type CourseProgressType = "pages" | "questions";
export type CourseProgressFormat = "bar" | "stepper" | "percentage";

export interface CoursePageLevelProgressSettings {
  progressBarStyle: CourseProgressBarStyle;
  progressIndicators: CourseProgressIndicatorKey[];
  progressIndicatorEnabled: boolean;
  progressIndicatorText: string;
  progressIndicatorAriaLabel: string;
  progressType: CourseProgressType;
  progressFormat: CourseProgressFormat;
}

interface CoursePageLevelProgressConfig {
  _isEnabled: boolean;
  _showPageCompletion: boolean;
  _isCompletionIndicatorEnabled: boolean;
  _isShownInNavigationBar: boolean;
  _showAtCourseLevel: boolean;
  _useCourseProgressInNavigationButton: boolean;
}

interface CourseProgressionIndicatorConfig {
  _progressionLabel: string;
  _progressionAriaLabel: string;
  _progressionType: CourseProgressType;
  _progressionFormat: CourseProgressFormat;
}

const DEFAULT_PAGE_LEVEL_PROGRESS_CONFIG: CoursePageLevelProgressConfig = {
  _isEnabled: true,
  _showPageCompletion: true,
  _isCompletionIndicatorEnabled: false,
  _isShownInNavigationBar: true,
  _showAtCourseLevel: false,
  _useCourseProgressInNavigationButton: false,
};

const DEFAULT_PROGRESSION_INDICATOR_CONFIG: CourseProgressionIndicatorConfig = {
  _progressionLabel: "",
  _progressionAriaLabel: "",
  _progressionType: "pages",
  _progressionFormat: "bar",
};

function toPageLevelProgressConfig(raw: AnyRecord): CoursePageLevelProgressConfig {
  return {
    _isEnabled: bool(raw._isEnabled, DEFAULT_PAGE_LEVEL_PROGRESS_CONFIG._isEnabled),
    _showPageCompletion: bool(raw._showPageCompletion, DEFAULT_PAGE_LEVEL_PROGRESS_CONFIG._showPageCompletion),
    _isCompletionIndicatorEnabled: bool(raw._isCompletionIndicatorEnabled, DEFAULT_PAGE_LEVEL_PROGRESS_CONFIG._isCompletionIndicatorEnabled),
    _isShownInNavigationBar: bool(raw._isShownInNavigationBar, DEFAULT_PAGE_LEVEL_PROGRESS_CONFIG._isShownInNavigationBar),
    _showAtCourseLevel: bool(raw._showAtCourseLevel, DEFAULT_PAGE_LEVEL_PROGRESS_CONFIG._showAtCourseLevel),
    _useCourseProgressInNavigationButton: bool(
      raw._useCourseProgressInNavigationButton,
      DEFAULT_PAGE_LEVEL_PROGRESS_CONFIG._useCourseProgressInNavigationButton,
    ),
  };
}

function toProgressionIndicatorConfig(raw: AnyRecord): CourseProgressionIndicatorConfig {
  const progressionType = str(raw._progressionType, DEFAULT_PROGRESSION_INDICATOR_CONFIG._progressionType);
  const progressionFormat = str(raw._progressionFormat, DEFAULT_PROGRESSION_INDICATOR_CONFIG._progressionFormat);

  return {
    _progressionLabel: str(raw._progressionLabel, DEFAULT_PROGRESSION_INDICATOR_CONFIG._progressionLabel),
    _progressionAriaLabel: str(raw._progressionAriaLabel, DEFAULT_PROGRESSION_INDICATOR_CONFIG._progressionAriaLabel),
    _progressionType: progressionType === "questions" ? "questions" : "pages",
    _progressionFormat: progressionFormat === "stepper" || progressionFormat === "percentage" ? progressionFormat : "bar",
  };
}

function indicatorsFromPageLevelProgressConfig(
  cfg: CoursePageLevelProgressConfig,
): CourseProgressIndicatorKey[] {
  const selected: CourseProgressIndicatorKey[] = [];
  if (cfg._showPageCompletion) selected.push("page-completion");
  if (cfg._isCompletionIndicatorEnabled) selected.push("course-completion");
  if (cfg._isShownInNavigationBar) selected.push("nav-bar");
  if (cfg._showAtCourseLevel) selected.push("all-content-objects");
  if (cfg._useCourseProgressInNavigationButton) selected.push("course-level-nav-btn");
  return selected;
}

function pageLevelProgressConfigFromIndicators(
  indicators: CourseProgressIndicatorKey[],
): CoursePageLevelProgressConfig {
  const selected = new Set(indicators);
  return {
    _isEnabled: true,
    _showPageCompletion: selected.has("page-completion"),
    _isCompletionIndicatorEnabled: selected.has("course-completion"),
    _isShownInNavigationBar: selected.has("nav-bar"),
    _showAtCourseLevel: selected.has("all-content-objects"),
    _useCourseProgressInNavigationButton: selected.has("course-level-nav-btn"),
  };
}

export async function getCoursePageLevelProgressSettings(
  courseId: string,
): Promise<CoursePageLevelProgressSettings> {
  const [course, config] = await Promise.all([
    apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
  ]);

  const courseExtensions = obj(course._extensions);
  const contribRaw = {
    ...obj(courseExtensions._pageLevelProgress),
    ...obj(course._pageLevelProgress),
  };
  const laerdalRaw = {
    ...obj(courseExtensions._laerdalPageLevelProgress),
    ...obj(course._laerdalPageLevelProgress),
  };
  const progressionRaw = {
    ...obj(courseExtensions[PROGRESSION_INDICATOR_EXTENSION_TARGET]),
    ...obj(course[PROGRESSION_INDICATOR_EXTENSION_TARGET]),
  };

  const globals = obj(course._globals);
  const globalExtensions = obj(globals._extensions);
  const contribGlobals = obj(globalExtensions._pageLevelProgress);
  const laerdalGlobals = obj(globalExtensions._laerdalPageLevelProgress);

  const contribCfg = toPageLevelProgressConfig(contribRaw);
  const laerdalCfg = toPageLevelProgressConfig(laerdalRaw);
  const progressionCfg = toProgressionIndicatorConfig(progressionRaw);

  const contribInstalled = isExtensionInstalledByName(config, PAGE_LEVEL_PROGRESS_EXTENSION_NAME);
  const laerdalInstalled = isExtensionInstalledByName(config, LAERDAL_PAGE_LEVEL_PROGRESS_EXTENSION_NAME);
  const progressionInstalled = isExtensionInstalledByName(config, PROGRESSION_INDICATOR_EXTENSION_NAME);
  const configRootProgression = obj((config as AnyRecord)._progressionIndicator);
  const configExtProgression = obj(obj((config as AnyRecord)._extensions)._progressionIndicator);
  const progressionEnabled = bool(
    configExtProgression._isEnabled,
    bool(configRootProgression._isEnabled, progressionInstalled),
  );

  const contribActive = contribInstalled && contribCfg._isEnabled;
  const laerdalActive = laerdalInstalled && laerdalCfg._isEnabled;

  const progressBarStyle: CourseProgressBarStyle = laerdalActive
    ? "continuous"
    : contribActive
      ? "compact"
      : laerdalInstalled
        ? "continuous"
        : contribInstalled
          ? "compact"
          : "";

  const activeConfig = progressBarStyle === "continuous" ? laerdalCfg : progressBarStyle === "compact" ? contribCfg : null;
  const activeGlobals = progressBarStyle === "continuous" ? laerdalGlobals : progressBarStyle === "compact" ? contribGlobals : {};

  const progressIndicatorText = progressionCfg._progressionLabel || str(
    activeGlobals.pageLevelProgress,
    str(activeGlobals._laerdalPageLevelProgress),
  );
  const progressIndicatorAriaLabel = progressionCfg._progressionAriaLabel || str(activeGlobals.pageLevelProgressIndicatorBar);

  return {
    progressBarStyle,
    progressIndicators: activeConfig ? indicatorsFromPageLevelProgressConfig(activeConfig) : [],
    progressIndicatorEnabled: progressionInstalled && progressionEnabled,
    progressIndicatorText,
    progressIndicatorAriaLabel,
    progressType: progressionCfg._progressionType,
    progressFormat: progressionCfg._progressionFormat,
  };
}

export async function saveCoursePageLevelProgressSettings(
  courseId: string,
  settings: CoursePageLevelProgressSettings,
): Promise<void> {
  let course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
  let config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);

  const shouldEnableLaerdal = settings.progressBarStyle === "continuous";
  const shouldEnableContrib = settings.progressBarStyle === "compact";
  const shouldEnableProgression = settings.progressIndicatorEnabled;

  const installedContrib = isExtensionInstalledByName(config, PAGE_LEVEL_PROGRESS_EXTENSION_NAME);
  const installedLaerdal = isExtensionInstalledByName(config, LAERDAL_PAGE_LEVEL_PROGRESS_EXTENSION_NAME);
  const installedProgression = isExtensionInstalledByName(config, PROGRESSION_INDICATOR_EXTENSION_NAME);

  const toEnable: string[] = [];
  const toDisable: string[] = [];
  if (shouldEnableContrib && !installedContrib) toEnable.push(PAGE_LEVEL_PROGRESS_EXTENSION_NAME);
  if (shouldEnableLaerdal && !installedLaerdal) toEnable.push(LAERDAL_PAGE_LEVEL_PROGRESS_EXTENSION_NAME);
  if (shouldEnableProgression && !installedProgression) toEnable.push(PROGRESSION_INDICATOR_EXTENSION_NAME);
  if (!shouldEnableContrib && installedContrib) toDisable.push(PAGE_LEVEL_PROGRESS_EXTENSION_NAME);
  if (!shouldEnableLaerdal && installedLaerdal) toDisable.push(LAERDAL_PAGE_LEVEL_PROGRESS_EXTENSION_NAME);
  if (!shouldEnableProgression && installedProgression) toDisable.push(PROGRESSION_INDICATOR_EXTENSION_NAME);

  if (toEnable.length) {
    const ids = await resolveExtensionTypeIdsByNames(toEnable);
    if (ids.length) {
      await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
    }
  }
  if (toDisable.length) {
    const ids = await resolveExtensionTypeIdsByNames(toDisable);
    if (ids.length) {
      await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
    }
  }

  if (toEnable.length || toDisable.length) {
    course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
    config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  }

  const contribInstalledNow = isExtensionInstalledByName(config, PAGE_LEVEL_PROGRESS_EXTENSION_NAME);
  const laerdalInstalledNow = isExtensionInstalledByName(config, LAERDAL_PAGE_LEVEL_PROGRESS_EXTENSION_NAME);
  const progressionInstalledNow = isExtensionInstalledByName(config, PROGRESSION_INDICATOR_EXTENSION_NAME);

  const sharedConfig = pageLevelProgressConfigFromIndicators(settings.progressIndicators);
  const courseExtensions = obj(course._extensions);
  const courseGlobals = obj(course._globals);
  const globalExtensions = obj(courseGlobals._extensions);

  const existingContrib = {
    ...obj(courseExtensions._pageLevelProgress),
    ...obj(course._pageLevelProgress),
  };
  const existingLaerdal = {
    ...obj(courseExtensions._laerdalPageLevelProgress),
    ...obj(course._laerdalPageLevelProgress),
  };
  const existingProgression = {
    ...obj(courseExtensions[PROGRESSION_INDICATOR_EXTENSION_TARGET]),
    ...obj(course[PROGRESSION_INDICATOR_EXTENSION_TARGET]),
  };

  const nextContrib = {
    ...existingContrib,
    ...sharedConfig,
    _isEnabled: contribInstalledNow && shouldEnableContrib,
  };
  const nextLaerdal = {
    ...existingLaerdal,
    ...sharedConfig,
    _isEnabled: laerdalInstalledNow && shouldEnableLaerdal,
  };
  const nextProgression = {
    ...existingProgression,
    _isEnabled: progressionInstalledNow && shouldEnableProgression,
    _progressionLabel: settings.progressIndicatorText,
    _progressionAriaLabel: settings.progressIndicatorAriaLabel,
    _progressionType: settings.progressType,
    _progressionFormat: settings.progressFormat,
  };

  const nextContribGlobals = {
    ...obj(globalExtensions._pageLevelProgress),
    pageLevelProgress: settings.progressIndicatorText,
    pageLevelProgressIndicatorBar: settings.progressIndicatorAriaLabel,
  };
  const nextLaerdalGlobals = {
    ...obj(globalExtensions._laerdalPageLevelProgress),
    pageLevelProgress: settings.progressIndicatorText,
    _laerdalPageLevelProgress: settings.progressIndicatorText,
    pageLevelProgressIndicatorBar: settings.progressIndicatorAriaLabel,
  };

  await apiClient.put(`/api/content/course/${courseId}`, {
    _pageLevelProgress: nextContrib,
    _laerdalPageLevelProgress: nextLaerdal,
    [PROGRESSION_INDICATOR_EXTENSION_TARGET]: nextProgression,
    _extensions: {
      ...courseExtensions,
      _pageLevelProgress: nextContrib,
      _laerdalPageLevelProgress: nextLaerdal,
      [PROGRESSION_INDICATOR_EXTENSION_TARGET]: nextProgression,
    },
    _globals: {
      ...courseGlobals,
      _extensions: {
        ...globalExtensions,
        _pageLevelProgress: nextContribGlobals,
        _laerdalPageLevelProgress: nextLaerdalGlobals,
      },
    },
  });

  const configRootProgression = obj((config as AnyRecord)._progressionIndicator);
  const configExtensions = obj((config as AnyRecord)._extensions);
  const configExtProgression = obj(configExtensions._progressionIndicator);
  const configProgression = {
    ...configRootProgression,
    _isEnabled: progressionInstalledNow && shouldEnableProgression,
  };
  const configProgressionExt = {
    ...configExtProgression,
    _isEnabled: progressionInstalledNow && shouldEnableProgression,
  };

  const configId = str((config as AnyRecord)._id, courseId);

  await apiClient.patch(`/api/content/config/${configId}`, {
    _id: configId,
    _courseId: courseId,
    _progressionIndicator: configProgression,
    _extensions: {
      ...configExtensions,
      _progressionIndicator: configProgressionExt,
    },
  });
}

const BOOKMARKING_EXTENSION_NAME = "adapt-contrib-bookmarking";

export interface CourseBookmarkingSettings {
  _isEnabled?: boolean;
  _level?: "page" | "block" | "component";
  _location?: "previous" | "furthest";
  _showPrompt?: boolean;
  _autoRestore?: boolean;
  title?: string;
  body?: string;
  _buttons?: {
    yes?: string;
    no?: string;
  };
  [key: string]: unknown;
}

function normalizePluginName(value: string): string {
  return value.trim().toLowerCase();
}

function isExtensionInstalledByName(config: EngineConfigDetails, extensionName: string): boolean {
  const target = normalizePluginName(extensionName);
  const map = config._enabledExtensions ?? {};
  return Object.values(map).some((entry) => {
    const name = typeof entry?.name === "string" ? normalizePluginName(entry.name) : "";
    return !!name && name === target;
  });
}

async function resolveExtensionTypeIdsByNames(extensionNames: string[]): Promise<string[]> {
  if (!extensionNames.length) return [];

  const rows = await apiClient.get<{ _id: string; name?: string }[]>("/api/extensiontype");
  const byName = new Map<string, string>();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row?._id || typeof row?.name !== "string") return;
    byName.set(normalizePluginName(row.name), row._id);
  });

  return extensionNames
    .map((name) => byName.get(normalizePluginName(name)))
    .filter((id): id is string => !!id);
}

export async function getCourseBookmarkingSettings(courseId: string): Promise<CourseBookmarkingSettings> {
  const course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
  const rootBookmarking = obj(course._bookmarking);
  const extensionBookmarking = obj(obj(course._extensions)._bookmarking);
  const source = {
    ...rootBookmarking,
    ...extensionBookmarking,
  };
  const buttons = {
    ...obj(rootBookmarking._buttons),
    ...obj(extensionBookmarking._buttons),
  };

  return {
    ...source,
    _isEnabled: bool(source._isEnabled, false),
    _level: str(source._level, "component") as CourseBookmarkingSettings["_level"],
    _location: str(source._location, "furthest") as CourseBookmarkingSettings["_location"],
    _showPrompt: bool(source._showPrompt, true),
    _autoRestore: bool(source._autoRestore, true),
    title: str(source.title, "Bookmarking"),
    body: str(source.body, "Would you like to continue where you left off?"),
    _buttons: {
      ...buttons,
      yes: str(buttons.yes, "Yes"),
      no: str(buttons.no, "No"),
    },
  };
}

export async function saveCourseBookmarkingSettings(
  courseId: string,
  settings: CourseBookmarkingSettings,
): Promise<void> {
  let course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
  const config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);

  const shouldEnable = bool(settings._isEnabled, false);
  const isInstalled = isExtensionInstalledByName(config, BOOKMARKING_EXTENSION_NAME);

  if (shouldEnable && !isInstalled) {
    const ids = await resolveExtensionTypeIdsByNames([BOOKMARKING_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
      course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
    }
  } else if (!shouldEnable && isInstalled) {
    const ids = await resolveExtensionTypeIdsByNames([BOOKMARKING_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
      course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
    }
  }

  const rootBookmarking = obj(course._bookmarking);
  const extensionBookmarking = obj(obj(course._extensions)._bookmarking);
  const existingBookmarking = {
    ...rootBookmarking,
    ...extensionBookmarking,
  };
  const buttons = {
    ...obj(rootBookmarking._buttons),
    ...obj(extensionBookmarking._buttons),
  };

  const nextBookmarking: CourseBookmarkingSettings = {
    ...existingBookmarking,
    ...settings,
    _isEnabled: shouldEnable,
    _level: str(settings._level, str(existingBookmarking._level, "component")) as CourseBookmarkingSettings["_level"],
    _location: str(settings._location, str(existingBookmarking._location, "furthest")) as CourseBookmarkingSettings["_location"],
    _showPrompt: bool(settings._showPrompt, bool(existingBookmarking._showPrompt, true)),
    _autoRestore: bool(settings._autoRestore, bool(existingBookmarking._autoRestore, true)),
    title: str(settings.title, str(existingBookmarking.title, "Bookmarking")),
    body: str(settings.body, str(existingBookmarking.body, "Would you like to continue where you left off?")),
    _buttons: {
      ...buttons,
      ...obj(settings._buttons),
      yes: str(obj(settings._buttons).yes, str(buttons.yes, "Yes")),
      no: str(obj(settings._buttons).no, str(buttons.no, "No")),
    },
  };

  const courseExtensions = {
    ...obj(course._extensions),
    _bookmarking: nextBookmarking,
  };

  await apiClient.put(`/api/content/course/${courseId}`, {
    _extensions: courseExtensions,
    _bookmarking: nextBookmarking,
  });
}

// ── Estimated Time ───────────────────────────────────────────────────────────
// The `adapt-estimated-time` extension stores its settings in two places:
//   • course document `_extensions._estimatedTime` (or root `_estimatedTime`):
//       iconClass, textBefore, textAfter, moduleCompleted
//   • config document `_extensions._estimatedTime`:
//       _isEnabled, _debugEnabled, _attachTo
const ESTIMATED_TIME_EXTENSION_NAME = "adapt-estimated-time";

export interface CourseEstimatedTimeSettings {
  /** Whether the extension is enabled */
  _isEnabled: boolean;
  /** Debug mode */
  _debugEnabled: boolean;
  /** Where to place the view on the page */
  _attachTo: "" | "navigation-footer";
  /** CSS class for the clock icon */
  iconClass: string;
  /** Text displayed before the duration number */
  textBefore: string;
  /** Text displayed after the duration number (e.g. "minutes") */
  textAfter: string;
  /** Text shown when the module is completed */
  moduleCompleted: string;
}

export async function getCourseEstimatedTimeSettings(
  courseId: string,
): Promise<CourseEstimatedTimeSettings> {
  const [course, config] = await Promise.all([
    apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
  ]);

  // Course-level fields (icon + text strings)
  const courseExt = obj(obj(course._extensions)._estimatedTime);
  const courseRoot = obj(course._estimatedTime);
  const courseData = Object.keys(courseExt).length ? courseExt : courseRoot;

  // Config-level fields (enable toggles + attachTo)
  const configExt = obj(obj(config._extensions)._estimatedTime);

  const isInstalled = isExtensionInstalledByName(config, ESTIMATED_TIME_EXTENSION_NAME);

  return {
    _isEnabled: bool(configExt._isEnabled, isInstalled),
    _debugEnabled: bool(configExt._debugEnabled, false),
    _attachTo: (str(configExt._attachTo, "") as "" | "navigation-footer"),
    iconClass: str(courseData.iconClass, "icon-time"),
    textBefore: str(courseData.textBefore, "Remaining time to complete module:"),
    textAfter: str(courseData.textAfter, "minutes"),
    moduleCompleted: str(courseData.moduleCompleted, "Module completed."),
  };
}

export async function saveCourseEstimatedTimeSettings(
  courseId: string,
  settings: CourseEstimatedTimeSettings,
): Promise<void> {
  let course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
  let config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);

  const shouldEnable = settings._isEnabled;
  const isInstalled = isExtensionInstalledByName(config, ESTIMATED_TIME_EXTENSION_NAME);

  // Enable or disable the extension as needed
  if (shouldEnable && !isInstalled) {
    const ids = await resolveExtensionTypeIdsByNames([ESTIMATED_TIME_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
      course = await apiClient.get<AnyRecord>(`/api/content/course/${courseId}`);
      config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
    }
  } else if (!shouldEnable && isInstalled) {
    const ids = await resolveExtensionTypeIdsByNames([ESTIMATED_TIME_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
    }
  }

  // Save course-level data (text strings)
  const existingCourseExt = obj(obj(course._extensions)._estimatedTime);
  const nextCourseData = {
    ...existingCourseExt,
    iconClass: settings.iconClass,
    textBefore: settings.textBefore,
    textAfter: settings.textAfter,
    moduleCompleted: settings.moduleCompleted,
  };
  const courseExtensions = {
    ...obj(course._extensions),
    _estimatedTime: nextCourseData,
  };
  await apiClient.put(`/api/content/course/${courseId}`, {
    _extensions: courseExtensions,
    _estimatedTime: nextCourseData,
  });

  // Save config-level data (enable toggles + attachTo)
  const configId = config._id;
  if (configId) {
    const existingConfigExt = obj(obj(config._extensions)._estimatedTime);
    const nextConfigData = {
      ...existingConfigExt,
      _isEnabled: shouldEnable,
      _debugEnabled: settings._debugEnabled,
      _attachTo: settings._attachTo,
    };
    await apiClient.patch(`/api/content/config/${configId}`, {
      _id: configId,
      _courseId: courseId,
      _extensions: {
        ...obj(config._extensions),
        _estimatedTime: nextConfigData,
      },
    });
  }
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

// All courseasset links for a course, keyed by filename (`_fieldName`) → asset
// `_id`. Used to resolve a stored `course/assets/<filename>` reference back to a
// servable `/api/asset/serve/<id>` URL when projecting course media into the
// storyboard.
export async function getCourseAssetIdMap(courseId: string): Promise<Record<string, string>> {
  try {
    const records = await apiClient.get<CourseAssetRecord[]>(
      `/api/content/courseasset?_courseId=${encodeURIComponent(courseId)}`
    );
    if (!Array.isArray(records)) return {};
    const map: Record<string, string> = {};
    for (const r of records) {
      if (r?._fieldName && r?._assetId) map[r._fieldName] = r._assetId;
    }
    return map;
  } catch {
    return {};
  }
}

// Link a DAM asset to a specific content node's field (component-scoped
// courseasset), mirroring the legacy scaffoldAssetView contract so publish
// asset-copy resolves. `filename` is the `course/assets/<filename>` basename.
export async function linkContentAsset(
  courseId: string,
  contentType: string,
  contentId: string,
  parentId: string,
  filename: string,
  assetId: string
): Promise<void> {
  if (!filename || !assetId) return;
  try {
    // Avoid duplicate link records for the same node+field.
    const existing = await apiClient.get<CourseAssetRecord[]>(
      `/api/content/courseasset?_courseId=${encodeURIComponent(courseId)}&_contentTypeId=${encodeURIComponent(contentId)}&_fieldName=${encodeURIComponent(filename)}`
    );
    if (Array.isArray(existing) && existing.length) return;
  } catch {
    /* fall through and attempt to create */
  }
  await apiClient.post("/api/content/courseasset", {
    _courseId: courseId,
    _contentType: contentType,
    _contentTypeId: contentId,
    _fieldName: filename,
    _assetId: assetId,
    _contentTypeParentId: parentId,
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
  subtitle?: string;
  _subtitle?: string;
  body?: string;
  description?: string;
  instruction?: string;
  _sortOrder?: number;
  _component?: string;
  _componentType?: string;
  _layout?: string;
  url?: string;
  _graphic?: Record<string, unknown>;
  _media?: Record<string, unknown>;
  linkText?: string;
  duration?: string;
  _lockType?: string;
  _lockedBy?: string[];
  _classes?: string;
  _htmlClasses?: string;
  requirecompletionof?: string | number;
  requireCompletionOf?: string | number;
  _requireCompletionOf?: string | number;
  _isOptional?: boolean;
  _isAvailable?: boolean;
  _isHidden?: boolean;
  _isVisible?: boolean;
  _onScreen?: Record<string, unknown>;
  _ariaLevel?: string;
  _extensions?: Record<string, unknown>;
  themeSettings?: Record<string, unknown>;
  menuSettings?: Record<string, unknown>;
  properties?: Record<string, unknown>;
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

export async function getContentByCourse(
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
    n.title || n.displayTitle || "Untitled";
  const scalarString = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
  };
  const scalarNumber = (value: unknown, fallback: number): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  };
  const objectValue = (value: unknown): Record<string, unknown> => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Return an empty object when string values are not valid JSON.
      }
    }
    return {};
  };
  const childrenOf = (rows: EngineContentNode[], parentId: string) =>
    rows.filter((r) => r._parentId === parentId).sort(bySortOrder);

  const menus = contentObjects.filter((c) => c._type === "menu");
  const pages = contentObjects.filter((c) => c._type === "page");
  const childMenus = (parentId: string) =>
    menus.filter((m) => m._parentId === parentId).sort(bySortOrder);
  const childPages = (parentId: string) =>
    pages.filter((p) => p._parentId === parentId).sort(bySortOrder);

  const buildTopic = (page: EngineContentNode): STopic => {
    const pageGraphic = objectValue(page._graphic);
    const onScreen = objectValue(page._onScreen);

    return {
      id: page._id,
      title: label(page),
      displayTitle: page.displayTitle || "",
      sortOrder: page._sortOrder ?? 0,
      subtitle: page.subtitle || page._subtitle || "",
      body: page.body || "",
      instruction: page.instruction || "",
      description: page.description || "",
      graphic: {
        src: typeof pageGraphic?.src === "string" ? pageGraphic.src : "",
        alt: typeof pageGraphic?.alt === "string" ? pageGraphic.alt : "",
      },
      linkText: page.linkText || "",
      duration: page.duration || "",
      lockType: page._lockType || "",
      lockedBy: Array.isArray(page._lockedBy)
        ? page._lockedBy.filter((item): item is string => typeof item === "string")
        : [],
      classes: page._classes || "",
      htmlClasses: scalarString(page._htmlClasses),
      requireCompletionOf: scalarString(
        page.requirecompletionof ?? page.requireCompletionOf ?? page._requireCompletionOf ?? "-1"
      ),
      isOptional: !!page._isOptional,
      isAvailable: page._isAvailable !== false,
      isHidden: !!page._isHidden,
      isVisible: page._isVisible !== false,
      onScreen: {
        _isEnabled: !!onScreen._isEnabled,
        _classes: scalarString(onScreen._classes),
        _percentInviewVertical: scalarNumber(onScreen._percentInviewVertical, 50),
      },
      ariaLevel: scalarString(page._ariaLevel),
      extensions: objectValue(page._extensions),
      themeSettings: objectValue(page.themeSettings),
      menuSettings: objectValue(page.menuSettings),
      sections: childrenOf(articles, page._id).map(
        (article): SSection => ({
          id: article._id,
          title: label(article),
          displayTitle: article.displayTitle || "",
          description: article.body || article.description || "",
          instruction: article.instruction || "",
          themeSettings: objectValue(article.themeSettings),
          classes: article._classes || "",
          requireCompletionOf: scalarString(
            article.requirecompletionof ?? article.requireCompletionOf ?? article._requireCompletionOf ?? "-1"
          ),
          isOptional: !!article._isOptional,
          isAvailable: article._isAvailable !== false,
          isHidden: !!article._isHidden,
          isVisible: article._isVisible !== false,
          onScreen: (() => {
            const os = objectValue(article._onScreen);
            return {
              _isEnabled: !!os._isEnabled,
              _classes: scalarString(os._classes),
              _percentInviewVertical: scalarNumber(os._percentInviewVertical, 50),
            };
          })(),
          ariaLevel: scalarString(article._ariaLevel),
          extensions: objectValue(article._extensions),
          contentGroups: childrenOf(blocks, article._id).map(
            (block): SContentGroup => ({
              id: block._id,
              title: label(block),
              displayTitle: block.displayTitle || "",
              description: block.body || block.description || "",
              instruction: block.instruction || "",
              themeSettings: objectValue(block.themeSettings),
              classes: block._classes || "",
              requireCompletionOf: scalarString(
                block.requirecompletionof ?? block.requireCompletionOf ?? block._requireCompletionOf ?? "-1"
              ),
              isOptional: !!block._isOptional,
              isAvailable: block._isAvailable !== false,
              isHidden: !!block._isHidden,
              isVisible: block._isVisible !== false,
              ariaLevel: scalarString(block._ariaLevel),
              extensions: objectValue(block._extensions),
              components: childrenOf(components, block._id).map(
                (comp): SComponent => {
                  const componentProperties = objectValue(comp.properties);
                  return {
                    id: comp._id,
                    title: label(comp),
                    componentKey: comp._component || "",
                    layout: comp._layout === "left" || comp._layout === "right" || comp._layout === "full"
                      ? comp._layout
                      : undefined,
                    themeSettings: objectValue(comp.themeSettings),
                    subtitle:
                      typeof componentProperties.subtitle === "string"
                        ? (componentProperties.subtitle as string)
                        : "",
                    description: comp.body || comp.description || "",
                    instruction:
                      comp.instruction ||
                      (typeof componentProperties.instruction === "string"
                        ? (componentProperties.instruction as string)
                        : ""),
                    properties: componentProperties,
                    url: comp.url || "",
                  };
                }
              ),
            })
          ),
        })
      ),
    };
  };

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

// ── Storyboard ⇄ course content bridge (ADAPT-3760, AC4/AC11) ───────────────
// Read: project the live course hierarchy into a BlockNote document so the
// storyboard reflects the real course. Each block's `id` is set to the source
// content `_id` (a component's body paragraph uses `<id>::body`) so edits can
// be written back to the exact node. Write: update titles/bodies of existing
// nodes matched by those ids. Structural create/delete/move is deferred to the
// Phase 4 generation engine and reported (never silently dropped).

const BODY_SUFFIX = "::body";

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A BlockNote block's inline content → plain text.
function inlineToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((n) => (n && typeof (n as { text?: unknown }).text === "string" ? (n as { text: string }).text : ""))
    .join("");
}

interface StoryboardBlock {
  id?: string;
  type?: string;
  props?: { level?: number; kind?: string; title?: string; adaptComponent?: string; data?: string };
  content?: unknown;
}

export interface CourseWriteBackResult {
  updatedTitles: number;
  updatedBodies: number;
  /** Blocks in the doc with no matching course node (new structure — Phase 4). */
  unmapped: number;
}

// READ: course hierarchy → ordered BlockNote blocks (H1 Topic / H2 Section /
// H3 Content Group / H4 Component + body paragraph). Modules (menus) are
// flattened (implicit-single-Module mapping) — their pages emit as topics.
export async function getCourseStoryboardBlocks(courseId: string): Promise<unknown[]> {
  const [contentObjects, articles, blocks, components, assetIdMap] = await Promise.all([
    getContentByCourse("contentobject", courseId),
    getContentByCourse("article", courseId),
    getContentByCourse("block", courseId),
    getContentByCourse("component", courseId),
    getCourseAssetIdMap(courseId),
  ]);

  const label = (n: EngineContentNode) => n.displayTitle || n.title || "Untitled";
  // Plugin fields live under `properties`; fall back to the top level for any
  // legacy data written before that was fixed.
  const propOf = (n: EngineContentNode, key: "_graphic" | "_media") =>
    ((n.properties as Record<string, unknown> | undefined)?.[key] ?? n[key]) as Record<string, unknown> | undefined;
  const childrenOf = (rows: EngineContentNode[], parentId: string) =>
    rows.filter((r) => r._parentId === parentId).sort(bySortOrder);
  const pages = contentObjects.filter((c) => c._type === "page");
  const menus = contentObjects.filter((c) => c._type === "menu");

  const out: StoryboardBlock[] = [];

  // Graphic/media components project as rich sbComponent cards (so the chosen
  // asset renders + round-trips); every other component stays as an H4 heading
  // + body paragraph (keeps the text write-back contract intact).
  const emitMediaCard = (comp: EngineContentNode, mediaKind: "image" | "video" | "audio") => {
    if (mediaKind === "image") {
      const image = imageFromMediaPoster(propOf(comp, "_media"), assetIdMap);
      out.push({
        id: comp._id,
        type: "sbComponent",
        props: {
          kind: "image",
          title: label(comp),
          adaptComponent: LAERDAL_MEDIA_COMPONENT,
          data: JSON.stringify({ showTitle: true, description: "", instruction: "", image }),
        },
      });
      return;
    }
    const { data } = mediaFromComponent(propOf(comp, "_media"), assetIdMap);
    out.push({
      id: comp._id,
      type: "sbComponent",
      props: {
        kind: mediaKind,
        title: label(comp),
        adaptComponent: LAERDAL_MEDIA_COMPONENT,
        data: JSON.stringify({ showTitle: true, description: "", instruction: "", media: data }),
      },
    });
  };

  const emitCard = (comp: EngineContentNode, kind: string, data: Record<string, unknown>) => {
    out.push({
      id: comp._id,
      type: "sbComponent",
      props: { kind, title: label(comp), adaptComponent: comp._component || kind, data: JSON.stringify(data) },
    });
  };

  const emitComponent = (comp: EngineContentNode) => {
    const kindOf = comp._component;
    const props = (comp.properties as Record<string, unknown>) || {};
    const sbKind = reverseKind(kindOf);

    // Media (laerdal-media / contrib media) → image/video/audio, classified by
    // which `_media` fields are set.
    if (kindOf === LAERDAL_MEDIA_COMPONENT) {
      emitMediaCard(comp, classifyLaerdalMedia(propOf(comp, "_media")));
      return;
    }
    if (kindOf === "media") {
      const { kind } = mediaFromComponent(propOf(comp, "_media"), assetIdMap);
      emitMediaCard(comp, kind);
      return;
    }
    // Graphic → Image card.
    if (kindOf === "graphic") {
      const image = imageFromGraphic(propOf(comp, "_graphic"), assetIdMap);
      emitCard(comp, "image", { showTitle: true, description: "", instruction: "", image });
      return;
    }
    // Accordion / Narrative → Grouped Content card. Items round-trip via
    // `_items[].{title, body, _graphic.src}` (accept legacy `.small`).
    if (sbKind === "groupedContent") {
      const rawItems = Array.isArray(props._items) ? (props._items as Array<Record<string, unknown>>) : [];
      const items = rawItems.map((it) => {
        const g = (it._graphic as { src?: string; small?: string } | undefined) || {};
        const link = g.src || g.small || "";
        return {
          title: String(it.title || ""),
          body: stripHtml(String(it.body || "")),
          image: link, // persisted link (course/assets/<file> or external URL)
          imageUrl: resolveAssetUrl(link, assetIdMap), // servable preview
        };
      });
      emitCard(comp, "groupedContent", {
        showTitle: true,
        description: stripHtml(comp.body || ""),
        instruction: comp.instruction || "",
        items,
      });
      return;
    }
    // Assessment question components → assessment card (options + feedback).
    if (sbKind && isAssessmentComponentKind(sbKind)) {
      const data = parseAssessmentData(sbKind as AssessmentKind, props, stripHtml(comp.body || ""));
      out.push({
        id: comp._id,
        type: "sbAssessment",
        props: { kind: sbKind, title: label(comp), adaptComponent: kindOf, data: JSON.stringify(data) },
      });
      return;
    }
    // H5P and Laerdal Form → their own cards. Config round-trips so a
    // save/reopen cycle preserves the picked asset / form fields.
    if (sbKind === "h5p") {
      const external = String(props._h5pExternalAsset || "");
      const asset = String(props.h5pAsset || "");
      const link = external || asset;
      const media = link
        ? {
            asset: {
              link,
              url: external ? external : resolveAssetUrl(asset, assetIdMap),
              external: !!external,
            },
          }
        : undefined;
      emitCard(comp, "h5p", {
        showTitle: true,
        description: stripHtml(comp.body || ""),
        instruction: "",
        media,
      });
      return;
    }
    if (sbKind === "laerdalForm") {
      // Reverse of the generation mapping in storyboardGeneration.ts.
      //
      // Generation collapses UI "Dropdown" and "Checkbox" onto the same
      // backend `_inputType: "options"` because Adapt has no boolean control.
      // The two are distinguished by the shape of the `options` array:
      //   * Checkbox  → exactly one option (the yes/no marker)
      //   * Dropdown  → zero or many options
      // Without this check every Checkbox field would round-trip as a
      // Dropdown, silently changing the author's intent on reload.
      const controlFor = (t: string, opts: unknown): string => {
        switch ((t || "").toLowerCase()) {
          case "textarea":
            return "Multi-Line Text";
          case "number":
          case "range":
            return "Number";
          case "options": {
            const arr = Array.isArray(opts) ? opts : [];
            return arr.length === 1 ? "Checkbox" : "Dropdown";
          }
          default:
            return "Single-Line Text";
        }
      };
      const rawItems = Array.isArray(props._items) ? (props._items as Array<Record<string, unknown>>) : [];
      const fields = rawItems.map((it) => ({
        control: controlFor(String(it._inputType || "text"), it.options),
        label: String(it._label || ""),
        placeholder: String(it._placeholder || ""),
        mandatory: !!it._isRequired,
      }));
      emitCard(comp, "laerdalForm", {
        showTitle: true,
        description: stripHtml(comp.body || ""),
        instruction: "",
        fields,
      });
      return;
    }
    // Assessment Results → dedicated card that round-trips its bands and retry.
    if (sbKind === "assessmentResult") {
      const rawBands = Array.isArray(props._bands) ? (props._bands as Array<Record<string, unknown>>) : [];
      const retry = (props._retry as Record<string, unknown>) || {};
      emitCard(comp, "assessmentResult", {
        showTitle: true,
        description: "",
        instruction: "",
        result: {
          assessmentId: String(props._assessmentId || ""),
          completionBody: String(props._completionBody || ""),
          retryButton: String(retry.button || "Try again"),
          retryFeedback: String(retry.feedback || ""),
          bands: rawBands.map((b) => ({
            score: Math.max(0, Math.min(100, Number(b._score) || 0)),
            feedback: String(b.feedback || ""),
            allowRetry: !!b._allowRetry,
          })),
        },
      });
      return;
    }
    // Unknown / text → H4 heading + body paragraph (text write-back contract).
    out.push({ id: comp._id, type: "heading", props: { level: 4 }, content: label(comp) });
    const bodyText = stripHtml(comp.body || "");
    if (bodyText) out.push({ id: `${comp._id}${BODY_SUFFIX}`, type: "paragraph", content: bodyText });
  };
  const emitTopic = (page: EngineContentNode) => {
    out.push({ id: page._id, type: "heading", props: { level: 1 }, content: label(page) });
    for (const article of childrenOf(articles, page._id)) {
      out.push({ id: article._id, type: "heading", props: { level: 2 }, content: label(article) });
      // The generation engine caps each Adapt block at 2 components — extra
      // components are placed in continuation blocks that carry the SAME H3
      // title. When we round-trip the course, those continuation blocks would
      // appear as duplicate H3 headings in the Storyboard (and duplicate again
      // on the next Save/Generate). Merge adjacent same-title H3 blocks so the
      // Storyboard shows one H3 with all its components in their original order.
      let prevTitle: string | null = null;
      for (const blk of childrenOf(blocks, article._id)) {
        const title = label(blk);
        if (title !== prevTitle) {
          out.push({ id: blk._id, type: "heading", props: { level: 3 }, content: title });
          prevTitle = title;
        }
        for (const comp of childrenOf(components, blk._id)) emitComponent(comp);
      }
    }
  };
  const emitMenu = (menu: EngineContentNode) => {
    for (const page of childrenOf(pages, menu._id)) emitTopic(page);
    for (const sub of childrenOf(menus, menu._id)) emitMenu(sub);
  };

  for (const page of childrenOf(pages, courseId)) emitTopic(page);
  for (const menu of childrenOf(menus, courseId)) emitMenu(menu);

  return out;
}

// WRITE: persist edits of EXISTING nodes (titles + text bodies) back to course
// content. New/removed/moved structure is NOT reconciled here (Phase 4) — such
// blocks are counted as `unmapped` and left for the generation engine.
export async function saveStoryboardToCourse(
  courseId: string,
  doc: unknown[]
): Promise<CourseWriteBackResult> {
  const [contentObjects, articles, blocks, components] = await Promise.all([
    getContentByCourse("contentobject", courseId),
    getContentByCourse("article", courseId),
    getContentByCourse("block", courseId),
    getContentByCourse("component", courseId),
  ]);

  const label = (n: EngineContentNode) => n.displayTitle || n.title || "Untitled";
  const index = new Map<
    string,
    { level: StructureLevel; title: string; body?: string; component?: string; parentId?: string }
  >();
  contentObjects.forEach((c) =>
    index.set(c._id, { level: c._type === "menu" ? "module" : "topic", title: label(c) })
  );
  articles.forEach((a) => index.set(a._id, { level: "section", title: label(a) }));
  blocks.forEach((b) => index.set(b._id, { level: "contentGroup", title: label(b) }));
  components.forEach((c) =>
    index.set(c._id, {
      level: "component",
      title: label(c),
      body: c.body || "",
      component: c._component,
      parentId: c._parentId,
    })
  );

  let updatedTitles = 0;
  let updatedBodies = 0;
  let unmapped = 0;
  const tasks: Promise<unknown>[] = [];

  for (const raw of doc as StoryboardBlock[]) {
    const id = raw && typeof raw.id === "string" ? raw.id : undefined;
    if (!id) continue;

    if (id.endsWith(BODY_SUFFIX)) {
      const compId = id.slice(0, -BODY_SUFFIX.length);
      const info = index.get(compId);
      if (!info || info.level !== "component") {
        unmapped += 1;
        continue;
      }
      const nextText = inlineToText(raw.content);
      if (nextText !== stripHtml(info.body || "")) {
        tasks.push(apiClient.put(`/api/content/component/${compId}`, { body: `<p>${escapeHtml(nextText)}</p>` }));
        updatedBodies += 1;
      }
      continue;
    }

    const info = index.get(id);
    if (!info) {
      unmapped += 1; // new block — structural create is Phase 4
      continue;
    }
    if (raw.type === "heading") {
      const nextTitle = inlineToText(raw.content).trim();
      if (nextTitle && nextTitle !== info.title) {
        tasks.push(renameStructureNode(info.level, id, nextTitle));
        updatedTitles += 1;
      }
      continue;
    }
    // Media card mapped to an existing graphic/media component → write its
    // asset fields (+ title) and (re)link the courseasset for publish.
    if (raw.type === "sbComponent" && info.level === "component") {
      const kind = raw.props?.kind;
      let parsed: {
        image?: ImageData;
        media?: MediaData;
        description?: string;
        items?: Array<{ title?: string; body?: string; image?: string; imageAssetId?: string }>;
      } = {};
      try {
        parsed = raw.props?.data ? JSON.parse(raw.props.data) : {};
      } catch {
        parsed = {};
      }
      const patch: Record<string, unknown> = {};
      const nextTitle = (raw.props?.title || "").trim();
      if (nextTitle && nextTitle !== info.title) {
        patch.title = nextTitle;
        patch.displayTitle = nextTitle;
        updatedTitles += 1;
      }
      let assetLink: string | undefined;
      let assetId: string | undefined;
      const isLaerdalMedia = info.component === LAERDAL_MEDIA_COMPONENT;
      const isGrouped =
        info.component === "accordion" ||
        info.component === "laerdal-narrative" ||
        info.component === "narrative";
      if (kind === "image" && (info.component === "graphic" || isLaerdalMedia)) {
        // Image → _graphic (or legacy laerdal-media poster if the existing comp
        // is a laerdal-media from a course generated before this change).
        // Plugin fields nest under `properties` (top-level is dropped by the
        // content model).
        mergeProperties(patch, isLaerdalMedia ? buildImageAsMedia(parsed.image) : buildGraphicField(parsed.image));
        assetLink = parsed.image?.link;
        assetId = parsed.image?.assetId;
      } else if ((kind === "video" || kind === "audio") && (isLaerdalMedia || info.component === "media")) {
        mergeProperties(patch, buildMediaField(kind, parsed.media));
        assetLink = parsed.media?.asset?.link;
        assetId = parsed.media?.asset?.assetId;
      } else if (kind === "groupedContent" && isGrouped) {
        // Grouped Content → accordion / narrative `properties._items` with
        // `_graphic.src` (matches the installed schemas). Persist any link
        // (course/assets/<file> or external URL).
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        mergeProperties(patch, {
          _items: items.map((it) => {
            const rawBody = (it?.body || "").trim();
            const body = rawBody
              ? rawBody.startsWith("<")
                ? rawBody
                : `<p>${escapeHtml(rawBody)}</p>`
              : "";
            const imgLink = (it?.image || "").trim();
            return { title: it?.title || "", body, _graphic: { alt: "", src: imgLink, attribution: "" } };
          }),
        });
        // Each item image needs its own courseasset link for publish.
        for (const it of items) {
          const fn = filenameFromLink((it?.image || "").trim());
          if (fn && it?.imageAssetId) {
            tasks.push(linkContentAsset(courseId, "component", id, info.parentId || "", fn, it.imageAssetId));
          }
        }
      }
      if (Object.keys(patch).length) {
        tasks.push(apiClient.put(`/api/content/component/${id}`, patch));
        updatedBodies += 1;
        if (assetId && assetLink) {
          const fn = filenameFromLink(assetLink);
          if (fn) tasks.push(linkContentAsset(courseId, "component", id, info.parentId || "", fn, assetId));
        }
      }
    }
  }

  await Promise.all(tasks);
  return { updatedTitles, updatedBodies, unmapped };
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

function hasOwnRecordKey(value: unknown, key: string): boolean {
  return !!value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
}

export async function componentSchemaSupportsPropertiesField(
  componentKey: string,
  fieldName: string
): Promise<boolean> {
  const key = (componentKey || "").trim();
  const field = (fieldName || "").trim();
  if (!key || !field) return false;

  const schema = await fetchMergedComponentSchema(key);
  if (!schema?.properties || typeof schema.properties !== "object") {
    return false;
  }

  const root = schema.properties as Record<string, unknown>;
  const candidates: unknown[] = [
    root,
    (root as { properties?: unknown }).properties,
    ((root as { properties?: { properties?: unknown } }).properties as { properties?: unknown } | undefined)?.properties,
  ];

  for (const candidate of candidates) {
    if (hasOwnRecordKey(candidate, field)) {
      return true;
    }
  }

  return false;
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

// ── Course schema defaults (for runtime-critical fields) ────────────────────
// The Adapt runtime templates and views read a handful of top-level course
// fields directly — `_buttons`, `_globals`, `_navigation`, `_start`, `_tooltips`,
// `themeVariables._components` — and crash with `Cannot read properties of
// undefined` when any of them is missing. Courses created via the minimal
// `POST /api/courses` flow (new UI) don't get those seeded. This helper
// deep-merges schema defaults into the persisted course document, filling only
// missing branches (existing values ALWAYS win) and PATCHes the doc back so
// preview + publish + Adapt runtime never see an undefined critical field.
async function computeCourseSchemaDefaults(): Promise<Record<string, unknown>> {
  if (!mergedSchemaCache) {
    mergedSchemaCache = await apiClient.get("/api/content/schema");
  }
  const courseSchema = (mergedSchemaCache as Record<string, unknown> | null)?.course as
    | Record<string, unknown>
    | undefined;
  if (!courseSchema || typeof courseSchema !== "object") return {};
  // /api/content/schema returns each schema already unwrapped to `properties`,
  // so `courseSchema` is directly the map of top-level fields (see contentmanager.js
  // `filteredSchemas[key] = _.omit(_.pick(schema, 'properties').properties, blackList)`).
  return buildSchemaDefaults(courseSchema);
}

function isDeepEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/**
 * Seed any missing top-level course-schema defaults onto the persisted course
 * document. Existing authored values are ALWAYS preserved (deep-merged wins);
 * only branches that are absent or empty get filled from the schema. Idempotent
 * — a second call with the same doc is a no-op.
 */
export async function seedMissingCourseDefaults(courseId: string): Promise<void> {
  try {
    const [defaults, course] = await Promise.all([
      computeCourseSchemaDefaults(),
      apiClient.get<Record<string, unknown>>(`/api/content/course/${courseId}`),
    ]);

    const patch: Record<string, unknown> = {};

    for (const [k, defaultVal] of Object.entries(defaults || {})) {
      const existing = course[k];
      if (isDeepEmpty(existing)) {
        patch[k] = defaultVal;
        continue;
      }
      if (
        defaultVal &&
        typeof defaultVal === "object" &&
        !Array.isArray(defaultVal) &&
        typeof existing === "object" &&
        existing &&
        !Array.isArray(existing)
      ) {
        // Deep-merge to backfill any missing sub-keys (existing sub-value wins).
        const merged = deepMergeGlobals(defaultVal as GlobalsObject, existing as GlobalsObject);
        if (JSON.stringify(merged) !== JSON.stringify(existing)) {
          patch[k] = merged;
        }
      }
    }

    // `themeVariables` is NOT part of the course JSON schema — the theme plugin
    // stores per-theme customizations under this key, and the schema for it
    // comes from the applied theme's `properties.variables`. Runtime theme code
    // (e.g. adapt-laerdal-life-v2 `themeComponentView.js` line ~33) dereferences
    // `Adapt.course.get('themeVariables')._components?._canShowFinalMarking`.
    // The inner `?.` protects `_components` but NOT the outer object, so when
    // `themeVariables` is undefined the framework crashes with
    //   TypeError: Cannot read properties of undefined (reading '_components')
    // Guarantee at least an empty object so `undefined._components → {}._components`.
    if (course.themeVariables === undefined || course.themeVariables === null) {
      patch.themeVariables = {};
    }

    if (Object.keys(patch).length) {
      await apiClient.put(`/api/content/course/${courseId}`, patch);
    }
  } catch (err) {
    console.warn("Failed to seed missing course schema defaults", err);
  }
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
    subtitle: "",
    _subtitle: "",
    body: "",
    description: "",
    instruction: "",
    linkText: "",
    duration: "",
    _lockType: "",
    _lockedBy: [],
    _classes: "",
    _htmlClasses: "",
    requirecompletionof: "-1",
    _isOptional: false,
    _isAvailable: true,
    _isHidden: false,
    _isVisible: true,
    _onScreen: {
      _isEnabled: false,
      _classes: "",
      _percentInviewVertical: 50,
    },
    _ariaLevel: "",
    _extensions: {},
    _graphic: {
      src: "",
      alt: "",
    },
    themeSettings: {},
    menuSettings: {},
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
    body: "",
    description: "",
    instruction: "",
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
    body: "",
    description: "",
    instruction: "",
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
  const defaultProperties =
    schemaDefaults.properties &&
    typeof schemaDefaults.properties === "object" &&
    !Array.isArray(schemaDefaults.properties)
      ? (schemaDefaults.properties as Record<string, unknown>)
      : {};

  const mergedProperties: Record<string, unknown> = {
    ...defaultProperties,
  };

  if (!Object.prototype.hasOwnProperty.call(mergedProperties, "subtitle")) {
    mergedProperties.subtitle = "";
  }

  if (!Object.prototype.hasOwnProperty.call(mergedProperties, "instruction")) {
    mergedProperties.instruction = "";
  }

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
    properties: mergedProperties,
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
  topicTitle = NEW_TOPIC_TITLE,
  sortOrder = 1
): Promise<string> {
  const topicId = await createTopic(courseId, parentId, topicTitle, sortOrder);
  const articleId = await createArticle(courseId, topicId, NEW_SECTION_TITLE, 1);
  const blockId = await createBlock(courseId, articleId, NEW_CONTENT_GROUP_TITLE, 1);
  const text = await getTextComponentType();
  // A single component should start as full-width.
  if (text) await createComponent(courseId, blockId, text, 1, "full");
  return topicId;
}

export async function seedDefaultSection(
  courseId: string,
  parentId: string,
  sectionTitle = NEW_SECTION_TITLE,
  sortOrder = 1
): Promise<string> {
  const articleId = await createArticle(courseId, parentId, sectionTitle, sortOrder);
  const blockId = await createBlock(courseId, articleId, NEW_CONTENT_GROUP_TITLE, 1);
  const text = await getTextComponentType();
  if (text) await createComponent(courseId, blockId, text, 1, "full");
  return articleId;
}

export async function seedDefaultContentGroup(
  courseId: string,
  parentId: string,
  groupTitle = NEW_CONTENT_GROUP_TITLE,
  sortOrder = 1
): Promise<string> {
  const blockId = await createBlock(courseId, parentId, groupTitle, sortOrder);
  const text = await getTextComponentType();
  if (text) await createComponent(courseId, blockId, text, 1, "full");
  return blockId;
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
  return seedDefaultTopic(courseId, courseId, NEW_TOPIC_TITLE, 1);
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

export function updateStructureNode(
  level: StructureLevel,
  id: string,
  patch: Record<string, unknown>,
  options?: { syncTitleDisplayTitle?: boolean }
): Promise<unknown> {
  const shouldSync = options?.syncTitleDisplayTitle !== false;
  const body =
    shouldSync && typeof patch.title === "string" && patch.displayTitle === undefined
      ? { ...patch, displayTitle: patch.title }
      : patch;
  return apiClient.put(`/api/content/${LEVEL_TO_CONTENT_TYPE[level]}/${id}`, body);
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

// ── CDN Deployment ────────────────────────────────────────────────────────────
// Adapt Studio's "CDN Deployment" panel: enable/edit the course's adapt-cdn-config
// extension settings, plus build-trigger / previous-links / restore / expiry
// actions against the existing plugins/output/cdn REST API.

const CDN_CONFIG_EXTENSION_NAME = "adapt-cdn-config";

// Matches the adapt-cdn-config extension's properties.schema Select options
// (pluginLocations.config._cdnConfig._courseDeployment.cdnid) — these are real
// storage-container ids the `cdndeploy` CLI understands, not placeholders.
export const CDN_STORAGE_CONTAINERS = ["cdn-esim-dev", "cdn-esim-prod", "cdn-esim-cn-dev"] as const;

// Schema defaults (adapt-cdn-config/properties.schema) used when the extension
// hasn't been configured on this course yet.
const DEFAULT_CDN_DEPLOYMENT_SETTINGS: CdnDeploymentSettings = {
  isEnabled: false,
  cdnid: CDN_STORAGE_CONTAINERS[0],
  groupid: "default-project",
  courseid: "default-course",
  version: "0.0.1",
  buildTriggerComment: "Build Triggered",
};

export interface CdnDeploymentSettings {
  isEnabled: boolean;
  cdnid: string;
  groupid: string;
  courseid: string;
  version: string;
  buildTriggerComment: string;
}

export async function getCdnDeploymentSettings(courseId: string): Promise<CdnDeploymentSettings> {
  const config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  const cdnConfig = obj(obj(config._extensions)._cdnConfig);
  const deployment = obj(cdnConfig._courseDeployment);
  const isEnabled =
    isExtensionInstalledByName(config, CDN_CONFIG_EXTENSION_NAME) && bool(cdnConfig._isEnabled, false);

  return {
    isEnabled,
    cdnid: str(deployment.cdnid, DEFAULT_CDN_DEPLOYMENT_SETTINGS.cdnid),
    groupid: str(deployment.groupid, DEFAULT_CDN_DEPLOYMENT_SETTINGS.groupid),
    courseid: str(deployment.courseid, DEFAULT_CDN_DEPLOYMENT_SETTINGS.courseid),
    version: str(deployment.version, DEFAULT_CDN_DEPLOYMENT_SETTINGS.version),
    buildTriggerComment: str(deployment.buildTriggerComment, DEFAULT_CDN_DEPLOYMENT_SETTINGS.buildTriggerComment),
  };
}

// Reconciles extension install state with `settings.isEnabled`, then writes the
// course-deployment fields — mirrors setCompletionNotifierEnabledInConfig's
// single-extension, config-location-only enable/disable + patch pattern.
export async function saveCdnDeploymentSettings(courseId: string, settings: CdnDeploymentSettings): Promise<unknown> {
  const config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  const installed = isExtensionInstalledByName(config, CDN_CONFIG_EXTENSION_NAME);

  if (settings.isEnabled && !installed) {
    const ids = await resolveExtensionTypeIdsByNames([CDN_CONFIG_EXTENSION_NAME]);
    if (ids.length) await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
  } else if (!settings.isEnabled && installed) {
    const ids = await resolveExtensionTypeIdsByNames([CDN_CONFIG_EXTENSION_NAME]);
    if (ids.length) await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
  }

  // Re-read after (dis/en)abling: enabling seeds the extension's schema-default
  // _cdnConfig block, which we then need to merge our field values onto.
  const freshConfig = settings.isEnabled === installed
    ? config
    : await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  const existingCdnConfig = obj(obj(freshConfig._extensions)._cdnConfig);

  return apiClient.patch(`/api/content/config/${freshConfig._id}`, {
    _id: freshConfig._id,
    _courseId: courseId,
    _extensions: {
      ...obj(freshConfig._extensions),
      _cdnConfig: {
        ...existingCdnConfig,
        _isEnabled: settings.isEnabled,
        _courseDeployment: {
          ...obj(existingCdnConfig._courseDeployment),
          cdnid: settings.cdnid,
          groupid: settings.groupid,
          courseid: settings.courseid,
          version: settings.version,
          buildTriggerComment: settings.buildTriggerComment,
        },
      },
    },
  });
}

export async function getCdnVersion(): Promise<string> {
  const result = await apiClient.get<{ data?: string }>("/api/cdn/version");
  return result?.data ?? "";
}

// Shape returned by `cdndeploy ls` (adapt-cdn-deploy-cli's util/azcopy.js `list()`),
// passed straight through by plugins/output/cdn/routes/getlinks.js.
export interface CdnLinkEntry {
  entry: string; // raw version folder name, or "latest"
  link: string;
  timestamp?: string;
  timestampPretty?: string;
  version?: string;
  sourceInstance?: string;
  [key: string]: unknown;
}

export async function getCdnPreviousLinks(groupid: string, courseid: string, cdnid: string): Promise<CdnLinkEntry[]> {
  const result = await apiClient.get<{ data?: CdnLinkEntry[] }>(
    `/api/cdn/getlinks/${encodeURIComponent(groupid)}/${encodeURIComponent(courseid)}/${encodeURIComponent(cdnid)}`,
  );
  return Array.isArray(result?.data) ? result.data : [];
}

export interface CdnLinkStatus {
  url: string;
  statusCode: number;
}

export async function checkCdnLinkStatuses(urls: string[]): Promise<CdnLinkStatus[]> {
  const result = await apiClient.post<{ success?: boolean; data?: CdnLinkStatus[] }>(
    "/api/cdn/checklinkstatuses",
    { urls },
  );
  return result?.success && Array.isArray(result.data) ? result.data : [];
}

export async function restoreCdnLink(
  groupid: string,
  courseid: string,
  cdnid: string,
  versionfolder: string,
): Promise<CdnLinkEntry[]> {
  const result = await apiClient.get<{ data?: CdnLinkEntry[] }>(
    `/api/cdn/restoreLink/${encodeURIComponent(groupid)}/${encodeURIComponent(courseid)}/${encodeURIComponent(cdnid)}/${encodeURIComponent(versionfolder)}`,
  );
  return Array.isArray(result?.data) ? result.data : [];
}

export async function setCdnLinkExpiry(
  groupid: string,
  courseid: string,
  cdnid: string,
  versionfolder: string,
  expiredate: string,
): Promise<CdnLinkEntry[]> {
  const result = await apiClient.get<{ data?: CdnLinkEntry[] }>(
    `/api/cdn/setExpiry/${encodeURIComponent(groupid)}/${encodeURIComponent(courseid)}/${encodeURIComponent(cdnid)}/${encodeURIComponent(versionfolder)}/${encodeURIComponent(expiredate)}`,
  );
  return Array.isArray(result?.data) ? result.data : [];
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

export interface TemplatePasteRequest {
  objectId: string;
  parentId: string;
  courseId: string;
  sortOrder?: number;
  layout?: "full" | "left" | "right";
}

export function pasteTemplateIntoCourse(
  payload: TemplatePasteRequest
): Promise<{ success?: boolean }> {
  return apiClient.post<{ success?: boolean }>("/api/templating/paste", payload);
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

// ── Storyboard Authoring (ADAPT-3760 / ADAPT-3779) ──────────────────────────
// CRUD over /api/storyboard/{documents,comments,audit}. documentJson and
// _generatedContentMap are exchanged as parsed JSON (the backend stores them as
// strings and (de)serialises at the route boundary).

export type StoryboardStatus = "draft" | "in_review" | "approved";

export interface StoryboardRecord {
  _id: string;
  _courseId: string;
  title: string;
  status: StoryboardStatus;
  version: number;
  documentJson: unknown[];
  _generatedContentMap: Record<string, string>;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoryboardComment {
  _id: string;
  _storyboardId: string;
  _courseId?: string;
  blockId: string;
  _parentCommentId?: string;
  body: string;
  resolved: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoryboardAuditEvent {
  _id: string;
  _storyboardId: string;
  _courseId?: string;
  event: "status_change" | "generated" | "imported";
  fromStatus?: string;
  toStatus?: string;
  meta?: Record<string, unknown>;
  createdBy?: string;
  createdAt?: string;
}

const SB_DOCS = "/api/storyboard/documents";
const SB_COMMENTS = "/api/storyboard/comments";

// Storyboard documents ------------------------------------------------------

// Returns null when the course has no storyboard yet.
export function getStoryboardByCourse(courseId: string): Promise<StoryboardRecord | null> {
  return apiClient.get<StoryboardRecord | null>(`${SB_DOCS}/course/${courseId}`);
}

export function getStoryboard(id: string): Promise<StoryboardRecord> {
  return apiClient.get<StoryboardRecord>(`${SB_DOCS}/${id}`);
}

export function createStoryboard(input: {
  _courseId: string;
  title?: string;
  documentJson?: unknown[];
  status?: StoryboardStatus;
}): Promise<StoryboardRecord> {
  return apiClient.post<StoryboardRecord>(SB_DOCS, input);
}

export function updateStoryboard(
  id: string,
  patch: Partial<Pick<StoryboardRecord, "title" | "status" | "version" | "documentJson" | "_generatedContentMap">>
): Promise<StoryboardRecord> {
  return apiClient.put<StoryboardRecord>(`${SB_DOCS}/${id}`, patch);
}

// Changes status and appends a status_change audit event server-side.
export function setStoryboardStatus(id: string, status: StoryboardStatus): Promise<StoryboardRecord> {
  return apiClient.put<StoryboardRecord>(`${SB_DOCS}/${id}/status`, { status });
}

export function deleteStoryboard(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`${SB_DOCS}/${id}`);
}

// Comments ------------------------------------------------------------------

export function listStoryboardComments(id: string): Promise<StoryboardComment[]> {
  return apiClient.get<StoryboardComment[]>(`${SB_DOCS}/${id}/comments`);
}

export function addStoryboardComment(
  id: string,
  input: { blockId: string; body: string; _parentCommentId?: string; _courseId?: string }
): Promise<StoryboardComment> {
  return apiClient.post<StoryboardComment>(`${SB_DOCS}/${id}/comments`, input);
}

export function updateStoryboardComment(
  commentId: string,
  patch: { body?: string; resolved?: boolean }
): Promise<StoryboardComment> {
  return apiClient.put<StoryboardComment>(`${SB_COMMENTS}/${commentId}`, patch);
}

export function deleteStoryboardComment(commentId: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`${SB_COMMENTS}/${commentId}`);
}

// Audit ---------------------------------------------------------------------

export function listStoryboardAudit(id: string): Promise<StoryboardAuditEvent[]> {
  return apiClient.get<StoryboardAuditEvent[]>(`${SB_DOCS}/${id}/audit`);
}

export function addStoryboardAudit(
  id: string,
  input: {
    event: StoryboardAuditEvent["event"];
    fromStatus?: string;
    toStatus?: string;
    meta?: Record<string, unknown>;
    _courseId?: string;
  }
): Promise<StoryboardAuditEvent> {
  return apiClient.post<StoryboardAuditEvent>(`${SB_DOCS}/${id}/audit`, input);
}

// Import / Export (AC10) — binary exchanged as base64 through the JSON client.
export type ImportFormat = "word" | "pdf" | "pptx";

// `title` (the course title) drives both the in-document heading and the
// download filename server-side; falls back to the storyboard record title.
export function exportStoryboardWord(
  id: string,
  title?: string
): Promise<{ filename: string; mime: string; dataBase64: string }> {
  const q = title ? `?title=${encodeURIComponent(title)}` : "";
  return apiClient.get<{ filename: string; mime: string; dataBase64: string }>(`${SB_DOCS}/${id}/export/word${q}`);
}

export function exportStoryboardPdf(
  id: string,
  title?: string
): Promise<{ filename: string; mime: string; dataBase64: string }> {
  const q = title ? `?title=${encodeURIComponent(title)}` : "";
  return apiClient.get<{ filename: string; mime: string; dataBase64: string }>(`${SB_DOCS}/${id}/export/pdf${q}`);
}

export function importStoryboardDocument(
  format: ImportFormat,
  dataBase64: string
): Promise<{ blocks: unknown[] }> {
  return apiClient.post<{ blocks: unknown[] }>(`/api/storyboard/import/${format}`, { dataBase64 });
}
