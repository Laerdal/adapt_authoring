import type { CourseStructure, SModule, STopic, StructureLevel } from '../../types/structure';
import { mergedChildren } from '../../types/structure';
import { flattenStructure } from '../../hooks/useCourseStructure';
import type { ContentPageData } from './pageEditorWorkspace';

export interface EditorDeletionError {
  message: string;
  followUp?: string | {
    beforeReplaceIcon: string;
    afterReplaceIcon: string;
  };
}

export function getEditorDeletionError(structure: CourseStructure, courseId: string, level: StructureLevel, id: string): EditorDeletionError | null {
  const positions = flattenStructure(structure, courseId);
  const target = positions.find(position => position.id === id && position.level === level);
  if (!target) return { message: 'This item is no longer available.', followUp: 'Reload the course before trying again.' };
  const siblings = positions.filter(position => position.parentId === target.parentId && (level !== 'topic' || position.level === 'topic'));
  if (siblings.length > 1) return null;
  if (level === 'component') return {
    message: 'Each content group must contain at least one component.',
    followUp: {
      beforeReplaceIcon: 'Add another component to this content group before deleting this one, or use Replace (',
      afterReplaceIcon: ') component option for the selected component in middle canvas.',
    },
  };
  if (level === 'contentGroup') return { message: 'Each section must contain at least one content group.', followUp: 'Add another content group before deleting this one.' };
  if (level === 'section') return { message: 'Each topic must contain at least one section.', followUp: 'Add another section before deleting this one.' };
  if (level === 'topic') return { message: 'Each course or module must contain at least one topic.', followUp: 'Add another topic before deleting this one.' };
  return { message: 'Each course or module must contain at least one child.', followUp: 'Add another module or topic before deleting this one.' };
}

export function structureTopics(structure: CourseStructure): STopic[] {
  const topics: STopic[] = [];
  const visit = (modules: SModule[], pages: STopic[]) => {
    for (const child of mergedChildren(modules, pages)) {
      if (child.kind === 'topic') topics.push(child.node);
      else visit(child.node.modules, child.node.topics);
    }
  };
  visit(structure.modules, structure.topics);
  return topics;
}

export function projectEditorStructure(structure: CourseStructure, pages: ContentPageData[]): ContentPageData[] {
  const pageById = new Map(pages.map(page => [page.id, page]));
  const articleById = new Map(pages.flatMap(page => page.articles).map(article => [article.id, article]));
  const blockById = new Map(pages.flatMap(page => page.articles.flatMap(article => article.blocks)).map(block => [block.id, block]));
  const componentById = new Map(pages.flatMap(page => page.articles.flatMap(article => article.blocks.flatMap(block => block.components))).map(component => [component.id, component]));
  return structureTopics(structure).map(topic => {
    const page = pageById.get(topic.id);
    if (!page) throw new Error('Topic is missing from the editor draft');
    return {
      ...page,
      articles: topic.sections.map(section => {
        const article = articleById.get(section.id);
        if (!article) throw new Error('Section is missing from the editor draft');
        return {
          ...article,
          blocks: section.contentGroups.map(group => {
            const block = blockById.get(group.id);
            if (!block) throw new Error('Content Group is missing from the editor draft');
            return {
              ...block,
              components: group.components.map((node, index) => {
                const component = componentById.get(node.id);
                if (!component) throw new Error('Component is missing from the editor draft');
                return { ...component, layout: group.components.length === 1 ? 'full' as const : index === 0 ? 'left' as const : 'right' as const };
              }),
            };
          }),
        };
      }),
    };
  });
}

export function structureWithCanvasOrder(structure: CourseStructure, pages: ContentPageData[]): CourseStructure {
  const next = structuredClone(structure);
  const articleById = new Map(structureTopics(next).flatMap(topic => topic.sections).map(article => [article.id, article]));
  const blockById = new Map([...articleById.values()].flatMap(article => article.contentGroups).map(block => [block.id, block]));
  const componentById = new Map([...blockById.values()].flatMap(block => block.components).map(component => [component.id, component]));
  const pageById = new Map(pages.map(page => [page.id, page]));
  for (const topic of structureTopics(next)) {
    const page = pageById.get(topic.id);
    if (!page) continue;
    topic.sections = page.articles.map(article => {
      const section = articleById.get(article.id)!;
      return {
        ...section,
        contentGroups: article.blocks.map(block => ({
          ...blockById.get(block.id)!,
          components: block.components.map(component => ({ ...componentById.get(component.id)!, layout: component.layout })),
        })),
      };
    });
  }
  return next;
}