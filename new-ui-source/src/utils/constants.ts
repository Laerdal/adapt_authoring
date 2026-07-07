// Application constants

export const SORT_OPTIONS = ["Recently Modified", "Alphabetical", "Date Created"] as const;

export const COURSE_STATUS = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
} as const;

export const MENU_STYLES = ["Box Menu", "Linear Menu", "Icon Menu"] as const;

export const BACKGROUND_TYPES = ["Color", "Image", "Gradient"] as const;

export const TEXT_ALIGN = ["left", "center", "right"] as const;

export const RAIL_ICONS = ["structure", "theme", "extensions", "settings"] as const;

// API — default to same-origin (the /new embed calls the engine's /api/* on the
// same host). The vite dev server proxies /api → :5000 (see vite.config.ts).
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_LIMIT = 20;

// Timeouts
export const DEBOUNCE_DELAY = 300;
export const AUTOSAVE_INTERVAL = 30000; // 30 seconds

// Feature flags (if needed)
export const FEATURES = {
  ENABLE_PREVIEW: true,
  ENABLE_PUBLISH: true,
  ENABLE_VERSIONING: false,
} as const;
