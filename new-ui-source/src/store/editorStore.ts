// Editor UI state management with Zustand
// Install: npm install zustand

import { create } from "zustand";
import type { EditorState, RailIconId } from "@/types";

interface EditorStore extends EditorState {
  // Panel actions
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelType: (type: "menu" | "page") => void;

  // Selection actions
  setMenuSelected: (selected: boolean) => void;
  setSelectedPageId: (pageId: string | null) => void;

  // Rail actions
  setActiveRailIcon: (icon: RailIconId | null) => void;

  // Mode actions
  setMode: (mode: "edit" | "preview") => void;

  // Dirty tracking
  setIsDirty: (dirty: boolean) => void;
  updateLastSaved: () => void;

  // Reset
  reset: () => void;
}

const initialState: EditorState = {
  leftPanelOpen: true,
  rightPanelOpen: false,
  rightPanelType: "menu",
  menuSelected: false,
  selectedPageId: null,
  activeRailIcon: "structure",
  mode: "edit",
  isDirty: false,
};

export const useEditorStore = create<EditorStore>((set) => ({
  ...initialState,

  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setRightPanelType: (type) => set({ rightPanelType: type }),

  setMenuSelected: (selected) => set({ menuSelected: selected }),
  setSelectedPageId: (pageId) => set({ selectedPageId: pageId }),

  setActiveRailIcon: (icon) => set({ activeRailIcon: icon }),

  setMode: (mode) => set({ mode }),

  setIsDirty: (dirty) => set({ isDirty: dirty }),
  updateLastSaved: () => set({ lastSavedAt: new Date(), isDirty: false }),

  reset: () => set(initialState),
}));
