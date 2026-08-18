// The Course Structure page's model. Maps onto the real Adapt content hierarchy:
//   Module     → menu contentobject (_type:'menu'), child of the course
//   Sub-Module → menu contentobject nested inside another menu
//   Topic      → page contentobject (_type:'page'), child of a course/menu
//   Section    → article
//   Content Group → block
//   Component  → component (_component / _componentType)
//
// Menus (modules/sub-modules) nest recursively (SModule.modules). Within any
// container (the course, or a menu), the direct children are menus + pages
// interleaved and ordered by `sortOrder` (the engine's _sortOrder).

export type StructureLevel =
  | "module"
  | "topic"
  | "section"
  | "contentGroup"
  | "component";

export interface SComponent {
  id: string;
  title: string;
  componentKey: string; // engine `_component` key, e.g. 'text' | 'mcq'
  layout?: "full" | "left" | "right";
  subtitle?: string;
  description?: string;
  instruction?: string;
  themeSettings?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  url?: string;
}

export interface SContentGroup {
  id: string;
  title: string;
  description?: string;
  instruction?: string;
  themeSettings?: Record<string, unknown>;
  components: SComponent[];
}

export interface SSection {
  id: string;
  title: string;
  displayTitle?: string;
  description?: string;
  instruction?: string;
  themeSettings?: Record<string, unknown>;
  classes?: string;
  requireCompletionOf?: string;
  isOptional?: boolean;
  isAvailable?: boolean;
  isHidden?: boolean;
  isVisible?: boolean;
  onScreen?: {
    _isEnabled?: boolean;
    _classes?: string;
    _percentInviewVertical?: number;
  };
  ariaLevel?: string;
  extensions?: Record<string, unknown>;
  contentGroups: SContentGroup[];
}

export interface STopic {
  id: string;
  title: string;
  displayTitle?: string;
  sortOrder: number;
  subtitle?: string;
  body?: string;
  instruction?: string;
  description?: string;
  graphic?: {
    src?: string;
    alt?: string;
  };
  linkText?: string;
  duration?: string;
  lockType?: string;
  lockedBy?: string[];
  classes?: string;
  htmlClasses?: string;
  requireCompletionOf?: string;
  isOptional?: boolean;
  isAvailable?: boolean;
  isHidden?: boolean;
  isVisible?: boolean;
  onScreen?: {
    _isEnabled?: boolean;
    _classes?: string;
    _percentInviewVertical?: number;
  };
  ariaLevel?: string;
  extensions?: Record<string, unknown>;
  themeSettings?: Record<string, unknown>;
  menuSettings?: Record<string, unknown>;
  sections: SSection[];
}

export interface SModule {
  id: string;
  title: string;
  sortOrder: number;
  modules: SModule[]; // nested sub-modules
  topics: STopic[]; // pages directly under this menu
}

export interface CourseStructure {
  courseTitle: string;
  modules: SModule[]; // top-level menus (children of the course)
  topics: STopic[]; // top-level pages (children of the course)
}

// A course/menu's direct children (menus + pages) as one ordered list.
export type ContainerChild =
  | { kind: "module"; node: SModule; sortOrder: number }
  | { kind: "topic"; node: STopic; sortOrder: number };

export function mergedChildren(modules: SModule[], topics: STopic[]): ContainerChild[] {
  const children: ContainerChild[] = [
    ...modules.map((node) => ({ kind: "module" as const, node, sortOrder: node.sortOrder })),
    ...topics.map((node) => ({ kind: "topic" as const, node, sortOrder: node.sortOrder })),
  ];
  return children.sort((a, b) => a.sortOrder - b.sortOrder);
}

// Container level for drag-and-drop validation ("course" is the implicit root).
export type ContainerLevel = "course" | "module" | "topic" | "section" | "contentGroup";

// Which child levels a container accepts — the rule that validates drag-and-drop
// (a Section only into a Topic, a Component only into a Content Group, etc.).
export function acceptsChild(parentLevel: string, childLevel: StructureLevel): boolean {
  switch (parentLevel) {
    case "course":
    case "module":
      return childLevel === "module" || childLevel === "topic";
    case "topic":
      return childLevel === "section";
    case "section":
      return childLevel === "contentGroup";
    case "contentGroup":
      return childLevel === "component";
    default:
      return false;
  }
}

// Display labels for each level (matches the design).
export const STRUCTURE_LABELS: Record<StructureLevel, string> = {
  module: "Module",
  topic: "Topic",
  section: "Section",
  contentGroup: "Content Group",
  component: "Component",
};

// The engine content-type name for each level (for /api/content/:type routes).
export const LEVEL_TO_CONTENT_TYPE: Record<StructureLevel, string> = {
  module: "contentobject",
  topic: "contentobject",
  section: "article",
  contentGroup: "block",
  component: "component",
};
