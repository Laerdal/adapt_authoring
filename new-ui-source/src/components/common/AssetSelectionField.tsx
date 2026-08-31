type AssetSelectionFieldProps = {
  label: string;
  value: string;
  onPickAsset: () => void;
  onPickExternal?: () => void;
  onClear: () => void;
  resolveAssetPreviewUrl?: (value: string) => string | null;
  resolveUrl?: (value: string) => string | null;
  showLabel?: boolean;
  compact?: boolean;
  required?: boolean;
};

function extractAssetIdFromCourseAssetPath(value: string): string | null {
  const normalized = (value || "").trim().replace(/^\/+/, "");
  if (!normalized.startsWith("course/assets/")) return null;

  const tail = normalized.replace(/^course\/assets\//, "").split(/[?#]/)[0];
  const basename = tail.split("/").pop() || "";
  const match = basename.match(/^([a-f0-9]{24})(?:\.[^.]+)?$/i);
  return match?.[1] || null;
}

export function toRenderableAssetUrl(source: string | undefined): string | null {
  const src = (source || "").trim();
  if (!src) return null;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("/")) return src;
  if (src.startsWith("course/assets/")) {
    const assetId = extractAssetIdFromCourseAssetPath(src);
    if (assetId) return `/api/asset/serve/${assetId}`;
    return `/${encodeURI(src)}`;
  }
  if (/^[a-f0-9]{24}$/i.test(src)) return `/api/asset/serve/${src}`;
  return encodeURI(src);
}

export default function AssetSelectionField({
  label,
  value,
  onPickAsset,
  onPickExternal,
  onClear,
  resolveAssetPreviewUrl,
  resolveUrl,
  showLabel = true,
  compact = false,
  required = false,
}: AssetSelectionFieldProps) {
  const resolvePreview = resolveAssetPreviewUrl || resolveUrl;
  const resolvedPreviewUrl = resolvePreview ? resolvePreview(value) : null;
  const previewUrl = resolvedPreviewUrl || toRenderableAssetUrl(value);

  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2"}>
      {showLabel ? (
        <div className="text-[12px] text-[var(--life-base-black)]">
          {label}{required && <span className="ml-0.5 text-[#dc2626]">*</span>}
        </div>
      ) : null}
      {previewUrl ? (
        <div className="border border-[var(--life-neutral-200)] rounded-md overflow-hidden bg-[var(--life-neutral-020)]">
          <div className={compact ? "h-20 w-full flex items-center justify-center overflow-hidden bg-[var(--life-neutral-020)]" : "h-56 w-full flex items-center justify-center overflow-hidden bg-[var(--life-neutral-020)]"}>
            <img src={previewUrl} alt={label} className="w-full h-full object-contain" />
          </div>
          {compact ? <div className="px-2 py-1.5 border-t border-[var(--life-neutral-200)] text-[10px] text-[var(--life-neutral-500)] truncate">{value}</div> : null}
        </div>
      ) : null}
      {value ? (
        <div className="flex min-w-0 flex-nowrap gap-1.5">
          <button type="button" onClick={onPickAsset} className="flex-1 min-w-0 px-2 py-1.5 text-[11px] leading-tight font-semibold rounded-md border border-[var(--life-primary-500)] text-[var(--life-primary-500)] bg-white hover:bg-[var(--life-primary-020)] transition-colors cursor-pointer whitespace-nowrap truncate">
            Change Asset
          </button>
          <button type="button" onClick={onClear} className="flex-1 min-w-0 px-2 py-1.5 text-[11px] leading-tight font-semibold rounded-md border border-[var(--life-critical-500)] text-[var(--life-critical-500)] bg-white hover:bg-[var(--life-critical-050)] transition-colors cursor-pointer whitespace-nowrap truncate">
            Remove Asset
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 flex-nowrap gap-1.5">
          <button type="button" onClick={onPickAsset} className="flex-1 min-w-0 px-2 py-1.5 text-[11px] leading-tight font-semibold rounded-md bg-[var(--life-primary-500)] text-white hover:bg-[var(--life-primary-700)] transition-colors cursor-pointer whitespace-nowrap truncate">
            Select Asset
          </button>
          {onPickExternal ? (
            <button type="button" onClick={onPickExternal} className="flex-1 min-w-0 px-2 py-1.5 text-[11px] leading-tight font-semibold rounded-md border border-[var(--life-primary-500)] text-[var(--life-primary-500)] hover:bg-[var(--life-primary-020)] transition-colors cursor-pointer whitespace-nowrap truncate">
              External Asset
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
