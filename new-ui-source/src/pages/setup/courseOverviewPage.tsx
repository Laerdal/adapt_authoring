import { useEffect, useRef, useState } from "react";
import { getCourseBootstrapData, updateCourse, uploadAsset } from "../../api/adaptAuthoring";

interface CourseOverviewPageProps {
  courseId: string;
  title: string;
  description: string;
}

const LANGUAGES: { label: string; iso: string }[] = [
  { label: "English", iso: "en" },
  { label: "Norwegian", iso: "no" },
  { label: "Swedish", iso: "sv" },
  { label: "Danish", iso: "da" },
  { label: "Finnish", iso: "fi" },
  { label: "German", iso: "de" },
  { label: "French", iso: "fr" },
  { label: "Spanish", iso: "es" },
  { label: "Portuguese", iso: "pt" },
  { label: "Italian", iso: "it" },
  { label: "Dutch", iso: "nl" },
  { label: "Polish", iso: "pl" },
  { label: "Russian", iso: "ru" },
  { label: "Arabic", iso: "ar" },
  { label: "Chinese (Simplified)", iso: "zh-CN" },
  { label: "Chinese (Traditional)", iso: "zh-TW" },
  { label: "Japanese", iso: "ja" },
  { label: "Korean", iso: "ko" },
  { label: "Turkish", iso: "tr" },
  { label: "Hindi", iso: "hi" },
];

const ROLE_OPTIONS = ["Viewer", "Editor", "Admin"];

interface Collaborator {
  email: string;
  role: string;
}

export function CourseOverviewPage({
  courseId,
  title: initialTitle,
  description: initialDescription,
}: CourseOverviewPageProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(!!courseId);

  // Committed values (server state)
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [savedDisplayTitle, setSavedDisplayTitle] = useState("");
  const [savedDesc, setSavedDesc] = useState(initialDescription);
  const [savedBody, setSavedBody] = useState("");
  const [savedTags, setSavedTags] = useState<string[]>([]);
  const [savedHeroAssetId, setSavedHeroAssetId] = useState<string | null>(null);

  // Live form values
  const [formTitle, setFormTitle] = useState(initialTitle);
  const [formDisplayTitle, setFormDisplayTitle] = useState("");
  const [formDesc, setFormDesc] = useState(initialDescription);
  const [formBody, setFormBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [heroAssetId, setHeroAssetId] = useState<string | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [language, setLanguage] = useState("");

  // Collaboration (local state — no dedicated backend endpoint yet)
  const [shareMode, setShareMode] = useState<"all" | "specific">("specific");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [emailInput, setEmailInput] = useState("");

  const imageInputRef = useRef<HTMLInputElement>(null);

  // Detect unsaved changes (core fields only)
  const isDirty =
    formTitle !== savedTitle ||
    formDisplayTitle !== savedDisplayTitle ||
    formDesc !== savedDesc ||
    formBody !== savedBody ||
    heroAssetId !== savedHeroAssetId ||
    JSON.stringify(tags) !== JSON.stringify(savedTags);

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
        setSavedDisplayTitle(data.displayTitle);
        setSavedDesc(data.description);
        setSavedBody(data.body);
        setSavedTags(data.tags);
        setSavedHeroAssetId(data.heroAssetId);
        setFormTitle(data.title);
        setFormDisplayTitle(data.displayTitle);
        setFormDesc(data.description);
        setFormBody(data.body);
        setTags(data.tags);
        setHeroAssetId(data.heroAssetId);
        setHeroPreviewUrl(data.heroAssetId ? `/api/asset/serve/${data.heroAssetId}` : null);
      } catch {
        // keep initial values
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  function markDirty() {
    setSaveSuccess(false);
    setSaveError(null);
  }

  function handleAddTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
    markDirty();
  }
  function handleRemoveTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
    markDirty();
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const assetId = await uploadAsset(file, file.name);
      setHeroAssetId(assetId);
      setHeroPreviewUrl(`/api/asset/serve/${assetId}`);
      markDirty();
    } catch {
      setSaveError("Image upload failed. Please try again.");
    } finally {
      setImageUploading(false);
    }
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function handleAddEmail() {
    const email = emailInput.trim();
    if (email && !collaborators.find((c) => c.email === email)) {
      setCollaborators((prev) => [...prev, { email, role: "Editor" }]);
    }
    setEmailInput("");
  }
  function handleRemoveCollaborator(email: string) {
    setCollaborators((prev) => prev.filter((c) => c.email !== email));
  }
  function handleRoleChange(email: string, role: string) {
    setCollaborators((prev) => prev.map((c) => (c.email === email ? { ...c, role } : c)));
  }

  async function handleSave() {
    if (!courseId) return;
    if (!formTitle.trim()) {
      setSaveError("Title is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateCourse(courseId, {
        title: formTitle.trim(),
        displayTitle: formDisplayTitle.trim() || formTitle.trim(),
        description: formDesc.trim(),
        body: formBody.trim(),
        heroAssetId,
        tags,
      });
      setSavedTitle(formTitle.trim());
      setSavedDisplayTitle(formDisplayTitle.trim());
      setSavedDesc(formDesc.trim());
      setSavedBody(formBody.trim());
      setSavedTags(tags);
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
    setFormDisplayTitle(savedDisplayTitle);
    setFormDesc(savedDesc);
    setFormBody(savedBody);
    setTags(savedTags);
    setHeroAssetId(savedHeroAssetId);
    setHeroPreviewUrl(savedHeroAssetId ? `/api/asset/serve/${savedHeroAssetId}` : null);
    setTagInput("");
    setSaveError(null);
    setSaveSuccess(false);
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: '"Lato", sans-serif',
    fontSize: 13,
    fontWeight: 700,
    color: "var(--life-base-black)",   // #1A1A1A
    display: "block",
    marginBottom: 6,
  };

  // Input field border = life-neutral-400 (#949494) — matches Figma border weight
  const inputBase: React.CSSProperties = {
    fontFamily: '"Lato", sans-serif',
    fontSize: 14,
    color: "var(--life-base-black)",           // #1A1A1A
    background: "#ffffff",
    border: "1px solid var(--life-neutral-400)", // #949494 — matches Figma
    borderRadius: 8,
    padding: "10px 14px",
    height: 44,
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s",
    boxSizing: "border-box" as const,
  };

  const textareaBase: React.CSSProperties = {
    ...inputBase,
    height: "auto",
    resize: "none" as const,
  };

  function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = "var(--life-primary-500)"; // #2E7FA1
  }
  function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = "var(--life-neutral-400)"; // #949494
  }

  return (
    <div style={{ maxWidth: 672, fontFamily: '"Lato", sans-serif' }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h4 style={{ fontFamily: '"Lato", sans-serif', fontSize: 20, fontWeight: 700, color: "var(--life-base-black)", margin: 0 }}>
            Course Overview
          </h4>
          <p style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-neutral-400)", margin: "4px 0 0" }}>
            Click any field to review and edit its content inline.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {isDirty && !saving && (
            <button
              type="button"
              onClick={handleDiscard}
              style={{ height: 36, padding: "0 16px", background: "transparent", border: "1px solid var(--life-neutral-200)", borderRadius: 8, cursor: "pointer", fontFamily: '"Lato", sans-serif', fontSize: 14, fontWeight: 600, color: "var(--life-base-black)", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--life-neutral-050)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!courseId || !isDirty || saving || imageUploading || loading}
            style={{ height: 36, padding: "0 18px", background: "var(--life-primary-500)", border: "none", borderRadius: 8, cursor: (!courseId || !isDirty || saving) ? "not-allowed" : "pointer", fontFamily: '"Lato", sans-serif', fontSize: 14, fontWeight: 700, color: "#ffffff", opacity: (!courseId || !isDirty || saving || imageUploading || loading) ? 0.4 : 1, display: "flex", alignItems: "center", gap: 8, transition: "opacity 0.15s" } as React.CSSProperties}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = (!courseId || !isDirty || saving || imageUploading || loading) ? "0.4" : "1"; }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* ── Banners ──────────────────────────────────────────────── */}
      {saveError && (
        <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 8, background: "var(--life-critical-050)", border: "1px solid var(--life-critical-500)", fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-critical-600)" }}>
          {saveError}
        </div>
      )}
      {saveSuccess && !isDirty && (
        <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 8, background: "var(--life-positive-050)", border: "1px solid var(--life-positive-400)", fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-positive-500)" }}>
          Changes saved successfully.
        </div>
      )}

      {/* ── Fields ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Title */}
        <div>
          <label style={labelStyle}>
            Title <span style={{ color: "var(--life-critical-500)", fontWeight: 400 }}>*</span>
          </label>
          <input
            value={formTitle}
            onChange={(e) => { setFormTitle(e.target.value); markDirty(); }}
            placeholder="e.g. Advanced Cardiac Life Support"
            disabled={loading}
            style={inputBase}
            onFocus={focusIn}
            onBlur={focusOut}
          />
        </div>

        {/* Sub-Title */}
        <div>
          <label style={labelStyle}>Sub-Title</label>
          <input
            value={formDisplayTitle}
            onChange={(e) => { setFormDisplayTitle(e.target.value); markDirty(); }}
            placeholder="A brief subtitle for your course"
            disabled={loading}
            style={inputBase}
            onFocus={focusIn}
            onBlur={focusOut}
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            rows={4}
            value={formDesc}
            onChange={(e) => { setFormDesc(e.target.value); markDirty(); }}
            placeholder="Describe what this course is about and what learners will gain"
            disabled={loading}
            style={textareaBase}
            onFocus={focusIn}
            onBlur={focusOut}
          />
        </div>

        {/* Instructions */}
        <div>
          <label style={labelStyle}>Instructions</label>
          <textarea
            rows={4}
            value={formBody}
            onChange={(e) => { setFormBody(e.target.value); markDirty(); }}
            placeholder="Provide any special instructions for learners..."
            disabled={loading}
            style={textareaBase}
            onFocus={focusIn}
            onBlur={focusOut}
          />
        </div>

        {/* Course Image */}
        <div>
          <label style={labelStyle}>Course Image</label>
          <div
            onClick={() => imageInputRef.current?.click()}
            className="group relative cursor-pointer overflow-hidden"
            style={{
              width: "100%", height: 128,
              border: heroPreviewUrl ? "none" : "2px dashed var(--life-neutral-300)",
              borderRadius: 8,
              background: heroPreviewUrl ? "transparent" : "var(--life-neutral-050)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 8,
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => { if (!heroPreviewUrl) { e.currentTarget.style.borderColor = "var(--life-primary-500)"; } }}
            onMouseLeave={(e) => { if (!heroPreviewUrl) { e.currentTarget.style.borderColor = "var(--life-neutral-300)"; } }}
          >
            {heroPreviewUrl ? (
              <>
                <img src={heroPreviewUrl} alt="Course cover" style={{ width: "100%", height: 128, objectFit: "cover", borderRadius: 8 }} />
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.45)", borderRadius: 8 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "#fff", fontWeight: 700 }}>Replace Image</span>
                </div>
              </>
            ) : imageUploading ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: "var(--life-neutral-400)", animation: "spin 1s linear infinite" }}>
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--life-neutral-400)" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-neutral-400)" }}>Choose a cover image</span>
                <span style={{ fontFamily: '"Lato", sans-serif', fontSize: 11, color: "var(--life-neutral-400)" }}>JPG, PNG or WebP · 16:9 aspect ratio recommended</span>
              </>
            )}
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} aria-label="Upload course image" />
          </div>
          {heroPreviewUrl && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setHeroAssetId(null); setHeroPreviewUrl(null); markDirty(); }}
              style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", fontFamily: '"Lato", sans-serif', fontSize: 12, color: "var(--life-neutral-400)", padding: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--life-critical-500)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--life-neutral-400)")}
            >
              Remove image
            </button>
          )}
        </div>

        {/* Tags */}
        <div>
          <label style={labelStyle}>Tags</label>
          <div style={{ display: "flex", gap: 8, marginBottom: tags.length > 0 ? 10 : 0 }}>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
              placeholder="Type a tag and press Enter"
              disabled={loading}
              style={{ ...inputBase, flex: 1 }}
              onFocus={focusIn}
              onBlur={focusOut}
            />
          </div>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "var(--life-neutral-050)", fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-base-black)", border: "1px solid var(--life-neutral-200)" }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--life-neutral-400)", lineHeight: 1, padding: 0, display: "flex", alignItems: "center" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--life-critical-500)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--life-neutral-400)")}
                    aria-label={`Remove tag ${tag}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Default Language */}
        <div>
          <label style={labelStyle}>Default Language</label>
          <div style={{ position: "relative" }}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ ...inputBase, appearance: "none", WebkitAppearance: "none", paddingRight: 36, cursor: "pointer", color: language ? "var(--life-base-black)" : "var(--life-neutral-400)" } as React.CSSProperties}
              onFocus={focusIn}
              onBlur={focusOut}
            >
              <option value="">Select language</option>
              {LANGUAGES.map((lang) => (
                <option key={lang.iso} value={lang.iso}>
                  {lang.iso.toUpperCase()} — {lang.label}
                </option>
              ))}
            </select>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--life-neutral-400)" }}>
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--life-neutral-200)", margin: "28px 0" }} />

      {/* ── Collaboration — Shared With ────────────────────────────── */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <h5 style={{ fontFamily: '"Lato", sans-serif', fontSize: 16, fontWeight: 700, color: "var(--life-base-black)", margin: 0 }}>
            Collaboration — Shared With
          </h5>
          <p style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-neutral-400)", marginTop: 4, marginBottom: 0 }}>
            Collaborators in the instance who have access to this course.
          </p>
        </div>

        {/* Share mode radio */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {(["all", "specific"] as const).map((mode) => (
            <label key={mode} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="radio"
                name="shareMode"
                value={mode}
                checked={shareMode === mode}
                onChange={() => setShareMode(mode)}
                style={{ accentColor: "var(--life-primary-500)", width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
              />
              <span style={{ fontFamily: '"Lato", sans-serif', fontSize: 14, color: "var(--life-base-black)" }}>
                {mode === "all" ? "Share with All" : "Share with"}
              </span>
            </label>
          ))}
        </div>

        {/* Share with All banner */}
        {shareMode === "all" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "var(--life-primary-020)", border: "1px solid var(--life-primary-300)", marginBottom: 12 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--life-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-primary-600)", lineHeight: 1.4 }}>
              All members of your organization will have access to this course.
            </span>
          </div>
        )}

        {/* Email input for specific sharing */}
        {shareMode === "specific" && (
          <div style={{ marginBottom: 14, display: "flex", gap: 8 }}>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddEmail(); } }}
              placeholder="colleague@laerdal.com"
              style={{ ...inputBase, flex: 1 }}
              onFocus={focusIn}
              onBlur={focusOut}
            />
            <button
              type="button"
              onClick={handleAddEmail}
              disabled={!emailInput.trim()}
              style={{ height: 44, padding: "0 18px", background: "var(--life-primary-500)", border: "none", borderRadius: 8, cursor: emailInput.trim() ? "pointer" : "not-allowed", fontFamily: '"Lato", sans-serif', fontSize: 14, fontWeight: 700, color: "#ffffff", opacity: emailInput.trim() ? 1 : 0.4, flexShrink: 0, transition: "opacity 0.15s" } as React.CSSProperties}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = emailInput.trim() ? "1" : "0.4"; }}
            >
              Add
            </button>
          </div>
        )}

        {/* Collaborator list */}
        {collaborators.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {collaborators.map(({ email, role }) => {
              const initials = email.slice(0, 2).toUpperCase();
              return (
                <div key={email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--life-neutral-200)", background: "var(--life-neutral-020)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--life-primary-500)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Lato", sans-serif', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {initials}
                  </div>
                  <span style={{ flex: 1, fontFamily: '"Lato", sans-serif', fontSize: 14, color: "var(--life-base-black)" }}>{email}</span>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(email, e.target.value)}
                    style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-base-black)", background: "#ffffff", border: "1px solid var(--life-neutral-200)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", outline: "none" }}
                  >
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveCollaborator(email)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--life-neutral-400)", display: "flex", alignItems: "center", padding: 4 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--life-critical-500)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--life-neutral-400)")}
                    aria-label={`Remove ${email}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
