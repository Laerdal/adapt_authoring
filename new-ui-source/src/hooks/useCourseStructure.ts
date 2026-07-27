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
  mergedChildren,
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
function findModule(s: CourseStructure, id: string): SModule | undefined {
  return allModules(s).find((m) => m.id === id);
}
// The direct children (menus + pages) of a container (the course, or a menu).
function container(s: CourseStructure, containerId: string, courseId: string): {
  modules: SModule[];
  topics: STopic[];
} {
  if (containerId === courseId) return { modules: s.modules, topics: s.topics };
  const m = findModule(s, containerId);
  return { modules: m?.modules ?? [], topics: m?.topics ?? [] };
}
function childCount(s: CourseStructure, containerId: string, courseId: string): number {
  const c = container(s, containerId, courseId);
  return c.modules.length + c.topics.length;
}
function moduleContainingTopic(s: CourseStructure, topicId: string): SModule | undefined {
  return allModules(s).find((m) => m.topics.some((t) => t.id === topicId));
}
function findTopic(s: CourseStructure, id: string): STopic | undefined {
  return allTopics(s).find((t) => t.id === id);
}
function findSection(s: CourseStructure, id: string): SSection | undefined {
  return allTopics(s).flatMap((t) => t.sections).find((sec) => sec.id === id);
}
function findContentGroup(s: CourseStructure, id: string): SContentGroup | undefined {
  return allTopics(s).flatMap((t) => t.sections).flatMap((sec) => sec.contentGroups).find((cg) => cg.id === id);
}
function findGroupOfComponent(s: CourseStructure, componentId: string): SContentGroup | undefined {
  return allTopics(s)
    .flatMap((t) => t.sections)
    .flatMap((sec) => sec.contentGroups)
    .find((cg) => cg.components.some((c) => c.id === componentId));
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

  // Add a module (top-level) or sub-module (under a parent menu). New items are
  // appended after all existing children of the container, so they land after
  // the current topics/modules rather than above them.
  const addModuleAt = useCallback(
    (parentId: string) =>
      mutate(async () => {
        const order = childCount(state, parentId, courseId) + 1;
        const moduleId = await createModule(courseId, parentId, "New Module", order);
        // A module must contain at least one topic.
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
      // A content group holds at most two components: first → left, second → right.
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
        const group = findGroupOfComponent(state, id);
        const comps = group?.components ?? [];
        if (comps.length <= 1) {
          setError(new Error("A content group must contain at least one component."));
          return Promise.resolve();
        }
        const survivor = comps.find((c) => c.id !== id);
        return mutate(async () => {
          await deleteStructureNode("component", id);
          if (survivor) await updateComponentLayout(survivor.id, "left");
        }, "Failed to delete item");
      }
      return mutate(() => deleteStructureNode(level, id), "Failed to delete item");
    },
    [mutate, state]
  );

  // Reorder a single-kind sibling list (sections / content groups / components).
  const reorder = useCallback(
    async (level: "section" | "contentGroup" | "component", parentId: string, from: number, to: number) => {
      if (from === to) return;
      let orderedIds: string[] = [];
      setState((prev) => {
        const next = structuredClone(prev);
        const move = <T,>(arr: T[]) => { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); };
        if (level === "section") { const t = findTopic(next, parentId); if (t) { move(t.sections); orderedIds = t.sections.map((x) => x.id); } }
        else if (level === "contentGroup") { const sec = findSection(next, parentId); if (sec) { move(sec.contentGroups); orderedIds = sec.contentGroups.map((x) => x.id); } }
        else { const cg = findContentGroup(next, parentId); if (cg) { move(cg.components); orderedIds = cg.components.map((x) => x.id); } }
        return next;
      });
      try {
        if (orderedIds.length) await reorderStructureNodes(level, orderedIds);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to reorder items"));
        await refresh();
      }
    },
    [refresh]
  );

  // Reorder a container's merged children (modules + topics). Both are
  // contentobjects, so a single _sortOrder renumber covers the mixed list.
  const reorderChildren = useCallback(
    async (containerId: string, from: number, to: number) => {
      if (from === to) return;
      let orderedIds: string[] = [];
      setState((prev) => {
        const next = structuredClone(prev);
        const c = container(next, containerId, courseId);
        const merged = mergedChildren(c.modules, c.topics);
        const [moved] = merged.splice(from, 1);
        merged.splice(to, 0, moved);
        merged.forEach((child, i) => { child.node.sortOrder = i + 1; });
        orderedIds = merged.map((child) => child.node.id);
        return next;
      });
      try {
        if (orderedIds.length) await reorderStructureNodes("module", orderedIds);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to reorder items"));
        await refresh();
      }
    },
    [courseId, refresh]
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
    reorder,
    reorderChildren,
  };
}
