// Editor State and UI Types

export interface EditorState {
  // Panel visibility
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelType: "menu" | "page";

  // Selection state
  menuSelected: boolean;
  selectedPageId: string | null;

  // Rail/toolbar state
  activeRailIcon: string | null;

  // Editor mode
  mode: "edit" | "preview";

  // Unsaved changes
  isDirty: boolean;
  lastSavedAt?: Date;
}

export interface MenuPageEditState {
  id?: string;
  logoUrl: string | null;
  title: string;
  subtitle: string;
  body: string;
  menuStyle: string;
  menuLockType: string;
  textAlign: "left" | "center" | "right";
  bgType: "Color" | "Image" | "Gradient";
  bgColor?: string;
  bgImageUrl?: string | null;
}

export interface ContentPageEditState {
  id: string;
  title: string;
  description: string;
  articles: Array<{ id: string; title: string }>;
  subPages: Array<{ id: string; title: string }>;
}

export type RailIconId = "structure" | "theme" | "extensions" | "settings";

export interface ToolState {
  activeTool: string | null;
  toolOptions: Record<string, unknown>;
}
