import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AddComponentDrawer from "../../components/course/AddComponentDrawer";
import AddTemplateDrawer from "../../components/course/AddTemplateDrawer";
import AssetPickerModal from "../../components/common/AssetPickerModal";
import TopicAssetField, { toRenderableAssetUrl } from "../../components/common/AssetSelectionField";
import CourseStructureMap from "../../components/course/CourseStructureMap";
import { StructureIcon, STRUCTURE_ICON_COLOR_CLASS } from "../../components/course/StructureIcons";
import { UnsavedChangesModal } from "../setup/unsavedChangesModal";
import PageEditorTopBar from "./pageEditorTopBar";
import PageEditorNavigation from "./pageEditorNavigation";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import {
  componentSchemaSupportsPropertiesField,
  createCourseAssetMapping,
  createArticle,
  createComponent,
  deleteStructureNode,
  getCourseAssetMappings,
  getCourseStructure,
  pasteTemplateIntoCourse,
  removeCourseAssetMappings,
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
  _htmlClasses?: string;
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
  _articleHeader?: {
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
  | { scope: "sectionBackground"; articleId: string; bp: BreakpointKey }
  | { scope: "sectionArticleHeaderBackground"; articleId: string; bp: BreakpointKey }
  | { scope: "contentGroupBackground"; articleId: string; blockId: string; bp: BreakpointKey }
  | { scope: "componentBackground"; articleId: string; blockId: string; componentId: string; bp: BreakpointKey }
  | { scope: "themeHeaderGraphic" }
  | { scope: "themeHeaderBackground"; bp: BreakpointKey }
  | { scope: "menuGraphic" }
  | { scope: "menuBackground"; bp: BreakpointKey }
  | { scope: "menuHeaderBackground"; bp: BreakpointKey };

type TopicExternalAssetTarget = {
  pageId: string;
  target: TopicAssetTarget;
  initialValue: string;
  title: string;
};

const BG_REPEAT_OPTIONS = ["", "repeat", "repeat-x", "repeat-y", "no-repeat"] as const;
const BG_SIZE_OPTIONS = ["", "auto", "cover", "contain"] as const;
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
const BG_REPEAT_LABEL = "Set if/how the background image repeats";
const BG_SIZE_LABEL = "Set the size of the background image";
const BG_POSITION_LABEL = "Set the position of the background image";
const ONSCREEN_CLASS_OPTIONS = [
  "",
  "fade-in",
  "fade-out",
  "slide-in-left",
  "slide-in-right",
  "slide-in-up",
  "slide-in-down",
  "zoom-in",
  "zoom-out",
  "bounce",
  "flip",
  "rotate-in",
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

function isExternalAsset(value: string): boolean {
  return /^(https?:)?\/\//i.test((value || "").trim());
}

function toCourseAssetFieldName(value: string): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed || isExternalAsset(trimmed)) return null;

  const normalized = trimmed.replace(/^\/+/, "");
  if (!normalized.startsWith("course/assets/")) return null;

  const fieldName = normalized.replace(/^course\/assets\//, "");
  return fieldName || null;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildCourseAssetLinkCandidates(value: string): string[] {
  const trimmed = (value || "").trim();
  if (!trimmed) return [];

  const normalized = trimmed.replace(/^\/+/, "").split(/[?#]/)[0];
  const candidates = new Set<string>([trimmed, normalized, `/${normalized}`]);

  if (normalized.startsWith("course/assets/")) {
    const fieldName = normalized.replace(/^course\/assets\//, "");
    const decodedFieldName = safeDecodeURIComponent(fieldName);
    const encodedFieldName = encodeURIComponent(decodedFieldName).replace(/%2F/gi, "/");
    candidates.add(`course/assets/${decodedFieldName}`);
    candidates.add(`course/assets/${encodedFieldName}`);
    candidates.add(`/course/assets/${decodedFieldName}`);
    candidates.add(`/course/assets/${encodedFieldName}`);
  }

  return [...candidates];
}

function addAssetLinkMapping(target: Record<string, string>, fieldName: string, assetId: string) {
  const decodedFieldName = safeDecodeURIComponent(fieldName);
  const encodedFieldName = encodeURIComponent(decodedFieldName).replace(/%2F/gi, "/");
  const variants = [
    `course/assets/${fieldName}`,
    `course/assets/${decodedFieldName}`,
    `course/assets/${encodedFieldName}`,
  ];

  variants.forEach((link) => {
    target[link] = assetId;
    target[`/${link}`] = assetId;
  });
}

function extractAssetIdFromCourseAssetPath(value: string): string | null {
  const normalized = (value || "").trim().replace(/^\/+/, "");
  if (!normalized.startsWith("course/assets/")) return null;

  const tail = normalized.replace(/^course\/assets\//, "").split(/[?#]/)[0];
  const basename = tail.split("/").pop() || "";
  const match = basename.match(/^([a-f0-9]{24})(?:\.[^.]+)?$/i);
  return match?.[1] || null;
}

function collectCourseAssetFieldNames(source: unknown, result = new Set<string>()): Set<string> {
  if (typeof source === "string") {
    const fieldName = toCourseAssetFieldName(source);
    if (fieldName) result.add(fieldName);
    return result;
  }

  if (Array.isArray(source)) {
    source.forEach((entry) => collectCourseAssetFieldNames(entry, result));
    return result;
  }

  if (source && typeof source === "object") {
    Object.values(source as Record<string, unknown>).forEach((entry) => {
      collectCourseAssetFieldNames(entry, result);
    });
  }

  return result;
}

function TopicAccordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: (triggerEl: HTMLButtonElement) => void;
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
        onClick={(event) => onToggle(event.currentTarget)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors ${
          open
            ? "bg-[var(--life-primary-020)]"
            : "bg-white hover:bg-[var(--life-neutral-020)]"
        }`}
      >
        <h3 className="text-[13px] font-semibold text-[var(--life-base-black)]">{title}</h3>
        <svg
          className={`shrink-0 ml-auto transition-transform duration-200 text-[var(--life-primary-700)] ${open ? "rotate-90" : ""}`}
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open ? <div className="px-3 pb-3 pt-2.5 border-t border-[#eef2f6] flex flex-col gap-2.5">{children}</div> : null}
    </div>
  );
}

function TopicNestedAccordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="w-full rounded-[8px] border border-[#d8dee6] bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--life-neutral-020)] transition-colors"
      >
        <span className="text-[13px] font-semibold text-[#21436b] underline underline-offset-[2px]">{title}</span>
        <svg
          className={`shrink-0 transition-transform duration-200 text-[#21436b] ${open ? "rotate-90" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open ? <div className="px-3 pb-2.5 pt-1.5 border-t border-[#eef2f6] flex flex-col gap-2">{children}</div> : null}
    </div>
  );
}

function TopicFieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold text-[#374151]">{children}</span>;
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
        className={`w-full px-2.5 py-1.5 text-[13px] rounded-md border border-[#e5e7eb] text-[#111827] transition-colors ${readOnly ? "bg-[#f8fafc]" : "bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"}`}
      />
    </div>
  );
}

function TopicSelect({
  label,
  value,
  onChange,
  options,
  emptyOptionLabel = "",
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
          className="w-full border border-[#e5e7eb] rounded-md px-2.5 py-2 text-[13px] text-[var(--life-base-black)] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent pr-8"
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
    <label className="flex items-center gap-1.5 text-[13px] text-[#111827] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 rounded-[6px] border-[#cbd5e1] text-[#2d6fa8] focus:ring-[#2d6fa8]"
      />
      <span>{label}</span>
    </label>
  );
}

function ExternalAssetModal({
  open,
  title,
  initialValue,
  onCancel,
  onSave,
}: {
  open: boolean;
  title: string;
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
    }
  }, [initialValue, open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4" onClick={onCancel}>
      <div className="w-full max-w-xl rounded-2xl border border-[var(--life-neutral-200)] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--life-neutral-200)] flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-[var(--life-base-black)]">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-md border border-[var(--life-neutral-200)] text-[var(--life-neutral-500)] hover:bg-[var(--life-neutral-050)] flex items-center justify-center cursor-pointer"
            aria-label="Close external asset dialog"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="text-sm font-semibold text-[#374151]">External asset URL</label>
          <input
            type="url"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://example.com/image.png"
            className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"
          />
          <p className="text-[13px] text-[var(--life-neutral-300)]">Paste an absolute URL to use an externally hosted image.</p>
        </div>
        <div className="px-5 py-4 border-t border-[var(--life-neutral-200)] flex items-center justify-end gap-2.5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors cursor-pointer">Cancel</button>
          <button type="button" onClick={() => onSave(value.trim())} className="px-4 py-2 text-sm font-medium text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors cursor-pointer">Save External Asset</button>
        </div>
      </div>
    </div>,
    document.body
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
    htmlClasses?: string;
    requireCompletionOf?: string;
    isOptional?: boolean;
    isAvailable?: boolean;
    isHidden?: boolean;
    isVisible?: boolean;
    onScreen?: TopicOnScreenSettings;
    ariaLevel?: string;
    extensions?: Record<string, unknown>;
    displayTitle?: string;
    sections: Array<{
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
      contentGroups: Array<{
        id: string;
        title: string;
        description?: string;
        instruction?: string;
        themeSettings?: Record<string, unknown>;
          components: Array<{ id: string; title: string; componentKey: string; layout?: "full" | "left" | "right"; description?: string; instruction?: string; subtitle?: string; themeSettings?: Record<string, unknown>; properties?: Record<string, unknown>; url?: string }>;
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
      htmlClasses: topic.htmlClasses || "",
      requireCompletionOf: topic.requireCompletionOf || "-1",
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
      extensions:
        topic.extensions && typeof topic.extensions === "object"
          ? topic.extensions
          : {},
      showDisplayTitleInPreview:
        typeof topic.displayTitle === "string"
          ? topic.displayTitle.trim().length > 0
          : false,
      subPages: [],
      articles: topic.sections.map((section) => ({
        id: section.id,
        title: section.title || "Untitled Article",
        description: section.description || "",
        instruction: section.instruction || "",
        themeSettings:
          section.themeSettings && typeof section.themeSettings === "object"
            ? section.themeSettings as TopicThemeSettings
            : {},
        isOptional: !!section.isOptional,
        isAvailable: section.isAvailable !== false,
        isHidden: !!section.isHidden,
        isVisible: section.isVisible !== false,
        requireCompletionOf: section.requireCompletionOf ?? "-1",
        classes: section.classes || "",
        onScreen: {
          _isEnabled: !!section.onScreen?._isEnabled,
          _classes: section.onScreen?._classes || "",
          _percentInviewVertical:
            typeof section.onScreen?._percentInviewVertical === "number"
              ? section.onScreen._percentInviewVertical
              : 50,
        },
        ariaLevel: section.ariaLevel || "",
        extensions: section.extensions ?? {},
        showDisplayTitleInPreview:
          typeof section.displayTitle === "string"
            ? section.displayTitle.trim().length > 0
            : false,
        blocks: section.contentGroups.map((group) => ({
          id: group.id,
          title: group.title || "Untitled Block",
          description: group.description || "",
          instruction: group.instruction || "",
          themeSettings:
            group.themeSettings && typeof group.themeSettings === "object"
              ? group.themeSettings as TopicThemeSettings
              : {},
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
            themeSettings:
              component.themeSettings && typeof component.themeSettings === "object"
                ? component.themeSettings as TopicThemeSettings
                : {},
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
  themeSettings: TopicThemeSettings;
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
  themeSettings: TopicThemeSettings;
  components: ComponentData[];
}

export interface ArticleData {
  id: string;
  title: string;
  description: string;
  instruction: string;
  themeSettings: TopicThemeSettings;
  blocks: BlockData[];
  isOptional: boolean;
  isAvailable: boolean;
  isHidden: boolean;
  isVisible: boolean;
  requireCompletionOf: string;
  classes: string;
  onScreen: TopicOnScreenSettings;
  ariaLevel: string;
  extensions: Record<string, unknown>;
  showDisplayTitleInPreview: boolean;
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
  htmlClasses: string;
  requireCompletionOf: string;
  isOptional: boolean;
  isAvailable: boolean;
  isHidden: boolean;
  isVisible: boolean;
  onScreen: TopicOnScreenSettings;
  ariaLevel: string;
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

const DEFAULT_TOPIC_ACCORDIONS: Record<string, boolean> = {
  general: true,
  availability: false,
  accessibility: false,
  extensions: false,
  theme: false,
  menu: false,
  media: false,
  advanced: false,
};

const DEFAULT_SECTION_ACCORDIONS: Record<string, boolean> = {
  general: true,
  availability: false,
  accessibility: false,
  extensions: false,
  theme: false,
  advanced: false,
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
  const [topicExternalAssetTarget, setTopicExternalAssetTarget] = useState<TopicExternalAssetTarget | null>(null);
  const [copiedTopicId, setCopiedTopicId] = useState<string | null>(null);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const [openTopicAccordions, setOpenTopicAccordions] = useState<Record<string, boolean>>(DEFAULT_TOPIC_ACCORDIONS);
  const [openSectionAccordions, setOpenSectionAccordions] = useState<Record<string, boolean>>(DEFAULT_SECTION_ACCORDIONS);
  const [courseAssetMappings, setCourseAssetMappings] = useState<Record<string, string>>({});
  const [assetLinkIdMap, setAssetLinkIdMap] = useState<Record<string, string>>({});
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
  const copiedSectionIdResetTimerRef = useRef<number | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const rightPanelScrollRef = useRef<HTMLElement | null>(null);
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
        setCourseAssetMappings({});
        setAssetLinkIdMap({});
        setIsLoadingStructure(false);
      }
      return;
    }

    if (isCurrentRequest()) {
      setIsLoadingStructure(true);
      setStructureLoadError(null);
    }

    try {
      const [structure, courseAssets] = await Promise.all([
        getCourseStructure(courseId, courseTitle),
        getCourseAssetMappings(courseId),
      ]);
      if (!isCurrentRequest()) return;

      const nextAssetLinkMap: Record<string, string> = {};
      Object.entries(courseAssets || {}).forEach(([fieldName, assetId]) => {
        addAssetLinkMapping(nextAssetLinkMap, fieldName, assetId);
      });
      setCourseAssetMappings(courseAssets || {});
      setAssetLinkIdMap(nextAssetLinkMap);

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
      setCourseAssetMappings({});
      setAssetLinkIdMap({});
      setStructureLoadError(
        error instanceof Error ? error.message : "Failed to load course structure"
      );
    } finally {
      if (isCurrentRequest()) {
        setIsLoadingStructure(false);
      }
    }
  }, [courseId, courseTitle]);

  const resolveTopicAssetPreviewUrl = useCallback((value: string): string | null => {
    const src = (value || "").trim();
    if (!src) return null;
    if (/^(https?:)?\/\//i.test(src) || src.startsWith("/api/asset/")) return src;
    if (/^[a-f0-9]{24}$/i.test(src)) return `/api/asset/serve/${src}`;

    const normalized = src.replace(/^\/+/, "");
    if (!normalized.startsWith("course/assets/")) {
      if (src.startsWith("/")) return src;
      return src;
    }

    const fieldName = normalized.replace(/^course\/assets\//, "");
    const decodedFieldName = safeDecodeURIComponent(fieldName);
    const encodedFieldName = encodeURIComponent(decodedFieldName).replace(/%2F/gi, "/");
    const assetId =
      courseAssetMappings[fieldName] ||
      courseAssetMappings[decodedFieldName] ||
      courseAssetMappings[encodedFieldName] ||
      buildCourseAssetLinkCandidates(src).map((candidate) => assetLinkIdMap[candidate]).find(Boolean);
    if (assetId) return `/api/asset/serve/${assetId}`;

    const embeddedAssetId = extractAssetIdFromCourseAssetPath(src);
    if (embeddedAssetId) return `/api/asset/serve/${embeddedAssetId}`;

    // Fallback for pre-existing assets when mappings are missing or stale.
    return `/${encodeURI(normalized)}`;
  }, [assetLinkIdMap, courseAssetMappings]);

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

    const head = doc.head || doc.getElementsByTagName("head")[0] || null;
    if (!head) return;

    doc.getElementById("adapt-authoring-preview-bridge-style")?.remove();

    const style = doc.createElement("style");
    style.id = "adapt-authoring-preview-bridge-style";
    style.textContent = `
      .adapt-authoring-preview-hover,
      .adapt-authoring-preview-hover-header,
      .adapt-authoring-preview-active,
      .adapt-authoring-preview-active-header {
        position: relative !important;
        box-sizing: border-box !important;
        overflow: visible !important;
      }

      .adapt-authoring-preview-hover::after,
      .adapt-authoring-preview-hover-header::after,
      .adapt-authoring-preview-active::after,
      .adapt-authoring-preview-active-header::after {
        content: "";
        position: absolute;
        border-radius: 8px;
        pointer-events: none;
        z-index: 8;
      }

      .page.adapt-authoring-preview-hover::after,
      .page.adapt-authoring-preview-active::after {
        inset: 2px;
      }

      .article.adapt-authoring-preview-hover::after,
      .article.adapt-authoring-preview-active::after {
        inset: 2px;
      }

      .block.adapt-authoring-preview-hover::after,
      .block.adapt-authoring-preview-active::after {
        inset: 2px;
      }

      .component.adapt-authoring-preview-hover::after,
      .component.adapt-authoring-preview-active::after {
        inset: 2px;
      }

      .menu.adapt-authoring-preview-hover::after,
      .menu.adapt-authoring-preview-active::after {
        inset: 2px;
      }

      .adapt-authoring-preview-hover::after,
      .adapt-authoring-preview-hover-header::after {
        border: 1px dashed var(--life-primary-500, #2e7fa1) !important;
      }

      .adapt-authoring-preview-active::after,
      .adapt-authoring-preview-active-header::after {
        border: 1px solid var(--life-primary-500, #2e7fa1) !important;
      }

      .adapt-authoring-preview-topic-shell-active {
        border: none !important;
      }

      .adapt-authoring-preview-hover-header::before,
      .adapt-authoring-preview-active-header::before,
      .adapt-authoring-preview-hover::before,
      .adapt-authoring-preview-active::before {
        content: attr(data-preview-bridge-label);
        position: absolute;
        top: 1px;
        left: 12px;
        display: inline-block;
        padding: 0 4px;
        background: #fff;
        color: var(--life-primary-500, #2e7fa1);
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        line-height: 1.2;
        z-index: 9;
        pointer-events: none;
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

      .adapt-authoring-preview-inline-structured-header {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px !important;
      }

      .adapt-authoring-preview-inline-structured-header > .page__title,
      .adapt-authoring-preview-inline-structured-header > .page__subtitle,
      .adapt-authoring-preview-inline-structured-header > .page__body,
      .adapt-authoring-preview-inline-structured-header > .page__instruction,
      .adapt-authoring-preview-inline-structured-header > .article__title,
      .adapt-authoring-preview-inline-structured-header > .article__body,
      .adapt-authoring-preview-inline-structured-header > .article__instruction,
      .adapt-authoring-preview-inline-structured-header > .block__title,
      .adapt-authoring-preview-inline-structured-header > .block__body,
      .adapt-authoring-preview-inline-structured-header > .block__instruction,
      .adapt-authoring-preview-inline-structured-header > .component__title,
      .adapt-authoring-preview-inline-structured-header > .component__body,
      .adapt-authoring-preview-inline-structured-header > .component__instruction,
      .adapt-authoring-preview-inline-structured-header > .laerdal-text__subtitle {
        margin: 0 !important;
        padding: 0 !important;
      }

      .adapt-authoring-preview-inline-structured-header > .page__title,
      .adapt-authoring-preview-inline-structured-header > .article__title,
      .adapt-authoring-preview-inline-structured-header > .block__title,
      .adapt-authoring-preview-inline-structured-header > .component__title { order: 1 !important; }
      .adapt-authoring-preview-inline-structured-header > .page__subtitle,
      .adapt-authoring-preview-inline-structured-header > .laerdal-text__subtitle { order: 2 !important; }
      .adapt-authoring-preview-inline-structured-header > .page__body,
      .adapt-authoring-preview-inline-structured-header > .article__body,
      .adapt-authoring-preview-inline-structured-header > .block__body,
      .adapt-authoring-preview-inline-structured-header > .component__body { order: 3 !important; }
      .adapt-authoring-preview-inline-structured-header > .page__instruction,
      .adapt-authoring-preview-inline-structured-header > .article__instruction,
      .adapt-authoring-preview-inline-structured-header > .block__instruction,
      .adapt-authoring-preview-inline-structured-header > .component__instruction { order: 4 !important; }

      .adapt-authoring-preview-inline-structured-header .page__title-inner,
      .adapt-authoring-preview-inline-structured-header .page__subtitle-inner,
      .adapt-authoring-preview-inline-structured-header .page__body-inner,
      .adapt-authoring-preview-inline-structured-header .page__instruction-inner,
      .adapt-authoring-preview-inline-structured-header .article__title-inner,
      .adapt-authoring-preview-inline-structured-header .article__body-inner,
      .adapt-authoring-preview-inline-structured-header .article__instruction-inner,
      .adapt-authoring-preview-inline-structured-header .block__title-inner,
      .adapt-authoring-preview-inline-structured-header .block__body-inner,
      .adapt-authoring-preview-inline-structured-header .block__instruction-inner,
      .adapt-authoring-preview-inline-structured-header .component__title-inner,
      .adapt-authoring-preview-inline-structured-header .component__body-inner,
      .adapt-authoring-preview-inline-structured-header .component__instruction-inner,
      .adapt-authoring-preview-inline-structured-header .laerdal-text__subtitle {
        margin: 0 !important;
        padding: 0 !important;
        min-height: 0 !important;
      }

      .adapt-authoring-preview-inline-structured-header > [data-preview-inline-container-empty="true"] {
        min-height: 0 !important;
      }

      .adapt-authoring-preview-inline-structured-header > [data-preview-inline-container-empty="true"] .adapt-authoring-preview-inline-editable {
        display: inline-block !important;
        min-height: 0 !important;
        line-height: 1.25 !important;
      }
    `;
    head.appendChild(style);

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

    const resolveHighlightTarget = (
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
      const menuNode = resolveHighlightTarget("menu", null);
      if (menuNode) {
        menuNode.classList.add("adapt-authoring-preview-active");
        (menuNode as Element).setAttribute("data-preview-bridge-label", toBadgeLabel("menu"));
      }
    }

    if (hoverTargetId && hoverLevel) {
      const hoverNode = resolveHighlightTarget(hoverLevel, hoverTargetId);
      if (hoverNode) {
        hoverNode.classList.add("adapt-authoring-preview-hover");
        (hoverNode as Element).setAttribute("data-preview-bridge-label", toBadgeLabel(hoverLevel));
      }
    }

    if (activeLevel && (activeTargetId || activeLevel === "menu")) {
      const activeNode = resolveHighlightTarget(activeLevel, activeTargetId);
      if (activeNode) {
        activeNode.classList.add("adapt-authoring-preview-active");
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
      doc.querySelectorAll("[data-preview-injected='true']").forEach((node) => {
        const parent = node.parentElement;
        node.remove();
        if (parent?.getAttribute("data-preview-injected") === "true" && !parent.textContent?.trim() && !parent.querySelector("*")) {
          parent.remove();
        }
      });
      doc.querySelectorAll(".adapt-authoring-preview-inline-structured-header").forEach((node) => {
        node.classList.remove("adapt-authoring-preview-inline-structured-header");
      });

      doc.querySelectorAll("[data-preview-inline-container-empty='true']").forEach((node) => {
        node.removeAttribute("data-preview-inline-container-empty");
      });

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

    const ensureHeaderInnerHost = (
      root: Element | null,
      containerSelector: string,
      containerClassName: string,
      innerSelector: string,
      innerClassName: string,
      insertBeforeSelectors: string[]
    ): HTMLElement | null => {
      if (!root) return null;

      const existingInner = root.querySelector(innerSelector) as HTMLElement | null;
      if (existingInner) {
        return existingInner;
      }

      let container = root.querySelector(containerSelector) as HTMLElement | null;
      if (!container) {
        container = doc.createElement("div");
        container.className = containerClassName;
        container.setAttribute("data-preview-injected", "true");

        const firstDirectChild = insertBeforeSelectors
          .map((selector) => root.querySelector(selector))
          .find((candidate) => candidate && candidate.parentElement === root);

        if (firstDirectChild) {
          root.insertBefore(container, firstDirectChild);
        } else if (root.firstChild) {
          root.insertBefore(container, root.firstChild);
        } else {
          root.appendChild(container);
        }
      }

      const inner = doc.createElement("div");
      inner.className = innerClassName;
      inner.setAttribute("data-preview-injected", "true");
      container.appendChild(inner);
      return inner;
    };

    const ensureTopicTitleInner = (
      host: Element,
      value: string
    ): HTMLElement => {
      const existingInner = host.querySelector(".page__title-inner") as HTMLElement | null;
      if (existingInner) {
        return existingInner;
      }

      let container = host.querySelector(".page__title") as HTMLElement | null;
      if (!container) {
        container = doc.createElement("div");
        container.className = "page__title";
        container.setAttribute("data-preview-injected", "true");

        const firstBodyLikeBlock = host.querySelector(
          ".page__subtitle, .page__body, .page__instruction"
        );
        if (firstBodyLikeBlock && firstBodyLikeBlock.parentElement === host) {
          host.insertBefore(container, firstBodyLikeBlock);
        } else if (host.firstChild) {
          host.insertBefore(container, host.firstChild);
        } else {
          host.appendChild(container);
        }
      }

      const inner = doc.createElement("div");
      inner.className = "page__title-inner";
      inner.textContent = value;
      inner.setAttribute("data-preview-injected", "true");
      container.appendChild(inner);
      return inner;
    };

    const ensureTitleInner = (
      host: Element,
      containerSelector: string,
      containerClassName: string,
      innerSelector: string,
      innerClassName: string,
      value: string,
      insertBeforeSelectors: string[]
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

        const firstDirectChild = insertBeforeSelectors
          .map((selector) => host.querySelector(selector))
          .find((candidate) => candidate && candidate.parentElement === host);

        if (firstDirectChild) {
          host.insertBefore(container, firstDirectChild);
        } else if (host.firstChild) {
          host.insertBefore(container, host.firstChild);
        } else {
          host.appendChild(container);
        }
      }

      const inner = doc.createElement("div");
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
      const container = element.closest(
        ".page__title, .page__subtitle, .page__body, .page__instruction, .article__title, .article__body, .article__instruction, .block__title, .block__body, .block__instruction, .component__title, .component__body, .component__instruction, .laerdal-text__subtitle"
      ) as HTMLElement | null;

      if (!hasText) {
        element.classList.add("adapt-authoring-preview-inline-empty");
        container?.setAttribute("data-preview-inline-container-empty", "true");
      } else {
        element.classList.remove("adapt-authoring-preview-inline-empty");
        container?.removeAttribute("data-preview-inline-container-empty");
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

      componentHost.classList.add("adapt-authoring-preview-inline-structured-header");

      const titleEl = ensureTitleInner(
        componentHost,
        ".component__title",
        "component__title",
        ".component__title-inner",
        "component__title-inner",
        selectedComponent.settings.title || "",
        [".laerdal-text__subtitle", ".component__body", ".component__instruction"]
      );
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
      const blockHeader = ensureHeaderInnerHost(
        blockNode,
        ".block__header",
        "block__header",
        ".block__header-inner",
        "block__header-inner",
        [".block__inner"]
      );
      if (!blockHeader) return;

      blockHeader.classList.add("adapt-authoring-preview-inline-structured-header");

      const titleEl = ensureTitleInner(
        blockHeader,
        ".block__title",
        "block__title",
        ".block__title-inner",
        "block__title-inner",
        selectedBlock.title || "",
        [".block__body", ".block__instruction"]
      );
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
      const articleHeader = ensureHeaderInnerHost(
        articleNode,
        ".article__header",
        "article__header",
        ".article__header-inner",
        "article__header-inner",
        [".article__inner"]
      );
      if (!articleHeader) return;

      articleHeader.classList.add("adapt-authoring-preview-inline-structured-header");

      const titleEl = ensureTitleInner(
        articleHeader,
        ".article__title",
        "article__title",
        ".article__title-inner",
        "article__title-inner",
        selectedArticle.title || "",
        [".article__body", ".article__instruction"]
      );
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
      const pageHeader = ensureHeaderInnerHost(
        pageNode,
        ".page__header",
        "page__header",
        ".page__header-inner",
        "page__header-inner",
        [".page__inner"]
      );
      if (!pageHeader) return;

      pageHeader.classList.add("adapt-authoring-preview-inline-structured-header");

      const previewTopicTitle = selectedPage.title || "";
      const titleEl = ensureTopicTitleInner(pageHeader, previewTopicTitle);
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
        titleContainer.style.display = "";
      } else {
        titleEl.style.display = "";
      }
      makeEditable(titleEl, {
        level: "topic",
        field: "title",
        placeholder: "TOPIC TITLE",
        value: selectedPage.title || "",
        pageId: selectedPage.id,
      });
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

  const syncPreviewTopicSettings = useCallback(() => {
    if (!selectedPageId) return;

    const iframe = previewFrameRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    const selectedPage = contentPages.find((page) => page.id === selectedPageId);
    if (!selectedPage) return;

    const selectedArticle = selectedArticleId
      ? selectedPage.articles.find((article) => article.id === selectedArticleId)
      : null;
    const selectedBlock = selectedArticle && selectedBlockId
      ? selectedArticle.blocks.find((block) => block.id === selectedBlockId)
      : null;
    const selectedComponent = selectedBlock && selectedComponentId
      ? selectedBlock.components.find((component) => component.id === selectedComponentId)
      : null;

    const pageNode = doc.querySelector(`.page[data-adapt-id="${selectedPage.id}"]`) as HTMLElement | null;
    if (!pageNode) return;

    const pageInner =
      (pageNode.querySelector(".page__inner") as HTMLElement | null) ?? pageNode;
    const pageHeader =
      (pageNode.querySelector(".page__header") as HTMLElement | null) ??
      (pageNode.querySelector(".page__header-inner") as HTMLElement | null);

    const activeThemeSettings = getActiveThemeSettings(selectedPage.themeSettings);
    const headerSettings = asRecord(activeThemeSettings._pageHeader);
    const pageBackgroundImage = asRecord(activeThemeSettings._backgroundImage) as TopicResponsiveAssetMap;
    const pageBackgroundStyles = asRecord(activeThemeSettings._backgroundStyles);
    const headerBackgroundImage = asRecord(headerSettings._backgroundImage) as TopicResponsiveAssetMap;
    const headerBackgroundStyles = asRecord(headerSettings._backgroundStyles);
    const headerMinimumHeights = asRecord(headerSettings._minimumHeights);
    const headerTextAlignment = asRecord(headerSettings._textAlignment);
    const headerGraphic = asRecord(headerSettings._graphic);
    const activeMenuSettings = getActiveMenuSettings(selectedPage.menuSettings);
    const menuHeaderSettings = asRecord(activeMenuSettings._menuHeader);
    const menuBackgroundImage = asRecord(activeMenuSettings._backgroundImage) as TopicResponsiveAssetMap;
    const menuBackgroundStyles = asRecord(activeMenuSettings._backgroundStyles);
    const menuHeaderBackgroundImage = asRecord(menuHeaderSettings._backgroundImage) as TopicResponsiveAssetMap;
    const menuHeaderBackgroundStyles = asRecord(menuHeaderSettings._backgroundStyles);
    const menuHeaderMinimumHeights = asRecord(menuHeaderSettings._minimumHeights);
    const menuHeaderTextAlignment = asRecord(menuHeaderSettings._textAlignment);
    const menuGraphic = asRecord(activeMenuSettings._graphic);

    const getPreviewBreakpoint = (): BreakpointKey => {
      const viewportWidth =
        iframe?.contentWindow?.innerWidth ||
        pageInner.clientWidth ||
        0;

      if (viewportWidth >= 1200) return "_xlarge";
      if (viewportWidth >= 992) return "_large";
      if (viewportWidth >= 768) return "_medium";
      return "_small";
    };

    const activeBreakpoint = getPreviewBreakpoint();

    const legacyBreakpoint = activeBreakpoint.replace(/^_/, "") as "xlarge" | "large" | "medium" | "small";

    const pickBreakpointValue = (map?: Record<string, unknown>) => {
      if (!map) return "";
      return asString(map[activeBreakpoint] ?? map[legacyBreakpoint]);
    };

    const pickResponsiveValue = (map?: TopicResponsiveAssetMap) => {
      return pickBreakpointValue(map as Record<string, unknown> | undefined);
    };

    const pickResponsiveClass = (map?: TopicResponsiveClasses) => {
      return pickBreakpointValue(map as Record<string, unknown> | undefined);
    };

    const pickResponsiveNumber = (map?: TopicMinimumHeights) => {
      if (!map) return "";
      return asNumberOrEmpty((map as Record<string, unknown>)[activeBreakpoint] ?? (map as Record<string, unknown>)[legacyBreakpoint]);
    };

    const applyBackgroundStyles = (
      element: HTMLElement | null,
      backgroundUrl: string,
      styles: Record<string, unknown>
    ) => {
      if (!element) return;

      if (backgroundUrl) {
        element.style.backgroundImage = `url("${backgroundUrl}")`;
      } else {
        element.style.removeProperty("background-image");
      }

      const repeat = asString(styles._backgroundRepeat);
      const size = asString(styles._backgroundSize);
      const position = asString(styles._backgroundPosition);

      if (repeat) {
        element.style.backgroundRepeat = repeat;
      } else {
        element.style.removeProperty("background-repeat");
      }

      if (size) {
        element.style.backgroundSize = size;
      } else {
        element.style.removeProperty("background-size");
      }

      if (position) {
        element.style.backgroundPosition = position;
      } else {
        element.style.removeProperty("background-position");
      }
    };

    const applyTextAlign = (selector: string, alignValue: string) => {
      const element = pageNode.querySelector(selector) as HTMLElement | null;
      if (!element) return;
      if (alignValue) {
        element.style.textAlign = alignValue;
      } else {
        element.style.removeProperty("text-align");
      }
    };

    const applyTextAlignWithin = (host: ParentNode | null, selector: string, alignValue: string) => {
      if (!host) return;
      const element = host.querySelector(selector) as HTMLElement | null;
      if (!element) return;
      if (alignValue) {
        element.style.textAlign = alignValue;
      } else {
        element.style.removeProperty("text-align");
      }
    };

    const parseClassTokens = (value: string) =>
      value
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);

    const applyManagedClasses = (element: HTMLElement | null, managedClassString: string) => {
      if (!element) return;

      const previous = parseClassTokens(element.getAttribute("data-preview-managed-classes") || "");
      previous.forEach((token) => element.classList.remove(token));

      const next = parseClassTokens(managedClassString);
      next.forEach((token) => element.classList.add(token));
      element.setAttribute("data-preview-managed-classes", next.join(" "));
    };

    const resolveAssetForPreview = (source: string) => {
      const resolved = resolveTopicAssetPreviewUrl(source);
      if (resolved) return resolved;
      return toRenderableAssetUrl(source) || "";
    };

    const upsertPreviewImage = (
      host: HTMLElement | null,
      selectors: string[],
      src: string,
      alt: string,
      key: string
    ) => {
      if (!host) return;

      let image: HTMLImageElement | null = null;
      for (const selector of selectors) {
        const candidate = host.querySelector(selector) as HTMLImageElement | null;
        if (candidate) {
          image = candidate;
          break;
        }
      }

      if (!image && src) {
        const wrapper = doc.createElement("div");
        wrapper.className = "adapt-authoring-preview-injected-asset";
        wrapper.setAttribute("data-preview-injected", "true");
        image = doc.createElement("img");
        image.setAttribute("data-preview-injected", "true");
        image.setAttribute("data-preview-asset-key", key);
        image.style.maxWidth = "100%";
        image.style.height = "auto";
        wrapper.appendChild(image);
        host.appendChild(wrapper);
      }

      if (!image) return;

      if (!src) {
        if (image.getAttribute("data-preview-injected") === "true") {
          image.parentElement?.remove();
        } else {
          image.removeAttribute("src");
          image.style.display = "none";
        }
        return;
      }

      image.src = src;
      image.alt = alt;
      image.style.removeProperty("display");
    };

    const pageBackgroundUrl = resolveAssetForPreview(pickResponsiveValue(pageBackgroundImage));
    const headerBackgroundUrl = resolveAssetForPreview(pickResponsiveValue(headerBackgroundImage));
    const themeHeaderGraphicUrl = resolveAssetForPreview(asString(headerGraphic._src));
    const pageGraphicUrl = resolveAssetForPreview(asString(selectedPage.graphic?.src));
    const menuBackgroundUrl = resolveAssetForPreview(pickResponsiveValue(menuBackgroundImage));
    const menuHeaderBackgroundUrl = resolveAssetForPreview(pickResponsiveValue(menuHeaderBackgroundImage));
    const menuGraphicUrl = resolveAssetForPreview(asString(menuGraphic._src));

    applyBackgroundStyles(pageInner, pageBackgroundUrl, pageBackgroundStyles);
    applyBackgroundStyles(pageHeader, headerBackgroundUrl, headerBackgroundStyles);

    const mergedTopicClasses = [
      asString(selectedPage.classes),
      asString(selectedPage.onScreen?._classes),
      pickResponsiveClass(asRecord(activeThemeSettings._responsiveClasses) as TopicResponsiveClasses),
    ]
      .filter(Boolean)
      .join(" ");
    applyManagedClasses(pageNode, mergedTopicClasses);

    const minHeight = pickResponsiveNumber(headerMinimumHeights as TopicMinimumHeights);

    if (typeof minHeight === "number") {
      pageHeader?.style.setProperty("min-height", `${minHeight}px`);
    } else {
      pageHeader?.style.removeProperty("min-height");
    }

    applyTextAlign(".page__title-inner", asString(headerTextAlignment._title));
    applyTextAlign(".page__subtitle-inner", asString(headerTextAlignment._subtitle));
    applyTextAlign(".page__body-inner", asString(headerTextAlignment._body));
    applyTextAlign(".page__instruction-inner", asString(headerTextAlignment._instruction));

    upsertPreviewImage(
      pageHeader,
      [
        'img[data-preview-asset-key="theme-header-graphic"]',
        ".page__header img",
        ".page__graphic img",
      ],
      themeHeaderGraphicUrl,
      asString(headerGraphic.alt),
      "theme-header-graphic"
    );

    upsertPreviewImage(
      pageNode,
      [
        'img[data-preview-asset-key="page-graphic"]',
        ".page__graphic img",
      ],
      pageGraphicUrl,
      asString(selectedPage.graphic?.alt),
      "page-graphic"
    );

    if (selectedArticle) {
      const articleNode = doc.querySelector(`.article[data-adapt-id="${selectedArticle.id}"]`) as HTMLElement | null;
      const articleInner =
        (articleNode?.querySelector(".article__inner") as HTMLElement | null) ??
        (articleNode?.querySelector(".article__header-inner") as HTMLElement | null) ??
        articleNode;
      const articleThemeSettings = getActiveThemeSettings(selectedArticle.themeSettings);
      const articleBackgroundImage = asRecord(articleThemeSettings._backgroundImage) as TopicResponsiveAssetMap;
      const articleBackgroundStyles = asRecord(articleThemeSettings._backgroundStyles);
      const articleBackgroundUrl = resolveAssetForPreview(pickResponsiveValue(articleBackgroundImage));
      applyBackgroundStyles(articleInner, articleBackgroundUrl, articleBackgroundStyles);
    }

    if (selectedBlock) {
      const blockNode = doc.querySelector(`.block[data-adapt-id="${selectedBlock.id}"]`) as HTMLElement | null;
      const blockInner =
        (blockNode?.querySelector(".block__inner") as HTMLElement | null) ??
        (blockNode?.querySelector(".block__header-inner") as HTMLElement | null) ??
        blockNode;
      const blockThemeSettings = getActiveThemeSettings(selectedBlock.themeSettings);
      const blockBackgroundImage = asRecord(blockThemeSettings._backgroundImage) as TopicResponsiveAssetMap;
      const blockBackgroundStyles = asRecord(blockThemeSettings._backgroundStyles);
      const blockBackgroundUrl = resolveAssetForPreview(pickResponsiveValue(blockBackgroundImage));
      applyBackgroundStyles(blockInner, blockBackgroundUrl, blockBackgroundStyles);
    }

    if (selectedComponent) {
      const componentNode = doc.querySelector(`.component[data-adapt-id="${selectedComponent.id}"]`) as HTMLElement | null;
      const componentInner =
        (componentNode?.querySelector(".component__inner") as HTMLElement | null) ??
        componentNode;
      const componentThemeSettings = getActiveThemeSettings(selectedComponent.themeSettings);
      const componentBackgroundImage = asRecord(componentThemeSettings._backgroundImage) as TopicResponsiveAssetMap;
      const componentBackgroundStyles = asRecord(componentThemeSettings._backgroundStyles);
      const componentBackgroundUrl = resolveAssetForPreview(pickResponsiveValue(componentBackgroundImage));
      applyBackgroundStyles(componentInner, componentBackgroundUrl, componentBackgroundStyles);
    }

    const menuItemNode =
      (doc.querySelector(`.menu-item[data-adapt-id="${selectedPage.id}"]`) as HTMLElement | null) ??
      (doc.querySelector(`.menu__item[data-adapt-id="${selectedPage.id}"]`) as HTMLElement | null);
    if (menuItemNode) {
      const menuItemInner =
        (menuItemNode.querySelector(".menu-item__inner") as HTMLElement | null) ??
        (menuItemNode.querySelector(".menu__item-inner") as HTMLElement | null) ??
        menuItemNode;
      const menuHeader =
        (menuItemNode.querySelector(".menu-item__header") as HTMLElement | null) ??
        (menuItemNode.querySelector(".menu__item-header") as HTMLElement | null) ??
        menuItemInner;

      applyBackgroundStyles(menuItemInner, menuBackgroundUrl, menuBackgroundStyles);
      applyBackgroundStyles(menuHeader, menuHeaderBackgroundUrl, menuHeaderBackgroundStyles);

      const menuMinHeight = pickResponsiveNumber(menuHeaderMinimumHeights as TopicMinimumHeights);
      if (typeof menuMinHeight === "number") {
        menuHeader.style.setProperty("min-height", `${menuMinHeight}px`);
      } else {
        menuHeader.style.removeProperty("min-height");
      }

      applyTextAlignWithin(menuItemNode, ".menu-item__title, .menu__item-title", asString(menuHeaderTextAlignment._title));
      applyTextAlignWithin(menuItemNode, ".menu-item__subtitle, .menu__item-subtitle", asString(menuHeaderTextAlignment._subtitle));
      applyTextAlignWithin(menuItemNode, ".menu-item__body, .menu__item-body", asString(menuHeaderTextAlignment._body));
      applyTextAlignWithin(menuItemNode, ".menu-item__instruction, .menu__item-instruction", asString(menuHeaderTextAlignment._instruction));

      upsertPreviewImage(
        menuItemInner,
        [
          'img[data-preview-asset-key="menu-graphic"]',
          ".menu-item__graphic img",
          ".menu__item-graphic img",
        ],
        menuGraphicUrl,
        asString(menuGraphic.alt),
        "menu-graphic"
      );
    }
  }, [contentPages, resolveTopicAssetPreviewUrl, selectedArticleId, selectedBlockId, selectedComponentId, selectedPageId]);

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
      ? base.querySelector(".page__inner") ?? base.querySelector(".page__header-inner") ?? base
      : pendingTarget.level === "section"
        ? base.querySelector(".article__inner") ?? base.querySelector(".article__header-inner") ?? base
        : pendingTarget.level === "group"
          ? base.querySelector(".block__inner") ?? base.querySelector(".block__header-inner") ?? base
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

    let hoverRafId: number | null = null;
    let pendingHoverState: PreviewHoverState | null = null;

    const applyHoverState = () => {
      hoverRafId = null;
      if (!pendingHoverState) return;
      const nextState = pendingHoverState;
      pendingHoverState = null;
      setPreviewHoverState((previous) => {
        if (
          previous.level === nextState.level &&
          previous.pageId === nextState.pageId &&
          previous.articleId === nextState.articleId &&
          previous.blockId === nextState.blockId &&
          previous.componentId === nextState.componentId
        ) {
          return previous;
        }
        return nextState;
      });
    };

    const queueHoverState = (state: PreviewHoverState) => {
      pendingHoverState = state;
      if (hoverRafId !== null) return;
      hoverRafId = window.requestAnimationFrame(applyHoverState);
    };

    const onMouseOver = (event: Event) => {
      const state = resolvePreviewIds(event.target as Element | null);
      queueHoverState(state);
    };

    const onMouseOut = (event: MouseEvent) => {
      const relatedTarget = event.relatedTarget as Node | null;
      if (relatedTarget && doc.contains(relatedTarget)) return;
      queueHoverState({ pageId: null, articleId: null, blockId: null, componentId: null, level: null });
    };

    const onClick = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;

      const clickedSelectableRegion = target.closest(
        ".page__header-inner, .page__inner, .article__header-inner, .article__inner, .block__header-inner, .block__inner, .component__inner, .menu[data-adapt-id]"
      );
      if (!clickedSelectableRegion) {
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
    syncPreviewTopicSettings();
    syncPreviewScrollFromLeftPanel();

    cleanupPreviewListenersRef.current = () => {
      if (hoverRafId !== null) {
        window.cancelAnimationFrame(hoverRafId);
      }
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
    syncPreviewTopicSettings,
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
    syncPreviewTopicSettings();
  }, [syncPreviewTopicSettings]);

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
    if (copiedSectionIdResetTimerRef.current !== null) {
      window.clearTimeout(copiedSectionIdResetTimerRef.current);
      copiedSectionIdResetTimerRef.current = null;
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

  function handleCopySectionId(sectionId: string) {
    if (!sectionId) return;
    const afterCopy = () => {
      setCopiedSectionId(sectionId);
      if (copiedSectionIdResetTimerRef.current !== null) {
        window.clearTimeout(copiedSectionIdResetTimerRef.current);
      }
      copiedSectionIdResetTimerRef.current = window.setTimeout(() => {
        setCopiedSectionId((current) => (current === sectionId ? null : current));
        copiedSectionIdResetTimerRef.current = null;
      }, 2000);
    };
    const fallbackCopy = () => {
      const helperTextArea = document.createElement("textarea");
      helperTextArea.value = sectionId;
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
      void navigator.clipboard.writeText(sectionId).then(afterCopy).catch(fallbackCopy);
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

  function toggleTopicAccordion(
    id: "general" | "availability" | "accessibility" | "extensions" | "theme" | "menu" | "media" | "advanced",
    triggerEl?: HTMLButtonElement
  ) {
    const container = rightPanelScrollRef.current;
    const topBefore = container && triggerEl ? triggerEl.getBoundingClientRect().top : null;

    setOpenTopicAccordions((prev) => ({
      general: false,
      availability: false,
      accessibility: false,
      extensions: false,
      theme: false,
      menu: false,
      media: false,
      advanced: false,
      [id]: !prev[id],
    }));

    if (container && triggerEl) {
      requestAnimationFrame(() => {
        if (!triggerEl.isConnected) return;

        const topAfter = triggerEl.getBoundingClientRect().top;
        if (topBefore !== null) {
          container.scrollTop += topAfter - topBefore;
        }

        const padding = 10;
        const containerRect = container.getBoundingClientRect();
        const triggerRect = triggerEl.getBoundingClientRect();

        if (triggerRect.top < containerRect.top + padding) {
          container.scrollTop -= (containerRect.top + padding) - triggerRect.top;
        } else if (triggerRect.bottom > containerRect.bottom - padding) {
          container.scrollTop += triggerRect.bottom - (containerRect.bottom - padding);
        }
      });
    }
  }

  function handleCanvasClick() {
    clearCanvasSelection();
  }

  function toggleSectionAccordion(
    id: "general" | "availability" | "accessibility" | "extensions" | "theme" | "advanced",
    triggerEl?: HTMLButtonElement
  ) {
    const container = rightPanelScrollRef.current;
    const topBefore = container && triggerEl ? triggerEl.getBoundingClientRect().top : null;

    setOpenSectionAccordions((prev) => ({
      general: false,
      availability: false,
      accessibility: false,
      extensions: false,
      theme: false,
      advanced: false,
      [id]: !prev[id],
    }));

    if (container && triggerEl) {
      requestAnimationFrame(() => {
        if (!triggerEl.isConnected) return;
        const topAfter = triggerEl.getBoundingClientRect().top;
        if (topBefore !== null) {
          container.scrollTop += topAfter - topBefore;
        }
        const padding = 10;
        const containerRect = container.getBoundingClientRect();
        const triggerRect = triggerEl.getBoundingClientRect();
        if (triggerRect.top < containerRect.top + padding) {
          container.scrollTop -= (containerRect.top + padding) - triggerRect.top;
        } else if (triggerRect.bottom > containerRect.bottom - padding) {
          container.scrollTop += triggerRect.bottom - (containerRect.bottom - padding);
        }
      });
    }
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
    setOpenSectionAccordions(DEFAULT_SECTION_ACCORDIONS);
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
      setOpenTopicAccordions(DEFAULT_TOPIC_ACCORDIONS);
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

  function resolveThemeSettingsKey(settings: Record<string, unknown>) {
    const normalizedThemeName = courseTheme.toLowerCase();
    const preferredKey = normalizedThemeName.includes("custom")
      ? "_custom"
      : normalizedThemeName.includes("vanilla")
        ? "_vanilla"
        : "_life";

    if (Object.prototype.hasOwnProperty.call(settings, preferredKey)) {
      return preferredKey;
    }

    const firstNestedKey = Object.keys(settings).find((key) => {
      if (!key.startsWith("_")) return false;
      const value = asRecord(settings[key]);
      return Object.keys(value).length > 0;
    });

    return firstNestedKey ?? preferredKey;
  }

  function resolveMenuSettingsKey(settings: Record<string, unknown>) {
    const normalizedMenuName = courseMenu.toLowerCase();
    const preferredKey = normalizedMenuName.includes("box")
      ? "_boxMenu"
      : normalizedMenuName.includes("overview")
        ? "_overviewMenu"
        : normalizedMenuName.includes("custom")
          ? "_customMenu"
          : "_lifeMenu";

    if (Object.prototype.hasOwnProperty.call(settings, preferredKey)) {
      return preferredKey;
    }

    const firstNestedKey = Object.keys(settings).find((key) => {
      if (!key.startsWith("_")) return false;
      const value = asRecord(settings[key]);
      return Object.keys(value).length > 0;
    });

    return firstNestedKey ?? preferredKey;
  }

  function getActiveThemeSettings(settingsValue: unknown): TopicThemeSettings {
    const settings = asRecord(settingsValue);
    if (
      Object.prototype.hasOwnProperty.call(settings, "_backgroundImage") ||
      Object.prototype.hasOwnProperty.call(settings, "_backgroundStyles") ||
      Object.prototype.hasOwnProperty.call(settings, "_pageHeader") ||
      Object.prototype.hasOwnProperty.call(settings, "_htmlClasses") ||
      Object.prototype.hasOwnProperty.call(settings, "_responsiveClasses")
    ) {
      return settings as TopicThemeSettings;
    }

    const key = resolveThemeSettingsKey(settings);
    return asRecord(settings[key]) as TopicThemeSettings;
  }

  function getActiveMenuSettings(settingsValue: unknown): TopicMenuSettings {
    const settings = asRecord(settingsValue);
    if (
      Object.prototype.hasOwnProperty.call(settings, "_graphic") ||
      Object.prototype.hasOwnProperty.call(settings, "_backgroundImage") ||
      Object.prototype.hasOwnProperty.call(settings, "_menuHeader")
    ) {
      return settings as TopicMenuSettings;
    }

    const key = resolveMenuSettingsKey(settings);
    return asRecord(settings[key]) as TopicMenuSettings;
  }

  function updatePageThemeSettings(pageId: string, updater: (current: TopicThemeSettings) => TopicThemeSettings) {
    setContentPages((previousPages) =>
      previousPages.map((p) =>
        p.id === pageId
          ? (() => {
              const rawThemeSettings = asRecord(p.themeSettings);
              const isFlatThemeSettings =
                Object.prototype.hasOwnProperty.call(rawThemeSettings, "_backgroundImage") ||
                Object.prototype.hasOwnProperty.call(rawThemeSettings, "_backgroundStyles") ||
                Object.prototype.hasOwnProperty.call(rawThemeSettings, "_pageHeader") ||
                Object.prototype.hasOwnProperty.call(rawThemeSettings, "_htmlClasses") ||
                Object.prototype.hasOwnProperty.call(rawThemeSettings, "_responsiveClasses");

              if (isFlatThemeSettings) {
                return { ...p, themeSettings: updater(rawThemeSettings as TopicThemeSettings) };
              }

              const themeKey = resolveThemeSettingsKey(rawThemeSettings);
              const scopedThemeSettings = asRecord(rawThemeSettings[themeKey]) as TopicThemeSettings;
              return {
                ...p,
                themeSettings: {
                  ...rawThemeSettings,
                  [themeKey]: updater(scopedThemeSettings),
                } as TopicThemeSettings,
              };
            })()
          : p
      )
    );
    setDirtyNodeKeys((prev) => ({ ...prev, [`topic:${pageId}`]: true }));
  }

  function updateArticleThemeSettings(pageId: string, articleId: string, updater: (current: TopicThemeSettings) => TopicThemeSettings) {
    setContentPages((previousPages) =>
      previousPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: p.articles.map((a) => {
                if (a.id !== articleId) return a;

                const rawThemeSettings = asRecord(a.themeSettings);
                const isFlatThemeSettings =
                  Object.prototype.hasOwnProperty.call(rawThemeSettings, "_backgroundImage") ||
                  Object.prototype.hasOwnProperty.call(rawThemeSettings, "_backgroundStyles") ||
                  Object.prototype.hasOwnProperty.call(rawThemeSettings, "_pageHeader") ||
                  Object.prototype.hasOwnProperty.call(rawThemeSettings, "_htmlClasses") ||
                  Object.prototype.hasOwnProperty.call(rawThemeSettings, "_responsiveClasses");

                if (isFlatThemeSettings) {
                  return { ...a, themeSettings: updater(rawThemeSettings as TopicThemeSettings) };
                }

                const themeKey = resolveThemeSettingsKey(rawThemeSettings);
                const scopedThemeSettings = asRecord(rawThemeSettings[themeKey]) as TopicThemeSettings;
                return {
                  ...a,
                  themeSettings: {
                    ...rawThemeSettings,
                    [themeKey]: updater(scopedThemeSettings),
                  } as TopicThemeSettings,
                };
              }),
            }
          : p
      )
    );
    setDirtyNodeKeys((prev) => ({ ...prev, [`section:${articleId}`]: true }));
  }

  function updateBlockThemeSettings(
    pageId: string,
    articleId: string,
    blockId: string,
    updater: (current: TopicThemeSettings) => TopicThemeSettings
  ) {
    setContentPages((previousPages) =>
      previousPages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              articles: p.articles.map((a) =>
                a.id === articleId
                  ? {
                      ...a,
                      blocks: a.blocks.map((b) => {
                        if (b.id !== blockId) return b;

                        const rawThemeSettings = asRecord(b.themeSettings);
                        const isFlatThemeSettings =
                          Object.prototype.hasOwnProperty.call(rawThemeSettings, "_backgroundImage") ||
                          Object.prototype.hasOwnProperty.call(rawThemeSettings, "_backgroundStyles") ||
                          Object.prototype.hasOwnProperty.call(rawThemeSettings, "_pageHeader") ||
                          Object.prototype.hasOwnProperty.call(rawThemeSettings, "_htmlClasses") ||
                          Object.prototype.hasOwnProperty.call(rawThemeSettings, "_responsiveClasses");

                        if (isFlatThemeSettings) {
                          return { ...b, themeSettings: updater(rawThemeSettings as TopicThemeSettings) };
                        }

                        const themeKey = resolveThemeSettingsKey(rawThemeSettings);
                        const scopedThemeSettings = asRecord(rawThemeSettings[themeKey]) as TopicThemeSettings;
                        return {
                          ...b,
                          themeSettings: {
                            ...rawThemeSettings,
                            [themeKey]: updater(scopedThemeSettings),
                          } as TopicThemeSettings,
                        };
                      }),
                    }
                  : a
              ),
            }
          : p
      )
    );
    setDirtyNodeKeys((prev) => ({ ...prev, [`contentGroup:${blockId}`]: true }));
  }

  function updateComponentThemeSettings(
    pageId: string,
    articleId: string,
    blockId: string,
    componentId: string,
    updater: (current: TopicThemeSettings) => TopicThemeSettings
  ) {
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
                              components: b.components.map((c) => {
                                if (c.id !== componentId) return c;

                                const rawThemeSettings = asRecord(c.themeSettings);
                                const isFlatThemeSettings =
                                  Object.prototype.hasOwnProperty.call(rawThemeSettings, "_backgroundImage") ||
                                  Object.prototype.hasOwnProperty.call(rawThemeSettings, "_backgroundStyles") ||
                                  Object.prototype.hasOwnProperty.call(rawThemeSettings, "_pageHeader") ||
                                  Object.prototype.hasOwnProperty.call(rawThemeSettings, "_htmlClasses") ||
                                  Object.prototype.hasOwnProperty.call(rawThemeSettings, "_responsiveClasses");

                                if (isFlatThemeSettings) {
                                  return { ...c, themeSettings: updater(rawThemeSettings as TopicThemeSettings) };
                                }

                                const themeKey = resolveThemeSettingsKey(rawThemeSettings);
                                const scopedThemeSettings = asRecord(rawThemeSettings[themeKey]) as TopicThemeSettings;
                                return {
                                  ...c,
                                  themeSettings: {
                                    ...rawThemeSettings,
                                    [themeKey]: updater(scopedThemeSettings),
                                  } as TopicThemeSettings,
                                };
                              }),
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

  function updatePageMenuSettings(pageId: string, updater: (current: TopicMenuSettings) => TopicMenuSettings) {
    setContentPages((previousPages) =>
      previousPages.map((p) =>
        p.id === pageId
          ? (() => {
              const rawMenuSettings = asRecord(p.menuSettings);
              const isFlatMenuSettings =
                Object.prototype.hasOwnProperty.call(rawMenuSettings, "_graphic") ||
                Object.prototype.hasOwnProperty.call(rawMenuSettings, "_backgroundImage") ||
                Object.prototype.hasOwnProperty.call(rawMenuSettings, "_menuHeader");

              if (isFlatMenuSettings) {
                return { ...p, menuSettings: updater(rawMenuSettings as TopicMenuSettings) };
              }

              const menuKey = resolveMenuSettingsKey(rawMenuSettings);
              const scopedMenuSettings = asRecord(rawMenuSettings[menuKey]) as TopicMenuSettings;
              return {
                ...p,
                menuSettings: {
                  ...rawMenuSettings,
                  [menuKey]: updater(scopedMenuSettings),
                } as TopicMenuSettings,
              };
            })()
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

    if (target.scope === "sectionBackground") {
      updateArticleThemeSettings(pageId, target.articleId, (current) => ({
        ...current,
        _backgroundImage: {
          ...asRecord(current._backgroundImage),
          [target.bp]: assetLink,
        },
      }));
      return;
    }

    if (target.scope === "sectionArticleHeaderBackground") {
      updateArticleThemeSettings(pageId, target.articleId, (current) => ({
        ...current,
        _articleHeader: {
          ...asRecord(current._articleHeader),
          _backgroundImage: {
            ...asRecord(asRecord(current._articleHeader)._backgroundImage),
            [target.bp]: assetLink,
          },
        },
      }));
      return;
    }

    if (target.scope === "contentGroupBackground") {
      updateBlockThemeSettings(pageId, target.articleId, target.blockId, (current) => ({
        ...current,
        _backgroundImage: {
          ...asRecord(current._backgroundImage),
          [target.bp]: assetLink,
        },
      }));
      return;
    }

    if (target.scope === "componentBackground") {
      updateComponentThemeSettings(pageId, target.articleId, target.blockId, target.componentId, (current) => ({
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

      const currentFieldNames = collectCourseAssetFieldNames(contentPages);
      const savedFieldNames = collectCourseAssetFieldNames(savedContentPages);

      const removedFieldNames = [...savedFieldNames].filter((fieldName) => !currentFieldNames.has(fieldName));
      if (removedFieldNames.length) {
        await Promise.all(removedFieldNames.map((fieldName) => removeCourseAssetMappings(courseId, fieldName)));
      }

      const upserts: Array<Promise<void>> = [];
      for (const fieldName of currentFieldNames) {
        const normalizedLink = `course/assets/${fieldName}`;
        const assetId =
          assetLinkIdMap[normalizedLink] ||
          assetLinkIdMap[`/${normalizedLink}`] ||
          courseAssetMappings[fieldName];
        if (!assetId) continue;

        upserts.push(
          removeCourseAssetMappings(courseId, fieldName).then(() =>
            createCourseAssetMapping(courseId, fieldName, assetId)
          )
        );
      }
      if (upserts.length) {
        await Promise.all(upserts);
      }

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
            _htmlClasses: page.htmlClasses,
            requirecompletionof: page.requireCompletionOf,
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
            topicPatch.displayTitle = "";
          }

          await updateStructureNode("topic", id, topicPatch, { syncTitleDisplayTitle: false });
          continue;
        }

        if (level === "section") {
          const article = findArticle(id);
          if (!article) continue;
          const sectionPatch: Record<string, unknown> = {
            title: article.title,
            displayTitle: article.showDisplayTitleInPreview ? article.title : "",
            body: article.description,
            description: article.description,
            instruction: article.instruction,
            themeSettings: article.themeSettings ?? {},
            _isOptional: article.isOptional,
            _isAvailable: article.isAvailable,
            _isHidden: article.isHidden,
            _isVisible: article.isVisible,
            _requireCompletionOf: isNaN(Number(article.requireCompletionOf)) ? -1 : Number(article.requireCompletionOf),
            _classes: article.classes,
            _onScreen: {
              _isEnabled: !!article.onScreen?._isEnabled,
              _classes: article.onScreen?._classes || "",
              _percentInviewVertical:
                typeof article.onScreen?._percentInviewVertical === "number"
                  ? article.onScreen._percentInviewVertical
                  : 50,
            },
            _ariaLevel: isNaN(Number(article.ariaLevel)) ? 0 : Number(article.ariaLevel),
            _extensions: article.extensions ?? {},
          };
          await updateStructureNode("section", id, sectionPatch);
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
            themeSettings: block.themeSettings ?? {},
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
            themeSettings: component.themeSettings ?? {},
            properties: {
              ...existingProperties,
              instruction: instructionValue,
              ...(subtitleValue !== undefined ? { subtitle: subtitleValue } : {}),
            },
          });
        }
      }

      const refreshedMappings = await getCourseAssetMappings(courseId);
      const refreshedAssetLinkMap: Record<string, string> = {};
      Object.entries(refreshedMappings || {}).forEach(([fieldName, assetId]) => {
        addAssetLinkMapping(refreshedAssetLinkMap, fieldName, assetId);
      });

      setCourseAssetMappings(refreshedMappings);
      setAssetLinkIdMap((prev) => ({ ...prev, ...refreshedAssetLinkMap }));

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
              <aside ref={rightPanelScrollRef} className="fixed md:relative inset-y-0 right-0 z-40 md:z-auto h-full w-[300px] bg-white border-l border-[#d8dee6] overflow-y-auto overflow-x-hidden shrink-0">
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
                      const themeSettings = getActiveThemeSettings(page.themeSettings);
                      const pageBackgroundImage = asRecord(themeSettings._backgroundImage);
                      const pageBackgroundStyles = asRecord(themeSettings._backgroundStyles);
                      const responsiveClasses = asRecord(themeSettings._responsiveClasses);
                      const pageHeader = asRecord(themeSettings._pageHeader);
                      const pageHeaderGraphic = asRecord(pageHeader._graphic);
                      const pageHeaderTextAlignment = asRecord(pageHeader._textAlignment);
                      const pageHeaderBackgroundImage = asRecord(pageHeader._backgroundImage);
                      const pageHeaderBackgroundStyles = asRecord(pageHeader._backgroundStyles);
                      const pageHeaderMinimumHeights = asRecord(pageHeader._minimumHeights);

                      const menuSettings = getActiveMenuSettings(page.menuSettings);
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
                        <div className="px-4 py-4 border-b border-[#e6ebf0] space-y-2">
                          <TopicAccordion title="General" open={!!openTopicAccordions.general} onToggle={(triggerEl) => toggleTopicAccordion("general", triggerEl)}>
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
                            <TopicTextInput label="Title" value={page.title} onChange={(value) => updatePageData(page.id, { title: value })} />
                            <TopicCheckbox
                              label="Display title in preview"
                              checked={!!page.showDisplayTitleInPreview}
                              onChange={(checked) => updatePageData(page.id, { showDisplayTitleInPreview: checked })}
                            />
                          </TopicAccordion>

                          <TopicAccordion title="Availability & Progression" open={!!openTopicAccordions.availability} onToggle={(triggerEl) => toggleTopicAccordion("availability", triggerEl)}>
                            <TopicCheckbox label="Is this optional?" checked={!!page.isOptional} onChange={(checked) => updatePageData(page.id, { isOptional: checked })} />
                            <TopicCheckbox label="Is this available?" checked={!!page.isAvailable} onChange={(checked) => updatePageData(page.id, { isAvailable: checked })} />
                            <TopicCheckbox label="Is this hidden?" checked={!!page.isHidden} onChange={(checked) => updatePageData(page.id, { isHidden: checked })} />
                            <TopicCheckbox label="Is this visible?" checked={!!page.isVisible} onChange={(checked) => updatePageData(page.id, { isVisible: checked })} />
                            <TopicTextInput label="Duration" value={page.duration} onChange={(value) => updatePageData(page.id, { duration: value })} />
                            <TopicTextInput label="Button link text" value={page.linkText} onChange={(value) => updatePageData(page.id, { linkText: value })} />
                            <TopicSelect label="Menu lock type" value={page.lockType} onChange={(value) => updatePageData(page.id, { lockType: value })} options={LOCK_TYPE_OPTIONS} emptyOptionLabel="" />
                            <TopicTextInput label="Require completion of" value={page.requireCompletionOf} onChange={(value) => updatePageData(page.id, { requireCompletionOf: value })} />
                            <TopicTextInput
                              label="Locked by"
                              value={page.lockedBy.join(", ")}
                              onChange={(value) => updatePageData(page.id, {
                                lockedBy: value.split(",").map((item) => item.trim()).filter(Boolean),
                              })}
                            />
                          </TopicAccordion>

                          <TopicAccordion title="Accessibility" open={!!openTopicAccordions.accessibility} onToggle={(triggerEl) => toggleTopicAccordion("accessibility", triggerEl)}>
                            <TopicTextInput label="ARIA level" value={page.ariaLevel} onChange={(value) => updatePageData(page.id, { ariaLevel: value })} />
                          </TopicAccordion>

                          <TopicAccordion title="Extensions" open={!!openTopicAccordions.extensions} onToggle={(triggerEl) => toggleTopicAccordion("extensions", triggerEl)}>
                            {(() => {
                              const extensionKeySet = new Set<string>();
                              contentPages.forEach((contentPage) => {
                                Object.keys(asRecord(contentPage.extensions)).forEach((key) => {
                                  if (key.trim()) extensionKeySet.add(key);
                                });
                              });
                              const extensionKeys = Array.from(extensionKeySet).sort((a, b) => a.localeCompare(b));

                              if (!extensionKeys.length) {
                                return <p className="text-[13px] text-[var(--life-neutral-300)]">No extensions are currently configured in this course.</p>;
                              }

                              return (
                                <div className="flex flex-col gap-2.5">
                                  {extensionKeys.map((extensionKey) => {
                                    const extensionConfig = asRecord(page.extensions)[extensionKey];
                                    const extensionJson = JSON.stringify(extensionConfig ?? {}, null, 2);

                                    return (
                                      <TopicNestedAccordion key={`${page.id}-extension-${extensionKey}`} title={extensionKey}>
                                        <div className="flex flex-col gap-1.5">
                                          <TopicFieldLabel>Page-level settings</TopicFieldLabel>
                                          <textarea
                                            key={`${page.id}-extension-json-${extensionKey}`}
                                            defaultValue={extensionJson}
                                            onBlur={(event) => {
                                              try {
                                                const rawInput = event.target.value.trim();
                                                const parsed = JSON.parse(rawInput || "{}");
                                                updatePageData(page.id, {
                                                  extensions: {
                                                    ...asRecord(page.extensions),
                                                    [extensionKey]: parsed,
                                                  },
                                                });
                                              } catch {
                                                // Keep current value when invalid JSON is entered.
                                              }
                                            }}
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors resize-y min-h-[120px] font-mono"
                                          />
                                        </div>
                                      </TopicNestedAccordion>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </TopicAccordion>

                          <TopicAccordion title="Theme settings" open={!!openTopicAccordions.theme} onToggle={(triggerEl) => toggleTopicAccordion("theme", triggerEl)}>
                            <TopicNestedAccordion title="Page background image">
                              <div className="flex flex-col gap-1.5">
                                <TopicAssetField
                                  resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl}
                                  label="_xlarge"
                                  compact
                                  value={asString(pageBackgroundImage._xlarge)}
                                  onPickAsset={() => setTopicAssetPickerTarget({ scope: "themePageBackground", bp: "_xlarge" })}
                                  onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "themePageBackground", bp: "_xlarge" }, initialValue: asString(pageBackgroundImage._xlarge), title: "Page background image (_xlarge)" })}
                                  onClear={() => clearTopicAssetSelection(page.id, { scope: "themePageBackground", bp: "_xlarge" })}
                                />
                                <TopicAssetField
                                  resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl}
                                  label="_large"
                                  compact
                                  value={asString(pageBackgroundImage._large)}
                                  onPickAsset={() => setTopicAssetPickerTarget({ scope: "themePageBackground", bp: "_large" })}
                                  onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "themePageBackground", bp: "_large" }, initialValue: asString(pageBackgroundImage._large), title: "Page background image (_large)" })}
                                  onClear={() => clearTopicAssetSelection(page.id, { scope: "themePageBackground", bp: "_large" })}
                                />
                                <TopicAssetField
                                  resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl}
                                  label="_medium"
                                  compact
                                  value={asString(pageBackgroundImage._medium)}
                                  onPickAsset={() => setTopicAssetPickerTarget({ scope: "themePageBackground", bp: "_medium" })}
                                  onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "themePageBackground", bp: "_medium" }, initialValue: asString(pageBackgroundImage._medium), title: "Page background image (_medium)" })}
                                  onClear={() => clearTopicAssetSelection(page.id, { scope: "themePageBackground", bp: "_medium" })}
                                />
                                <TopicAssetField
                                  resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl}
                                  label="_small"
                                  compact
                                  value={asString(pageBackgroundImage._small)}
                                  onPickAsset={() => setTopicAssetPickerTarget({ scope: "themePageBackground", bp: "_small" })}
                                  onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "themePageBackground", bp: "_small" }, initialValue: asString(pageBackgroundImage._small), title: "Page background image (_small)" })}
                                  onClear={() => clearTopicAssetSelection(page.id, { scope: "themePageBackground", bp: "_small" })}
                                />
                              </div>
                            </TopicNestedAccordion>
                            <TopicNestedAccordion title="Page background image styles">
                              <TopicSelect label={BG_REPEAT_LABEL} value={asString(pageBackgroundStyles._backgroundRepeat)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundRepeat: value } }))} options={BG_REPEAT_OPTIONS} emptyOptionLabel="" />
                              <TopicSelect label={BG_SIZE_LABEL} value={asString(pageBackgroundStyles._backgroundSize)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundSize: value } }))} options={BG_SIZE_OPTIONS} emptyOptionLabel="" />
                              <TopicSelect label={BG_POSITION_LABEL} value={asString(pageBackgroundStyles._backgroundPosition)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundPosition: value } }))} options={BG_POSITION_OPTIONS} emptyOptionLabel="" />
                            </TopicNestedAccordion>

                            <TopicNestedAccordion title="Header image">
                              <TopicAssetField
                                resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl}
                                label="Header image"
                                compact
                                showLabel={false}
                                value={asString(pageHeaderGraphic._src)}
                                onPickAsset={() => setTopicAssetPickerTarget({ scope: "themeHeaderGraphic" })}
                                onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "themeHeaderGraphic" }, initialValue: asString(pageHeaderGraphic._src), title: "Header image" })}
                                onClear={() => clearTopicAssetSelection(page.id, { scope: "themeHeaderGraphic" })}
                              />
                              <TopicTextInput label="Alternative text" value={asString(pageHeaderGraphic.alt)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _graphic: { ...asRecord(asRecord(current._pageHeader)._graphic), alt: value } } }))} />
                            </TopicNestedAccordion>

                            <TopicNestedAccordion title="Text alignment">
                              <TopicSelect label="Title alignment" value={asString(pageHeaderTextAlignment._title)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _textAlignment: { ...asRecord(asRecord(current._pageHeader)._textAlignment), _title: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                              <TopicSelect label="Body alignment" value={asString(pageHeaderTextAlignment._body)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _textAlignment: { ...asRecord(asRecord(current._pageHeader)._textAlignment), _body: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                              <TopicSelect label="Instruction alignment" value={asString(pageHeaderTextAlignment._instruction)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _textAlignment: { ...asRecord(asRecord(current._pageHeader)._textAlignment), _instruction: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                            </TopicNestedAccordion>

                            <TopicNestedAccordion title="Page header background image">
                              <div className="flex flex-col gap-1.5">
                                <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_xlarge" compact value={asString(pageHeaderBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "themeHeaderBackground", bp: "_xlarge" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "themeHeaderBackground", bp: "_xlarge" }, initialValue: asString(pageHeaderBackgroundImage._xlarge), title: "Header background image (_xlarge)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "themeHeaderBackground", bp: "_xlarge" })} />
                                <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_large" compact value={asString(pageHeaderBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "themeHeaderBackground", bp: "_large" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "themeHeaderBackground", bp: "_large" }, initialValue: asString(pageHeaderBackgroundImage._large), title: "Header background image (_large)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "themeHeaderBackground", bp: "_large" })} />
                                <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_medium" compact value={asString(pageHeaderBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "themeHeaderBackground", bp: "_medium" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "themeHeaderBackground", bp: "_medium" }, initialValue: asString(pageHeaderBackgroundImage._medium), title: "Header background image (_medium)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "themeHeaderBackground", bp: "_medium" })} />
                                <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_small" compact value={asString(pageHeaderBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "themeHeaderBackground", bp: "_small" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "themeHeaderBackground", bp: "_small" }, initialValue: asString(pageHeaderBackgroundImage._small), title: "Header background image (_small)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "themeHeaderBackground", bp: "_small" })} />
                              </div>
                            </TopicNestedAccordion>
                            <TopicNestedAccordion title="Page header background image styles">
                              <TopicSelect label={BG_REPEAT_LABEL} value={asString(pageHeaderBackgroundStyles._backgroundRepeat)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _backgroundStyles: { ...asRecord(asRecord(current._pageHeader)._backgroundStyles), _backgroundRepeat: value } } }))} options={BG_REPEAT_OPTIONS} emptyOptionLabel="" />
                              <TopicSelect label={BG_SIZE_LABEL} value={asString(pageHeaderBackgroundStyles._backgroundSize)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _backgroundStyles: { ...asRecord(asRecord(current._pageHeader)._backgroundStyles), _backgroundSize: value } } }))} options={BG_SIZE_OPTIONS} emptyOptionLabel="" />
                              <TopicSelect label={BG_POSITION_LABEL} value={asString(pageHeaderBackgroundStyles._backgroundPosition)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _backgroundStyles: { ...asRecord(asRecord(current._pageHeader)._backgroundStyles), _backgroundPosition: value } } }))} options={BG_POSITION_OPTIONS} emptyOptionLabel="" />
                            </TopicNestedAccordion>
                            <TopicNestedAccordion title="Page header minimum height">
                              <TopicTextInput label="_xlarge" type="number" value={String(asNumberOrEmpty(pageHeaderMinimumHeights._xlarge))} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _minimumHeights: { ...asRecord(asRecord(current._pageHeader)._minimumHeights), _xlarge: parseNumberishInput(value) } } }))} />
                              <TopicTextInput label="_large" type="number" value={String(asNumberOrEmpty(pageHeaderMinimumHeights._large))} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _minimumHeights: { ...asRecord(asRecord(current._pageHeader)._minimumHeights), _large: parseNumberishInput(value) } } }))} />
                              <TopicTextInput label="_medium" type="number" value={String(asNumberOrEmpty(pageHeaderMinimumHeights._medium))} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _minimumHeights: { ...asRecord(asRecord(current._pageHeader)._minimumHeights), _medium: parseNumberishInput(value) } } }))} />
                              <TopicTextInput label="_small" type="number" value={String(asNumberOrEmpty(pageHeaderMinimumHeights._small))} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _pageHeader: { ...asRecord(current._pageHeader), _minimumHeights: { ...asRecord(asRecord(current._pageHeader)._minimumHeights), _small: parseNumberishInput(value) } } }))} />
                            </TopicNestedAccordion>
                            <TopicNestedAccordion title="On-screen classes">
                              <TopicCheckbox
                                label="Enabled?"
                                checked={asBoolean(page.onScreen?._isEnabled)}
                                onChange={(checked) => updatePageData(page.id, {
                                  onScreen: {
                                    ...(page.onScreen ?? {}),
                                    _isEnabled: checked,
                                  },
                                })}
                              />
                              <TopicSelect
                                label="Classes"
                                value={asString(page.onScreen?._classes)}
                                onChange={(value) => updatePageData(page.id, {
                                  onScreen: {
                                    ...(page.onScreen ?? {}),
                                    _classes: value,
                                  },
                                })}
                                options={ONSCREEN_CLASS_OPTIONS}
                                emptyOptionLabel=""
                              />
                              <TopicTextInput
                                label="Percent in view"
                                type="number"
                                value={String(asNumberOrEmpty(page.onScreen?._percentInviewVertical))}
                                onChange={(value) => updatePageData(page.id, {
                                  onScreen: {
                                    ...(page.onScreen ?? {}),
                                    _percentInviewVertical: parseNumberishInput(value),
                                  },
                                })}
                              />
                            </TopicNestedAccordion>
                          </TopicAccordion>

                          <TopicAccordion title="Menu Appearance" open={!!openTopicAccordions.menu} onToggle={(triggerEl) => toggleTopicAccordion("menu", triggerEl)}>
                            <TopicAssetField
                              resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl}
                              label="Menu graphic"
                              compact
                              value={asString(menuGraphic._src)}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuGraphic" })}
                              onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "menuGraphic" }, initialValue: asString(menuGraphic._src), title: "Menu graphic" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "menuGraphic" })}
                            />
                            <TopicTextInput label="Alternative text" value={asString(menuGraphic.alt)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _graphic: { ...asRecord(current._graphic), alt: value } }))} />
                            <TopicCheckbox label="Skip submenu view" checked={asBoolean(menuSettings._skipSubmenuView)} onChange={(checked) => updatePageMenuSettings(page.id, (current) => ({ ...current, _skipSubmenuView: checked }))} />
                            <TopicTextInput label="Locked notification text" value={asString(menuSettings.lockedNotification)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, lockedNotification: value }))} />

                            <div className="flex flex-col gap-1.5">
                              <div className="text-[13px] font-semibold text-[var(--life-base-black)]">Menu background image</div>
                              <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_xlarge" compact value={asString(menuBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuBackground", bp: "_xlarge" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "menuBackground", bp: "_xlarge" }, initialValue: asString(menuBackgroundImage._xlarge), title: "Menu background image (_xlarge)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuBackground", bp: "_xlarge" })} />
                              <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_large" compact value={asString(menuBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuBackground", bp: "_large" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "menuBackground", bp: "_large" }, initialValue: asString(menuBackgroundImage._large), title: "Menu background image (_large)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuBackground", bp: "_large" })} />
                              <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_medium" compact value={asString(menuBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuBackground", bp: "_medium" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "menuBackground", bp: "_medium" }, initialValue: asString(menuBackgroundImage._medium), title: "Menu background image (_medium)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuBackground", bp: "_medium" })} />
                              <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_small" compact value={asString(menuBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuBackground", bp: "_small" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "menuBackground", bp: "_small" }, initialValue: asString(menuBackgroundImage._small), title: "Menu background image (_small)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuBackground", bp: "_small" })} />
                            </div>
                            <TopicNestedAccordion title="Menu background image styles">
                              <TopicSelect label={BG_REPEAT_LABEL} value={asString(menuBackgroundStyles._backgroundRepeat)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundRepeat: value } }))} options={BG_REPEAT_OPTIONS} emptyOptionLabel="" />
                              <TopicSelect label={BG_SIZE_LABEL} value={asString(menuBackgroundStyles._backgroundSize)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundSize: value } }))} options={BG_SIZE_OPTIONS} emptyOptionLabel="" />
                              <TopicSelect label={BG_POSITION_LABEL} value={asString(menuBackgroundStyles._backgroundPosition)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundPosition: value } }))} options={BG_POSITION_OPTIONS} emptyOptionLabel="" />
                            </TopicNestedAccordion>

                            <TopicCheckbox label="Display image above menu header" checked={asBoolean(menuHeader._displayAboveHeader)} onChange={(checked) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _displayAboveHeader: checked } }))} />
                            <TopicSelect label="Title alignment" value={asString(menuHeaderTextAlignment._title)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _textAlignment: { ...asRecord(asRecord(current._menuHeader)._textAlignment), _title: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                            {showMenuSubtitleAlignment ? <TopicSelect label="Subtitle alignment" value={asString(menuHeaderTextAlignment._subtitle)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _textAlignment: { ...asRecord(asRecord(current._menuHeader)._textAlignment), _subtitle: value } } }))} options={TEXT_ALIGN_OPTIONS} /> : null}
                            <TopicSelect label="Body alignment" value={asString(menuHeaderTextAlignment._body)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _textAlignment: { ...asRecord(asRecord(current._menuHeader)._textAlignment), _body: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                            <TopicSelect label="Instruction alignment" value={asString(menuHeaderTextAlignment._instruction)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _textAlignment: { ...asRecord(asRecord(current._menuHeader)._textAlignment), _instruction: value } } }))} options={TEXT_ALIGN_OPTIONS} />

                            <div className="flex flex-col gap-1.5">
                              <div className="text-[13px] font-semibold text-[var(--life-base-black)]">Menu header background image</div>
                              <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_xlarge" compact value={asString(menuHeaderBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuHeaderBackground", bp: "_xlarge" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "menuHeaderBackground", bp: "_xlarge" }, initialValue: asString(menuHeaderBackgroundImage._xlarge), title: "Menu header background image (_xlarge)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuHeaderBackground", bp: "_xlarge" })} />
                              <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_large" compact value={asString(menuHeaderBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuHeaderBackground", bp: "_large" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "menuHeaderBackground", bp: "_large" }, initialValue: asString(menuHeaderBackgroundImage._large), title: "Menu header background image (_large)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuHeaderBackground", bp: "_large" })} />
                              <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_medium" compact value={asString(menuHeaderBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuHeaderBackground", bp: "_medium" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "menuHeaderBackground", bp: "_medium" }, initialValue: asString(menuHeaderBackgroundImage._medium), title: "Menu header background image (_medium)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuHeaderBackground", bp: "_medium" })} />
                              <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_small" compact value={asString(menuHeaderBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "menuHeaderBackground", bp: "_small" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "menuHeaderBackground", bp: "_small" }, initialValue: asString(menuHeaderBackgroundImage._small), title: "Menu header background image (_small)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "menuHeaderBackground", bp: "_small" })} />
                            </div>
                            <TopicNestedAccordion title="Menu header background image styles">
                              <TopicSelect label={BG_REPEAT_LABEL} value={asString(menuHeaderBackgroundStyles._backgroundRepeat)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _backgroundStyles: { ...asRecord(asRecord(current._menuHeader)._backgroundStyles), _backgroundRepeat: value } } }))} options={BG_REPEAT_OPTIONS} emptyOptionLabel="" />
                              <TopicSelect label={BG_SIZE_LABEL} value={asString(menuHeaderBackgroundStyles._backgroundSize)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _backgroundStyles: { ...asRecord(asRecord(current._menuHeader)._backgroundStyles), _backgroundSize: value } } }))} options={BG_SIZE_OPTIONS} emptyOptionLabel="" />
                              <TopicSelect label={BG_POSITION_LABEL} value={asString(menuHeaderBackgroundStyles._backgroundPosition)} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _backgroundStyles: { ...asRecord(asRecord(current._menuHeader)._backgroundStyles), _backgroundPosition: value } } }))} options={BG_POSITION_OPTIONS} emptyOptionLabel="" />
                            </TopicNestedAccordion>

                            <TopicNestedAccordion title="Menu header minimum height">
                              <TopicTextInput label="_xlarge" type="number" value={String(asNumberOrEmpty(menuHeaderMinimumHeights._xlarge))} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _minimumHeights: { ...asRecord(asRecord(current._menuHeader)._minimumHeights), _xlarge: parseNumberishInput(value) } } }))} />
                              <TopicTextInput label="_large" type="number" value={String(asNumberOrEmpty(menuHeaderMinimumHeights._large))} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _minimumHeights: { ...asRecord(asRecord(current._menuHeader)._minimumHeights), _large: parseNumberishInput(value) } } }))} />
                              <TopicTextInput label="_medium" type="number" value={String(asNumberOrEmpty(menuHeaderMinimumHeights._medium))} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _minimumHeights: { ...asRecord(asRecord(current._menuHeader)._minimumHeights), _medium: parseNumberishInput(value) } } }))} />
                              <TopicTextInput label="_small" type="number" value={String(asNumberOrEmpty(menuHeaderMinimumHeights._small))} onChange={(value) => updatePageMenuSettings(page.id, (current) => ({ ...current, _menuHeader: { ...asRecord(current._menuHeader), _minimumHeights: { ...asRecord(asRecord(current._menuHeader)._minimumHeights), _small: parseNumberishInput(value) } } }))} />
                            </TopicNestedAccordion>
                          </TopicAccordion>

                          <TopicAccordion title="Media" open={!!openTopicAccordions.media} onToggle={(triggerEl) => toggleTopicAccordion("media", triggerEl)}>
                            <TopicAssetField
                              resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl}
                              label="Graphic"
                              compact
                              value={page.graphic?.src || ""}
                              onPickAsset={() => setTopicAssetPickerTarget({ scope: "pageGraphic" })}
                              onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "pageGraphic" }, initialValue: page.graphic?.src || "", title: "Graphic" })}
                              onClear={() => clearTopicAssetSelection(page.id, { scope: "pageGraphic" })}
                            />
                            <TopicTextInput label="Alternative text" value={page.graphic?.alt || ""} onChange={(value) => updatePageGraphic(page.id, (current) => ({ ...current, alt: value }))} />
                          </TopicAccordion>

                          <TopicAccordion title="Advanced Settings" open={!!openTopicAccordions.advanced} onToggle={(triggerEl) => toggleTopicAccordion("advanced", triggerEl)}>
                            <TopicTextInput label="Page classes" value={page.classes} onChange={(value) => updatePageData(page.id, { classes: value })} />
                            <TopicTextInput label="HTML classes" value={page.htmlClasses} onChange={(value) => updatePageData(page.id, { htmlClasses: value })} />
                            <TopicNestedAccordion title="Responsive classes">
                              <TopicTextInput label="_xlarge" value={asString(responsiveClasses._xlarge)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _xlarge: value } }))} />
                              <TopicTextInput label="_large" value={asString(responsiveClasses._large)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _large: value } }))} />
                              <TopicTextInput label="_medium" value={asString(responsiveClasses._medium)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _medium: value } }))} />
                              <TopicTextInput label="_small" value={asString(responsiveClasses._small)} onChange={(value) => updatePageThemeSettings(page.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _small: value } }))} />
                            </TopicNestedAccordion>
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
                      <div className="px-4 py-4 border-b border-[#e6ebf0] space-y-2">
                        {(() => {
                          const articleThemeSettings = getActiveThemeSettings(article.themeSettings);
                          const articleBackgroundImage = asRecord(articleThemeSettings._backgroundImage);
                          const articleBackgroundStyles = asRecord(articleThemeSettings._backgroundStyles);
                          const articleHeader = asRecord(articleThemeSettings._articleHeader);
                          const articleHeaderTextAlignment = asRecord(articleHeader._textAlignment);
                          const articleHeaderBackgroundImage = asRecord(articleHeader._backgroundImage);
                          const articleHeaderBackgroundStyles = asRecord(articleHeader._backgroundStyles);
                          const articleHeaderMinimumHeights = asRecord(articleHeader._minimumHeights);
                          const articleResponsiveClasses = asRecord(articleThemeSettings._responsiveClasses);
                          const isCopied = copiedSectionId === article.id;

                          return (
                            <>
                              <TopicAccordion title="General" open={!!openSectionAccordions.general} onToggle={(triggerEl) => toggleSectionAccordion("general", triggerEl)}>
                                <div className="flex flex-col gap-1.5">
                                  <TopicFieldLabel>SECTION ID</TopicFieldLabel>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      aria-label="Copy section id"
                                      title="Copy section id"
                                      onClick={() => handleCopySectionId(article.id)}
                                      className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer ${isCopied ? "bg-[var(--life-positive-050)] border-[var(--life-positive-500)] text-[var(--life-positive-500)]" : "bg-white border-[var(--life-neutral-300)] text-[var(--life-base-black)] hover:bg-[#f8fafc] hover:border-[var(--life-primary-500)] hover:text-[var(--life-primary-500)]"}`}
                                    >
                                      <span className="truncate text-left">{article.id}</span>
                                      {isCopied ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                                      ) : (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                      )}
                                    </button>
                                    {isCopied && (
                                      <div className="absolute -top-8 right-0 px-2.5 py-1 rounded-[8px] border border-[var(--life-positive-500)] bg-[var(--life-positive-050)] text-[11px] font-semibold text-[var(--life-positive-500)] shadow-sm whitespace-nowrap">
                                        Id copied to clipboard.
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-[#6b7280]">Unique identifier for this section. Click to copy.</p>
                                </div>
                                <TopicTextInput label="Title" value={article.title} onChange={(value) => updateArticle(page!.id, article.id, { title: value })} />
                                <TopicCheckbox
                                  label="Display title in preview"
                                  checked={!!article.showDisplayTitleInPreview}
                                  onChange={(checked) => updateArticle(page!.id, article.id, { showDisplayTitleInPreview: checked })}
                                />
                              </TopicAccordion>

                              <TopicAccordion title="Availability & Progression" open={!!openSectionAccordions.availability} onToggle={(triggerEl) => toggleSectionAccordion("availability", triggerEl)}>
                                <TopicCheckbox label="Is this optional?" checked={!!article.isOptional} onChange={(checked) => updateArticle(page!.id, article.id, { isOptional: checked })} />
                                <TopicCheckbox label="Is this available?" checked={!!article.isAvailable} onChange={(checked) => updateArticle(page!.id, article.id, { isAvailable: checked })} />
                                <TopicCheckbox label="Is this hidden?" checked={!!article.isHidden} onChange={(checked) => updateArticle(page!.id, article.id, { isHidden: checked })} />
                                <TopicCheckbox label="Is this visible?" checked={!!article.isVisible} onChange={(checked) => updateArticle(page!.id, article.id, { isVisible: checked })} />
                                <TopicTextInput label="Require completion of" value={article.requireCompletionOf} onChange={(value) => updateArticle(page!.id, article.id, { requireCompletionOf: value })} />
                              </TopicAccordion>

                              <TopicAccordion title="Accessibility" open={!!openSectionAccordions.accessibility} onToggle={(triggerEl) => toggleSectionAccordion("accessibility", triggerEl)}>
                                <TopicTextInput label="ARIA level" value={article.ariaLevel} onChange={(value) => updateArticle(page!.id, article.id, { ariaLevel: value })} />
                              </TopicAccordion>

                              <TopicAccordion title="Extensions" open={!!openSectionAccordions.extensions} onToggle={(triggerEl) => toggleSectionAccordion("extensions", triggerEl)}>
                                {(() => {
                                  const extensionKeySet = new Set<string>();
                                  contentPages.forEach((contentPage) => {
                                    contentPage.articles.forEach((art) => {
                                      Object.keys(asRecord(art.extensions)).forEach((key) => {
                                        if (key.trim()) extensionKeySet.add(key);
                                      });
                                    });
                                  });
                                  const extensionKeys = Array.from(extensionKeySet).sort((a, b) => a.localeCompare(b));
                                  if (!extensionKeys.length) {
                                    return <p className="text-[13px] text-[var(--life-neutral-300)]">No extensions are currently configured in this course.</p>;
                                  }
                                  return (
                                    <div className="flex flex-col gap-2.5">
                                      {extensionKeys.map((extensionKey) => {
                                        const extensionConfig = asRecord(article.extensions)[extensionKey];
                                        const extensionJson = JSON.stringify(extensionConfig ?? {}, null, 2);
                                        return (
                                          <TopicNestedAccordion key={`${article.id}-extension-${extensionKey}`} title={extensionKey}>
                                            <div className="flex flex-col gap-1.5">
                                              <TopicFieldLabel>Section-level settings</TopicFieldLabel>
                                              <textarea
                                                key={`${article.id}-extension-json-${extensionKey}`}
                                                defaultValue={extensionJson}
                                                onBlur={(event) => {
                                                  try {
                                                    const rawInput = event.target.value.trim();
                                                    const parsed = JSON.parse(rawInput || "{}");
                                                    updateArticle(page!.id, article.id, {
                                                      extensions: { ...asRecord(article.extensions), [extensionKey]: parsed },
                                                    });
                                                  } catch {
                                                    // Keep current value on invalid JSON.
                                                  }
                                                }}
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors resize-y min-h-[120px] font-mono"
                                              />
                                            </div>
                                          </TopicNestedAccordion>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </TopicAccordion>

                              <TopicAccordion title="Theme settings" open={!!openSectionAccordions.theme} onToggle={(triggerEl) => toggleSectionAccordion("theme", triggerEl)}>
                                <TopicNestedAccordion title="Text alignment">
                                  <TopicSelect label="Title alignment" value={asString(articleHeaderTextAlignment._title)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _textAlignment: { ...asRecord(asRecord(current._articleHeader)._textAlignment), _title: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                                  <TopicSelect label="Body alignment" value={asString(articleHeaderTextAlignment._body)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _textAlignment: { ...asRecord(asRecord(current._articleHeader)._textAlignment), _body: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                                  <TopicSelect label="Instruction alignment" value={asString(articleHeaderTextAlignment._instruction)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _textAlignment: { ...asRecord(asRecord(current._articleHeader)._textAlignment), _instruction: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                                </TopicNestedAccordion>
                                <TopicNestedAccordion title="Article background image">
                                  <div className="flex flex-col gap-1.5">
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_xlarge" compact value={asString(articleBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "sectionBackground", articleId: article.id, bp: "_xlarge" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "sectionBackground", articleId: article.id, bp: "_xlarge" }, initialValue: asString(articleBackgroundImage._xlarge), title: "Article background image (_xlarge)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "sectionBackground", articleId: article.id, bp: "_xlarge" })} />
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_large" compact value={asString(articleBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "sectionBackground", articleId: article.id, bp: "_large" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "sectionBackground", articleId: article.id, bp: "_large" }, initialValue: asString(articleBackgroundImage._large), title: "Article background image (_large)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "sectionBackground", articleId: article.id, bp: "_large" })} />
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_medium" compact value={asString(articleBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "sectionBackground", articleId: article.id, bp: "_medium" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "sectionBackground", articleId: article.id, bp: "_medium" }, initialValue: asString(articleBackgroundImage._medium), title: "Article background image (_medium)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "sectionBackground", articleId: article.id, bp: "_medium" })} />
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_small" compact value={asString(articleBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "sectionBackground", articleId: article.id, bp: "_small" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "sectionBackground", articleId: article.id, bp: "_small" }, initialValue: asString(articleBackgroundImage._small), title: "Article background image (_small)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "sectionBackground", articleId: article.id, bp: "_small" })} />
                                  </div>
                                </TopicNestedAccordion>
                                <TopicNestedAccordion title="Article background image styles">
                                  <TopicSelect label={BG_REPEAT_LABEL} value={asString(articleBackgroundStyles._backgroundRepeat)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundRepeat: value } }))} options={BG_REPEAT_OPTIONS} emptyOptionLabel="" />
                                  <TopicSelect label={BG_SIZE_LABEL} value={asString(articleBackgroundStyles._backgroundSize)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundSize: value } }))} options={BG_SIZE_OPTIONS} emptyOptionLabel="" />
                                  <TopicSelect label={BG_POSITION_LABEL} value={asString(articleBackgroundStyles._backgroundPosition)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundPosition: value } }))} options={BG_POSITION_OPTIONS} emptyOptionLabel="" />
                                </TopicNestedAccordion>
                                <TopicNestedAccordion title="Article header">
                                  <TopicNestedAccordion title="Text alignment">
                                    <TopicSelect label="Title alignment" value={asString(articleHeaderTextAlignment._title)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _textAlignment: { ...asRecord(asRecord(current._articleHeader)._textAlignment), _title: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                                    <TopicSelect label="Body alignment" value={asString(articleHeaderTextAlignment._body)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _textAlignment: { ...asRecord(asRecord(current._articleHeader)._textAlignment), _body: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                                    <TopicSelect label="Instruction alignment" value={asString(articleHeaderTextAlignment._instruction)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _textAlignment: { ...asRecord(asRecord(current._articleHeader)._textAlignment), _instruction: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                                  </TopicNestedAccordion>
                                  <TopicNestedAccordion title="Article header background image">
                                    <div className="flex flex-col gap-1.5">
                                      <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_xlarge" compact value={asString(articleHeaderBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_xlarge" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_xlarge" }, initialValue: asString(articleHeaderBackgroundImage._xlarge), title: "Article header background image (_xlarge)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_xlarge" })} />
                                      <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_large" compact value={asString(articleHeaderBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_large" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_large" }, initialValue: asString(articleHeaderBackgroundImage._large), title: "Article header background image (_large)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_large" })} />
                                      <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_medium" compact value={asString(articleHeaderBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_medium" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_medium" }, initialValue: asString(articleHeaderBackgroundImage._medium), title: "Article header background image (_medium)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_medium" })} />
                                      <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_small" compact value={asString(articleHeaderBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_small" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_small" }, initialValue: asString(articleHeaderBackgroundImage._small), title: "Article header background image (_small)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "sectionArticleHeaderBackground", articleId: article.id, bp: "_small" })} />
                                    </div>
                                  </TopicNestedAccordion>
                                  <TopicNestedAccordion title="Article header background image styles">
                                    <TopicSelect label={BG_REPEAT_LABEL} value={asString(articleHeaderBackgroundStyles._backgroundRepeat)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _backgroundStyles: { ...asRecord(asRecord(current._articleHeader)._backgroundStyles), _backgroundRepeat: value } } }))} options={BG_REPEAT_OPTIONS} emptyOptionLabel="" />
                                    <TopicSelect label={BG_SIZE_LABEL} value={asString(articleHeaderBackgroundStyles._backgroundSize)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _backgroundStyles: { ...asRecord(asRecord(current._articleHeader)._backgroundStyles), _backgroundSize: value } } }))} options={BG_SIZE_OPTIONS} emptyOptionLabel="" />
                                    <TopicSelect label={BG_POSITION_LABEL} value={asString(articleHeaderBackgroundStyles._backgroundPosition)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _backgroundStyles: { ...asRecord(asRecord(current._articleHeader)._backgroundStyles), _backgroundPosition: value } } }))} options={BG_POSITION_OPTIONS} emptyOptionLabel="" />
                                  </TopicNestedAccordion>
                                  <TopicNestedAccordion title="Article header minimum height">
                                    <TopicTextInput label="_xlarge" type="number" value={String(asNumberOrEmpty(articleHeaderMinimumHeights._xlarge))} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _minimumHeights: { ...asRecord(asRecord(current._articleHeader)._minimumHeights), _xlarge: parseNumberishInput(value) } } }))} />
                                    <TopicTextInput label="_large" type="number" value={String(asNumberOrEmpty(articleHeaderMinimumHeights._large))} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _minimumHeights: { ...asRecord(asRecord(current._articleHeader)._minimumHeights), _large: parseNumberishInput(value) } } }))} />
                                    <TopicTextInput label="_medium" type="number" value={String(asNumberOrEmpty(articleHeaderMinimumHeights._medium))} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _minimumHeights: { ...asRecord(asRecord(current._articleHeader)._minimumHeights), _medium: parseNumberishInput(value) } } }))} />
                                    <TopicTextInput label="_small" type="number" value={String(asNumberOrEmpty(articleHeaderMinimumHeights._small))} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _articleHeader: { ...asRecord(current._articleHeader), _minimumHeights: { ...asRecord(asRecord(current._articleHeader)._minimumHeights), _small: parseNumberishInput(value) } } }))} />
                                  </TopicNestedAccordion>
                                </TopicNestedAccordion>
                                <TopicNestedAccordion title="On-screen classes">
                                  <TopicCheckbox
                                    label="Enabled?"
                                    checked={asBoolean(article.onScreen?._isEnabled)}
                                    onChange={(checked) => updateArticle(page!.id, article.id, { onScreen: { ...(article.onScreen ?? {}), _isEnabled: checked } })}
                                  />
                                  <TopicSelect
                                    label="Classes"
                                    value={asString(article.onScreen?._classes)}
                                    onChange={(value) => updateArticle(page!.id, article.id, { onScreen: { ...(article.onScreen ?? {}), _classes: value } })}
                                    options={ONSCREEN_CLASS_OPTIONS}
                                    emptyOptionLabel=""
                                  />
                                  <TopicTextInput
                                    label="Percent in view"
                                    type="number"
                                    value={String(asNumberOrEmpty(article.onScreen?._percentInviewVertical))}
                                    onChange={(value) => updateArticle(page!.id, article.id, { onScreen: { ...(article.onScreen ?? {}), _percentInviewVertical: parseNumberishInput(value) } })}
                                  />
                                </TopicNestedAccordion>
                              </TopicAccordion>

                              <TopicAccordion title="Advanced Settings" open={!!openSectionAccordions.advanced} onToggle={(triggerEl) => toggleSectionAccordion("advanced", triggerEl)}>
                                <TopicTextInput label="Section class" value={article.classes} onChange={(value) => updateArticle(page!.id, article.id, { classes: value })} />
                                <TopicNestedAccordion title="Responsive classes">
                                  <TopicTextInput label="_xlarge" value={asString(articleResponsiveClasses._xlarge)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _xlarge: value } }))} />
                                  <TopicTextInput label="_large" value={asString(articleResponsiveClasses._large)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _large: value } }))} />
                                  <TopicTextInput label="_medium" value={asString(articleResponsiveClasses._medium)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _medium: value } }))} />
                                  <TopicTextInput label="_small" value={asString(articleResponsiveClasses._small)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _small: value } }))} />
                                </TopicNestedAccordion>
                              </TopicAccordion>
                            </>
                          );
                        })()}
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
                          {(() => {
                            const blockThemeSettings = getActiveThemeSettings(block.themeSettings);
                            const blockBackgroundImage = asRecord(blockThemeSettings._backgroundImage);
                            const blockBackgroundStyles = asRecord(blockThemeSettings._backgroundStyles);
                            return (
                              <>
                                <div className="flex flex-col gap-1.5">
                                  <div className="text-[13px] font-semibold text-[var(--life-base-black)]">Content Group background image</div>
                                  <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_xlarge" compact value={asString(blockBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_xlarge" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_xlarge" }, initialValue: asString(blockBackgroundImage._xlarge), title: "Content Group background image (_xlarge)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_xlarge" })} />
                                  <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_large" compact value={asString(blockBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_large" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_large" }, initialValue: asString(blockBackgroundImage._large), title: "Content Group background image (_large)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_large" })} />
                                  <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_medium" compact value={asString(blockBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_medium" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_medium" }, initialValue: asString(blockBackgroundImage._medium), title: "Content Group background image (_medium)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_medium" })} />
                                  <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_small" compact value={asString(blockBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_small" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_small" }, initialValue: asString(blockBackgroundImage._small), title: "Content Group background image (_small)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_small" })} />
                                </div>
                                <TopicNestedAccordion title="Content Group background image styles">
                                  <TopicSelect
                                    label={BG_REPEAT_LABEL}
                                    value={asString(blockBackgroundStyles._backgroundRepeat)}
                                    onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({
                                      ...current,
                                      _backgroundStyles: {
                                        ...asRecord(current._backgroundStyles),
                                        _backgroundRepeat: value,
                                      },
                                    }))}
                                    options={BG_REPEAT_OPTIONS}
                                  />
                                  <TopicSelect
                                    label={BG_SIZE_LABEL}
                                    value={asString(blockBackgroundStyles._backgroundSize)}
                                    onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({
                                      ...current,
                                      _backgroundStyles: {
                                        ...asRecord(current._backgroundStyles),
                                        _backgroundSize: value,
                                      },
                                    }))}
                                    options={BG_SIZE_OPTIONS}
                                  />
                                  <TopicSelect
                                    label={BG_POSITION_LABEL}
                                    value={asString(blockBackgroundStyles._backgroundPosition)}
                                    onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({
                                      ...current,
                                      _backgroundStyles: {
                                        ...asRecord(current._backgroundStyles),
                                        _backgroundPosition: value,
                                      },
                                    }))}
                                    options={BG_POSITION_OPTIONS}
                                  />
                                </TopicNestedAccordion>
                              </>
                            );
                          })()}
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
                              const componentThemeSettings = getActiveThemeSettings(component.themeSettings);
                              const componentBackgroundImage = asRecord(componentThemeSettings._backgroundImage);
                              const componentBackgroundStyles = asRecord(componentThemeSettings._backgroundStyles);
                              return (
                                <>
                                  <div className="flex flex-col gap-1.5">
                                    <div className="text-[13px] font-semibold text-[var(--life-base-black)]">Component background image</div>
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_xlarge" compact value={asString(componentBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_xlarge" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_xlarge" }, initialValue: asString(componentBackgroundImage._xlarge), title: "Component background image (_xlarge)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_xlarge" })} />
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_large" compact value={asString(componentBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_large" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_large" }, initialValue: asString(componentBackgroundImage._large), title: "Component background image (_large)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_large" })} />
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_medium" compact value={asString(componentBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_medium" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_medium" }, initialValue: asString(componentBackgroundImage._medium), title: "Component background image (_medium)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_medium" })} />
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_small" compact value={asString(componentBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_small" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_small" }, initialValue: asString(componentBackgroundImage._small), title: "Component background image (_small)" })} onClear={() => clearTopicAssetSelection(page.id, { scope: "componentBackground", articleId: article.id, blockId: block.id, componentId: component.id, bp: "_small" })} />
                                  </div>
                                  <TopicNestedAccordion title="Component background image styles">
                                    <TopicSelect
                                      label={BG_REPEAT_LABEL}
                                      value={asString(componentBackgroundStyles._backgroundRepeat)}
                                      onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({
                                        ...current,
                                        _backgroundStyles: {
                                          ...asRecord(current._backgroundStyles),
                                          _backgroundRepeat: value,
                                        },
                                      }))}
                                      options={BG_REPEAT_OPTIONS}
                                    />
                                    <TopicSelect
                                      label={BG_SIZE_LABEL}
                                      value={asString(componentBackgroundStyles._backgroundSize)}
                                      onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({
                                        ...current,
                                        _backgroundStyles: {
                                          ...asRecord(current._backgroundStyles),
                                          _backgroundSize: value,
                                        },
                                      }))}
                                      options={BG_SIZE_OPTIONS}
                                    />
                                    <TopicSelect
                                      label={BG_POSITION_LABEL}
                                      value={asString(componentBackgroundStyles._backgroundPosition)}
                                      onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({
                                        ...current,
                                        _backgroundStyles: {
                                          ...asRecord(current._backgroundStyles),
                                          _backgroundPosition: value,
                                        },
                                      }))}
                                      options={BG_POSITION_OPTIONS}
                                    />
                                  </TopicNestedAccordion>
                                </>
                              );
                            })()}
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
              const resolvedAssetLink = asset.assetLink || asset.url || asset.id;
              applyTopicAssetSelection(selectedPageId, topicAssetPickerTarget, resolvedAssetLink);
              setAssetLinkIdMap((prev) => ({
                ...prev,
                ...buildCourseAssetLinkCandidates(resolvedAssetLink).reduce<Record<string, string>>((next, key) => {
                  next[key] = asset.id;
                  return next;
                }, {}),
              }));
              setTopicAssetPickerTarget(null);
            }}
          />
        ) : null}

        <ExternalAssetModal
          open={!!topicExternalAssetTarget}
          title={topicExternalAssetTarget?.title || "Select External Asset"}
          initialValue={topicExternalAssetTarget?.initialValue || ""}
          onCancel={() => setTopicExternalAssetTarget(null)}
          onSave={(value) => {
            if (topicExternalAssetTarget) {
              applyTopicAssetSelection(topicExternalAssetTarget.pageId, topicExternalAssetTarget.target, value);
            }
            setTopicExternalAssetTarget(null);
          }}
        />

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
