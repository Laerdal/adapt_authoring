import { apiClient } from "../api/client";

export interface ExportSourceResponse {
  success?: boolean;
  message?: string;
}

export interface ExportSourceActionOptions {
  exportingSource: boolean;
  tenantId?: string;
  courseId: string;
  setExportingSource: (value: boolean) => void;
  onProcessingStart?: () => void;
  onDownloadStarted?: () => void;
  onUnavailable?: () => void;
  onError?: (message: string) => void;
}

export interface ExportStoryboardActionOptions {
  exportingStoryboard: boolean;
  courseId: string;
  setExportingStoryboard: (value: boolean) => void;
  onProcessingStart?: () => void;
  onDownloadStarted?: () => void;
  onUnavailable?: () => void;
  onError?: (message: string) => void;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getFilenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function exportSourceCourse(tenantId: string, courseId: string): Promise<void> {
  const exportPath = `/export/${encodeURIComponent(tenantId)}/${encodeURIComponent(courseId)}`;
  const response = await fetch(exportPath, {
    method: "GET",
    credentials: "same-origin",
  });

  const result = await response.json().catch(() => null) as ExportSourceResponse | null;
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || `Export failed (${response.status})`);
  }

  // Keep parity with legacy flow: trigger zip download via a form submit.
  const form = document.createElement("form");
  form.method = "GET";
  form.action = `${exportPath}/download.zip`;
  form.style.display = "none";
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export async function runExportSourceAction(options: ExportSourceActionOptions): Promise<void> {
  const {
    exportingSource,
    tenantId,
    courseId,
    setExportingSource,
    onProcessingStart,
    onDownloadStarted,
    onUnavailable,
    onError,
  } = options;

  if (exportingSource) return;

  if (!courseId || !tenantId) {
    onUnavailable?.();
    return;
  }

  setExportingSource(true);
  onProcessingStart?.();
  try {
    await exportSourceCourse(tenantId, courseId);
    onDownloadStarted?.();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Export failed";
    onError?.(message);
  } finally {
    setExportingSource(false);
  }
}

export async function exportStoryboardCourseZip(courseId: string, includeDisplayProp = false): Promise<void> {
  const params = new URLSearchParams();
  if (includeDisplayProp) {
    params.append("includeDisplayProp", "true");
  }
  params.append("optimize", "true");
  params.append("maxImageWidth", "800");
  params.append("maxImageHeight", "600");

  const query = params.toString();
  const url = `/api/storyboard/zip/${encodeURIComponent(courseId)}${query ? `?${query}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/zip, application/json",
      "Cache-Control": "no-cache",
    },
    credentials: "same-origin",
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const err = await response.json().catch(() => null) as { error?: string; details?: string } | null;
      throw new Error(err?.details || err?.error || `Storyboard export failed (${response.status})`);
    }
    throw new Error(`Storyboard export failed (${response.status})`);
  }

  const blob = await response.blob();
  const filename = getFilenameFromDisposition(
    response.headers.get("content-disposition"),
    `storyboard-${courseId}.zip`
  );
  triggerDownload(blob, filename);
}

export async function runExportStoryboardAction(options: ExportStoryboardActionOptions): Promise<void> {
  const {
    exportingStoryboard,
    courseId,
    setExportingStoryboard,
    onProcessingStart,
    onDownloadStarted,
    onUnavailable,
    onError,
  } = options;

  if (exportingStoryboard) return;

  if (!courseId) {
    onUnavailable?.();
    return;
  }

  setExportingStoryboard(true);
  onProcessingStart?.();
  try {
    await exportStoryboardCourseZip(courseId, false);
    onDownloadStarted?.();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Export failed";
    onError?.(message);
  } finally {
    setExportingStoryboard(false);
  }
}

type AnyRecord = Record<string, unknown>;
type ValidatorAssetSource = "library" | "url";

interface EngineConfigDetails {
  _id: string;
  _extensions: Record<string, unknown>;
  _enabledExtensions?: Record<string, { _id: string; name: string; version?: string; targetAttribute?: string }>;
}

const VALIDATOR_ENABLER_EXTENSION_TARGET = "_validatorEnabler";
const VALIDATOR_ENABLER_EXTENSION_NAME_CANDIDATES = [
  "adapt-laerdal-validator-enabler",
  "laerdal-validator-enabler",
  "adapt-validator-enabler",
  "validator-enabler",
];

export interface ValidatorEnablerPdfSettings {
  pdfExportEnabled: boolean;
  coverPageSource: ValidatorAssetSource;
  coverPageUrl: string;
  footerLogoSource: ValidatorAssetSource;
  footerLogoUrl: string;
  tocPageTitles: boolean;
  tocArticleTitles: boolean;
  tocBlockTitles: boolean;
  tocComponentTitles: boolean;
  pdfTitle: string;
  pdfAuthor: string;
  pdfSubject: string;
  pdfCopyright: string;
  passwordEnabled: boolean;
  userPassword: string;
  ownerPassword: string;
  encryptionLevel: string;
  disablePrinting: boolean;
  disableCopying: boolean;
  disableAnnotation: boolean;
  allowWatermarking: boolean;
  watermarkText: string;
  watermarkPosition: string;
}

export const DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS: ValidatorEnablerPdfSettings = {
  pdfExportEnabled: true,
  coverPageSource: "library",
  coverPageUrl: "",
  footerLogoSource: "library",
  footerLogoUrl: "",
  tocPageTitles: true,
  tocArticleTitles: true,
  tocBlockTitles: true,
  tocComponentTitles: true,
  pdfTitle: "",
  pdfAuthor: "",
  pdfSubject: "",
  pdfCopyright: "",
  passwordEnabled: false,
  userPassword: "",
  ownerPassword: "",
  encryptionLevel: "AES-256",
  disablePrinting: false,
  disableCopying: false,
  disableAnnotation: false,
  allowWatermarking: false,
  watermarkText: "",
  watermarkPosition: "Diagonal",
};

function obj(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizePluginName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeTargetAttribute(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("_") ? trimmed : `_${trimmed}`;
}

function toValidatorAssetSource(value: unknown, fallback: ValidatorAssetSource): ValidatorAssetSource {
  const normalized = str(value, fallback);
  return normalized === "url" ? "url" : "library";
}

async function resolveExtensionTypeIdsByTargetOrNames(target: string, names: string[]): Promise<string[]> {
  const normalizedTarget = normalizeTargetAttribute(target).toLowerCase();
  const nameSet = new Set(names.map((name) => normalizePluginName(name)));
  const rows = await apiClient.get<{ _id: string; name?: string; targetAttribute?: string }[]>("/api/extensiontype");

  const ids = new Set<string>();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row?._id) return;
    const byTarget = normalizeTargetAttribute(str(row.targetAttribute, "")).toLowerCase() === normalizedTarget;
    const byName = nameSet.has(normalizePluginName(str(row.name, "")));
    if (byTarget || byName) ids.add(row._id);
  });

  return Array.from(ids);
}

function isExtensionInstalledByTargetOrNames(config: EngineConfigDetails, target: string, names: string[]): boolean {
  const normalizedTarget = normalizeTargetAttribute(target).toLowerCase();
  const nameSet = new Set(names.map((name) => normalizePluginName(name)));
  const map = config._enabledExtensions ?? {};

  return Object.values(map).some((entry) => {
    const name = normalizePluginName(str(entry?.name, ""));
    const entryTarget = normalizeTargetAttribute(str(entry?.targetAttribute, "")).toLowerCase();
    return (!!name && nameSet.has(name)) || (!!entryTarget && entryTarget === normalizedTarget);
  });
}

export async function getValidatorEnablerPdfSettings(courseId: string): Promise<ValidatorEnablerPdfSettings> {
  const config = await apiClient.get<EngineConfigDetails>(`/api/content/config/${courseId}`);
  const extensionConfig = obj(obj(config._extensions)[VALIDATOR_ENABLER_EXTENSION_TARGET]);

  return {
    ...DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS,
    pdfExportEnabled: bool(extensionConfig._isEnabled, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.pdfExportEnabled),
    coverPageSource: toValidatorAssetSource(extensionConfig._coverPageSource, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.coverPageSource),
    coverPageUrl: str(extensionConfig._coverPageUrl, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.coverPageUrl),
    footerLogoSource: toValidatorAssetSource(extensionConfig._footerLogoSource, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.footerLogoSource),
    footerLogoUrl: str(extensionConfig._footerLogoUrl, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.footerLogoUrl),
    tocPageTitles: bool(extensionConfig._tocPageTitles, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.tocPageTitles),
    tocArticleTitles: bool(extensionConfig._tocArticleTitles, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.tocArticleTitles),
    tocBlockTitles: bool(extensionConfig._tocBlockTitles, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.tocBlockTitles),
    tocComponentTitles: bool(extensionConfig._tocComponentTitles, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.tocComponentTitles),
    pdfTitle: str(extensionConfig._pdfTitle, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.pdfTitle),
    pdfAuthor: str(extensionConfig._pdfAuthor, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.pdfAuthor),
    pdfSubject: str(extensionConfig._pdfSubject, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.pdfSubject),
    pdfCopyright: str(extensionConfig._pdfCopyright, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.pdfCopyright),
    passwordEnabled: bool(extensionConfig._passwordEnabled, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.passwordEnabled),
    userPassword: str(extensionConfig._userPassword, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.userPassword),
    ownerPassword: str(extensionConfig._ownerPassword, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.ownerPassword),
    encryptionLevel: str(extensionConfig._encryptionLevel, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.encryptionLevel),
    disablePrinting: bool(extensionConfig._disablePrinting, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.disablePrinting),
    disableCopying: bool(extensionConfig._disableCopying, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.disableCopying),
    disableAnnotation: bool(extensionConfig._disableAnnotation, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.disableAnnotation),
    allowWatermarking: bool(extensionConfig._allowWatermarking, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.allowWatermarking),
    watermarkText: str(extensionConfig._watermarkText, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.watermarkText),
    watermarkPosition: str(extensionConfig._watermarkPosition, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.watermarkPosition),
  };
}

export async function saveValidatorEnablerPdfSettings(
  courseId: string,
  settings: ValidatorEnablerPdfSettings,
): Promise<void> {
  const shouldEnable = bool(settings.pdfExportEnabled, true);
  const config = await apiClient.get<EngineConfigDetails>(`/api/content/config/${courseId}`);
  const installed = isExtensionInstalledByTargetOrNames(
    config,
    VALIDATOR_ENABLER_EXTENSION_TARGET,
    VALIDATOR_ENABLER_EXTENSION_NAME_CANDIDATES,
  );

  if (shouldEnable && !installed) {
    const ids = await resolveExtensionTypeIdsByTargetOrNames(
      VALIDATOR_ENABLER_EXTENSION_TARGET,
      VALIDATOR_ENABLER_EXTENSION_NAME_CANDIDATES,
    );
    if (ids.length) await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
  } else if (!shouldEnable && installed) {
    const ids = await resolveExtensionTypeIdsByTargetOrNames(
      VALIDATOR_ENABLER_EXTENSION_TARGET,
      VALIDATOR_ENABLER_EXTENSION_NAME_CANDIDATES,
    );
    if (ids.length) await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
  }

  const freshConfig = shouldEnable === installed
    ? config
    : await apiClient.get<EngineConfigDetails>(`/api/content/config/${courseId}`);
  const existing = obj(obj(freshConfig._extensions)[VALIDATOR_ENABLER_EXTENSION_TARGET]);

  const nextValidatorConfig = {
    ...existing,
    _isEnabled: shouldEnable,
    _coverPageSource: settings.coverPageSource,
    _coverPageUrl: settings.coverPageUrl,
    _footerLogoSource: settings.footerLogoSource,
    _footerLogoUrl: settings.footerLogoUrl,
    _tocPageTitles: settings.tocPageTitles,
    _tocArticleTitles: settings.tocArticleTitles,
    _tocBlockTitles: settings.tocBlockTitles,
    _tocComponentTitles: settings.tocComponentTitles,
    _pdfTitle: settings.pdfTitle,
    _pdfAuthor: settings.pdfAuthor,
    _pdfSubject: settings.pdfSubject,
    _pdfCopyright: settings.pdfCopyright,
    _passwordEnabled: settings.passwordEnabled,
    _userPassword: settings.userPassword,
    _ownerPassword: settings.ownerPassword,
    _encryptionLevel: settings.encryptionLevel,
    _disablePrinting: settings.disablePrinting,
    _disableCopying: settings.disableCopying,
    _disableAnnotation: settings.disableAnnotation,
    _allowWatermarking: settings.allowWatermarking,
    _watermarkText: settings.watermarkText,
    _watermarkPosition: settings.watermarkPosition,
  };

  await apiClient.patch(`/api/content/config/${freshConfig._id}`, {
    _id: freshConfig._id,
    _courseId: courseId,
    _extensions: {
      ...obj(freshConfig._extensions),
      [VALIDATOR_ENABLER_EXTENSION_TARGET]: nextValidatorConfig,
    },
  });
}
