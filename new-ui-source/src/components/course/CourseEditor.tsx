import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CourseOutlinePanel,
  MenuPageCanvas,
  ContentPageCanvas,
  SubPageCanvas,
  ArticleCanvas,
  MenuSettingsPanel,
  ContentPageSettingsPanel,
  SubPageSettingsPanel,
  ArticleSettingsPanel,
  BlockSettingsPanel,
  ComponentSettingsPanel,
  ComponentSelector,
} from "../editor/index";
import { CourseStructureMap } from "./index";
import type { MenuPageData } from "../editor/MenuPageCanvas";
import type { Course } from "../../types/course";

const sideIcons = [
  {
    id: "structure",
    label: "Structure",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: "theme",
    label: "Theme",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="10.5" r="2.5" />
        <circle cx="8.5" cy="7.5" r="2.5" /><circle cx="6.5" cy="12.5" r="2.5" />
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.6.376 3.112 1.043 4.453.178.355.237.763.134 1.148L2.5 21l3.4-.677c.385-.103.793-.044 1.148.134A9.958 9.958 0 0 0 12 22z" />
      </svg>
    ),
  },
  {
    id: "extensions",
    label: "Extensions",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

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

export type ComponentType = "Image" | "Video" | "Accordion" | "Text" | "Quiz";

export interface ComponentData {
  id: string;
  type: ComponentType;
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
  const [activeRailIcon, setActiveRailIcon] = useState<string>("structure");
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

  const [contentPages, setContentPages] = useState<ContentPageData[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedSubPageId, setSelectedSubPageId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  function handleMenuPageCreate() {
    setMenuPageCreated(true);
    setMenuSelected(true);
    setRightPanelOpen(true);
  }

  function updateMenuData(patch: Partial<MenuPageData>) {
    setMenuData((prev) => ({ ...prev, ...patch }));
  }

  function handleRailClick(id: string) {
    if (id === "structure") {
      setShowStructureMap((prev) => !prev);
      setActiveRailIcon(id);
    } else {
      setActiveRailIcon((prev) => (prev === id ? "" : id));
    }
  }

  function handleCanvasClick() {
    setMenuSelected(false);
    setRightPanelOpen(false);
  }

  function handleMenuSelect() {
    setMenuSelected(true);
    setSelectedPageId(null);
    setRightPanelOpen(true);
    setRightPanelType("menu");
  }

  function handleAddPage() {
    const newPageId = `page-${Date.now()}`;
    const newPage: ContentPageData = {
      id: newPageId,
      title: "Untitled Page",
      description: "",
      articles: [],
      subPages: [],
    };
    setContentPages([...contentPages, newPage]);
    setSelectedPageId(newPageId);
    setRightPanelOpen(true);
    setRightPanelType("page");
  }

  function handleAddArticle(pageId: string) {
    const newArticleId = `article-${Date.now()}`;
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: [
                ...p.articles,
                { id: newArticleId, title: "Untitled Article", description: "", instruction: "", blocks: [] },
              ],
            }
          : p
      )
    );
    setSelectedPageId(pageId);
    setSelectedArticleId(newArticleId);
    setRightPanelOpen(true);
    setRightPanelType("article");
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

  function deleteArticle(pageId: string, articleId: string) {
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: p.articles.filter((a) => a.id !== articleId),
            }
          : p
      )
    );
    if (selectedArticleId === articleId) {
      setSelectedArticleId(null);
      setRightPanelOpen(false);
    }
  }

  function handleArticleSelect(pageId: string, articleId: string) {
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedSubPageId(null);
    setSelectedBlockId(null);
    setRightPanelOpen(true);
    setRightPanelType("article");
  }

  function handleBlockSelect(pageId: string, articleId: string, blockId: string) {
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedBlockId(blockId);
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
      setRightPanelOpen(false);
    }
  }

  function handleSubPageSelect(pageId: string, subPageId: string) {
    setSelectedPageId(pageId);
    setSelectedSubPageId(subPageId);
    setRightPanelOpen(true);
    setRightPanelType("subpage");
  }

  function handlePageSelect(pageId: string) {
    setSelectedPageId(pageId);
    setMenuSelected(false);
    setRightPanelOpen(true);
    setRightPanelType("page");
  }

  function updatePageData(pageId: string, patch: Partial<ContentPageData>) {
    setContentPages(
      contentPages.map((p) => (p.id === pageId ? { ...p, ...patch } : p))
    );
  }

  function deletePage(pageId: string) {
    setContentPages(contentPages.filter((p) => p.id !== pageId));
    if (selectedPageId === pageId) {
      setSelectedPageId(null);
      setRightPanelOpen(false);
    }
  }

  function handleAddBlock(pageId: string, articleId: string) {
    const newBlockId = `block-${Date.now()}`;
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: p.articles.map((a) =>
                a.id === articleId
                  ? {
                      ...a,
                      blocks: [
                        ...a.blocks,
                        { id: newBlockId, title: "Untitled Block", description: "", instruction: "", components: [] },
                      ],
                    }
                  : a
              ),
            }
          : p
      )
    );
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
  }

  function deleteBlock(pageId: string, articleId: string, blockId: string) {
    setContentPages(
      contentPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: p.articles.map((a) =>
                a.id === articleId
                  ? {
                      ...a,
                      blocks: a.blocks.filter((b) => b.id !== blockId),
                    }
                  : a
              ),
            }
          : p
      )
    );
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
      setRightPanelOpen(false);
    }
  }

  function handleAddComponent(pageId: string, articleId: string, blockId: string, componentType: ComponentType) {
    const newComponentId = `component-${Date.now()}`;
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
                        b.id === blockId && b.components.length < 2
                          ? {
                              ...b,
                              components: [
                                ...b.components,
                                { id: newComponentId, type: componentType, settings: {} },
                              ],
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
    // Automatically select the new component and open its settings panel
    setSelectedComponentId(newComponentId);
    setRightPanelOpen(true);
    setRightPanelType("component");
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
  }

  function deleteComponent(pageId: string, articleId: string, blockId: string, componentId: string) {
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
                              components: b.components.filter((c) => c.id !== componentId),
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

  function swapComponents(pageId: string, articleId: string, blockId: string) {
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
                        b.id === blockId && b.components.length === 2
                          ? {
                              ...b,
                              components: [b.components[1], b.components[0]],
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

  function handleSelectComponent(blockId: string, componentId: string) {
    setSelectedComponentId(componentId);
    setRightPanelOpen(true);
    setRightPanelType("component");
  }

  function handleAddComponentPanel(blockId: string) {
    setRightPanelOpen(true);
    setRightPanelType("addComponent");
  }

  function handleComponentSelected(componentType: ComponentType) {
    if (selectedPageId && selectedArticleId && selectedBlockId) {
      handleAddComponent(selectedPageId, selectedArticleId, selectedBlockId, componentType);
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
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="h-14 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-3 md:px-4 shrink-0 z-10">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Mobile: hamburger to open outline panel */}
          <button
            type="button"
            aria-label="Open course outline"
            onClick={() => setLeftPanelOpen((o) => !o)}
            className="md:hidden p-2 rounded-lg text-[#474747] hover:bg-[#F2F2F2] transition-colors shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="hidden md:flex items-center gap-2 mr-2 shrink-0">
            <img
              src="/adapt-logo.jpeg"
              alt="Adapt logo"
              width={32}
              height={32}
              className="rounded-lg shrink-0"
            />
            <span className="font-semibold text-[#1A1A1A] text-sm tracking-tight">Adapt Studio</span>
          </div>

          <Link to="/" className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#1A1A1A] transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </Link>

          <span className="hidden sm:block text-[#d1d5db] text-lg font-light select-none">|</span>

          <input
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            className="text-sm md:text-base font-semibold text-[#1A1A1A] bg-transparent border-none outline-none focus:ring-0 min-w-0 w-32 sm:w-48 md:w-72 truncate"
            aria-label="Course title"
          />
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <span className="hidden lg:flex text-xs text-[#ABABAB] items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Saved &amp; Protected
          </span>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Icon rail — hidden on mobile (hamburger replaces it) */}
        <nav className="hidden md:flex w-12 bg-white border-r border-[#E5E5E5] flex-col items-center py-3 gap-1 shrink-0 z-10">
          {sideIcons.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              onClick={() => handleRailClick(item.id)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                activeRailIcon === item.id
                  ? "bg-[#dbeeff] text-[#2d6fa8]"
                  : "text-[#ABABAB] hover:bg-[#F2F2F2] hover:text-[#474747]"
              }`}
            >
              {item.icon}
            </button>
          ))}
          <div className="flex-1" />
          <button type="button" aria-label="Global settings" className="w-9 h-9 flex items-center justify-center rounded-lg text-[#ABABAB] hover:bg-[#F2F2F2] hover:text-[#474747] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </nav>

        {/* Left panel — static on desktop, overlay drawer on mobile */}
        <>
          {/* Mobile backdrop — only show on mobile when open */}
          {leftPanelOpen && (
            <div
              className="md:hidden fixed inset-0 z-30 bg-black/40"
              onClick={() => { setLeftPanelOpen(false); setActiveRailIcon(""); }}
              aria-hidden="true"
            />
          )}
          {/* Panel is visible on desktop (md:flex), or on mobile if leftPanelOpen */}
          <div className={`${leftPanelOpen ? 'flex' : 'hidden md:flex'} md:flex md:relative fixed inset-y-0 left-0 z-40 md:z-auto h-full md:h-auto shrink-0`}>
            <CourseOutlinePanel
              onClose={() => { setLeftPanelOpen(false); setActiveRailIcon(""); }}
              menuPageCreated={menuPageCreated}
              menuSelected={menuSelected}
              onMenuSelect={handleMenuSelect}
              contentPages={contentPages}
              selectedPageId={selectedPageId}
              selectedSubPageId={selectedSubPageId}
              selectedArticleId={selectedArticleId}
              onPageSelect={handlePageSelect}
              onSubPageSelect={handleSubPageSelect}
              onArticleSelect={handleArticleSelect}
              onAddPage={handleAddPage}
              onDeletePage={deletePage}
              onAddArticle={handleAddArticle}
              onAddSubPage={handleAddSubPage}
            />
          </div>
        </>

        {/* Canvas */}
        <main
          className="flex-1 bg-[#F2F2F2] overflow-y-auto relative"
          onClick={handleCanvasClick}
        >
          {!menuPageCreated ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-5 text-center px-6 select-none">
                <div className="w-20 h-20 rounded-2xl bg-white border border-[#E5E5E5] flex items-center justify-center shadow-sm">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ABABAB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  Create Menu Page
                </button>
              </div>
            </div>
          ) : (
            <div className="min-h-full flex flex-col items-center py-12 px-8 gap-8">
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
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
                <div className="w-full flex flex-col gap-8">
                  <ContentPageCanvas
                    page={contentPages.find((p) => p.id === selectedPageId)!}
                    onUpdate={(patch) => updatePageData(selectedPageId, patch)}
                    onSelectSection={() => {
                      setRightPanelOpen(true);
                      setRightPanelType("page");
                    }}
                    onAddArticle={handleAddArticle}
                    onAddSubPage={handleAddSubPage}
                    onCopy={() => copyPage(selectedPageId)}
                    onDelete={() => deletePage(selectedPageId)}
                    isSelected={!selectedArticleId}
                    isEditingInPanel={rightPanelOpen}
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
                          setSelectedBlockId(null);
                          setRightPanelOpen(true);
                          setRightPanelType("article");
                        }}
                        onAddBlock={() => handleAddBlock(selectedPageId, article.id)}
                        onBlockUpdate={(blockId, patch) => updateBlock(selectedPageId, article.id, blockId, patch)}
                        onSelectBlock={(blockId) => handleBlockSelect(selectedPageId, article.id, blockId)}
                        onAddComponent={(blockId) => handleAddComponentPanel(blockId)}
                        onSelectComponent={(blockId, componentId) => handleSelectComponent(blockId, componentId)}
                        onCopy={() => copyArticle(selectedPageId, article.id)}
                        onDelete={() => deleteArticle(selectedPageId, article.id)}
                        onCopyBlock={(blockId) => copyBlock(selectedPageId, article.id, blockId)}
                        onDeleteBlock={(blockId) => deleteBlock(selectedPageId, article.id, blockId)}
                        onCopyComponent={(blockId, componentId) => copyComponent(selectedPageId, article.id, blockId, componentId)}
                        onDeleteComponent={(blockId, componentId) => deleteComponent(selectedPageId, article.id, blockId, componentId)}
                        selectedBlockId={selectedBlockId}
                        selectedComponentId={selectedComponentId}
                        isSelected={selectedArticleId === article.id}
                        isEditingInPanel={rightPanelOpen}
                      />
                    ))}
                  </div>

                  {/* Add Article button */}
                  <div className="w-full max-w-3xl mx-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddArticle(selectedPageId);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#2d6fa8] hover:bg-[#f0f8ff] rounded transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
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

        {/* Right settings panel — overlay on mobile, inline on desktop */}
        {menuPageCreated && rightPanelOpen && (
          <>
            {/* Mobile backdrop for right panel */}
            <div
              className="md:hidden fixed inset-0 z-30 bg-black/40"
              onClick={() => setRightPanelOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed md:relative inset-y-0 right-0 z-40 md:z-auto h-full md:h-auto">
            {rightPanelType === "menu" && menuSelected && (
              <MenuSettingsPanel
                data={menuData}
                onUpdate={updateMenuData}
                onClose={() => { setRightPanelOpen(false); setMenuSelected(false); }}
              />
            )}
            {rightPanelType === "page" && selectedPageId && !selectedSubPageId && (
              <ContentPageSettingsPanel
                page={contentPages.find((p) => p.id === selectedPageId)!}
                onUpdate={(patch) => updatePageData(selectedPageId, patch)}
                onDelete={() => deletePage(selectedPageId)}
                onCopy={() => copyPage(selectedPageId)}
                onClose={() => { setRightPanelOpen(false); setSelectedPageId(null); }}
              />
            )}
            {rightPanelType === "subpage" && selectedPageId && selectedSubPageId && (() => {
              const page = contentPages.find((p) => p.id === selectedPageId);
              const subPage = page?.subPages.find((s) => s.id === selectedSubPageId);
              return subPage ? (
                <SubPageSettingsPanel
                  subPage={subPage}
                  onUpdate={(patch) => updateSubPage(selectedPageId, selectedSubPageId, patch)}
                  onDelete={() => deleteSubPage(selectedPageId, selectedSubPageId)}
                  onClose={() => { setRightPanelOpen(false); setSelectedSubPageId(null); }}
                />
              ) : null;
            })()}
            {rightPanelType === "article" && selectedPageId && selectedArticleId && (() => {
              const page = contentPages.find((p) => p.id === selectedPageId);
              const article = page?.articles.find((a) => a.id === selectedArticleId);
              return article ? (
                <ArticleSettingsPanel
                  article={article}
                  onUpdate={(patch) => updateArticle(selectedPageId, selectedArticleId, patch)}
                  onDelete={() => deleteArticle(selectedPageId, selectedArticleId)}
                  onCopy={() => copyArticle(selectedPageId, selectedArticleId)}
                  onClose={() => { setRightPanelOpen(false); setSelectedArticleId(null); }}
                />
              ) : null;
            })()}
            {rightPanelType === "block" && selectedPageId && selectedArticleId && selectedBlockId && (() => {
              const page = contentPages.find((p) => p.id === selectedPageId);
              const article = page?.articles.find((a) => a.id === selectedArticleId);
              const block = article?.blocks.find((b) => b.id === selectedBlockId);
              return block ? (
                <BlockSettingsPanel
                  block={block}
                  onUpdate={(patch) => updateBlock(selectedPageId, selectedArticleId, selectedBlockId, patch)}
                  onDelete={() => deleteBlock(selectedPageId, selectedArticleId, selectedBlockId)}
                  onCopy={() => copyBlock(selectedPageId, selectedArticleId, selectedBlockId)}
                  onClose={() => { setRightPanelOpen(false); setSelectedBlockId(null); }}
                />
              ) : null;
            })()}
            {rightPanelType === "addComponent" && selectedPageId && selectedArticleId && selectedBlockId && (() => {
              const page = contentPages.find((p) => p.id === selectedPageId);
              const article = page?.articles.find((a) => a.id === selectedArticleId);
              const block = article?.blocks.find((b) => b.id === selectedBlockId);
              return block ? (
                <ComponentSelector
                  onSelectComponent={(type) => handleAddComponent(selectedPageId, selectedArticleId, selectedBlockId, type)}
                  onClose={() => { setRightPanelOpen(false); }}
                  maxComponentsReached={block.components.length >= 2}
                />
              ) : null;
            })()}
            {rightPanelType === "component" && selectedPageId && selectedArticleId && selectedBlockId && selectedComponentId && (() => {
              const page = contentPages.find((p) => p.id === selectedPageId);
              const article = page?.articles.find((a) => a.id === selectedArticleId);
              const block = article?.blocks.find((b) => b.id === selectedBlockId);
              const component = block?.components.find((c) => c.id === selectedComponentId);
              return component ? (
                <ComponentSettingsPanel
                  component={component}
                  onUpdate={(patch) => updateComponent(selectedPageId, selectedArticleId, selectedBlockId, selectedComponentId, patch)}
                  onDelete={() => deleteComponent(selectedPageId, selectedArticleId, selectedBlockId, selectedComponentId)}
                  onCopy={() => copyComponent(selectedPageId, selectedArticleId, selectedBlockId, selectedComponentId)}
                  onSwap={block && block.components.length === 2 ? () => swapComponents(selectedPageId, selectedArticleId, selectedBlockId) : undefined}
                  onClose={() => { setRightPanelOpen(false); setSelectedComponentId(null); }}
                />
              ) : null;
            })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
