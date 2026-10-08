import type { CourseStructure, SModule, STopic } from '../../types/structure';
import { mergedChildren } from '../../types/structure';
import type { ContentPageData } from './pageEditorWorkspace';

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