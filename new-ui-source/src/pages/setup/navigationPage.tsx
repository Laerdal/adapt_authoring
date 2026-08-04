import React, { useEffect, useState } from "react";
import AssetPickerModal from "../../components/common/AssetPickerModal";
import {
  getNavigationSettings,
  saveNavigationSettings,
  getCoursePages,
  defaultNavigationSettings,
  type NavigationSettings,
  type CoursePageOption,
  type NavFooterButtonKey,
} from "../../api/adaptAuthoring";

/* ── Shared checkbox row (local copy; mirrors SetupPage's) ── */
function CheckboxRow({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer group ${disabled ? "opacity-40 pointer-events-none" : "hover:bg-[#f9fafb]"}`}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
          checked ? "bg-[var(--life-primary-500)] border-[var(--life-primary-500)]" : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
        }`}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span className="text-sm text-[#374151] leading-snug">{label}</span>
    </label>
  );
}

/* ── Navigation Panel ── */

// Collapsible card matching the Figma "Navigation Settings" accordion sections.
// Controlled (single-open): the parent owns which section is expanded so opening
// one collapses the others. Header has a hover state and a right-aligned chevron
// that rotates down when open.
function NavAccordion({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[var(--life-primary-020)] transition-colors"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--life-base-black)]">{title}</h3>
          {subtitle && <p className="text-xs text-[#9ca3af] mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        <svg
          className={`shrink-0 ml-auto transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--life-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-[#f3f4f6] flex flex-col gap-3">{children}</div>}
    </div>
  );
}

// Styled <select> with chevron + optional help text (matches the Menu Lock control).
function NavSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  help,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          aria-label={label}
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[var(--life-base-black)] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent pr-8"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {help && <p className="text-[11px] text-[#9ca3af] bg-[#f9fafb] border border-[#eef1f4] rounded-md px-2.5 py-1.5 leading-snug">{help}</p>}
    </div>
  );
}

function NavTextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
      />
    </div>
  );
}

const MENU_LOCK_OPTIONS: { value: NavigationSettings["lockType"]; label: string }[] = [
  { value: "",           label: "— None —" },
  { value: "custom",     label: "Custom" },
  { value: "lockLast",   label: "Lock Last" },
  { value: "sequential", label: "Sequential" },
  { value: "unlockFirst", label: "Unlock First" },
];

const FOOTER_BUTTON_META: { key: NavFooterButtonKey; label: string }[] = [
  { key: "_home",     label: "Home" },
  { key: "_up",       label: "Up" },
  { key: "_previous", label: "Previous" },
  { key: "_next",     label: "Next" },
  { key: "_close",    label: "Close" },
  { key: "_custom",   label: "Custom" },
];

export function NavigationPage({ courseId }: { courseId: string }) {
  const [s, setS] = useState<NavigationSettings>(defaultNavigationSettings());
  // Last-persisted snapshot: drives the "Unsaved changes" bar + Cancel (revert).
  const [savedSnapshot, setSavedSnapshot] = useState<NavigationSettings>(defaultNavigationSettings());
  const [pages, setPages] = useState<CoursePageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [externalOpen, setExternalOpen] = useState(false);
  // Single-open accordion: only one section expanded at a time; all collapsed on load.
  const [openSection, setOpenSection] = useState<string>("");
  const acc = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((s) => (s === id ? "" : id)),
  });

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [loaded, loadedPages] = await Promise.all([
          getNavigationSettings(courseId),
          getCoursePages(courseId),
        ]);
        if (cancelled) return;
        setS(loaded);
        setSavedSnapshot(loaded);
        setPages(loadedPages);
      } catch {
        /* keep defaults on failure */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId]);

  // ── State updaters (settings is deeply nested; keep mutations narrow) ──
  const setStart = (p: Partial<NavigationSettings["start"]>) =>
    setS((prev) => ({ ...prev, start: { ...prev.start, ...p } }));
  const setStartId = (i: number, p: Partial<NavigationSettings["start"]["_startIds"][number]>) =>
    setS((prev) => ({
      ...prev,
      start: { ...prev.start, _startIds: prev.start._startIds.map((it, idx) => (idx === i ? { ...it, ...p } : it)) },
    }));
  const addStartId = () => {
    // Require at least one page: a start entry's _id must point to a real page,
    // so don't append an entry with an empty _id (that would save invalid settings).
    if (!pages.length) return;
    setS((prev) => ({
      ...prev,
      start: {
        ...prev.start,
        _startIds: [...prev.start._startIds, { _id: pages[0].id, _skipIfComplete: false, _className: "" }],
      },
    }));
  };
  const removeStartId = (i: number) =>
    setS((prev) => ({ ...prev, start: { ...prev.start, _startIds: prev.start._startIds.filter((_, idx) => idx !== i) } }));
  const setNav = (p: Partial<NavigationSettings["navigation"]>) =>
    setS((prev) => ({ ...prev, navigation: { ...prev.navigation, ...p } }));
  const setCourseMenu = (p: Partial<NavigationSettings["courseMenu"]>) =>
    setS((prev) => ({ ...prev, courseMenu: { ...prev.courseMenu, ...p } }));
  const setHeaderLogo = (p: Partial<NavigationSettings["headerLogo"]>) =>
    setS((prev) => ({ ...prev, headerLogo: { ...prev.headerLogo, ...p } }));
  const setNavFooter = (p: Partial<NavigationSettings["navFooter"]>) =>
    setS((prev) => ({ ...prev, navFooter: { ...prev.navFooter, ...p } }));
  const setFooterButton = (k: NavFooterButtonKey, p: Partial<NavigationSettings["navFooter"]["buttons"][NavFooterButtonKey]>) =>
    setS((prev) => ({
      ...prev,
      navFooter: { ...prev.navFooter, buttons: { ...prev.navFooter.buttons, [k]: { ...prev.navFooter.buttons[k], ...p } } },
    }));

  const dirty = JSON.stringify(s) !== JSON.stringify(savedSnapshot);

  // Auto-dismiss the toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCancel() {
    setS(savedSnapshot);
  }

  async function handleSave() {
    if (!courseId || saving) return;
    setSaving(true);
    setToast(null);
    try {
      await saveNavigationSettings(courseId, s);
      setSavedSnapshot(s);
      setToast({ type: "success", message: "Changes saved successfully" });
    } catch {
      setToast({ type: "error", message: "Couldn't save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const pageOptions = [
    { value: "", label: pages.length ? "Select a page…" : "No pages yet" },
    ...pages.map((p) => ({ value: p.id, label: p.title })),
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#f7f9fb]">
      {/* Header */}
      <div className="shrink-0 px-6 py-5 bg-white border-b border-[#e5e7eb]">
        <h2 className="text-xl font-bold text-[var(--life-base-black)]">Navigation</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Configure the navigation bar, start behavior, and header/footer for your course.</p>
      </div>

      {/* Scrollable settings */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl px-6 py-6 flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-[#6b7280]">
              <svg className="animate-spin mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Loading navigation settings…
            </div>
          ) : (
            <>
              {/* ── Start settings ── */}
              <NavAccordion {...acc("start")} title="Start settings" subtitle="Choose which page(s) learners land on when they open the course.">
                <CheckboxRow checked={s.start._isEnabled} onChange={(v) => setStart({ _isEnabled: v })} label="Enabled?" />

                {s.start._isEnabled && (
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold text-[#374151]">Start list</span>
                    {s.start._startIds.length === 0 && (
                      <p className="text-[11px] text-[#9ca3af]">No start pages added yet.</p>
                    )}
                    {s.start._startIds.map((item, i) => (
                      <div key={i} className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 flex flex-col gap-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <NavSelect
                              label="Start page"
                              value={item._id}
                              onChange={(v) => setStartId(i, { _id: v })}
                              options={pageOptions}
                            />
                          </div>
                          <button
                            type="button"
                            aria-label="Remove start page"
                            onClick={() => removeStartId(i)}
                            className="mb-1 p-2 rounded-lg text-[#9ca3af] hover:text-[var(--life-critical-500)] hover:bg-[var(--life-critical-050)] transition-colors"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6h16zM10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </div>
                        <CheckboxRow checked={item._skipIfComplete} onChange={(v) => setStartId(i, { _skipIfComplete: v })} label="Skip if complete?" />
                        <NavTextInput label="Classes" value={item._className} onChange={(v) => setStartId(i, { _className: v })} placeholder="Optional class matcher" />
                      </div>
                    ))}
                    <div>
                      <button
                        type="button"
                        onClick={addStartId}
                        disabled={!pages.length}
                        title={!pages.length ? "Add a page to the course first" : undefined}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[var(--life-base-white)] bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add
                      </button>
                      {!pages.length && (
                        <p className="text-[11px] text-[#9ca3af] mt-1.5">Add a page to the course before choosing a start page.</p>
                      )}
                    </div>
                  </div>
                )}

                <CheckboxRow checked={s.start._force} onChange={(v) => setStart({ _force: v })} label="Force routing" />
                <CheckboxRow checked={s.start._isMenuDisabled} onChange={(v) => setStart({ _isMenuDisabled: v })} label="Disable menu" />
              </NavAccordion>

              {/* ── Menu Lock Settings ── */}
              <NavAccordion {...acc("menuLock")} title="Menu Lock Settings" subtitle="Restrict how learners can move between menu items.">
                <NavSelect
                  label="Menu Lock"
                  value={s.lockType}
                  onChange={(v) => setS((prev) => ({ ...prev, lockType: v }))}
                  options={MENU_LOCK_OPTIONS}
                />
              </NavAccordion>

              {/* ── Course menu ── */}
              <NavAccordion {...acc("courseMenu")} title="Course menu" subtitle="Controls whether the top bar exposes the course menu.">
                <CheckboxRow checked={s.courseMenu.enabled} onChange={(v) => setCourseMenu({ enabled: v })} label="Enable Course Menu" />
                <div className="ml-7">
                  <CheckboxRow
                    checked={s.courseMenu.includeSubmenuInNavigation}
                    onChange={(v) => setCourseMenu({ includeSubmenuInNavigation: v })}
                    label="Include Submenu in Navigation"
                    disabled={!s.courseMenu.enabled}
                  />
                </div>
              </NavAccordion>

              {/* ── Header logo ── */}
              <NavAccordion {...acc("headerLogo")} title="Header logo" subtitle="Show a logo in the top navigation bar.">
                <CheckboxRow checked={s.headerLogo.enabled} onChange={(v) => setHeaderLogo({ enabled: v })} label="Enable Header Logo" />

                {s.headerLogo.enabled && (
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold text-[#374151]">Logo</span>

                    {s.headerLogo.src ? (
                      <div className="flex items-center gap-3 p-3 border border-[#e5e7eb] rounded-lg bg-white">
                        <img src={s.headerLogo.src} alt="logo" className="h-9 max-w-[96px] object-contain rounded" />
                        <span className="text-[11px] text-[#6b7280] truncate flex-1 min-w-0">{s.headerLogo.src}</span>
                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAssetPickerOpen(true)}
                            className="text-xs px-2.5 py-1.5 border border-[var(--life-primary-500)] rounded-[8px] text-[var(--life-primary-500)] hover:bg-[var(--life-primary-050)] transition-colors"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeaderLogo({ src: "" })}
                            className="text-xs px-2.5 py-1.5 border border-[var(--life-critical-500)] rounded-[8px] text-[var(--life-critical-500)] hover:bg-[var(--life-critical-050)] transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setAssetPickerOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[var(--life-base-white)] bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] rounded-lg transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          Select an Asset
                        </button>
                        <button
                          type="button"
                          onClick={() => setExternalOpen((v) => !v)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[var(--life-primary-500)] border border-[var(--life-primary-500)] hover:bg-[var(--life-primary-050)] active:bg-[var(--life-primary-100)] rounded-lg transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                          Select an External Asset
                        </button>
                      </div>
                    )}

                    {externalOpen && !s.headerLogo.src && (
                      <NavTextInput
                        label="External asset URL"
                        value={s.headerLogo.src}
                        onChange={(v) => setHeaderLogo({ src: v })}
                        placeholder="https://example.com/logo.png"
                      />
                    )}

                    <div className="rounded-lg bg-[#f9fafb] border border-[#eef1f4] px-3.5 py-2.5">
                      <p className="text-xs font-semibold text-[#374151]">Logo recommendations</p>
                      <p className="text-[11px] text-[#9ca3af] mt-0.5">Preferred aspect ratio: 4:1</p>
                      <p className="text-[11px] text-[#9ca3af]">Use PNG with transparent background for best results</p>
                    </div>

                    <NavTextInput
                      label="Tooltip"
                      value={s.headerLogo.tooltip}
                      onChange={(v) => setHeaderLogo({ tooltip: v })}
                      placeholder="e.g. Return to course home"
                    />
                  </div>
                )}
              </NavAccordion>

              {/* ── Navigation settings (core nav bar) ── */}
              <NavAccordion {...acc("navigation")} title="Navigation settings" subtitle="Placement of the primary navigation bar and its labels.">
                <CheckboxRow
                  checked={s.navigation.isDefaultNavigationDisabled}
                  onChange={(v) => setNav({ isDefaultNavigationDisabled: v })}
                  label="Disable default navigation bar?"
                />
                <NavSelect
                  label="Navigation alignment"
                  value={s.navigation.navigationAlignment}
                  onChange={(v) => setNav({ navigationAlignment: v })}
                  options={[
                    { value: "top", label: "top" },
                    { value: "bottom", label: "bottom" },
                  ]}
                  help="Where the primary navigation bar is displayed relative to the course content."
                />
                <CheckboxRow
                  checked={s.navigation.isBottomOnTouchDevices}
                  onChange={(v) => setNav({ isBottomOnTouchDevices: v })}
                  label="Is bottom on touch devices?"
                />
                <CheckboxRow
                  checked={s.navigation.showLabel}
                  onChange={(v) => setNav({ showLabel: v })}
                  label="Show navigation button labels"
                />
                <NavSelect
                  label="Show label at this breakpoint and higher"
                  value={s.navigation.showLabelAtWidth}
                  onChange={(v) => setNav({ showLabelAtWidth: v })}
                  options={[
                    { value: "any", label: "any" },
                    { value: "small", label: "small" },
                    { value: "medium", label: "medium" },
                    { value: "large", label: "large" },
                  ]}
                  help="When the user's browser window is at least this wide, the labels will be shown. Options refer to the standard Adapt breakpoints. The 'any' option will show the label at any size."
                />
                <NavSelect
                  label="Label position"
                  value={s.navigation.labelPosition}
                  onChange={(v) => setNav({ labelPosition: v })}
                  options={[
                    { value: "auto", label: "auto" },
                    { value: "top", label: "top" },
                    { value: "bottom", label: "bottom" },
                    { value: "left", label: "left" },
                    { value: "right", label: "right" },
                  ]}
                  help="Where to show the label in relation to the button icons."
                />
              </NavAccordion>

              {/* ── Navigation Footer (extension) ── */}
              <NavAccordion
                {...acc("navFooter")}
                title="Navigation Footer"
                subtitle="Configure the footer navigation buttons shown on each page."
              >
                <CheckboxRow checked={s.navFooter.enabled} onChange={(v) => setNavFooter({ enabled: v })} label="Enable Navigation Footer" />

                {s.navFooter.enabled && (
                  <div className="flex flex-col gap-3">
                    <NavTextInput label="Footer text" value={s.navFooter.footerText} onChange={(v) => setNavFooter({ footerText: v })} placeholder="Optional footer text" />
                    <NavTextInput label="Button notify popup text" value={s.navFooter.btnNotifyPopupText} onChange={(v) => setNavFooter({ btnNotifyPopupText: v })} placeholder="Need to complete current page" />
                    <CheckboxRow checked={s.navFooter.isLogicalBackNavigation} onChange={(v) => setNavFooter({ isLogicalBackNavigation: v })} label="Logical back navigation" />
                    <CheckboxRow checked={s.navFooter.includeSubmenuInNavigation} onChange={(v) => setNavFooter({ includeSubmenuInNavigation: v })} label="Include submenu in sequential navigation" />

                    <span className="text-xs font-semibold text-[#374151] mt-1">Footer buttons</span>
                    {FOOTER_BUTTON_META.map(({ key, label }) => {
                      const b = s.navFooter.buttons[key];
                      return (
                        <div key={key} className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 flex flex-col gap-2">
                          <CheckboxRow checked={b._isEnabled} onChange={(v) => setFooterButton(key, { _isEnabled: v })} label={`${label} button`} />
                          {b._isEnabled && (
                            <div className="ml-7 grid grid-cols-2 gap-2.5">
                              <NavTextInput label="Button text" value={b.btnText} onChange={(v) => setFooterButton(key, { btnText: v })} placeholder={label} />
                              <NavTextInput label="Classes" value={b._classes} onChange={(v) => setFooterButton(key, { _classes: v })} placeholder="e.g. btn-secondary" />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <p className="text-[11px] text-[#9ca3af] leading-snug">
                      These footer settings apply course-wide. They can be overridden per page in the page settings.
                    </p>
                  </div>
                )}
              </NavAccordion>

              {/* Tip: page-level override */}
              <div className="flex items-start gap-2.5 rounded-lg bg-[#fff7ed] border border-[#fed7aa] px-4 py-3">
                <span className="text-base leading-none mt-0.5" aria-hidden="true">💡</span>
                <p className="text-sm text-[#9a3412] leading-snug">
                  <span className="font-semibold">Tip:</span> The Navigation Footer defined here applies at the course level. You can override settings for a specific topic or page when needed.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating "Unsaved changes" bar — only while the form is dirty */}
      {!loading && dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-[var(--life-warning-100)] shadow-lg animate-fade-in-down">
          <span className="flex items-center gap-2 text-sm text-[#374151]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-warning-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
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

      {/* Success / error toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] pointer-events-none">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border pointer-events-auto animate-fade-in-down min-w-[260px] max-w-sm ${
              toast.type === "success"
                ? "bg-[var(--life-positive-050)] border-[var(--life-positive-100)] text-[var(--life-positive-500)]"
                : "bg-[var(--life-critical-050)] border-[var(--life-critical-100)] text-[var(--life-critical-500)]"
            }`}
          >
            {toast.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-positive-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-critical-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="opacity-60 hover:opacity-100 transition-opacity ml-1"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {assetPickerOpen && (
        <AssetPickerModal
          onClose={() => setAssetPickerOpen(false)}
          onSelect={({ url }) => {
            setHeaderLogo({ src: url });
            setExternalOpen(false);
            setAssetPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
