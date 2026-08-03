import { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, memo } from "react";
import { getAssets, trashAsset } from "@/api/adaptAuthoring";

type AssetFormat = "image" | "audio" | "video" | "other";

interface Asset {
  id: number;
  backendId?: string;   // engine _id — used for delete/trash
  title: string;
  description: string;
  size: string;
  format: AssetFormat;
  tags: string[];
  uploadedAt: string;
  thumbnail?: string;
}

const FORMAT_COLORS: Record<AssetFormat, string> = {
  image: "bg-[#dbeeff] text-[#1e4d73]",
  audio: "bg-[#f0fdf4] text-[#166534]",
  video: "bg-[#fef3c7] text-[#92400e]",
  other: "bg-[#f3f4f6] text-[#374151]",
};

const FORMAT_ICONS: Record<AssetFormat, React.ReactNode> = {
  image: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  audio: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
  video: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  ),
  other: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
};

const THUMBNAIL_COLORS: Record<AssetFormat, string> = {
  image: "bg-gradient-to-br from-[#dbeeff] to-[#93c5fd]",
  audio: "bg-gradient-to-br from-[#d1fae5] to-[#6ee7b7]",
  video: "bg-gradient-to-br from-[#fef3c7] to-[#fcd34d]",
  other: "bg-gradient-to-br from-[#f3f4f6] to-[#d1d5db]",
};

const INITIAL_ASSETS: Asset[] = [
  { id: 1,  title: "CPR Training Video",        description: "Step-by-step CPR demonstration for adult patients in emergency scenarios.", size: "48.2 MB", format: "video", tags: ["cpr", "training", "emergency"],      uploadedAt: "24-06-26" },
  { id: 2,  title: "Heart Anatomy Diagram",      description: "Detailed anatomical illustration of the human heart with labeled regions.", size: "2.4 MB",  format: "image", tags: ["anatomy", "heart", "diagram"],       uploadedAt: "23-06-26" },
  { id: 3,  title: "Defibrillator Audio Guide",  description: "Voice-guided instructions for using an AED device in public settings.", size: "8.1 MB",  format: "audio", tags: ["aed", "audio", "guide"],             uploadedAt: "22-06-26" },
  { id: 4,  title: "Airway Management Slides",   description: "Presentation slides covering airway assessment and intubation basics.", size: "5.7 MB",  format: "other", tags: ["airway", "slides", "presentation"],   uploadedAt: "21-06-26" },
  { id: 5,  title: "Patient Assessment Checklist", description: "Printable checklist for systematic patient assessment in clinical settings.", size: "320 KB", format: "other", tags: ["checklist", "assessment"],         uploadedAt: "20-06-26" },
  { id: 6,  title: "Medication Dosage Chart",    description: "Quick-reference chart for common emergency medication dosages by weight.", size: "1.1 MB",  format: "image", tags: ["medication", "dosage", "reference"], uploadedAt: "19-06-26" },
  { id: 7,  title: "Simulation Scenario Audio",  description: "Background audio track for realistic hospital simulation environment.", size: "22.5 MB", format: "audio", tags: ["simulation", "audio", "scenario"],    uploadedAt: "18-06-26" },
  { id: 8,  title: "IV Insertion Technique",     description: "Close-up footage demonstrating correct peripheral IV catheter insertion.", size: "91.3 MB", format: "video", tags: ["iv", "technique", "clinical"],       uploadedAt: "17-06-26" },
  { id: 9,  title: "ECG Pattern Reference",      description: "Visual guide to common ECG arrhythmia patterns for quick identification.", size: "3.8 MB",  format: "image", tags: ["ecg", "cardiac", "reference"],      uploadedAt: "16-06-26" },
  { id: 10, title: "Module Completion Sound",    description: "Short celebratory audio cue played on module completion.", size: "180 KB", format: "audio", tags: ["audio", "ui", "feedback"],             uploadedAt: "15-06-26" },
];

type ViewMode = "grid" | "list";

// ── Upload types ─────────────────────────────────────────────────────────────

type UploadStep = "pick" | "details" | "uploading" | "done" | "error";

interface FileValidation {
  ok: boolean;
  error?: string;
}

interface UploadFormErrors {
  title?: string;
  description?: string;
}

interface UploadState {
  step: UploadStep;
  file: File | null;
  fileValidation: FileValidation;
  title: string;
  description: string;
  tags: string;
  formErrors: UploadFormErrors;
  progress: number;
  uploadedAssetId: number | null;
}

interface EditModalState {
  asset: Asset | null;
  title: string;
  description: string;
  tags: string;
  replaceFile: File | null;
}

// Accepted MIME types grouped by format
const ACCEPTED_MIME: Record<AssetFormat, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a"],
  video: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
  other: [],
};
const ACCEPTED_EXTS: Record<AssetFormat, string[]> = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
  audio: ["mp3", "wav", "ogg", "m4a"],
  video: ["mp4", "webm", "mov", "avi"],
  other: [],
};
const MAX_SIZE_MB = 500;

function detectFormat(file: File): AssetFormat {
  const mime = file.type.toLowerCase();
  for (const fmt of (["image", "audio", "video"] as AssetFormat[])) {
    if (ACCEPTED_MIME[fmt].includes(mime)) return fmt;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  for (const fmt of (["image", "audio", "video"] as AssetFormat[])) {
    if (ACCEPTED_EXTS[fmt].includes(ext)) return fmt;
  }
  return "other";
}

function validateFile(file: File): FileValidation {
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_SIZE_MB) {
    return { ok: false, error: `File is too large (${sizeMB.toFixed(1)} MB). Maximum allowed size is ${MAX_SIZE_MB} MB.` };
  }
  if (file.size === 0) {
    return { ok: false, error: "File appears to be empty." };
  }
  return { ok: true };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateUploadForm(title: string, description: string): UploadFormErrors {
  const errors: UploadFormErrors = {};
  if (!title.trim()) errors.title = "Title is required.";
  else if (title.trim().length < 3) errors.title = "Title must be at least 3 characters.";
  else if (title.trim().length > 120) errors.title = "Title must be 120 characters or fewer.";
  if (!description.trim()) errors.description = "Description is required.";
  return errors;
}

const EMPTY_UPLOAD: UploadState = {
  step: "pick",
  file: null,
  fileValidation: { ok: true },
  title: "",
  description: "",
  tags: "",
  formErrors: {},
  progress: 0,
  uploadedAssetId: null,
};

const EMPTY_EDIT = (a: Asset): EditModalState => ({
  asset: a,
  title: a.title,
  description: a.description,
  tags: a.tags.join(", "),
  replaceFile: null,
});

let nextId = INITIAL_ASSETS.length + 1;

function formatBytes(raw: string) { return raw; }

// List-item components live at module scope (not inside AssetManagementPage) so
// their identity is stable across renders. Declaring them inside the page made
// React remount the entire asset list on every keystroke (search/upload/edit
// state all live on the page), which caused the visible typing lag. memo() then
// skips re-rendering a card whose asset/handlers are unchanged.
interface AssetItemProps {
  asset: Asset;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
}

const AssetCardItem = memo(function AssetCardItem({ asset, onEdit, onDelete }: AssetItemProps) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col group">
      {/* Thumbnail */}
      <div className={`h-32 ${THUMBNAIL_COLORS[asset.format]} flex items-center justify-center`}>
        <span className={`${FORMAT_COLORS[asset.format].split(" ")[1]} opacity-60`}>
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            {asset.format === "image" && <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />}
            {asset.format === "audio" && <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />}
            {asset.format === "video" && <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />}
            {asset.format === "other" && <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />}
          </svg>
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#111827] leading-tight line-clamp-2">{asset.title}</h3>
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${FORMAT_COLORS[asset.format]}`}>
            {FORMAT_ICONS[asset.format]}
            {asset.format}
          </span>
        </div>

        <p className="text-xs text-[#6b7280] line-clamp-2 leading-relaxed">{asset.description || "No description."}</p>

        <div className="flex items-center gap-3 text-xs text-[#9ca3af] mt-auto pt-1">
          <span className="flex items-center gap-1">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {formatBytes(asset.size)}
          </span>
        </div>

        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {asset.tags.slice(0, 3).map((t) => (
              <span key={t} className="px-1.5 py-0.5 bg-[#f3f4f6] text-[#6b7280] rounded text-[10px]">#{t}</span>
            ))}
            {asset.tags.length > 3 && <span className="px-1.5 py-0.5 text-[10px] text-[#9ca3af]">+{asset.tags.length - 3}</span>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-[#f3f4f6] flex items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(asset)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(asset)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#ef4444] border border-[#fecaca] rounded-lg hover:bg-[#fef2f2] transition-colors"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
});

const AssetListItem = memo(function AssetListItem({ asset, onEdit, onDelete }: AssetItemProps) {
  return (
    <tr className="border-b border-[#f3f4f6] hover:bg-[#fafafa] transition-colors group/row">
      {/* Icon + Title */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${THUMBNAIL_COLORS[asset.format]} flex items-center justify-center shrink-0`}>
            <span className={`${FORMAT_COLORS[asset.format].split(" ")[1]} opacity-70`}>{FORMAT_ICONS[asset.format]}</span>
          </div>
          <span className="text-sm font-medium text-[#111827]">{asset.title}</span>
        </div>
      </td>

      {/* Description */}
      <td className="px-4 py-3 max-w-xs">
        <p className="text-sm text-[#6b7280] truncate">{asset.description || "—"}</p>
      </td>

      {/* Size */}
      <td className="px-4 py-3 text-sm text-[#6b7280] whitespace-nowrap">{asset.size}</td>

      {/* Format */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${FORMAT_COLORS[asset.format]}`}>
          {FORMAT_ICONS[asset.format]}
          {asset.format}
        </span>
      </td>

      {/* Tags */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {asset.tags.slice(0, 2).map((t) => (
            <span key={t} className="px-1.5 py-0.5 bg-[#f3f4f6] text-[#6b7280] rounded text-[10px]">#{t}</span>
          ))}
          {asset.tags.length > 2 && <span className="text-[10px] text-[#9ca3af]">+{asset.tags.length - 2}</span>}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onEdit(asset)}
            title="Edit asset"
            className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#2d6fa8] hover:bg-[#dbeeff] transition-colors"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(asset)}
            title="Delete asset"
            className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-colors"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function AssetManagementPage() {
  const [assets, setAssets]             = useState<Asset[]>([]);

  const loadAssets = () => { getAssets().then(setAssets).catch(() => setAssets([])); };
  useEffect(() => { loadAssets(); }, []);
  const [search, setSearch]             = useState("");
  const [formatFilter, setFormatFilter] = useState<AssetFormat | "All">("All");
  const [view, setView]                 = useState<ViewMode>("grid");
  const [filterOpen, setFilterOpen]     = useState(false);

  const [uploadOpen, setUploadOpen]     = useState(false);
  const [upload, setUpload]             = useState<UploadState>(EMPTY_UPLOAD);
  const [uploadDrag, setUploadDrag]     = useState(false);

  const [editState, setEditState]       = useState<EditModalState | null>(null);
  const [editDrag, setEditDrag]         = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);

  const filterRef      = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const editFileRef    = useRef<HTMLInputElement>(null);
  const progressTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // ESC closes modals (not during upload)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (upload.step !== "uploading") {
          setUploadOpen(false);
          setUpload(EMPTY_UPLOAD);
        }
        setEditState(null);
        setDeleteTarget(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [upload.step]);

  // Clean up progress timer on unmount
  useEffect(() => {
    return () => { if (progressTimer.current) clearInterval(progressTimer.current); };
  }, []);

  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return assets.filter((a) => {
      const matchSearch =
        q === "" ||
        a.title.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q));
      const matchFormat = formatFilter === "All" || a.format === formatFilter;
      return matchSearch && matchFormat;
    });
  }, [assets, deferredSearch, formatFilter]);

  // ── Upload: step "pick" ───────────────────────────────────────────────────
  const handleUploadFile = useCallback((f: File | null) => {
    if (!f) return;
    const validation = validateFile(f);
    const autoTitle = f.name.replace(/\.[^.]+$/, "");
    setUpload((prev) => ({
      ...prev,
      file: f,
      fileValidation: validation,
      title: prev.title || autoTitle,
      formErrors: {},
    }));
  }, []);

  function handleUploadDrop(e: React.DragEvent) {
    e.preventDefault();
    setUploadDrag(false);
    handleUploadFile(e.dataTransfer.files[0] ?? null);
  }

  // ── Upload: validate → upload ─────────────────────────────────────────────
  function startUpload() {
    const errors = validateUploadForm(upload.title, upload.description);
    if (Object.keys(errors).length > 0) {
      setUpload((prev) => ({ ...prev, formErrors: errors }));
      return;
    }

    if (!upload.file) return;

    const fmt = detectFormat(upload.file);
    const newAsset: Asset = {
      id: nextId++,
      title: upload.title.trim(),
      description: upload.description.trim(),
      size: formatFileSize(upload.file.size),
      format: fmt,
      tags: upload.tags.split(",").map((t) => t.trim()).filter(Boolean),
      uploadedAt: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, "-"),
    };

    setUpload((prev) => ({ ...prev, step: "uploading", progress: 0, formErrors: {} }));

    // Simulate upload progress (scaled to ~2s for small files, ~4s for large)
    const totalMs = Math.min(4000, Math.max(1500, upload.file.size / 50000));
    const intervalMs = 60;
    const increment = (intervalMs / totalMs) * 100;

    progressTimer.current = setInterval(() => {
      setUpload((prev) => {
        const next = Math.min(prev.progress + increment + (Math.random() * increment * 0.4), 98);
        if (next >= 98) {
          clearInterval(progressTimer.current!);
          // Finalise after a short pause at 98%
          setTimeout(() => {
            setAssets((a) => [newAsset, ...a]);
            setUpload((p) => ({ ...p, step: "done", progress: 100, uploadedAssetId: newAsset.id }));
          }, 350);
        }
        return { ...prev, progress: next };
      });
    }, intervalMs);
  }

  function closeUpload() {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setUploadOpen(false);
    setUpload(EMPTY_UPLOAD);
  }

  // ── Edit ────────────────────────────────────────────────────────────────
  function saveEdit() {
    if (!editState?.asset || !editState.title.trim() || !editState.description.trim()) return;
    setAssets((prev) => prev.map((a) =>
      a.id === editState.asset!.id
        ? {
            ...a,
            title: editState.title.trim(),
            description: editState.description.trim(),
            tags: editState.tags.split(",").map((t) => t.trim()).filter(Boolean),
          }
        : a
    ));
    setEditState(null);
  }

  function handleEditDrop(e: React.DragEvent) {
    e.preventDefault();
    setEditDrag(false);
    const f = e.dataTransfer.files[0] ?? null;
    if (f) setEditState((prev) => prev ? { ...prev, replaceFile: f } : prev);
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  async function confirmDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target?.backendId) return;
    setAssets((prev) => prev.filter((a) => a.id !== target.id));
    try {
      await trashAsset(target.backendId);
    } finally {
      loadAssets();
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const FORMAT_LABELS: Record<AssetFormat | "All", string> = {
    All: "All Types",
    image: "Image",
    audio: "Audio",
    video: "Video",
    other: "Other",
  };

  const FORMATS: (AssetFormat | "All")[] = ["All", "image", "audio", "video", "other"];

  // Stable handlers so the memoized list items don't re-render on every keystroke.
  const handleEditAsset   = useCallback((asset: Asset) => setEditState(EMPTY_EDIT(asset)), []);
  const handleDeleteAsset = useCallback((asset: Asset) => setDeleteTarget(asset), []);

  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ── */}
      <div className="px-6 md:px-8 pt-6 pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#111827] leading-tight">Asset Management</h1>
          <p className="text-sm text-[#6b7280] mt-1">Upload, organize, and manage your course assets.</p>
        </div>
        <button
          type="button"
          onClick={() => { setUpload(EMPTY_UPLOAD); setUploadOpen(true); }}
          className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors shadow-sm"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="hidden sm:inline">Upload Asset</span>
          <span className="sm:hidden">Upload</span>
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="px-6 md:px-8 pb-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setSearch(""); }}
            placeholder="Search by name or tag…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent bg-white placeholder-[#9ca3af] text-[#111827] transition-colors"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Format filter */}
        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
              formatFilter !== "All"
                ? "border-[#2d6fa8] bg-[#dbeeff] text-[#2d6fa8] font-medium"
                : "border-[#e5e7eb] bg-white hover:bg-[#f9fafb] text-[#374151]"
            }`}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            {FORMAT_LABELS[formatFilter]}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${filterOpen ? "rotate-180" : ""}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {filterOpen && (
            <div className="absolute left-0 mt-1 w-44 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-30 py-1">
              <p className="px-3 py-1.5 text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Filter by type</p>
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { setFormatFilter(f); setFilterOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${formatFilter === f ? "bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"}`}
                >
                  <span className="flex items-center gap-2">
                    {f !== "All" && <span className={FORMAT_COLORS[f as AssetFormat].split(" ")[1]}>{FORMAT_ICONS[f as AssetFormat]}</span>}
                    {FORMAT_LABELS[f]}
                  </span>
                  {formatFilter === f && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {(search || formatFilter !== "All") && (
          <div className="flex items-center gap-2 flex-wrap">
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f3f4f6] text-xs text-[#374151] font-medium">
                "{search}"
                <button type="button" onClick={() => setSearch("")} className="text-[#9ca3af] hover:text-[#374151]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            )}
            {formatFilter !== "All" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#dbeeff] text-xs text-[#2d6fa8] font-medium">
                {FORMAT_LABELS[formatFilter]}
                <button type="button" onClick={() => setFormatFilter("All")} className="text-[#2d6fa8] hover:text-[#1e4d73]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        )}

        <span className="ml-auto text-xs text-[#9ca3af]">{filtered.length} asset{filtered.length !== 1 ? "s" : ""}</span>

        {/* View toggle */}
        <div className="flex items-center border border-[#e5e7eb] rounded-lg overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setView("grid")}
            title="Grid view"
            className={`p-2 transition-colors ${view === "grid" ? "bg-[#2d6fa8] text-white" : "text-[#6b7280] hover:bg-[#f9fafb]"}`}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            title="List view"
            className={`p-2 transition-colors ${view === "list" ? "bg-[#2d6fa8] text-white" : "text-[#6b7280] hover:bg-[#f9fafb]"}`}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-6 md:px-8 pb-6 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#f3f4f6] flex items-center justify-center mb-4">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#374151]">No assets found</p>
            <p className="text-xs text-[#9ca3af] mt-1">Try adjusting your search or filter, or upload a new asset.</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((a) => <AssetCardItem key={a.id} asset={a} onEdit={handleEditAsset} onDelete={handleDeleteAsset} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-[#e5e7eb] overflow-hidden bg-white">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#374151] uppercase tracking-wide">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#374151] uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#374151] uppercase tracking-wide whitespace-nowrap">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#374151] uppercase tracking-wide">Format</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#374151] uppercase tracking-wide">Tags</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#374151] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => <AssetListItem key={a.id} asset={a} onEdit={handleEditAsset} onDelete={handleDeleteAsset} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          Upload Modal — multi-step: pick → details → uploading → done
      ════════════════════════════════════════════════════════════════ */}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget && upload.step !== "uploading") closeUpload(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

            {/* ── Header ── */}
            <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-[#111827] text-base">Upload Asset</h2>
              {upload.step !== "uploading" && (
                <button type="button" onClick={closeUpload} className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* ══════════════ Single-step form ══════════════ */}
            {(upload.step === "pick" || upload.step === "details") && (
              <>
                <div className="px-6 py-5 overflow-y-auto flex flex-col gap-4">
                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setUploadDrag(true); }}
                    onDragLeave={() => setUploadDrag(false)}
                    onDrop={handleUploadDrop}
                    onClick={() => uploadInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                      uploadDrag
                        ? "border-[#2d6fa8] bg-[#dbeeff]"
                        : upload.file && !upload.fileValidation.ok
                          ? "border-[#ef4444] bg-[#fef2f2]"
                          : upload.file && upload.fileValidation.ok
                            ? "border-[#22c55e] bg-[#f0fdf4]"
                            : "border-[#d1d5db] hover:border-[#2d6fa8] hover:bg-[#f9fafb]"
                    }`}
                  >
                    {upload.file ? (
                      <>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          upload.fileValidation.ok ? "bg-[#dcfce7]" : "bg-[#fef2f2]"
                        }`}>
                          {upload.fileValidation.ok ? (
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={1.8}>
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                          )}
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-semibold ${upload.fileValidation.ok ? "text-[#15803d]" : "text-[#dc2626]"}`}>
                            {upload.file.name}
                          </p>
                          <p className="text-xs text-[#6b7280] mt-0.5">{formatFileSize(upload.file.size)}</p>
                        </div>
                        {upload.fileValidation.error && (
                          <p className="text-xs text-[#ef4444] font-medium text-center">{upload.fileValidation.error}</p>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setUpload((p) => ({ ...p, file: null, fileValidation: { ok: true }, title: "" })); }}
                          className="text-xs text-[#9ca3af] hover:text-[#374151] underline underline-offset-2"
                        >
                          Choose a different file
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-xl bg-[#f3f4f6] flex items-center justify-center">
                          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-[#374151]">Drop file here or click to browse</p>
                          <p className="text-xs text-[#9ca3af] mt-1">Images, audio, video, or documents — max {MAX_SIZE_MB} MB</p>
                        </div>
                      </>
                    )}
                  </div>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    className="hidden"
                    aria-label="Choose file to upload"
                    title="Choose file to upload"
                    onChange={(e) => handleUploadFile(e.target.files?.[0] ?? null)}
                  />

                  {/* Asset Title */}
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                      Asset Title <span className="text-[#ef4444]">*</span>
                    </label>
                    <input
                      type="text"
                      value={upload.title}
                      onChange={(e) => setUpload((p) => ({ ...p, title: e.target.value, formErrors: { ...p.formErrors, title: undefined } }))}
                      placeholder="Enter asset title"
                      maxLength={120}
                      aria-invalid={upload.formErrors.title ? "true" : "false"}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent placeholder-[#9ca3af] transition-colors ${
                        upload.formErrors.title
                          ? "border-[#ef4444] focus:ring-[#ef4444]"
                          : "border-[#e5e7eb] focus:ring-[#2d6fa8]"
                      }`}
                    />
                    <div className="flex items-center justify-between mt-1">
                      {upload.formErrors.title ? (
                        <p className="text-xs text-[#ef4444] flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {upload.formErrors.title}
                        </p>
                      ) : <span />}
                      <span className={`text-xs tabular-nums ${upload.title.length > 100 ? "text-[#f59e0b]" : "text-[#9ca3af]"}`}>
                        {upload.title.length}/120
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                      Description <span className="text-[#ef4444]">*</span>
                    </label>
                    <textarea
                      value={upload.description}
                      onChange={(e) => setUpload((p) => ({ ...p, description: e.target.value, formErrors: { ...p.formErrors, description: undefined } }))}
                      placeholder="Describe what this asset is and how it should be used…"
                      rows={3}
                      aria-invalid={upload.formErrors.description ? "true" : "false"}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent placeholder-[#9ca3af] resize-none transition-colors ${
                        upload.formErrors.description
                          ? "border-[#ef4444] focus:ring-[#ef4444]"
                          : "border-[#e5e7eb] focus:ring-[#2d6fa8]"
                      }`}
                    />
                    {upload.formErrors.description && (
                      <p className="text-xs text-[#ef4444] flex items-center gap-1 mt-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {upload.formErrors.description}
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">Tags</label>
                    <input
                      type="text"
                      value={upload.tags}
                      onChange={(e) => setUpload((p) => ({ ...p, tags: e.target.value }))}
                      placeholder="cpr, training, emergency"
                      className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
                    />
                    <p className="text-xs text-[#9ca3af] mt-1">Separate tags with commas</p>
                    {upload.tags && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {upload.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-[#f3f4f6] text-[#6b7280] rounded text-xs">#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb] shrink-0">
                  <button type="button" onClick={closeUpload} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={startUpload}
                    disabled={!upload.file || !upload.fileValidation.ok}
                    className="px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    Upload
                  </button>
                </div>
              </>
            )}

            {/* ══════════════ Uploading ══════════════ */}
            {upload.step === "uploading" && (
              <div className="px-6 py-10 flex flex-col items-center gap-5">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full bg-[#dbeeff] animate-ping opacity-30" />
                  <div className="relative w-16 h-16 rounded-full bg-[#dbeeff] flex items-center justify-center">
                    <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#2d6fa8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#111827]">Uploading "{upload.title}"</p>
                  <p className="text-xs text-[#9ca3af] mt-1">{upload.file ? formatFileSize(upload.file.size) : ""} · Please wait…</p>
                </div>
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-[#6b7280]">Progress</span>
                    <span className="text-xs font-semibold text-[#2d6fa8] tabular-nums">{Math.round(upload.progress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                    {/* Progress width must be inline — it's a runtime value that cannot be a static Tailwind class */}
                    {/* eslint-disable-next-line react/forbid-dom-props */}
                    <div
                      className="h-full bg-[#2d6fa8] rounded-full transition-all duration-150"
                      style={{ width: `${upload.progress}%` }} // skipcq: JS-0394
                    />
                  </div>
                </div>
                <p className="text-xs text-[#9ca3af]">Do not close this window.</p>
              </div>
            )}

            {/* ══════════════ Done ══════════════ */}
            {upload.step === "done" && (
              <>
                <div className="px-6 py-10 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-[#dcfce7] flex items-center justify-center">
                    <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-[#111827]">Upload complete!</p>
                    <p className="text-sm text-[#6b7280] mt-1">
                      <span className="font-medium text-[#111827]">"{upload.title}"</span> has been added to your assets.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb] shrink-0">
                  <button
                    type="button"
                    onClick={() => { setUpload(EMPTY_UPLOAD); }}
                    className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
                  >
                    Upload Another
                  </button>
                  <button
                    type="button"
                    onClick={closeUpload}
                    className="px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          Edit Modal
      ════════════════════════════════════════════════════════════════ */}
      {editState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditState(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-[#111827] text-base">Edit Asset</h2>
              <button type="button" onClick={() => setEditState(null)} className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto flex flex-col gap-4">
              {/* Replace file drop zone */}
              <div>
                <p className="text-xs font-semibold text-[#374151] mb-1.5">Replace File (optional)</p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setEditDrag(true); }}
                  onDragLeave={() => setEditDrag(false)}
                  onDrop={handleEditDrop}
                  onClick={() => editFileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors ${
                    editDrag ? "border-[#2d6fa8] bg-[#dbeeff]" : "border-[#d1d5db] hover:border-[#2d6fa8] hover:bg-[#f9fafb]"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#f3f4f6] flex items-center justify-center shrink-0">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                  </div>
                  {editState.replaceFile ? (
                    <p className="text-sm font-medium text-[#2d6fa8]">{editState.replaceFile.name}</p>
                  ) : (
                    <p className="text-sm text-[#6b7280]">Drop a new file here or click to browse</p>
                  )}
                </div>
                <input ref={editFileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f) setEditState((p) => p ? { ...p, replaceFile: f } : p); }} />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Title <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  value={editState.title}
                  onChange={(e) => setEditState((p) => p ? { ...p, title: e.target.value } : p)}
                  placeholder="Asset title"
                  className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Description <span className="text-[#ef4444]">*</span>
                </label>
                <textarea
                  value={editState.description}
                  onChange={(e) => setEditState((p) => p ? { ...p, description: e.target.value } : p)}
                  placeholder="Describe this asset…"
                  rows={3}
                  aria-invalid={!editState.description.trim() ? "true" : "false"}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent placeholder-[#9ca3af] resize-none transition-colors ${
                    !editState.description.trim()
                      ? "border-[#ef4444] focus:ring-[#ef4444]"
                      : "border-[#e5e7eb] focus:ring-[#2d6fa8]"
                  }`}
                />
                {!editState.description.trim() && (
                  <p className="text-xs text-[#ef4444] mt-1">Description is required.</p>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">Tags</label>
                <input
                  type="text"
                  value={editState.tags}
                  onChange={(e) => setEditState((p) => p ? { ...p, tags: e.target.value } : p)}
                  placeholder="tag1, tag2, tag3"
                  className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
                />
                <p className="text-xs text-[#9ca3af] mt-1">Separate tags with commas</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb] shrink-0">
              <button
                type="button"
                onClick={() => setEditState(null)}
                className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={!editState.title.trim() || !editState.description.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          Delete Confirmation Modal
      ════════════════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#fef2f2] flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-[#111827] text-base">Delete Asset</h2>
                  <p className="text-sm text-[#6b7280] mt-1">
                    Are you sure you want to delete <span className="font-medium text-[#111827]">"{deleteTarget.title}"</span>?
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-5">
              <div className="p-4 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
                <p className="text-sm text-[#b91c1c]">
                  ⚠ This action cannot be undone. The asset will be permanently removed.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#ef4444] hover:bg-[#dc2626] rounded-lg transition-colors"
              >
                Delete Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
