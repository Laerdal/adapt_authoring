import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useAuth, isSuperAdmin } from "../context/AuthContext";
import AiAssistant from "../components/common/AiAssistant";
import CourseStructureMapView from "../components/course/CourseStructureMapView";
import CourseStructureTree from "../components/course/CourseStructureTree";
import AddComponentDrawer from "../components/course/AddComponentDrawer";
import { StoryboardWorkspace } from "../components/storyboard";
import CommonCourseTopBarRow from "../components/course/CommonCourseTopBarRow";
import { getCourseBootstrapData, publishCoursePackage } from "../api/adaptAuthoring";
import { useCourseStructure } from "../hooks/useCourseStructure";
import { STRUCTURE_LABELS } from "../types/structure";
import { CourseOverviewPage } from "./setup/courseOverviewPage";
import SelectThemePage from "./setup/themePage";
import { MenuPage } from "./setup/menuPage";
import { NavigationPage } from "./setup/navigationPage";
import { AccessibilityPage } from "./setup/accessibilityPage";
import { TechnicalSettingPage } from "./setup/technicalSettingPage";
import { TrackingAnalyticsPage } from "./setup/trackingAnalyticsPage";
import { LearnerExperiencePanel } from "./setup/learnerExperiencePage";
import { UnsavedChangesModal } from "./setup/unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./setup/useUnsavedChangesNavigationGuard";
import { CompletionProgressPage } from "./setup/completionProgressPage";
import { CdnDeploymentPage } from "./setup/cdnDeploymentPage";
import ExportMenu, { ExportStatusPopup } from "../components/importExport/Export";
import ExportPdfPage from "../components/importExport/ExportPdfPage";
import { runExportSourceAction } from "../helpers/importExportHelper";
import { PreflightValidatorPage } from "./setup/preflightValidatorPage";
import PublishMenuButton from "../components/publish/PublishMenuButton";
import PublishCourseDialog, { type PublishCoursePhase } from "../components/publish/PublishCourseDialog";
import ExportDialog from "../components/common/ExportDialog";

const ICON_BASE = "/new/assets/icons";

function SidebarMaskIcon({ file, className }: { file: string; className?: string }) {
  const iconPath = `${ICON_BASE}/${file}`;
  return (
    <span
      aria-hidden="true"
      className={className ?? "block w-[18px] h-[18px] bg-current"}
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

/* -- Nav items -- */
const NAV_ITEMS = [
  {
    id: "heading-course-setup",
    label: "Course Setup",
    heading: true,
    icon: null,
  },
  {
    id: "overview",
    label: "Course Overview",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="overview-icon.svg" />
    ),
  },
  {
    id: "structure",
    label: "Course Structure",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="structure-icon.svg" />
    ),
  },
  {
    id: "heading-design",
    label: "Design & Appearance",
    heading: true,
    icon: null,
  },
  {
    id: "theme",
    label: "Theme",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="theme-icon.svg" />
    ),
  },
  {
    id: "menu",
    label: "Menu",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="menu-icon.svg" />
    ),
  },
  {
    id: "heading-learning-flow",
    label: "Learning Flow",
    heading: true,
    icon: null,
  },
  {
    id: "navigation",
    label: "Navigation",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="navigation-icon.svg" />
    ),
  },
  {
    id: "completion",
    label: "Completion & Progress",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="completion-icon.svg" />
    ),
  },
  {
    id: "learner-experience",
    label: "Learner Experience",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="learner-icon.svg" />
    ),
  },
  {
    id: "heading-insights",
    label: "Insights",
    heading: true,
    icon: null,
  },
  {
    id: "tracking",
    label: "Tracking & Analytics",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="tracking-icon.svg" />
    ),
  },
  {
    id: "heading-advanced",
    label: "Advanced",
    heading: true,
    icon: null,
  },
  {
    id: "accessibility",
    label: "Accessibility",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="preview-icon.svg" />
    ),
  },
  {
    id: "technical-settings",
    label: "Technical Settings",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="setting-icon.svg" />
    ),
  },
  {
    id: "heading-action",
    label: "Actions",
    heading: true,
    icon: null,
  },
  {
    id: "cdn-deployment",
    label: "CDN Deployment",
    guarded: true,
    icon: (
      <SidebarMaskIcon file="cdn-icon.svg" />
    ),
  },
  {
    id: "translation",
    label: "Translation",
    icon: (
      <SidebarMaskIcon file="translation-icon.svg" />
    ),
  },
];

type NavLeafItem = Extract<(typeof NAV_ITEMS)[number], { heading?: false }>;

function isNavLeafItem(item: (typeof NAV_ITEMS)[number]): item is NavLeafItem {
  return item.heading !== true;
}

const NAV_GROUPS = NAV_ITEMS.reduce<{ id: string; label: string; items: NavLeafItem[] }[]>((groups, item) => {
  if (!isNavLeafItem(item)) {
    groups.push({ id: item.id, label: item.label, items: [] });
    return groups;
  }
  if (groups.length === 0) {
    groups.push({ id: "heading-main", label: "Main", items: [] });
  }
  groups[groups.length - 1].items.push(item);
  return groups;
}, []);

// Navigation guard source of truth:
// To guard a page in future (unsaved-changes interception), add `guarded: true`
// on that page item in NAV_ITEMS. It will automatically be included here.

const GUARDED_NAV_IDS = new Set([
  ...NAV_ITEMS.filter((item) => item.heading !== true && item.guarded).map((item) => item.id),
  "export-pdf",
]);

/* -- Course Structure panel -- */
function CourseStructurePanel({
  courseId,
  courseTitle,
  onOpenEditor,
  onOpenStoryboard,
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
}: {
  courseId: string;
  courseTitle: string;
  onOpenEditor: (topicId: string) => void;
  onOpenStoryboard: () => void;
  onNavigationRequest?: (nav: string) => void;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
}) {
  const [viewMode, setViewMode] = useState<"tree" | "map">("tree");
  // Content-group id whose Add Component drawer is open (null = closed).
  const [addComponentBlockId, setAddComponentBlockId] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  const {
    state,
    loading,
    dirty,
    saving,
    error,
    save,
    discard,
    addModule,
    addSubModule,
    addTopic,
    addSection,
    addContentGroup,
    addComponent,
    rename,
    remove,
    moveNode,
  } = useCourseStructure(courseId, courseTitle);

  // Edits are staged locally and saved only on demand — confirm before leaving
  // with unsaved changes (mirrors Technical Settings / Navigation).
  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } =
    useUnsavedChangesNavigationGuard({
      hasChanges: dirty,
      pendingNavigation,
      onPendingNavigationHandled,
      onNavigate: onNavigationRequest,
    });

  async function handleConfirmSave() {
    const ok = await save();
    if (!ok) return; // save failed — stay put, show the error
    const target = consumePendingNavigation();
    if (target) onNavigationRequest?.(target);
  }
  function handleConfirmDiscard() {
    discard();
    const target = consumePendingNavigation();
    if (target) onNavigationRequest?.(target);
  }

  return (
    <div className="max-w-5xl w-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">Course Structure</h2>
          <p className="text-sm text-[#6b7280] mt-0.5">Build your structure before editing.</p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center border border-[#e5e7eb] rounded-lg overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("tree")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
              viewMode === "tree"
                ? "bg-[#2d6fa8] text-white font-medium"
                : "bg-white text-[#6b7280] hover:text-[#111827]"
            }`}
            title="Tree view"
          >
            {/* Tree toggle glyph - from public/assets/icons/Icon-tree.svg (currentColor so it tints per state) */}
            <svg width="14" height="14" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.08333" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.25 1.625V8.125" />
              <path d="M9.75 4.875C10.6475 4.875 11.375 4.14746 11.375 3.25C11.375 2.35254 10.6475 1.625 9.75 1.625C8.85254 1.625 8.125 2.35254 8.125 3.25C8.125 4.14746 8.85254 4.875 9.75 4.875Z" />
              <path d="M3.25 11.375C4.14746 11.375 4.875 10.6475 4.875 9.75C4.875 8.85254 4.14746 8.125 3.25 8.125C2.35254 8.125 1.625 8.85254 1.625 9.75C1.625 10.6475 2.35254 11.375 3.25 11.375Z" />
              <path d="M9.75 4.875C9.75 6.16793 9.23639 7.40791 8.32215 8.32215C7.40791 9.23639 6.16793 9.75 4.875 9.75" />
            </svg>
            Tree
          </button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-l border-[#e5e7eb] transition-colors ${
              viewMode === "map"
                ? "bg-[#2d6fa8] text-white font-medium"
                : "bg-white text-[#6b7280] hover:text-[#111827]"
            }`}
            title="Course map view"
          >
            {/* Map toggle glyph - from public/assets/icons/Icon-map.svg (currentColor so it tints per state) */}
            <svg width="14" height="14" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.08333" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1.625" y="1.625" width="3.79167" height="3.79167" rx="0.541667" />
              <rect x="7.5835" y="1.625" width="3.79167" height="3.79167" rx="0.541667" />
              <rect x="7.5835" y="7.58398" width="3.79167" height="3.79167" rx="0.541667" />
              <rect x="1.625" y="7.58398" width="3.79167" height="3.79167" rx="0.541667" />
            </svg>
            Map
          </button>
        </div>
      </div>

      {/* Rules banner (top) */}
      <div className="mb-3 p-3.5 rounded-lg bg-[#f0faf8] border border-[#99e6de] text-sm text-[#0d7377]">
        Organize your course into modules, topics, sections, content groups and components. At least one topic
        is mandatory at the course level, and every module must contain at least one topic.
      </div>

      {/* Tip (top) - view-specific info text, styled like the app's Tip callouts */}
      <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-[#fff7ed] border border-[#fed7aa] px-4 py-3">
        <span className="text-base leading-none mt-0.5" aria-hidden="true">💡</span>
        <p className="text-sm text-[#9a3412] leading-snug">
          <span className="font-semibold">Tip:</span>{" "}
          {viewMode === "tree"
            ? "Create and organize the learning journey using the tree view. Click any field to edit content directly, and open a topic in the Page Editor (→) for advanced editing and settings."
            : "Explore the entire course structure in a visual format. Use Map View to review content coverage and learning flow across topics. To create, edit, or reorganize content, switch to Tree View."}
        </p>
      </div>

      {/* Unsaved-changes bar — edits persist only on Save Changes */}
      {dirty && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#e5e7eb] bg-white shadow-sm px-4 py-2.5">
          <div className="flex items-center gap-2">
            <svg className="shrink-0 text-[#f59e0b]" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
            </svg>
            <span className="text-sm text-[#4b5563]">Unsaved changes</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={discard}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded-lg text-[#374151] bg-white border border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="px-3.5 py-1.5 text-sm font-semibold rounded-lg text-white bg-[#2d6fa8] hover:bg-[#235694] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          {error.message}
        </div>
      )}

      {!courseId ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          No course is associated with this setup flow, so the structure cannot be loaded.
        </div>
      ) : loading ? (
        <div className="flex items-center gap-3 text-sm text-[#6b7280] py-12 justify-center">
          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          Loading course structure...
        </div>
      ) : (
        <div className={saving ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
          {viewMode === "tree" ? (
            <CourseStructureTree
              structure={state}
              courseId={courseId}
              labels={STRUCTURE_LABELS}
              onAddModule={addModule}
              onAddSubModule={addSubModule}
              onAddTopic={addTopic}
              onAddSection={addSection}
              onAddContentGroup={addContentGroup}
              onAddComponent={(blockId) => setAddComponentBlockId(blockId)}
              onRename={rename}
              onRemove={remove}
              onMove={moveNode}
              onOpenTopic={onOpenEditor}
            />
          ) : (
            <CourseStructureMapView
              structure={state}
              labels={STRUCTURE_LABELS}
              onOpenTopic={onOpenEditor}
              onAddModule={addModule}
              onAddSubModule={addSubModule}
              onAddTopic={addTopic}
              onAddSection={addSection}
              onAddContentGroup={addContentGroup}
              onAddComponent={(blockId) => setAddComponentBlockId(blockId)}
              onRename={rename}
            />
          )}
        </div>
      )}

      {/* Hint (bottom, dismissible) - styled per design */}
      {!hintDismissed && (
        <div className="relative mt-5 rounded-xl border border-[#bfdbeb] bg-[#eaf4fb] p-4 pr-10">
          <button
            type="button"
            onClick={() => setHintDismissed(true)}
            aria-label="Dismiss"
            className="absolute top-3 right-3 p-1 rounded text-[#9ca3af] hover:text-[#374151] hover:bg-white/60 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="flex items-start gap-3">
            <svg className="shrink-0 mt-0.5 text-[#2d6fa8]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-[#111827]">Your structure is ready</p>
              <p className="text-sm text-[#5b7c93] mt-1">
                Open Storyboard to review and refine the content flow, or select a topic to continue building in the
                Page Editor with content, layouts, interactions, and learner experience settings.
              </p>
              <button
                type="button"
                onClick={onOpenStoryboard}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] rounded-lg hover:bg-[#255d8f] transition-colors"
              >
                Open Storyboard
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {addComponentBlockId && (
        <AddComponentDrawer
          onClose={() => setAddComponentBlockId(null)}
          onSelect={(componentType) => {
            addComponent(addComponentBlockId, componentType);
            setAddComponentBlockId(null);
          }}
        />
      )}

      <UnsavedChangesModal
        isOpen={showConfirmModal}
        isSaving={saving}
        onDiscard={handleConfirmDiscard}
        onSave={handleConfirmSave}
        onClose={clearPendingNavigation}
      />
    </div>
  );
}

/* -- Theme panel helpers -- */
const THEMES = [
  {
    id: "life",
    name: "LIFE Theme",
    description: "Use the pre-designed LIFE theme with standardized branding and layout",
    swatches: ["#1b3a4b", "#2d6a8f", "#dbeeff"],
  },
  {
    id: "custom",
    name: "Custom Theme",
    description: "Create your own custom theme with personalized colors and branding",
    swatches: ["#7c6fcd", "#5aad78", "#e06c4a"],
  },
  {
    id: "vanilla",
    name: "Vanilla Theme",
    description: "A clean, minimal theme with neutral tones and no preset branding",
    swatches: ["#f5f5f0", "#e8e4d4", "#c8c0a0"],
  },
];

const FONT_OPTIONS = [
  "Lato", "Georgia", "Helvetica Neue", "Inter", "Merriweather",
  "Montserrat", "Open Sans", "Poppins", "Roboto", "Source Sans Pro",
];

const H1_SIZE_OPTIONS = [
  { label: "H1 - 3.5rem", value: "3.5rem" },
  { label: "H2 - 3rem",   value: "3rem" },
  { label: "H3 - 2.5rem", value: "2.5rem" },
  { label: "H4 - 2rem",   value: "2rem" },
  { label: "H5 - 1.5rem", value: "1.5rem" },
  { label: "H6 - -",      value: "h6" },
  { label: "Paragraph - 1.125rem", value: "1.125rem" },
];

type CustomThemeValues = {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  paragraphFont: string;
  fontColor: string;
  headingFontColor: string;
  instructionColor: string;
  linkFontColor: string;
  pageTitleSize: string;
};

const DEFAULT_CUSTOM: CustomThemeValues = {
  primaryColor: "#4a90a4",
  secondaryColor: "#3a8a7a",
  headingFont: "Lato",
  paragraphFont: "Lato",
  fontColor: "#111111",
  headingFontColor: "#111111",
  instructionColor: "#111111",
  linkFontColor: "#4a90a4",
  pageTitleSize: "3.5rem",
};

function DesktopCalculatedValues({
  sizes,
}: {
  sizes: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="mt-2 rounded-lg bg-[#f0f7ff] border-l-4 border-[#2d6fa8] px-4 py-3 text-xs text-[#374151] space-y-0.5">
      <p className="font-semibold text-[#111827] mb-1">Calculated values for Desktop:</p>
      {sizes.map((s) => (
        <p key={s.label}><span className="font-semibold">{s.label}:</span> {s.value}</p>
      ))}
    </div>
  );
}

/* colour swatch picker row */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#374151] flex items-center gap-1">
        {label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <label className="w-11 h-11 rounded-lg border-2 border-[#e5e7eb] overflow-hidden cursor-pointer hover:border-[#2d6fa8] transition-colors block">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} title={label} className="w-full h-full opacity-0 absolute" />
        <span className="w-full h-full block rounded-md" style={{ backgroundColor: value }} />
      </label>
    </div>
  );
}

/* font dropdown */
function FontSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#374151] flex items-center gap-1">
        {label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          title={label}
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[#111827] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent pr-8"
        >
          {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

/* accordion wrapper */
function Accordion({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#e5e7eb] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-[#f9fafb] transition-colors"
      >
        <div className="flex items-center gap-2.5 text-sm font-semibold text-[#111827]">
          <span className="text-[#6b7280]">{icon}</span>
          {title}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-[22px] py-[20px] border-t border-[#f3f4f6] bg-white">{children}</div>}
    </div>
  );
}

/* live preview pane */
function ThemePreview({ cfg }: { cfg: CustomThemeValues }) {
  const headingStyle = { fontFamily: cfg.headingFont, color: cfg.headingFontColor };
  const bodyStyle    = { fontFamily: cfg.paragraphFont, color: cfg.fontColor };
  const h1Size = cfg.pageTitleSize === "h6" ? "1rem" : cfg.pageTitleSize;

  return (
    <div className="flex flex-col h-full bg-[#f0f4f8]">
      {/* preview header */}
      <div className="h-10 bg-white border-b border-[#e5e7eb] flex items-center justify-between px-4 shrink-0">
        <span className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill={cfg.primaryColor} stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Live Preview
        </span>
        <div className="flex items-center gap-1.5">
          <button type="button" title="Toggle dark mode" aria-label="Toggle dark mode" className="p-1.5 rounded-lg border border-[#e5e7eb] hover:bg-[#f3f4f6] transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
          <button type="button" title="Expand preview" aria-label="Expand preview" className="p-1.5 rounded-lg border border-[#e5e7eb] hover:bg-[#f3f4f6] transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
      </div>

      {/* simulated course shell */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white rounded-xl border border-[#e5e7eb] overflow-hidden shadow-sm">
          {/* progress bar */}
          <div className="h-1" style={{ backgroundColor: cfg.primaryColor }} />

          {/* course nav bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f3f4f6]" style={{ backgroundColor: cfg.primaryColor }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span className="text-xs text-white flex-1" style={{ fontFamily: cfg.headingFont }}>New Course Title / New Menu/Page Title</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>

          <div className="p-4">
            {/* page title */}
            <h1 className="font-bold mb-3" style={{ ...headingStyle, fontSize: h1Size }}>{cfg.pageTitleSize === "h6" ? "-" : "New Menu/Page Title"}</h1>

            {/* article block */}
            <div className="border border-[#e5e7eb] rounded-lg p-3 mb-3">
              <h2 className="font-semibold text-sm mb-1" style={headingStyle}>New Article Title</h2>
              <div className="border border-[#e5e7eb] rounded-md p-3">
                <h3 className="font-semibold text-xs mb-1" style={headingStyle}>New Block Title</h3>
                <div className="border border-[#e5e7eb] rounded p-3">
                  <p className="font-semibold text-xs mb-1" style={headingStyle}>New Component Title</p>
                  <p className="text-xs mb-1" style={bodyStyle}>Body text</p>
                  <a href="#" className="text-xs underline block mb-1" style={{ color: cfg.linkFontColor, fontFamily: cfg.paragraphFont }}>This is a sample link</a>
                  <p className="text-xs italic mb-3" style={{ color: cfg.instructionColor, fontFamily: cfg.paragraphFont }}>Choose one option then select Submit.</p>

                  {/* MCQ */}
                  <div className="space-y-2 mb-3">
                    {["Correct", "Incorrect"].map((opt, i) => (
                      <div key={opt} className="flex items-center gap-2 border border-[#e5e7eb] rounded-md px-3 py-2" style={{ backgroundColor: i === 0 ? cfg.secondaryColor + "22" : "" }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.secondaryColor }}>
                          {i === 0 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <span className="text-xs" style={bodyStyle}>{opt}</span>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="px-4 py-1.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: cfg.primaryColor, fontFamily: cfg.paragraphFont }}>Submit</button>
                </div>
              </div>
            </div>

            {/* nav buttons */}
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" className="px-4 py-1.5 rounded text-xs font-medium border" style={{ borderColor: cfg.primaryColor, color: cfg.primaryColor, fontFamily: cfg.paragraphFont }}>Previous</button>
              <button type="button" className="px-4 py-1.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: cfg.primaryColor, fontFamily: cfg.paragraphFont }}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -- Global Theme accordion content -- */
function GlobalThemeSection({ cfg, setCfg }: { cfg: CustomThemeValues; setCfg: (v: CustomThemeValues) => void }) {
  const set = <K extends keyof CustomThemeValues>(k: K, v: CustomThemeValues[K]) => setCfg({ ...cfg, [k]: v });

  const calcSizes = () => {
    const base = cfg.pageTitleSize === "h6" ? null : parseFloat(cfg.pageTitleSize);
    if (!base) return null;

    const MIN_INSTRUCTION_REM = 0.875;
    const MIN_FONT_STEP_REM = 0.0625;
    const MIN_PARAGRAPH_REM = MIN_INSTRUCTION_REM + MIN_FONT_STEP_REM;

    const h1Raw = base;
    const h2Raw = base - 0.5;
    const h3Raw = base - 1;
    const h4Raw = base - 1.25;
    const h5Raw = base - 1.5;
    const h6Raw = base - 1.75;

    const h6 = Math.max(h6Raw, MIN_PARAGRAPH_REM);
    const h5 = Math.max(h5Raw, h6 + MIN_FONT_STEP_REM);
    const h4 = Math.max(h4Raw, h5 + MIN_FONT_STEP_REM);
    const h3 = Math.max(h3Raw, h4 + MIN_FONT_STEP_REM);
    const h2 = Math.max(h2Raw, h3 + MIN_FONT_STEP_REM);
    const h1 = Math.max(h1Raw, h2 + MIN_FONT_STEP_REM);
    const p = h6;

    const formatSize = (rem: number) => {
      const px = Math.round(rem * 16);
      const formatted = rem.toFixed(4).replace(/\.?0+$/, "");
      return `${formatted}rem (${px}px)`;
    };

    return [
      { label: "H1 (Page Title)", value: formatSize(h1) },
      { label: "H2", value: formatSize(h2) },
      { label: "H3", value: formatSize(h3) },
      { label: "H4", value: formatSize(h4) },
      { label: "H5", value: formatSize(h5) },
      { label: "H6", value: formatSize(h6) },
      { label: "Paragraph", value: formatSize(p) },
    ];
  };

  const sizes = calcSizes();

  return (
    <div className="space-y-5 mt-4">
      {/* colours row 1 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <ColorField label="Primary colour" value={cfg.primaryColor} onChange={(v) => set("primaryColor", v)} />
        <ColorField label="Secondary colour" value={cfg.secondaryColor} onChange={(v) => set("secondaryColor", v)} />
      </div>
      {/* fonts */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <FontSelect label="Heading font" value={cfg.headingFont} onChange={(v) => set("headingFont", v)} />
        <FontSelect label="Paragraph font" value={cfg.paragraphFont} onChange={(v) => set("paragraphFont", v)} />
      </div>
      {/* font colours */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <ColorField label="Font colour" value={cfg.fontColor} onChange={(v) => set("fontColor", v)} />
        <ColorField label="Heading font colour" value={cfg.headingFontColor} onChange={(v) => set("headingFontColor", v)} />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <ColorField label="Instruction colour" value={cfg.instructionColor} onChange={(v) => set("instructionColor", v)} />
        <ColorField label="Link font colour" value={cfg.linkFontColor} onChange={(v) => set("linkFontColor", v)} />
      </div>
      {/* page title size */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[#374151] flex items-center gap-1">
          Page Title Size (H1)
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <button type="button" onClick={() => set("pageTitleSize", DEFAULT_CUSTOM.pageTitleSize)} title="Reset" className="ml-1 text-[#9ca3af] hover:text-[#6b7280]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
            </svg>
          </button>
        </span>
        <div className="relative max-w-xs">
          <select
            value={cfg.pageTitleSize}
            onChange={(e) => set("pageTitleSize", e.target.value)}
            aria-label="Page Title Size (H1)"
            title="Page Title Size (H1)"
            className="w-full border-2 border-[#2d6fa8] rounded-lg px-3 py-2.5 text-sm text-[#111827] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] pr-8"
          >
            {H1_SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        {sizes && <DesktopCalculatedValues sizes={sizes} />}
      </div>
    </div>
  );
}

/* -- Custom theme full editor -- */
function CustomThemeEditor({ onBack }: { onBack: () => void }) {
  const [cfg, setCfg] = useState<CustomThemeValues>(DEFAULT_CUSTOM);

  const [componentConfig, setComponentConfig] = useState({
    markingNotFinal: false,
    markingUnansweredCorrect: false,
    hideFeedbackFirstAttempt: false,
    hidePartiallyCorrect: false,
  });

  const toggleConfig = (key: keyof typeof componentConfig) =>
    setComponentConfig((prev) => ({ ...prev, [key]: !prev[key] }));

  const ACCORDIONS = [
    {
      id: "global",
      title: "Global Theme",
      defaultOpen: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      ),
      content: <GlobalThemeSection cfg={cfg} setCfg={setCfg} />,
    },
    {
      id: "page",
      title: "Page Structure",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Page structure options coming soon.</div>,
    },
    {
      id: "progress",
      title: "Progress Styling",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Progress styling options coming soon.</div>,
    },
    {
      id: "navigation",
      title: "Navigation Styling",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Navigation styling options coming soon.</div>,
    },
    {
      id: "menu",
      title: "Menu Styling",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Menu styling options coming soon.</div>,
    },
    {
      id: "feedback",
      title: "Feedback & Validation",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Feedback & validation options coming soon.</div>,
    },
    {
      id: "overlays",
      title: "Overlays Styling",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Overlays styling options coming soon.</div>,
    },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* left: accordion editor */}
      <div className="w-1/2 h-full overflow-y-auto border-r border-[#e5e7eb] bg-white">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#f3f4f6] shrink-0">
          <button type="button" onClick={onBack} className="text-xs text-[#2d6fa8] hover:underline flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Theme
          </button>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          <span className="text-xs text-[#374151] font-medium">Custom Theme</span>
        </div>
        {/* -- Custom Icons: Sprite Sheets -- */}
        <div className="px-5 pt-4 pb-5 border-b border-[#f3f4f6]">
          <p className="text-xs font-semibold text-[#374151] mb-1">Custom Icons: Sprite Sheets</p>
          <p className="text-xs text-[#6b7280] mb-3 leading-relaxed">Upload an SVG sprite sheet to replace default icons across the course.</p>
          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-[#d1d5db] rounded-xl cursor-pointer hover:border-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#2d6fa8] transition-colors mb-1">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span className="text-xs text-[#6b7280] group-hover:text-[#2d6fa8] transition-colors">Click to upload sprite sheet (.svg)</span>
            <input type="file" accept=".svg" aria-label="Upload SVG sprite sheet" className="hidden" />
          </label>
        </div>

        {/* -- Custom Icons: Single Icons -- */}
        <div className="px-5 pt-4 pb-5 border-b border-[#f3f4f6]">
          <p className="text-xs font-semibold text-[#374151] mb-1">Custom Icons: Single Icons</p>
          <p className="text-xs text-[#6b7280] mb-3 leading-relaxed">Upload individual SVG icon files to override specific icons in the course.</p>
          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-[#d1d5db] rounded-xl cursor-pointer hover:border-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#2d6fa8] transition-colors mb-1">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span className="text-xs text-[#6b7280] group-hover:text-[#2d6fa8] transition-colors">Click to upload icons (.svg)</span>
            <input type="file" accept=".svg" multiple aria-label="Upload single SVG icons" className="hidden" />
          </label>
        </div>

        {/* -- Configuration: Component -- */}
        <div className="px-5 pt-4 pb-5 border-b border-[#f3f4f6]">
          <p className="text-xs font-semibold text-[#374151] mb-0.5">Configuration: Component</p>
          <p className="text-xs text-[#6b7280] mb-3 leading-relaxed">Component-level behavior and feedback configuration.</p>
          <div className="space-y-1">
            {(
              [
                { key: "markingNotFinal",          label: "Display marking for not-final attempts" },
                { key: "markingUnansweredCorrect",  label: "Display marking for unanswered correct responses" },
                { key: "hideFeedbackFirstAttempt",  label: "Hide feedback on first attempt on assessments" },
                { key: "hidePartiallyCorrect",      label: "Hide partially correct feedback on the question and result page" },
              ] as { key: keyof typeof componentConfig; label: string }[]
            ).map(({ key, label }) => (
              <label key={key} className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-[#f9fafb] cursor-pointer group">
                <div
                  onClick={() => toggleConfig(key)}
                  className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${
                    componentConfig[key] ? "bg-[#2d6fa8] border-[#2d6fa8]" : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
                  }`}
                >
                  {componentConfig[key] && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#374151] leading-snug">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* -- Accordions -- */}
        <div className="px-4 pb-6 space-y-2 mt-3">
          {ACCORDIONS.map((a) => (
            <Accordion key={a.id} title={a.title} icon={a.icon} defaultOpen={a.defaultOpen}>
              {a.content}
            </Accordion>
          ))}
        </div>
      </div>

      {/* right: live preview */}
      <div className="w-1/2 h-full overflow-hidden">
        <ThemePreview cfg={cfg} />
      </div>
    </div>
  );
}

/* -- Theme selection panel -- */
function normalizeName(v?: string): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapThemeNameToId(themeName?: string): string | null {
  const n = normalizeName(themeName);
  if (!n) return null;
  if (n.includes("life")) return "life";
  if (n.includes("vanilla")) return "vanilla";
  if (n.includes("custom")) return "custom";
  return null;
}

function mapMenuNameToStyle(menuName?: string): string {
  const n = normalizeName(menuName);
  if (!n) return "";
  if (n.includes("life")) return "life";
  if (n.includes("overview")) return "overview";
  if (n.includes("box")) return "box";
  return "";
}

function ThemePanel({ initialThemeName }: { initialThemeName?: string }) {
  const [selected, setSelected] = useState<string | null>(mapThemeNameToId(initialThemeName));

  useEffect(() => {
    setSelected(mapThemeNameToId(initialThemeName));
  }, [initialThemeName]);

  if (selected === "custom") {
    return (
      <div className="h-full w-full overflow-hidden">
        <CustomThemeEditor onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl w-full px-6 py-6">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-[#111827]">
          Select Theme <span className="text-red-500">*</span>
        </h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Choose a theme for your course.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {THEMES.map((theme) => {
          const isSelected = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setSelected(theme.id)}
              className={`text-left rounded-xl border-2 p-5 transition-all cursor-pointer focus:outline-none ${
                isSelected
                  ? "border-[#2d6fa8] bg-[#f0f7ff] shadow-sm"
                  : "border-[#e5e7eb] bg-white hover:border-[#93c5fd] hover:shadow-sm"
              }`}
            >
              <p className="font-semibold text-[#111827] text-sm mb-1">{theme.name}</p>
              <p className="text-xs text-[#6b7280] leading-snug mb-4">{theme.description}</p>
              <div className="flex gap-2">
                {theme.swatches.map((color) => (
                  <span
                    key={color}
                    className="w-8 h-8 rounded-md border border-black/10 inline-block"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {isSelected && (
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[#2d6fa8]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Selected
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   MENU PANEL - types, thumbnails, live preview, settings
   ------------------------------------------------------------- */

type BgRepeat   = "no-repeat" | "repeat-x" | "repeat-y" | "repeat";
type BgSize     = "auto" | "cover" | "contain" | "100% 100%";
type BgPosition =
  | "left top"    | "left center"    | "left bottom"
  | "center top"  | "center center"  | "center bottom"
  | "right top"   | "right center"   | "right bottom";

interface MenuConfig {
  menuStyle:        string;
  logoUrl:          string | null;
  menuTitle:        string;
  titleFontSize:    string;
  titleColor:       string;
  menuDescription:  string;
  descFontSize:     string;
  descColor:        string;
  titleAlign:       "left" | "center" | "right";
  bgType:           "color" | "image";
  bgColor:          string;
  bgImageUrl:       string | null;
  bgRepeat:         BgRepeat;
  bgSize:           BgSize;
  bgPosition:       BgPosition;
  headerImageUrl:   string | null;
  headerImageOrder: "above" | "below";
}

const DEFAULT_MENU_CFG: MenuConfig = {
  menuStyle: "", logoUrl: null,
  menuTitle: "", titleFontSize: "14px", titleColor: "#ffffff",
  menuDescription: "", descFontSize: "12px", descColor: "rgba(255,255,255,0.75)",
  titleAlign: "center",
  bgType: "color", bgColor: "#1b3a4b", bgImageUrl: null,
  bgRepeat: "no-repeat", bgSize: "cover", bgPosition: "center center",
  headerImageUrl: null, headerImageOrder: "above",
};

/* -- Card thumbnail illustrations (matching the screenshot) -- */

function ThumbLife() {
  return (
    <div className="w-full h-full flex overflow-hidden bg-[#1b3a4b]">
      {/* sidebar */}
      <div className="w-[42%] flex flex-col gap-1.5 px-2.5 py-3 border-r border-white/10">
        <div className="h-2 w-4/5 bg-white/80 rounded-full mb-1" />
        {[0,1,2,3].map((i) => (
          <div key={i} className={`flex items-center gap-1.5 px-1.5 py-1 rounded ${i===0?"bg-white/15":""}`}>
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${i===0?"bg-[#60a5fa]":"bg-white/35"}`} />
            <div className={`h-1.5 rounded-full ${i===0?"w-10 bg-white/80":"w-8 bg-white/35"}`} />
          </div>
        ))}
      </div>
      {/* content */}
      <div className="flex-1 flex flex-col gap-1.5 px-2.5 py-3 bg-[#1b3a4b]/60">
        <div className="h-2 w-3/4 bg-[#93c5fd]/70 rounded-full" />
        <div className="h-1.5 w-full bg-white/20 rounded-full" />
        <div className="h-1.5 w-5/6 bg-white/20 rounded-full" />
        <div className="h-1.5 w-4/6 bg-white/20 rounded-full" />
        <div className="h-1.5 w-5/6 bg-white/20 rounded-full" />
      </div>
    </div>
  );
}

function ThumbOverview() {
  const rows = [
    { w: "75%", accent: "#2d6fa8" },
    { w: "45%", accent: "#2d6fa8" },
    { w: "15%", accent: "#d1d5db" },
  ];
  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
      <div className="px-3 pt-3 pb-1">
        <div className="h-2 w-2/5 bg-[#2d6fa8] rounded-full mb-2" />
        <div className="h-1.5 w-3/5 bg-[#d1d5db] rounded-full" />
      </div>
      <div className="flex-1 flex flex-col gap-1.5 px-3 py-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 border border-[#e5e7eb] rounded-md px-2 py-1.5">
            <div className="w-3 h-3 rounded bg-[#dbeeff] border border-[#93c5fd] shrink-0" />
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="h-1 w-3/5 bg-[#374151]/50 rounded-full" />
              <div className="h-1 w-full bg-[#e5e7eb] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#2d6fa8]" style={{ width: r.w, backgroundColor: r.accent }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThumbBox() {
  const colors = ["#3b82f6","#4fb3b3","#7c3aed","#f97316","#16a34a","#dc2626"];
  return (
    <div className="w-full h-full bg-[#f9fafb] p-2.5 overflow-hidden">
      <div className="grid grid-cols-3 gap-1.5 h-full">
        {colors.map((c) => (
          <div key={c} className="rounded-md flex flex-col justify-end p-1.5" style={{ backgroundColor: c }}>
            <div className="h-1 w-3/4 bg-white/70 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

const MENU_OPTIONS = [
  {
    id: "life",
    name: "LIFE Menu",
    description: "A structured sidebar navigation following the LIFE design standard. Ideal for multi-module courses with a persistent left rail.",
    thumb: <ThumbLife />,
  },
  {
    id: "overview",
    name: "Overview Menu",
    description: "A list-based overview of all course sections with progress indicators. Great for learners who want a clear sense of where they are.",
    thumb: <ThumbOverview />,
  },
  {
    id: "box",
    name: "Box Menu",
    description: "A visual tile grid where each module is a distinct coloured card. Best for shorter courses or tile-based navigation experiences.",
    thumb: <ThumbBox />,
  },
];

/* -- Live preview rendered in the right panel -- */
function MenuLivePreview({ cfg }: { cfg: MenuConfig }) {
  const bgStyle: React.CSSProperties = cfg.bgType === "image" && cfg.bgImageUrl
    ? { backgroundImage: `url(${cfg.bgImageUrl})`, backgroundRepeat: cfg.bgRepeat, backgroundSize: cfg.bgSize, backgroundPosition: cfg.bgPosition }
    : { backgroundColor: cfg.bgColor };

  const alignClass = { left: "items-start text-left", center: "items-center text-center", right: "items-end text-right" }[cfg.titleAlign];

  /* header block (logo, title, description, header image) - no background, rendered on top of bgStyle container */
  const titleHasContent = cfg.menuTitle.replace(/<[^>]*>/g, "").trim().length > 0;
  const descHasContent  = cfg.menuDescription.replace(/<[^>]*>/g, "").trim().length > 0;

  const menuHeaderContent = (
    <>
      {cfg.headerImageOrder === "above" && cfg.headerImageUrl && (
        <img src={cfg.headerImageUrl} alt="" className="w-full h-16 object-cover rounded mb-1" />
      )}
      {cfg.logoUrl && <img src={cfg.logoUrl} alt="logo" className="h-6 object-contain" />}
      {titleHasContent && (
        <span
          className="font-bold leading-tight [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_s]:line-through [&_strike]:line-through"
          style={{ color: cfg.titleColor, fontSize: cfg.titleFontSize }}
          dangerouslySetInnerHTML={{ __html: cfg.menuTitle }}
        />
      )}
      {descHasContent && (
        <span
          className="leading-snug [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_s]:line-through [&_strike]:line-through"
          style={{ color: cfg.descColor, fontSize: cfg.descFontSize }}
          dangerouslySetInnerHTML={{ __html: cfg.menuDescription }}
        />
      )}
      {cfg.headerImageOrder === "below" && cfg.headerImageUrl && (
        <img src={cfg.headerImageUrl} alt="" className="w-full h-16 object-cover rounded mt-1" />
      )}
    </>
  );

  if (cfg.menuStyle === "life") {
    return (
      <div className="w-full h-full flex flex-col rounded-xl border border-[#e5e7eb] overflow-hidden shadow-sm" style={bgStyle}>
        {/* top browser-chrome bar */}
        <div className="h-8 bg-black/30 flex items-center gap-2 px-3 shrink-0 backdrop-blur-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          <div className="h-1.5 w-24 bg-white/40 rounded-full" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* sidebar - inherits background from parent, adds border only */}
          <div className="w-40 flex flex-col shrink-0 overflow-hidden border-r border-white/15">
            <div className={`flex flex-col py-3 gap-1 border-b border-white/10 px-2 ${alignClass}`}>
              {cfg.headerImageOrder === "above" && cfg.headerImageUrl && (
                <img src={cfg.headerImageUrl} alt="" className="w-full h-10 object-cover rounded mb-1" />
              )}
              {cfg.logoUrl && <img src={cfg.logoUrl} alt="logo" className="h-5 object-contain" />}
              {titleHasContent && (
                <span
                  className="font-bold leading-tight [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_s]:line-through"
                  style={{ color: cfg.titleColor, fontSize: "9px" }}
                  dangerouslySetInnerHTML={{ __html: cfg.menuTitle }}
                />
              )}
              {descHasContent && (
                <span
                  className="leading-snug [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_s]:line-through"
                  style={{ color: cfg.descColor, fontSize: "8px" }}
                  dangerouslySetInnerHTML={{ __html: cfg.menuDescription }}
                />
              )}
              {cfg.headerImageOrder === "below" && cfg.headerImageUrl && (
                <img src={cfg.headerImageUrl} alt="" className="w-full h-10 object-cover rounded mt-1" />
              )}
            </div>
            <div className="flex flex-col gap-0.5 p-2">
              {["Module 1","Module 2","Module 3","Module 4"].map((m, i) => (
                <div key={m} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${i===0?"bg-white/20":""}`}>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${i===0?"bg-[#60a5fa]":"bg-white/35"}`} />
                  <div className={`h-1.5 rounded-full ${i===0?"w-14 bg-white/90":"w-12 bg-white/40"}`} />
                </div>
              ))}
            </div>
          </div>
          {/* content area - semi-transparent overlay so background shows through */}
          <div className="flex-1 bg-white/10 backdrop-blur-sm p-4 flex flex-col gap-2">
            <div className="h-2.5 w-2/5 bg-white/60 rounded-full" />
            <div className="h-1.5 w-4/5 bg-white/30 rounded-full" />
            <div className="h-1.5 w-3/5 bg-white/30 rounded-full" />
            <div className="mt-2 flex-1 rounded-lg bg-white/20 border border-white/20 p-3 flex flex-col gap-1.5">
              <div className="h-1.5 w-1/3 bg-white/50 rounded-full" />
              <div className="h-1 w-full bg-white/20 rounded-full" />
              <div className="h-1 w-5/6 bg-white/20 rounded-full" />
              <div className="h-1 w-2/3 bg-white/20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cfg.menuStyle === "overview") {
    return (
      <div className="w-full h-full flex flex-col rounded-xl border border-[#e5e7eb] overflow-hidden shadow-sm" style={bgStyle}>
        {/* header area */}
        <div className={`flex flex-col gap-1.5 px-4 py-4 w-full shrink-0 ${alignClass}`}>
          {menuHeaderContent}
        </div>
        {/* module list - semi-transparent card over background */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {[100, 60, 20, 0].map((p, i) => (
            <div key={i} className="bg-white/20 backdrop-blur-sm border border-white/25 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${p===100?"bg-white/80":"bg-white/20 border border-white/30"}`}>
                {p===100 && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#2d6fa8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-1.5 w-3/5 bg-white/70 rounded-full" />
                <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/60 rounded-full" style={{ width: `${p}%` }} />
                </div>
              </div>
              <span className="text-[9px] text-white/60 shrink-0">{p}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (cfg.menuStyle === "box") {
    const tileColors = ["#3b82f6","#7c3aed","#059669","#f97316","#dc2626","#0891b2"];
    return (
      <div className="w-full h-full flex flex-col rounded-xl border border-[#e5e7eb] overflow-hidden shadow-sm" style={bgStyle}>
        {/* header area */}
        <div className={`flex flex-col gap-1.5 px-4 py-4 w-full shrink-0 ${alignClass}`}>
          {menuHeaderContent}
        </div>
        {/* tile grid */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="grid grid-cols-3 gap-2.5">
            {tileColors.map((color, i) => (
              <div key={i} className="rounded-xl flex flex-col justify-end p-2.5 h-20" style={{ backgroundColor: color }}>
                <div className="h-1.5 w-4/5 bg-white/70 rounded-full" />
                <div className="h-1 w-3/5 bg-white/40 rounded-full mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#e5e7eb] flex items-center justify-center shadow-sm">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-[#6b7280]">Select a menu style</p>
      <p className="text-xs text-[#9ca3af]">A live preview will appear here</p>
    </div>
  );
}

/* -- Shared helpers -- */
function MenuFieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-xs font-semibold text-[#374151]">
      {children}{required && <span className="text-[#dc2626] ml-0.5">*</span>}
    </span>
  );
}

/* -- Rich text editor with formatting toolbar -- */
const FONT_SIZE_OPTIONS = [
  { label: "Small",    value: "12px" },
  { label: "Default",  value: "14px" },
  { label: "Large",    value: "18px" },
  { label: "X-Large",  value: "24px" },
  { label: "2X-Large", value: "32px" },
];

function RichTextEditor({
  label,
  html,
  onChange,
  placeholder,
  multiline = false,
  fontSize,
  onFontSizeChange,
  color,
  onColorChange,
}: {
  label: string;
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  multiline?: boolean;
  fontSize: string;
  onFontSizeChange: (v: string) => void;
  color: string;
  onColorChange: (v: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  // Set innerHTML only on mount - never re-set during typing (avoids cursor reset / reversed text)
  const initRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.innerHTML = html;
      (editorRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  // intentionally empty deps - run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncFormats = useCallback(() => {
    const formats = new Set<string>();
    if (document.queryCommandState("bold"))          formats.add("bold");
    if (document.queryCommandState("italic"))        formats.add("italic");
    if (document.queryCommandState("underline"))     formats.add("underline");
    if (document.queryCommandState("strikeThrough")) formats.add("strikeThrough");
    setActiveFormats(formats);
  }, []);

  const emit = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const applyFormat = useCallback((cmd: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    syncFormats();
    emit();
  }, [emit, syncFormats]);

  const handleInput = useCallback(() => { emit(); syncFormats(); }, [emit, syncFormats]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!multiline && e.key === "Enter") { e.preventDefault(); return; }
    if (e.key === "b" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); applyFormat("bold"); }
    if (e.key === "i" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); applyFormat("italic"); }
    if (e.key === "u" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); applyFormat("underline"); }
  }, [multiline, applyFormat]);

  const FORMAT_BUTTONS: { cmd: string; title: string; icon: React.ReactNode }[] = [
    {
      cmd: "bold", title: "Bold (Ctrl+B)",
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>,
    },
    {
      cmd: "italic", title: "Italic (Ctrl+I)",
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>,
    },
    {
      cmd: "underline", title: "Underline (Ctrl+U)",
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>,
    },
    {
      cmd: "strikeThrough", title: "Strikethrough",
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.3 12H6.7"/><path d="M10 7.5C10 6.1 11.1 5 12.5 5c1 0 1.9.6 2.3 1.5"/><path d="M6 16.5C6 17.9 7.1 19 8.5 19h5.5a3 3 0 0 0 0-6H6"/></svg>,
    },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <MenuFieldLabel>{label}</MenuFieldLabel>
      <div className="border border-[#d1d5db] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#2d6fa8] focus-within:border-transparent">

        {/* -- toolbar -- */}
        <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-[#e5e7eb] bg-[#f9fafb]">

          {/* bold / italic / underline / strikethrough */}
          {FORMAT_BUTTONS.map(({ cmd, title, icon }) => (
            <button
              key={cmd}
              type="button"
              title={title}
              onMouseDown={(e) => { e.preventDefault(); applyFormat(cmd); }}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${activeFormats.has(cmd) ? "bg-[#2d6fa8] text-white" : "text-[#6b7280] hover:bg-[#e5e7eb] hover:text-[#374151]"}`}
            >
              {icon}
            </button>
          ))}

          <div className="w-px h-4 bg-[#e5e7eb] mx-1 shrink-0" />

          {/* font size dropdown - directly controls the cfg field, no execCommand */}
          <div className="relative">
            <select
              value={fontSize}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => onFontSizeChange(e.target.value)}
              aria-label="Font size"
              title="Font size"
              className="h-7 pl-2 pr-5 text-xs text-[#374151] bg-white border border-[#d1d5db] rounded appearance-none focus:outline-none focus:ring-1 focus:ring-[#2d6fa8] cursor-pointer"
            >
              {FONT_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          <div className="w-px h-4 bg-[#e5e7eb] mx-1 shrink-0" />

          {/* text color - directly controls the cfg field, anchored label for correct picker position */}
          <label
            title="Text color"
            className="relative w-7 h-7 flex flex-col items-center justify-center gap-0.5 rounded hover:bg-[#e5e7eb] transition-colors cursor-pointer"
            onMouseDown={(e) => e.preventDefault()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 20 8.5 8 12 17 15.5 8 20 20"/>
              <line x1="6.5" y1="15" x2="17.5" y2="15"/>
            </svg>
            <span className="w-5 h-1 rounded-full block" style={{ backgroundColor: color }} />
            <input
              type="color"
              value={color}
              aria-label="Text color"
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => onColorChange(e.target.value)}
            />
          </label>

        </div>

        {/* -- editable area - uncontrolled, innerHTML set once on mount -- */}
        <div
          ref={initRef}
          contentEditable
          suppressContentEditableWarning
          dir="ltr"
          lang="en"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onMouseUp={syncFormats}
          onKeyUp={syncFormats}
          onFocus={syncFormats}
          data-placeholder={placeholder}
          className={`px-3 py-2.5 outline-none bg-white text-[#374151] empty:before:content-[attr(data-placeholder)] empty:before:text-[#9ca3af] ${multiline ? "min-h-[80px]" : "min-h-[38px]"}`}
          style={{ wordBreak: "break-word", direction: "ltr", unicodeBidi: "plaintext", textAlign: "left", fontSize }}
        />
      </div>
    </div>
  );
}

function MenuUploadZone({ label, onFile }: { label: string; onFile: (url: string) => void }) {
  return (
    <label
      className="flex flex-col items-center justify-center w-full h-[72px] border-2 border-dashed border-[#d1d5db] rounded-xl cursor-pointer hover:border-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors group"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#2d6fa8] mb-1">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <span className="text-[11px] text-[#6b7280] group-hover:text-[#2d6fa8]">{label}</span>
      <input
        type="file" accept="image/*" aria-label={label} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(URL.createObjectURL(f)); e.target.value = ""; }}
      />
    </label>
  );
}

function MenuSelect<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <MenuFieldLabel>{label}</MenuFieldLabel>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}
          className="w-full border border-[#d1d5db] rounded-lg px-3 py-2 text-sm text-[#374151] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent pr-7"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>
  );
}

/* -- Main MenuPanel component -- */
function MenuPanel({ initialMenuName }: { initialMenuName?: string }) {
  const [cfg, setCfg] = useState<MenuConfig>({
    ...DEFAULT_MENU_CFG,
    menuStyle: mapMenuNameToStyle(initialMenuName),
  });

  useEffect(() => {
    const style = mapMenuNameToStyle(initialMenuName);
    setCfg((prev) => ({ ...prev, menuStyle: style }));
  }, [initialMenuName]);

  function set<K extends keyof MenuConfig>(k: K, v: MenuConfig[K]) {
    setCfg((prev) => ({ ...prev, [k]: v }));
  }

  function pickFile(onFile: (url: string) => void) {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = () => { const f = input.files?.[0]; if (f) onFile(URL.createObjectURL(f)); };
    input.click();
  }

  const BG_REPEAT_OPTS: { value: BgRepeat; label: string }[] = [
    { value: "no-repeat", label: "No repeat" },
    { value: "repeat-x",  label: "Repeat X"  },
    { value: "repeat-y",  label: "Repeat Y"  },
    { value: "repeat",    label: "Repeat"    },
  ];
  const BG_SIZE_OPTS: { value: BgSize; label: string }[] = [
    { value: "auto",      label: "Auto"       },
    { value: "cover",     label: "Cover"      },
    { value: "contain",   label: "Contain"    },
    { value: "100% 100%", label: "100% 100%"  },
  ];
  const BG_POS_OPTS: { value: BgPosition; label: string }[] = [
    { value: "left top",      label: "Left top"      },
    { value: "left center",   label: "Left center"   },
    { value: "left bottom",   label: "Left bottom"   },
    { value: "center top",    label: "Center top"    },
    { value: "center center", label: "Center center" },
    { value: "center bottom", label: "Center bottom" },
    { value: "right top",     label: "Right top"     },
    { value: "right center",  label: "Right center"  },
    { value: "right bottom",  label: "Right bottom"  },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden">

      {/* -- LEFT: settings (50%) -- */}
      <div className="w-1/2 h-full overflow-y-auto border-r border-[#e5e7eb] bg-white">

        <div className="px-6 py-5 border-b border-[#e5e7eb]">
          <h2 className="text-xl font-bold text-[#111827]">Menu</h2>
          <p className="text-sm text-[#6b7280] mt-0.5">Configure how learners will navigate your course.</p>
        </div>

        <div className="flex flex-col divide-y divide-[#f3f4f6]">

          {/* -- 1. Menu Style -- */}
          <section className="px-6 py-5 flex flex-col gap-3">
            <MenuFieldLabel required>Menu Style</MenuFieldLabel>
            <div className="grid grid-cols-3 gap-3">
              {MENU_OPTIONS.map((opt) => {
                const isSel = cfg.menuStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => set("menuStyle", opt.id)}
                    className={`text-left rounded-xl border-2 overflow-hidden transition-all focus:outline-none ${isSel ? "border-[#2d6fa8] shadow-md" : "border-[#e5e7eb] bg-white hover:border-[#93c5fd] hover:shadow-sm"}`}
                  >
                    {/* large thumbnail on top */}
                    <div className="w-full h-[120px] overflow-hidden relative bg-[#f3f4f6]">
                      {opt.thumb}
                      {isSel && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2d6fa8] flex items-center justify-center shadow">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </div>
                    {/* card body */}
                    <div className={`p-3 ${isSel ? "bg-[#f0f7ff]" : "bg-white"}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-bold text-[#111827] text-sm">{opt.name}</p>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSel ? "border-[#2d6fa8] bg-[#2d6fa8]" : "border-[#d1d5db]"}`}>
                          {isSel && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                      </div>
                      <p className="text-[11px] text-[#6b7280] leading-snug">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* -- 2. Logo -- */}
          <section className="px-6 py-5 flex flex-col gap-2.5">
            <MenuFieldLabel>Logo</MenuFieldLabel>
            {cfg.logoUrl ? (
              <div className="flex items-center gap-3 p-3 border border-[#e5e7eb] rounded-xl bg-[#f9fafb]">
                <img src={cfg.logoUrl} alt="logo" className="h-9 max-w-[72px] object-contain rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#374151]">Logo uploaded</p>
                  <p className="text-[11px] text-[#9ca3af]">PNG, SVG or JPG</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={() => pickFile((u) => set("logoUrl", u))} className="text-xs px-2.5 py-1.5 border border-[#d1d5db] rounded-lg text-[#374151] hover:bg-[#f3f4f6] transition-colors">Replace</button>
                  <button type="button" onClick={() => set("logoUrl", null)} className="text-xs px-2.5 py-1.5 border border-[#fca5a5] rounded-lg text-[#dc2626] hover:bg-[#fef2f2] transition-colors">Remove</button>
                </div>
              </div>
            ) : (
              <MenuUploadZone label="Click to upload logo (PNG, SVG, JPG)" onFile={(u) => set("logoUrl", u)} />
            )}

            {/* Logo Alignment */}
            <div className="flex flex-col gap-2">
              <MenuFieldLabel>Logo Alignment</MenuFieldLabel>
              <div className="flex rounded-lg border border-[#d1d5db] overflow-hidden">
                {(["left", "center", "right"] as const).map((align, i) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => set("titleAlign", align)}
                    aria-label={`Align ${align}`}
                    className={`flex-1 flex items-center justify-center py-2 transition-colors ${cfg.titleAlign === align ? "bg-[#2d6fa8] text-white" : "bg-white text-[#6b7280] hover:bg-[#f3f4f6]"} ${i > 0 ? "border-l border-[#d1d5db]" : ""}`}
                  >
                    {align === "left" && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/>
                      </svg>
                    )}
                    {align === "center" && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/>
                      </svg>
                    )}
                    {align === "right" && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* -- 3. Menu Title + Description -- */}
          <section className="px-6 py-5 flex flex-col gap-4">
            {/* Title */}
            <RichTextEditor
              label="Menu Title"
              html={cfg.menuTitle}
              onChange={(v) => set("menuTitle", v)}
              placeholder="e.g. Course Navigation"
              multiline={false}
              fontSize={cfg.titleFontSize}
              onFontSizeChange={(v) => set("titleFontSize", v)}
              color={cfg.titleColor}
              onColorChange={(v) => set("titleColor", v)}
            />

            {/* Description */}
            <RichTextEditor
              label="Description"
              html={cfg.menuDescription}
              onChange={(v) => set("menuDescription", v)}
              placeholder="e.g. Select a module to begin"
              multiline
              fontSize={cfg.descFontSize}
              onFontSizeChange={(v) => set("descFontSize", v)}
              color={cfg.descColor}
              onColorChange={(v) => set("descColor", v)}
            />
          </section>

          {/* -- 4. Header Image -- */}
          <section className="px-6 py-5 flex flex-col gap-2.5">
            <MenuFieldLabel>Header Image</MenuFieldLabel>
            <p className="text-[11px] text-[#6b7280] -mt-1">Shown above or below the menu title.</p>

            {/* position toggle */}
            <div className="flex gap-2">
              {(["above","below"] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => set("headerImageOrder", pos)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors ${cfg.headerImageOrder === pos ? "border-[#2d6fa8] bg-[#dbeeff] text-[#2d6fa8]" : "border-[#e5e7eb] text-[#6b7280] hover:border-[#93c5fd]"}`}
                >
                  {pos === "above"
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                  }
                  Image {pos} title
                </button>
              ))}
            </div>

            {cfg.headerImageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-[#e5e7eb] group">
                <img src={cfg.headerImageUrl} alt="header" className="w-full h-24 object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button type="button" onClick={() => pickFile((u) => set("headerImageUrl", u))} className="text-xs px-3 py-1.5 bg-white rounded-lg text-[#374151] font-medium shadow">Replace</button>
                  <button type="button" onClick={() => set("headerImageUrl", null)} className="text-xs px-3 py-1.5 bg-white rounded-lg text-[#dc2626] font-medium shadow">Remove</button>
                </div>
              </div>
            ) : (
              <MenuUploadZone label="Click to upload header image" onFile={(u) => set("headerImageUrl", u)} />
            )}
          </section>

          {/* -- 5. Background -- */}
          <section className="px-6 py-5 flex flex-col gap-3">
            <MenuFieldLabel>Background</MenuFieldLabel>

            {/* color / image toggle */}
            <div className="flex rounded-lg border border-[#d1d5db] overflow-hidden">
              {(["color","image"] as const).map((t, i) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("bgType", t)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${cfg.bgType === t ? "bg-[#2d6fa8] text-white" : "bg-white text-[#6b7280] hover:bg-[#f3f4f6]"} ${i > 0 ? "border-l border-[#d1d5db]" : ""}`}
                >
                  {t === "color" ? "Color" : "Image"}
                </button>
              ))}
            </div>

            {cfg.bgType === "color" ? (
              <div className="flex items-center gap-3">
                <label className="w-10 h-10 rounded-lg border-2 border-[#e5e7eb] overflow-hidden cursor-pointer hover:border-[#2d6fa8] transition-colors relative block shrink-0">
                  <input type="color" value={cfg.bgColor} onChange={(e) => set("bgColor", e.target.value)} aria-label="Background color" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <span className="block w-full h-full rounded-md" style={{ backgroundColor: cfg.bgColor }} />
                </label>
                <div>
                  <p className="text-xs font-medium text-[#374151]">Background color</p>
                  <p className="text-xs text-[#9ca3af] uppercase">{cfg.bgColor}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {cfg.bgImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-[#e5e7eb] group">
                    <img src={cfg.bgImageUrl} alt="background" className="w-full h-20 object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button type="button" onClick={() => pickFile((u) => set("bgImageUrl", u))} className="text-xs px-3 py-1.5 bg-white rounded-lg text-[#374151] font-medium shadow">Replace</button>
                      <button type="button" onClick={() => set("bgImageUrl", null)} className="text-xs px-3 py-1.5 bg-white rounded-lg text-[#dc2626] font-medium shadow">Remove</button>
                    </div>
                  </div>
                ) : (
                  <MenuUploadZone label="Click to upload background image" onFile={(u) => set("bgImageUrl", u)} />
                )}

                {cfg.bgImageUrl && (
                  <div className="flex flex-col gap-3">
                    <MenuSelect<BgRepeat>   label="Image Repeat"   value={cfg.bgRepeat}   options={BG_REPEAT_OPTS} onChange={(v) => set("bgRepeat", v)} />
                    <MenuSelect<BgSize>     label="Image Size"     value={cfg.bgSize}     options={BG_SIZE_OPTS}   onChange={(v) => set("bgSize", v)} />
                    <MenuSelect<BgPosition> label="Image Position" value={cfg.bgPosition} options={BG_POS_OPTS}    onChange={(v) => set("bgPosition", v)} />
                  </div>
                )}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* -- RIGHT: live preview (50%) -- */}
      <div className="w-1/2 h-full bg-[#f3f4f6] flex flex-col overflow-hidden">
        <div className="h-10 bg-white border-b border-[#e5e7eb] flex items-center px-5 shrink-0 gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2d6fa8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <span className="text-xs font-semibold text-[#6b7280] tracking-wide uppercase">Live Preview</span>
          {cfg.menuStyle && (
            <span className="ml-auto text-xs text-[#2d6fa8] font-medium">
              {MENU_OPTIONS.find((o) => o.id === cfg.menuStyle)?.name}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden p-6">
          <div className="w-full h-full">
            <MenuLivePreview cfg={cfg} />
          </div>
        </div>
      </div>

    </div>
  );
}

/* -- Shared checkbox row used across panels -- */
function CheckboxRow({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer group ${disabled ? "opacity-40 pointer-events-none" : "hover:bg-[#f9fafb]"}`}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
          checked ? "bg-[var(--life-primary-500)] border-[var(--life-primary-500)]" : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
        }`}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span className="text-sm text-[#374151] leading-snug">{label}</span>
    </label>
  );
}

/* ── Tracking & Analytics Panel ── */

interface TrackingState {
  /* Heading 1 - Tracking */
  trackingStandard: "scorm" | "xapi" | "hyperbridge" | "";

  /* Category 1 - Basic Settings */
  submitCompletionOnEveryAttempt: boolean;
  submitScoreToLms: boolean;

  /* Sub-category 1 - Tracking */
  storeQuestionState: boolean;
  storeQuestionAttemptState: boolean;
  recordInteractions: boolean;
  recordObjectives: boolean;
  shouldCompressData: boolean;

  /* Sub-category 2 - Reporting */
  trackingSuccessStatus: string;
  assessmentFailureStatus: string;

  /* Category 2 - Advanced Settings */
  scormVersion: string;
  scormDebugWindow: boolean;
  commitDataOnStatusChange: boolean;
  commitDataOnAnyChange: boolean;
  commitFrequencyMins: string;
  maxCommitRetries: string;
  commitRetryDelay: string;

  /* Heading 2 - Analytics */
  enableAnalytics: boolean;
  analyticsProvider: string;

  /* Advanced Settings - Analytics */
  projectTag: string;
  portfolio: string;
  resourceLinkId: string;
}

const DEFAULT_TRACKING: TrackingState = {
  trackingStandard: "",
  submitCompletionOnEveryAttempt: false,
  submitScoreToLms: false,
  storeQuestionState: false,
  storeQuestionAttemptState: false,
  recordInteractions: false,
  recordObjectives: false,
  shouldCompressData: false,
  trackingSuccessStatus: "passed",
  assessmentFailureStatus: "failed",
  scormVersion: "1.2",
  scormDebugWindow: false,
  commitDataOnStatusChange: false,
  commitDataOnAnyChange: false,
  commitFrequencyMins: "",
  maxCommitRetries: "",
  commitRetryDelay: "",
  enableAnalytics: false,
  analyticsProvider: "google",
  projectTag: "",
  portfolio: "",
  resourceLinkId: "",
};

function TrackingSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af] mb-2 mt-1">{children}</p>
  );
}

function TrackingSubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-[#6b7280] mb-2 flex items-center gap-1.5">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
      {children}
    </p>
  );
}

function TrackingTextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
      />
    </div>
  );
}

function TrackingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent pr-8"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

function AddTagButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#d1d5db] rounded-lg text-[#374151] hover:border-[#2d6fa8] hover:text-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      {label}
    </button>
  );
}


/* ---------------------------------------------------------------
   COMPLETION & PROGRESS PANEL
   --------------------------------------------------------------- */

/* shared primitives re-used across sub-sections */
function CpSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold text-[#111827] mb-0.5">{children}</h2>
  );
}

function CpSubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-[#374151] mb-3">{children}</h3>
  );
}

function CpDivider() {
  return <div className="border-t border-[#f3f4f6] my-6" />;
}

function CpFieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <span className="text-xs font-semibold text-[#374151]">{children}</span>
      {hint && <p className="text-xs text-[#6b7280] mt-0.5">{hint}</p>}
    </div>
  );
}

function CpTextInput({
  label, hint, value, onChange, placeholder,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <CpFieldLabel hint={hint}>{label}</CpFieldLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
      />
    </div>
  );
}

function CpSelect<T extends string>({
  label, hint, value, options, onChange,
}: {
  label: string; hint?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <CpFieldLabel hint={hint}>{label}</CpFieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          title={label}
          aria-label={label}
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[#111827] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent pr-8"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

function CpToggle({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5 cursor-pointer group">
      <span className="text-sm text-[#374151] leading-snug">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6fa8] ${
          checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "bg-[#e5e7eb] border-[#e5e7eb]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function CpRadioGroup<T extends string>({
  label, hint, value, options, onChange,
}: {
  label?: string; hint?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <CpFieldLabel hint={hint}>{label}</CpFieldLabel>}
      <div className="flex flex-col gap-0.5">
        {options.map((opt) => {
          const sel = value === opt.value;
          return (
            <label key={opt.value} className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-[#f9fafb] transition-colors">
              <div
                onClick={() => onChange(opt.value)}
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  sel ? "border-[#2d6fa8] bg-white" : "border-[#d1d5db] bg-white"
                }`}
              >
                {sel && <div className="w-2 h-2 rounded-full bg-[#2d6fa8]" />}
              </div>
              <span className="text-sm text-[#374151]">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CpCheckboxMulti({
  label, hint, options, selected, onChange,
}: {
  label?: string; hint?: string; options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);
  };
  return (
    <div className="flex flex-col gap-1">
      {label && <CpFieldLabel hint={hint}>{label}</CpFieldLabel>}
      <div className="flex flex-col gap-0.5">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label key={opt.value} className="flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-[#f9fafb] transition-colors group">
              <div
                onClick={() => toggle(opt.value)}
                className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${
                  checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
                }`}
              >
                {checked && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-[#374151] leading-snug">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CpInfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[#f0f7ff] border border-[#bfdbfe] px-3 py-2.5 text-xs text-[#1e40af]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

type BookmarkLocation = "page" | "block" | "component";
type BookmarkReturn = "previous" | "furthest";
type ProgressType = "pages" | "questions";
type ProgressFormat = "bar" | "stepper" | "percentage";

interface CompletionProgressState {
  /* 1 - Completion Rules */
  pageCompletionRule: "all-content" | "required-interaction";
  courseCompletionRule: "all-content" | "assessment";

  /* 2 - Completion Feedback */
  notifierLine1: string;
  notifierLine2: string;

  /* 3 - Resume & Bookmarking */
  bookmarkingEnabled: boolean;
  bookmarkingLevel: BookmarkLocation;
  bookmarkingReturn: BookmarkReturn;
  resumeEnabled: boolean;
  resumeTitle: string;
  resumeMessage: string;

  /* 4 - Progress Indicators */
  progressIndicators: string[];
  progressType: ProgressType;
  progressFormat: ProgressFormat;

  /* 5 - Time Estimate */
  timeIconClass: string;
  timeTextBefore: string;
  timeTextAfter: string;
  timeTextCompleted: string;
}

const DEFAULT_CP: CompletionProgressState = {
  pageCompletionRule: "all-content",
  courseCompletionRule: "all-content",
  notifierLine1: "",
  notifierLine2: "",
  bookmarkingEnabled: false,
  bookmarkingLevel: "component",
  bookmarkingReturn: "furthest",
  resumeEnabled: false,
  resumeTitle: "Continue where you left off?",
  resumeMessage: "Would you like to resume?",
  progressIndicators: [],
  progressType: "pages",
  progressFormat: "bar",
  timeIconClass: "icon-time",
  timeTextBefore: "Remaining time to complete module",
  timeTextAfter: "minutes",
  timeTextCompleted: "Module completed",
};

function CompletionProgressPanel() {
  const [cfg, setCfg] = useState<CompletionProgressState>(DEFAULT_CP);
  const set = <K extends keyof CompletionProgressState>(k: K, v: CompletionProgressState[K]) =>
    setCfg((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="max-w-2xl w-full">

      {/* -- Page header -- */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#111827]">Completion &amp; Progress</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Configure how course and page completion is tracked and displayed to learners.</p>
      </div>

      {/* ------------------------------------
          H1 - COMPLETION RULES
      ------------------------------------ */}
      <section>
        <CpSectionHeading>Completion Rules</CpSectionHeading>
        <p className="text-sm text-[#6b7280] mb-5">Define what counts as a completed page and a completed course.</p>

        {/* Page Completion */}
        <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#f3f4f6] bg-[#f9fafb]">
            <CpSubHeading>Page Completion</CpSubHeading>
            <p className="text-xs text-[#6b7280] -mt-2">Complete page when:</p>
          </div>
          <div className="px-4 py-3">
            <CpRadioGroup<"all-content" | "required-interaction">
              value={cfg.pageCompletionRule}
              onChange={(v) => set("pageCompletionRule", v)}
              options={[
                { value: "all-content",          label: "All content viewed" },
                { value: "required-interaction", label: "Required interaction completed" },
              ]}
            />
          </div>
        </div>

        {/* Course Completion */}
        <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f3f4f6] bg-[#f9fafb]">
            <CpSubHeading>Course Completion</CpSubHeading>
            <p className="text-xs text-[#6b7280] -mt-2">Complete course when:</p>
          </div>
          <div className="px-4 py-3">
            <CpRadioGroup<"all-content" | "assessment">
              value={cfg.courseCompletionRule}
              onChange={(v) => set("courseCompletionRule", v)}
              options={[
                { value: "all-content", label: "All content in the course must be completed" },
                { value: "assessment",  label: "The assessment must be completed" },
              ]}
            />
          </div>
        </div>
      </section>

      <CpDivider />

      {/* ------------------------------------
          H2 - COMPLETION FEEDBACK
      ------------------------------------ */}
      <section>
        <CpSectionHeading>Completion Feedback</CpSectionHeading>
        <p className="text-sm text-[#6b7280] mb-5">Customise the message shown to learners when they complete the course.</p>

        <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f3f4f6] bg-[#f9fafb]">
            <CpSubHeading>Completion Notifier</CpSubHeading>
            <p className="text-xs text-[#6b7280] -mt-2">Message for the course completion notifier</p>
          </div>
          <div className="px-4 py-4 flex flex-col gap-4">
            <CpTextInput
              label="Text for message first line"
              value={cfg.notifierLine1}
              onChange={(v) => set("notifierLine1", v)}
              placeholder="e.g. Congratulations!"
            />
            <CpTextInput
              label="Text for message second line"
              value={cfg.notifierLine2}
              onChange={(v) => set("notifierLine2", v)}
              placeholder="e.g. You have completed this course."
            />
          </div>
        </div>
      </section>

      <CpDivider />

      {/* ------------------------------------
          H3 - RESUME & BOOKMARKING
      ------------------------------------ */}
      <section>
        <CpSectionHeading>Resume and Bookmarking</CpSectionHeading>
        <p className="text-sm text-[#6b7280] mb-5">Control where learners return to when they re-enter the course.</p>

        {/* Bookmarking */}
        <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#f3f4f6] bg-[#f9fafb]">
            <CpToggle
              label="Enable Bookmarking"
              checked={cfg.bookmarkingEnabled}
              onChange={(v) => set("bookmarkingEnabled", v)}
            />
          </div>

          {cfg.bookmarkingEnabled && (
            <div className="px-4 py-4 flex flex-col gap-5">
              <CpSelect<BookmarkLocation>
                label="Bookmarking is done at"
                value={cfg.bookmarkingLevel}
                onChange={(v) => set("bookmarkingLevel", v)}
                options={[
                  { value: "page",      label: "Page" },
                  { value: "block",     label: "Block" },
                  { value: "component", label: "Component" },
                ]}
              />
              <CpInfoNote>Bookmarking done at component level will be the most accurate.</CpInfoNote>

              <CpSelect<BookmarkReturn>
                label="Bookmarking location - learner is taken back to"
                hint="Location: where the learner is returned on re-entry"
                value={cfg.bookmarkingReturn}
                onChange={(v) => set("bookmarkingReturn", v)}
                options={[
                  { value: "previous", label: "Previous" },
                  { value: "furthest", label: "Furthest" },
                ]}
              />
              {cfg.bookmarkingReturn === "furthest" && (
                <CpInfoNote>The Furthest option pairs well with sequential navigation, ensuring learners always progress forward.</CpInfoNote>
              )}
            </div>
          )}
        </div>

        {/* Resume */}
        <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f3f4f6] bg-[#f9fafb]">
            <CpToggle
              label="Enable Resume"
              checked={cfg.resumeEnabled}
              onChange={(v) => set("resumeEnabled", v)}
            />
          </div>

          {cfg.resumeEnabled && (
            <div className="px-4 py-4 flex flex-col gap-4">
              <CpTextInput
                label="Title"
                value={cfg.resumeTitle}
                onChange={(v) => set("resumeTitle", v)}
                placeholder="Continue where you left off?"
              />
              <CpTextInput
                label="Message"
                value={cfg.resumeMessage}
                onChange={(v) => set("resumeMessage", v)}
                placeholder="Would you like to resume?"
              />
            </div>
          )}
        </div>
      </section>

      <CpDivider />

      {/* ------------------------------------
          H3 - PROGRESS INDICATORS
      ------------------------------------ */}
      <section>
        <CpSectionHeading>Progress Indicators</CpSectionHeading>
        <p className="text-sm text-[#6b7280] mb-5">Choose which progress elements are visible to learners.</p>

        <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#f3f4f6] bg-[#f9fafb]">
            <span className="text-xs font-semibold text-[#374151]">Show progress indicators</span>
            <p className="text-xs text-[#6b7280] mt-0.5">Select all that apply</p>
          </div>
          <div className="px-4 py-3">
            <CpCheckboxMulti
              selected={cfg.progressIndicators}
              onChange={(v) => set("progressIndicators", v)}
              options={[
                { value: "page-completion",       label: "Show page completion" },
                { value: "course-completion",     label: "Show course completion indicator" },
                { value: "nav-bar",               label: "Show progress in the navigation bar" },
                { value: "all-content-objects",   label: "Display all content objects and the current page components" },
                { value: "course-level-nav-btn",  label: "Use course-level progress on navigation button" },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CpSelect<ProgressType>
            label="Progress Type"
            value={cfg.progressType}
            onChange={(v) => set("progressType", v)}
            options={[
              { value: "pages",     label: "Pages" },
              { value: "questions", label: "Questions" },
            ]}
          />
          <CpSelect<ProgressFormat>
            label="Progression Format"
            value={cfg.progressFormat}
            onChange={(v) => set("progressFormat", v)}
            options={[
              { value: "bar",        label: "Bar" },
              { value: "stepper",    label: "Stepper" },
              { value: "percentage", label: "Percentage" },
            ]}
          />
        </div>
      </section>

      <CpDivider />

      {/* ------------------------------------
          H4 - TIME ESTIMATE
      ------------------------------------ */}
      <section>
        <CpSectionHeading>Time Estimate</CpSectionHeading>
        <p className="text-sm text-[#6b7280] mb-5">Configure the time estimate display shown to learners.</p>

        <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
          <div className="px-4 py-4 flex flex-col gap-4">
            <CpTextInput
              label="Icon class"
              value={cfg.timeIconClass}
              onChange={(v) => set("timeIconClass", v)}
              placeholder="icon-time"
            />
            <CpTextInput
              label="Text before duration"
              value={cfg.timeTextBefore}
              onChange={(v) => set("timeTextBefore", v)}
              placeholder="Remaining time to complete module"
            />
            <CpTextInput
              label="Text after duration"
              value={cfg.timeTextAfter}
              onChange={(v) => set("timeTextAfter", v)}
              placeholder="minutes"
            />
            <CpTextInput
              label="Text shown when module is completed"
              value={cfg.timeTextCompleted}
              onChange={(v) => set("timeTextCompleted", v)}
              placeholder="Module completed"
            />
          </div>
        </div>

        {/* Live preview chip */}
        <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#f9fafb] border border-[#e5e7eb]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-xs text-[#374151]">
            <span className="font-medium">{cfg.timeTextBefore || "Remaining time to complete module"}</span>
            {" "}
            <span className="text-[#2d6fa8] font-semibold">15</span>
            {" "}
            {cfg.timeTextAfter || "minutes"}
          </span>
        </div>
      </section>

      {/* bottom padding */}
      <div className="h-8" />
    </div>
  );
}

/* -- Placeholder panel for sections not yet built -- */
function ComingSoonPanel({ label }: { label: string }) {
  return (
    <div className="max-w-2xl w-full flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#f3f4f6] border border-[#e5e7eb] flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-[#374151]">{label}</h2>
      <p className="text-sm text-[#9ca3af] mt-1">This section is coming soon.</p>
    </div>
  );
}

function LegacyTranslationPanel({ courseId }: { courseId: string }) {
  if (!courseId) {
    return (
      <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
        No course is associated with this setup flow, so translation cannot be opened.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 w-full overflow-hidden">
      <iframe
        title="Translation"
        src={`/?embed=translation#/translation/${encodeURIComponent(courseId)}`}
        className="w-full h-full border-0"
      />
    </div>
  );
}

/* -- Main page -- */
function CourseCreationCenterContent() {
  const [params] = useSearchParams();
  const routeParams = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canExportCourse = isSuperAdmin(user);
  const initialTitle = params.get("title") ?? "Untitled Course";
  const initialDescription = params.get("description") ?? "";
  const initialPanel = params.get("panel") ?? "";
  const courseId = routeParams.id ?? params.get("courseId") ?? "";

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [savedThemeName, setSavedThemeName] = useState("");
  const [savedMenuName, setSavedMenuName] = useState("");
  const [savedThemeVariables, setSavedThemeVariables] = useState<Record<string, unknown>>({});
  const [savedPresetId, setSavedPresetId] = useState("");

  const [activeNav, setActiveNav] = useState(() =>
    initialPanel === "storyboarding" ? "storyboarding" : initialPanel === "publish" ? "publish" : "overview",
  );
  const [collapsed, setCollapsed] = useState(false);
  const [exportingSource, setExportingSource] = useState(false);
  const [exportPopup, setExportPopup] = useState<{ status: "processing" | "success" | "error"; message: string } | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [publishDialogPhase, setPublishDialogPhase] = useState<PublishCoursePhase | null>(null);
  const [publishResult, setPublishResult] = useState<{ zipName?: string; downloadUrl?: string; message?: string }>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.id, true]))
  );
  const contentScrollRef = useRef<HTMLElement | null>(null);

  // Tracks requested navigation when on a panel with unsaved changes
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setTitle(initialTitle);
      setDescription(initialDescription);
      setSavedThemeName("");
      setSavedMenuName("");
      setSavedThemeVariables({});
      setSavedPresetId("");
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const data = await getCourseBootstrapData(courseId);
        if (cancelled) return;
        setTitle(data.displayTitle || data.title || initialTitle);
        setDescription(data.description || initialDescription);
        setSavedThemeName(data.themeName || "");
        setSavedMenuName(data.menuName || "");
        setSavedThemeVariables(data.themeVariables || {});
        setSavedPresetId(data.themePresetId || "");
      } catch {
        if (cancelled) return;
        setTitle(initialTitle);
        setDescription(initialDescription);
        setSavedThemeName("");
        setSavedMenuName("");
        setSavedThemeVariables({});
        setSavedPresetId("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, initialDescription, initialTitle]);

  useEffect(() => {
    if (!exportPopup || (exportPopup.status !== "success" && exportPopup.status !== "error")) return;
    const timer = window.setTimeout(() => setExportPopup(null), 3200);
    return () => window.clearTimeout(timer);
  }, [exportPopup]);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const activeItem = NAV_ITEMS.find((n) => !n.heading && n.id === activeNav);
  const loginName = user?.username || user?.email || "Not signed in";

  function toggleGroup(groupId: string) {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }

  // Smart navigation handler - used by sidebar items
  // When on a guarded setup panel, the page intercepts via pendingNavigation state.
  function handleNavigation(nextPanel: string) {
    if (nextPanel === activeNav) {
      return;
    }

    if (GUARDED_NAV_IDS.has(activeNav)) {
      // Signal to the active guarded setup page that navigation is requested.
      // The page decides whether to show a confirmation modal or allow navigation.
      setPendingNavigation(nextPanel);
    } else {
      setPendingNavigation(null);
      setActiveNav(nextPanel);
    }
  }

  function renderPanel() {
    if (activeNav === "overview") return <CourseOverviewPage courseId={courseId} title={title} description={description} onNavigationRequest={setActiveNav} pendingNavigation={pendingNavigation} onPendingNavigationHandled={() => setPendingNavigation(null)} />;
    if (activeNav === "structure")
      return (
        <CourseStructurePanel
          courseId={courseId}
          courseTitle={title}
          onOpenEditor={(pageId) => openEditor(pageId)}
          onOpenStoryboard={() => setActiveNav("storyboarding")}
          onNavigationRequest={setActiveNav}
          pendingNavigation={pendingNavigation}
          onPendingNavigationHandled={() => setPendingNavigation(null)}
        />
      );
    if (activeNav === "theme") return <SelectThemePage initialThemeName={savedThemeName} initialThemeVariables={savedThemeVariables} initialPresetId={savedPresetId} courseId={courseId} onNavigationRequest={setActiveNav} pendingNavigation={pendingNavigation} onPendingNavigationHandled={() => setPendingNavigation(null)} onThemeSaved={({ themeName, themeVariables, themePresetId }) => { setSavedThemeName(themeName); setSavedThemeVariables(themeVariables); setSavedPresetId(themePresetId); }} />;
    if (activeNav === "menu") return <MenuPage courseId={courseId} initialMenuName={savedMenuName} onNavigationRequest={setActiveNav} pendingNavigation={pendingNavigation} onPendingNavigationHandled={() => setPendingNavigation(null)} />;
    if (activeNav === "navigation") return <NavigationPage courseId={courseId} onNavigationRequest={setActiveNav} pendingNavigation={pendingNavigation} onPendingNavigationHandled={() => setPendingNavigation(null)} />;
    if (activeNav === "accessibility") return <AccessibilityPage courseId={courseId} onNavigationRequest={setActiveNav} pendingNavigation={pendingNavigation} onPendingNavigationHandled={() => setPendingNavigation(null)} />;
    if (activeNav === "tracking") return <TrackingAnalyticsPage courseId={courseId} onNavigationRequest={setActiveNav} pendingNavigation={pendingNavigation} onPendingNavigationHandled={() => setPendingNavigation(null)} />;
    if (activeNav === "learner-experience") return <LearnerExperiencePanel courseId={courseId} onNavigationRequest={setActiveNav} pendingNavigation={pendingNavigation} onPendingNavigationHandled={() => setPendingNavigation(null)} />;
    if (activeNav === "completion") return <CompletionProgressPage courseId={courseId} onNavigationRequest={setActiveNav} pendingNavigation={pendingNavigation} onPendingNavigationHandled={() => setPendingNavigation(null)} />;
    if (activeNav === "technical-settings") return <TechnicalSettingPage courseId={courseId} onNavigationRequest={setActiveNav} pendingNavigation={pendingNavigation} onPendingNavigationHandled={() => setPendingNavigation(null)} />;
    if (activeNav === "cdn-deployment") return <CdnDeploymentPage courseId={courseId} onNavigationRequest={setActiveNav} pendingNavigation={pendingNavigation} onPendingNavigationHandled={() => setPendingNavigation(null)} />;
    if (activeNav === "translation") return <LegacyTranslationPanel courseId={courseId} />;
    if (activeNav === "publish") return <PreflightValidatorPage courseId={courseId} onNavigationRequest={setActiveNav} />;
    if (activeNav === "export-pdf") {
      return (
        <ExportPdfPage
          courseId={courseId}
          courseTitle={title}
          onNavigationRequest={setActiveNav}
          pendingNavigation={pendingNavigation}
          onPendingNavigationHandled={() => setPendingNavigation(null)}
        />
      );
    }
    if (activeNav === "storyboarding")
      return (
        <StoryboardWorkspace
          courseId={courseId}
          courseTitle={title}
          onBack={() => setActiveNav("overview")}
        />
      );
    return <ComingSoonPanel label={activeItem?.label ?? ""} />;
  }

  function openExportDialog() {
    setShowExportDialog(true);
  }

  function openPublishDialog() {
    setPublishResult({});
    setPublishDialogPhase("confirm");
  }

  function closePublishDialog() {
    setPublishDialogPhase(null);
  }

  async function handleConfirmPublish() {
    const tenantId = user?._tenantId;
    if (!courseId || !tenantId) {
      setPublishResult({ message: "No course or tenant context available." });
      setPublishDialogPhase("error");
      return;
    }
    setPublishDialogPhase("running");
    try {
      const result = await publishCoursePackage(tenantId, courseId);
      if (result.success) {
        setPublishResult({ zipName: result.zipName, downloadUrl: result.downloadUrl });
        setPublishDialogPhase("success");
      } else {
        setPublishResult({ message: result.message });
        setPublishDialogPhase("error");
      }
    } catch (err) {
      setPublishResult({ message: err instanceof Error ? err.message : "Publish failed." });
      setPublishDialogPhase("error");
    }
  }

  function buildPageEditorState(pageId?: string) {
    return {
      courseId,
      title,
      description,
      theme: savedThemeName,
      menu: savedMenuName,
      ...(pageId ? { pageId } : {}),
    };
  }

  function openEditor(pageId?: string) {
    if (!courseId) return;

    const chosenPageId = (pageId || "").trim();
    if (chosenPageId) {
      window.sessionStorage.setItem(`setup:${courseId}:lastPageId`, chosenPageId);
    }

    navigate(`/course/${courseId}`, {
      state: buildPageEditorState(chosenPageId || undefined),
    });
  }

  function openPreview(startFromCurrentPage: boolean) {
    if (!courseId) return;

    const savedPageId = (window.sessionStorage.getItem(`setup:${courseId}:lastPageId`) || "").trim();
    const previewUrl = startFromCurrentPage && savedPageId
      ? `/course/${courseId}/preview?pageId=${encodeURIComponent(savedPageId)}`
      : `/course/${courseId}/preview`;
    navigate(previewUrl);
  }

  const primaryTopNav: "settings" | "storyboard" | "editor" = activeNav === "storyboarding" ? "storyboard" : "settings";

  useEffect(() => {
    // Avoid carrying scroll position across panels (e.g. opening Export PDF mid-page).
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeNav]);

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] overflow-hidden">
      {!courseId && (
        <div className="mx-4 mt-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          No backend course was initialized for this setup flow. Start from Create New Course on the dashboard.
        </div>
      )}
      <CommonCourseTopBarRow
        courseTitle={title}
        loginName={loginName}
        activeNav={primaryTopNav}
        onBack={() => window.history.length > 1 ? navigate(-1) : navigate("/")}
        onHome={() => navigate("/")}
        onOpenCourseSettings={() => {
          navigate(`/course/${courseId}/setup`);
          setActiveNav("overview");
        }}
        onOpenStoryboard={() => handleNavigation("storyboarding")}
        onOpenEditor={() => openEditor()}
        onOpenPreview={(startFromCurrentPage) => openPreview(startFromCurrentPage)}
        previewDisabled={!courseId}
        editorDisabled={!courseId}
      />

      {/* -- Second Row Header -- */}
      {/* Hidden on Storyboard: it isn't part of the Course Configuration nav
          (activeItem resolves to nothing there) and StoryboardTopBar already
          provides its own Export/Publish-equivalent actions. */}
      {activeNav !== "storyboarding" && (
        <div className="h-[56px] bg-white border-b border-[#d8dde6] flex items-center px-4 md:px-6 gap-3 shrink-0 relative z-10">
          <div className="flex items-center gap-2 text-[#111827] min-w-0">
            <SidebarMaskIcon file="overview-icon.svg" className="block w-[16px] h-[16px] shrink-0 bg-current opacity-80" />
            <span className="text-base font-semibold truncate">{activeItem?.label ?? "Course Overview"}</span>
          </div>

        <div className="ml-auto flex items-center gap-4">
          {canExportCourse && (
            <ExportMenu
              disabled={!courseId || !user?._tenantId}
              exportSourceLoading={exportingSource}
              onExportSource={() => {
                void runExportSourceAction({
                  exportingSource,
                  tenantId: user?._tenantId,
                  courseId,
                  setExportingSource,
                  onProcessingStart: () => {
                    setExportPopup({ status: "processing", message: "Preparing course source export…" });
                  },
                  onDownloadStarted: () => {
                    setExportPopup({ status: "success", message: "Course source exported successfully" });
                  },
                  onUnavailable: () => {
                    setExportPopup({ status: "error", message: "Course export is not available right now." });
                  },
                  onError: (message) => {
                    setExportPopup({ status: "error", message: `Unable to export source. ${message}` });
                  },
                });
              }}
              onExportPdf={() => {
                setExportPopup(null);
                setActiveNav("export-pdf");
              }}
            />
          )}
          <ExportMenu
            disabled={!courseId || !user?._tenantId}
            exportSourceLoading={exportingSource}
            onExportSource={() => {
              void runExportSourceAction({
                exportingSource,
                tenantId: user?._tenantId,
                courseId,
                setExportingSource,
                onProcessingStart: () => {
                  setExportPopup({ status: "processing", message: "Preparing course source export…" });
                },
                onDownloadStarted: () => {
                  setExportPopup({ status: "success", message: "Course source exported successfully" });
                },
                onUnavailable: () => {
                  setExportPopup({ status: "error", message: "Course export is not available right now." });
                },
                onError: (message) => {
                  setExportPopup({ status: "error", message: `Unable to export source. ${message}` });
                },
              });
            }}
            onExportPdf={() => {
              setExportPopup(null);
              setActiveNav("export-pdf");
            }}
          />

            <PublishMenuButton
              active={activeNav === "publish"}
              onSelectPreflight={() => handleNavigation("publish")}
              onSelectPublish={openPublishDialog}
            />
          </div>
        </div>
      )}

      {/* -- Body -- */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* -- Left panel -- */}
        {/* Hidden on Storyboard (ADAPT-3785): the Storyboard workspace is not
            one of this sidebar's nav items and ships its own full-bleed chrome
            (StoryboardTopBar) per the Figma design — showing Course
            Configuration alongside it duplicated navigation/export actions.
            Course Configuration itself is unaffected on every other tab. */}
        {activeNav !== "storyboarding" && (
        <aside
          className={`h-full bg-white border-r border-[#d8dde6] flex flex-col shrink-0 transition-all duration-200 ${collapsed ? "w-16" : "w-[256px]"}`}
        >
          {/* Collapse toggle */}
          <div className={`flex items-center h-14 border-b border-[#d8dde6] px-4 shrink-0 ${collapsed ? "justify-center" : "justify-between"}`}>
            {!collapsed && (
              <div>
                <p className="text-[13px] leading-none font-bold text-[#1f1f1f] tracking-tight">Course Configuration</p>
              </div>
            )}
            <div className="relative group">
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand panel" : "Collapse panel"}
                className="w-9 h-9 rounded-lg text-[#9ca3af] hover:bg-[var(--life-neutral-100)] transition-colors flex items-center justify-center cursor-pointer"
              >
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[8px] bg-[#215369] px-3 py-1 text-[11px] font-medium text-[#ffffff] opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </span>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col gap-0.5 px-0 pt-2 flex-1 overflow-y-auto pb-4">
            {collapsed ? (
              NAV_GROUPS.map((group) => (
                <div key={group.id}>
                  <div className="mx-3 my-2 border-t border-[#e5e7eb]" />
                  {group.items.map((item) => {
                    const isActive = activeNav === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigation(item.id)}
                        title={item.label}
                        className="relative flex items-center justify-center w-full py-1.5 transition-colors cursor-pointer"
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                            isActive ? "bg-[var(--life-primary-100)] text-[#236585]" : "text-[#6b7280] hover:bg-[var(--life-neutral-100)]"
                          }`}
                        >
                          <span className="shrink-0">{item.icon}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              NAV_GROUPS.map((group) => {
                const groupExpanded = expandedGroups[group.id] ?? true;
                const groupIsActive = group.items.some((item) => item.id === activeNav);
                return (
                  <div key={group.id} className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className={`w-full px-5 py-2 flex items-center justify-between text-left font-[var(--font-family-primary)] text-[11px] leading-none font-[700] uppercase tracking-[0.08em] transition-colors cursor-pointer ${groupIsActive ? "text-[#2e7fa1]" : "text-[#6b7280]"}`}
                      style={{ fontWeight: 700 }}
                    >
                      <span>{group.label}</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform duration-200 ${groupExpanded ? "" : "-rotate-90"}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {groupExpanded && group.items.map((item) => {
                      const isActive = activeNav === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavigation(item.id)}
                          className={`relative flex items-center gap-3 px-5 py-2 text-left w-full font-[var(--font-family-primary)] font-[400] transition-colors cursor-pointer ${
                            isActive
                              ? "bg-[var(--life-primary-100)] text-[#236585]"
                              : "text-[#5b6674] hover:bg-[var(--life-neutral-100)] hover:text-[#374151]"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute left-0 top-0 h-full w-[3px] rounded-r-sm transition-opacity ${isActive ? "bg-[var(--life-primary-500)] opacity-100" : "opacity-0"}`}
                          />
                          <span className="shrink-0">{item.icon}</span>
                          <span className="font-[var(--font-family-primary)] text-[var(--text-p)] font-[var(--font-weight-regular)] leading-[1.5] whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </nav>

        </aside>
        )}

        {/* -- Right content panel -- */}
        <main ref={contentScrollRef} className={`flex-1 overflow-hidden min-h-0 bg-[#f8fafc] ${activeNav === "menu" || activeNav === "navigation" || activeNav === "storyboarding" || activeNav === "translation" ? "" : "overflow-y-auto px-8 py-8"}`}>
          {renderPanel()}
        </main>
      </div>
      {showExportDialog && <ExportDialog onClose={() => setShowExportDialog(false)} />}

      {publishDialogPhase && (
        <PublishCourseDialog
          phase={publishDialogPhase}
          courseTitle={title}
          zipName={publishResult.zipName}
          downloadUrl={publishResult.downloadUrl}
          errorMessage={publishResult.message}
          onConfirm={() => void handleConfirmPublish()}
          onClose={closePublishDialog}
        />
      )}
      <AiAssistant context="Course Creation Center" suggestions={[
        'How do I set up my course structure?',
        'What does the Preflight Validator check?',
        'How do I configure SCORM tracking?',
      ]} />
      {exportPopup && <ExportStatusPopup status={exportPopup.status} message={exportPopup.message} />}
    </div>
  );
}

export default function CourseCreationCenterPage() {
  return (
    <Suspense>
      <CourseCreationCenterContent />
    </Suspense>
  );
}