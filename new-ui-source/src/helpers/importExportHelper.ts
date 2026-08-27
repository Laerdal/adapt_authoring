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
