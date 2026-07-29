// Loads and mutates a course's real content structure (modules / sub-modules /
// topics / sections / content groups / components) through the engine's
// /api/content/* routes. Used by the Course Structure panel in the Course Setup
// flow. Menus (modules) nest recursively; within any container the direct
// children (menus + pages) are ordered by _sortOrder.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CourseStructure,
  type SModule,
  type STopic,
  type SSection,
  type SContentGroup,
  type StructureLevel,
  type ContainerLevel,
  mergedChildren,
  acceptsChild,
} from "../types/structure";
import {
  getCourseStructure,
  seedDefaultStructure,
  seedDefaultTopic,
  createModule,
  createArticle,
  createBlock,
  createComponent,
  renameStructureNode,
  deleteStructureNode,
  reorderStructureNodes,
  moveContentNode,
  updateComponentLayout,
  type ComponentTypeOption,
} from "../api/adaptAuthoring";

const EMPTY: CourseStructure = { courseTitle: "Course", modules: [], topics: [] };

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
// The {modules, topics} arrays of a container (course or a menu), by reference.
function container(s: CourseStructure, containerId: string, courseId: string): {
  modules: SModule[];
  topics: STopic[];
} {
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

export function useCourseStructure(courseId: string, courseTitle = "Course") {
  const [state, setState] = useState<CourseStructure>({ ...EMPTY, courseTitle });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const seededFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!courseId) {
      setState({ ...EMPTY, courseTitle });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let next = await getCourseStructure(courseId, courseTitle);
      const isEmpty = next.modules.length === 0 && next.topics.length === 0;
      if (isEmpty && seededFor.current !== courseId) {
        seededFor.current = courseId;
        await seedDefaultStructure(courseId);
        next = await getCourseStructure(courseId, courseTitle);
      }
      setState(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load course structure"));
    } finally {
      setLoading(false);
    }
  }, [courseId, courseTitle]);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(async () => {
    if (!courseId) return;
    try {
      setState(await getCourseStructure(courseId, courseTitle));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to refresh course structure"));
    }
  }, [courseId, courseTitle]);

  const mutate = useCallback(
    async (fn: () => Promise<unknown>, failMsg: string) => {
      if (!courseId) return;
      setBusy(true);
      try {
        await fn();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(failMsg));
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [courseId, refresh]
  );

  const addModuleAt = useCallback(
    (parentId: string) =>
      mutate(async () => {
        const order = childCount(state, parentId, courseId) + 1;
        const moduleId = await createModule(courseId, parentId, "New Module", order);
        await seedDefaultTopic(courseId, moduleId, "New Topic", 1);
      }, "Failed to add module"),
    [mutate, state, courseId]
  );
  const addModule = useCallback(() => addModuleAt(courseId), [addModuleAt, courseId]);
  const addSubModule = useCallback((parentModuleId: string) => addModuleAt(parentModuleId), [addModuleAt]);

  const addTopic = useCallback(
    (parentId?: string | null) =>
      mutate(async () => {
        const parent = parentId || courseId;
        const order = childCount(state, parent, courseId) + 1;
        await seedDefaultTopic(courseId, parent, "New Topic", order);
      }, "Failed to add topic"),
    [mutate, state, courseId]
  );

  const addSection = useCallback(
    (topicId: string) =>
      mutate(async () => {
        const order = (findTopic(state, topicId)?.sections.length ?? 0) + 1;
        const articleId = await createArticle(courseId, topicId, "New Section", order);
        await createBlock(courseId, articleId, "New Content Group", 1);
      }, "Failed to add section"),
    [mutate, state, courseId]
  );

  const addContentGroup = useCallback(
    (sectionId: string) =>
      mutate(async () => {
        const order = (findSection(state, sectionId)?.contentGroups.length ?? 0) + 1;
        await createBlock(courseId, sectionId, "New Content Group", order);
      }, "Failed to add content group"),
    [mutate, state, courseId]
  );

  const addComponent = useCallback(
    (blockId: string, componentType: ComponentTypeOption) => {
      const count = findContentGroup(state, blockId)?.components.length ?? 0;
      if (count >= 2) {
        setError(new Error("A content group can contain at most two components (left and right)."));
        return Promise.resolve();
      }
      const layout = count === 0 ? "left" : "right";
      return mutate(() => createComponent(courseId, blockId, componentType, count + 1, layout), "Failed to add component");
    },
    [mutate, state, courseId]
  );

  const rename = useCallback(
    async (level: StructureLevel, id: string, title: string) => {
      setState((prev) => { const next = structuredClone(prev); setTitleById(next, id, title); return next; });
      try {
        await renameStructureNode(level, id, title);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to rename item"));
        await refresh();
      }
    },
    [refresh]
  );

  const remove = useCallback(
    (level: StructureLevel, id: string) => {
      if (level === "topic") {
        const inModule = moduleContainingTopic(state, id);
        if (inModule && inModule.topics.length <= 1) {
          setError(new Error("Each module must contain at least one topic."));
          return Promise.resolve();
        }
        if (!inModule && state.topics.length <= 1) {
          setError(new Error("At least one topic is required at the course level."));
          return Promise.resolve();
        }
      }
      if (level === "component") {
        // Any component may be deleted — including the last one (the block may
        // become empty; the Tree warns the user first). If two existed, the
        // survivor becomes the single (left) component.
        const survivor = findGroupOfComponent(state, id)?.components.find((c) => c.id !== id);
        return mutate(async () => {
          await deleteStructureNode("component", id);
          if (survivor) await updateComponentLayout(survivor.id, "left");
        }, "Failed to delete item");
      }
      return mutate(() => deleteStructureNode(level, id), "Failed to delete item");
    },
    [mutate, state]
  );

  // Drag-and-drop move. `beforeId` = insert before that sibling (reorder / move
  // as sibling); null = append into the new parent. Validates the target level,
  // module cycles, the two-component cap, and the mandatory-topic rules.
  const moveNode = useCallback(
    (level: StructureLevel, id: string, newParentId: string, beforeId: string | null) => {
      const s = state;
      const newParentLevel = containerLevelOf(s, newParentId, courseId);
      if (!newParentLevel || !acceptsChild(newParentLevel, level)) {
        setError(new Error("That item can't be placed there."));
        return Promise.resolve();
      }
      // Prevent dropping a module into itself or one of its descendants.
      if (level === "module") {
        const banned = new Set<string>();
        const collect = (m: SModule) => { banned.add(m.id); m.modules.forEach(collect); };
        const dragged = findModule(s, id);
        if (dragged) collect(dragged);
        if (banned.has(newParentId)) {
          setError(new Error("A module can't be moved inside itself."));
          return Promise.resolve();
        }
      }
      // A content group holds at most two components.
      if (level === "component") {
        const target = findContentGroup(s, newParentId);
        const source = findGroupOfComponent(s, id);
        if (target && source && target.id !== source.id && target.components.length >= 2) {
          setError(new Error("A content group can contain at most two components."));
          return Promise.resolve();
        }
      }
      // Mandatory-topic rules must survive a move-out.
      if (level === "topic") {
        const srcModule = moduleContainingTopic(s, id);
        if (srcModule && srcModule.id !== newParentId && srcModule.topics.length <= 1) {
          setError(new Error("Each module must contain at least one topic."));
          return Promise.resolve();
        }
        if (!srcModule && newParentId !== courseId && s.topics.length <= 1) {
          setError(new Error("At least one topic is required at the course level."));
          return Promise.resolve();
        }
      }

      // ── Optimistic reparent ──
      const next = structuredClone(s);
      const detached = detachNode(next, level, id, courseId);
      if (!detached) return Promise.resolve();
      const { node, oldParentId } = detached;

      let reorderLevel: StructureLevel;
      let newIds: string[];
      let oldIds: string[] | null = null;

      if (level === "module" || level === "topic") {
        reorderLevel = "module"; // both are contentobjects
        const c = container(next, newParentId, courseId);
        // Desired merged order with the node inserted before `beforeId`.
        let ids = mergedChildren(c.modules, c.topics).map((x) => x.node.id).filter((x) => x !== node.id);
        if (beforeId && ids.includes(beforeId)) ids.splice(ids.indexOf(beforeId), 0, node.id);
        else ids.push(node.id);
        (level === "module" ? c.modules : c.topics).push(node as SModule & STopic);
        const byId = new Map<string, SModule | STopic>([...c.modules, ...c.topics].map((n) => [n.id, n]));
        ids.forEach((cid, i) => { const n = byId.get(cid); if (n) n.sortOrder = i + 1; });
        newIds = ids;
        if (oldParentId !== newParentId) {
          const oc = container(next, oldParentId, courseId);
          const oids = mergedChildren(oc.modules, oc.topics).map((x) => x.node.id);
          const obyId = new Map<string, SModule | STopic>([...oc.modules, ...oc.topics].map((n) => [n.id, n]));
          oids.forEach((cid, i) => { const n = obyId.get(cid); if (n) n.sortOrder = i + 1; });
          oldIds = oids;
        }
      } else {
        reorderLevel = level;
        const arr = getChildArray(next, level, newParentId);
        if (!arr) return Promise.resolve();
        if (beforeId) {
          const i = arr.findIndex((x) => x.id === beforeId);
          if (i >= 0) arr.splice(i, 0, node); else arr.push(node);
        } else arr.push(node);
        newIds = arr.map((x) => x.id);
        if (oldParentId !== newParentId) {
          const oarr = getChildArray(next, level, oldParentId);
          oldIds = oarr ? oarr.map((x) => x.id) : null;
        }
      }

      setState(next);

      const movedOrder = newIds.indexOf(id) + 1;
      const capturedOldIds = oldIds;
      void (async () => {
        setBusy(true);
        try {
          await moveContentNode(level, id, newParentId, movedOrder);
          await reorderStructureNodes(reorderLevel, newIds);
          if (capturedOldIds) await reorderStructureNodes(reorderLevel, capturedOldIds);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err : new Error("Failed to move item"));
          await refresh();
        } finally {
          setBusy(false);
        }
      })();
      return Promise.resolve();
    },
    [state, courseId, refresh]
  );

  return {
    state,
    loading,
    busy,
    error,
    refresh,
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

// ── Move helpers (operate on a cloned CourseStructure) ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detachNode(
  s: CourseStructure,
  level: StructureLevel,
  id: string,
  courseId: string
): { node: any; oldParentId: string } | null {
  if (level === "component") {
    for (const g of allGroups(s)) {
      const i = g.components.findIndex((c) => c.id === id);
      if (i >= 0) return { node: g.components.splice(i, 1)[0], oldParentId: g.id };
    }
  } else if (level === "contentGroup") {
    for (const sec of allSections(s)) {
      const i = sec.contentGroups.findIndex((c) => c.id === id);
      if (i >= 0) return { node: sec.contentGroups.splice(i, 1)[0], oldParentId: sec.id };
    }
  } else if (level === "section") {
    for (const t of allTopics(s)) {
      const i = t.sections.findIndex((x) => x.id === id);
      if (i >= 0) return { node: t.sections.splice(i, 1)[0], oldParentId: t.id };
    }
  } else if (level === "topic") {
    for (const c of allContainers(s, courseId)) {
      const i = c.topics.findIndex((x) => x.id === id);
      if (i >= 0) return { node: c.topics.splice(i, 1)[0], oldParentId: c.id };
    }
  } else if (level === "module") {
    for (const c of allContainers(s, courseId)) {
      const i = c.modules.findIndex((x) => x.id === id);
      if (i >= 0) return { node: c.modules.splice(i, 1)[0], oldParentId: c.id };
    }
  }
  return null;
}

// The single-kind child array (section / contentGroup / component) of a parent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getChildArray(s: CourseStructure, level: StructureLevel, parentId: string): any[] | null {
  if (level === "component") return findContentGroup(s, parentId)?.components ?? null;
  if (level === "contentGroup") return findSection(s, parentId)?.contentGroups ?? null;
  if (level === "section") return findTopic(s, parentId)?.sections ?? null;
  return null;
}
