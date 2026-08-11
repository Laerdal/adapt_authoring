import { useEffect, useRef, useState } from "react";
import {
  findUserByEmail,
  getCourseBootstrapData,
  getUserById,
  searchUsersByEmailQuery,
  updateCourse,
  type UserSummary,
} from "../../api/adaptAuthoring";
import AssetPickerModal from "../../components/common/AssetPickerModal";
import { UnsavedChangesModal } from "./unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";

interface CourseOverviewPageProps {
  courseId: string;
  title: string;
  description: string;
  onNavigationRequest?: (nav: string) => void;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
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
  userId: string;   // ObjectId on the server
  email: string;
  role: string;     // UI-only — not persisted to engine (no per-user role in engine)
}

export function CourseOverviewPage({
  courseId,
  title: initialTitle,
  description: initialDescription,
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
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
  const [savedLanguage, setSavedLanguage] = useState("");
  const [savedIsShared, setSavedIsShared] = useState(false);
  const [savedCollaborators, setSavedCollaborators] = useState<Collaborator[]>([]);

  // Live form values
  const [formTitle, setFormTitle] = useState(initialTitle);
  const [formDisplayTitle, setFormDisplayTitle] = useState("");
  const [formDesc, setFormDesc] = useState(initialDescription);
  const [formBody, setFormBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [heroAssetId, setHeroAssetId] = useState<string | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [language, setLanguage] = useState("");

  // Collaboration — wired to _isShared and _shareWithUsers on the engine
  const [shareMode, setShareMode] = useState<"all" | "specific">("specific");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [emailSearching, setEmailSearching] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuggestions, setEmailSuggestions] = useState<UserSummary[]>([]);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [activeEmailSuggestionIndex, setActiveEmailSuggestionIndex] = useState(-1);
  const [emailInputFocused, setEmailInputFocused] = useState(false);
  const emailSearchRequestIdRef = useRef(0);
  const [showAuthoringBanner, setShowAuthoringBanner] = useState(true);

  function serializeCollaborators(list: Collaborator[]) {
    return [...list]
      .sort((a, b) => a.userId.localeCompare(b.userId))
      .map(({ userId, role }) => `${userId}:${role}`);
  }

  // Detect unsaved changes (core fields + sharing)
  const isDirty =
    formTitle !== savedTitle ||
    formDisplayTitle !== savedDisplayTitle ||
    formDesc !== savedDesc ||
    formBody !== savedBody ||
    heroAssetId !== savedHeroAssetId ||
    language !== savedLanguage ||
    JSON.stringify(tags) !== JSON.stringify(savedTags) ||
    (shareMode === "all") !== savedIsShared ||
    JSON.stringify(serializeCollaborators(collaborators)) !==
      JSON.stringify(serializeCollaborators(savedCollaborators));

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
        setSavedDisplayTitle(data.subtitle);
        setSavedDesc(data.description);
        setSavedBody(data.body);
        setSavedTags(data.tags);
        setSavedHeroAssetId(data.heroAssetId);
        setFormTitle(data.title);
        setFormDisplayTitle(data.subtitle);
        setFormDesc(data.description);
        setFormBody(data.body);
        setTags(data.tags);
        setHeroAssetId(data.heroAssetId);
        setHeroPreviewUrl(data.heroAssetId ? `/api/asset/serve/${data.heroAssetId}` : null);
        setLanguage(data.language);
        setSavedLanguage(data.language);

        // Load sharing state
        const isShared = data.isShared;
        setSavedIsShared(isShared);
        setShareMode(isShared ? "all" : "specific");

        // Resolve user IDs to email addresses for the collaborator list
        if (data.shareWithUserIds.length > 0) {
          const resolved = await Promise.all(
            data.shareWithUserIds.map(async (uid) => {
              const user = await getUserById(uid);
              return user ? { userId: uid, email: user.email, role: "Editor" } : null;
            })
          );
          const validCollabs = resolved.filter((c): c is Collaborator => c !== null);
          setSavedCollaborators(validCollabs);
          setCollaborators(validCollabs);
        }
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

  useEffect(() => {
    const trimmedEmailInput = emailInput.trim();
    const shouldSearch =
      shareMode === "specific" && (trimmedEmailInput.length > 0 || emailInputFocused);

    if (!shouldSearch) {
      setEmailSuggestions([]);
      setShowEmailSuggestions(false);
      setActiveEmailSuggestionIndex(-1);
      setEmailSearching(false);
      return;
    }

    const requestId = ++emailSearchRequestIdRef.current;
    const timeoutId = window.setTimeout(async () => {
      setEmailSearching(true);
      try {
        const users = await searchUsersByEmailQuery(trimmedEmailInput);
        if (emailSearchRequestIdRef.current !== requestId) return;
        const existingUserIds = new Set(collaborators.map((c) => c.userId));
        const filteredUsers = users.filter((u) => !existingUserIds.has(u._id));
        setEmailSuggestions(filteredUsers);
        setShowEmailSuggestions(true);
        setActiveEmailSuggestionIndex(filteredUsers.length ? 0 : -1);
      } catch {
        if (emailSearchRequestIdRef.current !== requestId) return;
        setEmailSuggestions([]);
        setShowEmailSuggestions(false);
      } finally {
        if (emailSearchRequestIdRef.current === requestId) {
          setEmailSearching(false);
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [emailInput, shareMode, collaborators, emailInputFocused]);

  function addCollaborator(user: UserSummary) {
    if (collaborators.find((c) => c.userId === user._id || c.email.toLowerCase() === user.email.toLowerCase())) {
      setEmailError("This user is already in the list.");
      return;
    }
    setCollaborators((prev) => [...prev, { userId: user._id, email: user.email, role: "Editor" }]);
    setEmailInput("");
    setEmailSuggestions([]);
    setShowEmailSuggestions(false);
    setActiveEmailSuggestionIndex(-1);
    setEmailError(null);
    markDirty();
  }

  function handleSelectEmailSuggestion(user: UserSummary) {
    addCollaborator(user);
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

  async function handleAddEmail() {
    const email = emailInput.trim();
    if (!email) return;
    if (showEmailSuggestions && activeEmailSuggestionIndex >= 0 && emailSuggestions[activeEmailSuggestionIndex]) {
      handleSelectEmailSuggestion(emailSuggestions[activeEmailSuggestionIndex]);
      return;
    }

    if (collaborators.find((c) => c.email.toLowerCase() === email.toLowerCase())) {
      setEmailError("This user is already in the list.");
      return;
    }

    setEmailSearching(true);
    setEmailError(null);
    try {
      const user = await findUserByEmail(email);
      if (!user) {
        setEmailError(`No user found with email "${email}". Make sure the user has an account first.`);
        return;
      }
      addCollaborator(user);
    } catch {
      setEmailError("Failed to look up user. Please try again.");
    } finally {
      setEmailSearching(false);
    }
  }
  function handleRemoveCollaborator(userId: string) {
    setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
    markDirty();
  }
  function handleRoleChange(userId: string, role: string) {
    setCollaborators((prev) => prev.map((c) => (c.userId === userId ? { ...c, role } : c)));
    markDirty();
  }

  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } =
    useUnsavedChangesNavigationGuard({
      hasChanges: isDirty,
      pendingNavigation,
      onPendingNavigationHandled,
      onNavigate: onNavigationRequest,
    });

  async function handleConfirmSave() {
    const didSave = await handleSave();
    if (!didSave) return;
    const navTarget = consumePendingNavigation();
    if (navTarget) onNavigationRequest?.(navTarget);
  }

  function handleConfirmDiscard() {
    handleDiscard();
    const navTarget = consumePendingNavigation();
    if (navTarget) onNavigationRequest?.(navTarget);
  }

  async function handleSave() {
    if (!courseId) return false;
    if (!formTitle.trim()) {
      setSaveError("Title is required.");
      return false;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const isSharedAll = shareMode === "all";
      await updateCourse(courseId, {
        title: formTitle.trim(),
        displayTitle: formTitle.trim(),
        subtitle: formDisplayTitle.trim(),
        description: formDesc.trim(),
        instruction: formBody.trim(),
        heroAssetId,
        tags,
        isShared: isSharedAll,
        shareWithUserIds: isSharedAll ? [] : collaborators.map((c) => c.userId),
        language,
      });
      setSavedTitle(formTitle.trim());
      setSavedDisplayTitle(formDisplayTitle.trim());
      setSavedDesc(formDesc.trim());
      setSavedBody(formBody.trim());
      setSavedTags(tags);
      setSavedHeroAssetId(heroAssetId);
      setSavedLanguage(language);
      setSavedIsShared(isSharedAll);
      const nextSavedCollaborators = isSharedAll ? [] : collaborators;
      setSavedCollaborators(nextSavedCollaborators);
      if (isSharedAll) {
        setCollaborators([]);
        setEmailInput("");
        setEmailSuggestions([]);
        setShowEmailSuggestions(false);
        setActiveEmailSuggestionIndex(-1);
        setEmailError(null);
      }
      setSaveSuccess(true);
      return true;
    } catch {
      setSaveError("Failed to save changes. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenCourseStructure() {
    if (loading || !courseId) return;
    if (isDirty) {
      const didSave = await handleSave();
      if (!didSave) return;
    }
    onNavigationRequest?.("structure");
  }

  function handleDiscard() {
    setFormTitle(savedTitle);
    setFormDisplayTitle(savedDisplayTitle);
    setFormDesc(savedDesc);
    setFormBody(savedBody);
    setTags(savedTags);
    setHeroAssetId(savedHeroAssetId);
    setHeroPreviewUrl(savedHeroAssetId ? `/api/asset/serve/${savedHeroAssetId}` : null);
    setLanguage(savedLanguage);
    setTagInput("");
    setShareMode(savedIsShared ? "all" : "specific");
    setCollaborators(savedCollaborators);
    setEmailInput("");
    setEmailSuggestions([]);
    setShowEmailSuggestions(false);
    setActiveEmailSuggestionIndex(-1);
    setEmailError(null);
    setSaveError(null);
    setSaveSuccess(false);
  }

  function handleEmailInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (!showEmailSuggestions || emailSuggestions.length === 0) return;
      e.preventDefault();
      setActiveEmailSuggestionIndex((prev) => (prev + 1) % emailSuggestions.length);
      return;
    }
    if (e.key === "ArrowUp") {
      if (!showEmailSuggestions || emailSuggestions.length === 0) return;
      e.preventDefault();
      setActiveEmailSuggestionIndex((prev) => (prev <= 0 ? emailSuggestions.length - 1 : prev - 1));
      return;
    }
    if (e.key === "Escape") {
      setShowEmailSuggestions(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEmail();
    }
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
      <div style={{ marginBottom: 28 }}>
        <h4 style={{ fontFamily: '"Lato", sans-serif', fontSize: 20, fontWeight: 700, color: "var(--life-base-black)", margin: 0 }}>
          Course Overview
        </h4>
        <p style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-neutral-400)", margin: "4px 0 0" }}>
          Click any field to review and edit its content inline.
        </p>
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
            role="button"
            tabIndex={0}
            aria-label={heroPreviewUrl ? "Replace course image" : "Choose a cover image"}
            onClick={() => setIsAssetPickerOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsAssetPickerOpen(true);
              }
            }}
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
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setHeroAssetId(null); setHeroPreviewUrl(null); markDirty(); }}
                  aria-label="Remove image"
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    border: "none",
                    background: "rgba(255,255,255,0.95)",
                    color: "var(--life-neutral-500)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: 2,
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.color = "var(--life-critical-500)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.95)";
                    e.currentTarget.style.color = "var(--life-neutral-500)";
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.45)", borderRadius: 8 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l2 3h6a2 2 0 0 1 2 2z" />
                  </svg>
                  <span style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "#fff", fontWeight: 700 }}>Replace Image</span>
                </div>
              </>
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--life-neutral-400)" }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l2 3h6a2 2 0 0 1 2 2z" />
                </svg>
                <span style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-neutral-400)" }}>Choose a cover image</span>
                <span style={{ fontFamily: '"Lato", sans-serif', fontSize: 11, color: "var(--life-neutral-400)" }}>JPG, PNG or WebP · 16:9 aspect ratio recommended</span>
              </>
            )}
          </div>
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
              onChange={(e) => { setLanguage(e.target.value); markDirty(); }}
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
          <div style={{ marginBottom: 14 }}>
            <div style={{ position: "relative", display: "flex", gap: 8, marginBottom: emailError ? 6 : 0 }}>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setEmailError(null);
                  if (!showEmailSuggestions) setShowEmailSuggestions(true);
                }}
                onKeyDown={handleEmailInputKeyDown}
                placeholder="colleague@laerdal.com"
                style={inputBase}
                onFocus={(e) => {
                  focusIn(e);
                  setEmailInputFocused(true);
                  if (emailSuggestions.length > 0) setShowEmailSuggestions(true);
                }}
                onBlur={(e) => {
                  focusOut(e);
                  setEmailInputFocused(false);
                  window.setTimeout(() => setShowEmailSuggestions(false), 120);
                }}
              />
              {showEmailSuggestions && (emailSuggestions.length > 0 || emailSearching) && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    background: "#ffffff",
                    border: "1px solid var(--life-neutral-200)",
                    borderRadius: 8,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                    maxHeight: 220,
                    overflowY: "auto",
                  }}
                >
                  {emailSearching && emailSuggestions.length === 0 ? (
                    <div style={{ padding: "10px 12px", fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-neutral-400)" }}>
                      Searching users...
                    </div>
                  ) : (
                    emailSuggestions.map((user, index) => {
                      const isActive = index === activeEmailSuggestionIndex;
                      return (
                        <button
                          key={user._id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleSelectEmailSuggestion(user);
                          }}
                          onMouseEnter={() => setActiveEmailSuggestionIndex(index)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            border: "none",
                            background: isActive ? "var(--life-primary-020)" : "#ffffff",
                            padding: "10px 12px",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          <span style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, fontWeight: 700, color: "var(--life-base-black)" }}>
                            {user.email}
                          </span>
                          {(user.firstName || user.lastName) && (
                            <span style={{ fontFamily: '"Lato", sans-serif', fontSize: 12, color: "var(--life-neutral-400)" }}>
                              {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            {emailError && (
              <div style={{ fontFamily: '"Lato", sans-serif', fontSize: 12, color: "var(--life-critical-600)", marginTop: 4, lineHeight: 1.4 }}>
                {emailError}
              </div>
            )}
          </div>
        )}

        {/* Collaborator list */}
        {shareMode === "specific" && collaborators.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {collaborators.map(({ userId, email, role }) => {
              const initials = email.slice(0, 2).toUpperCase();
              return (
                <div key={userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--life-neutral-200)", background: "var(--life-neutral-020)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--life-primary-500)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Lato", sans-serif', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {initials}
                  </div>
                  <span style={{ flex: 1, fontFamily: '"Lato", sans-serif', fontSize: 14, color: "var(--life-base-black)" }}>{email}</span>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(userId, e.target.value)}
                    disabled
                    title="Roles are not configurable yet"
                    style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-base-black)", background: "#ffffff", border: "1px solid var(--life-neutral-200)", borderRadius: 6, padding: "4px 10px", cursor: "not-allowed", outline: "none", opacity: 0.7 }}
                  >
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveCollaborator(userId)}
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

      {showAuthoringBanner && (
        <>
          <div style={{ height: 1, background: "var(--life-neutral-200)", margin: "28px 0" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 20px", borderRadius: 10, background: "var(--life-primary-020)", border: "1px solid var(--life-primary-300)" }}>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--life-primary-500)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
              </svg>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: '"Lato", sans-serif', fontSize: 15, fontWeight: 700, color: "var(--life-base-black)", marginBottom: 4 }}>
                Ready to start authoring?
              </div>
              <div style={{ fontFamily: '"Lato", sans-serif', fontSize: 13, color: "var(--life-neutral-500)", lineHeight: 1.55, marginBottom: 14 }}>
                Nice - now start authoring by adding pages and building your course structure. We&apos;ve already scaffolded a starter tree for you.
              </div>
              <button
                type="button"
                onClick={handleOpenCourseStructure}
                disabled={loading || saving || !courseId}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--life-primary-500)] px-4 py-2 text-sm font-bold text-[var(--life-base-white)] transition-colors hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>Open Course Structure</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAuthoringBanner(false)}
              aria-label="Dismiss"
              className="absolute top-[14px] right-[14px] flex items-center rounded text-[var(--life-neutral-400)] transition-colors hover:text-[var(--life-base-black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--life-primary-500)] focus-visible:ring-offset-2"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Floating "Unsaved changes" bar — only while the form is dirty */}
      {!loading && isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-[var(--life-warning-100)] shadow-lg animate-fade-in-down">
          <span className="flex items-center gap-2 text-sm text-[#374151]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-warning-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Unsaved changes
          </span>
          {saveError && <span className="text-xs text-[#ef4444] max-w-[180px] truncate">{saveError}</span>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !courseId}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--life-base-white)] bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {isAssetPickerOpen ? (
        <AssetPickerModal
          onSelect={(asset) => {
            setHeroAssetId(asset.id);
            setHeroPreviewUrl(asset.url || `/api/asset/serve/${asset.id}`);
            markDirty();
            setIsAssetPickerOpen(false);
          }}
          onClose={() => setIsAssetPickerOpen(false)}
        />
      ) : null}

      <UnsavedChangesModal
        isOpen={showConfirmModal}
        isSaving={saving}
        onDiscard={handleConfirmDiscard}
        onSave={handleConfirmSave}
        onClose={clearPendingNavigation}
      />
    </div>
  );
}
