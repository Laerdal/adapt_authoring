export interface ExportSourceResponse {
  success?: boolean;
  message?: string;
}

export interface ExportSourceActionOptions {
  exportingSource: boolean;
  tenantId?: string;
  courseId: string;
  setExportingSource: (value: boolean) => void;
  onUnavailable?: () => void;
  onError?: (message: string) => void;
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
    onUnavailable,
    onError,
  } = options;

  if (exportingSource) return;

  if (!courseId || !tenantId) {
    onUnavailable?.();
    return;
  }

  setExportingSource(true);
  try {
    await exportSourceCourse(tenantId, courseId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Export failed";
    onError?.(message);
  } finally {
    setExportingSource(false);
  }
}
