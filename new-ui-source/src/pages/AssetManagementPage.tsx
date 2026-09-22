import { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, memo } from "react";
import { getAssets, trashAsset, restoreAsset, updateAsset, uploadAsset } from "@/api/adaptAuthoring";
import type { AssetFormat, DashboardAsset } from "@/api/adaptAuthoring";
import AiAssistant from "@/components/common/AiAssistant";
import type { AssetPickerResult, AssetPickerType } from "@/types/assetPicker";

type Asset = DashboardAsset;

interface AssetManagementWorkspaceProps {
  pickerMode?: boolean;
  pickerAssetType?: AssetPickerType;
  pickerTitle?: string;
  pickerDescription?: string;
  onPickAsset?: (asset: AssetPickerResult) => void;
  onCancelPick?: () => void;
  hideAssistant?: boolean;
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
  uploadError: string | null;
  progress: number;
  uploadedAssetId: string | null;
}

interface EditModalState {
  asset: Asset | null;
  title: string;
  description: string;
  tags: string;
  saveError: string | null;
}

interface AssetPreviewDimensions {
  width?: number;
  height?: number;
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
const MAX_SIZE_MB = 600;

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

function normalizeDimension(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function formatDuration(value: unknown): string | null {
  const seconds = typeof value === "number"
    ? value > 1000 ? value / 1000 : value
    : typeof value === "string"
      ? Number(value)
      : NaN;

  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainingSeconds].map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0")).join(":");
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function validateUploadForm(title: string, description: string): UploadFormErrors {
  const errors: UploadFormErrors = {};
  if (!title.trim()) errors.title = "Title is required.";
  else if (title.trim().length < 3) errors.title = "Title must be at least 3 characters.";
  else if (title.trim().length > 120) errors.title = "Title must be 120 characters or fewer.";
  if (!description.trim()) errors.description = "Description is required.";
  return errors;
}

function getUploadErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return message;
  }
  return "Asset upload failed. Please try again.";
}

function getEditErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return message;
  }
  return "Couldn't save asset changes. Please try again.";
}

const EMPTY_UPLOAD: UploadState = {
  step: "pick",
  file: null,
  fileValidation: { ok: true },
  title: "",
  description: "",
  tags: "",
  formErrors: {},
  uploadError: null,
  progress: 0,
  uploadedAssetId: null,
};

const EMPTY_EDIT = (a: Asset): EditModalState => ({
  asset: a,
  title: a.title,
  description: a.description,
  tags: a.tags.join(", "),
  saveError: null,
});

function formatBytes(raw: string) { return raw; }

function isH5pAsset(asset: Asset): boolean {
  return /\.h5p$/i.test(asset.filename || asset.title || "");
}

function assetExtension(asset?: Asset): string {
  if (!asset) return "";
  const name = asset.filename || asset.title || "";
  const dot = name.lastIndexOf(".");
  if (dot > -1 && dot < name.length - 1) return name.slice(dot).toLowerCase();
  const sub = (asset.mimeType || "").split("/")[1];
  if (!sub) return "";
  const map: Record<string, string> = { jpeg: "jpg", "svg+xml": "svg" };
  return "." + (map[sub] || sub);
}

function matchesPickerAssetType(asset: Asset, pickerType: AssetPickerType): boolean {
  if (pickerType === "all") return true;
  if (pickerType === "media") return asset.format === "audio" || asset.format === "video";
  if (pickerType === "other") return asset.format === "other" && !isH5pAsset(asset);
  if (pickerType === "h5p") return isH5pAsset(asset);
  return asset.format === pickerType;
}

function isSvgAsset(asset: Asset): boolean {
  return (asset.mimeType || "").toLowerCase() === "image/svg+xml" || /\.svg$/i.test(asset.filename || asset.title || "");
}

function assetCardPreviewSrc(asset: Asset): string | null {
  if (!asset.backendId) return null;
  if (asset.format === "image") {
    return isSvgAsset(asset)
      ? `/api/asset/serve/${asset.backendId}${assetExtension(asset)}`
      : `/api/asset/thumb/${asset.backendId}`;
  }
  if (asset.format === "video") {
    return `/api/asset/thumb/${asset.backendId}`;
  }
  return null;
}

function isDirectFormatPickerType(pickerType: AssetPickerType): pickerType is AssetFormat {
  return pickerType === "image" || pickerType === "audio" || pickerType === "video" || pickerType === "other";
}

// List-item components live at module scope (not inside AssetManagementPage) so
// their identity is stable across renders. Declaring them inside the page made
// React remount the entire asset list on every keystroke (search/upload/edit
// state all live on the page), which caused the visible typing lag. memo() then
// skips re-rendering a card whose asset/handlers are unchanged.
interface AssetItemProps {
  asset: Asset;
  onEdit?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
  clickable?: boolean;
  onActivate?: (asset: Asset) => void;
  hideActions?: boolean;
  selected?: boolean;
}

function AssetCardThumbnail({ asset }: { asset: Asset }) {
  const [showFallback, setShowFallback] = useState(false);
  const previewSrc = assetCardPreviewSrc(asset);
  const iconColorClass = FORMAT_COLORS[asset.format].split(" ")[1];

  return (
    <div className={`relative h-32 overflow-hidden ${THUMBNAIL_COLORS[asset.format]} flex items-center justify-center`}>
      {!showFallback && previewSrc ? (
        <>
          <img
            src={previewSrc}
            alt={asset.title || asset.filename || `${asset.format} asset`}
            className="h-full w-full object-cover"
            onError={() => setShowFallback(true)}
          />
          {asset.format === "video" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/25 via-transparent to-transparent">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-[1px]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <polygon points="8,6 19,12 8,18" />
                </svg>
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <span className={`${iconColorClass} opacity-60`}>
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            {asset.format === "image" && <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />}
            {asset.format === "audio" && <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />}
            {asset.format === "video" && <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />}
            {asset.format === "other" && <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />}
          </svg>
        </span>
      )}
    </div>
  );
}

function AssetPreviewMedia({ asset, onImageMeasure }: { asset: Asset; onImageMeasure?: (dimensions: AssetPreviewDimensions) => void }) {
  const serveUrl = `/api/asset/serve/${asset.backendId}`;

  if (asset.format === "image") {
    return (
      <img
        src={serveUrl}
        alt={asset.title}
        className="max-h-[220px] w-full rounded-xl object-contain"
        onLoad={(event) => {
          const image = event.currentTarget;
          onImageMeasure?.({ width: image.naturalWidth, height: image.naturalHeight });
        }}
      />
    );
  }

  if (asset.format === "video") {
    return (
      <video preload="metadata" controls className="max-h-[220px] w-full rounded-xl bg-[#0f172a] object-contain">
        <source src={serveUrl} type={asset.mimeType} />
      </video>
    );
  }

  if (asset.format === "audio") {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-4 rounded-[20px] border border-[#dbe7f3] bg-[linear-gradient(180deg,#f8fbff_0%,#edf4fb_100%)] px-6 py-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#2d6fa8] shadow-sm">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <audio src={serveUrl} controls className="w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-4 rounded-[20px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-6 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#64748b] shadow-sm">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-sm text-[#64748b]">Preview is not available for this file type.</p>
    </div>
  );
}

function AssetPreviewPanel({
  asset,
  pickerMode = false,
  onEdit,
  onDelete,
  onConfirm,
  onCancel,
  onRestore,
  restoreError,
}: {
  asset: Asset | null;
  pickerMode?: boolean;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onConfirm?: (asset: Asset) => void;
  onCancel?: () => void;
  onRestore?: (asset: Asset) => void;
  restoreError?: string | null;
}) {
  const [imageDimensions, setImageDimensions] = useState<AssetPreviewDimensions>({});

  useEffect(() => {
    setImageDimensions({});
  }, [asset?.backendId]);

  const metadataWidth = normalizeDimension(asset?.metadata?.width);
  const metadataHeight = normalizeDimension(asset?.metadata?.height);
  const width = metadataWidth ?? imageDimensions.width;
  const height = metadataHeight ?? imageDimensions.height;
  const duration = formatDuration(asset?.metadata?.duration);

  if (!asset) {
    return (
      <aside className="xl:sticky xl:top-0 xl:self-start">
        <div className="rounded-[24px] border border-[#e5edf5] bg-white/90 p-6 text-center shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef6fd] text-[#2d6fa8]">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#2d6fa8]">Preview</h2>
          <p className="mt-3 text-sm leading-6 text-[#6b7280]">Select an asset to preview it here with file details and dimensions.</p>
          {pickerMode && (
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center rounded-xl border border-[#d1d5db] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#f9fafb]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center rounded-xl bg-[#2d6fa8] px-4 py-2.5 text-sm font-semibold text-white opacity-40"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="xl:sticky xl:top-0 xl:self-start xl:h-[calc(100vh-10rem)]">
      <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-[#e5edf5] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="border-b border-[#edf2f7] bg-[linear-gradient(135deg,#f6fbff_0%,#eef5fb_100%)] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2d6fa8]">Asset Preview</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-6 p-5 text-center pb-10">
          <AssetPreviewMedia asset={asset} onImageMeasure={setImageDimensions} />

          <div className="space-y-4">
            <div>
              <h3 className="text-[24px] font-semibold leading-tight text-[#2d6fa8] break-words">{asset.title}</h3>
              {asset.description && (
                <p className="mt-3 text-sm leading-6 text-[#6b7280] break-words">{asset.description}</p>
              )}
            </div>

            <div className="rounded-[18px] border border-[#e5edf5] bg-[#f8fbff] px-4 py-3 text-left">
              <div className="grid gap-2 text-sm text-[#4b5563]">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-[#111827]">Size</span>
                  <span>{formatBytes(asset.size)}</span>
                </div>
                {duration && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-[#111827]">Duration</span>
                    <span>{duration}</span>
                  </div>
                )}
                {width && height && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-[#111827]">Dimensions</span>
                    <span>{width} x {height}</span>
                  </div>
                )}
              </div>
            </div>

            {asset.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {asset.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[#eef6fd] px-2.5 py-1 text-xs font-medium text-[#2d6fa8]">#{tag}</span>
                ))}
              </div>
            )}

            <div className="pt-5 mb-5 border-t border-[#edf2f7]">
              {pickerMode ? (
                <div className="flex items-center justify-center gap-3 pb-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex items-center justify-center rounded-xl border border-[#d1d5db] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#f9fafb]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => onConfirm?.(asset)}
                    className="inline-flex items-center justify-center rounded-xl bg-[#2d6fa8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#245c8f]"
                  >
                    Add
                  </button>
                </div>
              ) : asset.isDeleted ? (
                <div className="space-y-3 pb-2">
                  {restoreError && (
                    <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 text-left text-sm text-[#b91c1c]">
                      {restoreError}
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => onRestore?.(asset)}
                      className="inline-flex items-center justify-center rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#15803d]"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 pb-2">
                  <button
                    type="button"
                    onClick={() => onEdit(asset)}
                    className="inline-flex items-center justify-center rounded-xl bg-[#2d6fa8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#245c8f]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(asset)}
                    className="inline-flex items-center justify-center rounded-xl bg-[#ff5c73] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ef445c]"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </aside>
  );
}

const AssetCardItem = memo(function AssetCardItem({ asset, clickable = false, onActivate, selected = false }: AssetItemProps) {
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onActivate?.(asset) : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate?.(asset);
        }
      } : undefined}
      className={`rounded-xl overflow-hidden transition-all flex flex-col group border ${selected ? "border-[#2d6fa8] shadow-[0_12px_28px_rgba(45,111,168,0.22)] ring-2 ring-[#dbeeff]" : "border-[#e5e7eb]"} bg-white ${clickable ? "cursor-pointer hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:ring-offset-2" : "hover:shadow-md"} ${asset.isDeleted ? "opacity-80 grayscale-[0.2]" : ""}`}
    >
      <div className="relative">
        {/* Thumbnail */}
        <div className="relative h-32 overflow-hidden">
          <AssetCardThumbnail asset={asset} />
          {asset.isDeleted && (
            <div className="absolute inset-0 bg-white/80" aria-hidden="true">
              <i
                className="fa fa-ban"
                style={{
                  position: "relative",
                  top: "50%",
                  display: "block",
                  marginTop: "-36px",
                  color: "#ff5567",
                  fontSize: "72px",
                  lineHeight: "72px",
                  textAlign: "center",
                }}
              />
            </div>
          )}
        </div>
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
    </div>
  );
});

export function AssetManagementWorkspace({
  pickerMode = false,
  pickerAssetType,
  pickerTitle,
  pickerDescription,
  onPickAsset,
  onCancelPick,
  hideAssistant = false,
}: AssetManagementWorkspaceProps) {
  const [assets, setAssets]             = useState<Asset[]>([]);
  const fixedPickerFormat = pickerMode && pickerAssetType ? pickerAssetType : null;

  const loadAssets = useCallback(async () => {
    try {
      const rows = await getAssets(!pickerMode);
      setAssets(rows);
    } catch {
      setAssets([]);
    }
  }, [pickerMode]);
  useEffect(() => { void loadAssets(); }, [loadAssets]);
  const [search, setSearch]             = useState("");
  const [formatFilter, setFormatFilter] = useState<AssetFormat | "All">(
    fixedPickerFormat && isDirectFormatPickerType(fixedPickerFormat) ? fixedPickerFormat : "All"
  );
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch]       = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [lastDeletedAsset, setLastDeletedAsset] = useState<Asset | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen]     = useState(false);
  const [upload, setUpload]             = useState<UploadState>(EMPTY_UPLOAD);
  const [uploadDrag, setUploadDrag]     = useState(false);

  const [editState, setEditState]       = useState<EditModalState | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Asset | null>(null);

  const tagFilterRef   = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const progressTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Close tag dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (tagFilterRef.current && !tagFilterRef.current.contains(e.target as Node)) {
        setTagFilterOpen(false);
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
  const availableTags = useMemo(() => {
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const asset of assets) {
      for (const rawTag of asset.tags) {
        const tag = rawTag.trim();
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
      }
    }
    return tags.sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const visibleTagOptions = useMemo(
    () => availableTags.filter((t) => !tagSearch.trim() || t.toLowerCase().includes(tagSearch.trim().toLowerCase())),
    [availableTags, tagSearch],
  );

  const effectiveFormatFilter: AssetFormat | "All" =
    fixedPickerFormat && isDirectFormatPickerType(fixedPickerFormat) ? fixedPickerFormat : formatFilter;
  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return assets.filter((a) => {
      const matchSearch =
        q === "" ||
        a.title.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q));
      const matchFormat = fixedPickerFormat
        ? matchesPickerAssetType(a, fixedPickerFormat)
        : effectiveFormatFilter === "All" || a.format === effectiveFormatFilter;
      const matchTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) =>
          a.tags.some((assetTag) => assetTag.trim().toLowerCase() === tag.trim().toLowerCase())
        );
      return matchSearch && matchFormat && matchTags;
    });
  }, [assets, deferredSearch, effectiveFormatFilter, fixedPickerFormat, selectedTags]);

  const selectedAsset = useMemo(
    () => filtered.find((asset) => asset.backendId === selectedAssetId)
      ?? (selectedAssetId && lastDeletedAsset && lastDeletedAsset.backendId === selectedAssetId ? lastDeletedAsset : null)
      ?? null,
    [filtered, selectedAssetId, lastDeletedAsset],
  );

  useEffect(() => {
    if (pickerMode || !selectedAssetId) return;
    if (filtered.some((asset) => asset.backendId === selectedAssetId)) return;
    if (lastDeletedAsset && lastDeletedAsset.backendId === selectedAssetId) return;
    setSelectedAssetId(null);
  }, [filtered, pickerMode, selectedAssetId, lastDeletedAsset]);

  useEffect(() => {
    if (!fixedPickerFormat || !isDirectFormatPickerType(fixedPickerFormat)) return;
    setFormatFilter(fixedPickerFormat);
  }, [fixedPickerFormat]);

  function toPickerResult(asset: Asset): AssetPickerResult | null {
    if (!asset.backendId) return null;
    const id = asset.backendId;
    const url = `/api/asset/serve/${id}${assetExtension(asset)}`;
    const normalizedPath = (asset.path || "").trim().replace(/^\/+/, "");
    let assetLink = url;
    if (normalizedPath.startsWith("course/assets/")) {
      assetLink = normalizedPath;
    } else if (asset.filename) {
      assetLink = `course/assets/${asset.filename}`;
    }
    return { id, url, assetLink };
  }

  const handlePickSelection = useCallback((asset: Asset) => {
    const result = toPickerResult(asset);
    if (!result) return;
    onPickAsset?.(result);
  }, [onPickAsset]);

  const handleAssetActivate = useCallback((asset: Asset) => {
    setLastDeletedAsset((prev) => (prev && prev.backendId === asset.backendId ? prev : null));
    setRestoreError(null);
    setSelectedAssetId(asset.backendId);
  }, []);

  const handleConfirmPickerSelection = useCallback((asset: Asset) => {
    handlePickSelection(asset);
  }, [handlePickSelection]);

  const clearTags = useCallback(() => {
    setSelectedTags([]);
    setTagSearch("");
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (
      prev.some((item) => item.toLowerCase() === tag.toLowerCase())
        ? prev.filter((item) => item.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag]
    ));
  }, []);

  // ── Upload: step "pick" ───────────────────────────────────────────────────
  const handleUploadFile = useCallback((f: File | null) => {
    if (!f) return;
    const validation = fixedPickerFormat === "h5p" && !/\.h5p$/i.test(f.name)
      ? { ok: false, error: "Please choose a .h5p file." }
      : validateFile(f);
    const autoTitle = f.name.replace(/\.[^.]+$/, "");
    setUpload((prev) => ({
      ...prev,
      file: f,
      fileValidation: validation,
      title: prev.title || autoTitle,
      formErrors: {},
      uploadError: null,
    }));
  }, [fixedPickerFormat]);

  function handleUploadDrop(e: React.DragEvent) {
    e.preventDefault();
    setUploadDrag(false);
    handleUploadFile(e.dataTransfer.files[0] ?? null);
  }

  // ── Upload: validate → upload ─────────────────────────────────────────────
  async function startUpload() {
    const errors = validateUploadForm(upload.title, upload.description);
    if (Object.keys(errors).length > 0) {
      setUpload((prev) => ({ ...prev, formErrors: errors }));
      return;
    }

    if (!upload.file) return;

    const file = upload.file;
    const title = upload.title.trim();
    const description = upload.description.trim();
    const tags = upload.tags.split(",").map((t) => t.trim()).filter(Boolean);

    setUpload((prev) => ({ ...prev, step: "uploading", progress: 0, formErrors: {}, uploadError: null }));

    progressTimer.current = setInterval(() => {
      setUpload((prev) => ({
        ...prev,
        progress: prev.progress >= 90 ? prev.progress : Math.min(prev.progress + 12, 90),
      }));
    }, 120);

    try {
      const assetId = await uploadAsset(file, title, { description, tags });
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      await loadAssets();
      setUpload((prev) => ({ ...prev, step: "done", progress: 100, uploadedAssetId: assetId }));
    } catch (error) {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      setUpload((prev) => ({
        ...prev,
        step: "details",
        progress: 0,
        uploadError: getUploadErrorMessage(error),
      }));
    }
  }

  function closeUpload() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setUploadOpen(false);
    setUpload(EMPTY_UPLOAD);
  }

  // ── Edit ────────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editState?.asset || !editState.title.trim() || !editState.description.trim()) return;

    const asset = editState.asset;
    const nextTitle = editState.title.trim();
    const nextDescription = editState.description.trim();
    const nextTags = editState.tags.split(",").map((t) => t.trim()).filter(Boolean);

    setEditState((prev) => prev ? { ...prev, saveError: null } : prev);

    try {
      await updateAsset(asset.backendId, {
        title: nextTitle,
        description: nextDescription,
        tags: nextTags,
      });

      setAssets((prev) => prev.map((a) =>
        a.id === asset.id
          ? {
              ...a,
              title: nextTitle,
              description: nextDescription,
              tags: nextTags,
            }
          : a
      ));
      setEditState(null);
    } catch (error) {
      setEditState((prev) => prev ? { ...prev, saveError: getEditErrorMessage(error) } : prev);
    }
  }

  // ── Delete / Restore ─────────────────────────────────────────────────────
  async function confirmDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target?.backendId) return;

    setRestoreError(null);
    setLastDeletedAsset({ ...target, isDeleted: true });
    setSelectedAssetId(target.backendId);

    try {
      await trashAsset(target.backendId);
    } finally {
      await loadAssets();
    }
  }

  async function confirmRestore() {
    const target = restoreTarget;
    setRestoreTarget(null);
    if (!target?.backendId) return;

    try {
      setRestoreError(null);
      await restoreAsset(target.backendId);
      setLastDeletedAsset(null);
      setSelectedAssetId(null);
      await loadAssets();
    } catch (error) {
      setRestoreError(getEditErrorMessage(error));
    }
  }

  function handleRestoreDeletedAsset(asset: Asset) {
    setRestoreError(null);
    setRestoreTarget(asset);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const FORMAT_LABELS: Record<AssetFormat | "All" | "all" | "media" | "h5p", string> = {
    All: "All",
    all: "All Assets",
    image: "Image",
    audio: "Audio",
    video: "Video",
    media: "Media",
    other: "Other",
    h5p: "H5P",
  };

  const FORMATS: (AssetFormat | "All")[] = ["All", "image", "audio", "video", "other"];

  // Stable handlers so the memoized list items don't re-render on every keystroke.
  const handleEditAsset   = useCallback((asset: Asset) => setEditState(EMPTY_EDIT(asset)), []);
  const handleDeleteAsset = useCallback((asset: Asset) => setDeleteTarget(asset), []);
  const hideActions = pickerMode;

  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ── */}
      <div className="px-6 md:px-8 pt-6 pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#111827] leading-tight">{pickerMode ? (pickerTitle || "Select Asset") : "Asset Management"}</h1>
        </div>
        {pickerMode ? null : (
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
        )}
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
            placeholder="Search by name"
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
        {!fixedPickerFormat ? (
        <div className="flex items-center gap-1 bg-[#f3f4f6] rounded-lg p-1">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormatFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                formatFilter === f
                  ? "bg-white text-[#2d6fa8] shadow-sm"
                  : "text-[#6b7280] hover:text-[#374151]"
              }`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#dbeeff] text-xs text-[#2d6fa8] font-medium">
            {FORMAT_LABELS[fixedPickerFormat]}
          </span>
        )}

        <div ref={tagFilterRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setTagFilterOpen((open) => !open);
              setTagSearch("");
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors whitespace-nowrap ${
              selectedTags.length > 0
                ? "border-[#2d6fa8] bg-[#dbeeff] text-[#2d6fa8] font-medium"
                : "bg-white border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]"
            }`}
          >
            Search by tag
            {selectedTags.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#2d6fa8] text-white text-[10px] font-bold flex items-center justify-center">{selectedTags.length}</span>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${tagFilterOpen ? "rotate-180" : ""}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {tagFilterOpen && (
            <div className="absolute left-0 mt-1 w-64 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-30 py-1">
              <div className="px-2 pt-1.5 pb-1">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search tags..."
                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-[#e5e7eb] rounded-md focus:outline-none focus:ring-1 focus:ring-[#2d6fa8] focus:border-transparent text-[#111827] bg-[#f9fafb]"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto">
                {visibleTagOptions.length === 0 && (
                  <p className="px-3 py-2 text-sm text-[#9ca3af]">No matching tags</p>
                )}

                {visibleTagOptions.map((tag) => {
                  const isSelected = selectedTags.some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                        isSelected ? "bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"
                      }`}
                    >
                      <span>#{tag}</span>
                      {isSelected && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedTags.length > 0 && (
                <>
                  <div className="border-t border-[#f3f4f6] my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      clearTags();
                      setTagFilterOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-[#ef4444] hover:bg-[#fef2f2] transition-colors"
                  >
                    Clear tags
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {(search || selectedTags.length > 0) && (
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
            {selectedTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eef2ff] text-xs text-[#3730a3] font-medium">
                Tag: #{tag}
                <button
                  type="button"
                  onClick={() => setSelectedTags((prev) => prev.filter((item) => item.toLowerCase() !== tag.toLowerCase()))}
                  aria-label={`Remove tag ${tag}`}
                  className="text-[#6366f1] hover:text-[#4338ca]"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        <span className="ml-auto text-xs text-[#9ca3af]">{filtered.length} asset{filtered.length !== 1 ? "s" : ""}</span>

      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-6 md:px-8 pb-6 overflow-y-auto">
        <div className={`grid items-start gap-6 ${pickerMode ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]"}`}>
          <div className="min-w-0">
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
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
            {filtered.map((a) => <AssetCardItem key={a.id} asset={a} onEdit={handleEditAsset} onDelete={handleDeleteAsset} clickable onActivate={handleAssetActivate} hideActions={hideActions} selected={selectedAssetId === a.backendId} />)}
          </div>
        )}
          </div>

          <AssetPreviewPanel
            asset={selectedAsset}
            pickerMode={pickerMode}
            onEdit={handleEditAsset}
            onDelete={handleDeleteAsset}
            onConfirm={handleConfirmPickerSelection}
            onCancel={onCancelPick}
            onRestore={handleRestoreDeletedAsset}
            restoreError={selectedAsset?.isDeleted ? restoreError : null}
          />
        </div>
      </div>

      {!hideAssistant ? <AiAssistant context="Asset Management" /> : null}

      {/* ════════════════════════════════════════════════════════════════
          Upload Modal — multi-step: pick → details → uploading → done
      ════════════════════════════════════════════════════════════════ */}
      {!pickerMode && uploadOpen && (
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
                  {upload.uploadError && (
                    <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 text-sm text-[#b91c1c]">
                      {upload.uploadError}
                    </div>
                  )}

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
                          onClick={(e) => { e.stopPropagation(); setUpload((p) => ({ ...p, file: null, fileValidation: { ok: true }, title: "", uploadError: null })); }}
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
                      onChange={(e) => setUpload((p) => ({ ...p, title: e.target.value, formErrors: { ...p.formErrors, title: undefined }, uploadError: null }))}
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

                  {/* Asset Description */}
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                      Asset Description <span className="text-[#ef4444]">*</span>
                    </label>
                    <textarea
                      value={upload.description}
                      onChange={(e) => setUpload((p) => ({ ...p, description: e.target.value, formErrors: { ...p.formErrors, description: undefined }, uploadError: null }))}
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
                      onChange={(e) => setUpload((p) => ({ ...p, tags: e.target.value, uploadError: null }))}
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
      {!pickerMode && editState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditState(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-[#111827] text-base">Edit Asset Details</h2>
              <button type="button" onClick={() => setEditState(null)} className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
                <svg width="16" height="16" viewBox="0 0 c24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto flex flex-col gap-4">
              {editState.saveError && (
                <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 text-sm text-[#b91c1c]">
                  {editState.saveError}
                </div>
              )}

              {/* Asset Title */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Asset Title <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  value={editState.title}
                  onChange={(e) => setEditState((p) => p ? { ...p, title: e.target.value, saveError: null } : p)}
                  placeholder="Asset title"
                  className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
                />
              </div>

              {/* Asset Description */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Asset Description <span className="text-[#ef4444]">*</span>
                </label>
                <textarea
                  value={editState.description}
                  onChange={(e) => setEditState((p) => p ? { ...p, description: e.target.value, saveError: null } : p)}
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
                  onChange={(e) => setEditState((p) => p ? { ...p, tags: e.target.value, saveError: null } : p)}
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
      {!pickerMode && (deleteTarget || restoreTarget) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteTarget(null);
              setRestoreTarget(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${deleteTarget ? "bg-[#fef2f2]" : "bg-[#ecfdf5]"}`}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={deleteTarget ? "#ef4444" : "#16a34a"}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {deleteTarget ? (
                      <>
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </>
                    ) : (
                      <path d="M5 12l4 4L19 2" />
                    )}
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-[#111827] text-base">{deleteTarget ? "Delete Asset" : "Restore Asset"}</h2>
                  <p className="text-sm text-[#6b7280] mt-1">
                    {deleteTarget ? (
                      <>Are you sure you want to delete <span className="font-medium text-[#111827]">"{deleteTarget.title}"</span>?</>
                    ) : (
                      <>Are you sure you want to restore <span className="font-medium text-[#111827]">"{restoreTarget?.title}"</span>?</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setRestoreTarget(null);
                }}
                className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteTarget ? confirmDelete : confirmRestore}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                  deleteTarget ? "bg-[#ef4444] hover:bg-[#dc2626]" : "bg-[#16a34a] hover:bg-[#15803d]"
                }`}
              >
                {deleteTarget ? "Delete Asset" : "Restore Asset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssetManagementPage() {
  return <AssetManagementWorkspace />;
}
