import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCourseGlobalsMerged,
  saveCourseGlobals,
  getAccessibilityConfig,
  saveAccessibilityConfig,
  type GlobalsObject,
} from "../../api/adaptAuthoring";
import { UnsavedChangesModal } from "./unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";

/* ── Accessibility Panel ──────────────────────────────────────────────────────
   Data-driven editor for the course `_globals` accessibility strings, laid out to
   match the Figma "Accessibility" design:

     Globals (accordion)
       • Basic Settings            ← _globals._accessibility
       • ARIA Labels – Components  ← _globals._components.*
       • ARIA Labels – Extensions  ← _globals._extensions.* (minus _drawer/_navigation)
       • ARIA Labels – Drawer      ← _globals._extensions._drawer
       • ARIA Labels – Navigation  ← _globals._extensions._navigation
       • ARIA Labels – Menu        ← _globals._menu.*
     Advanced Settings (accordion) ← any other top-level _globals group

   Only the presentation/grouping changes here; loading, saving and the backend
   shape (`_globals` written back whole) are unchanged. */

// Turn a stored globals key into a readable label, e.g.
//   "skipNavigationText" → "Skip Navigation Text"
//   "_laerdalPageLevelProgress" → "Laerdal Page Level Progress"
function humanizeGlobalsKey(key: string): string {
  const stripped = key.replace(/^_+/, "");
  const spaced = stripped
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// A single editable string leaf, with the full path (from the `_globals` root)
// needed to write the value back.
interface A11yLeaf {
  path: string[];
  label: string;
  value: string;
}

// Recursively collect every string leaf under `node`. Non-string values are
// skipped in the UI but preserved on save (the whole `_globals` is written back).
function collectStringLeaves(node: unknown, path: string[] = []): A11yLeaf[] {
  if (!node || typeof node !== "object") return [];
  const out: A11yLeaf[] = [];
  for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
    const nextPath = [...path, key];
    if (typeof val === "string") {
      out.push({ path: nextPath, label: humanizeGlobalsKey(key), value: val });
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      out.push(...collectStringLeaves(val, nextPath));
    }
  }
  return out;
}

// Immutably set a nested value by path, cloning only the objects along the way.
function setByPath<T extends Record<string, unknown>>(root: T, path: string[], value: string): T {
  if (path.length === 0) return root;
  const [head, ...rest] = path;
  const child = (root as Record<string, unknown>)[head];
  return {
    ...root,
    [head]:
      rest.length === 0
        ? value
        : setByPath((child && typeof child === "object" ? child : {}) as Record<string, unknown>, rest, value),
  };
}

const asObj = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

// Collect the string leaves under `node`, re-based onto the absolute `_globals`
// path so edits write straight back to the right key.
function leavesUnder(node: unknown, prefix: string[]): A11yLeaf[] {
  return collectStringLeaves(node).map((l) => ({ ...l, path: [...prefix, ...l.path] }));
}

interface A11ySubGroup {
  name: string;
  title: string;
  fields: A11yLeaf[];
}

// One editable sub-group (a plugin: component/extension/menu) per child object.
function subGroupsUnder(node: unknown, prefix: string[], exclude?: Set<string>): A11ySubGroup[] {
  const o = asObj(node);
  if (!o) return [];
  return Object.entries(o)
    .filter(([k, v]) => !(exclude?.has(k)) && asObj(v))
    .map(([k, v]) => ({ name: k, title: humanizeGlobalsKey(k), fields: leavesUnder(v, [...prefix, k]) }))
    .filter((g) => g.fields.length > 0);
}

/* ── Presentational bits ── */

function A11yLeafInput({ leaf, onChange }: { leaf: A11yLeaf; onChange: (path: string[], v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[#374151]">{leaf.label}</span>
      <input
        type="text"
        aria-label={leaf.label}
        value={leaf.value}
        onChange={(e) => onChange(leaf.path, e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
      />
    </div>
  );
}

function FieldGrid({ fields, onChange }: { fields: A11yLeaf[]; onChange: (path: string[], v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {fields.map((f) => (
        <A11yLeafInput key={f.path.join(".")} leaf={f} onChange={onChange} />
      ))}
    </div>
  );
}

// Collapsible card. `nested` tightens padding/type for inner levels so the three
// levels (Globals → area → plugin) read as a hierarchy.
function Accordion({
  title,
  subtitle,
  defaultOpen = false,
  nested = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  nested?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-xl border border-[#e5e7eb] overflow-hidden ${
        nested ? "bg-[#fbfbfc]" : "bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 text-left transition-colors hover:bg-[#f9fafb] ${
          nested ? "px-4 py-3" : "px-5 py-4"
        }`}
      >
        <div className="min-w-0">
          <h3 className={`font-bold text-[#111827] ${nested ? "text-[13px]" : "text-sm"}`}>{title}</h3>
          {subtitle && <p className="text-xs text-[#9ca3af] mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        <svg
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6b7280"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open && (
        <div className={`border-t border-[#f3f4f6] flex flex-col gap-3 ${nested ? "px-4 pb-4 pt-3" : "px-5 pb-5 pt-3"}`}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Config `_accessibility` (config document, not _globals) ── */

// Fixed field set for the ARIA heading levels, with the framework's resolved
// defaults (config schema declares these as `@ref+1` expressions the runtime
// resolves; we store the resolved integers). Order matches the Figma.
const ARIA_LEVELS: { key: string; label: string; def: number }[] = [
  { key: "_menu", label: "Menu element ARIA level", def: 1 },
  { key: "_menuGroup", label: "Menu Group element ARIA level", def: 2 },
  { key: "_menuItem", label: "Menu Item element ARIA level", def: 2 },
  { key: "_page", label: "Page element ARIA level", def: 1 },
  { key: "_article", label: "Article element ARIA level", def: 2 },
  { key: "_block", label: "Block element ARIA level", def: 3 },
  { key: "_component", label: "Component element ARIA level", def: 4 },
  { key: "_componentItem", label: "Component Item element ARIA level", def: 5 },
  { key: "_notify", label: "Notify popup title ARIA level", def: 1 },
];

// ARIA heading levels must be valid HTML heading levels: integers 1–6. Anything
// else (0, negative, decimal, blank, non-numeric) falls back to the default.
function toAriaLevel(v: unknown, def: number): number {
  const n = v === "" || v === null || v === undefined ? NaN : Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : def;
}

// Merge the stored config `_accessibility` with the ARIA-level defaults so every
// field shows a value; preserves any other flags already on the object.
function buildAccessibilityConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const ariaRaw = asObj(raw._ariaLevels) ?? {};
  const _ariaLevels: Record<string, number> = {};
  for (const { key, def } of ARIA_LEVELS) {
    _ariaLevels[key] = toAriaLevel(ariaRaw[key], def);
  }
  return {
    ...raw,
    _isEnabled: raw._isEnabled === true,
    _isSkipNavigationEnabled: raw._isSkipNavigationEnabled !== false, // schema default: true
    _ariaLevels,
  };
}

// Pretty-print the config `_options` object for the JSON editor. Empty/invalid → "{}".
function optionsToText(v: unknown): string {
  if (v === undefined || v === null || v === "") return "{}";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "{}";
  }
}

// Coerce ARIA levels to integers (fall back to default for blank/invalid) before
// persisting, so the config never stores a non-numeric heading level.
function normalizeAccessibilityConfig(acc: Record<string, unknown>): Record<string, unknown> {
  const ariaRaw = asObj(acc._ariaLevels) ?? {};
  const _ariaLevels: Record<string, number> = {};
  for (const { key, def } of ARIA_LEVELS) {
    _ariaLevels[key] = toAriaLevel(ariaRaw[key], def);
  }
  return { ...acc, _ariaLevels };
}

function A11yToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-[#d1d5db] accent-[#2d6fa8] cursor-pointer"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-[#374151]">{label}</span>
        {description && <span className="text-[13px] text-[#9ca3af] leading-snug">{description}</span>}
      </div>
    </label>
  );
}

function A11yNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input
        type="number"
        aria-label={label}
        min={1}
        max={6}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
      />
    </div>
  );
}

function A11yJsonField({
  label,
  help,
  value,
  onChange,
  invalid,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-bold text-[#111827]">{label}</span>
      {help && <span className="text-[13px] text-[#9ca3af] leading-snug mb-1">{help}</span>}
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        rows={5}
        className={`w-full px-3 py-2 text-sm font-mono rounded-lg border bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors resize-y ${
          invalid ? "border-[var(--life-critical-500)]" : "border-[#e5e7eb]"
        }`}
      />
      {invalid && <span className="text-[12px] text-[var(--life-critical-500)]">Enter valid JSON (e.g. {"{}"}).</span>}
    </div>
  );
}

export function AccessibilityPage({
  courseId,
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
}: {
  courseId?: string;
  onNavigationRequest?: (nav: string) => void;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
}) {
  const [globals, setGlobals] = useState<GlobalsObject>({});
  // Last-persisted snapshot: drives the "Unsaved changes" bar + Cancel (revert).
  const [savedSnapshot, setSavedSnapshot] = useState<GlobalsObject>({});
  // Config-document `_accessibility` (feature toggle + ARIA levels), tracked and
  // persisted separately from the course `_globals` text.
  const [cfgAcc, setCfgAcc] = useState<Record<string, unknown>>({});
  const [savedCfgAcc, setSavedCfgAcc] = useState<Record<string, unknown>>({});
  // `_options` is edited as raw JSON text (parsed only on save), so it lives in its
  // own state rather than inside cfgAcc.
  const [optionsText, setOptionsText] = useState("{}");
  const [savedOptionsText, setSavedOptionsText] = useState("{}");
  const [configId, setConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Set when the initial load fails. Saving is blocked while true so a failed load
  // can never overwrite stored settings with defaults/empty (data loss).
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!courseId) {
      console.warn("[Accessibility] No courseId — skipping DB load");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const [loaded, cfg] = await Promise.all([
          getCourseGlobalsMerged(courseId),
          getAccessibilityConfig(courseId),
        ]);
        if (cancelled) return;
        setGlobals(loaded);
        setSavedSnapshot(loaded);
        const acc = buildAccessibilityConfig(cfg.accessibility);
        setCfgAcc(acc);
        setSavedCfgAcc(acc);
        const optText = optionsToText(acc._options);
        setOptionsText(optText);
        setSavedOptionsText(optText);
        setConfigId(cfg.configId);
      } catch (err) {
        console.error("Failed to load accessibility settings", err);
        // Don't leave partial/empty state that a later save could persist.
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // A leaf's `path` is the absolute `_globals` path; write it back immutably so
  // unrelated branches (and non-string values) survive.
  const updateLeaf = useCallback((path: string[], value: string) => {
    setGlobals((prev) => setByPath(prev, path, value));
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setCfgAcc((prev) => ({ ...prev, _isEnabled: v }));
  }, []);
  const setSkipNav = useCallback((v: boolean) => {
    setCfgAcc((prev) => ({ ...prev, _isSkipNavigationEnabled: v }));
  }, []);
  const setAriaLevel = useCallback((key: string, raw: string) => {
    setCfgAcc((prev) => ({
      ...prev,
      _ariaLevels: { ...(asObj(prev._ariaLevels) ?? {}), [key]: raw === "" ? "" : Number(raw) },
    }));
  }, []);

  // Live JSON validity for the Extended Options editor (blank counts as valid → {}).
  const optionsInvalid = useMemo(() => {
    if (optionsText.trim() === "") return false;
    try {
      JSON.parse(optionsText);
      return false;
    } catch {
      return true;
    }
  }, [optionsText]);

  const globalsDirty = JSON.stringify(globals) !== JSON.stringify(savedSnapshot);
  const cfgDirty =
    JSON.stringify(cfgAcc) !== JSON.stringify(savedCfgAcc) || optionsText !== savedOptionsText;
  const dirty = globalsDirty || cfgDirty;

  // Auto-dismiss the toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } =
    useUnsavedChangesNavigationGuard({
      hasChanges: dirty,
      pendingNavigation,
      onPendingNavigationHandled,
      onNavigate: onNavigationRequest,
    });

  async function persist(): Promise<boolean> {
    if (!courseId || saving) return false;

    // Never save on top of a failed load — the in-memory state isn't the real
    // stored data, so writing it back could clobber existing settings.
    if (loadError) {
      setToast({ type: "error", message: "Settings didn't load. Reload the page before saving." });
      return false;
    }

    // Config changes exist but the config record never loaded (configId is null):
    // saving would silently drop them, so block and tell the user.
    if (cfgDirty && !configId) {
      setToast({ type: "error", message: "Accessibility configuration didn't load. Reload before saving." });
      return false;
    }

    // Validate/parse the Extended Options JSON before hitting the backend.
    let parsedOptions: unknown = {};
    if (cfgDirty) {
      try {
        parsedOptions = optionsText.trim() === "" ? {} : JSON.parse(optionsText);
      } catch {
        setToast({ type: "error", message: "Accessibility Extended Options must be valid JSON." });
        return false;
      }
    }

    setSaving(true);
    setToast(null);
    try {
      const jobs: Promise<unknown>[] = [];
      let normalizedCfg: Record<string, unknown> | null = null;
      if (globalsDirty) jobs.push(saveCourseGlobals(courseId, globals));
      if (cfgDirty && configId) {
        normalizedCfg = { ...normalizeAccessibilityConfig(cfgAcc), _options: parsedOptions };
        jobs.push(saveAccessibilityConfig(configId, courseId, normalizedCfg));
      }
      await Promise.all(jobs);
      if (globalsDirty) setSavedSnapshot(globals);
      if (normalizedCfg) {
        setCfgAcc(normalizedCfg);
        setSavedCfgAcc(normalizedCfg);
        const optText = optionsToText(normalizedCfg._options);
        setOptionsText(optText);
        setSavedOptionsText(optText);
      }
      setToast({ type: "success", message: "Changes saved successfully" });
      return true;
    } catch (err) {
      console.error("Failed to save accessibility settings", err);
      setToast({ type: "error", message: "Couldn't save. Please try again." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await persist();
  }

  function handleCancel() {
    setGlobals(savedSnapshot);
    setCfgAcc(savedCfgAcc);
    setOptionsText(savedOptionsText);
  }

  async function handleConfirmSave() {
    const ok = await persist();
    if (!ok) return;
    const navTarget = consumePendingNavigation();
    if (navTarget) onNavigationRequest?.(navTarget);
  }

  function handleConfirmDiscard() {
    setGlobals(savedSnapshot);
    setCfgAcc(savedCfgAcc);
    setOptionsText(savedOptionsText);
    const navTarget = consumePendingNavigation();
    if (navTarget) onNavigationRequest?.(navTarget);
  }

  // Group the flat `_globals` tree into the Figma sections. Purely a view model —
  // every field keeps its absolute path so saving is byte-for-byte unchanged.
  const model = useMemo(() => {
    const exts = asObj(globals._extensions);
    const basic = leavesUnder(globals._accessibility, ["_accessibility"]);
    const components = subGroupsUnder(globals._components, ["_components"]);
    const extensions = subGroupsUnder(globals._extensions, ["_extensions"], new Set(["_drawer", "_navigation"]));
    const drawer = leavesUnder(exts?._drawer, ["_extensions", "_drawer"]);
    const navigation = leavesUnder(exts?._navigation, ["_extensions", "_navigation"]);
    const menu = subGroupsUnder(globals._menu, ["_menu"]);
    const known = new Set(["_accessibility", "_components", "_extensions", "_menu"]);
    const advanced = Object.keys(globals)
      .filter((k) => !known.has(k))
      .map((k) => ({ name: k, title: humanizeGlobalsKey(k), fields: leavesUnder(globals[k], [k]) }))
      .filter((g) => g.fields.length > 0);
    const globalsCount =
      basic.length +
      components.length +
      extensions.length +
      drawer.length +
      navigation.length +
      menu.length;
    return { basic, components, extensions, drawer, navigation, menu, advanced, globalsCount };
  }, [globals]);

  // Basic Settings always renders the config controls, so the panel has content
  // whenever a config document was loaded.
  const hasAnything = model.globalsCount > 0 || model.advanced.length > 0 || !!configId;

  const renderSubGroups = (groups: A11ySubGroup[]) => (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <Accordion key={g.name} nested title={g.title}>
          <FieldGrid fields={g.fields} onChange={updateLeaf} />
        </Accordion>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl w-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#111827]">Accessibility</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">
          Configure basic accessibility settings, ARIA labels grouped by area, and advanced options.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#6b7280]">
          <svg className="animate-spin mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          Loading settings…
        </div>
      ) : !courseId ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          No course is associated with this setup flow, so accessibility settings cannot be loaded.
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          Couldn't load the accessibility settings. Reload the page to try again — saving is disabled until they load
          successfully to avoid overwriting your existing settings.
        </div>
      ) : !hasAnything ? (
        <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-sm text-[#6b7280]">
          No accessibility strings are defined for this course yet. They appear here once the course and its plugins are set up.
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-24">
          {/* ── Globals ── */}
          <Accordion title="Globals" defaultOpen>
            <div className="flex flex-col gap-3">
              <Accordion nested title="Basic Settings" defaultOpen>
                <A11yToggle
                  label="Enabled?"
                  description="Turn on accessibility features across the course."
                  checked={cfgAcc._isEnabled === true}
                  onChange={setEnabled}
                />
                <div>
                  <p className="text-sm font-bold text-[#111827] mt-1">ARIA Levels</p>
                  <p className="text-[13px] text-[#9ca3af] mb-2 leading-snug">
                    Set the heading level applied to each structural element.
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {ARIA_LEVELS.map((a) => {
                      const raw = (asObj(cfgAcc._ariaLevels) ?? {})[a.key];
                      return (
                        <A11yNumberField
                          key={a.key}
                          label={a.label}
                          value={raw === undefined || raw === null ? "" : String(raw)}
                          onChange={(v) => setAriaLevel(a.key, v)}
                        />
                      );
                    })}
                  </div>
                </div>
              </Accordion>
              {model.basic.length > 0 && (
                <Accordion nested title="ARIA Labels – Globals">
                  <FieldGrid fields={model.basic} onChange={updateLeaf} />
                </Accordion>
              )}
              {model.components.length > 0 && (
                <Accordion nested title="ARIA Labels – Components">{renderSubGroups(model.components)}</Accordion>
              )}
              {model.extensions.length > 0 && (
                <Accordion nested title="ARIA Labels – Extensions">{renderSubGroups(model.extensions)}</Accordion>
              )}
              {model.drawer.length > 0 && (
                <Accordion nested title="ARIA Labels – Drawer">
                  <FieldGrid fields={model.drawer} onChange={updateLeaf} />
                </Accordion>
              )}
              {model.navigation.length > 0 && (
                <Accordion nested title="ARIA Labels – Navigation">
                  <FieldGrid fields={model.navigation} onChange={updateLeaf} />
                </Accordion>
              )}
              {model.menu.length > 0 && (
                <Accordion nested title="ARIA Labels – Menu">{renderSubGroups(model.menu)}</Accordion>
              )}
            </div>
          </Accordion>

          {/* ── Advanced ── */}
          <Accordion title="Advanced Settings">
            <A11yToggle
              label="Enable Skip Navigation link?"
              description="Adds a skip link so keyboard users can jump straight to the main content."
              checked={cfgAcc._isSkipNavigationEnabled === true}
              onChange={setSkipNav}
            />
            <A11yJsonField
              label="Accessibility Extended Options"
              help="Advanced JSON configuration for framework-specific overrides."
              value={optionsText}
              onChange={setOptionsText}
              invalid={optionsInvalid}
            />
            {model.advanced.length > 0 && renderSubGroups(model.advanced)}
          </Accordion>

          {/* Tip — matches the shared callout style (Navigation, Course Structure) */}
          <div className="flex items-start gap-2.5 rounded-lg bg-[#fff7ed] border border-[#fed7aa] px-4 py-3">
            <span className="text-base leading-none mt-0.5" aria-hidden="true">💡</span>
            <p className="text-sm text-[#9a3412] leading-snug">
              <span className="font-semibold">Tip:</span> These labels are read by screen readers. Keep them concise and match the language configured in Course Overview.
            </p>
          </div>
        </div>
      )}

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
          </div>
        </div>
      )}

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
