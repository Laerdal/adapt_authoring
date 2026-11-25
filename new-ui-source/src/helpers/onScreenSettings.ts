export const SMOOTH_ENTRANCE_CLASS = "smooth-entrance";

export const ON_SCREEN_CLASS_OPTIONS = [
  "", "fade-in", "fade-in-left", "fade-in-right", "fade-in-top", "fade-in-bottom", "fade-out",
  SMOOTH_ENTRANCE_CLASS,
] as const;

// Friendly display names for class values (ADAPT-3947). Classes without an
// entry are displayed as their raw CSS class name.
export const ON_SCREEN_CLASS_LABELS: Record<string, string> = {
  [SMOOTH_ENTRANCE_CLASS]: "smooth-entrance",
};

export function getOnScreenClassLabel(className: string): string {
  return ON_SCREEN_CLASS_LABELS[className] ?? className;
}

const LEGACY_CLASS_OPTIONS = [
  "", "fade-in", "fade-out", "slide-in-left", "slide-in-right", "slide-in-up",
  "slide-in-down", "zoom-in", "zoom-out", "bounce", "flip", "rotate-in",
] as const;

export interface OnScreenSettings {
  _isEnabled?: boolean;
  _classes?: string;
  _percentInviewVertical?: number | "";
}

export function serializeOnScreenSettings(settings?: OnScreenSettings) {
  return {
    _isEnabled: !!settings?._isEnabled,
    _classes: settings?._classes || "",
    _percentInviewVertical: typeof settings?._percentInviewVertical === "number"
      ? settings._percentInviewVertical
      : 50,
  };
}

export function supportsGlobalOnScreen(theme: string): boolean {
  const name = theme.toLowerCase();
  return name.includes("life") || name.includes("custom");
}

export function getOnScreenClassOptions(theme: string, current = ""): readonly string[] {
  const options: readonly string[] = supportsGlobalOnScreen(theme) ? ON_SCREEN_CLASS_OPTIONS : LEGACY_CLASS_OPTIONS;
  return current && !options.includes(current) ? [...options, current] : options;
}

export type OnScreenLevel = "page" | "article" | "block" | "component";

// Theme-level defaults as stored in course themeSettings[themeKey]._onScreen.
export interface GlobalOnScreenLevelConfig {
  _classes?: string;
  _percentInviewVertical?: number;
}

export interface GlobalOnScreenConfig {
  _isEnabled?: boolean;
  _levels?: Partial<Record<OnScreenLevel, GlobalOnScreenLevelConfig>>;
}

export type OnScreenInheritance =
  | { state: "overridden"; classes: string; inheritedClasses: string }
  | { state: "local"; classes: string }
  | { state: "inherited"; classes: string }
  | { state: "none" };

// Mirrors resolveOnScreen() in the Life / Life v2 / custom theme.js: a
// non-empty local class always wins; an empty local class falls back to the
// theme-level default for that content level (when globally enabled).
export function resolveOnScreenInheritance(
  global: GlobalOnScreenConfig | undefined,
  localClasses: string | undefined,
  level: OnScreenLevel
): OnScreenInheritance {
  const local = localClasses?.trim() ?? "";
  const inherited = global?._isEnabled ? global._levels?.[level]?._classes?.trim() ?? "" : "";
  if (local) {
    return inherited
      ? { state: "overridden", classes: local, inheritedClasses: inherited }
      : { state: "local", classes: local };
  }
  return inherited ? { state: "inherited", classes: inherited } : { state: "none" };
}
