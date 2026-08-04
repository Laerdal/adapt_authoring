import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyMenuSelectionToCourse,
  createCourseAssetMapping,
  getCourseBootstrapData,
  getCourseAssetMappings,
  getCourseMenuSettings,
  removeCourseAssetMappings,
  type CourseMenuSettings,
  updateCourseMenuSettings,
} from "../../api/adaptAuthoring";
import AssetPickerModal from "../../components/common/AssetPickerModal";
import { UnsavedChangesModal } from "./unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";

type MenuStyle = "life" | "overview" | "box";
type Align = "left" | "center" | "right";
type HeaderPosition = "above" | "below";
type BgRepeat = "no-repeat" | "repeat" | "repeat-x" | "repeat-y";
type BgSize = "cover" | "contain" | "auto" | "100% 100%";
type BgPosition =
  | "left top"
  | "left center"
  | "left bottom"
  | "center top"
  | "center center"
  | "center bottom"
  | "right top"
  | "right center"
  | "right bottom";

type BreakpointKey = "xlarge" | "large" | "medium" | "small";

type MenuPageConfig = {
  menuStyle: MenuStyle | null;
  skipSubmenu: boolean;
  lockedText: string;
  logoAltText: string;
  logoSrc: string;
  titleAlign: Align;
  subtitleAlign: Align;
  bodyAlign: Align;
  instructionAlign: Align;
  headerPosition: HeaderPosition;
  headerImageSrc: Record<BreakpointKey, string>;
  headerMinHeight: Record<BreakpointKey, string>;
  headerRepeat: BgRepeat;
  headerSize: BgSize;
  headerBgPosition: BgPosition;
  bgImageSrc: Record<BreakpointKey, string>;
  bgRepeat: BgRepeat;
  bgSize: BgSize;
  bgPosition: BgPosition;
};

type MenuSettingsKey = "_lifeMenu" | "_overviewMenu" | "_boxMenu";

const DEFAULT_LOCKED_NAV_TEXT = "This module is not accessible. Choose one of the active modules.";

const DEFAULT_CONFIG: MenuPageConfig = {
  menuStyle: null,
  skipSubmenu: false,
  lockedText: DEFAULT_LOCKED_NAV_TEXT,
  logoAltText: "",
  logoSrc: "",
  titleAlign: "left",
  subtitleAlign: "left",
  bodyAlign: "left",
  instructionAlign: "left",
  headerPosition: "above",
  headerImageSrc: {
    xlarge: "",
    large: "",
    medium: "",
    small: "",
  },
  headerMinHeight: {
    xlarge: "",
    large: "",
    medium: "",
    small: "",
  },
  headerRepeat: "no-repeat",
  headerSize: "cover",
  headerBgPosition: "center center",
  bgImageSrc: {
    xlarge: "",
    large: "",
    medium: "",
    small: "",
  },
  bgRepeat: "no-repeat",
  bgSize: "cover",
  bgPosition: "center center",
};

const BG_REPEAT_OPTIONS: BgRepeat[] = ["no-repeat", "repeat", "repeat-x", "repeat-y"];
const BG_SIZE_OPTIONS: BgSize[] = ["cover", "contain", "auto", "100% 100%"];
const BG_POSITION_OPTIONS: BgPosition[] = [
  "left top",
  "left center",
  "left bottom",
  "center top",
  "center center",
  "center bottom",
  "right top",
  "right center",
  "right bottom",
];

const ALIGN_VALUES: Align[] = ["left", "center", "right"];

function isAlign(value: string | undefined): value is Align {
  return !!value && ALIGN_VALUES.includes(value as Align);
}

function coerceAlign(value: string | undefined, fallback: Align): Align {
  return isAlign(value) ? value : fallback;
}

function coerceOption<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  if (!value) return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function parseHeightToNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function mapMenuStyleToLabel(style: MenuStyle | null): string {
  if (style === "life") return "LIFE Menu";
  if (style === "overview") return "Overview Menu";
  if (style === "box") return "Box Menu";
  return "";
}

function getMenuSettingsKey(style: MenuStyle | null): MenuSettingsKey {
  if (style === "life") return "_lifeMenu";
  if (style === "overview") return "_overviewMenu";
  return "_boxMenu";
}

function getMenuSettingsEntryForStyle(settings: CourseMenuSettings, style: MenuStyle | null): NonNullable<CourseMenuSettings["_boxMenu"]> | undefined {
  const byStyleKey = settings[getMenuSettingsKey(style)] as NonNullable<CourseMenuSettings["_boxMenu"]> | undefined;
  return byStyleKey || settings._boxMenu;
}

function toRenderableAssetUrl(source: string | undefined): string | null {
  const src = (source || "").trim();
  if (!src) return null;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("/")) return src;
  if (src.startsWith("course/assets/")) return `/${src}`;
  if (/^[a-f0-9]{24}$/i.test(src)) return `/api/asset/serve/${src}`;
  return src;
}

function isExternalAsset(value: string): boolean {
  return /^(https?:)?\/\//i.test((value || "").trim());
}

function toCourseAssetFieldName(value: string): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed || isExternalAsset(trimmed)) return null;
  const normalized = trimmed.replace(/^\/+/, "");
  if (!normalized.startsWith("course/assets/")) return null;
  const fieldName = normalized.replace(/^course\/assets\//, "");
  return fieldName || null;
}

type AssetTarget =
  | { scope: "logo" }
  | { scope: "headerImage"; bp: BreakpointKey }
  | { scope: "backgroundImage"; bp: BreakpointKey };

function mergeConfigFromCourseMenuSettings(base: MenuPageConfig, settings: CourseMenuSettings): MenuPageConfig {
  const box = getMenuSettingsEntryForStyle(settings, base.menuStyle);
  const header = box?._menuHeader;
  const textAlign = header?._textAlignment;
  const headerStyles = header?._backgroundStyles;
  const bgStyles = box?._backgroundStyles;
  const minHeights = header?._minimumHeights;
  const readSubtitleAlign = base.menuStyle === "box";
  const hasSubmenuControls = base.menuStyle === "life" || base.menuStyle === "overview";
  const hasDisplayAboveHeaderSetting = hasSubmenuControls && typeof header?._displayAboveHeader === "boolean";

  return {
    ...base,
    skipSubmenu: hasSubmenuControls ? !!box?._skipSubmenuView : base.skipSubmenu,
    lockedText: hasSubmenuControls ? (box?.lockedNotification || base.lockedText) : base.lockedText,
    headerPosition: hasDisplayAboveHeaderSetting
      ? (header?._displayAboveHeader ? "above" : "below")
      : base.headerPosition,
    logoAltText: box?._graphic?.alt || "",
    logoSrc: box?._graphic?._src || "",
    titleAlign: coerceAlign(textAlign?._title, base.titleAlign),
    subtitleAlign: readSubtitleAlign ? coerceAlign(textAlign?._subtitle, base.subtitleAlign) : base.subtitleAlign,
    instructionAlign: coerceAlign(textAlign?._instruction, base.instructionAlign),
    bodyAlign: coerceAlign(textAlign?._body, base.bodyAlign),
    headerImageSrc: {
      xlarge: header?._backgroundImage?._xlarge || "",
      large: header?._backgroundImage?._large || "",
      medium: header?._backgroundImage?._medium || "",
      small: header?._backgroundImage?._small || "",
    },
    bgRepeat: coerceOption(bgStyles?._backgroundRepeat, BG_REPEAT_OPTIONS, base.bgRepeat),
    bgSize: coerceOption(bgStyles?._backgroundSize, BG_SIZE_OPTIONS, base.bgSize),
    bgPosition: coerceOption(bgStyles?._backgroundPosition, BG_POSITION_OPTIONS, base.bgPosition),
    bgImageSrc: {
      xlarge: box?._backgroundImage?._xlarge || "",
      large: box?._backgroundImage?._large || "",
      medium: box?._backgroundImage?._medium || "",
      small: box?._backgroundImage?._small || "",
    },
    headerRepeat: coerceOption(headerStyles?._backgroundRepeat, BG_REPEAT_OPTIONS, base.headerRepeat),
    headerSize: coerceOption(headerStyles?._backgroundSize, BG_SIZE_OPTIONS, base.headerSize),
    headerBgPosition: coerceOption(headerStyles?._backgroundPosition, BG_POSITION_OPTIONS, base.headerBgPosition),
    headerMinHeight: {
      xlarge: minHeights?._xlarge == null ? "" : String(minHeights._xlarge),
      large: minHeights?._large == null ? "" : String(minHeights._large),
      medium: minHeights?._medium == null ? "" : String(minHeights._medium),
      small: minHeights?._small == null ? "" : String(minHeights._small),
    },
  };
}

function buildCourseMenuSettingsPayload(config: MenuPageConfig, currentSettings: CourseMenuSettings): CourseMenuSettings {
  const textAlignment: {
    _title: Align;
    _body: Align;
    _instruction: Align;
    _subtitle?: Align;
  } = {
    _title: config.titleAlign,
    _body: config.bodyAlign,
    _instruction: config.instructionAlign,
  };

  // Subtitle alignment is currently persisted for Box menu only.
  if (config.menuStyle === "box") {
    textAlignment._subtitle = config.subtitleAlign;
  }

  const nextEntry: NonNullable<CourseMenuSettings["_boxMenu"]> = {
      _graphic: {
        _src: config.logoSrc || "",
        alt: config.logoAltText || "",
      },
      _backgroundImage: {
        _xlarge: config.bgImageSrc.xlarge || "",
        _large: config.bgImageSrc.large || "",
        _medium: config.bgImageSrc.medium || "",
        _small: config.bgImageSrc.small || "",
      },
      _backgroundStyles: {
        _backgroundRepeat: config.bgRepeat,
        _backgroundSize: config.bgSize,
        _backgroundPosition: config.bgPosition,
      },
      _menuHeader: {
        _textAlignment: textAlignment,
        _backgroundImage: {
          _xlarge: config.headerImageSrc.xlarge || "",
          _large: config.headerImageSrc.large || "",
          _medium: config.headerImageSrc.medium || "",
          _small: config.headerImageSrc.small || "",
        },
        _backgroundStyles: {
          _backgroundRepeat: config.headerRepeat,
          _backgroundSize: config.headerSize,
          _backgroundPosition: config.headerBgPosition,
        },
        _minimumHeights: {
          _xlarge: parseHeightToNumber(config.headerMinHeight.xlarge),
          _large: parseHeightToNumber(config.headerMinHeight.large),
          _medium: parseHeightToNumber(config.headerMinHeight.medium),
          _small: parseHeightToNumber(config.headerMinHeight.small),
        },
      },
    };

  // `_skipSubmenuView` and `lockedNotification` are supported in LIFE/Overview only.
  if (config.menuStyle === "life" || config.menuStyle === "overview") {
    nextEntry._skipSubmenuView = !!config.skipSubmenu;
    nextEntry.lockedNotification = (config.lockedText || "").trim() || DEFAULT_LOCKED_NAV_TEXT;
    if (nextEntry._menuHeader) {
      nextEntry._menuHeader._displayAboveHeader = config.headerPosition === "above";
    }
  }

  const key = getMenuSettingsKey(config.menuStyle);
  return {
    ...currentSettings,
    [key]: nextEntry,
  };
}

function mapMenuNameToStyle(menuName?: string): MenuStyle | null {
  const n = (menuName || "").toLowerCase();
  if (n.includes("life")) return "life";
  if (n.includes("overview")) return "overview";
  if (n.includes("box")) return "box";
  return null;
}

function SectionHeader({ label, required }: { label: string; required?: boolean }) {
  return (
    <div className="text-[13px] font-bold text-[var(--life-base-black)] mb-3">
      {label}
      {required ? <span className="text-[var(--life-critical-500)] ml-0.5">*</span> : null}
    </div>
  );
}

function MenuDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const syncRect = useCallback(() => {
    if (!btnRef.current) return;
    setRect(btnRef.current.getBoundingClientRect());
  }, []);

  const handleOpen = () => {
    if (!open) syncRect();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    syncRect();
    window.addEventListener("resize", syncRect);
    window.addEventListener("scroll", syncRect, true);
    return () => {
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("scroll", syncRect, true);
    };
  }, [open, syncRect]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-[#374151]">{label}</label>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={handleOpen}
          className="w-full flex items-center justify-between px-3 py-2 border border-[#d1d5db] rounded-[8px] bg-white text-sm text-[#374151] hover:border-[#9ca3af] transition-colors cursor-pointer"
          style={{ borderRadius: 8 }}
        >
          <span>{value}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {open && rect && createPortal(
          <div
            ref={listRef}
            style={(() => {
              const VIEWPORT_GAP = 8;
              const DROPDOWN_GAP = 0;
              const MAX_HEIGHT = 256;
              const MIN_HEIGHT = 120;

              const viewportHeight = window.innerHeight;
              const viewportWidth = window.innerWidth;

              const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_GAP;
              const spaceAbove = rect.top - VIEWPORT_GAP;
              const openUpward = spaceBelow < MIN_HEIGHT && spaceAbove > spaceBelow;

              const maxHeight = Math.max(
                MIN_HEIGHT,
                Math.min(MAX_HEIGHT, openUpward ? spaceAbove - DROPDOWN_GAP : spaceBelow - DROPDOWN_GAP)
              );

              const top = openUpward
                ? Math.max(VIEWPORT_GAP, rect.top - maxHeight + 1)
                : rect.bottom - 1;

              const left = Math.max(
                VIEWPORT_GAP,
                Math.min(rect.left, viewportWidth - rect.width - VIEWPORT_GAP)
              );

              return {
                position: "fixed" as const,
                top,
                left,
                width: rect.width,
                maxHeight,
                zIndex: 9999,
              };
            })()}
            className="bg-white border border-[#e5e7eb] rounded-[8px] shadow-lg py-1 overflow-hidden overflow-y-auto"
            data-radius="8px"
          >
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors cursor-pointer ${
                  value === opt ? "bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"
                }`}
              >
                {opt}
                {value === opt ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : null}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

function MenuCheckbox({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer select-none group">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-[#d1d5db] accent-[#2d6fa8] cursor-pointer"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-[#374151]">{label}</span>
        {description ? <span className="text-[13px] text-[var(--life-neutral-300)]">{description}</span> : null}
      </div>
    </label>
  );
}

function ExternalAssetModal({
  open,
  title,
  initialValue,
  onCancel,
  onSave,
}: {
  open: boolean;
  title: string;
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-lg bg-white rounded-xl border border-[var(--life-neutral-200)] shadow-xl overflow-hidden">
        <div className="px-5 py-4 bg-[var(--life-neutral-020)] border-b border-[var(--life-neutral-200)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-transparent bg-white text-[#9ca3af] transition-colors cursor-pointer hover:bg-[var(--life-critical-050)] hover:text-[var(--life-critical-600)] hover:border-[var(--life-critical-050)]"
            aria-label="Close external asset dialog"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="text-sm font-semibold text-[#374151]">External asset URL</label>
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://example.com/image.png"
            className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"
          />
          <p className="text-[13px] text-[var(--life-neutral-300)]">Paste an absolute URL to use an externally hosted image.</p>
        </div>
        <div className="px-5 py-4 border-t border-[var(--life-neutral-200)] flex items-center justify-end gap-2.5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors cursor-pointer">Cancel</button>
          <button type="button" onClick={() => onSave(value.trim())} className="px-4 py-2 text-sm font-medium text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors cursor-pointer">Save External Asset</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MenuAccordion({
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
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--life-neutral-200)] rounded-lg overflow-hidden shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)] mb-2.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left cursor-pointer bg-[var(--life-neutral-020)] border-b border-[var(--life-neutral-200)] hover:bg-[var(--life-neutral-050)] transition-colors"
      >
        <div>
          <div className="text-sm font-bold text-[var(--life-base-black)]">{title}</div>
          {subtitle ? <div className="text-[13px] text-[var(--life-neutral-300)] mt-[4px] leading-[1.45]">{subtitle}</div> : null}
        </div>
        <span className={`mt-0.5 text-[var(--life-neutral-500)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </span>
      </button>
      {open ? <div className="px-[22px] py-[20px] bg-white flex flex-col gap-4">{children}</div> : null}
    </div>
  );
}

function AlignButtons({ value, onChange }: { value: Align; onChange: (v: Align) => void }) {
  return (
    <div className="grid grid-cols-3 border border-[var(--life-neutral-200)] rounded-lg overflow-hidden">
      {(["left", "center", "right"] as Align[]).map((v, i) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`h-9 flex items-center justify-center cursor-pointer transition-colors ${value === v ? "bg-[var(--life-primary-500)] text-white" : "bg-white text-[var(--life-neutral-500)] hover:bg-[var(--life-neutral-050)]"} ${i > 0 ? "border-l border-[var(--life-neutral-200)]" : ""}`}
        >
          {v === "left" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6" /><line x1="15" y1="12" x2="3" y2="12" /><line x1="21" y1="18" x2="3" y2="18" /></svg>
          ) : null}
          {v === "center" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6" /><line x1="18" y1="12" x2="6" y2="12" /><line x1="21" y1="18" x2="3" y2="18" /></svg>
          ) : null}
          {v === "right" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="12" x2="9" y2="12" /><line x1="21" y1="18" x2="3" y2="18" /></svg>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function AssetPickerCard({
  label,
  value,
  resolveUrl,
  onPickAsset,
  onPickExternal,
  onClear,
  showLabel = true,
}: {
  label: string;
  value: string;
  resolveUrl?: (value: string) => string | null;
  onPickAsset: () => void;
  onPickExternal: () => void;
  onClear: () => void;
  showLabel?: boolean;
}) {
  const previewUrl = resolveUrl ? resolveUrl(value) : toRenderableAssetUrl(value);

  return (
    <div className="border border-[var(--life-neutral-200)] rounded-lg p-3 flex flex-col gap-2.5">
      {showLabel ? <div className="text-[13px] text-[var(--life-base-black)]">{label}</div> : null}
      {previewUrl ? (
        <div className="border border-[var(--life-neutral-200)] rounded-md overflow-hidden bg-[var(--life-neutral-020)]">
          <div className="h-24 w-full flex items-center justify-center overflow-hidden bg-[var(--life-neutral-020)]">
            <img src={previewUrl} alt={label} className="w-full h-full object-contain" />
          </div>
          <div className="px-2.5 py-2 border-t border-[var(--life-neutral-200)] text-[11px] text-[var(--life-neutral-500)] truncate">{value}</div>
        </div>
      ) : null}
      {value ? (
        <div className="flex items-center justify-end gap-2.5">
          <button type="button" onClick={onPickAsset} className="px-3 py-2 text-sm font-semibold rounded-md border border-[var(--life-primary-500)] text-[var(--life-primary-500)] bg-white hover:bg-[var(--life-primary-020)] transition-colors cursor-pointer">
            Change
          </button>
          <button type="button" onClick={onClear} className="px-3 py-2 text-sm font-semibold rounded-md border border-[var(--life-critical-500)] text-[var(--life-critical-500)] bg-white hover:bg-[var(--life-critical-050)] transition-colors cursor-pointer">
            Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2.5 flex-wrap">
          <button type="button" onClick={onPickAsset} className="px-3 py-2 text-sm font-semibold rounded-md bg-[var(--life-primary-500)] text-white hover:bg-[var(--life-primary-700)] transition-colors cursor-pointer flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l2 3h6a2 2 0 0 1 2 2z" /></svg>
            Select an Asset
          </button>
          <button type="button" onClick={onPickExternal} className="px-3 py-2 text-sm font-semibold rounded-md border border-[var(--life-primary-500)] text-[var(--life-primary-500)] hover:bg-[var(--life-primary-020)] transition-colors cursor-pointer flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L11.65 5" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L12.35 19" /></svg>
            Select an External Asset
          </button>
        </div>
      )}
    </div>
  );
}

function StyleThumb({ style }: { style: MenuStyle }) {
  if (style === "life") {
    return (
      <svg viewBox="0 0 160 96" className="w-full h-full block" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="96" fill="var(--life-neutral-020)" />
        <rect x="0" y="0" width="50" height="96" fill="var(--life-primary-800)" />
        <rect x="5" y="8" width="30" height="4" rx="2" fill="rgba(255,255,255,0.45)" />
        <rect x="5" y="14" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.25)" />
        <rect x="5" y="27" width="40" height="14" rx="3" fill="var(--life-primary-500)" />
        <circle cx="12" cy="34" r="3" fill="var(--life-primary-300)" />
        <rect x="18" y="31" width="23" height="5" rx="2.5" fill="rgba(255,255,255,0.85)" />
        <rect x="14" y="47" width="27" height="5" rx="2.5" fill="rgba(255,255,255,0.3)" />
        <rect x="14" y="61" width="27" height="5" rx="2.5" fill="rgba(255,255,255,0.3)" />
        <rect x="14" y="75" width="27" height="5" rx="2.5" fill="rgba(255,255,255,0.3)" />

        <rect x="54" y="8" width="98" height="7" rx="3" fill="var(--life-neutral-100)" />
        <rect x="54" y="20" width="80" height="4" rx="2" fill="var(--life-neutral-050)" />
        <rect x="54" y="27" width="90" height="4" rx="2" fill="var(--life-neutral-050)" />
        <rect x="54" y="34" width="65" height="4" rx="2" fill="var(--life-neutral-050)" />
        <rect x="54" y="44" width="98" height="42" rx="6" fill="var(--life-base-white)" stroke="var(--life-primary-100)" strokeWidth="1" />
        <rect x="60" y="50" width="42" height="4" rx="2" fill="var(--life-primary-400)" />
        <rect x="60" y="57" width="62" height="3" rx="1.5" fill="var(--life-neutral-200)" />
        <rect x="60" y="63" width="54" height="3" rx="1.5" fill="var(--life-neutral-200)" />
        <rect x="60" y="69" width="44" height="3" rx="1.5" fill="var(--life-neutral-200)" />
      </svg>
    );
  }

  if (style === "overview") {
    return (
      <svg viewBox="0 0 160 96" className="w-full h-full block" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="96" fill="var(--life-neutral-020)" />
        <rect x="8" y="8" width="144" height="80" rx="6" fill="var(--life-base-white)" stroke="var(--life-neutral-100)" strokeWidth="1" />
        <rect x="16" y="16" width="48" height="5" rx="2.5" fill="var(--life-primary-500)" opacity="0.8" />
        <rect x="16" y="24" width="68" height="3.5" rx="1.75" fill="var(--life-neutral-200)" />

        <circle cx="22" cy="40" r="5" fill="var(--life-primary-500)" />
        <path d="M19 40.5l2 2 4-5" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="32" y="36" width="62" height="4" rx="2" fill="var(--life-neutral-600)" opacity="0.8" />
        <rect x="32" y="43" width="80" height="3" rx="1.5" fill="var(--life-neutral-100)" />
        <rect x="32" y="43" width="58" height="3" rx="1.5" fill="var(--life-primary-500)" opacity="0.65" />
        <rect x="116" y="39" width="14" height="3" rx="1.5" fill="var(--life-neutral-500)" opacity="0.7" />

        <circle cx="22" cy="57" r="5" fill="var(--life-neutral-050)" />
        <rect x="32" y="53" width="62" height="4" rx="2" fill="var(--life-neutral-600)" opacity="0.8" />
        <rect x="32" y="60" width="80" height="3" rx="1.5" fill="var(--life-neutral-100)" />
        <rect x="32" y="60" width="40" height="3" rx="1.5" fill="var(--life-primary-500)" opacity="0.65" />
        <rect x="116" y="56" width="14" height="3" rx="1.5" fill="var(--life-neutral-500)" opacity="0.7" />

        <circle cx="22" cy="74" r="5" fill="var(--life-neutral-050)" />
        <rect x="32" y="70" width="62" height="4" rx="2" fill="var(--life-neutral-600)" opacity="0.8" />
        <rect x="32" y="77" width="80" height="3" rx="1.5" fill="var(--life-neutral-100)" />
        <rect x="32" y="77" width="14" height="3" rx="1.5" fill="var(--life-primary-500)" opacity="0.65" />
        <rect x="116" y="73" width="14" height="3" rx="1.5" fill="var(--life-neutral-500)" opacity="0.7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 160 96" className="w-full h-full block" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="96" fill="var(--life-neutral-050)" />
      {[
        [8, 14, "var(--life-primary-500)"],
        [60, 14, "var(--life-accent1-500)"],
        [112, 14, "var(--life-accent2-500)"],
        [8, 56, "var(--life-warning-400)"],
        [60, 56, "var(--life-positive-400)"],
        [112, 56, "var(--life-critical-500)"],
      ].map(([x, y, c]) => (
        <g key={`${x}-${y}`}>
          <rect x={x as number} y={y as number} width="44" height="36" rx="5" fill={c as string} />
          <rect x={(x as number) + 4} y={(y as number) + 25} width="32" height="4" rx="2" fill="rgba(255,255,255,0.7)" />
        </g>
      ))}
    </svg>
  );
}

function StyleCard({
  id,
  selected,
  onSelect,
  label,
  description,
}: {
  id: MenuStyle;
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: string;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`flex-1 rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${selected ? "border-[var(--life-primary-500)] bg-[var(--life-primary-050)] shadow-[0_0_0_3px_var(--life-primary-100)]" : "border-[var(--life-neutral-200)] bg-white hover:border-[var(--life-neutral-400)]"}`}
    >
      <div className="h-[120px] border-b border-[var(--life-neutral-100)] relative">
        <StyleThumb style={id} />
        {selected ? (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--life-primary-500)] flex items-center justify-center shadow-sm">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
        ) : null}
      </div>
      <div className="p-3.5">
        <div className="text-[13px] font-bold text-[var(--life-base-black)] leading-[1.2] mb-2">{label}</div>
        <div className="text-[13px] text-[var(--life-neutral-300)] leading-[1.5]">{description}</div>
      </div>
    </div>
  );
}

function MenuPreview({ cfg, resolveUrl }: { cfg: MenuPageConfig; resolveUrl?: (value: string) => string | null }) {
  const previewCopy = useMemo(() => {
    if (cfg.menuStyle === "box") {
      return {
        title: "Box Menu",
        subtitle: "A core bundled menu",
      };
    }

    if (cfg.menuStyle === "overview") {
      return {
        title: "Overview Menu",
        subtitle: "A menu developed by Laerdal.",
        subtitle2: "Derived from core version v7.5.0.",
      };
    }

    return {
      title: "Life Menu",
      subtitle: "A menu developed by Laerdal.",
      subtitle2: "Derived from core version v7.5.0.",
    };
  }, [cfg.menuStyle]);

  const previewLabel = useMemo(() => {
    if (cfg.menuStyle === "life") return "LIFE Menu";
    if (cfg.menuStyle === "overview") return "Overview Menu";
    if (cfg.menuStyle === "box") return "Box Menu";
    return "";
  }, [cfg.menuStyle]);

  const titleAlignClass = cfg.titleAlign === "center" ? "text-center items-center" : cfg.titleAlign === "right" ? "text-right items-end" : "text-left items-start";
  const subtitleAlignClass = cfg.subtitleAlign === "center" ? "text-center items-center" : cfg.subtitleAlign === "right" ? "text-right items-end" : "text-left items-start";
  const logoAlignClass = "items-center";
  const headerHeight = Math.max(14, Math.min(56, Math.floor((Number(cfg.headerMinHeight.xlarge || "32") || 32) / 3)));
  const headerPreviewImage = resolveUrl ? resolveUrl(cfg.headerImageSrc.xlarge) : toRenderableAssetUrl(cfg.headerImageSrc.xlarge);
  const backgroundPreviewImage = resolveUrl ? resolveUrl(cfg.bgImageSrc.xlarge) : toRenderableAssetUrl(cfg.bgImageSrc.xlarge);
  const hasBackgroundPreviewImage = !!backgroundPreviewImage;
  const logoPreviewImage = resolveUrl ? resolveUrl(cfg.logoSrc) : toRenderableAssetUrl(cfg.logoSrc);
  const hasHeaderImage = !!(cfg.headerImageSrc.xlarge || cfg.headerImageSrc.large || cfg.headerImageSrc.medium || cfg.headerImageSrc.small);

  return (
    <div className="w-[400px] shrink-0 bg-[var(--life-neutral-020)] border-l border-[var(--life-neutral-200)] sticky top-0 h-[calc(100vh-64px)] flex flex-col">
      <div className="px-5 py-3 bg-white border-b border-[var(--life-neutral-200)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--life-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          <span className="text-xs font-bold tracking-[0.04em] text-[var(--life-neutral-500)]">Live Preview</span>
        </div>
        {previewLabel ? <span className="text-[11px] font-bold text-[var(--life-primary-500)] px-2.5 py-1 rounded-full border border-[var(--life-primary-200)] bg-[var(--life-primary-100)]">{previewLabel}</span> : null}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        {!cfg.menuStyle ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[var(--life-neutral-500)]">
            <div className="w-12 h-12 rounded-xl border border-[var(--life-neutral-200)] bg-white flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            </div>
            <div className="text-sm font-semibold">Select a menu style</div>
            <div className="text-xs">A live preview will appear here</div>
          </div>
        ) : (
          <div className="h-full rounded-[10px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.18)] border border-[var(--life-neutral-200)]">
            <div className="h-7 bg-[var(--life-primary-850)] flex items-center px-2.5 gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <span className="w-2 h-2 rounded-full bg-[#28c840]" />
            </div>

            {cfg.menuStyle === "life" ? (
              <div
                className="h-[calc(100%-28px)] flex bg-[var(--life-primary-750)]"
                style={backgroundPreviewImage ? { backgroundImage: `url(${backgroundPreviewImage})`, backgroundRepeat: cfg.bgRepeat, backgroundSize: cfg.bgSize, backgroundPosition: cfg.bgPosition } : undefined}
              >
                <div className="w-36 p-3" style={{ borderRight: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}>
                  <div className={`flex flex-col gap-1 ${logoAlignClass}`}>
                    {logoPreviewImage ? (
                      <img src={logoPreviewImage} alt={cfg.logoAltText || "Menu logo"} className="h-6 w-auto max-w-[104px] object-contain mb-1" />
                    ) : (
                      <div className="h-2 w-10 rounded mb-1" style={{ backgroundColor: "rgba(255,255,255,0.35)" }} />
                    )}
                  </div>
                  {hasHeaderImage && cfg.headerPosition === "above" ? (
                    headerPreviewImage ? (
                      <img src={headerPreviewImage} alt="Header" className="w-full rounded mb-1 object-cover" style={{ height: `${headerHeight}px` }} />
                    ) : (
                      <div className="bg-gradient-to-r from-[var(--life-primary-500)] to-[var(--life-accent1-500)] rounded mb-1" style={{ height: `${headerHeight}px` }} />
                    )
                  ) : null}
                  <div className={`flex flex-col gap-1 ${titleAlignClass}`}>
                    <div className="text-xs font-bold" style={{ color: "rgb(255,255,255)" }}>Course Navigation</div>
                    <div className={`text-[10px] ${subtitleAlignClass}`} style={{ color: "rgba(255,255,255,0.6)" }}>Select a module to begin</div>
                  </div>
                  {hasHeaderImage && cfg.headerPosition === "below" ? (
                    headerPreviewImage ? (
                      <img src={headerPreviewImage} alt="Header" className="w-full rounded mt-1 object-cover" style={{ height: `${headerHeight}px` }} />
                    ) : (
                      <div className="bg-gradient-to-r from-[var(--life-primary-500)] to-[var(--life-accent1-500)] rounded mt-1" style={{ height: `${headerHeight}px` }} />
                    )
                  ) : null}
                  <div className="mt-3 space-y-1">
                    {["Introduction", "Module 1", "Module 2", "Assessment"].map((label, i) => (
                      <div key={label} className="px-2 py-1 rounded text-[10px]" style={{ backgroundColor: i === 0 ? "rgba(46,127,161,0.35)" : "transparent", color: i === 0 ? "rgb(255,255,255)" : "rgba(255,255,255,0.55)", fontWeight: i === 0 ? 700 : 400 }}>
                        {label}
                        {i === 3 && !cfg.skipSubmenu ? <span className="ml-1">🔒</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 p-3 bg-[var(--life-neutral-020)]">
                  <div className="h-2 rounded w-3/5 mb-2 bg-[var(--life-primary-500)]" />
                  <div className="h-1 rounded w-full mb-1 bg-[var(--life-neutral-100)]" />
                  <div className="h-1 rounded w-4/5 mb-2 bg-[var(--life-neutral-100)]" />
                  <div className="h-20 border rounded bg-[var(--life-base-white)] border-[var(--life-primary-100)] px-2.5 py-2">
                    <div className="h-1.5 rounded w-1/2 mb-2 bg-[var(--life-primary-400)]/80" />
                    <div className="h-1 rounded w-full mb-1 bg-[var(--life-neutral-200)]" />
                    <div className="h-1 rounded w-[84%] mb-1 bg-[var(--life-neutral-200)]" />
                    <div className="h-1 rounded w-[70%] bg-[var(--life-neutral-200)]" />
                  </div>
                </div>
              </div>
            ) : null}

            {cfg.menuStyle === "overview" ? (
              <div
                className={`h-[calc(100%-28px)] ${hasBackgroundPreviewImage ? "bg-transparent" : "bg-white"}`}
                style={backgroundPreviewImage ? { backgroundImage: `url(${backgroundPreviewImage})`, backgroundRepeat: cfg.bgRepeat, backgroundSize: cfg.bgSize, backgroundPosition: cfg.bgPosition } : undefined}
              >
                <div className="bg-[var(--life-primary-750)] flex flex-col px-3 pt-2 pb-2">
                  <div className={`flex flex-col gap-1 ${logoAlignClass}`}>
                    {logoPreviewImage ? (
                      <img src={logoPreviewImage} alt={cfg.logoAltText || "Menu logo"} className="h-6 w-auto max-w-[104px] object-contain mb-1" />
                    ) : (
                      <div className="h-2 w-10 rounded mb-1" style={{ backgroundColor: "rgba(255,255,255,0.35)" }} />
                    )}
                  </div>
                  {hasHeaderImage && cfg.headerPosition === "above" ? (
                    headerPreviewImage ? (
                      <img src={headerPreviewImage} alt="Header" className="w-full rounded mb-1 object-cover" style={{ height: `${headerHeight}px` }} />
                    ) : (
                      <div className="bg-gradient-to-r from-[var(--life-primary-500)] to-[var(--life-accent1-500)] rounded mb-1" style={{ height: `${headerHeight}px` }} />
                    )
                  ) : null}
                  <div className={`flex flex-col gap-1 ${titleAlignClass}`}>
                    <div className="text-xs font-bold text-white">Course Navigation</div>
                    <div className={`text-[10px] ${subtitleAlignClass}`} style={{ color: "rgba(255,255,255,0.6)" }}>Select a module to begin</div>
                  </div>
                  {hasHeaderImage && cfg.headerPosition === "below" ? (
                    headerPreviewImage ? (
                      <img src={headerPreviewImage} alt="Header" className="w-full rounded mt-1 object-cover" style={{ height: `${headerHeight}px` }} />
                    ) : (
                      <div className="bg-gradient-to-r from-[var(--life-primary-500)] to-[var(--life-accent1-500)] rounded mt-1" style={{ height: `${headerHeight}px` }} />
                    )
                  ) : null}
                </div>
                <div className={`px-3 py-2 space-y-1.5 h-[calc(100%-86px)] ${hasBackgroundPreviewImage ? "bg-transparent" : "bg-white"}`}>
                  {[
                    { label: "Introduction", pct: 100 },
                    { label: "Core Concepts", pct: 60 },
                    { label: "Practical Work", pct: 20 },
                    { label: "Assessment", pct: 0 },
                  ].map((row, i) => (
                    <div key={row.label} className="flex items-center gap-2.5 py-1 border-b border-[var(--life-neutral-050)] last:border-b-0" style={{ opacity: i === 3 && !cfg.skipSubmenu ? 0.55 : 1 }}>
                      <div className="w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center shrink-0" style={{ borderColor: row.pct === 100 ? "var(--life-primary-500)" : "var(--life-neutral-200)", backgroundColor: row.pct === 100 ? "var(--life-primary-500)" : "transparent" }}>
                        {row.pct === 100 ? (
                          <svg width="8" height="6" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        ) : null}
                        {i === 3 && !cfg.skipSubmenu ? <span className="text-[8px]">🔒</span> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold text-[var(--life-base-black)] mb-0.5">{row.label}</div>
                        {i === 3 && !cfg.skipSubmenu ? (
                          <div className="h-1 rounded bg-[var(--life-neutral-100)]" />
                        ) : (
                          <div className="h-1 rounded bg-[var(--life-neutral-100)] overflow-hidden">
                            <div className="h-full bg-[var(--life-primary-500)]" style={{ width: `${row.pct}%` }} />
                          </div>
                        )}
                      </div>
                      {i !== 3 || cfg.skipSubmenu ? <div className="text-[9px] text-[var(--life-neutral-500)] shrink-0">{row.pct}%</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {cfg.menuStyle === "box" ? (
              <div
                className={`h-[calc(100%-28px)] ${hasBackgroundPreviewImage ? "bg-transparent" : "bg-[var(--life-neutral-050)]"}`}
                style={backgroundPreviewImage ? { backgroundImage: `url(${backgroundPreviewImage})`, backgroundRepeat: cfg.bgRepeat, backgroundSize: cfg.bgSize, backgroundPosition: cfg.bgPosition } : undefined}
              >
                <div className="bg-[var(--life-primary-750)] flex flex-col px-3 pt-2 pb-2">
                  <div className={`flex flex-col gap-1 ${logoAlignClass}`}>
                    {logoPreviewImage ? (
                      <img src={logoPreviewImage} alt={cfg.logoAltText || "Menu logo"} className="h-6 w-auto max-w-[104px] object-contain mb-1" />
                    ) : (
                      <div className="h-2 w-10 rounded mb-1" style={{ backgroundColor: "rgba(255,255,255,0.35)" }} />
                    )}
                  </div>
                  {hasHeaderImage && cfg.headerPosition === "above" ? (
                    headerPreviewImage ? (
                      <img src={headerPreviewImage} alt="Header" className="w-full rounded mb-1 object-cover" style={{ height: `${headerHeight}px` }} />
                    ) : (
                      <div className="bg-gradient-to-r from-[var(--life-primary-500)] to-[var(--life-accent1-500)] rounded mb-1" style={{ height: `${headerHeight}px` }} />
                    )
                  ) : null}
                  <div className={`flex flex-col gap-1 ${titleAlignClass}`}>
                    <div className="text-xs font-bold text-white">Course Navigation</div>
                    <div className={`text-[10px] ${subtitleAlignClass}`} style={{ color: "rgba(255,255,255,0.6)" }}>Select a module to begin</div>
                  </div>
                  {hasHeaderImage && cfg.headerPosition === "below" ? (
                    headerPreviewImage ? (
                      <img src={headerPreviewImage} alt="Header" className="w-full rounded mt-1 object-cover" style={{ height: `${headerHeight}px` }} />
                    ) : (
                      <div className="bg-gradient-to-r from-[var(--life-primary-500)] to-[var(--life-accent1-500)] rounded mt-1" style={{ height: `${headerHeight}px` }} />
                    )
                  ) : null}
                </div>
                <div className={`p-3 grid grid-cols-3 gap-2 content-start h-[calc(100%-86px)] ${hasBackgroundPreviewImage ? "bg-transparent" : "bg-[var(--life-neutral-050)]"}`}>
                  {[
                    "var(--life-primary-500)",
                    "var(--life-accent1-500)",
                    "var(--life-primary-600)",
                    "var(--life-warning-400)",
                    "var(--life-positive-400)",
                    "var(--life-critical-500)",
                  ].map((c, i) => (
                    <div key={`${c}-${i}`} className="h-[150px] rounded-xl p-2 text-[12px] font-semibold text-white/95 flex flex-col justify-end relative" style={{ backgroundColor: c, opacity: i === 5 && !cfg.skipSubmenu ? 0.6 : 1 }}>
                      {i === 5 && !cfg.skipSubmenu ? <span className="absolute top-1 right-1 text-[8px]">🔒</span> : null}
                      {i === 0 ? "Intro" : i === 1 ? "Core" : i === 2 ? "Advanced" : i === 3 ? "Practice" : i === 4 ? "Assessment" : "Resources"}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function MenuPage({
  courseId,
  initialMenuName,
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
}: {
  courseId?: string;
  initialMenuName?: string;
  onNavigationRequest?: (nav: string) => void;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
}) {
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetTarget | null>(null);
  const [externalAssetTarget, setExternalAssetTarget] = useState<AssetTarget | null>(null);
  const [activeCourseMenuSettings, setActiveCourseMenuSettings] = useState<CourseMenuSettings>({});
  const [courseAssetMappings, setCourseAssetMappings] = useState<Record<string, string>>({});
  const [assetLinkIdMap, setAssetLinkIdMap] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<MenuPageConfig>({
    ...DEFAULT_CONFIG,
    menuStyle: mapMenuNameToStyle(initialMenuName),
  });
  const [savedConfig, setSavedConfig] = useState<MenuPageConfig>({
    ...DEFAULT_CONFIG,
    menuStyle: mapMenuNameToStyle(initialMenuName),
  });
  const [openAcc, setOpenAcc] = useState("behavior");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fallbackStyle = mapMenuNameToStyle(initialMenuName);
    const base: MenuPageConfig = {
      ...DEFAULT_CONFIG,
      menuStyle: fallbackStyle,
    };

    if (!courseId) {
      setConfig(base);
      setSavedConfig(base);
      setActiveCourseMenuSettings({});
      setCourseAssetMappings({});
      setAssetLinkIdMap({});
      return;
    }

    let cancelled = false;

    const loadMenuSettings = async () => {
      try {
        const [settings, bootstrap, courseAssets] = await Promise.all([
          getCourseMenuSettings(courseId),
          getCourseBootstrapData(courseId),
          getCourseAssetMappings(courseId),
        ]);
        if (cancelled) return;
        const selectedStyle = mapMenuNameToStyle(bootstrap.menuName) || fallbackStyle;
        const merged = mergeConfigFromCourseMenuSettings(
          {
            ...base,
            menuStyle: selectedStyle,
          },
          settings
        );
        setActiveCourseMenuSettings(settings ?? {});
        setCourseAssetMappings(courseAssets || {});
        const nextAssetLinkMap: Record<string, string> = {};
        Object.entries(courseAssets || {}).forEach(([fieldName, assetId]) => {
          nextAssetLinkMap[`course/assets/${fieldName}`] = assetId;
        });
        setAssetLinkIdMap(nextAssetLinkMap);
        setConfig(merged);
        setSavedConfig(merged);
      } catch {
        if (cancelled) return;
        setActiveCourseMenuSettings({});
        setCourseAssetMappings({});
        setAssetLinkIdMap({});
        setConfig(base);
        setSavedConfig(base);
      }
    };

    loadMenuSettings();

    return () => {
      cancelled = true;
    };
  }, [courseId, initialMenuName]);

  const hasChanges = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } = useUnsavedChangesNavigationGuard({
    hasChanges,
    pendingNavigation,
    onPendingNavigationHandled,
    onNavigate: onNavigationRequest,
  });

  const set = <K extends keyof MenuPageConfig>(key: K, value: MenuPageConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const resolveAssetPreviewUrl = useCallback((value: string) => {
    const src = (value || "").trim();
    if (!src) return null;
    if (/^(https?:)?\/\//i.test(src) || src.startsWith("/api/asset/")) return src;
    if (/^[a-f0-9]{24}$/i.test(src)) return `/api/asset/serve/${src}`;

    const normalized = src.replace(/^\/+/, "");
    if (!normalized.startsWith("course/assets/")) return src;

    const fieldName = normalized.replace(/^course\/assets\//, "");
    const assetId = courseAssetMappings[fieldName] || assetLinkIdMap[normalized] || assetLinkIdMap[src];
    if (assetId) return `/api/asset/serve/${assetId}`;

    return null;
  }, [assetLinkIdMap, courseAssetMappings]);

  const applyAssetValue = useCallback((target: AssetTarget, value: string) => {
    setConfig((prev) => {
      if (target.scope === "logo") {
        return { ...prev, logoSrc: value };
      }

      if (target.scope === "headerImage") {
        return {
          ...prev,
          headerImageSrc: {
            ...prev.headerImageSrc,
            [target.bp]: value,
          },
        };
      }

      return {
        ...prev,
        bgImageSrc: {
          ...prev.bgImageSrc,
          [target.bp]: value,
        },
      };
    });
  }, []);

  const handleSave = async () => {
    if (!courseId) return;
    setIsSaving(true);
    try {
      const currentLinks = [
        config.logoSrc,
        ...Object.values(config.headerImageSrc),
        ...Object.values(config.bgImageSrc),
      ];
      const savedLinks = [
        savedConfig.logoSrc,
        ...Object.values(savedConfig.headerImageSrc),
        ...Object.values(savedConfig.bgImageSrc),
      ];
      const currentFieldNames = new Set(currentLinks.map(toCourseAssetFieldName).filter((v): v is string => !!v));
      const savedFieldNames = new Set(savedLinks.map(toCourseAssetFieldName).filter((v): v is string => !!v));

      const removedFieldNames = [...savedFieldNames].filter((fieldName) => !currentFieldNames.has(fieldName));
      if (removedFieldNames.length) {
        await Promise.all(removedFieldNames.map((fieldName) => removeCourseAssetMappings(courseId, fieldName)));
      }

      const upserts: Array<Promise<void>> = [];
      for (const link of currentLinks) {
        const fieldName = toCourseAssetFieldName(link);
        if (!fieldName) continue;
        const assetId = assetLinkIdMap[link];
        if (!assetId) continue;
        upserts.push(
          removeCourseAssetMappings(courseId, fieldName).then(() => createCourseAssetMapping(courseId, fieldName, assetId))
        );
      }
      if (upserts.length) {
        await Promise.all(upserts);
      }

      const selectedMenuLabel = mapMenuStyleToLabel(config.menuStyle);
      if (selectedMenuLabel) {
        await applyMenuSelectionToCourse(courseId, selectedMenuLabel);
      }

      const payload = buildCourseMenuSettingsPayload(config, activeCourseMenuSettings);
      await updateCourseMenuSettings(courseId, payload);

      const refreshedMappings = await getCourseAssetMappings(courseId);
      setCourseAssetMappings(refreshedMappings);

      setActiveCourseMenuSettings(payload);
      setSavedConfig(config);
      const navTarget = consumePendingNavigation();
      if (navTarget) onNavigationRequest?.(navTarget);
    } catch (err) {
      console.error("Failed to save menu settings", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setConfig(savedConfig);
    const navTarget = consumePendingNavigation();
    if (navTarget) onNavigationRequest?.(navTarget);
  };

  return (
    <>
      <div className="flex flex-row items-start min-h-[calc(100vh-64px)]">
        <div className="flex-1 min-w-0 bg-[var(--background)] border-r border-[var(--life-neutral-200)] px-8 py-8 overflow-y-auto max-h-[calc(100vh-64px)]">
          <div className="mb-7">
            <h2 className="text-xl font-bold text-[var(--life-base-black)] m-0">Menu</h2>
            <p className="text-sm text-[var(--life-neutral-300)] mt-1 leading-[1.5]">Configure how learners will navigate your course.</p>
            <div className="mt-3 px-3.5 py-2.5 rounded-lg bg-[var(--life-accent1-050)] border border-[var(--life-accent1-300)] flex items-start gap-2">
              <span className="text-[var(--life-accent1-600)] shrink-0 mt-[1px]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              </span>
              <p className="text-[13px] text-[var(--life-accent1-700)] m-0 leading-[1.55]">You can skip a menu page altogether by configuring the Start Settings to land the learner on the desired page.</p>
            </div>
          </div>

          <div className="mb-7">
            <SectionHeader label="Menu Style" required />
            <div className="flex gap-3.5">
              <StyleCard id="life" selected={config.menuStyle === "life"} onSelect={() => set("menuStyle", "life")} label="LIFE Menu" description="A structured sidebar navigation following the LIFE design standard. Ideal for multi-module courses with a persistent left rail." />
              <StyleCard id="overview" selected={config.menuStyle === "overview"} onSelect={() => set("menuStyle", "overview")} label="Overview Menu" description="A list-based overview of all course sections with progress indicators. Great for learners who want a clear sense of where they are." />
              <StyleCard id="box" selected={config.menuStyle === "box"} onSelect={() => set("menuStyle", "box")} label="Box Menu" description="A visual tile grid where each module is a distinct coloured card. Best for shorter courses or tile-based navigation experiences." />
            </div>
          </div>

          <div className="mb-2">
            <div className="text-[13px] font-bold text-[var(--life-base-black)] mb-4">Menu Configuration</div>

            <MenuAccordion title="Menu logo image" subtitle="Shown in the menu header. Recommended 240 × 80 px." open={openAcc === "logo"} onToggle={() => setOpenAcc((p) => (p === "logo" ? "" : "logo"))}>
              <AssetPickerCard
                label="Menu logo image"
                value={config.logoSrc}
                resolveUrl={resolveAssetPreviewUrl}
                onPickAsset={() => setAssetPickerTarget({ scope: "logo" })}
                onPickExternal={() => setExternalAssetTarget({ scope: "logo" })}
                onClear={() => applyAssetValue({ scope: "logo" }, "")}
                showLabel={false}
              />
              <div>
                <label className="text-[13px] text-[var(--life-base-black)] mb-2 block">Alternative text</label>
                <input
                  type="text"
                  value={config.logoAltText}
                  onChange={(e) => set("logoAltText", e.target.value)}
                  placeholder="e.g. Company logo"
                  className="w-full border border-[var(--life-neutral-200)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--life-base-black)] placeholder:text-[var(--life-neutral-400)] focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent"
                />
              </div>
            </MenuAccordion>

            <MenuAccordion title="Menu text alignment" subtitle="Applies to menu title, body copy, and instruction text." open={openAcc === "alignment"} onToggle={() => setOpenAcc((p) => (p === "alignment" ? "" : "alignment"))}>
              <div>
                <label className="text-[13px] text-[var(--life-base-black)] mb-2 block">Title alignment</label>
                <AlignButtons value={config.titleAlign} onChange={(v) => set("titleAlign", v)} />
              </div>
              <div>
                <label className="text-[13px] text-[var(--life-base-black)] mb-2 block">Subtitle alignment</label>
                <AlignButtons value={config.subtitleAlign} onChange={(v) => set("subtitleAlign", v)} />
              </div>
              <div>
                <label className="text-[13px] text-[var(--life-base-black)] mb-2 block">Body alignment</label>
                <AlignButtons value={config.bodyAlign} onChange={(v) => set("bodyAlign", v)} />
              </div>
              <div>
                <label className="text-[13px] text-[var(--life-base-black)] mb-2 block">Instruction alignment</label>
                <AlignButtons value={config.instructionAlign} onChange={(v) => set("instructionAlign", v)} />
              </div>
            </MenuAccordion>

            <MenuAccordion title="Menu header image" subtitle="Optional banner shown above or below the menu title." open={openAcc === "header"} onToggle={() => setOpenAcc((p) => (p === "header" ? "" : "header"))}>
              <div>
                <label className="text-[13px] text-[var(--life-base-black)] mb-2 block">Position</label>
                <div className="grid grid-cols-2 border border-[var(--life-neutral-200)] rounded-lg overflow-hidden">
                  {(["above", "below"] as HeaderPosition[]).map((pos, i) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => set("headerPosition", pos)}
                      className={`h-9 text-sm font-semibold transition-colors cursor-pointer ${config.headerPosition === pos ? "bg-[var(--life-primary-500)] text-white" : "bg-white text-[var(--life-neutral-500)] hover:bg-[var(--life-neutral-050)]"} ${i > 0 ? "border-l border-[var(--life-neutral-200)]" : ""}`}
                    >
                      {pos === "above" ? "Above menu title" : "Below menu title"}
                    </button>
                  ))}
                </div>
              </div>
              <AssetPickerCard label="_xlarge" value={config.headerImageSrc.xlarge} resolveUrl={resolveAssetPreviewUrl} onPickAsset={() => setAssetPickerTarget({ scope: "headerImage", bp: "xlarge" })} onPickExternal={() => setExternalAssetTarget({ scope: "headerImage", bp: "xlarge" })} onClear={() => applyAssetValue({ scope: "headerImage", bp: "xlarge" }, "")} />
              <AssetPickerCard label="_large" value={config.headerImageSrc.large} resolveUrl={resolveAssetPreviewUrl} onPickAsset={() => setAssetPickerTarget({ scope: "headerImage", bp: "large" })} onPickExternal={() => setExternalAssetTarget({ scope: "headerImage", bp: "large" })} onClear={() => applyAssetValue({ scope: "headerImage", bp: "large" }, "")} />
              <AssetPickerCard label="_medium" value={config.headerImageSrc.medium} resolveUrl={resolveAssetPreviewUrl} onPickAsset={() => setAssetPickerTarget({ scope: "headerImage", bp: "medium" })} onPickExternal={() => setExternalAssetTarget({ scope: "headerImage", bp: "medium" })} onClear={() => applyAssetValue({ scope: "headerImage", bp: "medium" }, "")} />
              <AssetPickerCard label="_small" value={config.headerImageSrc.small} resolveUrl={resolveAssetPreviewUrl} onPickAsset={() => setAssetPickerTarget({ scope: "headerImage", bp: "small" })} onPickExternal={() => setExternalAssetTarget({ scope: "headerImage", bp: "small" })} onClear={() => applyAssetValue({ scope: "headerImage", bp: "small" }, "")} />
              <div className="flex flex-col gap-3">
                <div className="text-[13px] font-bold text-[var(--life-base-black)]">Menu header minimum height</div>
                {(["xlarge", "large", "medium", "small"] as BreakpointKey[]).map((bp) => (
                  <div key={bp} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[13px] text-[var(--life-base-black)]">_{bp}</label>
                      <button
                        type="button"
                        onClick={() => set("headerMinHeight", { ...config.headerMinHeight, [bp]: "" })}
                        className="text-xs text-[var(--life-primary-500)] hover:text-[var(--life-primary-700)] cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                    <input
                      type="number"
                      value={config.headerMinHeight[bp]}
                      onChange={(e) => set("headerMinHeight", { ...config.headerMinHeight, [bp]: e.target.value })}
                      className="w-full border border-[var(--life-neutral-200)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--life-base-black)] placeholder:text-[var(--life-neutral-400)] focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
              <div className="border border-[var(--life-neutral-200)] rounded-lg p-4 flex flex-col gap-3">
                <div className="text-[13px] font-bold text-[var(--life-base-black)] underline">Menu header image styles</div>
                <MenuDropdown label="Set if/how the background image repeats" value={config.headerRepeat} options={BG_REPEAT_OPTIONS} onChange={(v) => set("headerRepeat", v as BgRepeat)} />
                <MenuDropdown label="Set the size of the background image" value={config.headerSize} options={BG_SIZE_OPTIONS} onChange={(v) => set("headerSize", v as BgSize)} />
                <MenuDropdown label="Set the position of the background image" value={config.headerBgPosition} options={BG_POSITION_OPTIONS} onChange={(v) => set("headerBgPosition", v as BgPosition)} />
              </div>
            </MenuAccordion>

            <MenuAccordion title="Menu background image" subtitle="Optional background behind the menu." open={openAcc === "background"} onToggle={() => setOpenAcc((p) => (p === "background" ? "" : "background"))}>
              <AssetPickerCard label="_xlarge" value={config.bgImageSrc.xlarge} resolveUrl={resolveAssetPreviewUrl} onPickAsset={() => setAssetPickerTarget({ scope: "backgroundImage", bp: "xlarge" })} onPickExternal={() => setExternalAssetTarget({ scope: "backgroundImage", bp: "xlarge" })} onClear={() => applyAssetValue({ scope: "backgroundImage", bp: "xlarge" }, "")} />
              <AssetPickerCard label="_large" value={config.bgImageSrc.large} resolveUrl={resolveAssetPreviewUrl} onPickAsset={() => setAssetPickerTarget({ scope: "backgroundImage", bp: "large" })} onPickExternal={() => setExternalAssetTarget({ scope: "backgroundImage", bp: "large" })} onClear={() => applyAssetValue({ scope: "backgroundImage", bp: "large" }, "")} />
              <AssetPickerCard label="_medium" value={config.bgImageSrc.medium} resolveUrl={resolveAssetPreviewUrl} onPickAsset={() => setAssetPickerTarget({ scope: "backgroundImage", bp: "medium" })} onPickExternal={() => setExternalAssetTarget({ scope: "backgroundImage", bp: "medium" })} onClear={() => applyAssetValue({ scope: "backgroundImage", bp: "medium" }, "")} />
              <AssetPickerCard label="_small" value={config.bgImageSrc.small} resolveUrl={resolveAssetPreviewUrl} onPickAsset={() => setAssetPickerTarget({ scope: "backgroundImage", bp: "small" })} onPickExternal={() => setExternalAssetTarget({ scope: "backgroundImage", bp: "small" })} onClear={() => applyAssetValue({ scope: "backgroundImage", bp: "small" }, "")} />
              <div className="border border-[var(--life-neutral-200)] rounded-lg p-4 flex flex-col gap-3">
                <div className="text-[13px] font-bold text-[var(--life-base-black)] underline">Menu background image styles</div>
                <MenuDropdown label="Set if/how the background image repeats" value={config.bgRepeat} options={BG_REPEAT_OPTIONS} onChange={(v) => set("bgRepeat", v as BgRepeat)} />
                <MenuDropdown label="Set the size of the background image" value={config.bgSize} options={BG_SIZE_OPTIONS} onChange={(v) => set("bgSize", v as BgSize)} />
                <MenuDropdown label="Set the position of the background image" value={config.bgPosition} options={BG_POSITION_OPTIONS} onChange={(v) => set("bgPosition", v as BgPosition)} />
              </div>
            </MenuAccordion>

            <MenuAccordion title="Behavior" open={openAcc === "behavior"} onToggle={() => setOpenAcc((p) => (p === "behavior" ? "" : "behavior"))}>
              <MenuCheckbox
                id="menu-skip-submenu"
                label="Skip submenu view"
                description="When enabled, learners jump straight from the main menu into the first available topic."
                checked={config.skipSubmenu}
                onChange={(v) => set("skipSubmenu", v)}
              />
              <div>
                <label className="text-[13px] text-[var(--life-base-black)] mb-2 block">Locked notification text</label>
                <input
                  type="text"
                  value={config.lockedText}
                  onChange={(e) => set("lockedText", e.target.value)}
                  placeholder={DEFAULT_LOCKED_NAV_TEXT}
                  className="w-full border border-[var(--life-neutral-200)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--life-base-black)] placeholder:text-[var(--life-neutral-400)] focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent"
                />
              </div>
            </MenuAccordion>
          </div>
        </div>

        <MenuPreview cfg={config} resolveUrl={resolveAssetPreviewUrl} />
      </div>

      <UnsavedChangesModal
        isOpen={showConfirmModal}
        isSaving={isSaving}
        onDiscard={handleDiscard}
        onSave={handleSave}
        onClose={clearPendingNavigation}
      />

      {assetPickerTarget ? (
        <AssetPickerModal
          onSelect={(asset) => {
            applyAssetValue(assetPickerTarget, asset.assetLink || asset.url || asset.id);
            setAssetLinkIdMap((prev) => ({
              ...prev,
              [asset.assetLink || asset.url || asset.id]: asset.id,
            }));
            setAssetPickerTarget(null);
          }}
          onClose={() => setAssetPickerTarget(null)}
        />
      ) : null}

      <ExternalAssetModal
        open={!!externalAssetTarget}
        title="Select External Asset"
        initialValue={externalAssetTarget ? (
          externalAssetTarget.scope === "logo"
            ? config.logoSrc
            : externalAssetTarget.scope === "headerImage"
              ? config.headerImageSrc[externalAssetTarget.bp]
              : config.bgImageSrc[externalAssetTarget.bp]
        ) : ""}
        onCancel={() => setExternalAssetTarget(null)}
        onSave={(value) => {
          if (externalAssetTarget) {
            applyAssetValue(externalAssetTarget, value);
          }
          setExternalAssetTarget(null);
        }}
      />
    </>
  );
}
