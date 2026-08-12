import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MenuPageCanvas,
  ContentPageCanvas,
  SubPageCanvas,
  ArticleCanvas,
} from "../../components/editor/index";
import AddComponentDrawer from "../../components/course/AddComponentDrawer";
import AddTemplateDrawer from "../../components/course/AddTemplateDrawer";
import CourseStructureMap from "../../components/course/CourseStructureMap";
import { StructureIcon, STRUCTURE_ICON_COLOR_CLASS } from "../../components/course/StructureIcons";
import PageEditorTopBar from "./pageEditorTopBar";
import PageEditorNavigation from "./pageEditorNavigation";
import {
  createArticle,
  createBlock,
  createComponent,
  createTopic,
  deleteStructureNode,
  getCourseStructure,
  pasteTemplateIntoCourse,
  type ComponentTypeOption,
  type DashboardTemplate,
  updateComponentLayout,
  updateStructureNode,
} from "../../api/adaptAuthoring";
import type { MenuPageData } from "../../components/editor/MenuPageCanvas";
import type { Course } from "../../types/course";
import {
  NEW_CONTENT_GROUP_TITLE,
  NEW_SECTION_TITLE,
  NEW_TOPIC_TITLE,
} from "../../constants/structureDefaults";

const ICON_BASE = "/new/assets/icons";

function MaskIcon({ file, className }: { file: string; className?: string }) {
  const iconPath = `${ICON_BASE}/${file}`;
  return (
    <span
      aria-hidden="true"
      className={className ?? "block w-[14px] h-[14px] shrink-0 bg-current"}
      style={{
        WebkitMaskImage: `url(${iconPath})`,
        maskImage: `url(${iconPath})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

const defaultMenuPage: MenuPageData = {
  logoUrl: null,
  title: "",
  subtitle: "",
  body: "",
  menuStyle: "Box Menu",
  menuLockType: "",
  textAlign: "center",
  bgType: "Color",
  bgColor: "#1e3a5f",
  bgImageUrl: null,
};

function toComponentType(componentKey: string): ComponentType {
  switch (componentKey.toLowerCase()) {
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "accordion":
      return "Accordion";
    case "quiz":
    case "mcq":
      return "Quiz";
    case "text":
    default:
      return "Text";
  }
}

function mapStructureToPages(
  structure: Awaited<ReturnType<typeof getCourseStructure>>
): ContentPageData[] {
  const pages: ContentPageData[] = [];

  const pushTopic = (topic: {
    id: string;
    title: string;
    description?: string;
    sections: Array<{
      id: string;
      title: string;
      description?: string;
      instruction?: string;
      contentGroups: Array<{
        id: string;
        title: string;
        description?: string;
        instruction?: string;
        components: Array<{ id: string; title: string; componentKey: string; layout?: "full" | "left" | "right"; description?: string; url?: string }>;
      }>;
    }>;
  }) => {
    pages.push({
      id: topic.id,
      title: topic.title || "Untitled Page",
      description: topic.description || "",
      subPages: [],
      articles: topic.sections.map((section) => ({
        id: section.id,
        title: section.title || "Untitled Article",
        description: section.description || "",
        instruction: section.instruction || "",
        blocks: section.contentGroups.map((group) => ({
          id: group.id,
          title: group.title || "Untitled Block",
          description: group.description || "",
          instruction: group.instruction || "",
          components: group.components.map((component) => ({
            id: component.id,
            type: toComponentType(component.componentKey),
            layout: component.layout,
            settings: {
              title: component.title || "",
              description: component.description || "",
              url: component.url || "",
              componentKey: component.componentKey,
            },
          })),
        })),
      })),
    });
  };

  const walkModule = (module: {
    modules: Array<any>;
    topics: Array<any>;
  }) => {
    module.topics.forEach(pushTopic);
    module.modules.forEach(walkModule);
  };

  structure.topics.forEach(pushTopic);
  structure.modules.forEach(walkModule);

  return pages;
}

export type ComponentType = "Image" | "Video" | "Accordion" | "Text" | "Quiz";

export interface ComponentData {
  id: string;
  type: ComponentType;
  layout?: "full" | "left" | "right";
  settings: {
    title?: string;
    description?: string;
    url?: string;
    [key: string]: any;
  };
}

export interface BlockData {
  id: string;
  title: string;
  description: string;
  instruction: string;
  components: ComponentData[];
}

export interface ArticleData {
  id: string;
  title: string;
  description: string;
  instruction: string;
  blocks: BlockData[];
}

export interface SubPageData {
  id: string;
  title: string;
  description: string;
}

export interface ContentPageData {
  id: string;
  title: string;
  description: string;
  articles: ArticleData[];
  subPages: SubPageData[];
}

interface CourseEditorProps {
  courseId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialTheme?: string;
  initialMenu?: string;
}

export default function CourseEditor({
  courseId = "new-course",
  initialTitle = "Untitled Course",
  initialDescription = "",
  initialTheme = "LIFE Theme",
  initialMenu = "LIFE Menu",
}: CourseEditorProps) {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [courseTitle, setCourseTitle] = useState(initialTitle);
  const [courseDescription] = useState(initialDescription);
  const [courseTheme] = useState(initialTheme);
  const [courseMenu] = useState(initialMenu);

  const [menuPageCreated, setMenuPageCreated] = useState(false);
  const [menuSelected, setMenuSelected] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelType, setRightPanelType] = useState<"menu" | "page" | "subpage" | "article" | "block" | "component" | "addComponent" | "structure">("menu");
  const [showStructureMap, setShowStructureMap] = useState(false);
  const [menuData, setMenuData] = useState<MenuPageData>(defaultMenuPage);
  const [isLoadingStructure, setIsLoadingStructure] = useState(true);
  const [structureLoadError, setStructureLoadError] = useState<string | null>(null);

  const [contentPages, setContentPages] = useState<ContentPageData[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedSubPageId, setSelectedSubPageId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [hasCanvasSelection, setHasCanvasSelection] = useState(false);
  const structureLoadRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const [addComponentTarget, setAddComponentTarget] = useState<{
    pageId: string;
    articleId: string;
    blockId: string;
  } | null>(null);
  const [addTemplateTarget, setAddTemplateTarget] = useState<{
    level: "topic" | "section" | "group" | "component";
    pageId: string;
    articleId?: string;
    blockId?: string;
  } | null>(null);

  const loadStructureFromDatabase = useCallback(async (selection?: {
    pageId?: string | null;
    articleId?: string | null;
    blockId?: string | null;
    componentId?: string | null;
  }) => {
    const requestId = ++structureLoadRequestIdRef.current;
    const isCurrentRequest = () => isMountedRef.current && requestId === structureLoadRequestIdRef.current;

    if (!courseId || courseId === "new-course") {
      if (isCurrentRequest()) {
        setIsLoadingStructure(false);
      }
      return;
    }

    if (isCurrentRequest()) {
      setIsLoadingStructure(true);
      setStructureLoadError(null);
    }

    try {
      const structure = await getCourseStructure(courseId, courseTitle);
      if (!isCurrentRequest()) return;

      const pages = mapStructureToPages(structure);
      const fallbackPage = pages[0] ?? null;
      const page = pages.find((item) => item.id === selection?.pageId) ?? fallbackPage;
      const article = selection?.articleId && page
        ? page.articles.find((item) => item.id === selection.articleId) ?? null
        : null;
      const block = selection?.blockId && article
        ? article.blocks.find((item) => item.id === selection.blockId) ?? null
        : null;
      const component = selection?.componentId && block
        ? block.components.find((item) => item.id === selection.componentId) ?? null
        : null;

      setContentPages(pages);
      setMenuPageCreated(pages.length > 0);
      setMenuSelected(false);
      setSelectedPageId(page?.id ?? null);
      setSelectedSubPageId(null);
      setSelectedArticleId(article?.id ?? null);
      setSelectedBlockId(block?.id ?? null);
      setSelectedComponentId(component?.id ?? null);

      const nextHasSelection = !!(component || block || article || page);
      setHasCanvasSelection(nextHasSelection);
      setRightPanelOpen(nextHasSelection);
      setRightPanelType(
        component
          ? "component"
          : block
            ? "block"
            : article
              ? "article"
              : page
                ? "page"
                : "menu"
      );
    } catch (error) {
      if (!isCurrentRequest()) return;

      setContentPages([]);
      setMenuPageCreated(false);
      setMenuSelected(false);
      setSelectedPageId(null);
      setSelectedSubPageId(null);
      setSelectedArticleId(null);
      setSelectedBlockId(null);
      setSelectedComponentId(null);
      setHasCanvasSelection(false);
      setRightPanelOpen(false);
      setStructureLoadError(
        error instanceof Error ? error.message : "Failed to load course structure"
      );
    } finally {
      if (isCurrentRequest()) {
        setIsLoadingStructure(false);
      }
    }
  }, [courseId, courseTitle]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      structureLoadRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void loadStructureFromDatabase();
  }, [loadStructureFromDatabase]);

  function handleMenuPageCreate() {
    setMenuPageCreated(true);
    setMenuSelected(true);
    setRightPanelOpen(true);
  }

  function updateMenuData(patch: Partial<MenuPageData>) {
    setMenuData((prev) => ({ ...prev, ...patch }));
  }

  function handleCanvasClick() {
    if (!menuPageCreated) return;

    setMenuSelected(false);
    setSelectedSubPageId(null);
    setSelectedArticleId(null);
    setSelectedBlockId(null);
    setSelectedComponentId(null);
    setHasCanvasSelection(false);
    setRightPanelOpen(false);
  }

  function handleMenuSelect() {
    setMenuSelected(true);
    setSelectedPageId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("menu");
  }

  async function handleAddPage() {
    try {
      const newPageId = await createTopic(courseId, courseId, NEW_TOPIC_TITLE, contentPages.length + 1);
      await loadStructureFromDatabase({ pageId: newPageId });
    } catch (error) {
      console.error("Failed to add topic", error);
    }
  }

  async function handleAddArticle(pageId: string) {
    try {
      const page = contentPages.find((item) => item.id === pageId);
      const newArticleId = await createArticle(courseId, pageId, NEW_SECTION_TITLE, (page?.articles.length ?? 0) + 1);
      await loadStructureFromDatabase({ pageId, articleId: newArticleId });
    } catch (error) {
      console.error("Failed to add section", error);
    }
  }

  function handleAddSubPage(pageId: string) {
    const newSubPageId = `subpage-${Date.now()}`;
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              subPages: [
                ...p.subPages,
                { id: newSubPageId, title: "Untitled Sub Page", description: "" },
              ],
            }
          : p
      )
    );
    setSelectedPageId(pageId);
    setSelectedSubPageId(newSubPageId);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("subpage");
  }

  function updateArticle(pageId: string, articleId: string, patch: Partial<ArticleData>) {
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: p.articles.map((a) =>
                a.id === articleId ? { ...a, ...patch } : a
              ),
            }
          : p
      )
    );
    void updateStructureNode("section", articleId, patch as Record<string, unknown>).catch((error) => {
      console.error("Failed to update section", error);
    });
  }

  function updateSubPage(pageId: string, subPageId: string, patch: Partial<SubPageData>) {
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              subPages: p.subPages.map((s) =>
                s.id === subPageId ? { ...s, ...patch } : s
              ),
            }
          : p
      )
    );
  }

  async function deleteArticle(pageId: string, articleId: string) {
    try {
      await deleteStructureNode("section", articleId);
      await loadStructureFromDatabase({ pageId });
    } catch (error) {
      console.error("Failed to delete section", error);
    }
  }

  function handleArticleSelect(pageId: string, articleId: string) {
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedSubPageId(null);
    setSelectedBlockId(null);
    setSelectedComponentId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("article");
  }

  function handleBlockSelect(pageId: string, articleId: string, blockId: string) {
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedSubPageId(null);
    setSelectedBlockId(blockId);
    setSelectedComponentId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("block");
  }

  function deleteSubPage(pageId: string, subPageId: string) {
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              subPages: p.subPages.filter((s) => s.id !== subPageId),
            }
          : p
      )
    );
    if (selectedSubPageId === subPageId) {
      setSelectedSubPageId(null);
      setRightPanelType("page");
      setRightPanelOpen(true);
    }
  }

  function handleSubPageSelect(pageId: string, subPageId: string) {
    setSelectedPageId(pageId);
    setSelectedSubPageId(subPageId);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("subpage");
  }

  function handlePageSelect(pageId: string) {
    setSelectedPageId(pageId);
    setMenuSelected(false);
    setSelectedSubPageId(null);
    setSelectedArticleId(null);
    setSelectedBlockId(null);
    setSelectedComponentId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("page");
  }

  function updatePageData(pageId: string, patch: Partial<ContentPageData>) {
    setContentPages(
      contentPages.map((p) => (p.id === pageId ? { ...p, ...patch } : p))
    );
    void updateStructureNode("topic", pageId, patch as Record<string, unknown>).catch((error) => {
      console.error("Failed to update topic", error);
    });
  }

  async function deletePage(pageId: string) {
    try {
      await deleteStructureNode("topic", pageId);
      await loadStructureFromDatabase();
    } catch (error) {
      console.error("Failed to delete topic", error);
    }
  }

  async function handleAddBlock(pageId: string, articleId: string) {
    try {
      const article = contentPages.find((item) => item.id === pageId)?.articles.find((item) => item.id === articleId);
      const newBlockId = await createBlock(courseId, articleId, NEW_CONTENT_GROUP_TITLE, (article?.blocks.length ?? 0) + 1);
      await loadStructureFromDatabase({ pageId, articleId, blockId: newBlockId });
    } catch (error) {
      console.error("Failed to add content group", error);
    }
  }

  function updateBlock(pageId: string, articleId: string, blockId: string, patch: Partial<BlockData>) {
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: p.articles.map((a) =>
                a.id === articleId
                  ? {
                      ...a,
                      blocks: a.blocks.map((b) =>
                        b.id === blockId ? { ...b, ...patch } : b
                      ),
                    }
                  : a
              ),
            }
          : p
      )
    );
    void updateStructureNode("contentGroup", blockId, patch as Record<string, unknown>).catch((error) => {
      console.error("Failed to update content group", error);
    });
  }

  async function deleteBlock(pageId: string, articleId: string, blockId: string) {
    try {
      await deleteStructureNode("contentGroup", blockId);
      await loadStructureFromDatabase({ pageId, articleId });
    } catch (error) {
      console.error("Failed to delete content group", error);
    }
  }

  async function handleAddComponent(pageId: string, articleId: string, blockId: string, componentType: ComponentTypeOption) {
    const targetPage = contentPages.find((p) => p.id === pageId);
    const targetArticle = targetPage?.articles.find((a) => a.id === articleId);
    const targetBlock = targetArticle?.blocks.find((b) => b.id === blockId);
    if (!targetBlock || targetBlock.components.length >= 2) return;

    try {
      const componentCount = targetBlock.components.length;
      const layout = componentCount === 0 ? "full" : "right";

      if (componentCount === 1) {
        await updateComponentLayout(targetBlock.components[0].id, "left");
      }

      const newComponentId = await createComponent(
        courseId,
        blockId,
        componentType,
        componentCount + 1,
        layout
      );
      await loadStructureFromDatabase({ pageId, articleId, blockId, componentId: newComponentId });
    } catch (error) {
      console.error("Failed to add component", error);
    }
  }

  function updateComponent(pageId: string, articleId: string, blockId: string, componentId: string, patch: Partial<ComponentData>) {
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: p.articles.map((a) =>
                a.id === articleId
                  ? {
                      ...a,
                      blocks: a.blocks.map((b) =>
                        b.id === blockId
                          ? {
                              ...b,
                              components: b.components.map((c) =>
                                c.id === componentId ? { ...c, ...patch } : c
                              ),
                            }
                          : b
                      ),
                    }
                  : a
              ),
            }
          : p
      )
    );
    void updateStructureNode("component", componentId, (patch.settings ?? {}) as Record<string, unknown>).catch((error) => {
      console.error("Failed to update component", error);
    });
  }

  async function deleteComponent(pageId: string, articleId: string, blockId: string, componentId: string) {
    try {
      const targetPage = contentPages.find((p) => p.id === pageId);
      const targetArticle = targetPage?.articles.find((a) => a.id === articleId);
      const targetBlock = targetArticle?.blocks.find((b) => b.id === blockId);
      const remainingComponent = targetBlock?.components.find((c) => c.id !== componentId);

      await deleteStructureNode("component", componentId);

      if (remainingComponent && (targetBlock?.components.length ?? 0) === 2) {
        await updateComponentLayout(remainingComponent.id, "full");
      }

      await loadStructureFromDatabase({ pageId, articleId, blockId });
    } catch (error) {
      console.error("Failed to delete component", error);
    }
  }

  function handleSelectComponent(pageId: string, articleId: string, blockId: string, componentId: string) {
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedBlockId(blockId);
    setSelectedComponentId(componentId);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("component");
  }

  function handleAddComponentPanel(pageId: string, articleId: string, blockId: string) {
    const targetPage = contentPages.find((p) => p.id === pageId);
    const targetArticle = targetPage?.articles.find((a) => a.id === articleId);
    const targetBlock = targetArticle?.blocks.find((b) => b.id === blockId);
    if (!targetBlock || targetBlock.components.length >= 2) return;

    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedBlockId(blockId);
    setSelectedComponentId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("block");
    setAddComponentTarget({ pageId, articleId, blockId });
  }

  function handleOpenTemplateDrawer(target: {
    level: "topic" | "section" | "group" | "component";
    pageId: string;
    articleId?: string;
    blockId?: string;
  }) {
    setAddTemplateTarget(target);
  }

  async function handleApplyTemplate(target: {
    level: "topic" | "section" | "group" | "component";
    pageId: string;
    articleId?: string;
    blockId?: string;
  }, template: DashboardTemplate) {
    try {
      const expectedType =
        target.level === "topic"
          ? "Page"
          : target.level === "section"
            ? "Article"
            : target.level === "group"
              ? "Block"
              : "Component";

      if (template.type !== expectedType) {
        return;
      }

      let parentId = courseId;
      let sortOrder = contentPages.length + 1;
      let layout: "full" | "left" | "right" | undefined;

      if (target.level === "section") {
        const page = contentPages.find((item) => item.id === target.pageId);
        if (!page) return;
        parentId = target.pageId;
        sortOrder = page.articles.length + 1;
      }

      if (target.level === "group") {
        const page = contentPages.find((item) => item.id === target.pageId);
        const article = page?.articles.find((item) => item.id === target.articleId);
        if (!article) return;
        parentId = article.id;
        sortOrder = article.blocks.length + 1;
      }

      if (target.level === "component") {
        const page = contentPages.find((item) => item.id === target.pageId);
        const article = page?.articles.find((item) => item.id === target.articleId);
        const block = article?.blocks.find((item) => item.id === target.blockId);
        if (!block || block.components.length >= 2) return;

        parentId = block.id;
        sortOrder = block.components.length + 1;
        layout = block.components.length === 0 ? "full" : "right";

        if (block.components.length === 1) {
          await updateComponentLayout(block.components[0].id, "left");
        }
      }

      await pasteTemplateIntoCourse({
        objectId: template.backendId,
        parentId,
        courseId,
        sortOrder,
        layout,
      });

      await loadStructureFromDatabase({
        pageId: selectedPageId,
        articleId: selectedArticleId,
        blockId: selectedBlockId,
        componentId: selectedComponentId,
      });
      setAddTemplateTarget(null);
    } catch (error) {
      console.error("Failed to add template", error);
    }
  }

  function copyPage(pageId: string) {
    const page = contentPages.find((p) => p.id === pageId);
    if (!page) return;
    const newPageId = `page-${Date.now()}`;
    const copiedPage: ContentPageData = {
      ...page,
      id: newPageId,
      title: `${page.title} (Copy)`,
      articles: page.articles.map((a) => ({
        ...a,
        id: `article-${Date.now()}-${Math.random()}`,
        blocks: a.blocks.map((b) => ({
          ...b,
          id: `block-${Date.now()}-${Math.random()}`,
          components: b.components.map((c) => ({
            ...c,
            id: `component-${Date.now()}-${Math.random()}`,
          })),
        })),
      })),
    };
    setContentPages([...contentPages, copiedPage]);
  }

  function copyArticle(pageId: string, articleId: string) {
    const page = contentPages.find((p) => p.id === pageId);
    const article = page?.articles.find((a) => a.id === articleId);
    if (!article) return;
    const newArticleId = `article-${Date.now()}`;
    const copiedArticle: ArticleData = {
      ...article,
      id: newArticleId,
      title: `${article.title} (Copy)`,
      blocks: article.blocks.map((b) => ({
        ...b,
        id: `block-${Date.now()}-${Math.random()}`,
        components: b.components.map((c) => ({
          ...c,
          id: `component-${Date.now()}-${Math.random()}`,
        })),
      })),
    };
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: [...p.articles, copiedArticle],
            }
          : p
      )
    );
  }

  function copyBlock(pageId: string, articleId: string, blockId: string) {
    const page = contentPages.find((p) => p.id === pageId);
    const article = page?.articles.find((a) => a.id === articleId);
    const block = article?.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const newBlockId = `block-${Date.now()}`;
    const copiedBlock: BlockData = {
      ...block,
      id: newBlockId,
      title: `${block.title} (Copy)`,
      components: block.components.map((c) => ({
        ...c,
        id: `component-${Date.now()}-${Math.random()}`,
      })),
    };
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: p.articles.map((a) =>
                a.id === articleId
                  ? {
                      ...a,
                      blocks: [...a.blocks, copiedBlock],
                    }
                  : a
              ),
            }
          : p
      )
    );
  }

  function copyComponent(pageId: string, articleId: string, blockId: string, componentId: string) {
    const page = contentPages.find((p) => p.id === pageId);
    const article = page?.articles.find((a) => a.id === articleId);
    const block = article?.blocks.find((b) => b.id === blockId);
    const component = block?.components.find((c) => c.id === componentId);
    if (!component) return;
    const newComponentId = `component-${Date.now()}`;
    const copiedComponent: ComponentData = {
      ...component,
      id: newComponentId,
      settings: {
        ...component.settings,
        title: component.settings.title ? `${component.settings.title} (Copy)` : undefined,
      },
    };
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: p.articles.map((a) =>
                a.id === articleId
                  ? {
                      ...a,
                      blocks: a.blocks.map((b) =>
                        b.id === blockId
                          ? {
                              ...b,
                              components: [...b.components, copiedComponent],
                            }
                          : b
                      ),
                    }
                  : a
              ),
            }
          : p
      )
    );
  }

  const courseData: Course = useMemo(() => ({
    id: "editor-course",
    title: courseTitle,
    description: "In-editor course preview",
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "Draft",
    menuPage: menuPageCreated ? {
      logoUrl: menuData.logoUrl,
      title: menuData.title,
      subtitle: menuData.subtitle,
      body: menuData.body,
      menuStyle: (menuData.menuStyle === "Overview Menu" ? "Box Menu" : menuData.menuStyle) as "Box Menu" | "Linear Menu" | "Icon Menu",
      menuLockType: menuData.menuLockType,
      textAlign: menuData.textAlign,
      bgType: menuData.bgType,
      bgColor: menuData.bgColor,
      bgImageUrl: menuData.bgImageUrl,
    } : undefined,
    pages: contentPages.map((page) => ({
      id: page.id,
      title: page.title,
      description: page.description,
      articles: page.articles || [],
      subPages: page.subPages || [],
    })),
  }), [courseTitle, menuPageCreated, menuData, contentPages]);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <PageEditorTopBar
        courseTitle={courseTitle}
        onCourseTitleChange={setCourseTitle}
        onToggleLeftPanel={() => setLeftPanelOpen((o) => !o)}
      />

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative min-w-0">
        <PageEditorNavigation
          courseId={courseId}
          leftPanelOpen={leftPanelOpen}
          onClosePanels={() => {
            setLeftPanelOpen(false);
          }}
          onOpenPanels={() => {
            setLeftPanelOpen(true);
          }}
          menuPageCreated={menuPageCreated}
          menuSelected={menuSelected}
          contentPages={contentPages}
          selectedPageId={selectedPageId}
          selectedSubPageId={selectedSubPageId}
          selectedArticleId={selectedArticleId}
          selectedBlockId={selectedBlockId}
          selectedComponentId={selectedComponentId}
          onMenuSelect={handleMenuSelect}
          onPageSelect={handlePageSelect}
          onSubPageSelect={handleSubPageSelect}
          onArticleSelect={handleArticleSelect}
          onBlockSelect={handleBlockSelect}
          onComponentSelect={handleSelectComponent}
          onAddPage={handleAddPage}
          onDeletePage={deletePage}
          onAddArticle={handleAddArticle}
          onDeleteArticle={deleteArticle}
          onAddSubPage={handleAddSubPage}
          onAddBlock={handleAddBlock}
          onDeleteBlock={deleteBlock}
          onAddComponent={handleAddComponentPanel}
          onDeleteComponent={deleteComponent}
          onUseTemplate={handleOpenTemplateDrawer}
        />

        {/* Canvas */}
        <main
          className="flex-1 min-w-0 bg-[#F2F2F2] overflow-y-auto overflow-x-hidden relative"
          onClick={handleCanvasClick}
        >
          {isLoadingStructure ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-[#6b7280]">Loading course structure...</div>
            </div>
          ) : structureLoadError ? (
            <div className="flex items-center justify-center h-full px-6">
              <div className="max-w-md rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b] text-center">
                {structureLoadError}
              </div>
            </div>
          ) : !menuPageCreated ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-5 text-center px-6 select-none">
                <div className="w-20 h-20 rounded-2xl bg-white border border-[#E5E5E5] flex items-center justify-center shadow-sm">
                  <MaskIcon file="add-icon.svg" className="block w-[24px] h-[24px] shrink-0 bg-[#ababab]" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-[#1A1A1A] font-[Lato]">Create Your Menu Page</h2>
                  <p className="text-sm text-[#ABABAB] max-w-xs leading-relaxed font-[Lato]">
                    Start by creating a menu page for your course. This will be the landing
                    page where learners navigate through your content.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleMenuPageCreate(); }}
                  className="flex items-center gap-2.5 px-6 py-3 bg-[#2E7FA1] hover:bg-[#266580] active:bg-[#1D4C60] text-white text-base font-bold rounded-lg transition-colors font-[Lato]"
                >
                  <MaskIcon file="add-icon.svg" className="block w-[16px] h-[16px] shrink-0 bg-current" />
                  Create Menu Page
                </button>
              </div>
            </div>
          ) : (
            <div className="min-h-full flex flex-col items-center pt-6 px-6 pb-10 gap-8">
              {!selectedPageId ? (
                <>
                  {/* Show Menu Page when no page is selected */}
                  <MenuPageCanvas
                    data={menuData}
                    onUpdate={updateMenuData}
                    onSelectSection={(e) => { e.stopPropagation(); handleMenuSelect(); }}
                    isSelected={menuSelected}
                    isEditingInPanel={rightPanelOpen}
                  />

                  {/* Add first page CTA */}
                  {contentPages.length === 0 ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="w-full max-w-2xl rounded-xl border-2 border-dashed border-[#d1d5db] bg-white flex flex-col items-center justify-center py-14 gap-4"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#F2F2F2] flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ABABAB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="12" y1="18" x2="12" y2="12" />
                          <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-semibold text-[#1A1A1A]">Add Your First Page</p>
                        <p className="text-sm text-[#ABABAB] mt-1 max-w-xs">
                          Now that you have a menu page, add your first content page to begin building your course.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAddPage(); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#2E7FA1] hover:bg-[#266580] text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        <MaskIcon file="add-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
                        Add First Page
                      </button>
                    </div>
                  ) : (
                    <div className="w-full max-w-2xl mx-auto">
                      {contentPages.map((page) => (
                        <div
                          key={page.id}
                          onClick={(e) => { e.stopPropagation(); handlePageSelect(page.id); }}
                          className={`rounded-xl border-2 px-6 py-4 mb-4 cursor-pointer transition-all ${
                            selectedPageId === page.id
                              ? "bg-[#dbeeff] border-[#2d6fa8]"
                              : rightPanelOpen
                                ? "bg-white border-transparent hover:border-[#2d6fa8]"
                                : "bg-white border-[#E5E5E5] hover:border-[#2d6fa8]"
                          }`}
                        >
                          <h3 className="font-semibold text-[#1A1A1A]">{page.title}</h3>
                          {page.description && (
                            <p className="text-sm text-[#6b7280] mt-1">{page.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Show selected content page with articles below */
                <div className="w-full max-w-[760px] mx-auto flex flex-col gap-8">
                  <ContentPageCanvas
                    page={contentPages.find((p) => p.id === selectedPageId)!}
                    onUpdate={(patch) => updatePageData(selectedPageId, patch)}
                    onSelectSection={() => {
                      setSelectedSubPageId(null);
                      setSelectedArticleId(null);
                      setSelectedBlockId(null);
                      setSelectedComponentId(null);
                      setHasCanvasSelection(true);
                      setRightPanelOpen(true);
                      setRightPanelType("page");
                    }}
                    onAddArticle={handleAddArticle}
                    onAddSubPage={handleAddSubPage}
                    onCopy={() => copyPage(selectedPageId)}
                    onDelete={() => deletePage(selectedPageId)}
                    isSelected={
                      hasCanvasSelection &&
                      !selectedSubPageId &&
                      !selectedArticleId &&
                      !selectedBlockId &&
                      !selectedComponentId
                    }
                    isEditingInPanel={rightPanelOpen}
                    previewMode={!hasCanvasSelection}
                  />

                  {/* Articles section */}
                  <div className="flex flex-col gap-6">
                    {contentPages.find((p) => p.id === selectedPageId)?.articles.map((article) => (
                      <ArticleCanvas
                        key={article.id}
                        article={article}
                        onUpdate={(patch) => updateArticle(selectedPageId, article.id, patch)}
                        onSelectSection={() => {
                          setSelectedArticleId(article.id);
                          setSelectedSubPageId(null);
                          setSelectedBlockId(null);
                          setSelectedComponentId(null);
                          setHasCanvasSelection(true);
                          setRightPanelOpen(true);
                          setRightPanelType("article");
                        }}
                        onAddBlock={() => handleAddBlock(selectedPageId, article.id)}
                        onBlockUpdate={(blockId, patch) => updateBlock(selectedPageId, article.id, blockId, patch)}
                        onSelectBlock={(blockId) => handleBlockSelect(selectedPageId, article.id, blockId)}
                        onAddComponent={(blockId) => handleAddComponentPanel(selectedPageId, article.id, blockId)}
                        onSelectComponent={(blockId, componentId) => handleSelectComponent(selectedPageId, article.id, blockId, componentId)}
                        onCopy={() => copyArticle(selectedPageId, article.id)}
                        onDelete={() => deleteArticle(selectedPageId, article.id)}
                        onCopyBlock={(blockId) => copyBlock(selectedPageId, article.id, blockId)}
                        onDeleteBlock={(blockId) => deleteBlock(selectedPageId, article.id, blockId)}
                        onCopyComponent={(blockId, componentId) => copyComponent(selectedPageId, article.id, blockId, componentId)}
                        onDeleteComponent={(blockId, componentId) => deleteComponent(selectedPageId, article.id, blockId, componentId)}
                        selectedBlockId={selectedBlockId}
                        selectedComponentId={selectedComponentId}
                        isSelected={
                          hasCanvasSelection &&
                          selectedArticleId === article.id &&
                          !selectedBlockId &&
                          !selectedComponentId
                        }
                        isEditingInPanel={rightPanelOpen}
                        previewMode={!hasCanvasSelection}
                      />
                    ))}
                  </div>

                  {/* Add Article button */}
                  <div className="w-full max-w-[760px] mx-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddArticle(selectedPageId);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#2d6fa8] hover:bg-[#f0f8ff] rounded transition-colors"
                    >
                      <MaskIcon file="add-icon.svg" className="block w-[16px] h-[16px] shrink-0 bg-current" />
                      <span>Add Article</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Structure Map Modal */}
        {showStructureMap && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto w-full shadow-xl">
              <div className="flex items-center justify-between p-6 border-b border-[#E5E5E5] sticky top-0 bg-white">
                <h2 className="text-lg font-semibold text-[#1A1A1A]">Course Structure Map</h2>
                <button
                  type="button"
                  onClick={() => setShowStructureMap(false)}
                  className="text-[#ABABAB] hover:text-[#1A1A1A] text-xl font-semibold"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <CourseStructureMap
                  course={courseData}
                  onNodeClick={(pageId: string) => {
                    if (pageId !== 'menu') {
                      handlePageSelect(pageId);
                    }
                    setShowStructureMap(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Right properties panel — fixed until collapsed or preview mode */}
        {menuPageCreated && (
          <>
            {rightPanelOpen && (
              <div
                className="md:hidden fixed inset-0 z-30 bg-black/40"
                onClick={() => setRightPanelOpen(false)}
                aria-hidden="true"
              />
            )}

            {rightPanelOpen ? (
              <aside className="fixed md:relative inset-y-0 right-0 z-40 md:z-auto h-full w-[300px] bg-white border-l border-[#d8dee6] overflow-y-auto overflow-x-hidden shrink-0">
                {(() => {
                const page = selectedPageId ? contentPages.find((p) => p.id === selectedPageId) : undefined;
                const article = page && selectedArticleId ? page.articles.find((a) => a.id === selectedArticleId) : undefined;
                const block = article && selectedBlockId ? article.blocks.find((b) => b.id === selectedBlockId) : undefined;
                const component = block && selectedComponentId ? block.components.find((c) => c.id === selectedComponentId) : undefined;

                const activeLevel = rightPanelType === "component" || rightPanelType === "addComponent"
                  ? "component"
                  : rightPanelType === "block"
                    ? "block"
                    : rightPanelType === "article"
                      ? "article"
                      : "page";

                const rowClass = (active: boolean) =>
                  `w-full flex items-center gap-2 px-3.5 h-12 border-b border-[#e6ebf0] transition-colors ${
                    active
                      ? "bg-[#f2f8fc] text-[#1f2937]"
                      : "bg-white text-[#9aa7b2] opacity-40 cursor-not-allowed"
                  }`;

                const iconColorClass = (
                  active: boolean,
                  level: "topic" | "section" | "contentGroup" | "component"
                ) => (active ? STRUCTURE_ICON_COLOR_CLASS[level] : "text-[#9aa7b2]");

                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setRightPanelOpen(false)}
                      className="w-full h-[56px] border-b border-[#d8dee6] px-3.5 flex items-center gap-2 text-[#3b4753]"
                      aria-label="Collapse properties"
                      title="Collapse properties"
                    >
                      <span className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-[#f2f5f8] transition-colors">
                        <MaskIcon file="chevron-right.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
                      </span>
                      <span className="text-xs tracking-[0.08em] font-semibold uppercase">Properties</span>
                    </button>

                    <button type="button" className={rowClass(activeLevel === "page")}>
                      <span className="flex items-center gap-2 text-[13px] font-semibold flex-1">
                        <span className="w-6 h-6 rounded-[4px] flex items-center justify-center shrink-0">
                          <StructureIcon
                            level="topic"
                            size={14}
                            className={iconColorClass(activeLevel === "page", "topic")}
                          />
                        </span>
                        Topic
                      </span>
                      <MaskIcon
                        file="chevron-right.svg"
                        className={`block w-[13px] h-[13px] shrink-0 bg-current transition-transform ${activeLevel === "page" ? "rotate-90" : ""}`}
                      />
                    </button>
                    {activeLevel === "page" && page && (
                      <div className="px-4 py-4 border-b border-[#e6ebf0] space-y-3">
                        <input
                          value={page.title}
                          onChange={(e) => updatePageData(page.id, { title: e.target.value })}
                          className="w-full border border-[#d1d5db] rounded-md px-3 py-2 text-sm"
                          placeholder="Topic title"
                        />
                        <textarea
                          value={page.description}
                          onChange={(e) => updatePageData(page.id, { description: e.target.value })}
                          className="w-full border border-[#d1d5db] rounded-md px-3 py-2 text-sm resize-none"
                          rows={3}
                          placeholder="Topic description"
                        />
                      </div>
                    )}

                    <button type="button" className={rowClass(activeLevel === "article")}>
                      <span className="flex items-center gap-2 text-[13px] font-semibold flex-1">
                        <span className="w-6 h-6 rounded-[4px] flex items-center justify-center shrink-0">
                          <StructureIcon
                            level="section"
                            size={14}
                            className={iconColorClass(activeLevel === "article", "section")}
                          />
                        </span>
                        Section
                      </span>
                      <MaskIcon
                        file="chevron-right.svg"
                        className={`block w-[13px] h-[13px] shrink-0 bg-current transition-transform ${activeLevel === "article" ? "rotate-90" : ""}`}
                      />
                    </button>
                    {activeLevel === "article" && article && (
                      <div className="px-4 py-4 border-b border-[#e6ebf0] space-y-3">
                        <input
                          value={article.title}
                          onChange={(e) => updateArticle(page!.id, article.id, { title: e.target.value })}
                          className="w-full border border-[#d1d5db] rounded-md px-3 py-2 text-sm"
                          placeholder="Section title"
                        />
                        <textarea
                          value={article.description}
                          onChange={(e) => updateArticle(page!.id, article.id, { description: e.target.value })}
                          className="w-full border border-[#d1d5db] rounded-md px-3 py-2 text-sm resize-none"
                          rows={3}
                          placeholder="Section description"
                        />
                      </div>
                    )}

                    <button type="button" className={rowClass(activeLevel === "block")}>
                      <span className="flex items-center gap-2 text-[13px] font-semibold flex-1">
                        <span className="w-6 h-6 rounded-[4px] flex items-center justify-center shrink-0">
                          <StructureIcon
                            level="contentGroup"
                            size={14}
                            className={iconColorClass(activeLevel === "block", "contentGroup")}
                          />
                        </span>
                        Content Group
                      </span>
                      <MaskIcon
                        file="chevron-right.svg"
                        className={`block w-[13px] h-[13px] shrink-0 bg-current transition-transform ${activeLevel === "block" ? "rotate-90" : ""}`}
                      />
                    </button>
                    {activeLevel === "block" && block && (
                      <div className="border-b border-[#e6ebf0]">
                        <div className="px-4 py-4 space-y-3">
                          <input
                            value={block.title}
                            onChange={(e) => updateBlock(page!.id, article!.id, block.id, { title: e.target.value })}
                            className="w-full border border-[#d1d5db] rounded-md px-3 py-2 text-sm"
                            placeholder="Content Group"
                          />
                          <input
                            value={block.id}
                            readOnly
                            className="w-full border border-[#d1d5db] rounded-md px-3 py-2 text-sm text-[#6b7280] bg-[#f8fafc]"
                          />
                          <p className="text-xs text-[#6b7280]">Unique identifier for this content group. Click to copy.</p>
                        </div>
                        <button type="button" className="w-full h-14 border-t border-[#e6ebf0] px-5 flex items-center justify-between text-[#4b5563] text-xs font-semibold tracking-wide">AVAILABILITY &amp; PROGRESSION <span>›</span></button>
                        <button type="button" className="w-full h-14 border-t border-[#e6ebf0] px-5 flex items-center justify-between text-[#4b5563] text-xs font-semibold tracking-wide">EXTENSIONS <span>›</span></button>
                        <button type="button" className="w-full h-14 border-t border-[#e6ebf0] px-5 flex items-center justify-between text-[#4b5563] text-xs font-semibold tracking-wide">THEME <span>›</span></button>
                        <button type="button" className="w-full h-14 border-t border-[#e6ebf0] px-5 flex items-center justify-between text-[#4b5563] text-xs font-semibold tracking-wide">ADVANCED SETTINGS <span>›</span></button>
                      </div>
                    )}

                    <button type="button" className={rowClass(activeLevel === "component")}>
                      <span className="flex items-center gap-2 text-[13px] font-semibold flex-1">
                        <span className="w-6 h-6 rounded-[4px] flex items-center justify-center shrink-0">
                          <StructureIcon
                            level="component"
                            size={14}
                            className={iconColorClass(activeLevel === "component", "component")}
                          />
                        </span>
                        Component
                      </span>
                      <MaskIcon
                        file="chevron-right.svg"
                        className={`block w-[13px] h-[13px] shrink-0 bg-current transition-transform ${activeLevel === "component" ? "rotate-90" : ""}`}
                      />
                    </button>
                    {activeLevel === "component" && (
                      <div className="px-4 py-4 border-b border-[#e6ebf0]">
                        {component && page && article && block ? (
                          <div className="space-y-3">
                            <input
                              value={component.settings.title || ""}
                              onChange={(e) => updateComponent(page.id, article.id, block.id, component.id, {
                                settings: { ...component.settings, title: e.target.value },
                              })}
                              className="w-full border border-[#d1d5db] rounded-md px-3 py-2 text-sm"
                              placeholder="Component title"
                            />
                            <textarea
                              value={component.settings.description || ""}
                              onChange={(e) => updateComponent(page.id, article.id, block.id, component.id, {
                                settings: { ...component.settings, description: e.target.value },
                              })}
                              className="w-full border border-[#d1d5db] rounded-md px-3 py-2 text-sm resize-none"
                              rows={3}
                              placeholder="Component description"
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </>
                );
              })()}
              </aside>
            ) : (
              <aside className="hidden md:flex h-full w-[56px] bg-white border-l border-[#d8dee6] shrink-0 flex-col items-center py-3">
                <div className="w-full flex flex-col items-center pb-3 border-b border-[#d8dee6]">
                  <button
                    type="button"
                    onClick={() => setRightPanelOpen(true)}
                    className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#5f6d79] hover:bg-[#f1f5f9] transition-colors"
                    aria-label="Expand properties"
                    title="Expand properties"
                  >
                    <MaskIcon file="chevron-right.svg" className="block w-[14px] h-[14px] shrink-0 bg-current rotate-180" />
                  </button>
                </div>
              </aside>
            )}
          </>
        )}

        {addComponentTarget && (
          <AddComponentDrawer
            onClose={() => setAddComponentTarget(null)}
            onSelect={(componentType) => {
              void handleAddComponent(
                addComponentTarget.pageId,
                addComponentTarget.articleId,
                addComponentTarget.blockId,
                componentType
              );
              setAddComponentTarget(null);
            }}
          />
        )}

        {addTemplateTarget && (
          <AddTemplateDrawer
            level={addTemplateTarget.level}
            onClose={() => setAddTemplateTarget(null)}
            onSelect={async (template) => {
              await handleApplyTemplate(addTemplateTarget, template);
            }}
          />
        )}
      </div>
    </div>
  );
}
