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
  getComponentBehaviourSchema,
  getCourseAssetMappings,
  getCourseStructure,
  pasteTemplateIntoCourse,
  removeCourseAssetMappings,
  saveContentAsTemplate,
  searchUsersByEmailQuery,
  seedDefaultContentGroup,
  seedDefaultSection,
  seedDefaultTopic,
  type ComponentTypeOption,
  type DashboardTemplate,
  type UserSummary,
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
  _textAlignment?: TopicTextAlignment;
  _minimumHeights?: TopicMinimumHeights;
  _isDividerBlock?: boolean;
  _blockColors?: {
    "block-bg-color"?: string;
    "block-font-color"?: string;
    "block-header-color"?: string;
  };
  _componentColors?: {
    "component-bg-color"?: string;
    "component-font-color"?: string;
    "component-header-color"?: string;
  };
  _paddingTop?: string;
  _paddingBottom?: string;
  _componentVerticalAlignment?: string;
  _componentHorizontalAlignment?: string;
  _blockHeader?: {
    _textAlignment?: TopicTextAlignment;
    _backgroundImage?: TopicResponsiveAssetMap;
    _backgroundStyles?: TopicBackgroundStyles;
    _minimumHeights?: TopicMinimumHeights;
  };
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
  | { scope: "contentGroupHeaderBackground"; articleId: string; blockId: string; bp: BreakpointKey }
  | { scope: "componentBackground"; articleId: string; blockId: string; componentId: string; bp: BreakpointKey }
  | { scope: "componentProperty"; articleId: string; blockId: string; componentId: string; path: string }
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
const RESET_ON_REVISIT_OPTIONS = ["false", "soft", "hard"] as const;

// Palette rows match the adapt-laerdal-life / custom-theme properties.schema exactly.
const LIFE_PALETTE_ROWS: readonly (readonly string[])[] = [
  ["#FFFFFF", "#FAFAFA", "#E5E5E5", "#CCCCCC"],
  ["#F1FBFE", "#D4E9F2", "#A9D3E5", "#215369"],
  ["#EDFCFB", "#C8EEEC", "#98D8D5", "#145653"],
  ["#FFFAEE", "#F8E2BF", "#EAC785", "#604920"],
];
const VANILLA_PALETTE_ROWS: readonly (readonly string[])[] = [
  ["#FFFFFF", "#FAFAFA", "#F0EDEA", "#D6D0C8"],
  ["#F5F5F0", "#E8E4D4", "#D4CCBC", "#C8C0A0"],
  ["#EDE8DC", "#D8CCBC", "#C0B094", "#A09070"],
  ["#D4C8B0", "#B0966C", "#786050", "#504030"],
];
const THEME_COLOUR_PALETTE_ROWS: Record<string, readonly (readonly string[])[]> = {
  "LIFE Theme":    LIFE_PALETTE_ROWS,
  "Custom Theme":  LIFE_PALETTE_ROWS,
  "Vanilla Theme": VANILLA_PALETTE_ROWS,
};

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

// Perceived-brightness check for the Life v2 theme's auto-contrast component
// font colour (ThemeComponentView.setComponentColors' isDarkColor): when a
// component background colour is set with no explicit font colour, the
// theme picks white/black text based on this. Approximated with the
// standard YIQ luma formula; only understands hex input (what the
// ColourPicker palette produces).
function isPreviewColorDark(color: string): boolean {
  const hex = color.trim().replace(/^#/, "");
  if (![3, 6].includes(hex.length) || /[^0-9a-fA-F]/.test(hex)) return false;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma < 128;
}

// ── Component "Behaviour" accordion: schema-driven field rendering ─────────
// Renders a componenttype's own properties.schema fields (fetched via
// getComponentBehaviourSchema, GET /api/componenttype) the same way
// adapt-preview-edit/js/componentConfigView.js's buildFieldHtml/buildInputByType
// do, minus the excluded/generic fields already covered by the other
// accordions (General, Availability & Progression, Extensions, Theme
// settings, Advanced Settings).
const COMPONENT_BEHAVIOUR_EXCLUDED_FIELDS = new Set([
  "_id", "__v", "_type", "_component", "_componentType", "_componentTypeDisplayName",
  "_layout", "_parentId", "_courseId", "_sortOrder", "createdAt", "updatedAt",
  "_contentType", "_enabledExtensions",
  "title", "displayTitle", "body", "description",
  "_classes", "_htmlClasses",
  "_isOptional", "_isAvailable", "_isHidden", "_isVisible",
  "requirecompletionof", "requireCompletionOf", "_requireCompletionOf", "_isResetOnRevisit",
  "_onScreen", "_ariaLevel", "_extensions",
  "themeSettings", "menuSettings", "_pageHeader", "properties",
]);

type BehaviourFieldSchema = {
  type?: string;
  title?: string;
  legend?: string;
  default?: unknown;
  enum?: string[];
  properties?: Record<string, BehaviourFieldSchema>;
  items?: BehaviourFieldSchema;
  help?: string;
  description?: string;
  inputType?: string | { type: string; options?: Array<{ val?: string; label?: string } | string> };
  editorOnly?: boolean;
  extra?: { palette?: string[][] };
  minItems?: number;
  maxItems?: number;
};

function formatBehaviourFieldName(fieldName: string): string {
  const withoutPrefix = fieldName.replace(/^_/, "");
  const spaced = withoutPrefix.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function behaviourSelectOptions(fieldSchema: BehaviourFieldSchema): string[] {
  if (fieldSchema.inputType && typeof fieldSchema.inputType === "object" && Array.isArray(fieldSchema.inputType.options)) {
    return fieldSchema.inputType.options.map((option) =>
      typeof option === "string" ? option : option.val ?? option.label ?? ""
    );
  }
  return Array.isArray(fieldSchema.enum) ? fieldSchema.enum.map(String) : [];
}

// Splits a dotted/bracketed path ("_items[0]._graphic.src") into keys/indices.
function parseBehaviourPath(path: string): Array<string | number> {
  const segments: Array<string | number> = [];
  path.split(".").forEach((part) => {
    const match = part.match(/^([^[]+)((?:\[\d+])*)$/);
    if (!match) {
      segments.push(part);
      return;
    }
    segments.push(match[1]);
    const indices = match[2].match(/\d+/g);
    if (indices) indices.forEach((i) => segments.push(Number(i)));
  });
  return segments;
}

function cloneBehaviourNode(value: unknown): any {
  if (Array.isArray(value)) return value.slice();
  if (value && typeof value === "object") return { ...(value as Record<string, unknown>) };
  return value;
}

function setBehaviourPath(source: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const segments = parseBehaviourPath(path);
  const root: any = cloneBehaviourNode(source) ?? {};
  let cursor = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextIsIndex = typeof segments[i + 1] === "number";
    const existing = cursor[segment];
    const container = existing && typeof existing === "object" ? cloneBehaviourNode(existing) : nextIsIndex ? [] : {};
    cursor[segment] = container;
    cursor = container;
  }
  cursor[segments[segments.length - 1]] = value;
  return root;
}

// Behaviour fields that resolve to an image/asset (matches the field-name and
// object-shape heuristics adapt-preview-edit/js/componentConfigView.js uses
// in isAssetField/isAssetFieldByInputType) render the same TopicAssetField
// picker used everywhere else in the panel, instead of a plain text input.
const BEHAVIOUR_ASSET_FIELD_NAMES = new Set([
  "poster", "mp4", "mp3", "ogg", "webm", "_backgroundImage",
]);

function isBehaviourAssetInputType(fieldSchema: BehaviourFieldSchema): boolean {
  return typeof fieldSchema.inputType === "string" && fieldSchema.inputType.startsWith("Asset:");
}

type BehaviourAssetPath = { path: string; value: string };

// Walks a component's Behaviour schema together with its saved
// settings.properties, collecting every leaf field the Behaviour accordion
// renders as an asset picker (same isBehaviourAssetInputType /
// BEHAVIOUR_ASSET_FIELD_NAMES heuristic as BehaviourField above) along with
// its current string value. Used to live-patch the canvas with the SAME
// upsertPreviewImage mechanism topic/section graphics already use, instead
// of an asset change only ever taking effect after a rebuild.
function collectBehaviourAssetPaths(
  schema: Record<string, BehaviourFieldSchema>,
  value: unknown,
  pathPrefix = ""
): BehaviourAssetPath[] {
  const results: BehaviourAssetPath[] = [];
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  Object.entries(schema).forEach(([fieldName, fieldSchema]) => {
    if (!fieldSchema || typeof fieldSchema !== "object") return;
    const path = pathPrefix ? `${pathPrefix}.${fieldName}` : fieldName;
    const fieldValue = record[fieldName];

    if (fieldSchema.type === "object" && fieldSchema.properties) {
      results.push(...collectBehaviourAssetPaths(fieldSchema.properties, fieldValue, path));
      return;
    }

    if (fieldSchema.type === "array" && fieldSchema.items?.type === "object" && fieldSchema.items.properties) {
      const itemSchema = fieldSchema.items.properties;
      (Array.isArray(fieldValue) ? fieldValue : []).forEach((item, index) => {
        results.push(...collectBehaviourAssetPaths(itemSchema, item, `${path}[${index}]`));
      });
      return;
    }

    if (isBehaviourAssetInputType(fieldSchema) || BEHAVIOUR_ASSET_FIELD_NAMES.has(fieldName)) {
      results.push({ path, value: typeof fieldValue === "string" ? fieldValue : "" });
    }
  });

  return results;
}

// title/subtitle/body/instruction already live-sync through the dedicated
// header pipeline (fixed canonical classes every component template uses) —
// collectBehaviourTextPaths must not also walk them, or its generic text
// diffing would race the header pipeline over the same DOM text.
const COMPONENT_BEHAVIOUR_TEXT_SYNC_EXCLUDED_FIELDS = new Set(["subtitle", "instruction"]);

// Component-specific Behaviour fields (a Graphic's alt text, an MCQ item's
// label, a Narrative item's title, ...) have no canonical class the way
// title/body/instruction do — there's no fixed selector to patch. Instead,
// this collects every other plain string field's path + value so the caller
// can diff against the previous value and find/replace the OLD text
// wherever it's literally rendered, without needing to know the template.
function collectBehaviourTextPaths(
  schema: Record<string, BehaviourFieldSchema>,
  value: unknown,
  pathPrefix = ""
): BehaviourAssetPath[] {
  const results: BehaviourAssetPath[] = [];
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  Object.entries(schema).forEach(([fieldName, fieldSchema]) => {
    if (!fieldSchema || typeof fieldSchema !== "object") return;
    if (fieldSchema.editorOnly) return;
    if (!pathPrefix && (COMPONENT_BEHAVIOUR_EXCLUDED_FIELDS.has(fieldName) || COMPONENT_BEHAVIOUR_TEXT_SYNC_EXCLUDED_FIELDS.has(fieldName))) {
      return;
    }

    const path = pathPrefix ? `${pathPrefix}.${fieldName}` : fieldName;
    const fieldValue = record[fieldName];

    if (fieldSchema.type === "object" && fieldSchema.properties) {
      results.push(...collectBehaviourTextPaths(fieldSchema.properties, fieldValue, path));
      return;
    }

    if (fieldSchema.type === "array" && fieldSchema.items?.type === "object" && fieldSchema.items.properties) {
      const itemSchema = fieldSchema.items.properties;
      (Array.isArray(fieldValue) ? fieldValue : []).forEach((item, index) => {
        results.push(...collectBehaviourTextPaths(itemSchema, item, `${path}[${index}]`));
      });
      return;
    }

    if (isBehaviourAssetInputType(fieldSchema) || BEHAVIOUR_ASSET_FIELD_NAMES.has(fieldName)) return;

    if (fieldSchema.type === "string" && typeof fieldValue === "string") {
      results.push({ path, value: fieldValue });
    }
  });

  return results;
}

type BehaviourAssetContext = {
  pageId: string;
  articleId: string;
  blockId: string;
  componentId: string;
  resolveAssetPreviewUrl: (value: string) => string | null;
  onPickAsset: (path: string) => void;
  onPickExternal: (path: string, currentValue: string) => void;
  onClear: (path: string) => void;
};

function truncateBehaviourItemTitle(value: string): string {
  const stripped = value.replace(/<[^>]*>/g, "").trim();
  return stripped.length > 60 ? `${stripped.slice(0, 57)}…` : stripped;
}

// Identifies an array item by its own title-ish field, so a collapsed item
// accordion is identifiable without expanding it (matches other authoring
// tools: narrative/accordion/hotgraphic items are addressed by their title,
// not by index).
function pickBehaviourItemTitle(item: unknown, itemSchema: BehaviourFieldSchema | undefined, index: number): string {
  const record = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
  const preferredKeys = ["title", "displayTitle", "_title", "heading", "name", "label", "strapline", "text"];
  for (const key of preferredKeys) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) return truncateBehaviourItemTitle(raw);
  }
  if (itemSchema?.properties) {
    for (const key of Object.keys(itemSchema.properties)) {
      if (itemSchema.properties[key]?.type === "string") {
        const raw = record[key];
        if (typeof raw === "string" && raw.trim()) return truncateBehaviourItemTitle(raw);
      }
    }
  }
  return `Item ${index + 1}`;
}

function BehaviourField({
  path,
  fieldName,
  fieldSchema,
  value,
  onChange,
  assetContext,
}: {
  path: string;
  fieldName: string;
  fieldSchema: BehaviourFieldSchema;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
  assetContext?: BehaviourAssetContext;
}) {
  const label = fieldSchema.legend || fieldSchema.title || formatBehaviourFieldName(fieldName);
  const type = fieldSchema.type;
  const inputTypeStr = typeof fieldSchema.inputType === "string" ? fieldSchema.inputType : undefined;
  const inputTypeObj = typeof fieldSchema.inputType === "object" ? fieldSchema.inputType : undefined;
  const selectOptions = behaviourSelectOptions(fieldSchema);
  // Only used by the "array" branch below, but declared unconditionally per
  // the rules of hooks — one open item at a time, per array field instance.
  const [openItemIndex, setOpenItemIndex] = useState<number | null>(null);

  if (type === "object" && fieldSchema.properties) {
    const objectValue = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const hasAssetSrc = assetContext && Object.prototype.hasOwnProperty.call(fieldSchema.properties, "src");
    return (
      <TopicNestedAccordion title={label}>
        {hasAssetSrc && assetContext && (
          <TopicAssetField
            resolveAssetPreviewUrl={assetContext.resolveAssetPreviewUrl}
            label="Image"
            value={asString(objectValue.src)}
            onPickAsset={() => assetContext.onPickAsset(`${path}.src`)}
            onPickExternal={() => assetContext.onPickExternal(`${path}.src`, asString(objectValue.src))}
            onClear={() => assetContext.onClear(`${path}.src`)}
          />
        )}
        {Object.keys(fieldSchema.properties).map((childKey) => {
          if (hasAssetSrc && childKey === "src") return null;
          const childSchema = fieldSchema.properties![childKey];
          if (!childSchema || childSchema.editorOnly) return null;
          return (
            <BehaviourField
              key={`${path}.${childKey}`}
              path={`${path}.${childKey}`}
              fieldName={childKey}
              fieldSchema={childSchema}
              value={objectValue[childKey]}
              onChange={onChange}
              assetContext={assetContext}
            />
          );
        })}
      </TopicNestedAccordion>
    );
  }

  if (type === "array") {
    const items = Array.isArray(value) ? value : [];
    const itemSchema = fieldSchema.items;
    const isObjectItems = itemSchema?.type === "object" && !!itemSchema.properties;
    const canAddMore = typeof fieldSchema.maxItems !== "number" || items.length < fieldSchema.maxItems;

    const handleAddItem = () => {
      onChange(path, [...items, isObjectItems ? {} : ""]);
      setOpenItemIndex(items.length);
    };
    const handleCopyItem = (index: number) => {
      onChange(path, [...items, cloneBehaviourNode(items[index])]);
      setOpenItemIndex(items.length);
    };
    const handleDeleteItem = (index: number) => {
      onChange(path, items.filter((_, i) => i !== index));
      setOpenItemIndex((current) => {
        if (current === null) return null;
        if (current === index) return null;
        return current > index ? current - 1 : current;
      });
    };

    return (
      <div className="flex flex-col gap-2">
        <TopicFieldLabel>{label}</TopicFieldLabel>
        {items.map((item, index) => {
          const isOpen = openItemIndex === index;
          const itemTitle = pickBehaviourItemTitle(item, itemSchema, index);
          return (
            <div key={`${path}[${index}]`} className="w-full rounded-[8px] border border-[#d8dee6] bg-white overflow-hidden">
              <div className="w-full flex items-center gap-2 px-3 py-2 bg-white hover:bg-[var(--life-neutral-020)] transition-colors">
                <button
                  type="button"
                  onClick={() => setOpenItemIndex((current) => (current === index ? null : index))}
                  aria-expanded={isOpen}
                  className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
                >
                  <svg
                    className={`shrink-0 transition-transform duration-200 text-[#6b7280] ${isOpen ? "rotate-90" : ""}`}
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="truncate text-[13px] font-semibold text-[var(--life-base-black)]">{itemTitle}</span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label="Duplicate item"
                    title="Duplicate"
                    disabled={!canAddMore}
                    onClick={() => handleCopyItem(index)}
                    className="w-6 h-6 flex items-center justify-center rounded-md text-[#6b7280] hover:bg-[var(--life-primary-020)] hover:text-[var(--life-primary-500)] transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#6b7280] disabled:cursor-not-allowed"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete item"
                    title="Delete"
                    onClick={() => handleDeleteItem(index)}
                    className="w-6 h-6 flex items-center justify-center rounded-md text-[#6b7280] hover:bg-[#fee2e2] hover:text-[#b42318] transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6h14z" />
                    </svg>
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 pt-2.5 border-t border-[#eef2f6] flex flex-col gap-2.5">
                  {isObjectItems ? (
                    Object.keys(itemSchema!.properties!).map((childKey) => {
                      const childSchema = itemSchema!.properties![childKey];
                      if (!childSchema || childSchema.editorOnly) return null;
                      const itemRecord = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
                      return (
                        <BehaviourField
                          key={`${path}[${index}].${childKey}`}
                          path={`${path}[${index}].${childKey}`}
                          fieldName={childKey}
                          fieldSchema={childSchema}
                          value={itemRecord[childKey]}
                          onChange={onChange}
                          assetContext={assetContext}
                        />
                      );
                    })
                  ) : (
                    <TopicTextInput
                      label="Value"
                      value={typeof item === "string" ? item : item === undefined || item === null ? "" : String(item)}
                      onChange={(v) => onChange(`${path}[${index}]`, v)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        {canAddMore && (
          <button
            type="button"
            className="text-[12px] font-semibold text-[#2d6fa8] hover:underline self-start"
            onClick={handleAddItem}
          >
            + Add {label}
          </button>
        )}
      </div>
    );
  }

  if (assetContext && (isBehaviourAssetInputType(fieldSchema) || BEHAVIOUR_ASSET_FIELD_NAMES.has(fieldName))) {
    const stringValue = asString(value);
    return (
      <TopicAssetField
        resolveAssetPreviewUrl={assetContext.resolveAssetPreviewUrl}
        label={label}
        value={stringValue}
        onPickAsset={() => assetContext.onPickAsset(path)}
        onPickExternal={() => assetContext.onPickExternal(path, stringValue)}
        onClear={() => assetContext.onClear(path)}
      />
    );
  }

  if (type === "boolean") {
    return <TopicCheckbox label={label} checked={!!value} onChange={(checked) => onChange(path, checked)} />;
  }

  if (inputTypeStr === "ColourPicker") {
    return (
      <TopicColorField
        label={label}
        value={asString(value)}
        onChange={(v) => onChange(path, v)}
        paletteRows={fieldSchema.extra?.palette ?? LIFE_PALETTE_ROWS}
      />
    );
  }

  if (selectOptions.length) {
    return (
      <TopicSelect
        label={label}
        value={value !== undefined && value !== null ? String(value) : ""}
        onChange={(v) => onChange(path, v)}
        options={selectOptions}
      />
    );
  }

  if (type === "number") {
    return (
      <TopicTextInput
        label={label}
        type="number"
        value={value !== undefined && value !== null ? String(value) : ""}
        onChange={(v) => onChange(path, v === "" ? "" : Number(v))}
      />
    );
  }

  if (inputTypeStr === "TextArea" || fieldName === "body" || (inputTypeObj?.type === "CodeEditor")) {
    const textValue =
      inputTypeObj?.type === "CodeEditor"
        ? (value && typeof value === "object" ? JSON.stringify(value, null, 2) : asString(value))
        : asString(value);
    return (
      <div className="flex flex-col gap-1.5">
        <TopicFieldLabel>{label}</TopicFieldLabel>
        <textarea
          defaultValue={textValue}
          onBlur={(event) => {
            if (inputTypeObj?.type === "CodeEditor") {
              try {
                onChange(path, JSON.parse(event.target.value || "{}"));
              } catch {
                // Keep current value on invalid JSON.
              }
              return;
            }
            onChange(path, event.target.value);
          }}
          rows={inputTypeObj?.type === "CodeEditor" ? 6 : 4}
          className={`w-full px-2.5 py-1.5 text-[13px] rounded-md border border-[#e5e7eb] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors resize-y ${inputTypeObj?.type === "CodeEditor" ? "font-mono" : ""}`}
        />
      </div>
    );
  }

  return (
    <TopicTextInput
      label={label}
      value={typeof value === "string" ? value : value === undefined || value === null ? "" : String(value)}
      onChange={(v) => onChange(path, v)}
    />
  );
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

// A title consisting only of whitespace/line-breaks (e.g. everything
// selected and deleted in a contenteditable canvas overlay, which can leave
// a stray <br>) is still "empty" — title is mandatory everywhere.
function isBlankTitleValue(value: string): boolean {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim().length === 0;
}

const TITLE_MANDATORY_MESSAGE =
  'Title is mandatory and cannot be empty. If you want to hide the title from preview, please use the "Display title in preview" setting below.';

// Standard duration a title-mandatory warning stays up before it auto-clears
// and the blank title is restored to its last valid value — shared by the
// panel field and the canvas overlay so both behave identically.
const TITLE_WARNING_DURATION_MS = 6000;

// Shared Title field for topic/section/content group/component General
// accordions: title can never be saved blank. Like the canvas's inline
// title, every non-blank keystroke commits live (via onChange) so the
// canvas mirrors panel typing in real time, matching the canvas -> panel
// direction. Blank keystrokes are never committed — otherwise the last
// non-blank intermediate value (e.g. "N" from "New Topic 1" mid-backspace)
// would become the wrong "revert to" target. `originalValueRef` captures
// the true pre-edit value on focus so blur-while-blank can revert both the
// local draft and the shared state (hence the canvas too) to it, and shows
// the warning here since the edit originated in this panel.
function TopicTitleField({
  value,
  onChange,
  onDraftChange,
}: {
  value: string;
  onChange: (value: string) => void;
  // Fires on every keystroke, including blank ones that onChange skips —
  // lets the canvas mirror the panel's literal text (blank included) live.
  onDraftChange?: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [showWarning, setShowWarning] = useState(false);
  const originalValueRef = useRef(value);
  const autoRevertTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const cancelAutoRevert = () => {
    if (autoRevertTimeoutRef.current !== null) {
      window.clearTimeout(autoRevertTimeoutRef.current);
      autoRevertTimeoutRef.current = null;
    }
  };

  // Reverts the blank draft to the pre-edit value and clears the warning —
  // shared by both blur (immediate) and the auto-revert timeout (after
  // TITLE_WARNING_DURATION_MS of being left blank, matching the canvas).
  const revertToOriginal = () => {
    cancelAutoRevert();
    const revertValue = originalValueRef.current;
    setShowWarning(false);
    setDraft(revertValue);
    onDraftChange?.(revertValue);
    if (revertValue !== value) onChange(revertValue);
  };

  useEffect(() => cancelAutoRevert, []);

  return (
    <div className="flex flex-col gap-1.5">
      <TopicFieldLabel>Title</TopicFieldLabel>
      <input
        type="text"
        value={draft}
        onFocus={() => {
          originalValueRef.current = value;
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraft(nextValue);
          onDraftChange?.(nextValue);
          if (isBlankTitleValue(nextValue)) {
            // Warn immediately, not just on blur — the user shouldn't have
            // to defocus the field to find out the title can't be blank.
            setShowWarning(true);
            if (autoRevertTimeoutRef.current === null) {
              autoRevertTimeoutRef.current = window.setTimeout(revertToOriginal, TITLE_WARNING_DURATION_MS);
            }
          } else {
            cancelAutoRevert();
            if (showWarning) setShowWarning(false);
            onChange(nextValue);
          }
        }}
        onBlur={() => {
          if (isBlankTitleValue(draft)) {
            revertToOriginal();
            return;
          }
          cancelAutoRevert();
          setShowWarning(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className="w-full px-2.5 py-1.5 text-[13px] rounded-md border border-[#e5e7eb] text-[#111827] bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"
      />
      {showWarning && (
        <p className="text-[11px] text-[#b42318]">{TITLE_MANDATORY_MESSAGE}</p>
      )}
    </div>
  );
}

// Matches the old Authoring Tool's Backbone-Forms Number editor: a numeric
// input with stacked increment/decrement buttons instead of the browser's
// native spinner. Used for "Require completion of" (topic/section/content
// group levels).
function TopicNumberStepper({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
}) {
  const step = (delta: number) => {
    const current = Number(value);
    const base = Number.isFinite(current) ? current : (min ?? 0);
    const next = base + delta;
    onChange(String(min !== undefined ? Math.max(min, next) : next));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <TopicFieldLabel>{label}</TopicFieldLabel>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full px-2.5 py-1.5 pr-7 text-[13px] rounded-md border border-[#e5e7eb] text-[#111827] bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
          <button
            type="button"
            aria-label="Increment"
            onClick={() => step(1)}
            className="flex items-center justify-center w-4 h-3 text-[#6b7280] hover:text-[#2d6fa8]"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
          </button>
          <button
            type="button"
            aria-label="Decrement"
            onClick={() => step(-1)}
            className="flex items-center justify-center w-4 h-3 text-[#6b7280] hover:text-[#2d6fa8]"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>
      </div>
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

function TopicColorField({
  label,
  value,
  onChange,
  paletteRows = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  paletteRows?: readonly (readonly string[])[];
}) {
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [draft, setDraft] = useState(value || "#000000");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraft(value || "#000000"); }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openPicker() {
    setDraft(value || "#000000");
    setShowMore(false);
    setOpen((o) => !o);
  }
  function apply() { onChange(draft); setOpen(false); }
  function clear() { onChange(""); setOpen(false); }

  const isEmpty = !value;
  const checkerStyle: React.CSSProperties = {
    backgroundImage: "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
    backgroundSize: "8px 8px",
    backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
  };

  const popoverStyle = (() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return { top: 0, left: 0 };
    const top = rect.bottom + 4;
    const left = Math.min(rect.left, window.innerWidth - 168);
    return { top, left };
  })();

  return (
    <div className="flex flex-col gap-1">
      <TopicFieldLabel>{label}</TopicFieldLabel>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        aria-label={`Pick ${label}`}
        className="w-10 h-10 rounded-md border-2 border-[#e5e7eb] hover:border-[var(--life-primary-500)] transition-colors relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#2d6fa8]"
        style={isEmpty ? checkerStyle : { backgroundColor: value }}
      >
        {isEmpty && (
          <svg className="absolute inset-0 m-auto text-[#9ca3af]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[100] bg-white border border-[#d1d5db] rounded-lg shadow-xl overflow-hidden"
          style={{ ...popoverStyle, width: 160 }}
        >
          {/* Palette grid */}
          {paletteRows.length > 0 && (
            <div className="p-1.5">
              {paletteRows.map((row, ri) => (
                <div key={ri} className="flex">
                  {row.map((colour) => (
                    <button
                      key={colour}
                      type="button"
                      title={colour}
                      onClick={() => { onChange(colour); setOpen(false); }}
                      className="w-9 h-9 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2d6fa8] rounded-sm"
                      style={{ backgroundColor: colour }}
                      aria-label={colour}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* "more" toggle — expands to full picker */}
          <div className="border-t border-[#e5e7eb]">
            {!showMore ? (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="w-full text-right px-2 py-1 text-xs text-[#374151] hover:bg-[#f9fafb] transition-colors"
              >
                more
              </button>
            ) : (
              <div className="p-2 flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <label
                    className="w-8 h-8 rounded border border-[#e5e7eb] overflow-hidden cursor-pointer relative shrink-0"
                    style={{ backgroundColor: draft }}
                  >
                    <input
                      type="color"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label="Custom colour"
                    />
                  </label>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!/^#[0-9a-fA-F]{3,6}$/.test(v)) setDraft(value || "#000000");
                    }}
                    maxLength={7}
                    placeholder="#000000"
                    className="flex-1 border border-[#e5e7eb] rounded px-1.5 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-[#2d6fa8]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button type="button" onClick={clear} className="text-[11px] text-[#9ca3af] hover:text-[#ef4444] transition-colors">
                    Clear
                  </button>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setShowMore(false)} className="px-2 py-0.5 text-[11px] border border-[#e5e7eb] rounded text-[#374151] hover:bg-[#f9fafb] transition-colors">
                      Cancel
                    </button>
                    <button type="button" onClick={apply} className="px-2 py-0.5 text-[11px] rounded bg-[#2d6fa8] text-white hover:bg-[#245c8f] transition-colors">
                      Choose
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
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

// Matches the legacy Authoring Tool's "Save as template" popup — same fields
// (name, description, share with all users / share with specific users),
// same dynamic "Save {level} template" title/placeholders — in this UI's own
// modal chrome. Level-specific wiring/labelling happens at the call site;
// this component only collects the inputs and hands them back on Done.
function SaveAsTemplateModal({
  levelLabel,
  isSaving,
  errorMessage,
  onDone,
  onCancel,
}: {
  levelLabel: string;
  isSaving: boolean;
  errorMessage: string | null;
  onDone: (data: { title: string; description: string; isShared: boolean; shareWithUsers: string[] }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [collaborators, setCollaborators] = useState<{ userId: string; email: string }[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [emailSuggestions, setEmailSuggestions] = useState<UserSummary[]>([]);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    const query = emailInput.trim();
    if (!query || isShared) {
      setEmailSuggestions([]);
      return;
    }
    const requestId = ++searchRequestIdRef.current;
    const timer = window.setTimeout(async () => {
      const results = await searchUsersByEmailQuery(query);
      if (searchRequestIdRef.current !== requestId) return;
      setEmailSuggestions(results.filter((user) => !collaborators.some((c) => c.userId === user._id)));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [emailInput, isShared, collaborators]);

  const addCollaborator = (user: UserSummary) => {
    setCollaborators((prev) => (prev.some((c) => c.userId === user._id) ? prev : [...prev, { userId: user._id, email: user.email }]));
    setEmailInput("");
    setEmailSuggestions([]);
  };
  const removeCollaborator = (userId: string) => {
    setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4" onClick={onCancel}>
      <div className="w-full max-w-xl rounded-2xl border border-[var(--life-neutral-200)] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--life-neutral-200)] flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-[var(--life-base-black)]">Save {levelLabel} template</h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-md border border-[var(--life-neutral-200)] text-[var(--life-neutral-500)] hover:bg-[var(--life-neutral-050)] flex items-center justify-center cursor-pointer"
            aria-label="Close save template dialog"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3 max-h-[65vh] overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#374151]">Name of template</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`Name for the ${levelLabel} template`}
              className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#374151]">Description</label>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={`Description for the ${levelLabel} template`}
              className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(event) => setIsShared(event.target.checked)}
              className="h-3.5 w-3.5 rounded-[6px] border-[#cbd5e1] text-[#2d6fa8] focus:ring-[#2d6fa8]"
            />
            <span className="text-sm font-semibold text-[#374151]">Share with all users</span>
          </label>
          <p className="text-[12px] text-[var(--life-neutral-300)] -mt-1">
            Controls whether colleagues can see this template from the "Shared Templates" filter.
          </p>
          {!isShared && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[#374151]">Share with specific users</label>
              <input
                type="text"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="Search by email"
                className="w-full border border-[#d1d5db] rounded-[8px] px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent"
              />
              {emailSuggestions.length > 0 && (
                <div className="border border-[#d1d5db] rounded-[8px] divide-y divide-[#e5e7eb] max-h-32 overflow-y-auto">
                  {emailSuggestions.map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => addCollaborator(user)}
                      className="w-full text-left px-3 py-1.5 text-[13px] text-[#374151] hover:bg-[#f9fafb] cursor-pointer"
                    >
                      {user.email}
                    </button>
                  ))}
                </div>
              )}
              {collaborators.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {collaborators.map((collaborator) => (
                    <span
                      key={collaborator.userId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eef2f6] text-[12px] text-[#374151]"
                    >
                      {collaborator.email}
                      <button
                        type="button"
                        onClick={() => removeCollaborator(collaborator.userId)}
                        className="text-[#9ca3af] hover:text-[#374151] cursor-pointer"
                        aria-label={`Remove ${collaborator.email}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {errorMessage && <p className="text-[13px] text-[#b42318]">{errorMessage}</p>}
        </div>
        <div className="px-5 py-4 border-t border-[var(--life-neutral-200)] flex items-center justify-end gap-2.5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || !title.trim()}
            onClick={() => onDone({ title, description, isShared, shareWithUsers: collaborators.map((c) => c.userId) })}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving…" : "Done"}
          </button>
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
    isA11yCompletionDescriptionEnabled?: boolean;
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
      isA11yCompletionDescriptionEnabled?: boolean;
      extensions?: Record<string, unknown>;
      contentGroups: Array<{
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
        isA11yCompletionDescriptionEnabled?: boolean;
        extensions?: Record<string, unknown>;
          components: Array<{
            id: string;
            title: string;
            componentKey: string;
            layout?: "full" | "left" | "right";
            description?: string;
            instruction?: string;
            subtitle?: string;
            themeSettings?: Record<string, unknown>;
            properties?: Record<string, unknown>;
            url?: string;
            classes?: string;
            isOptional?: boolean;
            isAvailable?: boolean;
            isHidden?: boolean;
            isVisible?: boolean;
            isResetOnRevisit?: string;
            ariaLevel?: string;
            isA11yCompletionDescriptionEnabled?: boolean;
            showDisplayTitleInPreview?: boolean;
            onScreen?: {
              _isEnabled?: boolean;
              _classes?: string;
              _percentInviewVertical?: number;
            };
            extensions?: Record<string, unknown>;
          }>;
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
      isA11yCompletionDescriptionEnabled: topic.isA11yCompletionDescriptionEnabled !== false,
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
        isA11yCompletionDescriptionEnabled: section.isA11yCompletionDescriptionEnabled !== false,
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
          isOptional: !!group.isOptional,
          isAvailable: group.isAvailable !== false,
          isHidden: !!group.isHidden,
          isVisible: group.isVisible !== false,
          requireCompletionOf: group.requireCompletionOf ?? "-1",
          classes: group.classes || "",
          onScreen: {
            _isEnabled: !!group.onScreen?._isEnabled,
            _classes: group.onScreen?._classes || "",
            _percentInviewVertical:
              typeof group.onScreen?._percentInviewVertical === "number"
                ? group.onScreen._percentInviewVertical
                : 50,
          },
          ariaLevel: group.ariaLevel || "",
          isA11yCompletionDescriptionEnabled: group.isA11yCompletionDescriptionEnabled !== false,
          extensions: group.extensions ?? {},
          showDisplayTitleInPreview:
            typeof group.displayTitle === "string"
              ? group.displayTitle.trim().length > 0
              : false,
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
            classes: component.classes || "",
            isOptional: !!component.isOptional,
            isAvailable: component.isAvailable !== false,
            isHidden: !!component.isHidden,
            isVisible: component.isVisible !== false,
            isResetOnRevisit: component.isResetOnRevisit || "false",
            ariaLevel: component.ariaLevel || "",
            isA11yCompletionDescriptionEnabled: component.isA11yCompletionDescriptionEnabled !== false,
            showDisplayTitleInPreview: !!component.showDisplayTitleInPreview,
            onScreen: {
              _isEnabled: !!component.onScreen?._isEnabled,
              _classes: component.onScreen?._classes || "",
              _percentInviewVertical:
                typeof component.onScreen?._percentInviewVertical === "number"
                  ? component.onScreen._percentInviewVertical
                  : 50,
            },
            extensions:
              component.extensions && typeof component.extensions === "object"
                ? component.extensions
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
  classes: string;
  isOptional: boolean;
  isAvailable: boolean;
  isHidden: boolean;
  isVisible: boolean;
  isResetOnRevisit: string;
  ariaLevel: string;
  isA11yCompletionDescriptionEnabled: boolean;
  showDisplayTitleInPreview: boolean;
  onScreen: TopicOnScreenSettings;
  extensions: Record<string, unknown>;
}

export interface BlockData {
  id: string;
  title: string;
  description: string;
  instruction: string;
  themeSettings: TopicThemeSettings;
  components: ComponentData[];
  isOptional: boolean;
  isAvailable: boolean;
  isHidden: boolean;
  isVisible: boolean;
  requireCompletionOf: string;
  classes: string;
  onScreen: TopicOnScreenSettings;
  ariaLevel: string;
  isA11yCompletionDescriptionEnabled: boolean;
  extensions: Record<string, unknown>;
  showDisplayTitleInPreview: boolean;
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
  isA11yCompletionDescriptionEnabled: boolean;
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
  isA11yCompletionDescriptionEnabled: boolean;
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

const DEFAULT_BLOCK_ACCORDIONS: Record<string, boolean> = {
  general: true,
  availability: false,
  accessibility: false,
  extensions: false,
  theme: false,
  advanced: false,
};

const DEFAULT_COMPONENT_ACCORDIONS: Record<string, boolean> = {
  general: true,
  behaviour: false,
  availability: false,
  accessibility: false,
  extensions: false,
  theme: false,
  advanced: false,
};

// Matches the legacy Authoring Tool's dynamic "Save {level} template" popup
// title/placeholders — only the naming differs (Topic vs. its old "Page").
const SAVE_TEMPLATE_LEVEL_LABELS: Record<"topic" | "section" | "group" | "component", string> = {
  topic: "Topic",
  section: "Section",
  group: "Content Group",
  component: "Component",
};

// Matches the theme's own _paddingTop/_paddingBottom enum (theme
// properties.schema, pluginLocations.block) exactly — these are persisted
// values, not display labels.
const SPACING_OPTIONS = ["default", "double", "standard", "half", "remove"] as const;
const VERTICAL_ALIGN_OPTIONS = ["top", "center", "bottom"] as const;
const HORIZONTAL_ALIGN_OPTIONS = ["left", "center", "right"] as const;

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
  const [titleValidationWarning, setTitleValidationWarning] = useState<string | null>(null);
  // Live text of the title currently being edited in the CANVAS, including
  // transient blank states that are deliberately never committed to real
  // state (see onInput's isBlankTitleValue guard) — the right panel's title
  // field reads this in preference to the real value so it visually mirrors
  // canvas edits keystroke-for-keystroke, exactly like the reverse direction.
  // Only one node's title can be in-edit at a time, so no id-matching is
  // needed: whichever TopicTitleField is mounted is for the selected node.
  const [canvasTitleLiveOverride, setCanvasTitleLiveOverride] = useState<string | null>(null);
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
  const [componentInstructionSchemaSupport, setComponentInstructionSchemaSupport] = useState<Record<string, boolean>>({});
  const [topicAssetPickerTarget, setTopicAssetPickerTarget] = useState<TopicAssetTarget | null>(null);
  const [topicExternalAssetTarget, setTopicExternalAssetTarget] = useState<TopicExternalAssetTarget | null>(null);
  const [saveTemplateTarget, setSaveTemplateTarget] = useState<{
    level: "topic" | "section" | "group" | "component";
    objectId: string;
  } | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState<string | null>(null);
  const [copiedTopicId, setCopiedTopicId] = useState<string | null>(null);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);
  const [copiedComponentId, setCopiedComponentId] = useState<string | null>(null);
  const [openTopicAccordions, setOpenTopicAccordions] = useState<Record<string, boolean>>(DEFAULT_TOPIC_ACCORDIONS);
  const [openSectionAccordions, setOpenSectionAccordions] = useState<Record<string, boolean>>(DEFAULT_SECTION_ACCORDIONS);
  const [openBlockAccordions, setOpenBlockAccordions] = useState<Record<string, boolean>>(DEFAULT_BLOCK_ACCORDIONS);
  const [openComponentAccordions, setOpenComponentAccordions] = useState<Record<string, boolean>>(DEFAULT_COMPONENT_ACCORDIONS);
  const [componentBehaviourSchemas, setComponentBehaviourSchemas] = useState<Record<string, Record<string, unknown>>>({});
  const [courseAssetMappings, setCourseAssetMappings] = useState<Record<string, string>>({});
  const [assetLinkIdMap, setAssetLinkIdMap] = useState<Record<string, string>>({});
  const structureLoadRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const pendingGuardedActionRef = useRef<(() => void) | null>(null);
  const isInlineEditingRef = useRef(false);
  // The title's committed value at the moment inline editing started — used to
  // revert BOTH the canvas DOM and the underlying state if the edit session
  // ends blank. onInput commits every non-blank keystroke live (so the right
  // panel tracks canvas typing in real time), which means state can already
  // hold an intermediate non-blank value (e.g. "N" from "New Topic 1" mid
  // backspace) by the time the field goes fully blank — reverting to "current
  // state" at that point would revert to that stale intermediate value, not
  // the true pre-edit title. This ref preserves the real pre-edit value.
  const titleEditOriginalValueRef = useRef<string | null>(null);
  // Auto-revert timer for a title left blank in the canvas without blurring —
  // mirrors the panel field's identical timeout so both surfaces behave the
  // same: the warning stays up for TITLE_WARNING_DURATION_MS, then the title
  // is restored automatically even if the user never leaves the field.
  const titleAutoRevertTimeoutRef = useRef<number | null>(null);
  // The iframe's course-preview SPA can still be mid-render for a moment
  // after its own `load` event fires (or after a React selection/content
  // update) — querying for the selected node's root can transiently miss it.
  // Without a retry, the default initial selection (the topic, selected
  // before the user has ever "changed" selection) can end up stuck
  // non-editable until some later selection change happens to re-trigger a
  // sync after the SPA has caught up. These back the bounded rAF retry in
  // syncPreviewInlineEditors.
  const inlineEditorSyncRetryFrameRef = useRef<number | null>(null);
  const inlineEditorSyncRetryCountRef = useRef(0);
  // Previous Behaviour text-field values for the currently selected
  // component, keyed by path — lets syncPreviewTopicSettings diff old vs
  // new value and find/replace the literal old text in the canvas, since
  // component-specific fields (unlike title/body/instruction) have no fixed
  // selector to patch directly. Reset whenever the selected component
  // changes so a freshly-selected component doesn't diff against another
  // component's stale values.
  const previousBehaviourTextValuesRef = useRef<{ componentId: string | null; values: Record<string, string> }>({
    componentId: null,
    values: {},
  });
  // Previous Behaviour ASSET-field resolved URLs for the currently selected
  // component, keyed by path — mirrors previousBehaviourTextValuesRef but
  // for images. Diffing by the item's own previous src (rather than a
  // generic class selector) is what lets an item array's Nth item update
  // its OWN image, instead of always hitting the first image that matches
  // a class shared by every item (e.g. every narrative slide's graphic).
  const previousBehaviourAssetValuesRef = useRef<{ componentId: string | null; values: Record<string, string> }>({
    componentId: null,
    values: {},
  });
  // Watches the selected component's DOM for changes the real framework
  // makes on its own — e.g. a narrative/accordion swapping which item is
  // visible when its own nav/expand controls are clicked, which happens
  // entirely inside the iframe with no React state change on our side to
  // react to. Disconnected and recreated on every syncPreviewInlineEditors
  // run so our OWN mutations (while it's disconnected) never re-trigger it.
  const componentMutationObserverRef = useRef<MutationObserver | null>(null);
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
  const copiedBlockIdResetTimerRef = useRef<number | null>(null);
  const copiedComponentIdResetTimerRef = useRef<number | null>(null);
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
    if (!titleValidationWarning) return;
    const timer = window.setTimeout(() => setTitleValidationWarning(null), TITLE_WARNING_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [titleValidationWarning]);

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
    if (!menuPageCreated || isLoadingStructure || !courseId || courseId === "new-course" || !user?._tenantId) {
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
        // Studio surface: ensure a render shell exists (cached unless the theme/menu/
        // plugin set changed), then let the iframe load live JSON from the DB. Content
        // edits reuse the cached shell — no grunt rebuild per change.
        const result = await apiClient.post<PreviewBuildResponse>(`/studio/ensure/${user._tenantId}/${courseId}`);
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
  }, [courseId, isLoadingStructure, menuPageCreated, previewRefreshToken, user?._tenantId]);

  const previewSrc = useMemo(() => {
    if (!user?._tenantId || !courseId || courseId === "new-course" || !menuPageCreated) {
      return null;
    }

    const basePath = `/studio/${user._tenantId}/${courseId}/?_pe=${previewBuildVersion}&embedded=1`;
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

      .adapt-authoring-preview-title-hidden {
        display: none !important;
      }

      .adapt-authoring-preview-title-dimmed {
        opacity: 0.45 !important;
      }

      /* A muted, "not currently in focus" look for everything nested
         inside whichever level is selected (e.g. a section's own content
         groups/components while the SECTION is selected) — makes it clear
         at a glance which header is actually being edited right now vs.
         what's just along for the ride. Purely visual: hover/click/editing
         all keep working normally, and selecting a dimmed item directly
         clears this the same run (see applyPreviewSelectionStyles). */
      .adapt-authoring-preview-unfocused-descendant {
        opacity: 0.55 !important;
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

      /* Component is the one level whose header group shares its flex
         container with the component's own real, non-header markup (item
         lists, images, widgets, etc. rendered by the actual template inside
         .component__inner) — those children never match a header selector
         below, so without an explicit order they'd default to 0 and jump
         ahead of the order:1 title despite already being correctly last in
         DOM order. Default every child to order 5 (after instruction) so
         only known header fields ever sort earlier, keeping this identical
         to how the real, non-edited preview stacks them. Scoped to the
         component-only modifier class — topic/section/content group each
         get their OWN dedicated header wrapper with nothing else inside it,
         so they never had this problem and must not be touched by it.
       */
      .adapt-authoring-preview-inline-structured-header--component > * {
        order: 5 !important;
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
      .querySelectorAll(".adapt-authoring-preview-hover, .adapt-authoring-preview-active, .adapt-authoring-preview-hover-header, .adapt-authoring-preview-active-header, .adapt-authoring-preview-clickable, .adapt-authoring-preview-topic-shell-active, .adapt-authoring-preview-unfocused-descendant")
      .forEach((node) => {
        node.classList.remove(
          "adapt-authoring-preview-hover",
          "adapt-authoring-preview-active",
          "adapt-authoring-preview-hover-header",
          "adapt-authoring-preview-active-header",
          "adapt-authoring-preview-clickable",
          "adapt-authoring-preview-topic-shell-active",
          "adapt-authoring-preview-unfocused-descendant"
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

        // Dim everything nested inside the selected level — its own
        // header stays fully normal, only what's underneath (not what's
        // actually being edited via the right panel right now) is muted.
        // Components have nothing nested under them, so nothing to dim.
        const unfocusedDescendantSelector: string | null =
          activeLevel === "topic" ? ".article, .block, .component"
          : activeLevel === "section" ? ".block, .component"
          : activeLevel === "group" ? ".component"
          : null;
        if (unfocusedDescendantSelector) {
          activeNode.querySelectorAll(unfocusedDescendantSelector).forEach((node) => {
            node.classList.add("adapt-authoring-preview-unfocused-descendant");
          });
        }
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

    if (inlineEditorSyncRetryFrameRef.current !== null) {
      window.cancelAnimationFrame(inlineEditorSyncRetryFrameRef.current);
      inlineEditorSyncRetryFrameRef.current = null;
    }

    // Disconnected up front, every run — re-created only for a selected
    // component (see the end of the component branch below). Doing this
    // BEFORE our own DOM patching (rather than trying to flag/ignore
    // self-caused records after the fact) guarantees our own mutations can
    // never be mistaken for the framework's.
    componentMutationObserverRef.current?.disconnect();
    componentMutationObserverRef.current = null;

    if (hasCanvasSelection) {
      const expectedRootSelector = selectedComponentId
        ? `.component[data-adapt-id="${selectedComponentId}"]`
        : selectedBlockId
          ? `.block[data-adapt-id="${selectedBlockId}"]`
          : selectedArticleId
            ? `.article[data-adapt-id="${selectedArticleId}"]`
            : selectedPageId && !menuSelected
              ? `.page[data-adapt-id="${selectedPageId}"]`
              : null;

      // The selected node's real DOM root not existing yet almost always
      // means the SPA hasn't finished rendering, not that the selection is
      // invalid — retry a bounded number of frames instead of giving up, so
      // the default initial selection doesn't end up permanently stuck
      // non-editable just because it "arrived" before the iframe did.
      if (expectedRootSelector && !doc.querySelector(expectedRootSelector)) {
        if (inlineEditorSyncRetryCountRef.current < 90) {
          inlineEditorSyncRetryCountRef.current += 1;
          inlineEditorSyncRetryFrameRef.current = window.requestAnimationFrame(() => {
            inlineEditorSyncRetryFrameRef.current = null;
            syncPreviewInlineEditors();
          });
        } else {
          inlineEditorSyncRetryCountRef.current = 0;
        }
        return;
      }
    }
    inlineEditorSyncRetryCountRef.current = 0;

    const clearEditable = () => {
      // Only tear down an injected placeholder (title/subtitle/body/
      // instruction container the real template didn't render because the
      // field was empty at last build) when it's STILL empty. One typed
      // into while selected is real content the user just added to this
      // component — deselecting must not make it disappear just because
      // the underlying template happened to omit an empty version of it.
      doc.querySelectorAll("[data-preview-injected='true']").forEach((node) => {
        const element = node as HTMLElement;
        if ((element.textContent || "").trim().length > 0) return;
        const parent = element.parentElement;
        element.remove();
        if (parent?.getAttribute("data-preview-injected") === "true" && !parent.textContent?.trim() && !parent.querySelector("*")) {
          parent.remove();
        }
      });
      doc.querySelectorAll(".adapt-authoring-preview-inline-structured-header").forEach((node) => {
        node.classList.remove("adapt-authoring-preview-inline-structured-header", "adapt-authoring-preview-inline-structured-header--component");
      });

      doc.querySelectorAll("[data-preview-inline-container-empty='true']").forEach((node) => {
        node.removeAttribute("data-preview-inline-container-empty");
      });

      doc.querySelectorAll("[data-preview-edit-enabled='true']").forEach((node) => {
        const element = node as HTMLElement;
        const isInjected = element.getAttribute("data-preview-injected") === "true";
        const isEmpty = (element.textContent || "").trim().length === 0;

        // On deselect, a title that was shown DIMMED (because "Display title
        // in preview" is off) goes back to fully hidden — matching real
        // preview, where an empty displayTitle renders nothing. The dimmed
        // treatment is only for the currently-selected node being edited.
        if (element.getAttribute("data-preview-edit-field") === "title") {
          const container = element.closest(PREVIEW_INLINE_FIELD_CONTAINER_SELECTOR) as HTMLElement | null;
          const titleTarget = container ?? element;
          if (titleTarget.classList.contains("adapt-authoring-preview-title-dimmed")) {
            titleTarget.classList.remove("adapt-authoring-preview-title-dimmed");
            titleTarget.classList.add("adapt-authoring-preview-title-hidden");
          }
        }

        node.removeAttribute("data-preview-edit-enabled");
        node.removeAttribute("data-preview-edit-field");
        node.removeAttribute("data-preview-node-level");
        node.removeAttribute("data-preview-page-id");
        node.removeAttribute("data-preview-article-id");
        node.removeAttribute("data-preview-block-id");
        node.removeAttribute("data-preview-component-id");
        node.removeAttribute("data-preview-behaviour-path");
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

    // Every level's title/subtitle/body/instruction placeholders are ensured
    // and then forced into one fixed DOM order: title, subtitle (only where
    // the level/component supports it), body, instruction — regardless of
    // which of them the real rendered template already contains vs. which
    // we have to inject as empty placeholders. This is the single shared
    // ordering rule for all four levels (topic/section/content group/
    // component); never special-case ordering per level — add/adjust field
    // specs at the call site instead.
    type OrderedInlineFieldSpec = {
      key: "title" | "subtitle" | "body" | "instruction";
      visible: boolean;
      value: string;
    } & (
      | { kind: "pair"; containerSelector: string; containerClassName: string; innerSelector: string; innerClassName: string }
      | { kind: "flat"; selector: string; className: string }
    );

    const ensureOrderedInlineFields = (
      host: Element,
      specs: OrderedInlineFieldSpec[]
    ): Partial<Record<OrderedInlineFieldSpec["key"], HTMLElement>> => {
      const result: Partial<Record<OrderedInlineFieldSpec["key"], HTMLElement>> = {};
      const outerNodes: HTMLElement[] = [];

      specs.forEach((spec) => {
        if (!spec.visible) return;

        if (spec.kind === "flat") {
          let el = host.querySelector(spec.selector) as HTMLElement | null;
          if (!el) {
            el = doc.createElement("div");
            el.className = spec.className;
            el.textContent = spec.value;
            el.setAttribute("data-preview-injected", "true");
            host.appendChild(el);
          }
          result[spec.key] = el;
          outerNodes.push(el);
          return;
        }

        const existingInner = host.querySelector(spec.innerSelector) as HTMLElement | null;
        if (existingInner) {
          const container = (existingInner.closest(spec.containerSelector) as HTMLElement | null) ?? existingInner;
          result[spec.key] = existingInner;
          outerNodes.push(container);
          return;
        }

        let container = host.querySelector(spec.containerSelector) as HTMLElement | null;
        if (!container) {
          container = doc.createElement("div");
          container.className = spec.containerClassName;
          container.setAttribute("data-preview-injected", "true");
          host.appendChild(container);
        }
        const inner = doc.createElement("div");
        inner.className = spec.innerClassName;
        inner.textContent = spec.value;
        inner.setAttribute("data-preview-injected", "true");
        container.appendChild(inner);
        result[spec.key] = inner;
        outerNodes.push(container);
      });

      // Pin the whole ordered group to the front of `host`, in spec order —
      // inserting in reverse at host.firstChild is what makes the final
      // order match `specs` regardless of each node's prior position.
      for (let i = outerNodes.length - 1; i >= 0; i--) {
        host.insertBefore(outerNodes[i], host.firstChild);
      }

      return result;
    };

    const PREVIEW_INLINE_FIELD_CONTAINER_SELECTOR =
      ".page__title, .page__subtitle, .page__body, .page__instruction, .article__title, .article__body, .article__instruction, .block__title, .block__body, .block__instruction, .component__title, .component__body, .component__instruction, .laerdal-text__subtitle";

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
        hiddenFromPreview?: boolean;
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
      const container = element.closest(PREVIEW_INLINE_FIELD_CONTAINER_SELECTOR) as HTMLElement | null;

      if (!hasText) {
        element.classList.add("adapt-authoring-preview-inline-empty");
        container?.setAttribute("data-preview-inline-container-empty", "true");
      } else {
        element.classList.remove("adapt-authoring-preview-inline-empty");
        container?.removeAttribute("data-preview-inline-container-empty");
      }
      element.setAttribute("data-placeholder", options.placeholder);

      if (options.field === "title") {
        const titleTarget = container ?? element;
        // While this node is selected (the only time makeEditable runs for
        // it), a title that's excluded from the real preview is shown DIMMED
        // rather than removed, so the editor can still see/edit it and get a
        // visual cue that it won't render. "-title-hidden" (fully removed,
        // matching real preview) is applied only on deselect, by clearEditable.
        titleTarget.classList.remove("adapt-authoring-preview-title-hidden");
        titleTarget.classList.toggle("adapt-authoring-preview-title-dimmed", !!options.hiddenFromPreview);
      }
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
      const componentNode = doc.querySelector(`.component[data-adapt-id="${selectedComponent.id}"]`) as HTMLElement | null;
      const componentHost = (componentNode?.querySelector(".component__inner") ?? componentNode) as HTMLElement | null;
      if (!componentHost) return;

      // Some component templates render their own widget (image, H5P
      // iframe, etc.) as a SIBLING of .component__inner rather than a child
      // of it (e.g. `.component > .component__widget, .component__inner`).
      // Reordering only inside componentHost can't fix that — the header
      // group has to be pinned ahead of its container's own siblings too.
      if (componentNode && componentHost !== componentNode && componentHost.parentElement === componentNode) {
        componentNode.insertBefore(componentHost, componentNode.firstChild);
      }

      componentHost.classList.add("adapt-authoring-preview-inline-structured-header", "adapt-authoring-preview-inline-structured-header--component");

      const componentKey = (selectedComponent.settings.componentKey || "").toLowerCase();
      // Note: component.settings.properties always carries `subtitle`/
      // `instruction` keys (seeded as empty strings) for every component
      // regardless of type — createComponent() in adaptAuthoring.ts seeds
      // both unconditionally when a component is first added — so
      // hasOwnProperty on those keys is never a reliable signal here. Only
      // trust actual saved text or the real merged-schema check
      // (componentSubtitleSchemaSupport / componentInstructionSchemaSupport).
      const hasComponentInstruction =
        ((selectedComponent.settings.instruction || "").trim().length > 0) ||
        componentInstructionSchemaSupport[componentKey] === true;
      const hasComponentSubtitle =
        ((selectedComponent.settings.subtitle || "").trim().length > 0) ||
        componentSubtitleSchemaSupport[componentKey] === true;

      // Canonical order: title -> subtitle (laerdal-text-style components
      // only) -> body -> instruction, then whatever component-specific
      // markup (graphics, items, etc.) the real template renders after it.
      const componentFields = ensureOrderedInlineFields(componentHost, [
        {
          key: "title", kind: "pair", visible: true,
          value: selectedComponent.settings.title || "",
          containerSelector: ".component__title", containerClassName: "component__title",
          innerSelector: ".component__title-inner", innerClassName: "component__title-inner",
        },
        {
          key: "subtitle", kind: "flat", visible: hasComponentSubtitle,
          value: selectedComponent.settings.subtitle || "",
          selector: ".laerdal-text__subtitle", className: "laerdal-text__subtitle",
        },
        {
          key: "body", kind: "pair", visible: true,
          value: selectedComponent.settings.description || "",
          containerSelector: ".component__body", containerClassName: "component__body",
          innerSelector: ".component__body-inner", innerClassName: "component__body-inner",
        },
        {
          key: "instruction", kind: "pair", visible: hasComponentInstruction,
          value: selectedComponent.settings.instruction || "",
          containerSelector: ".component__instruction", containerClassName: "component__instruction",
          innerSelector: ".component__instruction-inner", innerClassName: "component__instruction-inner",
        },
      ]);

      if (componentFields.title) {
        makeEditable(componentFields.title, {
          level: "component",
          field: "title",
          placeholder: "Component title",
          value: selectedComponent.settings.title || "",
          pageId: selectedPage.id,
          articleId: selectedArticle.id,
          blockId: selectedBlock.id,
          componentId: selectedComponent.id,
          hiddenFromPreview: !selectedComponent.showDisplayTitleInPreview,
        });
      }
      if (componentFields.subtitle) {
        makeEditable(componentFields.subtitle, {
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
      if (componentFields.body) {
        makeEditable(componentFields.body, {
          level: "component",
          field: "body",
          placeholder: "Add component body",
          value: selectedComponent.settings.description || "",
          pageId: selectedPage.id,
          articleId: selectedArticle.id,
          blockId: selectedBlock.id,
          componentId: selectedComponent.id,
        });
      }
      if (componentFields.instruction) {
        makeEditable(componentFields.instruction, {
          level: "component",
          field: "instruction",
          placeholder: "Add component instruction",
          value: selectedComponent.settings.instruction || "",
          pageId: selectedPage.id,
          articleId: selectedArticle.id,
          blockId: selectedBlock.id,
          componentId: selectedComponent.id,
        });
      }

      // Make every OTHER Behaviour text field (item labels/titles, an MCQ
      // option's text, ...) directly editable in the canvas too — matched
      // by literal text content since, unlike title/body/instruction, these
      // have no canonical class to target. Editing here writes straight
      // back to the same settings.properties path the Behaviour accordion
      // itself edits (see the "data-preview-behaviour-path" branch in
      // onInput/onFocusOut below), so canvas and panel stay in sync both
      // ways. Only currently-VISIBLE items (their text literally present in
      // the DOM right now) can be matched this way — an item hidden behind
      // a "only one visible at a time" component (e.g. a narrative slide
      // that isn't the active one) has nothing to match until it's brought
      // into view.
      const behaviourSchemaForEditing = componentBehaviourSchemas[componentKey] as
        | Record<string, BehaviourFieldSchema>
        | undefined;
      if (behaviourSchemaForEditing) {
        const behaviourTextFields = collectBehaviourTextPaths(
          behaviourSchemaForEditing,
          asRecord(selectedComponent.settings.properties)
        );
        behaviourTextFields.forEach(({ path, value }) => {
          const trimmed = value.trim();
          if (!trimmed) return;

          const walker = doc.createTreeWalker(componentHost, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          let matchedElement: HTMLElement | null = null;
          while (node) {
            if (node.textContent && node.textContent.trim() === trimmed && node.parentElement) {
              matchedElement = node.parentElement;
              break;
            }
            node = walker.nextNode();
          }
          // Don't reclaim an element the header pipeline above already owns.
          if (!matchedElement || matchedElement.hasAttribute("data-preview-edit-field")) return;

          matchedElement.setAttribute("data-preview-edit-enabled", "true");
          matchedElement.setAttribute("data-preview-behaviour-path", path);
          matchedElement.setAttribute("data-preview-page-id", selectedPage.id);
          matchedElement.setAttribute("data-preview-article-id", selectedArticle.id);
          matchedElement.setAttribute("data-preview-block-id", selectedBlock.id);
          matchedElement.setAttribute("data-preview-component-id", selectedComponent.id);
          matchedElement.setAttribute("contenteditable", "true");
          matchedElement.setAttribute("spellcheck", "false");
          matchedElement.classList.add("adapt-authoring-preview-inline-editable");
        });
      }

      // Re-sync when the framework's OWN JS changes the DOM on its own —
      // a narrative/accordion/tabs component swapping which item is
      // visible when the user clicks its native nav/expand controls. That
      // happens with no React state change on our side, so nothing would
      // otherwise tell us the newly-visible item needs to become editable
      // too. Debounced via the same retry-frame ref: a transition can fire
      // a burst of mutations, so wait for them to settle before re-syncing.
      const componentObserver = new MutationObserver(() => {
        // Never re-sync while the user is actively typing — e.g. a browser
        // inserting/removing a stray <br> as a contenteditable field goes
        // empty is itself a childList mutation, and re-syncing mid-edit
        // would tear down and rebuild the very field that's focused,
        // losing focus and leaving state like canvasTitleLiveOverride
        // stuck (its clearing only happens on blur, which never fires
        // cleanly for a field that gets destroyed out from under it).
        if (isInlineEditingRef.current) return;
        if (inlineEditorSyncRetryFrameRef.current !== null) return;
        inlineEditorSyncRetryFrameRef.current = window.requestAnimationFrame(() => {
          inlineEditorSyncRetryFrameRef.current = null;
          syncPreviewInlineEditors();
        });
      });
      componentObserver.observe(componentHost, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-expanded", "aria-selected", "aria-hidden", "hidden"],
      });
      componentMutationObserverRef.current = componentObserver;

      return;
    }

    if (selectedBlock && selectedArticle && selectedPage) {
      const blockNode = doc.querySelector(`.block[data-adapt-id="${selectedBlock.id}"]`);
      // The real template nests .block__header INSIDE .block__inner (as its
      // first child, before .component__container) — NOT as a sibling
      // before .block__inner. .block__inner is what actually carries the
      // theme's horizontal padding, so a synthetic header built as a
      // sibling of it never inherits that padding and renders flush-left
      // instead of aligned with everything else. Root against .block__inner
      // itself (falling back to blockNode if it's somehow missing) so the
      // synthetic header lands in the exact same place a real one does.
      const blockInnerNode = (blockNode?.querySelector(".block__inner") as HTMLElement | null) ?? blockNode;
      const blockHeader = ensureHeaderInnerHost(
        blockInnerNode,
        ".block__header",
        "block__header",
        ".block__header-inner",
        "block__header-inner",
        [".component__container"]
      );
      if (!blockHeader) return;

      blockHeader.classList.add("adapt-authoring-preview-inline-structured-header");

      const blockFields = ensureOrderedInlineFields(blockHeader, [
        {
          key: "title", kind: "pair", visible: true, value: selectedBlock.title || "",
          containerSelector: ".block__title", containerClassName: "block__title",
          innerSelector: ".block__title-inner", innerClassName: "block__title-inner",
        },
        {
          key: "body", kind: "pair", visible: true, value: selectedBlock.description || "",
          containerSelector: ".block__body", containerClassName: "block__body",
          innerSelector: ".block__body-inner", innerClassName: "block__body-inner",
        },
        {
          key: "instruction", kind: "pair", visible: true, value: selectedBlock.instruction || "",
          containerSelector: ".block__instruction", containerClassName: "block__instruction",
          innerSelector: ".block__instruction-inner", innerClassName: "block__instruction-inner",
        },
      ]);

      if (blockFields.title) {
        makeEditable(blockFields.title, {
          level: "group",
          field: "title",
          placeholder: "Content Group title",
          value: selectedBlock.title || "",
          pageId: selectedPage.id,
          articleId: selectedArticle.id,
          blockId: selectedBlock.id,
          hiddenFromPreview: !selectedBlock.showDisplayTitleInPreview,
        });
      }
      if (blockFields.body) {
        makeEditable(blockFields.body, {
          level: "group",
          field: "body",
          placeholder: "Add content group body",
          value: selectedBlock.description || "",
          pageId: selectedPage.id,
          articleId: selectedArticle.id,
          blockId: selectedBlock.id,
        });
      }
      if (blockFields.instruction) {
        makeEditable(blockFields.instruction, {
          level: "group",
          field: "instruction",
          placeholder: "Add content group instruction",
          value: selectedBlock.instruction || "",
          pageId: selectedPage.id,
          articleId: selectedArticle.id,
          blockId: selectedBlock.id,
        });
      }
      return;
    }

    if (selectedArticle && selectedPage) {
      const articleNode = doc.querySelector(`.article[data-adapt-id="${selectedArticle.id}"]`);
      // Real template: .article__header is the ONLY thing inside
      // .article__inner (the next level's .block__container is a SIBLING
      // of .article__inner, not nested in it) — .article__inner is what
      // carries the theme's horizontal padding, so root against it
      // directly rather than the outer .article, or a synthetic header
      // renders flush-left instead of matching a real one.
      const articleInnerNode = (articleNode?.querySelector(".article__inner") as HTMLElement | null) ?? articleNode;
      const articleHeader = ensureHeaderInnerHost(
        articleInnerNode,
        ".article__header",
        "article__header",
        ".article__header-inner",
        "article__header-inner",
        []
      );
      if (!articleHeader) return;

      articleHeader.classList.add("adapt-authoring-preview-inline-structured-header");

      const articleFields = ensureOrderedInlineFields(articleHeader, [
        {
          key: "title", kind: "pair", visible: true, value: selectedArticle.title || "",
          containerSelector: ".article__title", containerClassName: "article__title",
          innerSelector: ".article__title-inner", innerClassName: "article__title-inner",
        },
        {
          key: "body", kind: "pair", visible: true, value: selectedArticle.description || "",
          containerSelector: ".article__body", containerClassName: "article__body",
          innerSelector: ".article__body-inner", innerClassName: "article__body-inner",
        },
        {
          key: "instruction", kind: "pair", visible: true, value: selectedArticle.instruction || "",
          containerSelector: ".article__instruction", containerClassName: "article__instruction",
          innerSelector: ".article__instruction-inner", innerClassName: "article__instruction-inner",
        },
      ]);

      if (articleFields.title) {
        makeEditable(articleFields.title, {
          level: "section",
          field: "title",
          placeholder: "Section title",
          value: selectedArticle.title || "",
          pageId: selectedPage.id,
          articleId: selectedArticle.id,
          hiddenFromPreview: !selectedArticle.showDisplayTitleInPreview,
        });
      }
      if (articleFields.body) {
        makeEditable(articleFields.body, {
          level: "section",
          field: "body",
          placeholder: "Add section body",
          value: selectedArticle.description || "",
          pageId: selectedPage.id,
          articleId: selectedArticle.id,
        });
      }
      if (articleFields.instruction) {
        makeEditable(articleFields.instruction, {
          level: "section",
          field: "instruction",
          placeholder: "Add section instruction",
          value: selectedArticle.instruction || "",
          pageId: selectedPage.id,
          articleId: selectedArticle.id,
        });
      }
      return;
    }

    if (selectedPage && !menuSelected) {
      const pageNode = doc.querySelector(`.page[data-adapt-id="${selectedPage.id}"]`);
      // Real template: .page__header is the ONLY thing inside .page__inner
      // (the next level's .article__container is a SIBLING of .page__inner,
      // not nested in it) — .page__inner is what carries the theme's
      // horizontal padding, so root against it directly rather than the
      // outer .page, or a synthetic header renders flush-left instead of
      // matching a real one.
      const pageInnerNode = (pageNode?.querySelector(".page__inner") as HTMLElement | null) ?? pageNode;
      const pageHeader = ensureHeaderInnerHost(
        pageInnerNode,
        ".page__header",
        "page__header",
        ".page__header-inner",
        "page__header-inner",
        []
      );
      if (!pageHeader) return;

      pageHeader.classList.add("adapt-authoring-preview-inline-structured-header");

      const pageFields = ensureOrderedInlineFields(pageHeader, [
        {
          key: "title", kind: "pair", visible: true, value: selectedPage.title || "",
          containerSelector: ".page__title", containerClassName: "page__title",
          innerSelector: ".page__title-inner", innerClassName: "page__title-inner",
        },
        {
          key: "subtitle", kind: "pair", visible: true, value: selectedPage.subtitle || "",
          containerSelector: ".page__subtitle", containerClassName: "page__subtitle",
          innerSelector: ".page__subtitle-inner", innerClassName: "page__subtitle-inner",
        },
        {
          key: "body", kind: "pair", visible: true, value: selectedPage.body || "",
          containerSelector: ".page__body", containerClassName: "page__body",
          innerSelector: ".page__body-inner", innerClassName: "page__body-inner",
        },
        {
          key: "instruction", kind: "pair", visible: true, value: selectedPage.instruction || "",
          containerSelector: ".page__instruction", containerClassName: "page__instruction",
          innerSelector: ".page__instruction-inner", innerClassName: "page__instruction-inner",
        },
      ]);

      // The page title is hidden by default CSS until content exists —
      // always reveal it while we're driving it as an editable placeholder.
      if (pageFields.title) {
        const titleContainer = pageFields.title.closest(".page__title") as HTMLElement | null;
        (titleContainer ?? pageFields.title).style.display = "";
      }

      if (pageFields.title) {
        makeEditable(pageFields.title, {
          level: "topic",
          field: "title",
          placeholder: "TOPIC TITLE",
          value: selectedPage.title || "",
          pageId: selectedPage.id,
          hiddenFromPreview: !selectedPage.showDisplayTitleInPreview,
        });
      }
      if (pageFields.subtitle) {
        makeEditable(pageFields.subtitle, {
          level: "topic",
          field: "subtitle",
          placeholder: "Add subtitle",
          value: selectedPage.subtitle || "",
          pageId: selectedPage.id,
        });
      }
      if (pageFields.body) {
        makeEditable(pageFields.body, {
          level: "topic",
          field: "body",
          placeholder: "Add page body",
          value: selectedPage.body || "",
          pageId: selectedPage.id,
        });
      }
      if (pageFields.instruction) {
        makeEditable(pageFields.instruction, {
          level: "topic",
          field: "instruction",
          placeholder: "Add page instruction",
          value: selectedPage.instruction || "",
          pageId: selectedPage.id,
        });
      }
    }
  }, [
    hasCanvasSelection,
    componentBehaviourSchemas,
    componentSubtitleSchemaSupport,
    componentInstructionSchemaSupport,
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
      key: string,
      // When set, a selector that isn't the exact data-preview-asset-key
      // match is treated as shared across every item in an array (e.g.
      // every narrative slide's image matches ".component__widget img") —
      // querySelector's first match would always land on item 0 regardless
      // of which item actually changed, so pick the Nth match instead.
      itemIndex: number | null = null
    ) => {
      if (!host) return;

      let image: HTMLImageElement | null = null;
      for (const selector of selectors) {
        if (itemIndex !== null && !selector.includes("data-preview-asset-key")) {
          const candidate = host.querySelectorAll(selector)[itemIndex] as HTMLImageElement | undefined;
          if (candidate) {
            image = candidate;
            break;
          }
          continue;
        }
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

    // Component-specific Behaviour text fields (an MCQ item's label, a
    // Graphic's alt text, ...) have no canonical class the way
    // title/body/instruction do, so there's no fixed selector to patch.
    // Instead, find whichever text node still literally holds the OLD value
    // and swap it for the new one — works regardless of the template, as
    // long as the field is rendered as plain visible text somewhere within
    // `host`. Returns false (a no-op, not an error) when nothing matches —
    // e.g. the field isn't currently visible (a hidden narrative slide) or
    // the real template renders it as HTML rather than plain text.
    const replaceTextInHost = (host: Element, oldValue: string, newValue: string): boolean => {
      const trimmedOld = oldValue.trim();
      if (!trimmedOld) return false;
      const walker = doc.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.textContent && node.textContent.trim() === trimmedOld) {
          node.textContent = newValue;
          return true;
        }
        node = walker.nextNode();
      }
      return false;
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

    // Applies an inline `color` (or clears it) across every element `selector`
    // matches within `host` — mirrors the Life v2 theme's setBlockColor /
    // setComponentColors, which use jQuery .css('color', …) against a fixed
    // selector set rather than a single element.
    const applyColorWithin = (host: ParentNode | null, selector: string, value: string) => {
      if (!host) return;
      host.querySelectorAll(selector).forEach((el) => {
        if (value) {
          (el as HTMLElement).style.color = value;
        } else {
          (el as HTMLElement).style.removeProperty("color");
        }
      });
    };

    if (selectedArticle) {
      const articleNode = doc.querySelector(`.article[data-adapt-id="${selectedArticle.id}"]`) as HTMLElement | null;
      const articleInner =
        (articleNode?.querySelector(".article__inner") as HTMLElement | null) ??
        (articleNode?.querySelector(".article__header-inner") as HTMLElement | null) ??
        articleNode;
      const articleHeaderNode =
        (articleNode?.querySelector(".article__header") as HTMLElement | null) ?? articleInner;
      const articleThemeSettings = getActiveThemeSettings(selectedArticle.themeSettings);
      const articleBackgroundImage = asRecord(articleThemeSettings._backgroundImage) as TopicResponsiveAssetMap;
      const articleBackgroundStyles = asRecord(articleThemeSettings._backgroundStyles);
      const articleBackgroundUrl = resolveAssetForPreview(pickResponsiveValue(articleBackgroundImage));
      applyBackgroundStyles(articleInner, articleBackgroundUrl, articleBackgroundStyles);

      const articleTextAlignment = asRecord(articleThemeSettings._textAlignment);
      applyTextAlignWithin(articleNode, ".article__title-inner", asString(articleTextAlignment._title));
      applyTextAlignWithin(articleNode, ".article__body-inner", asString(articleTextAlignment._body));
      applyTextAlignWithin(articleNode, ".article__instruction-inner", asString(articleTextAlignment._instruction));

      const articleHeader = asRecord(articleThemeSettings._articleHeader);
      const articleHeaderBackgroundImage = asRecord(articleHeader._backgroundImage) as TopicResponsiveAssetMap;
      const articleHeaderBackgroundStyles = asRecord(articleHeader._backgroundStyles);
      const articleHeaderBackgroundUrl = resolveAssetForPreview(pickResponsiveValue(articleHeaderBackgroundImage));
      applyBackgroundStyles(articleHeaderNode, articleHeaderBackgroundUrl, articleHeaderBackgroundStyles);
      const articleHeaderTextAlignment = asRecord(articleHeader._textAlignment);
      applyTextAlignWithin(articleHeaderNode, ".article__title-inner", asString(articleHeaderTextAlignment._title));
      applyTextAlignWithin(articleHeaderNode, ".article__body-inner", asString(articleHeaderTextAlignment._body));
      applyTextAlignWithin(articleHeaderNode, ".article__instruction-inner", asString(articleHeaderTextAlignment._instruction));
      const articleHeaderMinHeight = pickResponsiveNumber(asRecord(articleHeader._minimumHeights) as TopicMinimumHeights);
      if (typeof articleHeaderMinHeight === "number") {
        articleHeaderNode?.style.setProperty("min-height", `${articleHeaderMinHeight}px`);
      } else {
        articleHeaderNode?.style.removeProperty("min-height");
      }

      const articleResponsiveClasses = asRecord(articleThemeSettings._responsiveClasses) as TopicResponsiveClasses;
      const mergedArticleClasses = [
        asString(selectedArticle.classes),
        pickResponsiveClass(articleResponsiveClasses),
      ].filter(Boolean).join(" ");
      applyManagedClasses(articleNode, mergedArticleClasses);
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

      const blockTextAlignment = asRecord(blockThemeSettings._textAlignment);
      applyTextAlignWithin(blockNode, ".block__title-inner", asString(blockTextAlignment._title));
      applyTextAlignWithin(blockNode, ".block__body-inner", asString(blockTextAlignment._body));
      applyTextAlignWithin(blockNode, ".block__instruction-inner", asString(blockTextAlignment._instruction));

      // Matches ThemeBlockView.setBlockColor exactly: background on the block
      // root itself, font colour across title/body/instruction (+ the root),
      // header colour on the title only (applied last so it wins there).
      const blockColours = asRecord(blockThemeSettings._blockColors);
      const blockBgColor = asString(blockColours["block-bg-color"]);
      const blockFontColor = asString(blockColours["block-font-color"]);
      const blockHeaderColor = asString(blockColours["block-header-color"]);
      if (blockNode) {
        if (blockBgColor) blockNode.style.background = blockBgColor;
        else blockNode.style.removeProperty("background");
      }
      applyColorWithin(blockNode, ".block, .block__title, .block__body, .block__instruction", blockFontColor);
      if (blockHeaderColor) applyColorWithin(blockNode, ".block__title", blockHeaderColor);

      // Matches ThemeBlockView.processHeader: _blockHeader is the ONLY
      // source the real theme actually renders from for a block's header
      // text alignment/background/min-height — the top-level _textAlignment/
      // _backgroundImage/_minimumHeights above exist in the schema but are
      // never read by the theme. Applied last so it's what's actually
      // visible, matching real behaviour.
      const blockHeaderNode = (blockNode?.querySelector(".block__header") as HTMLElement | null) ?? blockInner;
      const blockHeader = asRecord(blockThemeSettings._blockHeader);
      const blockHeaderBackgroundImage = asRecord(blockHeader._backgroundImage) as TopicResponsiveAssetMap;
      const blockHeaderBackgroundStyles = asRecord(blockHeader._backgroundStyles);
      const blockHeaderBackgroundUrl = resolveAssetForPreview(pickResponsiveValue(blockHeaderBackgroundImage));
      applyBackgroundStyles(blockHeaderNode, blockHeaderBackgroundUrl, blockHeaderBackgroundStyles);
      const blockHeaderTextAlignment = asRecord(blockHeader._textAlignment);
      applyTextAlignWithin(blockHeaderNode, ".block__title-inner", asString(blockHeaderTextAlignment._title));
      applyTextAlignWithin(blockHeaderNode, ".block__body-inner", asString(blockHeaderTextAlignment._body));
      applyTextAlignWithin(blockHeaderNode, ".block__instruction-inner", asString(blockHeaderTextAlignment._instruction));
      const blockHeaderMinHeight = pickResponsiveNumber(asRecord(blockHeader._minimumHeights) as TopicMinimumHeights);
      if (typeof blockHeaderMinHeight === "number") {
        blockHeaderNode?.style.setProperty("min-height", `${blockHeaderMinHeight}px`);
      } else {
        blockHeaderNode?.style.removeProperty("min-height");
      }

      const paddingTopRaw = asString(blockThemeSettings._paddingTop);
      const paddingBottomRaw = asString(blockThemeSettings._paddingBottom);
      const vertAlign = asString(blockThemeSettings._componentVerticalAlignment);
      const horzAlign = asString(blockThemeSettings._componentHorizontalAlignment);
      const blockResponsiveClasses = asRecord(blockThemeSettings._responsiveClasses) as TopicResponsiveClasses;
      const mergedBlockClasses = [
        asString(selectedBlock.classes),
        pickResponsiveClass(blockResponsiveClasses),
        blockThemeSettings._isDividerBlock ? "is-divider-block" : "",
        paddingTopRaw && paddingTopRaw !== "default" ? `${paddingTopRaw}-padding-top` : "",
        paddingBottomRaw && paddingBottomRaw !== "default" ? `${paddingBottomRaw}-padding-bottom` : "",
        vertAlign === "center" ? "align-vert-center" : vertAlign === "bottom" ? "align-vert-bottom" : "",
        horzAlign === "center" ? "align-horz-center" : horzAlign === "right" ? "align-horz-right" : "",
      ].filter(Boolean).join(" ");
      applyManagedClasses(blockNode, mergedBlockClasses);
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

      const componentTextAlignment = asRecord(componentThemeSettings._textAlignment);
      applyTextAlignWithin(componentNode, ".component__title-inner", asString(componentTextAlignment._title));
      applyTextAlignWithin(componentNode, ".component__body-inner", asString(componentTextAlignment._body));
      applyTextAlignWithin(componentNode, ".component__instruction-inner", asString(componentTextAlignment._instruction));

      // Matches ThemeComponentView.setComponentColors: background (+ its
      // padding/border-radius side effect) on .component__inner; font colour
      // (or an auto white/black contrast colour when unset) across
      // component/title/body/instruction; header colour on the title only.
      const componentColours = asRecord(componentThemeSettings._componentColors);
      const componentBgColor = asString(componentColours["component-bg-color"]);
      const componentFontColor = asString(componentColours["component-font-color"]);
      const componentHeaderColor = asString(componentColours["component-header-color"]);
      if (componentInner) {
        if (componentBgColor) {
          componentInner.style.background = componentBgColor;
          componentInner.style.padding = "2rem";
          componentInner.style.borderRadius = "8px";
        } else {
          componentInner.style.removeProperty("background");
          componentInner.style.removeProperty("padding");
          componentInner.style.removeProperty("border-radius");
        }
      }
      const componentFontColorResolved =
        componentFontColor || (componentBgColor ? (isPreviewColorDark(componentBgColor) ? "white" : "black") : "");
      applyColorWithin(componentNode, ".component, .component__title, .component__body, .component__instruction", componentFontColorResolved);
      if (componentHeaderColor) applyColorWithin(componentNode, ".component__title", componentHeaderColor);

      const componentResponsiveClasses = asRecord(componentThemeSettings._responsiveClasses) as TopicResponsiveClasses;
      const mergedComponentClasses = [
        asString(selectedComponent.classes),
        pickResponsiveClass(componentResponsiveClasses),
      ].filter(Boolean).join(" ");
      applyManagedClasses(componentNode, mergedComponentClasses);

      // Live-patch any Behaviour-accordion asset field (graphic, poster,
      // etc.) the same way topic/section image fields already are — an
      // asset change should show up immediately, not only after a rebuild.
      const behaviourComponentKey = (selectedComponent.settings.componentKey || "").toLowerCase();
      const behaviourSchema = componentBehaviourSchemas[behaviourComponentKey] as
        | Record<string, BehaviourFieldSchema>
        | undefined;
      if (behaviourSchema) {
        const behaviourAssetPaths = collectBehaviourAssetPaths(
          behaviourSchema,
          asRecord(selectedComponent.settings.properties)
        );
        const previousAssetValues =
          previousBehaviourAssetValuesRef.current.componentId === selectedComponent.id
            ? previousBehaviourAssetValuesRef.current.values
            : {};
        const nextAssetValues: Record<string, string> = {};
        behaviourAssetPaths.forEach(({ path, value }) => {
          const resolvedUrl = value ? resolveAssetForPreview(value) : "";
          nextAssetValues[path] = resolvedUrl;

          const previousUrl = previousAssetValues[path];
          // Diff against THIS field's own previous src first — a generic
          // class selector (".component__widget img") matches every item's
          // image alike, so querySelector's first match would always land
          // on item 0 regardless of which item actually changed. Finding
          // the exact <img> that still shows the old URL targets the right
          // one no matter its position.
          if (componentInner && previousUrl && previousUrl !== resolvedUrl) {
            const existingImage = Array.from(componentInner.querySelectorAll("img")).find(
              (img) => img.getAttribute("src") === previousUrl
            ) as HTMLImageElement | undefined;
            if (existingImage) {
              if (resolvedUrl) {
                existingImage.src = resolvedUrl;
                existingImage.style.removeProperty("display");
              } else if (existingImage.getAttribute("data-preview-injected") === "true") {
                existingImage.parentElement?.remove();
              } else {
                existingImage.removeAttribute("src");
                existingImage.style.display = "none";
              }
              return;
            }
          }

          // No previous src to diff against (a brand-new item, or this
          // field never had an image before) — fall back to the generic
          // selector, index-aware so at least the Nth item is targeted
          // instead of always the first.
          const itemIndexMatch = path.match(/\[(\d+)\]/);
          const assetKey = `behaviour-asset-${path}`;
          upsertPreviewImage(
            componentInner,
            [
              `img[data-preview-asset-key="${assetKey}"]`,
              ".graphic__widget img",
              ".component__widget img",
            ],
            resolvedUrl,
            "",
            assetKey,
            itemIndexMatch ? Number(itemIndexMatch[1]) : null
          );
        });
        previousBehaviourAssetValuesRef.current = { componentId: selectedComponent.id, values: nextAssetValues };

        // Any other plain-string Behaviour field (an MCQ item's label, a
        // Graphic's alt text, ...) — diff against its previous value and
        // find/replace the literal old text in the canvas. There's no fixed
        // selector for these the way there is for title/body/instruction,
        // so this is best-effort: it silently does nothing when the old
        // text isn't currently visible in the DOM (see replaceTextInHost).
        const behaviourTextPaths = collectBehaviourTextPaths(
          behaviourSchema,
          asRecord(selectedComponent.settings.properties)
        );
        const previousTextValues =
          previousBehaviourTextValuesRef.current.componentId === selectedComponent.id
            ? previousBehaviourTextValuesRef.current.values
            : {};
        const nextTextValues: Record<string, string> = {};
        behaviourTextPaths.forEach(({ path, value }) => {
          nextTextValues[path] = value;
          const previousValue = previousTextValues[path];
          if (componentInner && previousValue !== undefined && previousValue !== value) {
            replaceTextInHost(componentInner, previousValue, value);
          }
        });
        previousBehaviourTextValuesRef.current = { componentId: selectedComponent.id, values: nextTextValues };
      }
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
    componentBehaviourSchemas,
    componentSubtitleSchemaSupport,
    contentPages,
    selectedArticleId,
    selectedBlockId,
    selectedComponentId,
    selectedPageId,
  ]);

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

    if (componentInstructionSchemaSupport[componentKey] !== undefined) {
      return;
    }

    let cancelled = false;
    void componentSchemaSupportsPropertiesField(componentKey, "instruction")
      .then((supported) => {
        if (cancelled) return;
        setComponentInstructionSchemaSupport((prev) => ({
          ...prev,
          [componentKey]: supported,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setComponentInstructionSchemaSupport((prev) => ({
          ...prev,
          [componentKey]: false,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    componentInstructionSchemaSupport,
    contentPages,
    selectedArticleId,
    selectedBlockId,
    selectedComponentId,
    selectedPageId,
  ]);

  useEffect(() => {
    if (!selectedPageId || !selectedArticleId || !selectedBlockId || !selectedComponentId) {
      return;
    }

    const page = contentPages.find((p) => p.id === selectedPageId);
    const article = page?.articles.find((a) => a.id === selectedArticleId);
    const block = article?.blocks.find((b) => b.id === selectedBlockId);
    const component = block?.components.find((c) => c.id === selectedComponentId);
    const componentKey = (component?.settings?.componentKey || "").toLowerCase();
    if (!componentKey || componentBehaviourSchemas[componentKey] !== undefined) {
      return;
    }

    let cancelled = false;
    void getComponentBehaviourSchema(componentKey)
      .then((schema) => {
        if (cancelled) return;
        setComponentBehaviourSchemas((prev) => ({ ...prev, [componentKey]: schema }));
      })
      .catch(() => {
        if (cancelled) return;
        setComponentBehaviourSchemas((prev) => ({ ...prev, [componentKey]: {} }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    componentBehaviourSchemas,
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

      // Our own editable overlay (title/body/instruction/behaviour-path
      // fields) always takes priority — clicking it must place a cursor,
      // never trigger the real template's own click handling (e.g. an
      // accordion/narrative header that toggles expand/collapse on click).
      // Everything else that looks like a genuine interactive control
      // (a nav/expand button, a tab, a real link — "js-" is the Adapt
      // framework's own convention for marking JS-driven elements) is left
      // completely alone: no preventDefault/stopPropagation, so the real
      // framework's narrative/accordion/tabs navigation keeps working while
      // a component is selected, instead of every click being swallowed by
      // selection handling.
      const isEditableOverlayTarget = !!target.closest("[data-preview-edit-enabled='true']");
      const isInteractiveControl =
        !isEditableOverlayTarget &&
        !!target.closest('button, [role="button"], [role="tab"], [class*="js-"], a[href], input, select, textarea, summary, [aria-expanded]');

      if (!isInteractiveControl) {
        event.preventDefault();
        event.stopPropagation();
      }

      // Clicking a header field (title/subtitle/body/instruction) to edit
      // it should always reveal the General accordion it lives in — but
      // merged in, never replacing whatever else the user already has
      // open. Clicking anywhere else in an already-selected node must leave
      // accordion state completely untouched (see the selection handlers'
      // isSameSelection guards below).
      if (target.closest("[data-preview-edit-field]")) {
        if (componentId) setOpenComponentAccordions((prev) => ({ ...prev, general: true }));
        else if (blockId) setOpenBlockAccordions((prev) => ({ ...prev, general: true }));
        else if (articleId) setOpenSectionAccordions((prev) => ({ ...prev, general: true }));
        else if (pageId) setOpenTopicAccordions((prev) => ({ ...prev, general: true }));
      }

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

    const cancelTitleAutoRevert = () => {
      if (titleAutoRevertTimeoutRef.current !== null) {
        window.clearTimeout(titleAutoRevertTimeoutRef.current);
        titleAutoRevertTimeoutRef.current = null;
      }
    };

    // Restores the pre-edit title (text + state) for a blank title — shared
    // by the immediate blur revert and the auto-revert timeout so both paths
    // resolve identically. Doesn't touch titleValidationWarning: callers
    // decide whether to show it (blur) or clear it (the timeout, whose job
    // is to end the warning's standard on-screen duration).
    const performTitleRevert = (
      target: HTMLElement,
      level: "topic" | "section" | "group" | "component",
      pageId: string,
      articleId: string | null,
      blockId: string | null,
      componentId: string | null
    ) => {
      cancelTitleAutoRevert();
      const page = contentPages.find((p) => p.id === pageId);
      const article = page && articleId ? page.articles.find((a) => a.id === articleId) : null;
      const block = article && blockId ? article.blocks.find((b) => b.id === blockId) : null;
      const component = block && componentId ? block.components.find((c) => c.id === componentId) : null;
      const fallbackTitle =
        level === "topic" ? page?.title ?? ""
        : level === "section" ? article?.title ?? ""
        : level === "group" ? block?.title ?? ""
        : component?.settings.title ?? "";
      const revertTitle = titleEditOriginalValueRef.current ?? fallbackTitle;

      target.textContent = revertTitle;
      target.classList.toggle("adapt-authoring-preview-inline-empty", revertTitle.trim().length === 0);
      setCanvasTitleLiveOverride(null);

      if (level === "topic" && pageId) {
        updatePageData(pageId, { title: revertTitle });
      } else if (level === "section" && pageId && articleId) {
        updateArticle(pageId, articleId, { title: revertTitle });
      } else if (level === "group" && pageId && articleId && blockId) {
        updateBlock(pageId, articleId, blockId, { title: revertTitle });
      } else if (level === "component" && pageId && articleId && blockId && componentId) {
        updateComponent(pageId, articleId, blockId, componentId, { settings: { title: revertTitle } });
      }

      titleEditOriginalValueRef.current = null;
    };

    const onInput = (event: Event) => {
      const origin = event.target as Element | null;
      const target = origin?.closest("[data-preview-edit-enabled='true']") as HTMLElement | null;
      if (!target) return;
      isInlineEditingRef.current = true;

      // A generic Behaviour item field (matched by text content, not a
      // fixed class — see syncPreviewInlineEditors) writes straight back to
      // its own settings.properties path, live, same as body/instruction.
      const behaviourPath = target.getAttribute("data-preview-behaviour-path");
      if (behaviourPath) {
        const pageId = target.getAttribute("data-preview-page-id");
        const articleId = target.getAttribute("data-preview-article-id");
        const blockId = target.getAttribute("data-preview-block-id");
        const componentId = target.getAttribute("data-preview-component-id");
        if (pageId && articleId && blockId && componentId) {
          updateComponentBehaviourProperty(pageId, articleId, blockId, componentId, behaviourPath, target.textContent || "");
        }
        return;
      }

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

      if (resolvedField === "title") {
        // Mirror the literal canvas text (including transient blank states)
        // into the right panel's title field live — the panel field reads
        // this in preference to real state, which never goes blank.
        setCanvasTitleLiveOverride(value);
        // Warn immediately, not just on blur — the user shouldn't have to
        // defocus the field to find out the title can't be blank. If they
        // leave it blank without blurring, auto-revert once the warning's
        // standard on-screen duration elapses.
        if (isBlankTitleValue(value)) {
          setTitleValidationWarning(TITLE_MANDATORY_MESSAGE);
          if (titleAutoRevertTimeoutRef.current === null) {
            titleAutoRevertTimeoutRef.current = window.setTimeout(() => {
              titleAutoRevertTimeoutRef.current = null;
              setTitleValidationWarning(null);
              performTitleRevert(target, level, pageId, articleId, blockId, componentId);
            }, TITLE_WARNING_DURATION_MS);
          }
        } else {
          setTitleValidationWarning(null);
          cancelTitleAutoRevert();
        }
      }

      if (level === "topic") {
        if (resolvedField === "title" && !isBlankTitleValue(value)) updatePageData(pageId, { title: value });
        if (resolvedField === "subtitle") updatePageData(pageId, { subtitle: value });
        if (resolvedField === "body") updatePageData(pageId, { body: value, description: value });
        if (resolvedField === "instruction") updatePageData(pageId, { instruction: value });
        return;
      }

      if (level === "section" && articleId) {
        if (field === "title" && !isBlankTitleValue(value)) updateArticle(pageId, articleId, { title: value });
        if (field === "body") updateArticle(pageId, articleId, { description: value });
        if (field === "instruction") updateArticle(pageId, articleId, { instruction: value });
        return;
      }

      if (level === "group" && articleId && blockId) {
        if (field === "title" && !isBlankTitleValue(value)) updateBlock(pageId, articleId, blockId, { title: value });
        if (field === "body") updateBlock(pageId, articleId, blockId, { description: value });
        if (field === "instruction") updateBlock(pageId, articleId, blockId, { instruction: value });
        return;
      }

      if (level === "component" && articleId && blockId && componentId) {
        if (field === "title" && !isBlankTitleValue(value)) {
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
      // Starting a fresh edit session should never carry over a pending
      // auto-revert from whatever was previously focused.
      cancelTitleAutoRevert();

      if (target.hasAttribute("data-preview-behaviour-path")) {
        titleEditOriginalValueRef.current = null;
        return;
      }

      const field = target.getAttribute("data-preview-edit-field");
      const level = target.getAttribute("data-preview-node-level") as
        | "topic"
        | "section"
        | "group"
        | "component"
        | null;
      const resolvedField = level === "topic" ? resolveTopicField(target, field as "title" | "subtitle" | "body" | "instruction" | null) : field;
      if (resolvedField !== "title" || !level) {
        titleEditOriginalValueRef.current = null;
        return;
      }

      const pageId = target.getAttribute("data-preview-page-id");
      const articleId = target.getAttribute("data-preview-article-id");
      const blockId = target.getAttribute("data-preview-block-id");
      const componentId = target.getAttribute("data-preview-component-id");
      const page = contentPages.find((p) => p.id === pageId);
      const article = page && articleId ? page.articles.find((a) => a.id === articleId) : null;
      const block = article && blockId ? article.blocks.find((b) => b.id === blockId) : null;
      const component = block && componentId ? block.components.find((c) => c.id === componentId) : null;
      titleEditOriginalValueRef.current =
        level === "topic" ? page?.title ?? ""
        : level === "section" ? article?.title ?? ""
        : level === "group" ? block?.title ?? ""
        : component?.settings.title ?? "";
    };

    const onFocusOut = (event: FocusEvent) => {
      const origin = event.target as Element | null;
      const target = origin?.closest("[data-preview-edit-enabled='true']") as HTMLElement | null;
      if (!target) return;
      isInlineEditingRef.current = false;

      if (target.hasAttribute("data-preview-behaviour-path")) {
        return;
      }

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

      if (resolvedField === "title" && isBlankTitleValue(normalizedValue)) {
        // Blurring while blank reverts immediately — the warning still shows
        // and fades on its own standard timer (see the titleValidationWarning
        // auto-dismiss effect), it just no longer has to wait to also revert.
        setTitleValidationWarning(TITLE_MANDATORY_MESSAGE);
        performTitleRevert(target, level, pageId, articleId, blockId, componentId);
        return;
      }

      if (resolvedField === "title") {
        cancelTitleAutoRevert();
        titleEditOriginalValueRef.current = null;
        setCanvasTitleLiveOverride(null);
      }

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
      cancelTitleAutoRevert();
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

  // Defensive reset: canvasTitleLiveOverride is a single shared value (only
  // one node's title can ever be live-edited at once), cleared on blur —
  // but if a title's contenteditable element ever gets torn down without a
  // clean blur (e.g. mid-edit while a mutation observer forces a rebuild),
  // that clear can be skipped and the override would keep showing on
  // whichever OTHER node's title field renders next, regardless of level.
  // Selecting a different node should always start from real state.
  useEffect(() => {
    setCanvasTitleLiveOverride(null);
  }, [selectedPageId, selectedArticleId, selectedBlockId, selectedComponentId, menuSelected]);

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
    if (inlineEditorSyncRetryFrameRef.current !== null) {
      window.cancelAnimationFrame(inlineEditorSyncRetryFrameRef.current);
      inlineEditorSyncRetryFrameRef.current = null;
    }
    componentMutationObserverRef.current?.disconnect();
    componentMutationObserverRef.current = null;
    if (copiedTopicIdResetTimerRef.current !== null) {
      window.clearTimeout(copiedTopicIdResetTimerRef.current);
      copiedTopicIdResetTimerRef.current = null;
    }
    if (copiedSectionIdResetTimerRef.current !== null) {
      window.clearTimeout(copiedSectionIdResetTimerRef.current);
      copiedSectionIdResetTimerRef.current = null;
    }
    if (copiedBlockIdResetTimerRef.current !== null) {
      window.clearTimeout(copiedBlockIdResetTimerRef.current);
      copiedBlockIdResetTimerRef.current = null;
    }
    if (copiedComponentIdResetTimerRef.current !== null) {
      window.clearTimeout(copiedComponentIdResetTimerRef.current);
      copiedComponentIdResetTimerRef.current = null;
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

  function handleCopyBlockId(blockId: string) {
    if (!blockId) return;
    const afterCopy = () => {
      setCopiedBlockId(blockId);
      if (copiedBlockIdResetTimerRef.current !== null) {
        window.clearTimeout(copiedBlockIdResetTimerRef.current);
      }
      copiedBlockIdResetTimerRef.current = window.setTimeout(() => {
        setCopiedBlockId((current) => (current === blockId ? null : current));
        copiedBlockIdResetTimerRef.current = null;
      }, 2000);
    };
    const fallbackCopy = () => {
      const helperTextArea = document.createElement("textarea");
      helperTextArea.value = blockId;
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
      void navigator.clipboard.writeText(blockId).then(afterCopy).catch(fallbackCopy);
      return;
    }
    fallbackCopy();
  }

  function handleCopyComponentId(componentId: string) {
    if (!componentId) return;
    const afterCopy = () => {
      setCopiedComponentId(componentId);
      if (copiedComponentIdResetTimerRef.current !== null) {
        window.clearTimeout(copiedComponentIdResetTimerRef.current);
      }
      copiedComponentIdResetTimerRef.current = window.setTimeout(() => {
        setCopiedComponentId((current) => (current === componentId ? null : current));
        copiedComponentIdResetTimerRef.current = null;
      }, 2000);
    };
    const fallbackCopy = () => {
      const helperTextArea = document.createElement("textarea");
      helperTextArea.value = componentId;
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
      void navigator.clipboard.writeText(componentId).then(afterCopy).catch(fallbackCopy);
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

  function toggleBlockAccordion(
    id: "general" | "availability" | "accessibility" | "extensions" | "theme" | "advanced",
    triggerEl?: HTMLButtonElement
  ) {
    const container = rightPanelScrollRef.current;
    const topBefore = container && triggerEl ? triggerEl.getBoundingClientRect().top : null;

    setOpenBlockAccordions((prev) => ({
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

  function toggleComponentAccordion(
    id: "general" | "behaviour" | "availability" | "accessibility" | "extensions" | "theme" | "advanced",
    triggerEl?: HTMLButtonElement
  ) {
    const container = rightPanelScrollRef.current;
    const topBefore = container && triggerEl ? triggerEl.getBoundingClientRect().top : null;

    setOpenComponentAccordions((prev) => ({
      general: false,
      behaviour: false,
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
    // Re-selecting the SAME article (e.g. clicking into its canvas text to
    // edit it while it's already selected) must not reset the accordions —
    // only a genuine change of selection should snap back to the defaults,
    // otherwise whatever the user had expanded collapses every time they
    // click to type.
    const isSameSelection = selectedArticleId === articleId && selectedPageId === pageId;
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedSubPageId(null);
    setSelectedBlockId(null);
    setSelectedComponentId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("article");
    if (!isSameSelection) {
      setOpenSectionAccordions(DEFAULT_SECTION_ACCORDIONS);
    }
    if (source === "leftPanel") {
      queuePreviewScrollFromLeftPanel({ level: "section", id: articleId });
    }
  }

  function handleBlockSelect(pageId: string, articleId: string, blockId: string, source: SelectionSource = "internal") {
    const isSameSelection = selectedBlockId === blockId && selectedArticleId === articleId && selectedPageId === pageId;
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedSubPageId(null);
    setSelectedBlockId(blockId);
    setSelectedComponentId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("block");
    if (!isSameSelection) {
      setOpenBlockAccordions(DEFAULT_BLOCK_ACCORDIONS);
    }
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
    const isSameSelection = selectedPageId === pageId && !menuSelected;
    setSelectedPageId(pageId);
    setMenuSelected(false);
    setSelectedSubPageId(null);
    setSelectedArticleId(null);
    setSelectedBlockId(null);
    setSelectedComponentId(null);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("page");
    if (!isSameSelection) {
      setOpenTopicAccordions(DEFAULT_TOPIC_ACCORDIONS);
    }
    if (source === "leftPanel") {
      queuePreviewScrollFromLeftPanel({ level: "topic", id: pageId });
    }
  }

  // Mirrors panel title keystrokes into the canvas instantly, including
  // transient blank text — the real title state is only ever committed for
  // non-blank values (see TopicTitleField), so without this the canvas would
  // keep showing the last non-blank character typed instead of going blank
  // in step with the panel field.
  function writeLiveTitleDraftToCanvas(
    level: "topic" | "section" | "group" | "component",
    ids: { pageId: string; articleId?: string; blockId?: string; componentId?: string },
    value: string
  ) {
    const doc = previewFrameRef.current?.contentDocument;
    if (!doc) return;
    const selector = [
      `[data-preview-edit-field="title"]`,
      `[data-preview-node-level="${level}"]`,
      `[data-preview-page-id="${ids.pageId}"]`,
      ids.articleId ? `[data-preview-article-id="${ids.articleId}"]` : "",
      ids.blockId ? `[data-preview-block-id="${ids.blockId}"]` : "",
      ids.componentId ? `[data-preview-component-id="${ids.componentId}"]` : "",
    ].join("");
    const target = doc.querySelector(selector) as HTMLElement | null;
    if (!target) return;
    target.textContent = value;
    target.classList.toggle("adapt-authoring-preview-inline-empty", value.trim().length === 0);
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

    if (target.scope === "contentGroupHeaderBackground") {
      updateBlockThemeSettings(pageId, target.articleId, target.blockId, (current) => ({
        ...current,
        _blockHeader: {
          ...asRecord(current._blockHeader),
          _backgroundImage: {
            ...asRecord(asRecord(current._blockHeader)._backgroundImage),
            [target.bp]: assetLink,
          },
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

    if (target.scope === "componentProperty") {
      updateComponentBehaviourProperty(pageId, target.articleId, target.blockId, target.componentId, target.path, assetLink);
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

  function handleOpenSaveAsTemplate(level: "topic" | "section" | "group" | "component", objectId: string) {
    setSaveTemplateError(null);
    setSaveTemplateTarget({ level, objectId });
  }

  async function handleConfirmSaveAsTemplate(data: {
    title: string;
    description: string;
    isShared: boolean;
    shareWithUsers: string[];
  }) {
    if (!saveTemplateTarget) return;
    setIsSavingTemplate(true);
    setSaveTemplateError(null);
    try {
      await saveContentAsTemplate({
        level: saveTemplateTarget.level === "group" ? "contentGroup" : saveTemplateTarget.level,
        objectId: saveTemplateTarget.objectId,
        courseId,
        title: data.title,
        description: data.description,
        isShared: data.isShared,
        shareWithUsers: data.shareWithUsers,
      });
      setSaveTemplateTarget(null);
    } catch (error) {
      console.error("Failed to save template", error);
      setSaveTemplateError(error instanceof Error ? error.message : "Failed to save template.");
    } finally {
      setIsSavingTemplate(false);
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

  // Writes a single schema-driven Behaviour field (arbitrary dotted/bracketed
  // path into settings.properties) against the freshest state, the same way
  // updateComponentThemeSettings does for themeSettings — used by both the
  // Behaviour accordion's field editors and its asset-picker fields.
  function updateComponentBehaviourProperty(
    pageId: string,
    articleId: string,
    blockId: string,
    componentId: string,
    path: string,
    value: unknown
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
                                const currentProperties = asRecord(c.settings.properties);
                                const nextProperties = setBehaviourPath(currentProperties, path, value);
                                return {
                                  ...c,
                                  settings: { ...c.settings, properties: nextProperties },
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
            _requireCompletionOf: isNaN(Number(page.requireCompletionOf)) ? -1 : Number(page.requireCompletionOf),
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
            _ariaLevel: isNaN(Number(page.ariaLevel)) ? 0 : Number(page.ariaLevel),
            _isA11yCompletionDescriptionEnabled: page.isA11yCompletionDescriptionEnabled,
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
            _isA11yCompletionDescriptionEnabled: article.isA11yCompletionDescriptionEnabled,
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
            displayTitle: block.showDisplayTitleInPreview ? block.title : "",
            body: block.description,
            description: block.description,
            instruction: block.instruction,
            themeSettings: block.themeSettings ?? {},
            _isOptional: block.isOptional,
            _isAvailable: block.isAvailable,
            _isHidden: block.isHidden,
            _isVisible: block.isVisible,
            _requireCompletionOf: isNaN(Number(block.requireCompletionOf)) ? -1 : Number(block.requireCompletionOf),
            _classes: block.classes,
            _onScreen: {
              _isEnabled: !!block.onScreen?._isEnabled,
              _classes: block.onScreen?._classes || "",
              _percentInviewVertical:
                typeof block.onScreen?._percentInviewVertical === "number"
                  ? block.onScreen._percentInviewVertical
                  : 50,
            },
            _ariaLevel: isNaN(Number(block.ariaLevel)) ? 0 : Number(block.ariaLevel),
            _isA11yCompletionDescriptionEnabled: block.isA11yCompletionDescriptionEnabled,
            _extensions: block.extensions ?? {},
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
          // Instruction/subtitle can now be edited either via the Behaviour
          // accordion (writes to settings.properties) or (for legacy data)
          // via settings.instruction/subtitle directly — properties wins
          // since that's what the Behaviour accordion's schema-driven fields
          // read from and write to.
          const instructionValue =
            typeof existingProperties.instruction === "string"
              ? existingProperties.instruction
              : settings.instruction ?? "";
          const subtitleValue =
            typeof existingProperties.subtitle === "string" ? existingProperties.subtitle : settings.subtitle;
          await updateStructureNode("component", id, {
            title: settings.title ?? "",
            displayTitle: component.showDisplayTitleInPreview ? settings.title ?? "" : "",
            body: settings.description ?? "",
            description: settings.description ?? "",
            instruction: instructionValue,
            themeSettings: component.themeSettings ?? {},
            properties: {
              ...existingProperties,
              instruction: instructionValue,
              ...(subtitleValue !== undefined ? { subtitle: subtitleValue } : {}),
            },
            _classes: component.classes,
            _isOptional: component.isOptional,
            _isAvailable: component.isAvailable,
            _isHidden: component.isHidden,
            _isVisible: component.isVisible,
            _isResetOnRevisit: component.isResetOnRevisit || "false",
            _ariaLevel: isNaN(Number(component.ariaLevel)) ? 0 : Number(component.ariaLevel),
            _isA11yCompletionDescriptionEnabled: component.isA11yCompletionDescriptionEnabled,
            _onScreen: {
              _isEnabled: !!component.onScreen?._isEnabled,
              _classes: component.onScreen?._classes || "",
              _percentInviewVertical:
                typeof component.onScreen?._percentInviewVertical === "number"
                  ? component.onScreen._percentInviewVertical
                  : 50,
            },
            _extensions: component.extensions ?? {},
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
    const isSameSelection =
      selectedComponentId === componentId &&
      selectedBlockId === blockId &&
      selectedArticleId === articleId &&
      selectedPageId === pageId;
    setSelectedPageId(pageId);
    setSelectedArticleId(articleId);
    setSelectedBlockId(blockId);
    setSelectedComponentId(componentId);
    setHasCanvasSelection(true);
    setRightPanelOpen(true);
    setRightPanelType("component");
    if (!isSameSelection) {
      setOpenComponentAccordions(DEFAULT_COMPONENT_ACCORDIONS);
    }
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

                {titleValidationWarning && (
                  <div className="absolute inset-x-4 top-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b] shadow-sm flex items-start justify-between gap-3">
                    <span>{titleValidationWarning}</span>
                    <button
                      type="button"
                      onClick={() => setTitleValidationWarning(null)}
                      className="shrink-0 text-[#991b1b] hover:opacity-70"
                      aria-label="Dismiss"
                    >
                      ×
                    </button>
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
                            <TopicTitleField
                              value={canvasTitleLiveOverride ?? page.title}
                              onChange={(value) => updatePageData(page.id, { title: value })}
                              onDraftChange={(value) => writeLiveTitleDraftToCanvas("topic", { pageId: page.id }, value)}
                            />
                            <TopicCheckbox
                              label="Display title in preview"
                              checked={!!page.showDisplayTitleInPreview}
                              onChange={(checked) => updatePageData(page.id, { showDisplayTitleInPreview: checked })}
                            />
                            <button
                              type="button"
                              onClick={() => handleOpenSaveAsTemplate("topic", page.id)}
                              className="mt-1 px-3 py-1.5 text-[13px] font-medium text-[#2d6fa8] border border-[#2d6fa8] rounded-md hover:bg-[#eef4fa] transition-colors cursor-pointer self-start"
                            >
                              Save as template
                            </button>
                          </TopicAccordion>

                          <TopicAccordion title="Availability & Progression" open={!!openTopicAccordions.availability} onToggle={(triggerEl) => toggleTopicAccordion("availability", triggerEl)}>
                            <TopicCheckbox label="Is this optional?" checked={!!page.isOptional} onChange={(checked) => updatePageData(page.id, { isOptional: checked })} />
                            <TopicCheckbox label="Is this available?" checked={!!page.isAvailable} onChange={(checked) => updatePageData(page.id, { isAvailable: checked })} />
                            <TopicCheckbox label="Is this hidden?" checked={!!page.isHidden} onChange={(checked) => updatePageData(page.id, { isHidden: checked })} />
                            <TopicCheckbox label="Is this visible?" checked={!!page.isVisible} onChange={(checked) => updatePageData(page.id, { isVisible: checked })} />
                            <TopicTextInput label="Duration" value={page.duration} onChange={(value) => updatePageData(page.id, { duration: value })} />
                            <TopicTextInput label="Button link text" value={page.linkText} onChange={(value) => updatePageData(page.id, { linkText: value })} />
                            <TopicSelect label="Menu lock type" value={page.lockType} onChange={(value) => updatePageData(page.id, { lockType: value })} options={LOCK_TYPE_OPTIONS} emptyOptionLabel="" />
                            <TopicNumberStepper label="Require completion of" min={-1} value={page.requireCompletionOf} onChange={(value) => updatePageData(page.id, { requireCompletionOf: value })} />
                            <TopicTextInput
                              label="Locked by"
                              value={page.lockedBy.join(", ")}
                              onChange={(value) => updatePageData(page.id, {
                                lockedBy: value.split(",").map((item) => item.trim()).filter(Boolean),
                              })}
                            />
                          </TopicAccordion>

                          <TopicAccordion title="Accessibility" open={!!openTopicAccordions.accessibility} onToggle={(triggerEl) => toggleTopicAccordion("accessibility", triggerEl)}>
                            <TopicCheckbox
                              label="Enable accessibility completion description"
                              checked={page.isA11yCompletionDescriptionEnabled}
                              onChange={(checked) => updatePageData(page.id, { isA11yCompletionDescriptionEnabled: checked })}
                            />
                            <TopicNumberStepper label="ARIA level" min={0} value={page.ariaLevel} onChange={(value) => updatePageData(page.id, { ariaLevel: value })} />
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

                            {/* The Vanilla theme has no header-graphic support at all —
                                only Life, Life v2 and Custom Theme render a page header
                                image. Hiding it for Vanilla avoids exposing a setting
                                that would silently do nothing in the real preview. */}
                            {!courseTheme.toLowerCase().includes("vanilla") && (
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
                            )}

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
                          const articleTextAlignment = asRecord(articleThemeSettings._textAlignment);
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
                                <TopicTitleField
                                  value={canvasTitleLiveOverride ?? article.title}
                                  onChange={(value) => updateArticle(page!.id, article.id, { title: value })}
                                  onDraftChange={(value) => writeLiveTitleDraftToCanvas("section", { pageId: page!.id, articleId: article.id }, value)}
                                />
                                <TopicCheckbox
                                  label="Display title in preview"
                                  checked={!!article.showDisplayTitleInPreview}
                                  onChange={(checked) => updateArticle(page!.id, article.id, { showDisplayTitleInPreview: checked })}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleOpenSaveAsTemplate("section", article.id)}
                                  className="mt-1 px-3 py-1.5 text-[13px] font-medium text-[#2d6fa8] border border-[#2d6fa8] rounded-md hover:bg-[#eef4fa] transition-colors cursor-pointer self-start"
                                >
                                  Save as template
                                </button>
                              </TopicAccordion>

                              <TopicAccordion title="Availability & Progression" open={!!openSectionAccordions.availability} onToggle={(triggerEl) => toggleSectionAccordion("availability", triggerEl)}>
                                <TopicCheckbox label="Is this optional?" checked={!!article.isOptional} onChange={(checked) => updateArticle(page!.id, article.id, { isOptional: checked })} />
                                <TopicCheckbox label="Is this available?" checked={!!article.isAvailable} onChange={(checked) => updateArticle(page!.id, article.id, { isAvailable: checked })} />
                                <TopicCheckbox label="Is this hidden?" checked={!!article.isHidden} onChange={(checked) => updateArticle(page!.id, article.id, { isHidden: checked })} />
                                <TopicCheckbox label="Is this visible?" checked={!!article.isVisible} onChange={(checked) => updateArticle(page!.id, article.id, { isVisible: checked })} />
                                <TopicNumberStepper label="Require completion of" min={-1} value={article.requireCompletionOf} onChange={(value) => updateArticle(page!.id, article.id, { requireCompletionOf: value })} />
                              </TopicAccordion>

                              <TopicAccordion title="Accessibility" open={!!openSectionAccordions.accessibility} onToggle={(triggerEl) => toggleSectionAccordion("accessibility", triggerEl)}>
                                <TopicCheckbox
                                  label="Enable accessibility completion description"
                                  checked={article.isA11yCompletionDescriptionEnabled}
                                  onChange={(checked) => updateArticle(page!.id, article.id, { isA11yCompletionDescriptionEnabled: checked })}
                                />
                                <TopicNumberStepper label="ARIA level" min={0} value={article.ariaLevel} onChange={(value) => updateArticle(page!.id, article.id, { ariaLevel: value })} />
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
                                  <TopicSelect label="Title alignment" value={asString(articleTextAlignment._title)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _textAlignment: { ...asRecord(current._textAlignment), _title: value } }))} options={TEXT_ALIGN_OPTIONS} />
                                  <TopicSelect label="Body alignment" value={asString(articleTextAlignment._body)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _textAlignment: { ...asRecord(current._textAlignment), _body: value } }))} options={TEXT_ALIGN_OPTIONS} />
                                  <TopicSelect label="Instruction alignment" value={asString(articleTextAlignment._instruction)} onChange={(value) => updateArticleThemeSettings(page!.id, article.id, (current) => ({ ...current, _textAlignment: { ...asRecord(current._textAlignment), _instruction: value } }))} options={TEXT_ALIGN_OPTIONS} />
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
                                {/* Vanilla has no article-header support at all — only Life,
                                    Life v2 and Custom Theme render one. */}
                                {!courseTheme.toLowerCase().includes("vanilla") && (
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
                                )}
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
                      <div className="px-4 py-4 border-b border-[#e6ebf0] space-y-2">
                        {(() => {
                          const blockThemeSettings = getActiveThemeSettings(block.themeSettings);
                          const blockBackgroundImage = asRecord(blockThemeSettings._backgroundImage);
                          const blockBackgroundStyles = asRecord(blockThemeSettings._backgroundStyles);
                          const blockMinimumHeights = asRecord(blockThemeSettings._minimumHeights);
                          const blockColours = asRecord(blockThemeSettings._blockColors);
                          const blockResponsiveClasses = asRecord(blockThemeSettings._responsiveClasses);
                          const blockHeader = asRecord(blockThemeSettings._blockHeader);
                          const blockHeaderTextAlignment = asRecord(blockHeader._textAlignment);
                          const blockHeaderBackgroundImage = asRecord(blockHeader._backgroundImage);
                          const blockHeaderBackgroundStyles = asRecord(blockHeader._backgroundStyles);
                          const blockHeaderMinimumHeights = asRecord(blockHeader._minimumHeights);
                          const isCopied = copiedBlockId === block.id;

                          return (
                            <>
                              <TopicAccordion title="General" open={!!openBlockAccordions.general} onToggle={(triggerEl) => toggleBlockAccordion("general", triggerEl)}>
                                <div className="flex flex-col gap-1.5">
                                  <TopicFieldLabel>CONTENT GROUP ID</TopicFieldLabel>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      aria-label="Copy content group id"
                                      title="Copy content group id"
                                      onClick={() => handleCopyBlockId(block.id)}
                                      className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer ${isCopied ? "bg-[var(--life-positive-050)] border-[var(--life-positive-500)] text-[var(--life-positive-500)]" : "bg-white border-[var(--life-neutral-300)] text-[var(--life-base-black)] hover:bg-[#f8fafc] hover:border-[var(--life-primary-500)] hover:text-[var(--life-primary-500)]"}`}
                                    >
                                      <span className="truncate text-left">{block.id}</span>
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
                                  <p className="text-xs text-[#6b7280]">Unique identifier for this content group. Click to copy.</p>
                                </div>
                                <TopicTitleField
                                  value={canvasTitleLiveOverride ?? block.title}
                                  onChange={(value) => updateBlock(page!.id, article!.id, block.id, { title: value })}
                                  onDraftChange={(value) => writeLiveTitleDraftToCanvas("group", { pageId: page!.id, articleId: article!.id, blockId: block.id }, value)}
                                />
                                <TopicCheckbox
                                  label="Display title in preview"
                                  checked={!!block.showDisplayTitleInPreview}
                                  onChange={(checked) => updateBlock(page!.id, article!.id, block.id, { showDisplayTitleInPreview: checked })}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleOpenSaveAsTemplate("group", block.id)}
                                  className="mt-1 px-3 py-1.5 text-[13px] font-medium text-[#2d6fa8] border border-[#2d6fa8] rounded-md hover:bg-[#eef4fa] transition-colors cursor-pointer self-start"
                                >
                                  Save as template
                                </button>
                              </TopicAccordion>

                              <TopicAccordion title="Availability & Progression" open={!!openBlockAccordions.availability} onToggle={(triggerEl) => toggleBlockAccordion("availability", triggerEl)}>
                                <TopicCheckbox label="Is this optional?" checked={!!block.isOptional} onChange={(checked) => updateBlock(page!.id, article!.id, block.id, { isOptional: checked })} />
                                <TopicCheckbox label="Is this available?" checked={!!block.isAvailable} onChange={(checked) => updateBlock(page!.id, article!.id, block.id, { isAvailable: checked })} />
                                <TopicCheckbox label="Is this hidden?" checked={!!block.isHidden} onChange={(checked) => updateBlock(page!.id, article!.id, block.id, { isHidden: checked })} />
                                <TopicCheckbox label="Is this visible?" checked={!!block.isVisible} onChange={(checked) => updateBlock(page!.id, article!.id, block.id, { isVisible: checked })} />
                                <TopicNumberStepper label="Require completion of" min={-1} value={block.requireCompletionOf} onChange={(value) => updateBlock(page!.id, article!.id, block.id, { requireCompletionOf: value })} />
                              </TopicAccordion>

                              <TopicAccordion title="Accessibility" open={!!openBlockAccordions.accessibility} onToggle={(triggerEl) => toggleBlockAccordion("accessibility", triggerEl)}>
                                <TopicCheckbox
                                  label="Enable accessibility completion description"
                                  checked={block.isA11yCompletionDescriptionEnabled}
                                  onChange={(checked) => updateBlock(page!.id, article!.id, block.id, { isA11yCompletionDescriptionEnabled: checked })}
                                />
                                <TopicNumberStepper label="ARIA level" min={0} value={block.ariaLevel} onChange={(value) => updateBlock(page!.id, article!.id, block.id, { ariaLevel: value })} />
                              </TopicAccordion>

                              <TopicAccordion title="Extensions" open={!!openBlockAccordions.extensions} onToggle={(triggerEl) => toggleBlockAccordion("extensions", triggerEl)}>
                                {(() => {
                                  const extensionKeySet = new Set<string>();
                                  contentPages.forEach((contentPage) => {
                                    contentPage.articles.forEach((art) => {
                                      art.blocks.forEach((blk) => {
                                        Object.keys(asRecord(blk.extensions)).forEach((key) => {
                                          if (key.trim()) extensionKeySet.add(key);
                                        });
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
                                        const extensionConfig = asRecord(block.extensions)[extensionKey];
                                        const extensionJson = JSON.stringify(extensionConfig ?? {}, null, 2);
                                        return (
                                          <TopicNestedAccordion key={`${block.id}-extension-${extensionKey}`} title={extensionKey}>
                                            <div className="flex flex-col gap-1.5">
                                              <TopicFieldLabel>Content group-level settings</TopicFieldLabel>
                                              <textarea
                                                key={`${block.id}-extension-json-${extensionKey}`}
                                                defaultValue={extensionJson}
                                                onBlur={(event) => {
                                                  try {
                                                    const rawInput = event.target.value.trim();
                                                    const parsed = JSON.parse(rawInput || "{}");
                                                    updateBlock(page!.id, article!.id, block.id, {
                                                      extensions: { ...asRecord(block.extensions), [extensionKey]: parsed },
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

                              <TopicAccordion title="Theme settings" open={!!openBlockAccordions.theme} onToggle={(triggerEl) => toggleBlockAccordion("theme", triggerEl)}>
                                <TopicNestedAccordion title="Text alignment">
                                  <TopicSelect label="Title alignment" value={asString(asRecord(blockThemeSettings._textAlignment)._title)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _textAlignment: { ...asRecord(current._textAlignment), _title: value } }))} options={TEXT_ALIGN_OPTIONS} />
                                  <TopicSelect label="Body alignment" value={asString(asRecord(blockThemeSettings._textAlignment)._body)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _textAlignment: { ...asRecord(current._textAlignment), _body: value } }))} options={TEXT_ALIGN_OPTIONS} />
                                  <TopicSelect label="Instruction alignment" value={asString(asRecord(blockThemeSettings._textAlignment)._instruction)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _textAlignment: { ...asRecord(current._textAlignment), _instruction: value } }))} options={TEXT_ALIGN_OPTIONS} />
                                </TopicNestedAccordion>
                                <TopicNestedAccordion title="Block background image">
                                  <div className="flex flex-col gap-1.5">
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_xlarge" compact value={asString(blockBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_xlarge" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_xlarge" }, initialValue: asString(blockBackgroundImage._xlarge), title: "Block background image (_xlarge)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_xlarge" })} />
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_large" compact value={asString(blockBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_large" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_large" }, initialValue: asString(blockBackgroundImage._large), title: "Block background image (_large)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_large" })} />
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_medium" compact value={asString(blockBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_medium" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_medium" }, initialValue: asString(blockBackgroundImage._medium), title: "Block background image (_medium)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_medium" })} />
                                    <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_small" compact value={asString(blockBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_small" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_small" }, initialValue: asString(blockBackgroundImage._small), title: "Block background image (_small)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupBackground", articleId: article!.id, blockId: block.id, bp: "_small" })} />
                                  </div>
                                </TopicNestedAccordion>
                                <TopicNestedAccordion title="Block background image styles">
                                  <TopicSelect label={BG_REPEAT_LABEL} value={asString(blockBackgroundStyles._backgroundRepeat)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundRepeat: value } }))} options={BG_REPEAT_OPTIONS} emptyOptionLabel="" />
                                  <TopicSelect label={BG_SIZE_LABEL} value={asString(blockBackgroundStyles._backgroundSize)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundSize: value } }))} options={BG_SIZE_OPTIONS} emptyOptionLabel="" />
                                  <TopicSelect label={BG_POSITION_LABEL} value={asString(blockBackgroundStyles._backgroundPosition)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _backgroundStyles: { ...asRecord(current._backgroundStyles), _backgroundPosition: value } }))} options={BG_POSITION_OPTIONS} emptyOptionLabel="" />
                                </TopicNestedAccordion>
                                {/* Vanilla has no block-header support at all — only Life,
                                    Life v2 and Custom Theme render one. */}
                                {!courseTheme.toLowerCase().includes("vanilla") && (
                                  <TopicNestedAccordion title="Block header">
                                    <TopicNestedAccordion title="Text alignment">
                                      <TopicSelect label="Title alignment" value={asString(blockHeaderTextAlignment._title)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockHeader: { ...asRecord(current._blockHeader), _textAlignment: { ...asRecord(asRecord(current._blockHeader)._textAlignment), _title: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                                      <TopicSelect label="Body alignment" value={asString(blockHeaderTextAlignment._body)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockHeader: { ...asRecord(current._blockHeader), _textAlignment: { ...asRecord(asRecord(current._blockHeader)._textAlignment), _body: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                                      <TopicSelect label="Instruction alignment" value={asString(blockHeaderTextAlignment._instruction)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockHeader: { ...asRecord(current._blockHeader), _textAlignment: { ...asRecord(asRecord(current._blockHeader)._textAlignment), _instruction: value } } }))} options={TEXT_ALIGN_OPTIONS} />
                                    </TopicNestedAccordion>
                                    <TopicNestedAccordion title="Block header background image">
                                      <div className="flex flex-col gap-1.5">
                                        <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_xlarge" compact value={asString(blockHeaderBackgroundImage._xlarge)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_xlarge" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_xlarge" }, initialValue: asString(blockHeaderBackgroundImage._xlarge), title: "Block header background image (_xlarge)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_xlarge" })} />
                                        <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_large" compact value={asString(blockHeaderBackgroundImage._large)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_large" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_large" }, initialValue: asString(blockHeaderBackgroundImage._large), title: "Block header background image (_large)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_large" })} />
                                        <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_medium" compact value={asString(blockHeaderBackgroundImage._medium)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_medium" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_medium" }, initialValue: asString(blockHeaderBackgroundImage._medium), title: "Block header background image (_medium)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_medium" })} />
                                        <TopicAssetField resolveAssetPreviewUrl={resolveTopicAssetPreviewUrl} label="_small" compact value={asString(blockHeaderBackgroundImage._small)} onPickAsset={() => setTopicAssetPickerTarget({ scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_small" })} onPickExternal={() => setTopicExternalAssetTarget({ pageId: page!.id, target: { scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_small" }, initialValue: asString(blockHeaderBackgroundImage._small), title: "Block header background image (_small)" })} onClear={() => clearTopicAssetSelection(page!.id, { scope: "contentGroupHeaderBackground", articleId: article!.id, blockId: block.id, bp: "_small" })} />
                                      </div>
                                    </TopicNestedAccordion>
                                    <TopicNestedAccordion title="Block header background image styles">
                                      <TopicSelect label={BG_REPEAT_LABEL} value={asString(blockHeaderBackgroundStyles._backgroundRepeat)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockHeader: { ...asRecord(current._blockHeader), _backgroundStyles: { ...asRecord(asRecord(current._blockHeader)._backgroundStyles), _backgroundRepeat: value } } }))} options={BG_REPEAT_OPTIONS} emptyOptionLabel="" />
                                      <TopicSelect label={BG_SIZE_LABEL} value={asString(blockHeaderBackgroundStyles._backgroundSize)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockHeader: { ...asRecord(current._blockHeader), _backgroundStyles: { ...asRecord(asRecord(current._blockHeader)._backgroundStyles), _backgroundSize: value } } }))} options={BG_SIZE_OPTIONS} emptyOptionLabel="" />
                                      <TopicSelect label={BG_POSITION_LABEL} value={asString(blockHeaderBackgroundStyles._backgroundPosition)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockHeader: { ...asRecord(current._blockHeader), _backgroundStyles: { ...asRecord(asRecord(current._blockHeader)._backgroundStyles), _backgroundPosition: value } } }))} options={BG_POSITION_OPTIONS} emptyOptionLabel="" />
                                    </TopicNestedAccordion>
                                    <TopicNestedAccordion title="Block header minimum height">
                                      <TopicTextInput label="_xlarge" type="number" value={String(asNumberOrEmpty(blockHeaderMinimumHeights._xlarge))} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockHeader: { ...asRecord(current._blockHeader), _minimumHeights: { ...asRecord(asRecord(current._blockHeader)._minimumHeights), _xlarge: parseNumberishInput(value) } } }))} />
                                      <TopicTextInput label="_large" type="number" value={String(asNumberOrEmpty(blockHeaderMinimumHeights._large))} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockHeader: { ...asRecord(current._blockHeader), _minimumHeights: { ...asRecord(asRecord(current._blockHeader)._minimumHeights), _large: parseNumberishInput(value) } } }))} />
                                      <TopicTextInput label="_medium" type="number" value={String(asNumberOrEmpty(blockHeaderMinimumHeights._medium))} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockHeader: { ...asRecord(current._blockHeader), _minimumHeights: { ...asRecord(asRecord(current._blockHeader)._minimumHeights), _medium: parseNumberishInput(value) } } }))} />
                                      <TopicTextInput label="_small" type="number" value={String(asNumberOrEmpty(blockHeaderMinimumHeights._small))} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockHeader: { ...asRecord(current._blockHeader), _minimumHeights: { ...asRecord(asRecord(current._blockHeader)._minimumHeights), _small: parseNumberishInput(value) } } }))} />
                                    </TopicNestedAccordion>
                                  </TopicNestedAccordion>
                                )}
                                <TopicNestedAccordion title="Block minimum height">
                                  <TopicTextInput label="_xlarge" type="number" value={String(asNumberOrEmpty(blockMinimumHeights._xlarge))} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _minimumHeights: { ...asRecord(current._minimumHeights), _xlarge: parseNumberishInput(value) } }))} />
                                  <TopicTextInput label="_large" type="number" value={String(asNumberOrEmpty(blockMinimumHeights._large))} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _minimumHeights: { ...asRecord(current._minimumHeights), _large: parseNumberishInput(value) } }))} />
                                  <TopicTextInput label="_medium" type="number" value={String(asNumberOrEmpty(blockMinimumHeights._medium))} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _minimumHeights: { ...asRecord(current._minimumHeights), _medium: parseNumberishInput(value) } }))} />
                                  <TopicTextInput label="_small" type="number" value={String(asNumberOrEmpty(blockMinimumHeights._small))} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _minimumHeights: { ...asRecord(current._minimumHeights), _small: parseNumberishInput(value) } }))} />
                                </TopicNestedAccordion>
                                <TopicCheckbox
                                  label="Divider block?"
                                  checked={asBoolean(blockThemeSettings._isDividerBlock)}
                                  onChange={(checked) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _isDividerBlock: checked }))}
                                />
                                <TopicNestedAccordion title="Block colours">
                                  <TopicColorField label="Background colour" value={asString(blockColours["block-bg-color"])} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockColors: { ...asRecord(current._blockColors), "block-bg-color": value } }))} paletteRows={THEME_COLOUR_PALETTE_ROWS[courseTheme] ?? LIFE_PALETTE_ROWS} />
                                  <TopicColorField label="Font colour" value={asString(blockColours["block-font-color"])} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockColors: { ...asRecord(current._blockColors), "block-font-color": value } }))} paletteRows={THEME_COLOUR_PALETTE_ROWS[courseTheme] ?? LIFE_PALETTE_ROWS} />
                                  <TopicColorField label="Header colour" value={asString(blockColours["block-header-color"])} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _blockColors: { ...asRecord(current._blockColors), "block-header-color": value } }))} paletteRows={THEME_COLOUR_PALETTE_ROWS[courseTheme] ?? LIFE_PALETTE_ROWS} />
                                </TopicNestedAccordion>
                                <TopicSelect label="Spacing top" value={asString(blockThemeSettings._paddingTop)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _paddingTop: value }))} options={SPACING_OPTIONS} emptyOptionLabel="Default" />
                                <TopicSelect label="Spacing bottom" value={asString(blockThemeSettings._paddingBottom)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _paddingBottom: value }))} options={SPACING_OPTIONS} emptyOptionLabel="Default" />
                                <TopicSelect label="Set the vertical alignment of the child component(s)" value={asString(blockThemeSettings._componentVerticalAlignment)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _componentVerticalAlignment: value }))} options={VERTICAL_ALIGN_OPTIONS} emptyOptionLabel="" />
                                <TopicSelect label="Set the horizontal alignment of the child component(s)" value={asString(blockThemeSettings._componentHorizontalAlignment)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _componentHorizontalAlignment: value }))} options={HORIZONTAL_ALIGN_OPTIONS} emptyOptionLabel="" />
                                <TopicNestedAccordion title="On-screen classes">
                                  <TopicCheckbox
                                    label="Enabled?"
                                    checked={asBoolean(block.onScreen?._isEnabled)}
                                    onChange={(checked) => updateBlock(page!.id, article!.id, block.id, { onScreen: { ...(block.onScreen ?? {}), _isEnabled: checked } })}
                                  />
                                  <TopicSelect
                                    label="Classes"
                                    value={asString(block.onScreen?._classes)}
                                    onChange={(value) => updateBlock(page!.id, article!.id, block.id, { onScreen: { ...(block.onScreen ?? {}), _classes: value } })}
                                    options={ONSCREEN_CLASS_OPTIONS}
                                    emptyOptionLabel=""
                                  />
                                  <TopicTextInput
                                    label="Percent in view"
                                    type="number"
                                    value={String(asNumberOrEmpty(block.onScreen?._percentInviewVertical))}
                                    onChange={(value) => updateBlock(page!.id, article!.id, block.id, { onScreen: { ...(block.onScreen ?? {}), _percentInviewVertical: parseNumberishInput(value) } })}
                                  />
                                </TopicNestedAccordion>
                              </TopicAccordion>

                              <TopicAccordion title="Advanced Settings" open={!!openBlockAccordions.advanced} onToggle={(triggerEl) => toggleBlockAccordion("advanced", triggerEl)}>
                                <TopicTextInput label="Content group class" value={block.classes} onChange={(value) => updateBlock(page!.id, article!.id, block.id, { classes: value })} />
                                <TopicNestedAccordion title="Responsive classes">
                                  <TopicTextInput label="_xlarge" value={asString(blockResponsiveClasses._xlarge)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _xlarge: value } }))} />
                                  <TopicTextInput label="_large" value={asString(blockResponsiveClasses._large)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _large: value } }))} />
                                  <TopicTextInput label="_medium" value={asString(blockResponsiveClasses._medium)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _medium: value } }))} />
                                  <TopicTextInput label="_small" value={asString(blockResponsiveClasses._small)} onChange={(value) => updateBlockThemeSettings(page!.id, article!.id, block.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _small: value } }))} />
                                </TopicNestedAccordion>
                              </TopicAccordion>
                            </>
                          );
                        })()}
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
                        {component && page && article && block ? (() => {
                          const componentThemeSettings = getActiveThemeSettings(component.themeSettings);
                          const componentTextAlignment = asRecord(componentThemeSettings._textAlignment);
                          const componentColours = asRecord(componentThemeSettings._componentColors);
                          const componentResponsiveClasses = asRecord(componentThemeSettings._responsiveClasses);
                          const componentProperties = asRecord(component.settings.properties);
                          const behaviourSchema = componentBehaviourSchemas[(component.settings.componentKey || "").toLowerCase()];
                          const isCopied = copiedComponentId === component.id;

                          return (
                            <div className="flex flex-col gap-2.5">
                              <TopicAccordion title="General" open={!!openComponentAccordions.general} onToggle={(triggerEl) => toggleComponentAccordion("general", triggerEl)}>
                                <div className="flex flex-col gap-1.5">
                                  <TopicFieldLabel>COMPONENT ID</TopicFieldLabel>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      aria-label="Copy component id"
                                      title="Copy component id"
                                      onClick={() => handleCopyComponentId(component.id)}
                                      className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer ${isCopied ? "bg-[var(--life-positive-050)] border-[var(--life-positive-500)] text-[var(--life-positive-500)]" : "bg-white border-[var(--life-neutral-300)] text-[var(--life-base-black)] hover:bg-[#f8fafc] hover:border-[var(--life-primary-500)] hover:text-[var(--life-primary-500)]"}`}
                                    >
                                      <span className="truncate text-left">{component.id}</span>
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
                                  <p className="text-xs text-[#6b7280]">Unique identifier for this component. Click to copy.</p>
                                </div>
                                <TopicTitleField
                                  value={canvasTitleLiveOverride ?? component.settings.title ?? ""}
                                  onChange={(value) => updateComponent(page.id, article.id, block.id, component.id, { settings: { ...component.settings, title: value } })}
                                  onDraftChange={(value) => writeLiveTitleDraftToCanvas("component", { pageId: page.id, articleId: article.id, blockId: block.id, componentId: component.id }, value)}
                                />
                                <TopicCheckbox
                                  label="Display title in preview"
                                  checked={!!component.showDisplayTitleInPreview}
                                  onChange={(checked) => updateComponent(page.id, article.id, block.id, component.id, { showDisplayTitleInPreview: checked })}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleOpenSaveAsTemplate("component", component.id)}
                                  className="mt-1 px-3 py-1.5 text-[13px] font-medium text-[#2d6fa8] border border-[#2d6fa8] rounded-md hover:bg-[#eef4fa] transition-colors cursor-pointer self-start"
                                >
                                  Save as template
                                </button>
                              </TopicAccordion>

                              <TopicAccordion title="Behaviour" open={!!openComponentAccordions.behaviour} onToggle={(triggerEl) => toggleComponentAccordion("behaviour", triggerEl)}>
                                {(() => {
                                  if (behaviourSchema === undefined) {
                                    return <p className="text-[13px] text-[var(--life-neutral-300)]">Loading component properties…</p>;
                                  }
                                  const fieldKeys = Object.keys(behaviourSchema).filter((key) => {
                                    const fieldSchema = behaviourSchema[key] as BehaviourFieldSchema;
                                    return fieldSchema && !fieldSchema.editorOnly && !COMPONENT_BEHAVIOUR_EXCLUDED_FIELDS.has(key);
                                  });
                                  if (!fieldKeys.length) {
                                    return <p className="text-[13px] text-[var(--life-neutral-300)]">This component has no additional behaviour properties.</p>;
                                  }
                                  const handleBehaviourChange = (path: string, value: unknown) => {
                                    updateComponentBehaviourProperty(page.id, article.id, block.id, component.id, path, value);
                                  };
                                  const behaviourAssetContext: BehaviourAssetContext = {
                                    pageId: page.id,
                                    articleId: article.id,
                                    blockId: block.id,
                                    componentId: component.id,
                                    resolveAssetPreviewUrl: resolveTopicAssetPreviewUrl,
                                    onPickAsset: (assetPath) => setTopicAssetPickerTarget({ scope: "componentProperty", articleId: article.id, blockId: block.id, componentId: component.id, path: assetPath }),
                                    onPickExternal: (assetPath, currentValue) => setTopicExternalAssetTarget({ pageId: page.id, target: { scope: "componentProperty", articleId: article.id, blockId: block.id, componentId: component.id, path: assetPath }, initialValue: currentValue, title: "Select External Asset" }),
                                    onClear: (assetPath) => clearTopicAssetSelection(page.id, { scope: "componentProperty", articleId: article.id, blockId: block.id, componentId: component.id, path: assetPath }),
                                  };
                                  return fieldKeys.map((key) => {
                                    const fieldSchema = behaviourSchema[key] as BehaviourFieldSchema;
                                    const fieldValue = componentProperties[key] !== undefined ? componentProperties[key] : fieldSchema.default;
                                    return (
                                      <BehaviourField key={key} path={key} fieldName={key} fieldSchema={fieldSchema} value={fieldValue} onChange={handleBehaviourChange} assetContext={behaviourAssetContext} />
                                    );
                                  });
                                })()}
                              </TopicAccordion>

                              <TopicAccordion title="Availability & Progression" open={!!openComponentAccordions.availability} onToggle={(triggerEl) => toggleComponentAccordion("availability", triggerEl)}>
                                <TopicCheckbox label="Is this optional?" checked={!!component.isOptional} onChange={(checked) => updateComponent(page.id, article.id, block.id, component.id, { isOptional: checked })} />
                                <TopicCheckbox label="Is this available?" checked={!!component.isAvailable} onChange={(checked) => updateComponent(page.id, article.id, block.id, component.id, { isAvailable: checked })} />
                                <TopicCheckbox label="Is this hidden?" checked={!!component.isHidden} onChange={(checked) => updateComponent(page.id, article.id, block.id, component.id, { isHidden: checked })} />
                                <TopicCheckbox label="Is this visible?" checked={!!component.isVisible} onChange={(checked) => updateComponent(page.id, article.id, block.id, component.id, { isVisible: checked })} />
                                <TopicSelect
                                  label="Reset when revisited?"
                                  value={component.isResetOnRevisit || "false"}
                                  onChange={(value) => updateComponent(page.id, article.id, block.id, component.id, { isResetOnRevisit: value })}
                                  options={RESET_ON_REVISIT_OPTIONS}
                                />
                              </TopicAccordion>

                              <TopicAccordion title="Accessibility" open={!!openComponentAccordions.accessibility} onToggle={(triggerEl) => toggleComponentAccordion("accessibility", triggerEl)}>
                                <TopicCheckbox
                                  label="Enable accessibility completion description"
                                  checked={component.isA11yCompletionDescriptionEnabled}
                                  onChange={(checked) => updateComponent(page.id, article.id, block.id, component.id, { isA11yCompletionDescriptionEnabled: checked })}
                                />
                                <TopicNumberStepper label="ARIA level" min={0} value={component.ariaLevel} onChange={(value) => updateComponent(page.id, article.id, block.id, component.id, { ariaLevel: value })} />
                              </TopicAccordion>

                              <TopicAccordion title="Extensions" open={!!openComponentAccordions.extensions} onToggle={(triggerEl) => toggleComponentAccordion("extensions", triggerEl)}>
                                {(() => {
                                  const extensionKeySet = new Set<string>();
                                  contentPages.forEach((contentPage) => {
                                    contentPage.articles.forEach((art) => {
                                      art.blocks.forEach((blk) => {
                                        blk.components.forEach((cmp) => {
                                          Object.keys(asRecord(cmp.extensions)).forEach((key) => {
                                            if (key.trim()) extensionKeySet.add(key);
                                          });
                                        });
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
                                        const extensionConfig = asRecord(component.extensions)[extensionKey];
                                        const extensionJson = JSON.stringify(extensionConfig ?? {}, null, 2);
                                        return (
                                          <TopicNestedAccordion key={`${component.id}-extension-${extensionKey}`} title={extensionKey}>
                                            <div className="flex flex-col gap-1.5">
                                              <TopicFieldLabel>Component-level settings</TopicFieldLabel>
                                              <textarea
                                                key={`${component.id}-extension-json-${extensionKey}`}
                                                defaultValue={extensionJson}
                                                onBlur={(event) => {
                                                  try {
                                                    const rawInput = event.target.value.trim();
                                                    const parsed = JSON.parse(rawInput || "{}");
                                                    updateComponent(page.id, article.id, block.id, component.id, {
                                                      extensions: { ...asRecord(component.extensions), [extensionKey]: parsed },
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

                              <TopicAccordion title="Theme settings" open={!!openComponentAccordions.theme} onToggle={(triggerEl) => toggleComponentAccordion("theme", triggerEl)}>
                                <TopicNestedAccordion title="Text alignment">
                                  <TopicSelect label="Title alignment" value={asString(componentTextAlignment._title)} onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({ ...current, _textAlignment: { ...asRecord(current._textAlignment), _title: value } }))} options={TEXT_ALIGN_OPTIONS} />
                                  <TopicSelect label="Body alignment" value={asString(componentTextAlignment._body)} onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({ ...current, _textAlignment: { ...asRecord(current._textAlignment), _body: value } }))} options={TEXT_ALIGN_OPTIONS} />
                                  <TopicSelect label="Instruction alignment" value={asString(componentTextAlignment._instruction)} onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({ ...current, _textAlignment: { ...asRecord(current._textAlignment), _instruction: value } }))} options={TEXT_ALIGN_OPTIONS} />
                                </TopicNestedAccordion>
                                <TopicNestedAccordion title="Component colours">
                                  <TopicColorField label="Background colour" value={asString(componentColours["component-bg-color"])} onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({ ...current, _componentColors: { ...asRecord(current._componentColors), "component-bg-color": value } }))} paletteRows={THEME_COLOUR_PALETTE_ROWS[courseTheme] ?? LIFE_PALETTE_ROWS} />
                                  <TopicColorField label="Font colour" value={asString(componentColours["component-font-color"])} onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({ ...current, _componentColors: { ...asRecord(current._componentColors), "component-font-color": value } }))} paletteRows={THEME_COLOUR_PALETTE_ROWS[courseTheme] ?? LIFE_PALETTE_ROWS} />
                                  <TopicColorField label="Header colour" value={asString(componentColours["component-header-color"])} onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({ ...current, _componentColors: { ...asRecord(current._componentColors), "component-header-color": value } }))} paletteRows={THEME_COLOUR_PALETTE_ROWS[courseTheme] ?? LIFE_PALETTE_ROWS} />
                                </TopicNestedAccordion>
                                <TopicNestedAccordion title="On-screen classes">
                                  <TopicCheckbox
                                    label="Enabled?"
                                    checked={asBoolean(component.onScreen?._isEnabled)}
                                    onChange={(checked) => updateComponent(page.id, article.id, block.id, component.id, { onScreen: { ...(component.onScreen ?? {}), _isEnabled: checked } })}
                                  />
                                  <TopicSelect
                                    label="Classes"
                                    value={asString(component.onScreen?._classes)}
                                    onChange={(value) => updateComponent(page.id, article.id, block.id, component.id, { onScreen: { ...(component.onScreen ?? {}), _classes: value } })}
                                    options={ONSCREEN_CLASS_OPTIONS}
                                    emptyOptionLabel=""
                                  />
                                  <TopicTextInput
                                    label="Percent in view"
                                    type="number"
                                    value={String(asNumberOrEmpty(component.onScreen?._percentInviewVertical))}
                                    onChange={(value) => updateComponent(page.id, article.id, block.id, component.id, { onScreen: { ...(component.onScreen ?? {}), _percentInviewVertical: parseNumberishInput(value) } })}
                                  />
                                </TopicNestedAccordion>
                              </TopicAccordion>

                              <TopicAccordion title="Advanced Settings" open={!!openComponentAccordions.advanced} onToggle={(triggerEl) => toggleComponentAccordion("advanced", triggerEl)}>
                                <TopicTextInput label="Component class" value={component.classes} onChange={(value) => updateComponent(page.id, article.id, block.id, component.id, { classes: value })} />
                                <TopicNestedAccordion title="Responsive classes">
                                  <TopicTextInput label="_xlarge" value={asString(componentResponsiveClasses._xlarge)} onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _xlarge: value } }))} />
                                  <TopicTextInput label="_large" value={asString(componentResponsiveClasses._large)} onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _large: value } }))} />
                                  <TopicTextInput label="_medium" value={asString(componentResponsiveClasses._medium)} onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _medium: value } }))} />
                                  <TopicTextInput label="_small" value={asString(componentResponsiveClasses._small)} onChange={(value) => updateComponentThemeSettings(page.id, article.id, block.id, component.id, (current) => ({ ...current, _responsiveClasses: { ...asRecord(current._responsiveClasses), _small: value } }))} />
                                </TopicNestedAccordion>
                              </TopicAccordion>
                            </div>
                          );
                        })() : null}
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

        {saveTemplateTarget && (
          <SaveAsTemplateModal
            levelLabel={SAVE_TEMPLATE_LEVEL_LABELS[saveTemplateTarget.level]}
            isSaving={isSavingTemplate}
            errorMessage={saveTemplateError}
            onCancel={() => {
              if (isSavingTemplate) return;
              setSaveTemplateTarget(null);
              setSaveTemplateError(null);
            }}
            onDone={handleConfirmSaveAsTemplate}
          />
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
