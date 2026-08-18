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
}: AssetSelectionFieldProps) {
  const resolvePreview = resolveAssetPreviewUrl || resolveUrl;
  const resolvedPreviewUrl = resolvePreview ? resolvePreview(value) : null;
  const previewUrl = resolvedPreviewUrl || toRenderableAssetUrl(value);

  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2"}>
      {showLabel ? <div className="text-[12px] text-[var(--life-base-black)]">{label}</div> : null}
      {previewUrl ? (
        <div className="border border-[var(--life-neutral-200)] rounded-md overflow-hidden bg-[var(--life-neutral-020)]">
          <div className={compact ? "h-20 w-full flex items-center justify-center overflow-hidden bg-[var(--life-neutral-020)]" : "h-56 w-full flex items-center justify-center overflow-hidden bg-[var(--life-neutral-020)]"}>
            <img src={previewUrl} alt={label} className="w-full h-full object-contain" />
          </div>
          {compact ? <div className="px-2 py-1.5 border-t border-[var(--life-neutral-200)] text-[10px] text-[var(--life-neutral-500)] truncate">{value}</div> : null}
        </div>
      ) : null}
      {value ? (
        <div className={compact ? "grid grid-cols-2 gap-1.5 min-w-0" : "flex items-center justify-end gap-1.5"}>
          <button type="button" onClick={onPickAsset} className={compact ? "w-full min-w-0 px-1.5 py-1.5 text-[11px] leading-tight font-semibold rounded-md border border-[var(--life-primary-500)] text-[var(--life-primary-500)] bg-white hover:bg-[var(--life-primary-020)] transition-colors cursor-pointer text-center" : "px-2 py-1 text-[12px] font-semibold rounded-md border border-[var(--life-primary-500)] text-[var(--life-primary-500)] bg-white hover:bg-[var(--life-primary-020)] transition-colors cursor-pointer whitespace-nowrap"}>
            Change Asset
          </button>
          <button type="button" onClick={onClear} className={compact ? "w-full min-w-0 px-1.5 py-1.5 text-[11px] leading-tight font-semibold rounded-md border border-[var(--life-critical-500)] text-[var(--life-critical-500)] bg-white hover:bg-[var(--life-critical-050)] transition-colors cursor-pointer text-center" : "px-2 py-1 text-[12px] font-semibold rounded-md border border-[var(--life-critical-500)] text-[var(--life-critical-500)] bg-white hover:bg-[var(--life-critical-050)] transition-colors cursor-pointer whitespace-nowrap"}>
            Remove Asset
          </button>
        </div>
      ) : (
        <div className={compact ? "grid grid-cols-2 gap-1.5 min-w-0" : "flex gap-2.5 flex-wrap"}>
          <button type="button" onClick={onPickAsset} className={compact ? "w-full min-w-0 px-1.5 py-1.5 text-[11px] leading-tight font-semibold rounded-md bg-[var(--life-primary-500)] text-white hover:bg-[var(--life-primary-700)] transition-colors cursor-pointer text-center" : "px-2.5 py-1.5 text-[13px] font-semibold rounded-md bg-[var(--life-primary-500)] text-white hover:bg-[var(--life-primary-700)] transition-colors cursor-pointer flex items-center gap-1.5"}>
            {compact ? null : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l2 3h6a2 2 0 0 1 2 2z" /></svg>}
            {compact ? "Select Asset" : "Select an Asset"}
          </button>
          {onPickExternal ? (
            <button type="button" onClick={onPickExternal} className={compact ? "w-full min-w-0 px-1.5 py-1.5 text-[11px] leading-tight font-semibold rounded-md border border-[var(--life-primary-500)] text-[var(--life-primary-500)] hover:bg-[var(--life-primary-020)] transition-colors cursor-pointer text-center" : "px-2.5 py-1.5 text-[13px] font-semibold rounded-md border border-[var(--life-primary-500)] text-[var(--life-primary-500)] hover:bg-[var(--life-primary-020)] transition-colors cursor-pointer flex items-center gap-1.5"}>
              {compact ? null : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L11.65 5" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L12.35 19" /></svg>}
              {compact ? "External Asset" : "Select an External Asset"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
