import { describe, expect, it } from 'vitest';
import { flattenStructure, moveCourseStructure } from '../../hooks/useCourseStructure';
import { computeDrop } from '../../components/course/CourseStructureTree';
import type { CourseStructure, STopic } from '../../types/structure';
import type { ContentPageData } from './pageEditorWorkspace';
import { projectEditorStructure, structureWithCanvasOrder } from './editorStructureMoves';

const topic = (id: string): STopic => ({
  id, title: id, sortOrder: 1,
  sections: [{ id: `${id}-section`, title: 'Section', contentGroups: [
    { id: `${id}-group`, title: 'Group', components: [{ id: `${id}-first`, title: 'First', componentKey: 'text', layout: 'left' }, { id: `${id}-second`, title: 'Second', componentKey: 'text', layout: 'right' }] },
    { id: `${id}-empty`, title: 'Empty', components: [] },
  ] }],
});
const structure = (): CourseStructure => ({
  courseTitle: 'Course', topics: [topic('page-one'), { ...topic('page-two'), sortOrder: 2 }],
  modules: [{ id: 'module', title: 'Module', sortOrder: 3, topics: [topic('nested')], modules: [
    { id: 'submodule', title: 'Submodule', sortOrder: 2, topics: [topic('deep')], modules: [] },
  ] }],
});

describe('Page Editor structure moves', () => {
  it('uses Course Setup sibling and compatible-parent drop plans', () => {
    expect(computeDrop({ id: 'first', level: 'component' }, { id: 'second', level: 'component', parentId: 'group', parentLevel: 'contentGroup' })).toEqual({ newParentId: 'group', beforeId: 'second', mode: 'before' });
    expect(computeDrop({ id: 'first', level: 'component' }, { id: 'second', level: 'component', parentId: 'group', parentLevel: 'contentGroup', nextSiblingId: 'third' }, 'after')).toEqual({ newParentId: 'group', beforeId: 'third', mode: 'after' });
    expect(computeDrop({ id: 'last', level: 'section' }, { id: 'other', level: 'section', parentId: 'topic', parentLevel: 'topic' }, 'after')).toEqual({ newParentId: 'topic', beforeId: null, mode: 'after' });
    expect(computeDrop({ id: 'next', level: 'topic' }, { id: 'current', level: 'module', parentId: 'course', parentLevel: 'course', nextSiblingId: 'next' }, 'after')).toBeNull();
    expect(computeDrop({ id: 'component', level: 'component' }, { id: 'group', level: 'contentGroup', parentId: 'section', parentLevel: 'section' })).toEqual({ newParentId: 'group', beforeId: null, mode: 'into' });
    expect(computeDrop({ id: 'component', level: 'component' }, { id: 'topic', level: 'topic', parentId: 'course', parentLevel: 'course' })).toBeNull();

    const siblingRows = [
      { dragged: { id: 'drag-module', level: 'module' as const }, row: { id: 'module', level: 'module' as const, parentId: 'course', parentLevel: 'course' as const, nextSiblingId: 'topic' } },
      { dragged: { id: 'drag-topic', level: 'topic' as const }, row: { id: 'topic', level: 'topic' as const, parentId: 'course', parentLevel: 'course' as const, nextSiblingId: 'module' } },
      { dragged: { id: 'drag-section', level: 'section' as const }, row: { id: 'section', level: 'section' as const, parentId: 'topic', parentLevel: 'topic' as const, nextSiblingId: 'section-next' } },
      { dragged: { id: 'drag-group', level: 'contentGroup' as const }, row: { id: 'group', level: 'contentGroup' as const, parentId: 'section', parentLevel: 'section' as const, nextSiblingId: 'group-next' } },
      { dragged: { id: 'drag-component', level: 'component' as const }, row: { id: 'component', level: 'component' as const, parentId: 'group', parentLevel: 'contentGroup' as const, nextSiblingId: 'component-next' } },
    ];
    for (const { dragged, row } of siblingRows) {
      expect(computeDrop(dragged, row, 'after')).toEqual({ newParentId: row.parentId, beforeId: row.nextSiblingId, mode: 'after' });
    }
  });

  it('reorders Components and recomputes layouts without mutating the baseline', () => {
    const saved = structure();
    const next = moveCourseStructure(saved, 'course', 'component', 'page-one-second', 'page-one-group', 'page-one-first');
    expect(next.topics[0].sections[0].contentGroups[0].components.map(component => component.id)).toEqual(['page-one-second', 'page-one-first']);
    expect(flattenStructure(next, 'course').find(node => node.id === 'page-one-second')?.layout).toBe('left');
    expect(saved.topics[0].sections[0].contentGroups[0].components[0].id).toBe('page-one-first');
  });

  it('supports Section, Group, Topic and Module reparenting', () => {
    expect(flattenStructure(moveCourseStructure(structure(), 'course', 'section', 'page-one-section', 'page-two', null), 'course').find(node => node.id === 'page-one-section')?.parentId).toBe('page-two');
    expect(flattenStructure(moveCourseStructure(structure(), 'course', 'contentGroup', 'page-one-group', 'page-two-section', null), 'course').find(node => node.id === 'page-one-group')?.parentId).toBe('page-two-section');
    expect(flattenStructure(moveCourseStructure(structure(), 'course', 'topic', 'page-one', 'module', null), 'course').find(node => node.id === 'page-one')?.parentId).toBe('module');
    expect(flattenStructure(moveCourseStructure(structure(), 'course', 'module', 'submodule', 'course', null), 'course').find(node => node.id === 'submodule')?.parentId).toBe('course');
  });

  it('rejects cycles, incompatible parents, full Groups and required-Topic violations', () => {
    expect(() => moveCourseStructure(structure(), 'course', 'module', 'module', 'submodule', null)).toThrow("inside itself");
    expect(() => moveCourseStructure(structure(), 'course', 'section', 'page-one-section', 'module', null)).toThrow("can't be placed");
    expect(() => moveCourseStructure(structure(), 'course', 'component', 'page-one-first', 'page-two-group', null)).toThrow('at most two');
    expect(() => moveCourseStructure(structure(), 'course', 'topic', 'nested', 'course', null)).toThrow('at least one topic');
    const onlyRoot = structure();
    onlyRoot.topics.pop();
    expect(() => moveCourseStructure(onlyRoot, 'course', 'topic', 'page-one', 'module', null)).toThrow('course level');
  });

  it('preserves edited content across a Component reparent and normalizes both Groups', () => {
    const saved = structure();
    const pages = saved.topics.map(page => ({
      id: page.id, title: page.title, subPages: [],
      articles: page.sections.map(section => ({ id: section.id, title: section.title, description: 'Edited section', blocks: section.contentGroups.map(group => ({ id: group.id, title: group.title, description: 'Edited group', components: group.components.map(component => ({ id: component.id, layout: component.layout, type: 'text', settings: { title: component.title, description: 'Unsaved body', properties: { body: 'Unsaved body' } } })) })) })),
    })) as unknown as ContentPageData[];
    saved.modules = [];
    const next = moveCourseStructure(saved, 'course', 'component', 'page-one-first', 'page-one-empty', null);
    const projected = projectEditorStructure(next, pages);
    const groups = projected[0].articles[0].blocks;
    expect(groups[0].components[0].layout).toBe('full');
    expect(groups[1].components[0]).toMatchObject({ id: 'page-one-first', layout: 'full', settings: { description: 'Unsaved body', properties: { body: 'Unsaved body' } } });
    expect(pages[0].articles[0].blocks[0].components).toHaveLength(2);
    expect(structureWithCanvasOrder(saved, pages).topics[0].sections[0].contentGroups[0].components).toHaveLength(2);
  });
});