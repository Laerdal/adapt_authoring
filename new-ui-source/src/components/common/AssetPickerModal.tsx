import { useState, useEffect, useRef } from "react";
import { queryImages, uploadAsset } from "@/api/adaptAuthoring";
import type { Asset } from "@/api/adaptAuthoring";

interface AssetPickerModalProps {
  onSelect: (asset: { id: string; url: string }) => void;
  onClose: () => void;
}

export default function AssetPickerModal({ onSelect, onClose }: AssetPickerModalProps) {
  const [assets, setAssets]         = useState<Asset[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);
  const searchTimeout               = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadAssets(term?: string) {
    setLoading(true);
    const results = await queryImages(term);
    setAssets(results);
    setLoading(false);
  }

  useEffect(() => {
    void loadAssets();
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { void loadAssets(val || undefined); }, 400);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadError(null);
    try {
      const assetId = await uploadAsset(file, file.name.replace(/\.[^.]+$/, ""));
      // Reload and auto-select the newly uploaded asset
      await loadAssets(search || undefined);
      setSelected(assetId);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // Build the served URL WITH the file extension. `/api/asset/serve/:id` strips a
  // trailing extension server-side (assetmanager.serveAsset), so `<id>.png` resolves
  // to the same asset — but keeping the extension in the stored value matters for
  // consumers like the topbar-logos plugin and for exported courses.
  function assetExtension(asset?: Asset): string {
    if (!asset) return "";
    const name = asset.filename || asset.title || "";
    const dot = name.lastIndexOf(".");
    if (dot > -1 && dot < name.length - 1) return name.slice(dot).toLowerCase();
    // Fallback: derive from the mime subtype (e.g. "image/png" → ".png").
    const sub = (asset.mimeType || "").split("/")[1];
    if (!sub) return "";
    const map: Record<string, string> = { jpeg: "jpg", "svg+xml": "svg" };
    return "." + (map[sub] || sub);
  }

  function handleConfirm() {
    if (!selected) return;
    const asset = assets.find((a) => a._id === selected);
    onSelect({ id: selected, url: `/api/asset/serve/${selected}${assetExtension(asset)}` });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb] shrink-0">
          <h2 className="font-semibold text-[#111827] text-base">Select Cover Image</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] transition-colors" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search + upload bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#e5e7eb] shrink-0">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search images..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent text-[#111827]"
            />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            {uploading ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
            {uploading ? "Uploading…" : "Upload New"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" title="Upload image" onChange={handleUpload} />
        </div>

        {uploadError && (
          <div className="px-5 py-2 bg-[#fef2f2] text-sm text-[#b91c1c] border-b border-[#fecaca]">{uploadError}</div>
        )}

        {/* Asset grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-sm text-[#6b7280]">
              <svg className="animate-spin mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Loading images…
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-sm text-[#6b7280] gap-2">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
              <p>No images found. Upload one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {assets.map((asset) => {
                const isSelected = selected === asset._id;
                const thumbUrl = `/api/asset/thumb/${asset._id}`;
                return (
                  <button
                    key={asset._id}
                    type="button"
                    onClick={() => setSelected(asset._id)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-video bg-[#f3f4f6] focus:outline-none ${
                      isSelected
                        ? "border-[#2d6fa8] shadow-md ring-2 ring-[#2d6fa8]/30"
                        : "border-transparent hover:border-[#93c5fd]"
                    }`}
                  >
                    <img
                      src={thumbUrl}
                      alt={asset.title ?? asset.filename ?? "Image"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fall back to the full serve URL if thumb is unavailable
                        (e.currentTarget as HTMLImageElement).src = `/api/asset/serve/${asset._id}`;
                      }}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#2d6fa8]/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-[#2d6fa8] flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      </div>
                    )}
                    {asset.title && (
                      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-[10px] text-white truncate">{asset.title}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#e5e7eb] shrink-0">
          <p className="text-xs text-[#9ca3af]">
            {selected ? "1 image selected" : `${assets.length} image${assets.length !== 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selected}
              className="px-4 py-2 text-sm font-medium text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Select Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
