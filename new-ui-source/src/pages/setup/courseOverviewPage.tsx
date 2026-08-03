import { useEffect, useRef, useState } from "react";
import { getCourseBootstrapData, updateCourse, uploadAsset } from "../../api/adaptAuthoring";

interface CourseOverviewPageProps {
  courseId: string;
  title: string;
  description: string;
}

export function CourseOverviewPage({ courseId, title: initialTitle, description: initialDescription }: CourseOverviewPageProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(!!courseId);

  // Values that reflect what is saved on the server
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [savedDesc, setSavedDesc] = useState(initialDescription);
  const [savedBody, setSavedBody] = useState("");
  const [savedTags, setSavedTags] = useState<string[]>([]);
  const [savedHeroAssetId, setSavedHeroAssetId] = useState<string | null>(null);

  // Live form values
  const [formTitle, setFormTitle] = useState(initialTitle);
  const [formDesc, setFormDesc] = useState(initialDescription);
  const [formBody, setFormBody] = useState("");
  const [formTags, setFormTags] = useState("");
  const [heroAssetId, setHeroAssetId] = useState<string | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect unsaved changes
  const parsedTags = formTags.split(",").map((t) => t.trim()).filter(Boolean);
  const isDirty =
    formTitle.trim() !== savedTitle ||
    formDesc.trim() !== savedDesc ||
    formBody.trim() !== savedBody ||
    heroAssetId !== savedHeroAssetId ||
    JSON.stringify(parsedTags) !== JSON.stringify(savedTags);

  // Load full course data on mount
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await getCourseBootstrapData(courseId);
        if (cancelled) return;
        setSavedTitle(data.title);
        setSavedDesc(data.description);
        setSavedBody(data.body);
        setSavedTags(data.tags);
        setSavedHeroAssetId(data.heroAssetId);
        setFormTitle(data.title);
        setFormDesc(data.description);
        setFormBody(data.body);
        setFormTags(data.tags.join(", "));
        setHeroAssetId(data.heroAssetId);
        setHeroPreviewUrl(data.heroAssetId ? `/api/asset/serve/${data.heroAssetId}` : null);
      } catch {
        // keep initial values
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId]);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setSaveError(null);
    try {
      const assetId = await uploadAsset(file, file.name);
      setHeroAssetId(assetId);
      setHeroPreviewUrl(`/api/asset/serve/${assetId}`);
    } catch {
      setSaveError("Image upload failed. Please try again.");
    } finally {
      setImageUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    if (!courseId) return;
    if (!formTitle.trim()) {
      setSaveError("Course title is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateCourse(courseId, {
        title: formTitle.trim(),
        description: formDesc.trim(),
        body: formBody.trim(),
        heroAssetId,
        tags: parsedTags,
      });
      setSavedTitle(formTitle.trim());
      setSavedDesc(formDesc.trim());
      setSavedBody(formBody.trim());
      setSavedTags(parsedTags);
      setSavedHeroAssetId(heroAssetId);
      setSaveSuccess(true);
    } catch {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setFormTitle(savedTitle);
    setFormDesc(savedDesc);
    setFormBody(savedBody);
    setFormTags(savedTags.join(", "));
    setHeroAssetId(savedHeroAssetId);
    setHeroPreviewUrl(savedHeroAssetId ? `/api/asset/serve/${savedHeroAssetId}` : null);
    setSaveError(null);
    setSaveSuccess(false);
  }

  const fieldClass = "w-full px-3 py-2.5 text-sm rounded-lg border border-[#e5e7eb] bg-[#f9fafb] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent focus:bg-white transition-colors";

  return (
    <div className="max-w-2xl w-full">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">Course Overview</h2>
          <p className="text-sm text-[#6b7280] mt-0.5">Edit the core details for your course.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && !saving && (
            <button
              type="button"
              onClick={handleDiscard}
              className="px-4 py-2 text-sm font-semibold text-[#374151] bg-white border border-[#e5e7eb] hover:bg-[#f3f4f6] rounded-lg transition-colors"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!courseId || !isDirty || saving || imageUploading || loading}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving…
              </>
            ) : "Save"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mt-3 px-3 py-2 text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg">{saveError}</div>
      )}
      {saveSuccess && !isDirty && (
        <div className="mt-3 px-3 py-2 text-sm text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">Changes saved successfully.</div>
      )}

      <div className="mt-6 flex flex-col gap-5">
        {/* Course Title */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">
            Course Title <span className="text-[#ef4444]">*</span>
          </label>
          <input
            type="text"
            value={formTitle}
            onChange={(e) => { setFormTitle(e.target.value); setSaveSuccess(false); }}
            placeholder="Enter course title"
            disabled={loading}
            className={fieldClass}
          />
        </div>

        {/* Course Description */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Course Description</label>
          <textarea
            value={formDesc}
            onChange={(e) => { setFormDesc(e.target.value); setSaveSuccess(false); }}
            rows={3}
            placeholder="Enter a description for this course"
            disabled={loading}
            className={`${fieldClass} resize-none`}
          />
        </div>

        {/* Body / Instructions */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Instructions</label>
          <p className="text-xs text-[#6b7280] mb-1.5">Displayed on the course menu page in the running course.</p>
          <textarea
            value={formBody}
            onChange={(e) => { setFormBody(e.target.value); setSaveSuccess(false); }}
            rows={3}
            placeholder="Enter instructions for learners"
            disabled={loading}
            className={`${fieldClass} resize-none`}
          />
        </div>

        {/* Course Image (heroImage) */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Course Image</label>
          <div className="w-full h-32 rounded-lg bg-[#f3f4f6] border border-[#e5e7eb] flex items-center justify-center text-sm text-[#9ca3af] overflow-hidden relative">
            {heroPreviewUrl && (
              <img src={heroPreviewUrl} alt="Course hero" className="absolute inset-0 w-full h-full object-cover" />
            )}
            <label className={`cursor-pointer flex flex-col items-center gap-2 transition-colors z-10 ${heroPreviewUrl ? "bg-black/40 absolute inset-0 w-full h-full justify-center text-white hover:bg-black/60" : "text-[#6b7280] hover:text-[#2d6fa8]"}`}>
              {imageUploading ? (
                <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span className="text-xs">{heroPreviewUrl ? "Change image" : "Click to upload image"}</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                title="Upload course image"
                aria-label="Upload course image"
                onChange={handleImageChange}
              />
            </label>
          </div>
          {heroPreviewUrl && (
            <button
              type="button"
              onClick={() => { setHeroAssetId(null); setHeroPreviewUrl(null); setSaveSuccess(false); }}
              className="mt-1 text-xs text-[#ef4444] hover:underline"
            >
              Remove image
            </button>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Tags</label>
          <input
            type="text"
            value={formTags}
            onChange={(e) => { setFormTags(e.target.value); setSaveSuccess(false); }}
            placeholder="Add tags, separated by commas"
            disabled={loading}
            className={fieldClass}
          />
          {parsedTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {parsedTags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 text-xs bg-[#e0e7ff] text-[#3730a3] rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Collaboration */}
        <div className="border-t border-[#e5e7eb] pt-5">
          <p className="text-sm font-semibold text-[#111827]">Collaboration — Shared With</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Collaborator sharing is managed through the course dashboard.</p>
        </div>
      </div>
    </div>
  );
}
