import { apiClient } from "../api/client";

type AnyRecord = Record<string, unknown>;

function obj(v: unknown): AnyRecord {
  return v && typeof v === "object" ? (v as AnyRecord) : {};
}

interface EngineConfigDetails {
  _id?: string;
  _enabledExtensions?: Record<string, { _id: string; name: string; version?: string; targetAttribute?: string }>;
  _extensions?: Record<string, unknown>;
}

export const TRACKING_ANALYTICS_EXTENSION_NAME_BY_KEY: Record<string, string> = {
  _spoor: "adapt-contrib-spoor",
  _xapi: "adapt-contrib-xapi",
  _hyper: "adapt-hyper-bridge",
  _uesAnalytics: "adapt-ues-analytics",
  _googleAnalytics: "adapt-googleAnalytics",
  _hotjarAnalytics: "adapt-hotjarAnalytics",
};

type TrackingAnalyticsPluginConfig = Record<string, unknown> & {
  _isEnabled?: boolean;
};

export interface TrackingAnalyticsSettings {
  _spoor: TrackingAnalyticsPluginConfig;
  _xapi: TrackingAnalyticsPluginConfig;
  _hyper: TrackingAnalyticsPluginConfig;
  _uesAnalytics: TrackingAnalyticsPluginConfig;
  _googleAnalytics: TrackingAnalyticsPluginConfig;
  _hotjarAnalytics: TrackingAnalyticsPluginConfig;
}

export function defaultTrackingAnalyticsSettings(): TrackingAnalyticsSettings {
  return {
    _spoor: { _isEnabled: false },
    _xapi: { _isEnabled: false },
    _hyper: { _isEnabled: false },
    _uesAnalytics: { _isEnabled: false },
    _googleAnalytics: { _isEnabled: false },
    _hotjarAnalytics: { _isEnabled: false },
  };
}

function normalizePluginName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isExtensionInstalledByName(config: EngineConfigDetails, extensionName: string): boolean {
  const target = normalizePluginName(extensionName);
  const map = config._enabledExtensions ?? {};
  return Object.values(map).some((entry) => {
    const name = entry?.name ?? "";
    return normalizePluginName(name) === target;
  });
}

async function resolveExtensionTypeIdsByNames(extensionNames: string[]): Promise<string[]> {
  if (!extensionNames.length) return [];
  const rows = await apiClient.get<{ _id: string; name?: string }[]>("/api/extensiontype");
  const byName = new Map<string, string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?._id || !row?.name) continue;
    byName.set(normalizePluginName(row.name), row._id);
  }
  return extensionNames
    .map((name) => byName.get(normalizePluginName(name)))
    .filter((id): id is string => !!id);
}

export async function getTrackingAnalyticsSettings(courseId: string): Promise<TrackingAnalyticsSettings> {
  const cfg = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  const defaults = defaultTrackingAnalyticsSettings();
  // Extension configs are stored inside _extensions (Mixed type in Mongoose schema).
  // Reading from the root-level fields (_spoor etc.) does NOT work because Mongoose's
  // strict mode silently drops them on save. The correct location is _extensions._spoor.
  const ext = obj(cfg._extensions);

  return {
    _spoor: { ...defaults._spoor, ...obj(ext._spoor) },
    _xapi: { ...defaults._xapi, ...obj(ext._xapi) },
    _hyper: { ...defaults._hyper, ...obj(ext._hyper) },
    _uesAnalytics: { ...defaults._uesAnalytics, ...obj(ext._uesAnalytics) },
    _googleAnalytics: { ...defaults._googleAnalytics, ...obj(ext._googleAnalytics) },
    _hotjarAnalytics: { ...defaults._hotjarAnalytics, ...obj(ext._hotjarAnalytics) },
  };
}

export async function saveTrackingAnalyticsSettings(
  courseId: string,
  settings: TrackingAnalyticsSettings
): Promise<void> {
  let config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  if (!config?._id) {
    throw new Error("Could not resolve course config id for tracking/analytics save");
  }

  const toEnable: string[] = [];
  const toDisable: string[] = [];

  (Object.keys(TRACKING_ANALYTICS_EXTENSION_NAME_BY_KEY) as Array<keyof TrackingAnalyticsSettings>).forEach((key) => {
    const extensionName = TRACKING_ANALYTICS_EXTENSION_NAME_BY_KEY[key];
    const installed = isExtensionInstalledByName(config, extensionName);
    const shouldEnable = !!settings[key]?._isEnabled;

    if (shouldEnable && !installed) toEnable.push(extensionName);
    if (!shouldEnable && installed) toDisable.push(extensionName);
  });

  if (toEnable.length || toDisable.length) {
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

    config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
    if (!config?._id) {
      throw new Error("Could not resolve course config id after extension update");
    }
  }

  // Merge our tracking configs into the existing _extensions object.
  // _extensions is typed as Object (Mixed) in the Mongoose config schema, so
  // arbitrary nested data IS persisted. Root-level fields like _spoor are NOT
  // in the schema and would be silently dropped by Mongoose strict mode.
  const existingExtensions = obj(config._extensions);
  await apiClient.patch(`/api/content/config/${config._id}`, {
    _id: config._id,
    _courseId: courseId,
    _extensions: {
      ...existingExtensions,
      _spoor: settings._spoor,
      _xapi: settings._xapi,
      _hyper: settings._hyper,
      _uesAnalytics: settings._uesAnalytics,
      _googleAnalytics: settings._googleAnalytics,
      _hotjarAnalytics: settings._hotjarAnalytics,
    },
  });
}