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

interface EngineCourseDetails {
  _id: string;
  _extensions?: Record<string, unknown>;
  [key: string]: unknown;
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
  pdfExportEnabled: false,
  coverPageSource: "library",
  coverPageUrl: "",
  footerLogoSource: "library",
  footerLogoUrl: "",
  tocPageTitles: true,
  tocArticleTitles: true,
  tocBlockTitles: true,
  tocComponentTitles: true,
  pdfTitle: "",
  pdfAuthor: "Adapt Learning Framework",
  pdfSubject: "eLearning Course Material",
  pdfCopyright: "© 2026 Laerdal Medical. All rights reserved.",
  passwordEnabled: false,
  userPassword: "",
  ownerPassword: "",
  encryptionLevel: "AES-256",
  disablePrinting: false,
  disableCopying: false,
  disableAnnotation: false,
  allowWatermarking: false,
  watermarkText: "Confidential",
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
  const [course, config] = await Promise.all([
    apiClient.get<EngineCourseDetails>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails>(`/api/content/config/${courseId}`),
  ]);
  const courseRootConfig = obj(course[VALIDATOR_ENABLER_EXTENSION_TARGET]);
  const courseExtensionConfig = obj(obj(course._extensions)[VALIDATOR_ENABLER_EXTENSION_TARGET]);
  const courseConfig = {
    ...courseRootConfig,
    ...courseExtensionConfig,
  };
  const globalConfig = obj(obj(config._extensions)[VALIDATOR_ENABLER_EXTENSION_TARGET]);
  const coverPageImage = str(courseConfig._coverPageImage, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.coverPageUrl);
  const footerLogoImage = str(courseConfig._pdfLogoImage, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.footerLogoUrl);

  return {
    ...DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS,
    pdfExportEnabled: bool(courseConfig._enablePdfExport, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.pdfExportEnabled),
    coverPageSource: coverPageImage.startsWith("http://") || coverPageImage.startsWith("https://") ? "url" : "library",
    coverPageUrl: coverPageImage,
    footerLogoSource: footerLogoImage.startsWith("http://") || footerLogoImage.startsWith("https://") ? "url" : "library",
    footerLogoUrl: footerLogoImage,
    tocPageTitles: bool(courseConfig._tocIncludeH1, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.tocPageTitles),
    tocArticleTitles: bool(courseConfig._tocIncludeH2, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.tocArticleTitles),
    tocBlockTitles: bool(courseConfig._tocIncludeH3, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.tocBlockTitles),
    tocComponentTitles: bool(courseConfig._tocIncludeH4, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.tocComponentTitles),
    pdfTitle: str(courseConfig._pdfTitle, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.pdfTitle),
    pdfAuthor: str(courseConfig._pdfAuthor, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.pdfAuthor),
    pdfSubject: str(courseConfig._pdfSubject, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.pdfSubject),
    pdfCopyright: str(courseConfig._pdfCopyright, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.pdfCopyright),
    passwordEnabled: bool(courseConfig._passwordProtection, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.passwordEnabled),
    userPassword: str(courseConfig._openPassword, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.userPassword),
    ownerPassword: str(courseConfig._ownerPassword, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.ownerPassword),
    encryptionLevel: str(courseConfig._encryptionLevel, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.encryptionLevel),
    disablePrinting: bool(courseConfig._disablePrinting, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.disablePrinting),
    disableCopying: bool(courseConfig._disableCopying, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.disableCopying),
    disableAnnotation: bool(courseConfig._disableAnnotations, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.disableAnnotation),
    allowWatermarking: bool(courseConfig._allowWatermark, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.allowWatermarking),
    watermarkText: str(courseConfig._watermarkText, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.watermarkText),
    watermarkPosition: str(courseConfig._position, DEFAULT_VALIDATOR_ENABLER_PDF_SETTINGS.watermarkPosition),
  };
}

export async function saveValidatorEnablerPdfSettings(
  courseId: string,
  settings: ValidatorEnablerPdfSettings,
): Promise<void> {
  const shouldEnable = bool(settings.pdfExportEnabled, false);
  let config = await apiClient.get<EngineConfigDetails>(`/api/content/config/${courseId}`);
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

  if (shouldEnable !== installed) {
    config = await apiClient.get<EngineConfigDetails>(`/api/content/config/${courseId}`);
  }
  const course = await apiClient.get<EngineCourseDetails>(`/api/content/course/${courseId}`);

  const existingConfig = obj(obj(config._extensions)[VALIDATOR_ENABLER_EXTENSION_TARGET]);
  const nextGlobalValidatorConfig = {
    ...existingConfig,
    _isEnabled: shouldEnable,
  };

  const existingCourseRoot = obj(course[VALIDATOR_ENABLER_EXTENSION_TARGET]);
  const existingCourseExtension = obj(obj(course._extensions)[VALIDATOR_ENABLER_EXTENSION_TARGET]);
  const coverPageImage = settings.coverPageSource === "url" ? settings.coverPageUrl : settings.coverPageUrl;
  const footerLogoImage = settings.footerLogoSource === "url" ? settings.footerLogoUrl : settings.footerLogoUrl;
  const nextCourseValidatorConfig = {
    ...existingCourseRoot,
    ...existingCourseExtension,
    _enablePdfExport: shouldEnable,
    _coverPageImage: coverPageImage,
    _tocIncludeH1: settings.tocPageTitles,
    _tocIncludeH2: settings.tocArticleTitles,
    _tocIncludeH3: settings.tocBlockTitles,
    _tocIncludeH4: settings.tocComponentTitles,
    _pdfTitle: settings.pdfTitle,
    _pdfAuthor: settings.pdfAuthor,
    _pdfSubject: settings.pdfSubject,
    _pdfCopyright: settings.pdfCopyright,
    _pdfLogoImage: footerLogoImage,
    _passwordProtection: settings.passwordEnabled,
    _openPassword: settings.userPassword,
    _ownerPassword: settings.ownerPassword,
    _encryptionLevel: settings.encryptionLevel,
    _disablePrinting: settings.disablePrinting,
    _disableCopying: settings.disableCopying,
    _disableAnnotations: settings.disableAnnotation,
    _allowWatermark: settings.allowWatermarking,
    _watermarkText: settings.watermarkText,
    _position: settings.watermarkPosition,
  };

  await apiClient.patch(`/api/content/config/${config._id}`, {
    _id: config._id,
    _courseId: courseId,
    _extensions: {
      ...obj(config._extensions),
      [VALIDATOR_ENABLER_EXTENSION_TARGET]: nextGlobalValidatorConfig,
    },
  });

  await apiClient.put(`/api/content/course/${courseId}`, {
    [VALIDATOR_ENABLER_EXTENSION_TARGET]: nextCourseValidatorConfig,
    _extensions: {
      ...obj(course._extensions),
      [VALIDATOR_ENABLER_EXTENSION_TARGET]: nextCourseValidatorConfig,
    },
  });
}
