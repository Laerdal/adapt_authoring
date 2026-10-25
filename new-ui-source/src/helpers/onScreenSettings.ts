export const ON_SCREEN_CLASS_OPTIONS = [
  "", "fade-in", "fade-in-left", "fade-in-right", "fade-in-top", "fade-in-bottom", "fade-out",
] as const;

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
  return !/life[- ]?v2/.test(name) && (name.includes("life") || name.includes("custom"));
}

export function getOnScreenClassOptions(theme: string, current = ""): readonly string[] {
  const options: readonly string[] = supportsGlobalOnScreen(theme) ? ON_SCREEN_CLASS_OPTIONS : LEGACY_CLASS_OPTIONS;
  return current && !options.includes(current) ? [...options, current] : options;
}
