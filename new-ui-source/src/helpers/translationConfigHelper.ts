import { apiClient } from "../api/client";

type AnyRecord = Record<string, unknown>;

interface EngineConfigDetails {
  _id?: string;
  _enabledExtensions?: Record<string, { _id: string; name: string; version?: string; targetAttribute?: string }>;
  _extensions?: Record<string, unknown>;
}

const SMARTLING_CONFIG_EXTENSION_NAME = "adapt-smartling-config";
const MEDIALOCATE_CONFIG_EXTENSION_NAME = "adapt-medialocate-config";

function obj(v: unknown): AnyRecord {
  return v && typeof v === "object" ? (v as AnyRecord) : {};
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function normalizePluginName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isExtensionInstalledByName(config: EngineConfigDetails, extensionName: string): boolean {
  const target = normalizePluginName(extensionName);
  const map = config._enabledExtensions ?? {};
  const byValue = Object.values(map).some((entry) => normalizePluginName(entry?.name ?? "") === target);
  if (byValue) return true;
  return Object.keys(map).some((key) => normalizePluginName(key) === target);
}

async function resolveExtensionTypeIdsByNames(extensionNames: string[]): Promise<string[]> {
  if (!extensionNames.length) return [];
  const rows = await apiClient.get<{
    _id: string;
    name?: string;
    displayName?: string;
    extension?: string;
    targetAttribute?: string;
  }[]>("/api/extensiontype");
  const byName = new Map<string, string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?._id) continue;
    const keys = [row.name, row.displayName, row.extension, row.targetAttribute]
      .map((value) => normalizePluginName(value ?? ""))
      .filter((value) => value.length > 0);
    for (const key of keys) {
      if (!byName.has(key)) byName.set(key, row._id);
    }
  }
  return extensionNames
    .map((name) => byName.get(normalizePluginName(name)))
    .filter((id): id is string => !!id);
}

/**
 * Enable (or confirm already-enabled) a config extension on a course, idempotently.
 * Throws rather than silently no-op'ing when the extension type can't be resolved —
 * `/api/extension/enable` returns `{ success: true }` even when given an id that
 * matches nothing in the `extensiontype` collection, so a missing-extension-type
 * failure would otherwise look identical to a successful enable.
 */
async function ensureExtensionEnabled(courseId: string, config: EngineConfigDetails, extensionName: string): Promise<void> {
  if (isExtensionInstalledByName(config, extensionName)) return;
  const ids = await resolveExtensionTypeIdsByNames([extensionName]);
  if (!ids.length) {
    throw new Error(
      `The "${extensionName}" extension isn't installed on this server, so it can't be enabled for this course. ` +
      `Install it from Plugin Management (/plugins) first, then try again.`
    );
  }
  await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
}

/* =============================================================
   SMARTLING CONFIG (adapt-smartling-config)
   ============================================================= */

export interface SmartlingConfigSettings {
  enabled: boolean;
  projectId: string;
}

export function defaultSmartlingConfigSettings(): SmartlingConfigSettings {
  return { enabled: false, projectId: "" };
}

export async function getSmartlingConfigSettings(courseId: string): Promise<SmartlingConfigSettings> {
  const config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  const defaults = defaultSmartlingConfigSettings();
  const configExtensions = obj(config._extensions);
  const smartling = obj(config._smartlingConfig || configExtensions._smartlingConfig);
  return {
    ...defaults,
    enabled: isExtensionInstalledByName(config, SMARTLING_CONFIG_EXTENSION_NAME) && bool(smartling._isEnabled, true),
    projectId: str(smartling.smartlingProjectId, defaults.projectId),
  };
}

/**
 * Persists the Smartling project id to the course's `_smartlingConfig` extension and
 * auto-enables the `adapt-smartling-config` extension on the course if it isn't already —
 * so entering a project id in the Translation UI is enough; no separate admin step needed.
 */
export async function saveSmartlingConfigSettings(courseId: string, projectId: string): Promise<void> {
  const trimmed = projectId.trim();
  if (!trimmed) return;

  let config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  if (!config?._id) throw new Error("Could not resolve config id for Smartling settings");

  await ensureExtensionEnabled(courseId, config, SMARTLING_CONFIG_EXTENSION_NAME);
  config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  if (!config?._id) throw new Error("Could not resolve config id for Smartling settings after enabling extension");

  const configExtensions = obj(config._extensions);
  const existing = obj(config._smartlingConfig || configExtensions._smartlingConfig);
  const smartlingConfig = {
    ...existing,
    _isEnabled: true,
    smartlingProjectId: trimmed,
  };

  await apiClient.patch(`/api/content/config/${config._id}`, {
    _id: config._id,
    _courseId: courseId,
    _smartlingConfig: smartlingConfig,
    _extensions: {
      ...configExtensions,
      _smartlingConfig: smartlingConfig,
    },
  });
}

/* =============================================================
   MEDIALOCATE CONFIG (adapt-medialocate-config)
   ============================================================= */

export interface MediaLocateConfigSettings {
  enabled: boolean;
  environment: "test" | "production";
  projectName: string;
  projectDescription: string;
  mtdGuidTest: string;
  mtdGuidProduction: string;
}

export function defaultMediaLocateConfigSettings(): MediaLocateConfigSettings {
  return {
    enabled: false,
    environment: "test",
    projectName: "",
    projectDescription: "",
    mtdGuidTest: "",
    mtdGuidProduction: "",
  };
}

export async function getMediaLocateConfigSettings(courseId: string): Promise<MediaLocateConfigSettings> {
  const config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  const defaults = defaultMediaLocateConfigSettings();
  const configExtensions = obj(config._extensions);
  const mediaLocate = obj(config._mediaLocateConfig || configExtensions._mediaLocateConfig);
  const environment = str(mediaLocate.environment, defaults.environment);
  return {
    ...defaults,
    enabled: isExtensionInstalledByName(config, MEDIALOCATE_CONFIG_EXTENSION_NAME) && bool(mediaLocate._isEnabled, true),
    environment: environment === "production" ? "production" : "test",
    projectName: str(mediaLocate.projectName, defaults.projectName),
    projectDescription: str(mediaLocate.projectDescription, defaults.projectDescription),
    mtdGuidTest: str(mediaLocate.mtdGuidTest, defaults.mtdGuidTest),
    mtdGuidProduction: str(mediaLocate.mtdGuidProduction, defaults.mtdGuidProduction),
  };
}

/**
 * Persists MediaLocate project settings to the course's `_mediaLocateConfig` extension and
 * auto-enables the `adapt-medialocate-config` extension on the course if it isn't already —
 * so entering project details in the Translation UI is enough; no separate admin step needed.
 * Only the fields passed in `updates` are changed; everything else already on the course
 * (including the MTD GUIDs, which aren't edited from this UI) is preserved as-is.
 */
export async function saveMediaLocateConfigSettings(
  courseId: string,
  updates: Partial<Pick<MediaLocateConfigSettings, "environment" | "projectName" | "projectDescription">>
): Promise<void> {
  let config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  if (!config?._id) throw new Error("Could not resolve config id for MediaLocate settings");

  await ensureExtensionEnabled(courseId, config, MEDIALOCATE_CONFIG_EXTENSION_NAME);
  config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  if (!config?._id) throw new Error("Could not resolve config id for MediaLocate settings after enabling extension");

  const configExtensions = obj(config._extensions);
  const existing = obj(config._mediaLocateConfig || configExtensions._mediaLocateConfig);
  const mediaLocateConfig = {
    environment: "test",
    ...existing,
    _isEnabled: true,
    ...(updates.environment !== undefined ? { environment: updates.environment } : null),
    ...(updates.projectName !== undefined ? { projectName: updates.projectName.trim() } : null),
    ...(updates.projectDescription !== undefined ? { projectDescription: updates.projectDescription.trim() } : null),
  };

  await apiClient.patch(`/api/content/config/${config._id}`, {
    _id: config._id,
    _courseId: courseId,
    _mediaLocateConfig: mediaLocateConfig,
    _extensions: {
      ...configExtensions,
      _mediaLocateConfig: mediaLocateConfig,
    },
  });
}
