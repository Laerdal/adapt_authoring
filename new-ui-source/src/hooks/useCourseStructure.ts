// Course Structure editing model. Edits are staged in a local DRAFT and only
// written to the backend when the caller invokes save(). `discard()` reverts to
// the last-saved state. Menus (modules) nest recursively; within a container the
// direct children (menus + pages) are ordered by _sortOrder.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CourseStructure,
  type SModule,
  type STopic,
  type SSection,
  type SContentGroup,
  type SComponent,
  type StructureLevel,
  type ContainerLevel,
  mergedChildren,
  acceptsChild,
} from "../types/structure";
import {
  getCourseStructure,
  createModule,
  createTopic,
  createArticle,
  createBlock,
  createComponent,
  renameStructureNode,
  deleteStructureNode,
  moveContentNode,
  updateComponentLayout,
  getAvailableComponents,
  type ComponentTypeOption,
} from "../api/adaptAuthoring";
import {
  NEW_CONTENT_GROUP_TITLE,
  NEW_SECTION_TITLE,
  NEW_TOPIC_TITLE,
} from "../constants/structureDefaults";

const EMPTY: CourseStructure = { courseTitle: "Course", modules: [], topics: [] };

// ── Temp ids for locally-created (unsaved) nodes ──────────────────────────────
let tmpCounter = 0;
const tmpId = () => `tmp-${++tmpCounter}`;
const isTmp = (id: string) => id.startsWith("tmp-");

// ── Local node builders (no backend) ──────────────────────────────────────────
const newComponent = (title = "Text", key = "text"): SComponent => ({ id: tmpId(), title, componentKey: key });
const newContentGroup = (withComponent: boolean): SContentGroup => ({
  id: tmpId(),
  title: NEW_CONTENT_GROUP_TITLE,
  components: withComponent ? [newComponent()] : [],
});
const newSection = (withComponent: boolean): SSection => ({
  id: tmpId(),
  title: NEW_SECTION_TITLE,
  contentGroups: [newContentGroup(withComponent)],
});
const newTopic = (sortOrder: number): STopic => ({
  id: tmpId(),
  title: NEW_TOPIC_TITLE,
  sortOrder,
  sections: [newSection(true)],
});
const newModule = (sortOrder: number): SModule => ({
  id: tmpId(),
  title: "New Module",
  sortOrder,
  modules: [],
  topics: [newTopic(1)], // a module must contain at least one topic
});
// Next sortOrder for a container's direct children (menus + pages share one list).
// Use max(existing)+1 rather than array length: after a delete/move the lengths
// can drift from the sortOrder values, and length+1 would duplicate an existing
// sortOrder (breaking mergedChildren's ordering and save/reorder).
const nextChildSortOrder = (c: { modules: SModule[]; topics: STopic[] }): number => {
  let max = 0;
  for (const m of c.modules) if (m.sortOrder > max) max = m.sortOrder;
  for (const t of c.topics) if (t.sortOrder > max) max = t.sortOrder;
  return max + 1;
};
const buildStarterDraft = (courseTitle: string): CourseStructure => ({
  courseTitle,
  modules: [],
  topics: [newTopic(1)],
});

// ── Recursive tree walkers ────────────────────────────────────────────────────
function allModules(s: CourseStructure): SModule[] {
  const out: SModule[] = [];
  const walk = (m: SModule) => { out.push(m); m.modules.forEach(walk); };
  s.modules.forEach(walk);
  return out;
}
function allTopics(s: CourseStructure): STopic[] {
  return [...s.topics, ...allModules(s).flatMap((m) => m.topics)];
}
function allSections(s: CourseStructure): SSection[] {
  return allTopics(s).flatMap((t) => t.sections);
}
function allGroups(s: CourseStructure): SContentGroup[] {
  return allSections(s).flatMap((sec) => sec.contentGroups);
}
function findModule(s: CourseStructure, id: string): SModule | undefined {
  return allModules(s).find((m) => m.id === id);
}
function findTopic(s: CourseStructure, id: string): STopic | undefined {
  return allTopics(s).find((t) => t.id === id);
}
function findSection(s: CourseStructure, id: string): SSection | undefined {
  return allSections(s).find((sec) => sec.id === id);
}
function findContentGroup(s: CourseStructure, id: string): SContentGroup | undefined {
  return allGroups(s).find((cg) => cg.id === id);
}
function findGroupOfComponent(s: CourseStructure, componentId: string): SContentGroup | undefined {
  return allGroups(s).find((cg) => cg.components.some((c) => c.id === componentId));
}
function moduleContainingTopic(s: CourseStructure, topicId: string): SModule | undefined {
  return allModules(s).find((m) => m.topics.some((t) => t.id === topicId));
}
function container(s: CourseStructure, containerId: string, courseId: string): { modules: SModule[]; topics: STopic[] } {
  if (containerId === courseId) return { modules: s.modules, topics: s.topics };
  const m = findModule(s, containerId);
  return { modules: m?.modules ?? [], topics: m?.topics ?? [] };
}
function allContainers(s: CourseStructure, courseId: string): { id: string; modules: SModule[]; topics: STopic[] }[] {
  return [
    { id: courseId, modules: s.modules, topics: s.topics },
    ...allModules(s).map((m) => ({ id: m.id, modules: m.modules, topics: m.topics })),
  ];
}
function containerLevelOf(s: CourseStructure, id: string, courseId: string): ContainerLevel | null {
  if (id === courseId) return "course";
  if (findModule(s, id)) return "module";
  if (findTopic(s, id)) return "topic";
  if (findSection(s, id)) return "section";
  if (findContentGroup(s, id)) return "contentGroup";
  return null;
}
function childCount(s: CourseStructure, containerId: string, courseId: string): number {
  const c = container(s, containerId, courseId);
  return c.modules.length + c.topics.length;
}
function setTitleById(s: CourseStructure, id: string, title: string): void {
  for (const m of allModules(s)) if (m.id === id) { m.title = title; return; }
  for (const t of allTopics(s)) {
    if (t.id === id) { t.title = title; return; }
    for (const sec of t.sections) {
      if (sec.id === id) { sec.title = title; return; }
      for (const cg of sec.contentGroups) {
        if (cg.id === id) { cg.title = title; return; }
        for (const c of cg.components) if (c.id === id) { c.title = title; return; }
      }
    }
  }
}

// ── Move helpers (operate on a cloned CourseStructure) ────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detachNode(s: CourseStructure, level: StructureLevel, id: string, courseId: string): { node: any; oldParentId: string } | null {
  if (level === "component") {
    for (const g of allGroups(s)) { const i = g.components.findIndex((c) => c.id === id); if (i >= 0) return { node: g.components.splice(i, 1)[0], oldParentId: g.id }; }
  } else if (level === "contentGroup") {
    for (const sec of allSections(s)) { const i = sec.contentGroups.findIndex((c) => c.id === id); if (i >= 0) return { node: sec.contentGroups.splice(i, 1)[0], oldParentId: sec.id }; }
  } else if (level === "section") {
    for (const t of allTopics(s)) { const i = t.sections.findIndex((x) => x.id === id); if (i >= 0) return { node: t.sections.splice(i, 1)[0], oldParentId: t.id }; }
  } else if (level === "topic") {
    for (const c of allContainers(s, courseId)) { const i = c.topics.findIndex((x) => x.id === id); if (i >= 0) return { node: c.topics.splice(i, 1)[0], oldParentId: c.id }; }
  } else if (level === "module") {
    for (const c of allContainers(s, courseId)) { const i = c.modules.findIndex((x) => x.id === id); if (i >= 0) return { node: c.modules.splice(i, 1)[0], oldParentId: c.id }; }
  }
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getChildArray(s: CourseStructure, level: StructureLevel, parentId: string): any[] | null {
  if (level === "component") return findContentGroup(s, parentId)?.components ?? null;
  if (level === "contentGroup") return findSection(s, parentId)?.contentGroups ?? null;
  if (level === "section") return findTopic(s, parentId)?.sections ?? null;
  return null;
}

// ── Reconciliation (save) helpers ─────────────────────────────────────────────
interface NodeDesc {
  level: StructureLevel;
  id: string;
  title: string;
  parentId: string; // courseId for top-level module/topic
  order: number; // 1-based position among siblings
  componentKey?: string;
  layout?: "full" | "left" | "right";
}
// Depth-first, parents before children — safe order for creates.
function flatten(s: CourseStructure, courseId: string): NodeDesc[] {
  const out: NodeDesc[] = [];
  const walkContainer = (containerId: string, modules: SModule[], topics: STopic[]) => {
    mergedChildren(modules, topics).forEach((child, i) => {
      if (child.kind === "module") {
        out.push({ level: "module", id: child.node.id, title: child.node.title, parentId: containerId, order: i + 1 });
        walkContainer(child.node.id, child.node.modules, child.node.topics);
      } else {
        const topic = child.node;
        out.push({ level: "topic", id: topic.id, title: topic.title, parentId: containerId, order: i + 1 });
        topic.sections.forEach((sec, si) => {
          out.push({ level: "section", id: sec.id, title: sec.title, parentId: topic.id, order: si + 1 });
          sec.contentGroups.forEach((cg, ci) => {
            out.push({ level: "contentGroup", id: cg.id, title: cg.title, parentId: sec.id, order: ci + 1 });
            cg.components.forEach((comp, coi) => {
              const layout = cg.components.length === 1 ? "full" : (coi === 0 ? "left" : "right");
              out.push({ level: "component", id: comp.id, title: comp.title, parentId: cg.id, order: coi + 1, componentKey: comp.componentKey, layout });
            });
          });
        });
      }
    });
  };
  walkContainer(courseId, s.modules, s.topics);
  return out;
}

export function useCourseStructure(courseId: string, courseTitle = "Course") {
  const [draft, setDraft] = useState<CourseStructure>({ ...EMPTY, courseTitle });
  const [saved, setSaved] = useState<CourseStructure>({ ...EMPTY, courseTitle });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Cache of installed component types, resolved lazily for save().
  const componentsRef = useRef<ComponentTypeOption[] | null>(null);

  // Load the backend structure; an empty course shows an UNSAVED starter draft.
  const reload = useCallback(async () => {
    if (!courseId) { setDraft({ ...EMPTY, courseTitle }); setSaved({ ...EMPTY, courseTitle }); setLoading(false); return; }
    setLoading(true);
    try {
      const fetched = await getCourseStructure(courseId, courseTitle);
      const isEmpty = fetched.modules.length === 0 && fetched.topics.length === 0;
      setSaved(fetched);
      setDraft(isEmpty ? buildStarterDraft(courseTitle) : structuredClone(fetched));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load course structure"));
    } finally {
      setLoading(false);
    }
  }, [courseId, courseTitle]);

  useEffect(() => { void reload(); }, [reload]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  // Apply a local, in-memory edit to the draft (no backend).
  const edit = useCallback((mutator: (d: CourseStructure) => void) => {
    setDraft((prev) => { const next = structuredClone(prev); mutator(next); return next; });
  }, []);

  const addModuleAt = useCallback((parentId: string) => {
    edit((d) => {
      const c = container(d, parentId, courseId);
      c.modules.push(newModule(nextChildSortOrder(c)));
    });
  }, [edit, courseId]);
  const addModule = useCallback(() => addModuleAt(courseId), [addModuleAt, courseId]);
  const addSubModule = useCallback((parentModuleId: string) => addModuleAt(parentModuleId), [addModuleAt]);

  const addTopic = useCallback((parentId?: string | null) => {
    const parent = parentId || courseId;
    edit((d) => {
      const c = container(d, parent, courseId);
      c.topics.push(newTopic(nextChildSortOrder(c)));
    });
  }, [edit, courseId]);

  const addSection = useCallback((topicId: string) => {
    edit((d) => { findTopic(d, topicId)?.sections.push(newSection(false)); });
  }, [edit]);

  const addContentGroup = useCallback((sectionId: string) => {
    edit((d) => { findSection(d, sectionId)?.contentGroups.push(newContentGroup(false)); });
  }, [edit]);

  const addComponent = useCallback((blockId: string, componentType: ComponentTypeOption) => {
    if ((findContentGroup(draft, blockId)?.components.length ?? 0) >= 2) {
      setError(new Error("A content group can contain at most two components (left and right)."));
      return;
    }
    edit((d) => { findContentGroup(d, blockId)?.components.push(newComponent(componentType.displayName, componentType.component)); });
  }, [edit, draft]);

  const rename = useCallback((_level: StructureLevel, id: string, title: string) => {
    edit((d) => setTitleById(d, id, title));
  }, [edit]);

  const remove = useCallback((level: StructureLevel, id: string) => {
    if (level === "topic") {
      const inModule = moduleContainingTopic(draft, id);
      if (inModule && inModule.topics.length <= 1) { setError(new Error("Each module must contain at least one topic.")); return; }
      if (!inModule && draft.topics.length <= 1) { setError(new Error("At least one topic is required at the course level.")); return; }
    }
    // Any component may be removed (a block may be left empty; the Tree warns
    // first). A surviving single component becomes "full" automatically — save()
    // recomputes _layout from sibling count and position.
    edit((d) => { detachNode(d, level, id, courseId); });
  }, [edit, draft, courseId]);

  // Drag-and-drop move — reparent/reorder within the draft (no backend).
  const moveNode = useCallback((level: StructureLevel, id: string, newParentId: string, beforeId: string | null) => {
    const newParentLevel = containerLevelOf(draft, newParentId, courseId);
    if (!newParentLevel || !acceptsChild(newParentLevel, level)) { setError(new Error("That item can't be placed there.")); return; }
    if (level === "module") {
      const banned = new Set<string>();
      const collect = (m: SModule) => { banned.add(m.id); m.modules.forEach(collect); };
      const dragged = findModule(draft, id); if (dragged) collect(dragged);
      if (banned.has(newParentId)) { setError(new Error("A module can't be moved inside itself.")); return; }
    }
    if (level === "component") {
      const target = findContentGroup(draft, newParentId);
      const source = findGroupOfComponent(draft, id);
      if (target && source && target.id !== source.id && target.components.length >= 2) { setError(new Error("A content group can contain at most two components.")); return; }
    }
    if (level === "topic") {
      const srcModule = moduleContainingTopic(draft, id);
      if (srcModule && srcModule.id !== newParentId && srcModule.topics.length <= 1) { setError(new Error("Each module must contain at least one topic.")); return; }
      if (!srcModule && newParentId !== courseId && draft.topics.length <= 1) { setError(new Error("At least one topic is required at the course level.")); return; }
    }

    edit((next) => {
      const detached = detachNode(next, level, id, courseId);
      if (!detached) return;
      const { node } = detached;
      if (level === "module" || level === "topic") {
        const c = container(next, newParentId, courseId);
        let ids = mergedChildren(c.modules, c.topics).map((x) => x.node.id).filter((x) => x !== node.id);
        if (beforeId && ids.includes(beforeId)) ids.splice(ids.indexOf(beforeId), 0, node.id); else ids.push(node.id);
        (level === "module" ? c.modules : c.topics).push(node as SModule & STopic);
        const byId = new Map<string, SModule | STopic>([...c.modules, ...c.topics].map((n) => [n.id, n]));
        ids.forEach((cid, i) => { const n = byId.get(cid); if (n) n.sortOrder = i + 1; });
      } else {
        const arr = getChildArray(next, level, newParentId);
        if (!arr) return;
        if (beforeId) { const i = arr.findIndex((x) => x.id === beforeId); if (i >= 0) arr.splice(i, 0, node); else arr.push(node); } else arr.push(node);
      }
    });
  }, [edit, draft, courseId]);

  const discard = useCallback(() => { void reload(); }, [reload]);

  // Persist the whole draft to the backend, then re-sync from the canonical tree.
  // Returns true on success (used by the leave-guard to navigate only if saved).
  const save = useCallback(async (): Promise<boolean> => {
    if (!courseId || saving) return false;
    setSaving(true);
    setError(null);
    try {
      if (!componentsRef.current) componentsRef.current = await getAvailableComponents();
      const compByKey = new Map(componentsRef.current.map((c) => [c.component, c]));

      const draftDescs = flatten(draft, courseId);
      const savedDescs = flatten(saved, courseId);
      const savedById = new Map(savedDescs.map((d) => [d.id, d]));
      const draftIds = new Set(draftDescs.map((d) => d.id));

      // 1. Creates (parents first) — map temp ids → real ids.
      const idMap = new Map<string, string>();
      const real = (id: string) => idMap.get(id) ?? id;
      for (const d of draftDescs) {
        if (!isTmp(d.id)) continue;
        const parent = real(d.parentId);
        let realId: string | undefined;
        if (d.level === "module") realId = await createModule(courseId, parent, d.title, d.order);
        else if (d.level === "topic") realId = await createTopic(courseId, parent, d.title, d.order);
        else if (d.level === "section") realId = await createArticle(courseId, parent, d.title, d.order);
        else if (d.level === "contentGroup") realId = await createBlock(courseId, parent, d.title, d.order);
        else if (d.level === "component") {
          const type = d.componentKey ? compByKey.get(d.componentKey) : undefined;
          if (!type) { console.warn(`[CourseStructure] Unknown component type "${d.componentKey}" — skipped`); continue; }
          realId = await createComponent(courseId, parent, type, d.order, d.layout ?? "full");
          // createComponent titles from the component type; honor a custom title.
          if (d.title && d.title !== type.displayName) await renameStructureNode("component", realId, d.title);
        }
        if (realId) idMap.set(d.id, realId);
      }

      // 2. Renames for existing nodes whose title changed.
      for (const d of draftDescs) {
        if (isTmp(d.id)) continue;
        const prev = savedById.get(d.id);
        if (prev && prev.title !== d.title) await renameStructureNode(d.level, d.id, d.title);
      }

      // 3. Reparent / reorder existing nodes whose parent or order changed.
      for (const d of draftDescs) {
        if (isTmp(d.id)) continue;
        const prev = savedById.get(d.id);
        if (!prev) continue;
        const newParent = real(d.parentId);
        if (prev.parentId !== newParent || prev.order !== d.order) {
          await moveContentNode(d.level, d.id, newParent, d.order);
        }
        if (d.level === "component" && prev.layout !== d.layout && d.layout) {
          await updateComponentLayout(d.id, d.layout);
        }
      }

      // 4. Deletes — nodes gone from the draft; only the top-most (delete cascades).
      const isAncestorDeleted = (id: string): boolean => {
        let p = savedById.get(id)?.parentId;
        while (p && p !== courseId) {
          if (!draftIds.has(p)) return true;
          p = savedById.get(p)?.parentId;
        }
        return false;
      };
      for (const d of savedDescs) {
        if (draftIds.has(d.id)) continue;
        if (isAncestorDeleted(d.id)) continue; // cascaded via an ancestor delete
        await deleteStructureNode(d.level, d.id);
      }

      await reload();
      return true;
    } catch (err) {
      // Keep the user's draft and surface the error so they can retry — do NOT
      // reload(), which would revert their edits and clear the error we just set.
      setError(err instanceof Error ? err : new Error("Failed to save course structure"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [courseId, saving, draft, saved, reload]);

  return {
    state: draft,
    saved,
    dirty,
    loading,
    saving,
    error,
    save,
    discard,
    refresh: reload,
    addModule,
    addSubModule,
    addTopic,
    addSection,
    addContentGroup,
    addComponent,
    rename,
    remove,
    moveNode,
  };
}
