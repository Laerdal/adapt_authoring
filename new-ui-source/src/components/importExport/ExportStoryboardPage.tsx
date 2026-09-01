import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exportStoryboardCourseZip } from "../../helpers/importExportHelper";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9ca3af]">{children}</div>;
}

function Divider() {
  return <div className="h-px bg-[#e5e7eb]" />;
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.76 5.83a1 1 0 0 1 1.41 0L11 7.66V13a1 1 0 1 0 2 0V7.66l1.83 1.83a1 1 0 0 0 1.41-1.41l-3.54-3.54a1 1 0 0 0-1.41 0L7.76 8.08a1 1 0 0 0 0 1.41"
        fill="currentColor"
      />
      <path
        d="M3 14a1 1 0 0 1 1 1v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3a1 1 0 1 1 2 0v3a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1"
        fill="currentColor"
      />
    </svg>
  );
}

type Toast = { type: "success" | "error"; message: string } | null;

export default function ExportStoryboardPage({
  courseId,
}: {
  courseId: string;
}) {
  const navigate = useNavigate();
  const [includeDisplayProp, setIncludeDisplayProp] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importComplete, setImportComplete] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const fileLabel = useMemo(() => {
    if (!selectedFile) return "No file selected";
    const sizeMb = selectedFile.size / (1024 * 1024);
    return `${selectedFile.name} (${sizeMb.toFixed(1)} MB)`;
  }, [selectedFile]);

  async function handleExportZip() {
    if (!courseId || exporting) return;
    setExporting(true);
    try {
      await exportStoryboardCourseZip(courseId, includeDisplayProp);
      setToast({ type: "success", message: "Storyboard package downloaded successfully" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed";
      setToast({ type: "error", message: `Unable to export storyboard. ${message}` });
    } finally {
      setExporting(false);
    }
  }

  function onChooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      setImportComplete(false);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      setToast({ type: "error", message: "Only .docx files are supported" });
      setSelectedFile(null);
      setImportComplete(false);
      return;
    }

    const maxBytes = 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      setToast({ type: "error", message: "File size is too large. Maximum size is 50MB" });
      setSelectedFile(null);
      setImportComplete(false);
      return;
    }

    setSelectedFile(file);
    setImportComplete(false);
  }

  async function handleImportChanges() {
    if (!courseId || !selectedFile || importing) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`/api/storyboard/import/${encodeURIComponent(courseId)}`, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null) as { success?: boolean; error?: string; message?: string } | null;
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || payload?.message || `Import failed (${response.status})`);
      }

      setImportComplete(true);
      setToast({ type: "success", message: "Storyboard imported successfully" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      setToast({ type: "error", message: `Unable to import storyboard. ${message}` });
      setImportComplete(false);
    } finally {
      setImporting(false);
    }
  }

  function handleCancelImport() {
    setSelectedFile(null);
    setImportComplete(false);
  }

  return (
    <div className="flex w-full max-w-[760px] flex-col gap-7">
      <div className="flex flex-col gap-1">
        <h1 className="text-[20px] font-bold text-[#111827]">Storyboard</h1>
      </div>

      <section className="flex flex-col gap-3.5 rounded-lg border border-[#e5e7eb] bg-white p-5">
        <SectionTitle>Export Storyboard</SectionTitle>
        <p className="text-sm text-[#374151]">Generate and download a storyboard package for your course content.</p>
        <div className="rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-4">
          <p className="text-sm font-semibold text-[#111827]">Your package will include:</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-[#374151]">
            <li>.docx file</li>
            <li>assets folder</li>
            <li>README.txt (instructions)</li>
          </ul>
        </div>
        <label className="inline-flex items-center gap-3 text-sm text-[#374151] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeDisplayProp}
            onChange={(event) => setIncludeDisplayProp(event.target.checked)}
            className="h-4 w-4 rounded border-2 border-[#d1d5db] accent-[#2d6fa8]"
          />
          <span>Ignore plugin-specific properties from the storyboard</span>
        </label>
        <Divider />
        <div>
          <button
            type="button"
            disabled={!courseId || exporting}
            onClick={() => void handleExportZip()}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#2d6fa8] px-6 text-sm font-bold text-white transition-colors hover:bg-[#245c8f] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? "Generating ZIP Package..." : "Download Zip Package"}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3.5 rounded-lg border border-[#e5e7eb] bg-white p-5">
        <SectionTitle>Import Storyboard</SectionTitle>
        <p className="text-sm text-[#374151]">Upload the updated Word document (.docx) to update your course content.</p>

        <label className="rounded-lg border border-dashed border-[#d1d5db] bg-[#f8fafc] p-5 cursor-pointer hover:bg-[#f1f5f9] transition-colors">
          <input type="file" accept=".docx" className="hidden" onChange={onChooseFile} />
          <div className="flex items-center gap-3 text-[#6b7280]">
            <UploadIcon />
            <div>
              <p className="text-sm font-semibold text-[#374151]">Choose a .docx file</p>
              <p className="text-xs text-[#6b7280]">Maximum file size: 50MB</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#111827]">{fileLabel}</p>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!selectedFile || importing}
            onClick={() => void handleImportChanges()}
            className="inline-flex h-10 items-center rounded-lg bg-[var(--life-primary-500)] px-5 text-sm font-semibold text-white hover:bg-[var(--life-primary-700)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? "Importing..." : "Import Changes"}
          </button>
          <button
            type="button"
            disabled={!importComplete}
            onClick={() => navigate(`/course/${courseId}/preview`)}
            className="inline-flex h-10 items-center rounded-lg border border-[#d1d5db] bg-white px-5 text-sm font-semibold text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Preview Course
          </button>
          <button
            type="button"
            disabled={!selectedFile || importing}
            onClick={handleCancelImport}
            className="inline-flex h-10 items-center rounded-lg border border-[#d1d5db] bg-white px-5 text-sm font-semibold text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </section>

      {toast && (
        <div className="fixed top-4 right-4 z-[60] pointer-events-none">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border pointer-events-auto min-w-[280px] max-w-sm ${
              toast.type === "error"
                ? "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]"
                : "bg-[var(--life-positive-050)] border-[var(--life-positive-100)] text-[var(--life-positive-500)]"
            }`}
          >
            <span className="flex-1">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
