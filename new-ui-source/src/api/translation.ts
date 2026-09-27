import { apiClient } from "./client";

export interface TranslationHealth {
  status: string;
  plugin: {
    name: string;
    version?: string;
    enabled: boolean;
  };
  checks: {
    configPresent: boolean;
    dependencyPresent: boolean;
  };
  error: string | null;
  timestamp: string;
}

export interface TranslationStringEntry {
  id?: string | number;
  file?: string;
  path?: string;
  value?: string;
  isGlobal?: boolean;
  section?: string;
  memoryTranslation?: string;
  hasMemory?: boolean;
  [key: string]: unknown;
}

export interface TranslationMemoryResponse {
  translations?: Record<string, unknown>;
}

export interface XliffImportResult {
  newCourseId: string;
  targetLanguage: string;
  importData?: unknown[];
}

export interface LeatsConfig {
  configured: boolean;
  deployment?: string;
  entriesPerPrompt?: number;
  languages: Array<{ locales: string; description: string }>;
}

type RawLeatsLanguage = {
  locales?: string;
  description?: string;
  code?: string;
  label?: string;
};

type RawLeatsConfig = Omit<LeatsConfig, "languages"> & {
  languages?: RawLeatsLanguage[];
};

export interface LeatsJobStatus {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  courseId: string;
  targetLanguage: string;
  totalUnique: number;
  totalStrings: number;
  translated: number;
  globalReused: number;
  totalChunks: number;
  chunksDone: number;
  retried: number;
  failed: number;
  newCourseId: string | null;
  error: string | null;
}

export interface MediaLocateDetails {
  configured: boolean;
  environment: string;
  baseUrl: string;
  credentialPresent: boolean;
  mtdGuidSource: string;
  lookupFailed: boolean;
  maxLocalesPerSubmission: number;
  supportedFormats: string[];
}

export interface SmartlingProjectDetails {
  [key: string]: unknown;
}

function unwrap<T>(response: { data?: T; error?: string; message?: string } | T): T {
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data?: T }).data as T;
  }
  return response as T;
}

async function getJson<T>(endpoint: string): Promise<T> {
  const response = await apiClient.get<{ success?: boolean; data?: T; error?: string; message?: string }>(endpoint);
  return unwrap<T>(response);
}

async function postJson<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await apiClient.post<{ success?: boolean; data?: T; error?: string; message?: string }>(endpoint, body);
  return unwrap<T>(response);
}

function normalizeLeatsLanguages(languages: RawLeatsLanguage[] | undefined): LeatsConfig["languages"] {
  return (languages || [])
    .map((language) => ({
      locales: language.locales || language.code || "",
      description: language.description || language.label || language.locales || language.code || "",
    }))
    .filter((language) => Boolean(language.locales) && Boolean(language.description));
}

export async function getTranslationHealth(): Promise<TranslationHealth> {
  return getJson<TranslationHealth>("/api/translation/health");
}

export async function getTranslationConfig(): Promise<Record<string, unknown>> {
  return getJson<Record<string, unknown>>("/api/translation/config");
}

export async function exportTranslationStrings(courseId: string): Promise<TranslationStringEntry[]> {
  return getJson<TranslationStringEntry[]>(`/api/translation/export/${encodeURIComponent(courseId)}`);
}

export async function getTranslationMemory(language: string): Promise<TranslationMemoryResponse> {
  return getJson<TranslationMemoryResponse>(`/api/translation/memory/${encodeURIComponent(language)}`);
}

export async function exportXliffFile(courseId: string, options: {
  includeExternalAssets: boolean;
  includeEmptyTarget: boolean;
  targetLanguage?: string;
  excludeAllGlobalStrings?: boolean;
  includeGlobalPaths?: string[];
}): Promise<Response> {
  const params = new URLSearchParams();
  params.set("include_external_assets", options.includeExternalAssets ? "true" : "false");
  params.set("include_empty_target", options.includeEmptyTarget ? "true" : "false");
  if (options.targetLanguage) params.set("target_language", options.targetLanguage);
  if (options.excludeAllGlobalStrings) params.set("exclude_all_global_strings", "true");
  if (options.includeGlobalPaths && options.includeGlobalPaths.length > 0) {
    params.set("include_global_paths", options.includeGlobalPaths.join(","));
  }

  return fetch(`/api/translation/xliff/export/${encodeURIComponent(courseId)}?${params.toString()}`, {
    credentials: "same-origin",
  });
}

export async function importXliffFile(courseId: string, file: File, importLanguage: string, skipValidation = false): Promise<XliffImportResult> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("importLanguage", importLanguage);
  if (skipValidation) {
    formData.set("skipValidation", "on");
  }

  const response = await fetch(`/api/translation/xliff/import/${encodeURIComponent(courseId)}`, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({ error: response.statusText }));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || response.statusText);
  }
  return unwrap<XliffImportResult>(payload);
}

export async function getLeatsConfig(): Promise<LeatsConfig> {
  const payload = await getJson<RawLeatsConfig>("/api/translation/leats/config");
  return {
    configured: Boolean(payload?.configured),
    deployment: payload?.deployment,
    entriesPerPrompt: payload?.entriesPerPrompt,
    languages: normalizeLeatsLanguages(payload?.languages),
  };
}

export async function getLeatsPrompt(): Promise<string> {
  const payload = await getJson<{ prompt?: string } | string>("/api/translation/leats/prompt");
  if (typeof payload === "string") {
    return payload;
  }
  return payload?.prompt || "";
}

export async function startLeatsTranslation(courseId: string, language: string, includeExternalAssetLinks: boolean, customPrompt?: string): Promise<{ jobId: string; status: string }> {
  const params = new URLSearchParams();
  params.set("target_language", language);
  params.set("include_external_assets", includeExternalAssetLinks ? "true" : "false");
  return postJson<{ jobId: string; status: string }>(`/api/translation/leats/translate/${encodeURIComponent(courseId)}?${params.toString()}`, customPrompt ? { customPrompt } : {});
}

export async function getLeatsStatus(jobId: string): Promise<LeatsJobStatus> {
  return getJson<LeatsJobStatus>(`/api/translation/leats/status/${encodeURIComponent(jobId)}`);
}

export async function getSmartlingDetails(projectId: string): Promise<SmartlingProjectDetails> {
  return getJson<SmartlingProjectDetails>(`/api/translation/smartling/details/${encodeURIComponent(projectId)}`);
}

export async function startSmartlingUpload(courseId: string, projectId: string, targetLanguage: string, includeExternalAssetLinks: boolean): Promise<unknown> {
  const params = new URLSearchParams();
  params.set("target_language", targetLanguage);
  params.set("include_external_assets", includeExternalAssetLinks ? "true" : "false");
  return getJson<unknown>(`/api/translation/smartling/upload/${encodeURIComponent(projectId)}/${encodeURIComponent(courseId)}?${params.toString()}`);
}

export async function downloadSmartlingTranslation(courseId: string, projectId: string, localeId: string): Promise<unknown> {
  return getJson<unknown>(`/api/translation/smartling/download/${encodeURIComponent(projectId)}/${encodeURIComponent(courseId)}/${encodeURIComponent(localeId)}`);
}

export async function getMediaLocateDetails(courseId: string): Promise<MediaLocateDetails> {
  const params = new URLSearchParams();
  params.set("courseId", courseId);
  return getJson<MediaLocateDetails>(`/api/translation/medialocate/details?${params.toString()}`);
}

export async function startMediaLocateUpload(
  courseId: string,
  targetLanguage: string,
  includeExternalAssets: boolean,
  projectName?: string,
  projectDescription?: string,
): Promise<{ trackingCode: string; projectName: string; targetLang: string }> {
  const params = new URLSearchParams();
  params.set("target_language", targetLanguage);
  params.set("include_external_assets", includeExternalAssets ? "true" : "false");
  if (projectName) params.set("project_name", projectName);
  if (projectDescription) params.set("project_description", projectDescription);
  return getJson<{ trackingCode: string; projectName: string; targetLang: string }>(`/api/translation/medialocate/upload/${encodeURIComponent(courseId)}?${params.toString()}`);
}

export async function getMediaLocateStatus(courseId: string, trackingCode: string, locale: string): Promise<unknown> {
  const params = new URLSearchParams();
  params.set("courseId", courseId);
  return getJson<unknown>(`/api/translation/medialocate/status/${encodeURIComponent(trackingCode)}/${encodeURIComponent(locale)}?${params.toString()}`);
}

export async function downloadMediaLocateTranslation(courseId: string, trackingCode: string, locale: string): Promise<unknown> {
  return getJson<unknown>(`/api/translation/medialocate/download/${encodeURIComponent(courseId)}/${encodeURIComponent(trackingCode)}/${encodeURIComponent(locale)}`);
}

export async function cancelMediaLocateTranslation(courseId: string, trackingCode: string): Promise<unknown> {
  const params = new URLSearchParams();
  params.set("courseId", courseId);
  return getJson<unknown>(`/api/translation/medialocate/cancel/${encodeURIComponent(trackingCode)}?${params.toString()}`);
}
