import { Link } from "react-router-dom";
import { useState, useRef } from "react";
import ImageCropper from "@/components/common/ImageCropper";
import AssetPickerModal from "@/components/common/AssetPickerModal";

interface CourseCardProps {
  id: number;
  title: string;
  description: string;
  savedDate: string;
  imageUrl?: string | null;
  heroAssetId?: string | null;
  tags?: string[];
  view?: "grid" | "list";
  onUpdate: (patch: { title?: string; description?: string; heroAssetId?: string | null; tags?: string[] }) => void;
  onCopy: () => void;
  onCopyId: () => void;
  onDelete: () => void;
  viewHref: string;
}

export default function CourseCard({
  id, title, description, savedDate, imageUrl, heroAssetId = null, tags = [],
  view = "grid", onUpdate, onCopy, onCopyId, onDelete, viewHref,
}: CourseCardProps) {
  const [modalOpen, setModalOpen]           = useState(false);
  const [menuOpen, setMenuOpen]             = useState(false);
  const [deleteOpen, setDeleteOpen]         = useState(false);
  const [editTitle, setEditTitle]           = useState(title);
  const [editDesc, setEditDesc]             = useState(description);
  const [editImage, setEditImage]           = useState<string | null>(imageUrl ?? null);
  const [editHeroAssetId, setEditHeroAssetId] = useState<string | null>(heroAssetId);
  const [editTags, setEditTags]             = useState<string[]>(tags);
  const [tagInput, setTagInput]             = useState("");
  const [cropSrc, setCropSrc]               = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const menuRef                             = useRef<HTMLDivElement>(null);
  const trimmedTitle = editTitle.trim();

  function addTag() {
    const t = tagInput.trim();
    if (!t || editTags.includes(t)) { setTagInput(""); return; }
    setEditTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setEditTags((prev) => prev.filter((t) => t !== tag));
  }

  function openModal() {
    setEditTitle(title);
    setEditDesc(description);
    setEditImage(imageUrl ?? null);
    setEditHeroAssetId(heroAssetId);
    setEditTags(tags);
    setTagInput("");
    setCropSrc(null);
    setModalOpen(true);
  }

  function handleSave() {
    if (!trimmedTitle) return; // reject empty / whitespace-only titles
    onUpdate({ title: trimmedTitle, description: editDesc.trim(), heroAssetId: editHeroAssetId, tags: editTags });
    setModalOpen(false);
  }

  function handleAssetSelected(asset: { id: string; url: string }) {
    setEditHeroAssetId(asset.id);
    setEditImage(asset.url);
    setAssetPickerOpen(false);
  }

  function handleRemoveImage() {
    setEditHeroAssetId(null);
    setEditImage(null);
  }

  function handleMenuAction(action: () => void) {
    setMenuOpen(false);
    action();
  }

  const thumbnailStyle = imageUrl
    ? { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: "linear-gradient(135deg, #2d6fa8 0%, #3498a0 60%, #4db0b8 100%)" };

  const placeholderIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );

  /* Shared 3-dot menu dropdown */
  const MoreMenu = () => (
    <div ref={menuRef} className="absolute z-30 bg-white border border-[#e5e7eb] rounded-xl shadow-xl py-1 w-52"
      style={view === "grid" ? { top: "calc(100% + 4px)", right: 0 } : { top: "calc(100% + 4px)", right: 0 }}
    >
      {/* Copy */}
      <button
        type="button"
        onClick={() => handleMenuAction(onCopy)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#374151] hover:bg-[#f9fafb] transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        Copy
      </button>

      {/* Copy ID */}
      <button
        type="button"
        onClick={() => handleMenuAction(onCopyId)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#374151] hover:bg-[#f9fafb] transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
        Copy ID to Clipboard
      </button>

      <div className="border-t border-[#f3f4f6] my-1" />
    </div>
  );

  /* 3-dot trigger button (shared) */
  const MoreButton = ({ className }: { className: string }) => (
    <div className="relative" ref={view === "list" ? menuRef : undefined}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setMenuOpen((o) => !o); }}
        aria-label="More options"
        className={className}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {menuOpen && <MoreMenu />}
    </div>
  );

  return (
    <>
      {/* Click-outside to close menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
      )}

      {view === "grid" ? (
        /* ── GRID CARD ── */
        <div className="bg-white rounded-xl border border-[#e5e7eb] overflow-visible flex flex-col shadow-sm hover:shadow-md transition-shadow group">
          {/* Thumbnail */}
          <div className="h-44 flex items-center justify-center relative rounded-t-xl overflow-hidden" style={thumbnailStyle}>
            {!imageUrl && <span className="w-12 h-12">{placeholderIcon}</span>}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={openModal}
              aria-label="Edit course details"
              title="Edit course details"
              className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-[#2d6fa8] shadow-sm"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setDeleteOpen(true); }}
              aria-label="Delete course"
              title="Delete course"
              className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-[#ef4444] shadow-sm"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 pt-3 pb-4 flex flex-col flex-1 gap-2">
            <div className="flex items-start justify-between gap-2">
              <h3 title={title} className="font-bold text-[#111827] text-sm leading-snug line-clamp-2 flex-1">{title}</h3>
              {/* 3-dot menu — grid */}
              <div className="relative shrink-0 -mt-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setMenuOpen((o) => !o); }}
                  aria-label="More options"
                  className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                  </svg>
                </button>
                {menuOpen && <MoreMenu />}
              </div>
            </div>
            <p title={description} className="text-xs text-[#6b7280] leading-relaxed line-clamp-2 flex-1">{description}</p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#dbeeff] text-[#1e4d73]">
                    {tag}
                  </span>
                ))}
                {tags.length > 3 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f3f4f6] text-[#6b7280]">
                    +{tags.length - 3}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-[#9ca3af]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              Saved {savedDate}
            </div>
            <Link
              to={viewHref}
              className="mt-1 w-full py-2.5 rounded-lg bg-[#2d6fa8] hover:bg-[#245c8f] text-white text-sm font-medium transition-colors text-center"
            >
              View Course
            </Link>
          </div>
        </div>
      ) : (
        /* ── LIST ROW ── */
        <div className="bg-white rounded-xl border border-[#e5e7eb] flex items-center gap-4 px-4 py-3 shadow-sm hover:shadow-md hover:border-[#d1d5db] transition-all group">
          {/* Thumbnail */}
          <div className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden" style={thumbnailStyle}>
            {!imageUrl && <span className="w-7 h-7 block">{placeholderIcon}</span>}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <h3 title={title} className="font-semibold text-[#111827] text-sm leading-snug truncate">{title}</h3>
            <p title={description} className="text-xs text-[#6b7280] mt-0.5 line-clamp-1 leading-relaxed">{description}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-[#9ca3af]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                Saved {savedDate}
              </div>
              {tags.slice(0, 3).map((tag) => (
                <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#dbeeff] text-[#1e4d73]">
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f3f4f6] text-[#6b7280]">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openModal}
              aria-label="Edit course details"
              title="Edit course details"
              className="p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-[#f3f4f6] text-[#6b7280] hover:text-[#2d6fa8] transition-colors opacity-0 group-hover:opacity-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setDeleteOpen(true); }}
              aria-label="Delete course"
              title="Delete course"
              className="p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-[#fef2f2] text-[#6b7280] hover:text-[#ef4444] transition-colors opacity-0 group-hover:opacity-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>

            {/* 3-dot — list */}
            <MoreButton className="p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-[#f3f4f6] text-[#6b7280] hover:text-[#374151] transition-colors" />

            <Link
              to={viewHref}
              className="px-4 py-2 rounded-lg bg-[#2d6fa8] hover:bg-[#245c8f] text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              View Course
            </Link>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !cropSrc) setModalOpen(false); }}
        >
          <div className={`bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden ${cropSrc ? "w-full max-w-xl" : "w-full max-w-md"}`}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb] shrink-0">
              <h2 className="font-semibold text-[#111827] text-base">
                {cropSrc ? "Crop & Adjust Image" : "Edit Course Details"}
              </h2>
              {!cropSrc && (
                <button type="button" onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] transition-colors" aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* ── Crop view ── */}
            {cropSrc ? (
              <div className="px-5 py-5">
                <ImageCropper
                  src={cropSrc}
                  aspectRatio={16 / 9}
                  onApply={(croppedUrl) => { setEditImage(croppedUrl); setCropSrc(null); }}
                  onCancel={() => setCropSrc(null)}
                />
              </div>
            ) : (
            <>
            <div className="px-5 py-5 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">Cover Image</label>
                {/* Preview + actions row when image exists */}
                {editImage ? (
                  <div className="flex flex-col gap-2">
                    <div className="h-36 rounded-xl relative overflow-hidden border border-[#e5e7eb]"
                      style={{ backgroundImage: `url(${editImage})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/25 transition-colors" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setAssetPickerOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#374151] border border-[#d1d5db] rounded-lg hover:bg-[#f3f4f6] transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                        Change
                      </button>
                      <button type="button" onClick={handleRemoveImage}
                        className="ml-auto text-xs text-[#ef4444] hover:text-[#dc2626] font-medium transition-colors">
                        Remove image
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="h-36 w-full rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-[#d1d5db] hover:border-[#2d6fa8] transition-colors cursor-pointer relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #2d6fa8 0%, #3498a0 60%, #4db0b8 100%)" }}
                    onClick={() => setAssetPickerOpen(true)}
                    aria-label="Select cover image from asset library"
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span className="mt-2 text-xs text-white/80">Click to select from asset library</span>
                  </button>
                )}
              </div>

              <div>
                <label htmlFor={`course-title-${id}`} className="block text-sm font-medium text-[#374151] mb-1.5">Course Title</label>
                <input type="text" id={`course-title-${id}`} value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  aria-invalid={!trimmedTitle}
                  aria-describedby={!trimmedTitle ? `course-title-error-${id}` : undefined}
                  className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-[#111827] ${!trimmedTitle ? "border-[#ef4444] focus:ring-[#ef4444]" : "border-[#d1d5db] focus:ring-[#2d6fa8]"}`}
                  placeholder="Enter course title" />
                {!trimmedTitle && (
                  <p id={`course-title-error-${id}`} className="mt-1 text-xs text-[#ef4444]">Course title is required.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent text-[#111827] resize-none"
                  placeholder="Enter course description" />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Tags</label>
                {editTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#dbeeff] text-[#1e4d73]">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          aria-label={`Remove tag ${tag}`}
                          className="text-[#1e4d73]/60 hover:text-[#1e4d73] transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="Add a tag and press Enter"
                    className="flex-1 px-3 py-2 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent text-[#111827]"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    disabled={!tagInput.trim()}
                    className="px-3 py-2 text-sm font-medium text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[#e5e7eb] shrink-0">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={!trimmedTitle} className="px-4 py-2 text-sm font-medium text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors">
                Save Changes
              </button>
            </div>
            </>
            )} {/* end cropSrc ternary */}
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#fef2f2] flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-[#111827] text-base">Delete Course</h2>
                  <p className="text-sm text-[#6b7280] mt-1">
                    You are about to delete <span className="font-medium text-[#111827]">"{title}"</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-5">
              <div className="p-4 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
                <p className="text-sm text-[#b91c1c]">
                  ⚠ This action cannot be undone. The course and all its content will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
              <button type="button" onClick={() => setDeleteOpen(false)} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setDeleteOpen(false); onDelete(); }}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#ef4444] hover:bg-[#dc2626] rounded-lg transition-colors"
              >
                Delete Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSET PICKER MODAL ── */}
      {assetPickerOpen && (
        <AssetPickerModal
          onSelect={handleAssetSelected}
          onClose={() => setAssetPickerOpen(false)}
        />
      )}
    </>
  );
}
