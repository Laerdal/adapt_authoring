import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddComponentDrawer from "../../components/course/AddComponentDrawer";
import AddTemplateDrawer from "../../components/course/AddTemplateDrawer";
import AssetPickerModal from "../../components/common/AssetPickerModal";
import CourseStructureMap from "../../components/course/CourseStructureMap";
import { StructureIcon, STRUCTURE_ICON_COLOR_CLASS } from "../../components/course/StructureIcons";
import { UnsavedChangesModal } from "../setup/unsavedChangesModal";
import PageEditorTopBar from "./pageEditorTopBar";
import PageEditorNavigation from "./pageEditorNavigation";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import {
  componentSchemaSupportsPropertiesField,
  createArticle,
  createComponent,
  deleteStructureNode,
  getCourseStructure,
  pasteTemplateIntoCourse,
  seedDefaultContentGroup,
  seedDefaultSection,
  seedDefaultTopic,
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
import { useAuth } from "../../context/AuthContext";

interface PreviewBuildResponse {
  success?: boolean;
  message?: string;
  payload?: {
    pollUrl?: string;
  };
}

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

type BreakpointKey = "_xlarge" | "_large" | "_medium" | "_small";

type TopicGraphicSettings = {
  src: string;
  alt: string;
};

type TopicResponsiveAssetMap = Partial<Record<BreakpointKey, string>>;

type TopicResponsiveClasses = Partial<Record<BreakpointKey, string>>;

type TopicBackgroundStyles = {
  _backgroundRepeat?: string;
  _backgroundSize?: string;
  _backgroundPosition?: string;
};

type TopicMinimumHeights = Partial<Record<BreakpointKey, number | "">>;

type TopicTextAlignment = {
  _title?: string;
  _subtitle?: string;
  _body?: string;
  _instruction?: string;
};

type TopicOnScreenSettings = {
  _isEnabled?: boolean;
  _classes?: string;
  _percentInviewVertical?: number | "";
};

type TopicThemeSettings = {
  _backgroundImage?: TopicResponsiveAssetMap;
  _backgroundStyles?: TopicBackgroundStyles;
  _responsiveClasses?: TopicResponsiveClasses;
  _pageHeader?: {
    _graphic?: {
      _src?: string;
      alt?: string;
    };
    _textAlignment?: TopicTextAlignment;
    _backgroundImage?: TopicResponsiveAssetMap;
    _backgroundStyles?: TopicBackgroundStyles;
    _minimumHeights?: TopicMinimumHeights;
  };
};

type TopicMenuSettings = {
  _graphic?: {
    _src?: string;
    alt?: string;
  };
  _skipSubmenuView?: boolean;
  lockedNotification?: string;
  _backgroundImage?: TopicResponsiveAssetMap;
  _backgroundStyles?: TopicBackgroundStyles;
  _menuHeader?: {
    _displayAboveHeader?: boolean;
    _textAlignment?: TopicTextAlignment;
    _backgroundImage?: TopicResponsiveAssetMap;
    _backgroundStyles?: TopicBackgroundStyles;
    _minimumHeights?: TopicMinimumHeights;
  };
};

type TopicAssetTarget =
  | { scope: "pageGraphic" }
  | { scope: "themePageBackground"; bp: BreakpointKey }
  | { scope: "themeHeaderGraphic" }
  | { scope: "themeHeaderBackground"; bp: BreakpointKey }
  | { scope: "menuGraphic" }
  | { scope: "menuBackground"; bp: BreakpointKey }
  | { scope: "menuHeaderBackground"; bp: BreakpointKey };

const BG_REPEAT_OPTIONS = ["", "repeat", "repeat-x", "repeat-y", "no-repeat"] as const;
const BG_SIZE_OPTIONS = ["", "auto", "cover", "contain", "100% 100%"] as const;
const BG_POSITION_OPTIONS = [
  "",
  "left top",
  "left center",
  "left bottom",
  "center top",
  "center center",
  "center bottom",
  "right top",
  "right center",
  "right bottom",
] as const;
const TEXT_ALIGN_OPTIONS = ["", "left", "center", "right"] as const;
const LOCK_TYPE_OPTIONS = ["", "custom", "lockLast", "sequential", "unlockFirst"] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumberOrEmpty(value: unknown): number | "" {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseNumberishInput(value: string): number | "" {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : "";
}

function toRenderableAssetUrl(source: string | undefined): string | null {
  const src = (source || "").trim();
  if (!src) return null;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("/")) return src;
  if (src.startsWith("course/assets/")) return `/${src}`;
  if (/^[a-f0-9]{24}$/i.test(src)) return `/api/asset/serve/${src}`;
  return src;
}

function TopicAccordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`w-full rounded-[8px] border bg-white overflow-hidden transition-colors ${
        open
          ? "border-[var(--life-primary-200)]"
          : "border-[#d8dee6] hover:border-[var(--life-primary-100)]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
          open
            ? "bg-[var(--life-primary-020)]"
            : "bg-white hover:bg-[var(--life-neutral-020)]"
        }`}
      >
        <h3 className="text-sm font-semibold text-[var(--life-base-black)]">{title}</h3>
        <svg
          className={`shrink-0 ml-auto transition-transform duration-200 text-[var(--life-primary-700)] ${open ? "rotate-90" : ""}`}
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open ? <div className="px-4 pb-4 pt-3 border-t border-[#eef2f6] flex flex-col gap-3">{children}</div> : null}
    </div>
  );
}

function TopicFieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-[#374151]">{children}</span>;
}

function TopicTextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <TopicFieldLabel>{label}</TopicFieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] text-[#111827] transition-colors ${readOnly ? "bg-[#f8fafc]" : "bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"}`}
      />
    </div>
  );
}

function TopicSelect({
  label,
  value,
  onChange,
  options,
  emptyOptionLabel = "Default",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  emptyOptionLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <TopicFieldLabel>{label}</TopicFieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[var(--life-base-black)] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent pr-8"
        >
          {options.map((option) => (
            <option key={option} value={option}>{option || emptyOptionLabel}</option>
          ))}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

function TopicCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#111827] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded-[8px] border-[#cbd5e1] text-[#2d6fa8] focus:ring-[#2d6fa8]"
      />
      <span>{label}</span>
    </label>
  );
}

function TopicAssetField({
  label,
  value,
  onPickAsset,
  onClear,
}: {
  label: string;
  value: string;
  onPickAsset: () => void;
  onClear: () => void;
}) {
  const previewUrl = toRenderableAssetUrl(value);

  return (
    <div className="border border-[var(--life-neutral-200)] rounded-lg p-3 flex flex-col gap-2.5">
      <div className="text-[13px] text-[var(--life-base-black)]">{label}</div>
      {previewUrl ? (
        <div className="border border-[var(--life-neutral-200)] rounded-[8px] overflow-hidden bg-[var(--life-neutral-020)]">
          <div className="h-24 w-full flex items-center justify-center overflow-hidden bg-[var(--life-neutral-020)]">
            <img src={previewUrl} alt={label} className="w-full h-full object-contain" />
          </div>
          <div className="px-2.5 py-2 border-t border-[var(--life-neutral-200)] text-[11px] text-[var(--life-neutral-500)] truncate">{value}</div>
        </div>
      ) : null}
      <div className="flex gap-2.5 flex-wrap">
        <button type="button" onClick={onPickAsset} className={`px-3 py-2 text-sm font-semibold rounded-[8px] transition-colors cursor-pointer flex items-center gap-1.5 ${value ? "border border-[var(--life-primary-500)] text-[var(--life-primary-500)] bg-white hover:bg-[var(--life-primary-020)]" : "bg-[var(--life-primary-500)] text-white hover:bg-[var(--life-primary-700)]"}`}>
          Select an Asset
        </button>
        {value ? (
          <button type="button" onClick={onClear} className="px-3 py-2 text-sm font-semibold rounded-[8px] border border-[var(--life-critical-500)] text-[var(--life-critical-500)] bg-white hover:bg-[var(--life-critical-050)] transition-colors cursor-pointer">
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

function cloneContentPages(pages: ContentPageData[]): ContentPageData[] {
  return JSON.parse(JSON.stringify(pages)) as ContentPageData[];
}

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
    subtitle?: string;
    body?: string;
    instruction?: string;
    graphic?: {
      src?: string;
      alt?: string;
    };
    themeSettings?: Record<string, unknown>;
    menuSettings?: Record<string, unknown>;
    linkText?: string;
    duration?: string;
    lockType?: string;
    lockedBy?: string[];
    classes?: string;
    isOptional?: boolean;
    isAvailable?: boolean;
    isHidden?: boolean;
    isVisible?: boolean;
    onScreen?: TopicOnScreenSettings;
    ariaLevel?: string;
    ariaLabel?: string;
    extensions?: Record<string, unknown>;
    displayTitle?: string;
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
          components: Array<{ id: string; title: string; componentKey: string; layout?: "full" | "left" | "right"; description?: string; instruction?: string; subtitle?: string; properties?: Record<string, unknown>; url?: string }>;
      }>;
    }>;
  }) => {
    const topicSubtitle = topic.subtitle || "";
    const topicBody = topic.body || topic.description || "";
    const topicInstruction = topic.instruction || "";

    pages.push({
      id: topic.id,
      title: topic.title || "Untitled Page",
      description: topic.description || "",
      subtitle: topicSubtitle,
      body: topicBody,
      instruction: topicInstruction,
      graphic: {
        src: topic.graphic?.src || "",
        alt: topic.graphic?.alt || "",
      },
      themeSettings: topic.themeSettings && typeof topic.themeSettings === "object"
        ? topic.themeSettings as TopicThemeSettings
        : {},
      menuSettings: topic.menuSettings && typeof topic.menuSettings === "object"
        ? topic.menuSettings as TopicMenuSettings
        : {},
      linkText: topic.linkText || "",
      duration: topic.duration || "",
      lockType: topic.lockType || "",
      lockedBy: Array.isArray(topic.lockedBy) ? topic.lockedBy : [],
      classes: topic.classes || "",
      isOptional: !!topic.isOptional,
      isAvailable: topic.isAvailable !== false,
      isHidden: !!topic.isHidden,
      isVisible: topic.isVisible !== false,
      onScreen: {
        _isEnabled: !!topic.onScreen?._isEnabled,
        _classes: topic.onScreen?._classes || "",
        _percentInviewVertical:
          typeof topic.onScreen?._percentInviewVertical === "number"
            ? topic.onScreen._percentInviewVertical
            : 50,
      },
      ariaLevel: topic.ariaLevel || "",
      ariaLabel: topic.ariaLabel || "",
      extensions:
        topic.extensions && typeof topic.extensions === "object"
          ? topic.extensions
          : {},
      showDisplayTitleInPreview:
        typeof topic.displayTitle === "string"
          ? topic.displayTitle.trim().length > 0
          : true,
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
              instruction:
                component.instruction ||
                (typeof component.properties?.instruction === "string"
                  ? component.properties.instruction
                  : ""),
              subtitle:
                component.subtitle ||
                (typeof component.properties?.subtitle === "string"
                  ? component.properties.subtitle
                  : ""),
              properties:
                component.properties && typeof component.properties === "object"
                  ? component.properties
                  : {},
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
    subtitle?: string;
    properties?: Record<string, unknown>;
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
  subtitle: string;
  body: string;
  instruction: string;
  graphic: TopicGraphicSettings;
  themeSettings: TopicThemeSettings;
  menuSettings: TopicMenuSettings;
  linkText: string;
  duration: string;
  lockType: string;
  lockedBy: string[];
  classes: string;
  isOptional: boolean;
  isAvailable: boolean;
  isHidden: boolean;
  isVisible: boolean;
  onScreen: TopicOnScreenSettings;
  ariaLevel: string;
  ariaLabel: string;
  extensions: Record<string, unknown>;
  showDisplayTitleInPreview: boolean;
  articles: ArticleData[];
  subPages: SubPageData[];
}

type PreviewHoverState = {
  pageId: string | null;
  articleId: string | null;
  blockId: string | null;
  componentId: string | null;
  level: "menu" | "topic" | "section" | "group" | "component" | null;
};

type SelectionSource = "leftPanel" | "preview" | "internal";

type PendingPreviewScrollTarget = {
  level: "menu" | "topic" | "section" | "group" | "component";
  id: string | null;
};

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
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRefreshToken, setPreviewRefreshToken] = useState(0);
  const [previewBuildVersion, setPreviewBuildVersion] = useState(0);
  const [previewHoverState, setPreviewHoverState] = useState<PreviewHoverState>({
    pageId: null,
    articleId: null,
    blockId: null,
    componentId: null,
    level: null,
  });

  const [contentPages, setContentPages] = useState<ContentPageData[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedSubPageId, setSelectedSubPageId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [hasCanvasSelection, setHasCanvasSelection] = useState(false);
  const [savedContentPages, setSavedContentPages] = useState<ContentPageData[]>([]);
  const [dirtyNodeKeys, setDirtyNodeKeys] = useState<Record<string, true>>({});
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [componentSubtitleSchemaSupport, setComponentSubtitleSchemaSupport] = useState<Record<string, boolean>>({});
  const [topicAssetPickerTarget, setTopicAssetPickerTarget] = useState<TopicAssetTarget | null>(null);
  const [copiedTopicId, setCopiedTopicId] = useState<string | null>(null);
  const [openTopicAccordions, setOpenTopicAccordions] = useState<Record<string, boolean>>({
    general: true,
    availability: false,
    accessibility: false,
    extensions: false,
    theme: false,
    menu: false,
    media: false,
    advanced: false,
  });
  const structureLoadRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const pendingGuardedActionRef = useRef<(() => void) | null>(null);
  const isInlineEditingRef = useRef(false);
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
  const previewBuildRequestIdRef = useRef(0);
  const copiedTopicIdResetTimerRef = useRef<number | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const cleanupPreviewListenersRef = useRef<(() => void) | null>(null);
  const pendingLeftPanelScrollTargetRef = useRef<PendingPreviewScrollTarget | null>(null);
  const hasUnsavedChanges = useMemo(() => Object.keys(dirtyNodeKeys).length > 0, [dirtyNodeKeys]);

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
      setSavedContentPages(cloneContentPages(pages));
      setDirtyNodeKeys({});
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

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!menuPageCreated || isLoadingStructure || !courseId || courseId === "new-course") {
      setIsPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    let isDisposed = false;
    const requestId = ++previewBuildRequestIdRef.current;
    const isCurrentRequest = () => !isDisposed && requestId === previewBuildRequestIdRef.current;

    const pollPreview = async (pollUrl: string) => {
      const normalizedUrl = new URL(pollUrl, window.location.origin).toString();

      while (isCurrentRequest()) {
        const response = await fetch(normalizedUrl, {
          credentials: "same-origin",
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(errorBody.message || `HTTP ${response.status}`);
        }

        const data = await response.json().catch(() => ({} as { progress?: string | number }));
        const progress = Number((data as { progress?: string | number }).progress ?? 100);
        if (!Number.isNaN(progress) && progress >= 100) {
          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
    };

    const buildPreview = async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);

      try {
        const result = await apiClient.get<PreviewBuildResponse>(`/api/output/adapt/preview/${courseId}?force=false`);
        if (!isCurrentRequest()) return;

        if (!result?.success) {
          throw new Error(result?.message || "Failed to generate course preview");
        }

        if (result.payload?.pollUrl) {
          await pollPreview(result.payload.pollUrl);
        }

        if (!isCurrentRequest()) return;
        setPreviewBuildVersion((current) => current + 1);
      } catch (error) {
        if (!isCurrentRequest()) return;
        setPreviewError(
          error instanceof Error ? error.message : "Failed to generate course preview"
        );
      } finally {
        if (isCurrentRequest()) {
          setIsPreviewLoading(false);
        }
      }
    };

    void buildPreview();

    return () => {
      isDisposed = true;
    };
  }, [courseId, isLoadingStructure, menuPageCreated, previewRefreshToken]);

  const previewSrc = useMemo(() => {
    if (!user?._tenantId || !courseId || courseId === "new-course" || !menuPageCreated) {
      return null;
    }

    const basePath = `/preview/${user._tenantId}/${courseId}/?_pe=${previewBuildVersion}`;
    if (selectedPageId && !menuSelected) {
      return `${basePath}#/id/${selectedPageId}`;
    }

    return basePath;
  }, [courseId, menuPageCreated, menuSelected, previewBuildVersion, selectedPageId, user]);

  const applyPreviewSelectionStyles = useCallback(() => {
    const iframe = previewFrameRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    doc.getElementById("adapt-authoring-preview-bridge-style")?.remove();

    const style = doc.createElement("style");
    style.id = "adapt-authoring-preview-bridge-style";
    style.textContent = `
      .adapt-authoring-preview-hover {
        border: 1px dashed var(--life-primary-500, #2e7fa1) !important;
        border-radius: 8px !important;
        position: relative !important;
        box-sizing: border-box !important;
      }

      .adapt-authoring-preview-hover-header {
        border: 1px dashed var(--life-primary-500, #2e7fa1) !important;
        border-radius: 8px !important;
        margin-top: 8px !important;
        margin-bottom: 8px !important;
        padding: 0.5rem !important;
        position: relative !important;
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      .adapt-authoring-preview-topic-shell-active {
        border: none !important;
      }

      .adapt-authoring-preview-active {
        border: 1px dashed var(--life-primary-500, #2e7fa1) !important;
        border-radius: 8px !important;
        position: relative !important;
        box-sizing: border-box !important;
      }

      .adapt-authoring-preview-active-header {
        border: 1px dashed var(--life-primary-500, #2e7fa1) !important;
        border-radius: 8px !important;
        margin-top: 8px !important;
        margin-bottom: 8px !important;
        padding: 0.5rem !important;
        position: relative !important;
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      .adapt-authoring-preview-hover-header::before,
      .adapt-authoring-preview-active-header::before,
      .adapt-authoring-preview-hover::before,
      .adapt-authoring-preview-active::before {
        content: attr(data-preview-bridge-label);
        display: block;
        color: var(--life-primary-500, #2e7fa1);
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        line-height: 1.2;
        margin-bottom: 8px;
        z-index: 9;
        pointer-events: none;
      }

      .block__header-inner.adapt-authoring-preview-hover-header,
      .block__header-inner.adapt-authoring-preview-active-header {
        margin-left: -0.5rem !important;
        margin-right: -0.5rem !important;
        width: calc(100% + 1rem) !important;
      }

      .component.adapt-authoring-preview-hover,
      .component.adapt-authoring-preview-active {
        margin-left: 0 !important;
        margin-right: 0 !important;
        width: 100% !important;
        padding: 0.5rem !important;
      }

      .component.adapt-authoring-preview-hover::before,
      .component.adapt-authoring-preview-active::before {
        position: static !important;
        top: auto !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        display: block !important;
        margin-left: 0 !important;
        margin-top: 0 !important;
        margin-bottom: 8px !important;
      }

      .adapt-authoring-preview-clickable {
        cursor: pointer !important;
      }

      .adapt-authoring-preview-inline-editable {
        outline: none !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        min-height: 1.2em;
      }

      .adapt-authoring-preview-inline-editable:focus {
        outline: none !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .adapt-authoring-preview-inline-empty::before {
        content: attr(data-placeholder);
        color: #9ca3af;
      }
    `;
    doc.head.appendChild(style);

    doc
      .querySelectorAll(".adapt-authoring-preview-hover, .adapt-authoring-preview-active, .adapt-authoring-preview-hover-header, .adapt-authoring-preview-active-header, .adapt-authoring-preview-clickable, .adapt-authoring-preview-topic-shell-active")
      .forEach((node) => {
        node.classList.remove(
          "adapt-authoring-preview-hover",
          "adapt-authoring-preview-active",
          "adapt-authoring-preview-hover-header",
          "adapt-authoring-preview-active-header",
          "adapt-authoring-preview-clickable",
          "adapt-authoring-preview-topic-shell-active"
        );
        node.removeAttribute("data-preview-bridge-label");
      });

    [".page", ".article", ".block", ".component", ".menu"].forEach((selector) => {
      doc.querySelectorAll(selector).forEach((node) => {
        node.classList.add("adapt-authoring-preview-clickable");
      });
    });

    const resolveHeaderTarget = (
      level: "menu" | "topic" | "section" | "group" | "component",
      id: string | null
    ): Element | null => {
      if (level === "menu") {
        const menuNode = doc.querySelector(".menu[data-adapt-id]");
        return menuNode?.querySelector(".menu__header-inner") ?? menuNode;
      }

      if (!id) return null;

      const base = doc.querySelector(`[data-adapt-id="${id}"]`);
      if (!base) return null;

      if (level === "topic") {
        return base.querySelector(".page__header-inner") ?? base;
      }

      if (level === "section") {
        return base.querySelector(".article__header-inner") ?? base;
      }

      if (level === "group") {
        return base.querySelector(".block__header-inner") ?? base;
      }

      return base;
    };

    const resolveContainerTarget = (
      level: "menu" | "topic" | "section" | "group" | "component",
      id: string | null
    ): Element | null => {
      if (level === "menu") {
        return doc.querySelector(".menu[data-adapt-id]");
      }

      if (!id) return null;

      const base = doc.querySelector(`[data-adapt-id="${id}"]`);
      if (!base) return null;

      if (level === "topic") {
        return base.closest(".page") ?? base;
      }

      return base;
    };

    const toBadgeLabel = (level: "menu" | "topic" | "section" | "group" | "component") => {
      if (level === "topic") return "Topic";
      if (level === "section") return "Section";
      if (level === "group") return "Content Group";
      if (level === "component") return "Component";
      return "Menu";
    };

    const hoverLevel = previewHoverState.level;
    const hoverTargetId =
      previewHoverState.componentId ??
      previewHoverState.blockId ??
      previewHoverState.articleId ??
      previewHoverState.pageId;

    const activeLevel: "menu" | "topic" | "section" | "group" | "component" | null =
      hasCanvasSelection
        ? menuSelected
          ? "menu"
          : selectedComponentId
            ? "component"
            : selectedBlockId
              ? "group"
              : selectedArticleId
                ? "section"
                : "topic"
        : null;

    const activeTargetId =
      hasCanvasSelection
        ? selectedComponentId ??
          selectedBlockId ??
          selectedArticleId ??
          (menuSelected ? null : selectedPageId)
        : null;

    if (menuSelected && hasCanvasSelection) {
      const menuNode = resolveHeaderTarget("menu", null);
      if (menuNode) {
        menuNode.classList.add("adapt-authoring-preview-active-header");
        (menuNode as Element).setAttribute("data-preview-bridge-label", toBadgeLabel("menu"));
      }
    }

    if (hoverTargetId && hoverLevel) {
      const hoverNode = resolveHeaderTarget(hoverLevel, hoverTargetId);
      if (hoverNode) {
        if (hoverLevel === "component") {
          hoverNode.classList.add("adapt-authoring-preview-hover");
        } else {
          hoverNode.classList.add("adapt-authoring-preview-hover-header");
        }
        (hoverNode as Element).setAttribute("data-preview-bridge-label", toBadgeLabel(hoverLevel));
      }
    }

    if (activeLevel && (activeTargetId || activeLevel === "menu")) {
      const activeNode = resolveHeaderTarget(activeLevel, activeTargetId);
      if (activeNode) {
        if (activeLevel === "component") {
          activeNode.classList.add("adapt-authoring-preview-active");
        } else {
          activeNode.classList.add("adapt-authoring-preview-active-header");
        }
        (activeNode as Element).setAttribute("data-preview-bridge-label", toBadgeLabel(activeLevel));
      }

      if (activeLevel === "topic") {
        const topicContainer = resolveContainerTarget("topic", activeTargetId);
        topicContainer?.classList.add("adapt-authoring-preview-topic-shell-active");
      }
    }
  }, [
    hasCanvasSelection,
    menuSelected,
    previewHoverState.articleId,
    previewHoverState.blockId,
    previewHoverState.componentId,
    previewHoverState.level,
    previewHoverState.pageId,
    selectedArticleId,
    selectedBlockId,
    selectedComponentId,
    selectedPageId,
  ]);

  const syncPreviewInlineEditors = useCallback(() => {
    const iframe = previewFrameRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    const clearEditable = () => {
      doc.querySelectorAll("[data-preview-edit-enabled='true']").forEach((node) => {
        const element = node as HTMLElement;
        const isInjected = element.getAttribute("data-preview-injected") === "true";
        const isEmpty = (element.textContent || "").trim().length === 0;
        node.removeAttribute("data-preview-edit-enabled");
        node.removeAttribute("data-preview-edit-field");
        node.removeAttribute("data-preview-node-level");
        node.removeAttribute("data-preview-page-id");
        node.removeAttribute("data-preview-article-id");
        node.removeAttribute("data-preview-block-id");
        node.removeAttribute("data-preview-component-id");
        node.removeAttribute("contenteditable");
        node.removeAttribute("spellcheck");
        node.removeAttribute("data-placeholder");
        node.classList.remove("adapt-authoring-preview-inline-editable", "adapt-authoring-preview-inline-empty");

        if (isInjected && isEmpty) {
          const parent = element.parentElement;
          element.remove();
          if (parent?.getAttribute("data-preview-injected") === "true" && !parent.textContent?.trim()) {
            parent.remove();
          }
        }
      });
    };

    const ensureElement = (
      host: Element,
      selector: string,
      className: string,
      tagName: "div" | "p",
      value: string
    ): HTMLElement => {
      const existing = host.querySelector(selector) as HTMLElement | null;
      if (existing) {
        return existing;
      }

      const next = doc.createElement(tagName);
      next.className = className;
      next.textContent = value;
      next.setAttribute("data-preview-injected", "true");
      host.appendChild(next);
      return next;
    };

    const ensureContainerInner = (
      host: Element,
      containerSelector: string,
      containerClassName: string,
      innerSelector: string,
      innerClassName: string,
      value: string,
      tagName: "div" | "p" = "div"
    ): HTMLElement => {
      const existingInner = host.querySelector(innerSelector) as HTMLElement | null;
      if (existingInner) {
        return existingInner;
      }

      let container = host.querySelector(containerSelector) as HTMLElement | null;
      if (!container) {
        container = doc.createElement("div");
        container.className = containerClassName;
        container.setAttribute("data-preview-injected", "true");
        host.appendChild(container);
      }

      const inner = doc.createElement(tagName);
      inner.className = innerClassName;
      inner.textContent = value;
      inner.setAttribute("data-preview-injected", "true");
      container.appendChild(inner);
      return inner;
    };

    const makeEditable = (
      element: HTMLElement,
      options: {
        level: "topic" | "section" | "group" | "component";
        field: "title" | "subtitle" | "body" | "instruction";
        placeholder: string;
        value: string;
        pageId: string;
        articleId?: string;
        blockId?: string;
        componentId?: string;
      }
    ) => {
      const isRichTextField =
        options.field === "body" ||
        options.field === "instruction" ||
        (options.level === "component" && options.field === "subtitle");
      if (isRichTextField) {
        if (element.innerHTML !== options.value) {
          element.innerHTML = options.value;
        }
      } else if (element.textContent !== options.value) {
        element.textContent = options.value;
      }
      element.setAttribute("data-preview-edit-enabled", "true");
      element.setAttribute("data-preview-edit-field", options.field);
      element.setAttribute("data-preview-node-level", options.level);
      element.setAttribute("data-preview-page-id", options.pageId);
      if (options.articleId) element.setAttribute("data-preview-article-id", options.articleId);
      if (options.blockId) element.setAttribute("data-preview-block-id", options.blockId);
      if (options.componentId) element.setAttribute("data-preview-component-id", options.componentId);
      element.setAttribute("contenteditable", "true");
      element.setAttribute("spellcheck", "false");
      element.classList.add("adapt-authoring-preview-inline-editable");

      const hasText = (options.value || "").trim().length > 0;
      if (!hasText) {
        element.classList.add("adapt-authoring-preview-inline-empty");
      } else {
        element.classList.remove("adapt-authoring-preview-inline-empty");
      }
      element.setAttribute("data-placeholder", options.placeholder);
    };

    clearEditable();

    if (!hasCanvasSelection) {
      return;
    }

    const selectedPage = selectedPageId
      ? contentPages.find((page) => page.id === selectedPageId)
      : null;
    const selectedArticle = selectedPage && selectedArticleId
      ? selectedPage.articles.find((article) => article.id === selectedArticleId)
      : null;
    const selectedBlock = selectedArticle && selectedBlockId
      ? selectedArticle.blocks.find((block) => block.id === selectedBlockId)
      : null;
    const selectedComponent = selectedBlock && selectedComponentId
      ? selectedBlock.components.find((component) => component.id === selectedComponentId)
      : null;

    if (selectedComponent && selectedBlock && selectedArticle && selectedPage) {
      const componentNode = doc.querySelector(`.component[data-adapt-id="${selectedComponent.id}"]`);
      const componentHost = (componentNode?.querySelector(".component__inner") ?? componentNode) as HTMLElement | null;
      if (!componentHost) return;

      const titleEl = ensureElement(componentHost, ".component__title-inner", "component__title-inner", "div", selectedComponent.settings.title || "");
      const bodyEl = ensureContainerInner(
        componentHost,
        ".component__body",
        "component__body",
        ".component__body-inner",
        "component__body-inner",
        selectedComponent.settings.description || ""
      );
      const instructionEl = ensureContainerInner(
        componentHost,
        ".component__instruction",
        "component__instruction",
        ".component__instruction-inner",
        "component__instruction-inner",
        selectedComponent.settings.instruction || ""
      );
      const componentProperties =
        selectedComponent.settings.properties &&
        typeof selectedComponent.settings.properties === "object" &&
        !Array.isArray(selectedComponent.settings.properties)
          ? selectedComponent.settings.properties
          : {};
      const componentKey = (selectedComponent.settings.componentKey || "").toLowerCase();
      const hasComponentSubtitle =
        ((selectedComponent.settings.subtitle || "").trim().length > 0) ||
        Object.prototype.hasOwnProperty.call(componentProperties, "subtitle") ||
        componentSubtitleSchemaSupport[componentKey] === true;
      const subtitleEl = hasComponentSubtitle
        ? ensureElement(
            componentHost,
            ".laerdal-text__subtitle",
            "laerdal-text__subtitle",
            "div",
            selectedComponent.settings.subtitle || ""
          )
        : null;

      makeEditable(titleEl, {
        level: "component",
        field: "title",
        placeholder: "Component title",
        value: selectedComponent.settings.title || "",
        pageId: selectedPage.id,
        articleId: selectedArticle.id,
        blockId: selectedBlock.id,
        componentId: selectedComponent.id,
      });
      makeEditable(bodyEl, {
        level: "component",
        field: "body",
        placeholder: "Add component body",
        value: selectedComponent.settings.description || "",
        pageId: selectedPage.id,
        articleId: selectedArticle.id,
        blockId: selectedBlock.id,
        componentId: selectedComponent.id,
      });
      makeEditable(instructionEl, {
        level: "component",
        field: "instruction",
        placeholder: "Add component instruction",
        value: selectedComponent.settings.instruction || "",
        pageId: selectedPage.id,
        articleId: selectedArticle.id,
        blockId: selectedBlock.id,
        componentId: selectedComponent.id,
      });
      if (subtitleEl) {
        makeEditable(subtitleEl, {
          level: "component",
          field: "subtitle",
          placeholder: "Add component subtitle",
          value: selectedComponent.settings.subtitle || "",
          pageId: selectedPage.id,
          articleId: selectedArticle.id,
          blockId: selectedBlock.id,
          componentId: selectedComponent.id,
        });
      }
      return;
    }

    if (selectedBlock && selectedArticle && selectedPage) {
      const blockNode = doc.querySelector(`.block[data-adapt-id="${selectedBlock.id}"]`);
      const blockHeader = blockNode?.querySelector(".block__header-inner") as HTMLElement | null;
      if (!blockHeader) return;

      const titleEl = ensureElement(blockHeader, ".block__title-inner", "block__title-inner", "div", selectedBlock.title || "");
      const bodyEl = ensureContainerInner(
        blockHeader,
        ".block__body",
        "block__body",
        ".block__body-inner",
        "block__body-inner",
        selectedBlock.description || ""
      );
      const instructionEl = ensureContainerInner(
        blockHeader,
        ".block__instruction",
        "block__instruction",
        ".block__instruction-inner",
        "block__instruction-inner",
        selectedBlock.instruction || ""
      );

      makeEditable(titleEl, {
        level: "group",
        field: "title",
        placeholder: "Content Group title",
        value: selectedBlock.title || "",
        pageId: selectedPage.id,
        articleId: selectedArticle.id,
        blockId: selectedBlock.id,
      });
      makeEditable(bodyEl, {
        level: "group",
        field: "body",
        placeholder: "Add content group body",
        value: selectedBlock.description || "",
        pageId: selectedPage.id,
        articleId: selectedArticle.id,
        blockId: selectedBlock.id,
      });
      makeEditable(instructionEl, {
        level: "group",
        field: "instruction",
        placeholder: "Add content group instruction",
        value: selectedBlock.instruction || "",
        pageId: selectedPage.id,
        articleId: selectedArticle.id,
        blockId: selectedBlock.id,
      });
      return;
    }

    if (selectedArticle && selectedPage) {
      const articleNode = doc.querySelector(`.article[data-adapt-id="${selectedArticle.id}"]`);
      const articleHeader = articleNode?.querySelector(".article__header-inner") as HTMLElement | null;
      if (!articleHeader) return;

      const titleEl = ensureElement(articleHeader, ".article__title-inner", "article__title-inner", "div", selectedArticle.title || "");
      const bodyEl = ensureContainerInner(
        articleHeader,
        ".article__body",
        "article__body",
        ".article__body-inner",
        "article__body-inner",
        selectedArticle.description || ""
      );
      const instructionEl = ensureContainerInner(
        articleHeader,
        ".article__instruction",
        "article__instruction",
        ".article__instruction-inner",
        "article__instruction-inner",
        selectedArticle.instruction || ""
      );

      makeEditable(titleEl, {
        level: "section",
        field: "title",
        placeholder: "Section title",
        value: selectedArticle.title || "",
        pageId: selectedPage.id,
        articleId: selectedArticle.id,
      });
      makeEditable(bodyEl, {
        level: "section",
        field: "body",
        placeholder: "Add section body",
        value: selectedArticle.description || "",
        pageId: selectedPage.id,
        articleId: selectedArticle.id,
      });
      makeEditable(instructionEl, {
        level: "section",
        field: "instruction",
        placeholder: "Add section instruction",
        value: selectedArticle.instruction || "",
        pageId: selectedPage.id,
        articleId: selectedArticle.id,
      });
      return;
    }

    if (selectedPage && !menuSelected) {
      const pageNode = doc.querySelector(`.page[data-adapt-id="${selectedPage.id}"]`);
      const pageHeader = pageNode?.querySelector(".page__header-inner") as HTMLElement | null;
      if (!pageHeader) return;

      const previewTopicTitle = selectedPage.showDisplayTitleInPreview
        ? (selectedPage.title || "")
        : "";
      const titleEl = ensureElement(pageHeader, ".page__title-inner", "page__title-inner", "div", previewTopicTitle);
      const subtitleEl = ensureContainerInner(
        pageHeader,
        ".page__subtitle",
        "page__subtitle",
        ".page__subtitle-inner",
        "page__subtitle-inner",
        selectedPage.subtitle || ""
      );
      const bodyEl = ensureContainerInner(
        pageHeader,
        ".page__body",
        "page__body",
        ".page__body-inner",
        "page__body-inner",
        selectedPage.body || ""
      );
      const instructionEl = ensureContainerInner(
        pageHeader,
        ".page__instruction",
        "page__instruction",
        ".page__instruction-inner",
        "page__instruction-inner",
        selectedPage.instruction || ""
      );

      const titleContainer = titleEl.closest(".page__title") as HTMLElement | null;
      if (titleContainer) {
        titleContainer.style.display = selectedPage.showDisplayTitleInPreview ? "" : "none";
      } else {
        titleEl.style.display = selectedPage.showDisplayTitleInPreview ? "" : "none";
      }
      if (selectedPage.showDisplayTitleInPreview) {
        makeEditable(titleEl, {
          level: "topic",
          field: "title",
          placeholder: "TOPIC TITLE",
          value: selectedPage.title || "",
          pageId: selectedPage.id,
        });
      }
      makeEditable(subtitleEl, {
        level: "topic",
        field: "subtitle",
        placeholder: "Add subtitle",
        value: selectedPage.subtitle || "",
        pageId: selectedPage.id,
      });
      makeEditable(bodyEl, {
        level: "topic",
        field: "body",
        placeholder: "Add page body",
        value: selectedPage.body || "",
        pageId: selectedPage.id,
      });
      makeEditable(instructionEl, {
        level: "topic",
        field: "instruction",
        placeholder: "Add page instruction",
        value: selectedPage.instruction || "",
        pageId: selectedPage.id,
      });
    }
  }, [
    hasCanvasSelection,
    componentSubtitleSchemaSupport,
    contentPages,
    menuSelected,
    selectedArticleId,
    selectedBlockId,
    selectedComponentId,
    selectedPageId,
  ]);

  const syncPreviewScrollFromLeftPanel = useCallback(() => {
    const iframe = previewFrameRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    const getVisibleRatio = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const viewportHeight = doc.documentElement.clientHeight;
      const viewportWidth = doc.documentElement.clientWidth;

      if (rect.width <= 0 || rect.height <= 0 || viewportHeight <= 0 || viewportWidth <= 0) {
        return 0;
      }

      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
      );
      const visibleWidth = Math.max(
        0,
        Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
      );

      const visibleArea = visibleHeight * visibleWidth;
      const totalArea = rect.height * rect.width;
      return totalArea > 0 ? visibleArea / totalArea : 0;
    };

    const ensureMostlyVisible = (element: Element) => {
      const MIN_VISIBLE_RATIO = 0.85;
      if (getVisibleRatio(element) < MIN_VISIBLE_RATIO) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    };

    const pendingTarget = pendingLeftPanelScrollTargetRef.current;
    if (!pendingTarget) return;

    if (pendingTarget.level === "menu") {
      const menuNode = doc.querySelector(".menu[data-adapt-id]");
      if (!menuNode) return;
      ensureMostlyVisible(menuNode);
      pendingLeftPanelScrollTargetRef.current = null;
      return;
    }

    if (!pendingTarget.id) return;

    const base = doc.querySelector(`[data-adapt-id="${pendingTarget.id}"]`);
    if (!base) return;

    const target = pendingTarget.level === "topic"
      ? base.querySelector(".page__header-inner") ?? base
      : pendingTarget.level === "section"
        ? base.querySelector(".article__header-inner") ?? base
        : pendingTarget.level === "group"
          ? base.querySelector(".block__header-inner") ?? base
          : base;

    if (!target) return;

    ensureMostlyVisible(target);

    pendingLeftPanelScrollTargetRef.current = null;
  }, []);

  const queuePreviewScrollFromLeftPanel = useCallback((target: PendingPreviewScrollTarget) => {
    pendingLeftPanelScrollTargetRef.current = target;
    syncPreviewScrollFromLeftPanel();
  }, [syncPreviewScrollFromLeftPanel]);

  const clearCanvasSelection = useCallback(() => {
    if (!menuPageCreated) return;

    setMenuSelected(false);
    setSelectedSubPageId(null);
    setSelectedArticleId(null);
    setSelectedBlockId(null);
    setSelectedComponentId(null);
    setHasCanvasSelection(false);
    setRightPanelOpen(false);
  }, [menuPageCreated]);

  useEffect(() => {
    if (!selectedPageId || !selectedArticleId || !selectedBlockId || !selectedComponentId) {
      return;
    }

    const page = contentPages.find((p) => p.id === selectedPageId);
    const article = page?.articles.find((a) => a.id === selectedArticleId);
    const block = article?.blocks.find((b) => b.id === selectedBlockId);
    const component = block?.components.find((c) => c.id === selectedComponentId);
    const componentKey = (component?.settings?.componentKey || "").toLowerCase();
    if (!componentKey) return;

    if (componentSubtitleSchemaSupport[componentKey] !== undefined) {
      return;
    }

    let cancelled = false;
    void componentSchemaSupportsPropertiesField(componentKey, "subtitle")
      .then((supported) => {
        if (cancelled) return;
        setComponentSubtitleSchemaSupport((prev) => ({
          ...prev,
          [componentKey]: supported,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setComponentSubtitleSchemaSupport((prev) => ({
          ...prev,
          [componentKey]: false,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    componentSubtitleSchemaSupport,
    contentPages,
    selectedArticleId,
    selectedBlockId,
    selectedComponentId,
    selectedPageId,
  ]);

  const handlePreviewFrameLoad = useCallback(() => {
    const iframe = previewFrameRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    const resolvePreviewIds = (target: Element | null): PreviewHoverState => {
      const isComponent = !!target?.closest(".component");
      const isBlock = !!target?.closest(".block");
      const isArticle = !!target?.closest(".article");
      const isPage = !!target?.closest(".page");
      const isMenu = !!target?.closest(".menu[data-adapt-id]");

      const level = isComponent
        ? "component"
        : isBlock
          ? "group"
          : isArticle
            ? "section"
            : isPage
              ? "topic"
              : isMenu
                ? "menu"
                : null;

      const pageId = target?.closest(".page")?.getAttribute("data-adapt-id") ?? null;
      const articleId = target?.closest(".article")?.getAttribute("data-adapt-id") ?? null;
      const blockId = target?.closest(".block")?.getAttribute("data-adapt-id") ?? null;
      const componentId = target?.closest(".component")?.getAttribute("data-adapt-id") ?? null;

      return {
        pageId,
        articleId,
        blockId,
        componentId,
        level,
      };
    };

    const findArticleParent = (pageId: string, articleId: string) => {
      const page = contentPages.find((candidate) => candidate.id === pageId);
      if (!page) return null;
      return page.articles.find((candidate) => candidate.id === articleId) ?? null;
    };

    const resolveTopicField = (
      editableNode: HTMLElement,
      currentField: "title" | "subtitle" | "body" | "instruction" | null
    ) => {
      if (!currentField || (currentField !== "title" && currentField !== "subtitle")) {
        return currentField;
      }

      if (editableNode.matches(".page__title-inner") || editableNode.closest(".page__title")) {
        return "title" as const;
      }

      if (editableNode.matches(".page__subtitle-inner") || editableNode.closest(".page__subtitle")) {
        return "subtitle" as const;
      }

      return currentField;
    };

    const onMouseOver = (event: Event) => {
      const state = resolvePreviewIds(event.target as Element | null);
      setPreviewHoverState(state);
    };

    const onMouseOut = (event: MouseEvent) => {
      const relatedTarget = event.relatedTarget as Node | null;
      if (relatedTarget && doc.contains(relatedTarget)) return;
      setPreviewHoverState({ pageId: null, articleId: null, blockId: null, componentId: null, level: null });
    };

    const onClick = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;

      const clickedSelectableHeader = target.closest(
        ".page__header-inner, .article__header-inner, .block__header-inner, .component__inner, .menu[data-adapt-id]"
      );
      if (!clickedSelectableHeader) {
        event.preventDefault();
        event.stopPropagation();
        clearCanvasSelection();
        return;
      }

      const componentId = target.closest(".component")?.getAttribute("data-adapt-id");
      const blockId = target.closest(".block")?.getAttribute("data-adapt-id");
      const articleId = target.closest(".article")?.getAttribute("data-adapt-id");
      const pageId = target.closest(".page")?.getAttribute("data-adapt-id");
      const isMenu = !!target.closest(".menu[data-adapt-id]");

      if (!isMenu && !pageId && !articleId && !blockId && !componentId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (componentId && blockId && articleId && pageId) {
        handleSelectComponent(pageId, articleId, blockId, componentId, "preview");
        return;
      }

      if (blockId && articleId && pageId) {
        handleBlockSelect(pageId, articleId, blockId, "preview");
        return;
      }

      if (articleId && pageId) {
        const article = findArticleParent(pageId, articleId);
        if (article) {
          handleArticleSelect(pageId, article.id, "preview");
          return;
        }
      }

      if (pageId) {
        handlePageSelect(pageId, "preview");
        return;
      }

      if (isMenu) {
        handleMenuSelect("preview");
      }
    };

    const onInput = (event: Event) => {
      const origin = event.target as Element | null;
      const target = origin?.closest("[data-preview-edit-enabled='true']") as HTMLElement | null;
      if (!target) return;
      isInlineEditingRef.current = true;

      const field = target.getAttribute("data-preview-edit-field") as
        | "title"
        | "subtitle"
        | "body"
        | "instruction"
        | null;
      const level = target.getAttribute("data-preview-node-level") as
        | "topic"
        | "section"
        | "group"
        | "component"
        | null;
      const pageId = target.getAttribute("data-preview-page-id");
      const articleId = target.getAttribute("data-preview-article-id");
      const blockId = target.getAttribute("data-preview-block-id");
      const componentId = target.getAttribute("data-preview-component-id");
      const isComponentSubtitle = level === "component" && field === "subtitle";
      const value = field === "body" || field === "instruction" || isComponentSubtitle
        ? target.innerHTML
        : (target.textContent || "").trim();

      const hasText = (target.textContent || "").trim().length > 0;
      if (!hasText) {
        target.classList.add("adapt-authoring-preview-inline-empty");
      } else {
        target.classList.remove("adapt-authoring-preview-inline-empty");
      }

      if (!field || !level || !pageId) return;

      const resolvedField = level === "topic" ? resolveTopicField(target, field) : field;

      if (level === "topic") {
        if (resolvedField === "title") updatePageData(pageId, { title: value });
        if (resolvedField === "subtitle") updatePageData(pageId, { subtitle: value });
        if (resolvedField === "body") updatePageData(pageId, { body: value, description: value });
        if (resolvedField === "instruction") updatePageData(pageId, { instruction: value });
        return;
      }

      if (level === "section" && articleId) {
        if (field === "title") updateArticle(pageId, articleId, { title: value });
        if (field === "body") updateArticle(pageId, articleId, { description: value });
        if (field === "instruction") updateArticle(pageId, articleId, { instruction: value });
        return;
      }

      if (level === "group" && articleId && blockId) {
        if (field === "title") updateBlock(pageId, articleId, blockId, { title: value });
        if (field === "body") updateBlock(pageId, articleId, blockId, { description: value });
        if (field === "instruction") updateBlock(pageId, articleId, blockId, { instruction: value });
        return;
      }

      if (level === "component" && articleId && blockId && componentId) {
        if (field === "title") {
          updateComponent(pageId, articleId, blockId, componentId, {
            settings: { title: value },
          });
        }
        if (field === "body") {
          updateComponent(pageId, articleId, blockId, componentId, {
            settings: { description: value },
          });
        }
        if (field === "instruction") {
          updateComponent(pageId, articleId, blockId, componentId, {
            settings: {
              instruction: value,
              properties: { instruction: value },
            },
          });
        }
        if (field === "subtitle") {
          updateComponent(pageId, articleId, blockId, componentId, {
            settings: {
              subtitle: value,
              properties: { subtitle: value },
            },
          });
        }
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const origin = event.target as Element | null;
      const target = origin?.closest("[data-preview-edit-enabled='true']") as HTMLElement | null;
      if (!target) return;
      isInlineEditingRef.current = true;
    };

    const onFocusOut = (event: FocusEvent) => {
      const origin = event.target as Element | null;
      const target = origin?.closest("[data-preview-edit-enabled='true']") as HTMLElement | null;
      if (!target) return;
      isInlineEditingRef.current = false;

      const field = target.getAttribute("data-preview-edit-field") as
        | "title"
        | "subtitle"
        | "body"
        | "instruction"
        | null;
      const level = target.getAttribute("data-preview-node-level") as
        | "topic"
        | "section"
        | "group"
        | "component"
        | null;
      const pageId = target.getAttribute("data-preview-page-id");
      const articleId = target.getAttribute("data-preview-article-id");
      const blockId = target.getAttribute("data-preview-block-id");
      const componentId = target.getAttribute("data-preview-component-id");
      const value = (target.textContent || "").trim();
      const isComponentSubtitle = level === "component" && field === "subtitle";
      const normalizedValue = field === "body" || field === "instruction" || isComponentSubtitle
        ? target.innerHTML
        : value;

      if (!field || !level || !pageId) return;

      const resolvedField = level === "topic" ? resolveTopicField(target, field) : field;

      if (level === "topic") {
        if (resolvedField === "title") {
          updatePageData(pageId, { title: normalizedValue });
          return;
        }
        if (resolvedField === "subtitle") {
          updatePageData(pageId, { subtitle: normalizedValue });
          return;
        }
        if (resolvedField === "body") {
          updatePageData(pageId, { body: normalizedValue, description: normalizedValue });
          return;
        }
        if (resolvedField === "instruction") {
          updatePageData(pageId, { instruction: normalizedValue });
        }
        return;
      }

      if (level === "section" && articleId) {
        if (field === "title") {
          updateArticle(pageId, articleId, { title: normalizedValue });
          return;
        }
        if (field === "body") {
          updateArticle(pageId, articleId, { description: normalizedValue });
          return;
        }
        if (field === "instruction") {
          updateArticle(pageId, articleId, { instruction: normalizedValue });
        }
        return;
      }

      if (level === "group" && articleId && blockId) {
        if (field === "title") {
          updateBlock(pageId, articleId, blockId, { title: normalizedValue });
          return;
        }
        if (field === "body") {
          updateBlock(pageId, articleId, blockId, { description: normalizedValue });
          return;
        }
        if (field === "instruction") {
          updateBlock(pageId, articleId, blockId, { instruction: normalizedValue });
        }
        return;
      }

      if (level === "component" && articleId && blockId && componentId) {
        if (field === "title") {
          updateComponent(pageId, articleId, blockId, componentId, {
            settings: { title: normalizedValue },
          });
          return;
        }
        if (field === "body") {
          updateComponent(pageId, articleId, blockId, componentId, {
            settings: { description: normalizedValue },
          });
          return;
        }
        if (field === "instruction") {
          updateComponent(pageId, articleId, blockId, componentId, {
            settings: {
              instruction: normalizedValue,
              properties: { instruction: normalizedValue },
            },
          });
        }
        if (field === "subtitle") {
          updateComponent(pageId, articleId, blockId, componentId, {
            settings: {
              subtitle: normalizedValue,
              properties: { subtitle: normalizedValue },
            },
          });
        }
      }
    };

    cleanupPreviewListenersRef.current?.();

    doc.addEventListener("mouseover", onMouseOver);
    doc.addEventListener("mouseout", onMouseOut);
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("focusin", onFocusIn, true);
    doc.addEventListener("input", onInput, true);
    doc.addEventListener("focusout", onFocusOut, true);

    applyPreviewSelectionStyles();
    syncPreviewInlineEditors();
    syncPreviewScrollFromLeftPanel();

    cleanupPreviewListenersRef.current = () => {
      doc.removeEventListener("mouseover", onMouseOver);
      doc.removeEventListener("mouseout", onMouseOut);
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("focusin", onFocusIn, true);
      doc.removeEventListener("input", onInput, true);
      doc.removeEventListener("focusout", onFocusOut, true);
    };

    return cleanupPreviewListenersRef.current;
  }, [
    applyPreviewSelectionStyles,
    clearCanvasSelection,
    contentPages,
    handleArticleSelect,
    handleBlockSelect,
    handleMenuSelect,
    handlePageSelect,
    handleSelectComponent,
    syncPreviewInlineEditors,
    syncPreviewScrollFromLeftPanel,
    contentPages,
  ]);

  useEffect(() => {
    applyPreviewSelectionStyles();
  }, [applyPreviewSelectionStyles]);

  useEffect(() => {
    if (isInlineEditingRef.current) return;
    syncPreviewInlineEditors();
  }, [syncPreviewInlineEditors]);

  useEffect(() => {
    syncPreviewScrollFromLeftPanel();
  }, [
    menuSelected,
    selectedPageId,
    selectedArticleId,
    selectedBlockId,
    selectedComponentId,
    syncPreviewScrollFromLeftPanel,
  ]);

  useEffect(() => () => {
    cleanupPreviewListenersRef.current?.();
    if (copiedTopicIdResetTimerRef.current !== null) {
      window.clearTimeout(copiedTopicIdResetTimerRef.current);
      copiedTopicIdResetTimerRef.current = null;
    }
  }, []);

  function handleCopyTopicId(topicId: string) {
    if (!topicId) return;

    const afterCopy = () => {
      setCopiedTopicId(topicId);
      if (copiedTopicIdResetTimerRef.current !== null) {
        window.clearTimeout(copiedTopicIdResetTimerRef.current);
      }
      copiedTopicIdResetTimerRef.current = window.setTimeout(() => {
        setCopiedTopicId((current) => (current === topicId ? null : current));
        copiedTopicIdResetTimerRef.current = null;
      }, 2000);
    };

    const fallbackCopy = () => {
      const helperTextArea = document.createElement("textarea");
      helperTextArea.value = topicId;
      helperTextArea.style.position = "fixed";
      helperTextArea.style.left = "-9999px";
      document.body.appendChild(helperTextArea);
      helperTextArea.focus();
      helperTextArea.select();
      document.execCommand("copy");
      document.body.removeChild(helperTextArea);
      afterCopy();
    };

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(topicId)
        .then(afterCopy)
        .catch(fallbackCopy);
      return;
    }

    fallbackCopy();
  }

  function handleMenuPageCreate() {
    setMenuPageCreated(true);
    setMenuSelected(true);
    setRightPanelOpen(true);
  }

  function updateMenuData(patch: Partial<MenuPageData>) {
    setMenuData((prev) => ({ ...prev, ...patch }));
  }

  function toggleTopicAccordion(id: "general" | "availability" | "accessibility" | "extensions" | "theme" | "menu" | "media" | "advanced") {
    setOpenTopicAccordions((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleCanvasClick() {
    clearCanvasSelection();
  }

  function handleMenuSelect(source: SelectionSource = "internal") {
    setMenuSelected(true);
    setSelectedPageId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("menu");
    if (source === "leftPanel") {
      queuePreviewScrollFromLeftPanel({ level: "menu", id: null });
    }
  }

  async function handleAddPage() {
    try {
      const newPageId = await seedDefaultTopic(courseId, courseId, NEW_TOPIC_TITLE, contentPages.length + 1);
      await loadStructureFromDatabase({ pageId: newPageId });
    } catch (error) {
      console.error("Failed to add topic", error);
    }
  }

  async function handleAddArticle(pageId: string) {
    try {
      const page = contentPages.find((item) => item.id === pageId);
      const newArticleId = await seedDefaultSection(courseId, pageId, NEW_SECTION_TITLE, (page?.articles.length ?? 0) + 1);
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
    setContentPages((previousPages) =>
      previousPages.map((p) =>
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
    setDirtyNodeKeys((prev) => ({ ...prev, [`section:${articleId}`]: true }));
  }

  function updateSubPage(pageId: string, subPageId: string, patch: Partial<SubPageData>) {
    setContentPages((previousPages) =>
      previousPages.map((p) =>
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

  function handleArticleSelect(pageId: string, articleId: string, source: SelectionSource = "internal") {
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedSubPageId(null);
    setSelectedBlockId(null);
    setSelectedComponentId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("article");
    if (source === "leftPanel") {
      queuePreviewScrollFromLeftPanel({ level: "section", id: articleId });
    }
  }

  function handleBlockSelect(pageId: string, articleId: string, blockId: string, source: SelectionSource = "internal") {
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedSubPageId(null);
    setSelectedBlockId(blockId);
    setSelectedComponentId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("block");
    if (source === "leftPanel") {
      queuePreviewScrollFromLeftPanel({ level: "group", id: blockId });
    }
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

  function handleSubPageSelect(pageId: string, subPageId: string, source: SelectionSource = "internal") {
    setSelectedPageId(pageId);
    setSelectedSubPageId(subPageId);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("subpage");
    if (source === "leftPanel") {
      queuePreviewScrollFromLeftPanel({ level: "topic", id: pageId });
    }
  }

  function handlePageSelect(pageId: string, source: SelectionSource = "internal") {
    setSelectedPageId(pageId);
    setMenuSelected(false);
    setSelectedSubPageId(null);
    setSelectedArticleId(null);
    setSelectedBlockId(null);
    setSelectedComponentId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("page");
    if (source === "leftPanel") {
      queuePreviewScrollFromLeftPanel({ level: "topic", id: pageId });
    }
  }

  function updatePageData(pageId: string, patch: Partial<ContentPageData>) {
    setContentPages((previousPages) =>
      previousPages.map((p) => (p.id === pageId ? { ...p, ...patch } : p))
    );
    setDirtyNodeKeys((prev) => ({ ...prev, [`topic:${pageId}`]: true }));
  }

  function updatePageGraphic(pageId: string, updater: (current: TopicGraphicSettings) => TopicGraphicSettings) {
    setContentPages((previousPages) =>
      previousPages.map((p) =>
        p.id === pageId
          ? { ...p, graphic: updater(p.graphic ?? { src: "", alt: "" }) }
          : p
      )
    );
    setDirtyNodeKeys((prev) => ({ ...prev, [`topic:${pageId}`]: true }));
  }

  function updatePageThemeSettings(pageId: string, updater: (current: TopicThemeSettings) => TopicThemeSettings) {
    setContentPages((previousPages) =>
      previousPages.map((p) =>
        p.id === pageId
          ? { ...p, themeSettings: updater((p.themeSettings ?? {}) as TopicThemeSettings) }
          : p
      )
    );
    setDirtyNodeKeys((prev) => ({ ...prev, [`topic:${pageId}`]: true }));
  }

  function updatePageMenuSettings(pageId: string, updater: (current: TopicMenuSettings) => TopicMenuSettings) {
    setContentPages((previousPages) =>
      previousPages.map((p) =>
        p.id === pageId
          ? { ...p, menuSettings: updater((p.menuSettings ?? {}) as TopicMenuSettings) }
          : p
      )
    );
    setDirtyNodeKeys((prev) => ({ ...prev, [`topic:${pageId}`]: true }));
  }

  function applyTopicAssetSelection(pageId: string, target: TopicAssetTarget, assetLink: string) {
    if (target.scope === "pageGraphic") {
      updatePageGraphic(pageId, (current) => ({ ...current, src: assetLink }));
      return;
    }

    if (target.scope === "themeHeaderGraphic") {
      updatePageThemeSettings(pageId, (current) => ({
        ...current,
        _pageHeader: {
          ...asRecord(current._pageHeader),
          _graphic: {
            ...asRecord(asRecord(current._pageHeader)._graphic),
            _src: assetLink,
          },
        },
      }));
      return;
    }

    if (target.scope === "themePageBackground") {
      updatePageThemeSettings(pageId, (current) => ({
        ...current,
        _backgroundImage: {
          ...asRecord(current._backgroundImage),
          [target.bp]: assetLink,
        },
      }));
      return;
    }

    if (target.scope === "themeHeaderBackground") {
      updatePageThemeSettings(pageId, (current) => ({
        ...current,
        _pageHeader: {
          ...asRecord(current._pageHeader),
          _backgroundImage: {
            ...asRecord(asRecord(current._pageHeader)._backgroundImage),
            [target.bp]: assetLink,
          },
        },
      }));
      return;
    }

    if (target.scope === "menuGraphic") {
      updatePageMenuSettings(pageId, (current) => ({
        ...current,
        _graphic: {
          ...asRecord(current._graphic),
          _src: assetLink,
        },
      }));
      return;
    }

    if (target.scope === "menuBackground") {
      updatePageMenuSettings(pageId, (current) => ({
        ...current,
        _backgroundImage: {
          ...asRecord(current._backgroundImage),
          [target.bp]: assetLink,
        },
      }));
      return;
    }

    updatePageMenuSettings(pageId, (current) => ({
      ...current,
      _menuHeader: {
        ...asRecord(current._menuHeader),
        _backgroundImage: {
          ...asRecord(asRecord(current._menuHeader)._backgroundImage),
          [target.bp]: assetLink,
        },
      },
    }));
  }

  function clearTopicAssetSelection(pageId: string, target: TopicAssetTarget) {
    applyTopicAssetSelection(pageId, target, "");
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
      const newBlockId = await seedDefaultContentGroup(courseId, articleId, NEW_CONTENT_GROUP_TITLE, (article?.blocks.length ?? 0) + 1);
      await loadStructureFromDatabase({ pageId, articleId, blockId: newBlockId });
    } catch (error) {
      console.error("Failed to add content group", error);
    }
  }

  function updateBlock(pageId: string, articleId: string, blockId: string, patch: Partial<BlockData>) {
    setContentPages((previousPages) =>
      previousPages.map((p) =>
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
    setDirtyNodeKeys((prev) => ({ ...prev, [`contentGroup:${blockId}`]: true }));
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
    setContentPages((previousPages) =>
      previousPages.map((p) =>
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
                                c.id === componentId
                                  ? {
                                      ...c,
                                      ...patch,
                                      settings: (() => {
                                        const mergedSettings = {
                                          ...c.settings,
                                          ...(patch.settings ?? {}),
                                        };

                                        const nextProperties = patch.settings?.properties;
                                        if (
                                          nextProperties &&
                                          typeof nextProperties === "object" &&
                                          !Array.isArray(nextProperties)
                                        ) {
                                          const currentProperties =
                                            c.settings?.properties &&
                                            typeof c.settings.properties === "object" &&
                                            !Array.isArray(c.settings.properties)
                                              ? c.settings.properties
                                              : {};

                                          mergedSettings.properties = {
                                            ...currentProperties,
                                            ...nextProperties,
                                          };
                                        }

                                        return mergedSettings;
                                      })(),
                                    }
                                  : c
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
    setDirtyNodeKeys((prev) => ({ ...prev, [`component:${componentId}`]: true }));
  }

  async function saveDraftChanges(): Promise<boolean> {
    if (!hasUnsavedChanges) {
      return true;
    }

    const pages = contentPages;
    const findPage = (pageId: string) => pages.find((page) => page.id === pageId);
    const findArticle = (articleId: string) => {
      for (const page of pages) {
        const article = page.articles.find((candidate) => candidate.id === articleId);
        if (article) return article;
      }
      return null;
    };
    const findBlock = (blockId: string) => {
      for (const page of pages) {
        for (const article of page.articles) {
          const block = article.blocks.find((candidate) => candidate.id === blockId);
          if (block) return block;
        }
      }
      return null;
    };
    const findComponent = (componentId: string) => {
      for (const page of pages) {
        for (const article of page.articles) {
          for (const block of article.blocks) {
            const component = block.components.find((candidate) => candidate.id === componentId);
            if (component) return component;
          }
        }
      }
      return null;
    };

    try {
      setIsSavingSelection(true);

      for (const key of Object.keys(dirtyNodeKeys)) {
        const [level, id] = key.split(":");
        if (!id) continue;

        if (level === "topic") {
          const page = findPage(id);
          if (!page) continue;
          const topicPatch: Record<string, unknown> = {
            title: page.title,
            description: page.body,
            subtitle: page.subtitle,
            _subtitle: page.subtitle,
            body: page.body,
            instruction: page.instruction,
            linkText: page.linkText,
            duration: page.duration,
            _lockType: page.lockType,
            _lockedBy: page.lockedBy,
            _classes: page.classes,
            _isOptional: page.isOptional,
            _isAvailable: page.isAvailable,
            _isHidden: page.isHidden,
            _isVisible: page.isVisible,
            _onScreen: {
              _isEnabled: !!page.onScreen?._isEnabled,
              _classes: page.onScreen?._classes || "",
              _percentInviewVertical:
                typeof page.onScreen?._percentInviewVertical === "number"
                  ? page.onScreen._percentInviewVertical
                  : 50,
            },
            _ariaLevel: page.ariaLevel,
            _ariaLabel: page.ariaLabel,
            _extensions: page.extensions ?? {},
            _graphic: {
              src: page.graphic?.src || "",
              alt: page.graphic?.alt || "",
            },
            themeSettings: page.themeSettings ?? {},
            menuSettings: page.menuSettings ?? {},
          };

          if (page.showDisplayTitleInPreview) {
            topicPatch.displayTitle = page.title;
          } else {
            topicPatch._unsetFields = ["displayTitle"];
          }

          await updateStructureNode("topic", id, topicPatch, { syncTitleDisplayTitle: false });
          continue;
        }

        if (level === "section") {
          const article = findArticle(id);
          if (!article) continue;
          await updateStructureNode("section", id, {
            title: article.title,
            displayTitle: article.title,
            body: article.description,
            description: article.description,
            instruction: article.instruction,
          });
          continue;
        }

        if (level === "contentGroup") {
          const block = findBlock(id);
          if (!block) continue;
          await updateStructureNode("contentGroup", id, {
            title: block.title,
            displayTitle: block.title,
            body: block.description,
            description: block.description,
            instruction: block.instruction,
          });
          continue;
        }

        if (level === "component") {
          const component = findComponent(id);
          if (!component) continue;
          const settings = component.settings ?? {};
          const existingProperties =
            settings.properties &&
            typeof settings.properties === "object" &&
            !Array.isArray(settings.properties)
              ? (settings.properties as Record<string, unknown>)
              : {};
          const instructionValue = settings.instruction ?? "";
          const subtitleValue = settings.subtitle;
          await updateStructureNode("component", id, {
            title: settings.title ?? "",
            displayTitle: settings.title ?? "",
            body: settings.description ?? "",
            description: settings.description ?? "",
            instruction: instructionValue,
            properties: {
              ...existingProperties,
              instruction: instructionValue,
              ...(subtitleValue !== undefined ? { subtitle: subtitleValue } : {}),
            },
          });
        }
      }

      setSavedContentPages(cloneContentPages(contentPages));
      setDirtyNodeKeys({});
      setPreviewRefreshToken((current) => current + 1);
      return true;
    } catch (error) {
      console.error("Failed to save editor drafts", error);
      return false;
    } finally {
      setIsSavingSelection(false);
    }
  }

  function discardDraftChanges() {
    setContentPages(cloneContentPages(savedContentPages));
    setDirtyNodeKeys({});
    setPreviewRefreshToken((current) => current + 1);
  }

  function runPendingGuardedAction() {
    const action = pendingGuardedActionRef.current;
    pendingGuardedActionRef.current = null;
    setShowUnsavedChangesModal(false);
    action?.();
  }

  function requestUnsavedChangesGuard(action: () => void) {
    pendingGuardedActionRef.current = action;
    setShowUnsavedChangesModal(true);
  }

  function runWithEditorExitGuard(action: () => void) {
    if (hasUnsavedChanges) {
      requestUnsavedChangesGuard(action);
      return;
    }
    action();
  }

  function openSetupPanel(panel?: "storyboarding") {
    if (!courseId || courseId === "new-course") return;
    const suffix = panel ? `?panel=${panel}` : "";
    runWithEditorExitGuard(() => navigate(`/course/${courseId}/setup${suffix}`));
  }

  function openEditorPreview(startFromCurrentPage: boolean) {
    if (!courseId || courseId === "new-course") return;

    const pageId = (selectedPageId || "").trim();
    const previewUrl = startFromCurrentPage && pageId
      ? `/course/${courseId}/preview?pageId=${encodeURIComponent(pageId)}`
      : `/course/${courseId}/preview`;
    runWithEditorExitGuard(() => navigate(previewUrl));
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

  function handleSelectComponent(
    pageId: string,
    articleId: string,
    blockId: string,
    componentId: string,
    source: SelectionSource = "internal"
  ) {
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedBlockId(blockId);
    setSelectedComponentId(componentId);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("component");
    if (source === "leftPanel") {
      queuePreviewScrollFromLeftPanel({ level: "component", id: componentId });
    }
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

  const loginName = user?.username || user?.email || "Not signed in";

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <PageEditorTopBar
        courseTitle={courseTitle}
        onCourseTitleChange={setCourseTitle}
        onToggleLeftPanel={() => setLeftPanelOpen((o) => !o)}
        onBack={() => runWithEditorExitGuard(() => navigate("/"))}
        onOpenCourseSettings={() => openSetupPanel()}
        onOpenStoryboard={() => openSetupPanel("storyboarding")}
        onOpenPreview={(startFromCurrentPage) => openEditorPreview(startFromCurrentPage)}
        loginName={loginName}
        previewDisabled={!courseId || courseId === "new-course"}
        onSave={() => {
          void saveDraftChanges();
        }}
        onPublish={() => {
          void 0;
        }}
        isSaving={isSavingSelection}
        isSaveDisabled={!hasUnsavedChanges}
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
          onMenuSelect={() => handleMenuSelect("leftPanel")}
          onPageSelect={(pageId) => handlePageSelect(pageId, "leftPanel")}
          onSubPageSelect={(pageId, subPageId) => handleSubPageSelect(pageId, subPageId, "leftPanel")}
          onArticleSelect={(pageId, articleId) => handleArticleSelect(pageId, articleId, "leftPanel")}
          onBlockSelect={(pageId, articleId, blockId) => handleBlockSelect(pageId, articleId, blockId, "leftPanel")}
          onComponentSelect={(pageId, articleId, blockId, componentId) => handleSelectComponent(pageId, articleId, blockId, componentId, "leftPanel")}
          onAddPage={() => {
            void handleAddPage();
          }}
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
            <div className="h-full flex flex-col min-h-0 p-6">
              <div className="relative flex-1 min-h-0 overflow-hidden rounded-[18px] border border-[#d8dee6] bg-white">
                <div className="h-full w-full box-border p-6">
                  {previewSrc ? (
                    <iframe
                      ref={previewFrameRef}
                      src={previewSrc}
                      title="Course preview"
                      onLoad={handlePreviewFrameLoad}
                      className="block h-full w-full border-0 bg-white"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#6b7280]">
                      Preview is not available until this course and tenant are loaded.
                    </div>
                  )}
                </div>

                {isPreviewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/85 backdrop-blur-[2px]">
                    <div className="rounded-xl border border-[#d8dee6] bg-white px-5 py-4 text-center shadow-sm">
                      <p className="text-sm font-semibold text-[#1f2937]">Building course preview...</p>
                      <p className="mt-1 text-xs text-[#6b7280]">The real preview will update when generation completes.</p>
                    </div>
                  </div>
                )}

                {previewError && !isPreviewLoading && (
                  <div className="absolute inset-x-4 top-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b] shadow-sm">
                    {previewError}
                  </div>
                )}
              </div>
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
                      setShowStructureMap(false);
                      return;
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

                const selectedDirtyKey = component?.id
                  ? `component:${component.id}`
                  : block?.id
                    ? `contentGroup:${block.id}`
                    : article?.id
                      ? `section:${article.id}`
                      : page?.id
                        ? `topic:${page.id}`
                        : null;
                const hasUnsavedSelection = selectedDirtyKey ? !!dirtyNodeKeys[selectedDirtyKey] : false;

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
                    {activeLevel === "page" && page && (() => {
                      const themeSettings = (page.themeSettings ?? {}) as TopicThemeSettings;
                      const pageBackgroundImage = asRecord(themeSettings._backgroundImage);
                      const pageBackgroundStyles = asRecord(themeSettings._backgroundStyles);
                      const responsiveClasses = asRecord(themeSettings._responsiveClasses);
                      const pageHeader = asRecord(themeSettings._pageHeader);
                      const pageHeaderGraphic = asRecord(pageHeader._graphic);
                      const pageHeaderTextAlignment = asRecord(pageHeader._textAlignment);
                      const pageHeaderBackgroundImage = asRecord(pageHeader._backgroundImage);
                      const pageHeaderBackgroundStyles = asRecord(pageHeader._backgroundStyles);
                      const pageHeaderMinimumHeights = asRecord(pageHeader._minimumHeights);

                      const menuSettings = (page.menuSettings ?? {}) as TopicMenuSettings;
                      const menuGraphic = asRecord(menuSettings._graphic);
                      const menuBackgroundImage = asRecord(menuSettings._backgroundImage);
                      const menuBackgroundStyles = asRecord(menuSettings._backgroundStyles);
                      const menuHeader = asRecord(menuSettings._menuHeader);
                      const menuHeaderTextAlignment = asRecord(menuHeader._textAlignment);
                      const menuHeaderBackgroundImage = asRecord(menuHeader._backgroundImage);
                      const menuHeaderBackgroundStyles = asRecord(menuHeader._backgroundStyles);
                      const menuHeaderMinimumHeights = asRecord(menuHeader._minimumHeights);
                      const showMenuSubtitleAlignment = courseMenu === "Box Menu";

                      return (
                        <div className="px-4 py-4 border-b border-[#e6ebf0] space-y-2.5">
                          <TopicAccordion title="General" open={!!openTopicAccordions.general} onToggle={() => toggleTopicAccordion("general")}>
                            <div className="flex flex-col gap-1.5">
                              <TopicFieldLabel>TOPIC ID</TopicFieldLabel>
                              {(() => {
                                const isCopied = copiedTopicId === page.id;
                                return (
                                  <div className="relative">
                                    <button
                                      type="button"
                                      aria-label="Copy topic id"
                                      title="Copy topic id"
                                      onClick={() => handleCopyTopicId(page.id)}
                                      className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer ${isCopied ? "bg-[var(--life-positive-050)] border-[var(--life-positive-500)] text-[var(--life-positive-500)]" : "bg-white border-[var(--life-neutral-300)] text-[var(--life-base-black)] hover:bg-[#f8fafc] hover:border-[var(--life-primary-500)] hover:text-[var(--life-primary-500)]"}`}
                                    >
                                      <span className="truncate text-left">{page.id}</span>
                                      {isCopied ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      ) : (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                      )}
                                    </button>
                                    {isCopied ? (
                                      <div className="absolute -top-8 right-0 px-2.5 py-1 rounded-[8px] border border-[var(--life-positive-500)] bg-[var(--life-positive-050)] text-[11px] font-semibold text-[var(--life-positive-500)] shadow-sm whitespace-nowrap">
                                        Id copied to clipboard.
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })()}
                              <p className="text-xs text-[#6b7280]">Unique identifier for this topic. Click to copy.</p>
                            </div>
                            <TopicTextInput label="Topic title" value={page.title} onChange={(value) => updatePageData(page.id, { title: value })} />
                            <TopicCheckbox
                              label="Display title in preview"
                              checked={!!page.showDisplayTitleInPreview}
                              onChange={(checked) => updatePageData(page.id, { showDisplayTitleInPreview: checked })}
                            />
                          </TopicAccordion>

                          <TopicAccordion title="Availability & Progression" open={!!openTopicAccordions.availability} onToggle={() => toggleTopicAccordion("availability")}>
                            <TopicCheckbox label="Is optional" checked={!!page.isOptional} onChange={(checked) => updatePageData(page.id, { isOptional: checked })} />
                            <TopicCheckbox label="Is available" checked={!!page.isAvailable} onChange={(checked) => updatePageData(page.id, { isAvailable: checked })} />
                            <TopicCheckbox label="Is hidden" checked={!!page.isHidden} onChange={(checked) => updatePageData(page.id, { isHidden: checked })} />
                            <TopicCheckbox label="Is visible" checked={!!page.isVisible} onChange={(checked) => updatePageData(page.id, { isVisible: checked })} />
                            <TopicTextInput label="Duration" value={page.duration} onChange={(value) => updatePageData(page.id, { duration: value })} />
                            <TopicTextInput label="Link text" value={page.linkText} onChange={(value) => updatePageData(page.id, { linkText: value })} />
                            <TopicSelect label="Menu lock type" value={page.lockType} onChange={(value) => updatePageData(page.id, { lockType: value })} options={LOCK_TYPE_OPTIONS} emptyOptionLabel="" />
                            <TopicTextInput
                              label="Locked by (comma separated IDs)"
                              value={page.lockedBy.join(", ")}
                              onChange={(value) => updatePageData(page.id, {
                                lockedBy: value.split(",").map((item) => item.trim()).filter(Boolean),
                              })}
                            />
                          </TopicAccordion>

                          <TopicAccordion title="Accessibility" open={!!openTopicAccordions.accessibility} onToggle={() => toggleTopicAccordion("accessibility")}>
                            <TopicTextInput label="ARIA level" value={page.ariaLevel} onChange={(value) => updatePageData(page.id, { ariaLevel: value })} />
                            <TopicTextInput label="ARIA label" value={page.ariaLabel} onChange={(value) => updatePageData(page.id, { ariaLabel: value })} />
                          </TopicAccordion>

                          <TopicAccordion title="Extensions" open={!!openTopicAccordions.extensions} onToggle={() => toggleTopicAccordion("extensions")}>
                            <div className="flex flex-col gap-1.5">
                              <TopicFieldLabel>Extensions JSON</TopicFieldLabel>
                              <textarea
                                key={`${page.id}-extensions`}
                                defaultValue={JSON.stringify(page.extensions ?? {}, null, 2)}
                                onBlur={(event) => {
                                  try {
                                    const parsed = JSON.parse(event.target.value || "{}");
                                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                                      updatePageData(page.id, { extensions: parsed as Record<string, unknown> });
                                    }
                                  } catch {
                                    // Keep current value when invalid JSON is entered.
                                  }
                                }}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors resize-y min-h-[120px] font-mono"
                              />
                            </div>
                          </TopicAccordion>

                          <TopicAccordion title="Theme settings" open={!!openTopicAccordions.theme} onToggle={() => toggleTopicAccordion("theme")}>
                            <TopicAssetField
                              label="Page background image (_xlarge)"
                              value={asString(pageBackgroundImage._xlarge)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "themePageBackground", bp: "_xlarge" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "themePageBackground", bp: "_xlarge" })}
                            />
                            <TopicAssetField
                              label="Page background image (_large)"
                              value={asString(pageBackgroundImage._large)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "themePageBackground", bp: "_large" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "themePageBackground", bp: "_large" })}
                            />
                            <TopicAssetField
                              label="Page background image (_medium)"
                              value={asString(pageBackgroundImage._medium)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "themePageBackground", bp: "_medium" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "themePageBackground", bp: "_medium" })}
                            />
                            <TopicAssetField
                              label="Page background image (_small)"
                              value={asString(pageBackgroundImage._small)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "themePageBackground", bp: "_small" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "themePageBackground", bp: "_small" })}
                            />
                            <TopicSelect label="Page background repeat" value={asString(pageBackgroundStyles._backgroundRepeat)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundRepeat: value } }))} options={BG_REPEAT_OPTIONS} />
                            <TopicSelect label="Page background size" value={asString(pageBackgroundStyles._backgroundSize)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundSize: value } }))} options={BG_SIZE_OPTIONS} />
                            <TopicSelect label="Page background position" value={asString(pageBackgroundStyles._backgroundPosition)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundPosition: value } }))} options={BG_POSITION_OPTIONS} />

                            <TopicAssetField
                              label="Header image"
                              value={asString(pageHeaderGraphic._src)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "themeHeaderGraphic" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "themeHeaderGraphic" })}
                            />
                            <TopicTextInput label="Header image alt text" value={asString(pageHeaderGraphic.alt)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _graphic: { ...asRecord(asRecord(current._pageHeader)._graphic), alt: value } } }))} />

                            <TopicSelect label="Header title alignment" value={asString(pageHeaderTextAlignment._title)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _textAlignment: { ...asRecord(asRecord(current._pageHeader)._textAlignment), _title: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                            <TopicSelect label="Header body alignment" value={asString(pageHeaderTextAlignment._body)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _textAlignment: { ...asRecord(asRecord(current._pageHeader)._textAlignment), _body: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                            <TopicSelect label="Header instruction alignment" value={asString(pageHeaderTextAlignment._instruction)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _textAlignment: { ...asRecord(asRecord(current._pageHeader)._textAlignment), _instruction: value } } }))} options={TEXT_ALIGN_OPTIONS} />

                            <TopicAssetField
                              label="Header background image (_xlarge)"
                              value={asString(pageHeaderBackgroundImage._xlarge)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "themeHeaderBackground", bp: "_xlarge" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "themeHeaderBackground", bp: "_xlarge" })}
                            />
                            <TopicAssetField
                              label="Header background image (_large)"
                              value={asString(pageHeaderBackgroundImage._large)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "themeHeaderBackground", bp: "_large" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "themeHeaderBackground", bp: "_large" })}
                            />
                            <TopicAssetField
                              label="Header background image (_medium)"
                              value={asString(pageHeaderBackgroundImage._medium)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "themeHeaderBackground", bp: "_medium" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "themeHeaderBackground", bp: "_medium" })}
                            />
                            <TopicAssetField
                              label="Header background image (_small)"
                              value={asString(pageHeaderBackgroundImage._small)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "themeHeaderBackground", bp: "_small" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "themeHeaderBackground", bp: "_small" })}
                            />
                            <TopicSelect label="Header background repeat" value={asString(pageHeaderBackgroundStyles._backgroundRepeat)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _backgroundStyles: { ...asRecord(asRecord(current._pageHeader)._backgroundStyles), _backgroundRepeat: value } } }))} options={BG_REPEAT_OPTIONS} />
                            <TopicSelect label="Header background size" value={asString(pageHeaderBackgroundStyles._backgroundSize)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _backgroundStyles: { ...asRecord(asRecord(current._pageHeader)._backgroundStyles), _backgroundSize: value } } }))} options={BG_SIZE_OPTIONS} />
                            <TopicSelect label="Header background position" value={asString(pageHeaderBackgroundStyles._backgroundPosition)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _backgroundStyles: { ...asRecord(asRecord(current._pageHeader)._backgroundStyles), _backgroundPosition: value } } }))} options={BG_POSITION_OPTIONS} />

                            <TopicTextInput label="Header minimum height (_xlarge)" type="number" value={String(asNumberOrEmpty(pageHeaderMinimumHeights._xlarge))} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _minimumHeights: { ...asRecord(asRecord(current._pageHeader)._minimumHeights), _xlarge: parseNumberishInput(value) } } }))} />
                            <TopicTextInput label="Header minimum height (_large)" type="number" value={String(asNumberOrEmpty(pageHeaderMinimumHeights._large))} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _minimumHeights: { ...asRecord(asRecord(current._pageHeader)._minimumHeights), _large: parseNumberishInput(value) } } }))} />
                            <TopicTextInput label="Header minimum height (_medium)" type="number" value={String(asNumberOrEmpty(pageHeaderMinimumHeights._medium))} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _minimumHeights: { ...asRecord(asRecord(current._pageHeader)._minimumHeights), _medium: parseNumberishInput(value) } } }))} />
                            <TopicTextInput label="Header minimum height (_small)" type="number" value={String(asNumberOrEmpty(pageHeaderMinimumHeights._small))} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _minimumHeights: { ...asRecord(asRecord(current._pageHeader)._minimumHeights), _small: parseNumberishInput(value) } } }))} />
                          </TopicAccordion>

                          <TopicAccordion title="Menu Appearance" open={!!openTopicAccordions.menu} onToggle={() => toggleTopicAccordion("menu")}>
                            <TopicAssetField
                              label="Menu graphic"
                              value={asString(menuGraphic._src)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuGraphic" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "menuGraphic" })}
                            />
                            <TopicTextInput label="Menu graphic alt text" value={asString(menuGraphic.alt)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _graphic: { ...asRecord(current._graphic), alt: value } }))} />
                            <TopicCheckbox label="Skip submenu view" checked={asBoolean(menuSettings._skipSubmenuView)} onChange={(checked) => updatePageMenuSettings(page.id, (current) => ({ ...current, _skipSubmenuView: checked }))} />
                            <TopicTextInput label="Locked notification" value={asString(menuSettings.lockedNotification)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, lockedNotification: value }))} />

                            <TopicAssetField label="Menu background image (_xlarge)" value={asString(menuBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuBackground", bp: "_xlarge" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuBackground", bp: "_xlarge" })} />
                            <TopicAssetField label="Menu background image (_large)" value={asString(menuBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuBackground", bp: "_large" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuBackground", bp: "_large" })} />
                            <TopicAssetField label="Menu background image (_medium)" value={asString(menuBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuBackground", bp: "_medium" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuBackground", bp: "_medium" })} />
                            <TopicAssetField label="Menu background image (_small)" value={asString(menuBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuBackground", bp: "_small" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuBackground", bp: "_small" })} />
                            <TopicSelect label="Menu background repeat" value={asString(menuBackgroundStyles._backgroundRepeat)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundRepeat: value } }))} options={BG_REPEAT_OPTIONS} />
                            <TopicSelect label="Menu background size" value={asString(menuBackgroundStyles._backgroundSize)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundSize: value } }))} options={BG_SIZE_OPTIONS} />
                            <TopicSelect label="Menu background position" value={asString(menuBackgroundStyles._backgroundPosition)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundPosition: value } }))} options={BG_POSITION_OPTIONS} />

                            <TopicCheckbox label="Display image above menu header" checked={asBoolean(menuHeader._displayAboveHeader)} onChange={(checked) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _displayAboveHeader: checked } }))} />
                            <TopicSelect label="Menu header title alignment" value={asString(menuHeaderTextAlignment._title)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _textAlignment: { ...asRecord(asRecord(current._menuHeader)._textAlignment), _title: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                            {showMenuSubtitleAlignment ? <TopicSelect label="Menu header subtitle alignment" value={asString(menuHeaderTextAlignment._subtitle)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _textAlignment: { ...asRecord(asRecord(current._menuHeader)._textAlignment), _subtitle: value } } }))} options={TEXT_ALIGN_OPTIONS} /> : null}
                            <TopicSelect label="Menu header body alignment" value={asString(menuHeaderTextAlignment._body)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _textAlignment: { ...asRecord(asRecord(current._menuHeader)._textAlignment), _body: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                            <TopicSelect label="Menu header instruction alignment" value={asString(menuHeaderTextAlignment._instruction)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _textAlignment: { ...asRecord(asRecord(current._menuHeader)._textAlignment), _instruction: value } } }))} options={TEXT_ALIGN_OPTIONS} />

                            <TopicAssetField label="Menu header background image (_xlarge)" value={asString(menuHeaderBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuHeaderBackground", bp: "_xlarge" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuHeaderBackground", bp: "_xlarge" })} />
                            <TopicAssetField label="Menu header background image (_large)" value={asString(menuHeaderBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuHeaderBackground", bp: "_large" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuHeaderBackground", bp: "_large" })} />
                            <TopicAssetField label="Menu header background image (_medium)" value={asString(menuHeaderBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuHeaderBackground", bp: "_medium" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuHeaderBackground", bp: "_medium" })} />
                            <TopicAssetField label="Menu header background image (_small)" value={asString(menuHeaderBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuHeaderBackground", bp: "_small" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuHeaderBackground", bp: "_small" })} />
                            <TopicSelect label="Menu header background repeat" value={asString(menuHeaderBackgroundStyles._backgroundRepeat)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _backgroundStyles: { ...asRecord(asRecord(current._menuHeader)._backgroundStyles), _backgroundRepeat: value } } }))} options={BG_REPEAT_OPTIONS} />
                            <TopicSelect label="Menu header background size" value={asString(menuHeaderBackgroundStyles._backgroundSize)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _backgroundStyles: { ...asRecord(asRecord(current._menuHeader)._backgroundStyles), _backgroundSize: value } } }))} options={BG_SIZE_OPTIONS} />
                            <TopicSelect label="Menu header background position" value={asString(menuHeaderBackgroundStyles._backgroundPosition)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _backgroundStyles: { ...asRecord(asRecord(current._menuHeader)._backgroundStyles), _backgroundPosition: value } } }))} options={BG_POSITION_OPTIONS} />

                            <TopicTextInput label="Menu header minimum height (_xlarge)" type="number" value={String(asNumberOrEmpty(menuHeaderMinimumHeights._xlarge))} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _minimumHeights: { ...asRecord(asRecord(current._menuHeader)._minimumHeights), _xlarge: parseNumberishInput(value) } } }))} />
                            <TopicTextInput label="Menu header minimum height (_large)" type="number" value={String(asNumberOrEmpty(menuHeaderMinimumHeights._large))} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _minimumHeights: { ...asRecord(asRecord(current._menuHeader)._minimumHeights), _large: parseNumberishInput(value) } } }))} />
                            <TopicTextInput label="Menu header minimum height (_medium)" type="number" value={String(asNumberOrEmpty(menuHeaderMinimumHeights._medium))} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _minimumHeights: { ...asRecord(asRecord(current._menuHeader)._minimumHeights), _medium: parseNumberishInput(value) } } }))} />
                            <TopicTextInput label="Menu header minimum height (_small)" type="number" value={String(asNumberOrEmpty(menuHeaderMinimumHeights._small))} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _minimumHeights: { ...asRecord(asRecord(current._menuHeader)._minimumHeights), _small: parseNumberishInput(value) } } }))} />
                          </TopicAccordion>

                          <TopicAccordion title="Media" open={!!openTopicAccordions.media} onToggle={() => toggleTopicAccordion("media")}>
                            <TopicAssetField
                              label="Graphic"
                              value={page.graphic?.src || ""}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "pageGraphic" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "pageGraphic" })}
                            />
                            <TopicTextInput label="Graphic alt text" value={page.graphic?.alt || ""} onChange={(value) => updatePageGraphic(page.id, (current) => ({ ...current, alt: value }))} />
                          </TopicAccordion>

                          <TopicAccordion title="Advanced Settings" open={!!openTopicAccordions.advanced} onToggle={() => toggleTopicAccordion("advanced")}>
                            <TopicTextInput label="Classes" value={page.classes} onChange={(value) => updatePageData(page.id, { classes: value })} />
                            <TopicCheckbox
                              label="On-screen classes enabled"
                              checked={asBoolean(page.onScreen?._isEnabled)}
                              onChange={(checked) => updatePageData(page.id, {
                                onScreen: {
                                  ...(page.onScreen ?? {}),
                                  _isEnabled: checked,
                                },
                              })}
                            />
                            <TopicTextInput
                              label="On-screen classes"
                              value={asString(page.onScreen?._classes)}
                              onChange={(value) => updatePageData(page.id, {
                                onScreen: {
                                  ...(page.onScreen ?? {}),
                                  _classes: value,
                                },
                              })}
                            />
                            <TopicTextInput
                              label="On-screen percent in view"
                              type="number"
                              value={String(asNumberOrEmpty(page.onScreen?._percentInviewVertical))}
                              onChange={(value) => updatePageData(page.id, {
                                onScreen: {
                                  ...(page.onScreen ?? {}),
                                  _percentInviewVertical: parseNumberishInput(value),
                                },
                              })}
                            />
                            <TopicTextInput label="Responsive classes _xlarge" value={asString(responsiveClasses._xlarge)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _xlarge: value } }))} />
                            <TopicTextInput label="Responsive classes _large" value={asString(responsiveClasses._large)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _large: value } }))} />
                            <TopicTextInput label="Responsive classes _medium" value={asString(responsiveClasses._medium)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _medium: value } }))} />
                            <TopicTextInput label="Responsive classes _small" value={asString(responsiveClasses._small)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _small: value } }))} />
                          </TopicAccordion>
                        </div>
                      );
                    })()}

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
                          className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm"
                          placeholder="Section title"
                        />
                        <textarea
                          value={article.description}
                          onChange={(e) => updateArticle(page!.id, article.id, { description: e.target.value })}
                          className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm resize-none"
                          rows={3}
                          placeholder="Section body"
                        />
                        <textarea
                          value={article.instruction}
                          onChange={(e) => updateArticle(page!.id, article.id, { instruction: e.target.value })}
                          className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm resize-none"
                          rows={2}
                          placeholder="Section instruction"
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
                            className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm"
                            placeholder="Content Group title"
                          />
                          <textarea
                            value={block.description}
                            onChange={(e) => updateBlock(page!.id, article!.id, block.id, { description: e.target.value })}
                            className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm resize-none"
                            rows={3}
                            placeholder="Content Group body"
                          />
                          <textarea
                            value={block.instruction}
                            onChange={(e) => updateBlock(page!.id, article!.id, block.id, { instruction: e.target.value })}
                            className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm resize-none"
                            rows={2}
                            placeholder="Content Group instruction"
                          />
                          <input
                            value={block.id}
                            readOnly
                            className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm text-[#6b7280] bg-[#f8fafc]"
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
                            {(() => {
                              const componentProperties =
                                component.settings.properties &&
                                typeof component.settings.properties === "object" &&
                                !Array.isArray(component.settings.properties)
                                  ? component.settings.properties
                                  : {};
                              const componentKey = (component.settings.componentKey || "").toLowerCase();
                              const shouldShowSubtitle =
                                ((component.settings.subtitle || "").trim().length > 0) ||
                                Object.prototype.hasOwnProperty.call(componentProperties, "subtitle") ||
                                componentSubtitleSchemaSupport[componentKey] === true;
                              return shouldShowSubtitle;
                            })() && (
                              <input
                                value={component.settings.subtitle || ""}
                                onChange={(e) => updateComponent(page.id, article.id, block.id, component.id, {
                                  settings: {
                                    ...component.settings,
                                    subtitle: e.target.value,
                                    properties: {
                                      ...(component.settings.properties && typeof component.settings.properties === "object" && !Array.isArray(component.settings.properties)
                                        ? component.settings.properties
                                        : {}),
                                      subtitle: e.target.value,
                                    },
                                  },
                                })}
                                className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm"
                                placeholder="Component subtitle"
                              />
                            )}
                            <input
                              value={component.settings.title || ""}
                              onChange={(e) => updateComponent(page.id, article.id, block.id, component.id, {
                                settings: { ...component.settings, title: e.target.value },
                              })}
                              className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm"
                              placeholder="Component title"
                            />
                            <textarea
                              value={component.settings.description || ""}
                              onChange={(e) => updateComponent(page.id, article.id, block.id, component.id, {
                                settings: { ...component.settings, description: e.target.value },
                              })}
                              className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm resize-none"
                              rows={3}
                              placeholder="Component body"
                            />
                            <textarea
                              value={component.settings.instruction || ""}
                              onChange={(e) => updateComponent(page.id, article.id, block.id, component.id, {
                                settings: { ...component.settings, instruction: e.target.value },
                              })}
                              className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm resize-none"
                              rows={2}
                              placeholder="Component instruction"
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

        {topicAssetPickerTarget && selectedPageId ? (
          <AssetPickerModal
            onClose={() => setTopicAssetPickerTarget(null)}
            onSelect={(asset) => {
              applyTopicAssetSelection(selectedPageId, topicAssetPickerTarget, asset.assetLink || asset.url || asset.id);
              setTopicAssetPickerTarget(null);
            }}
          />
        ) : null}

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

        <UnsavedChangesModal
          isOpen={showUnsavedChangesModal}
          isSaving={isSavingSelection}
          onClose={() => {
            pendingGuardedActionRef.current = null;
            setShowUnsavedChangesModal(false);
          }}
          onDiscard={() => {
            discardDraftChanges();
            runPendingGuardedAction();
          }}
          onSave={async () => {
            const ok = await saveDraftChanges();
            if (!ok) return;
            runPendingGuardedAction();
          }}
          message="You have unsaved changes. Save before leaving this page?"
        />
      </div>
    </div>
  );
}
