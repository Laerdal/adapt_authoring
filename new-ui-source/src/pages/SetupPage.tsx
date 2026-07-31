import { useSearchParams, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import AiAssistant from "../components/common/AiAssistant";
import CourseStructureMapView from "../components/course/CourseStructureMapView";
import CourseStructureTree from "../components/course/CourseStructureTree";
import AddComponentDrawer from "../components/course/AddComponentDrawer";
import { getCourseBootstrapData, saveThemeForCourse, saveThemeVariables, getThemePresets, saveThemePreset, applyThemePreset, type ThemePreset } from "../api/adaptAuthoring";
import { useCourseStructure } from "../hooks/useCourseStructure";
import { STRUCTURE_LABELS } from "../types/structure";

/* ── Nav items ── */
const NAV_ITEMS = [
  {
    id: "heading-views",
    label: "Views",
    heading: true,
    icon: null,
  },
  {
    id: "overview",
    label: "Course Overview",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    id: "structure",
    label: "Course Structure",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    id: "theme",
    label: "Theme",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    id: "menu",
    label: "Menu",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    ),
  },
  {
    id: "navigation",
    label: "Navigation",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    id: "accessibility",
    label: "Accessibility",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
  },
  {
    id: "tracking",
    label: "Tracking & Analytics",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: "completion",
    label: "Completion & Progress",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    id: "learner-experience",
    label: "Learner Experience",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M12 6v6l4 2.5" />
      </svg>
    ),
  },
  {
    id: "technical-settings",
    label: "Technical Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1" />
        <path d="M12 1v6m0 6v6" />
        <path d="M4.22 4.22l4.24 4.24m2.96 3.08l4.24 4.24M1 12h6m6 0h6" />
        <path d="M4.22 19.78l4.24-4.24m2.96-3.08l4.24-4.24M19.78 4.22l-4.24 4.24m-2.96 3.08l-4.24 4.24" />
      </svg>
    ),
  },
  {
    id: "heading-action",
    label: "Action",
    heading: true,
    icon: null,
  },
  {
    id: "cdn-deployment",
    label: "CDN Deployment",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="2" y1="20" x2="22" y2="20" />
        <line x1="6" y1="17" x2="6" y2="20" />
        <line x1="18" y1="17" x2="18" y2="20" />
      </svg>
    ),
  },
  {
    id: "storyboarding",
    label: "Storyboarding",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="6" height="6" /><rect x="10" y="2" width="6" height="6" />
        <rect x="18" y="2" width="4" height="6" /><rect x="2" y="10" width="6" height="6" />
        <rect x="10" y="10" width="6" height="6" /><rect x="18" y="10" width="4" height="6" />
      </svg>
    ),
  },
  {
    id: "preflight-validator",
    label: "Preflight Validator",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    id: "translation",
    label: "Translation",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
];

/* ── Course Overview panel ── */
function CourseOverviewPanel({ title, description }: { title: string; description: string }) {
  const [editing, setEditing] = useState(false);
  const [formTitle, setFormTitle] = useState(title);
  const [formSubTitle, setFormSubTitle] = useState("");
  const [formDesc, setFormDesc] = useState(description);
  const [formInstructions, setFormInstructions] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formCollaborators, setFormCollaborators] = useState("");

  const fieldClass = "w-full px-3 py-2.5 text-sm rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent focus:bg-white transition-colors";
  const readonlyClass = "w-full px-3 py-2.5 text-sm rounded-lg bg-[#f3f4f6] text-[#6b7280]";

  return (
    <div className="max-w-2xl w-full">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">Course Overview</h2>
          <p className="text-sm text-[#6b7280] mt-0.5">Review and edit the core details for your course.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors shrink-0"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {/* Course Title */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">
            Course Title <span className="text-[#ef4444]">*</span>
          </label>
          {editing ? (
            <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Enter course title" className={fieldClass} />
          ) : (
            <div className={readonlyClass}>{formTitle || <span className="text-[#9ca3af]">No title set</span>}</div>
          )}
        </div>

        {/* Course Sub-Title */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Course Sub-Title</label>
          {editing ? (
            <input type="text" value={formSubTitle} onChange={(e) => setFormSubTitle(e.target.value)} placeholder="No sub-title set" className={fieldClass} />
          ) : (
            <div className={readonlyClass}><span className="text-[#9ca3af]">{formSubTitle || "No sub-title set"}</span></div>
          )}
        </div>

        {/* Course Description */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Course Description</label>
          {editing ? (
            <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={3} placeholder="No description set" className={`${fieldClass} resize-none`} />
          ) : (
            <div className={readonlyClass}><span className="text-[#9ca3af]">{formDesc || "No description set"}</span></div>
          )}
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Instructions</label>
          {editing ? (
            <textarea value={formInstructions} onChange={(e) => setFormInstructions(e.target.value)} rows={2} placeholder="No instructions set" className={`${fieldClass} resize-none`} />
          ) : (
            <div className={readonlyClass}><span className="text-[#9ca3af]">{formInstructions || "No instructions set"}</span></div>
          )}
        </div>

        {/* Course Image */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Course Image</label>
          <div className="w-full h-32 rounded-lg bg-[#f3f4f6] border border-[#e5e7eb] flex items-center justify-center text-sm text-[#9ca3af]">
            {editing ? (
              <label className="cursor-pointer flex flex-col items-center gap-2 text-[#6b7280] hover:text-[#2d6fa8] transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-xs">Click to upload image</span>
                <input type="file" accept="image/*" className="hidden" title="Upload course image" aria-label="Upload course image" />
              </label>
            ) : (
              "No image uploaded"
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Tags</label>
          {editing ? (
            <input type="text" value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="Add tags, separated by commas" className={fieldClass} />
          ) : (
            <div className={readonlyClass}><span className="text-[#9ca3af]">{formTags || "No tags added"}</span></div>
          )}
        </div>

        <div className="border-t border-[#e5e7eb] pt-5">
          <div className="mb-1">
            <p className="text-sm font-semibold text-[#111827]">Collaboration — Shared With</p>
            <p className="text-xs text-[#6b7280] mt-0.5">Collaborators who have access to this course</p>
          </div>
          <div className="mt-3">
            {editing ? (
              <input type="text" value={formCollaborators} onChange={(e) => setFormCollaborators(e.target.value)} placeholder="Add collaborator email addresses" className={fieldClass} />
            ) : (
              <div className={readonlyClass}><span className="text-[#9ca3af]">{formCollaborators || "No collaborators added"}</span></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Course Structure panel ── */
function CourseStructurePanel({
  courseId,
  courseTitle,
  onOpenEditor,
}: {
  courseId: string;
  courseTitle: string;
  onOpenEditor: (topicId: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"tree" | "map">("tree");
  // Content-group id whose Add Component drawer is open (null = closed).
  const [addComponentBlockId, setAddComponentBlockId] = useState<string | null>(null);
  const {
    state,
    loading,
    busy,
    error,
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
            {/* Tree toggle glyph — from public/assets/icons/Icon-tree.svg (currentColor so it tints per state) */}
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
            {/* Map toggle glyph — from public/assets/icons/Icon-map.svg (currentColor so it tints per state) */}
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

      {/* Info / rules banner */}
      <div className="mb-5 p-3.5 rounded-lg bg-[#f0faf8] border border-[#99e6de] text-sm text-[#0d7377]">
        Organize your course into modules, topics, sections, content groups and components. At least one topic
        is mandatory at the course level, and every module must contain at least one topic.
      </div>

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
          Loading course structure…
        </div>
      ) : (
        <div className={busy ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
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

      {addComponentBlockId && (
        <AddComponentDrawer
          onClose={() => setAddComponentBlockId(null)}
          onSelect={(componentType) => {
            addComponent(addComponentBlockId, componentType);
            setAddComponentBlockId(null);
          }}
        />
      )}
    </div>
  );
}

/* ── Theme panel helpers ── */
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

const PAGE_TITLE_OPTIONS = ["H1", "H2", "H3", "H4", "H5", "H6", "Paragraph"];

const PAGE_TITLE_LABELS: Record<string, string> = {
  H1: "H1 — 3.5rem", H2: "H2 — 3rem", H3: "H3 — 2.5rem",
  H4: "H4 — 2rem", H5: "H5 — 1.5rem", H6: "H6 — —",
  Paragraph: "Paragraph — 1.125rem",
};

const PREVIEW_TITLE_SIZE: Record<string, string | null> = {
  H1: "1.7rem", H2: "1.45rem", H3: "1.25rem",
  H4: "1.1rem", H5: "1rem", H6: null,
  Paragraph: "0.95rem",
};

const CALC_VALUES = [
  { label: "H1 (Page Title)", rem: "3.5rem", px: "56px" },
  { label: "H2", rem: "3rem", px: "48px" },
  { label: "H3", rem: "2.5rem", px: "40px" },
  { label: "H4", rem: "2rem", px: "32px" },
  { label: "H5", rem: "1.5rem", px: "24px" },
  { label: "Paragraph", rem: "1.125rem", px: "18px" },
];

const H1_SIZE_OPTIONS = [
  { label: "H1 — 3.5rem", value: "3.5rem" },
  { label: "H2 — 3rem",   value: "3rem" },
  { label: "H3 — 2.5rem", value: "2.5rem" },
  { label: "H4 — 2rem",   value: "2rem" },
  { label: "H5 — 1.5rem", value: "1.5rem" },
  { label: "H6 — —",      value: "h6" },
  { label: "Paragraph — 1.125rem", value: "1.125rem" },
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
      {open && <div className="px-4 pb-5 pt-1 border-t border-[#f3f4f6] bg-white">{children}</div>}
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
            <h1 className="font-bold mb-3" style={{ ...headingStyle, fontSize: h1Size }}>{cfg.pageTitleSize === "h6" ? "—" : "New Menu/Page Title"}</h1>

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

/* ── Global Theme accordion content ── */
function GlobalThemeSection({ cfg, setCfg }: { cfg: CustomThemeValues; setCfg: (v: CustomThemeValues) => void }) {
  const set = <K extends keyof CustomThemeValues>(k: K, v: CustomThemeValues[K]) => setCfg({ ...cfg, [k]: v });

  const calcSizes = () => {
    const base = cfg.pageTitleSize === "h6" ? null : parseFloat(cfg.pageTitleSize);
    if (!base) return null;
    return [
      { label: "H1 (Page Title)", size: base, px: Math.round(base * 16) },
      { label: "H2", size: +(base - 0.5).toFixed(1), px: Math.round((base - 0.5) * 16) },
      { label: "H3", size: +(base - 1).toFixed(1), px: Math.round((base - 1) * 16) },
      { label: "H4", size: +(base - 1.5).toFixed(1), px: Math.round((base - 1.5) * 16) },
      { label: "H5", size: +(base - 2).toFixed(1), px: Math.round((base - 2) * 16) },
      { label: "Paragraph", size: 1.125, px: 18 },
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
        {sizes && (
          <div className="mt-2 rounded-lg bg-[#f0f7ff] border-l-4 border-[#2d6fa8] px-4 py-3 text-xs text-[#374151] space-y-0.5">
            <p className="font-semibold text-[#111827] mb-1">Calculated values for Desktop:</p>
            {sizes.map((s) => (
              <p key={s.label}><span className="font-semibold">{s.label}:</span> {s.size}rem ({s.px}px)</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Custom theme full editor ── */
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
        {/* ── Custom Icons: Sprite Sheets ── */}
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

        {/* ── Custom Icons: Single Icons ── */}
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

        {/* ── Configuration: Component ── */}
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

        {/* ── Accordions ── */}
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

/* ── Theme selection panel ── */
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

const ACCORDION_DEFS = [
  { id: 'global', label: 'Global Theme' },
  { id: 'page', label: 'Page Structure' },
  { id: 'progress', label: 'Progress Styling' },
  { id: 'navigation', label: 'Navigation Styling' },
  { id: 'menu', label: 'Menu Styling' },
  { id: 'feedback', label: 'Feedback & Validation' },
  { id: 'overlays', label: 'Overlays Styling' },
];

const VANILLA_ACCORDION_DEFS: { id: string; label: string; fields: string[] }[] = [
  {
    id: 'global', label: 'Global',
    fields: [
      'Font colour', 'Font colour inverted', 'Link font colour',
      'Link font colour - inverted', 'Link font colour - hover',
      'Link font colour - inverted hover', 'Heading colour', 'Heading colour - inverted',
    ],
  },
  {
    id: 'items', label: 'Items (Components)',
    fields: [
      'Item colour', 'Item colour - inverted', 'Item colour - hover',
      'Item colour - inverted hover', 'Item colour - selected',
      'Item colour - inverted selected', 'Visited colour', 'Visited colour - inverted',
    ],
  },
  {
    id: 'buttons', label: 'Buttons',
    fields: [
      'Button colour', 'Button colour - inverted', 'Button colour - hover',
      'Button colour - inverted hover', 'Button icon colour', 'Button icon colour - inverted',
      'Button icon colour - hover', 'Button icon colour - inverted hover',
      'Disabled colour', 'Disabled colour - inverted',
    ],
  },
  {
    id: 'validation', label: 'Validation States',
    fields: [
      'Validation success colour', 'Validation success colour - inverted',
      'Validation error colour', 'Validation error colour - inverted',
    ],
  },
  {
    id: 'progress', label: 'Progress',
    fields: [
      'Progress fill colour', 'Progress background colour', 'Progress border colour',
    ],
  },
  {
    id: 'menu', label: 'Menu',
    fields: [
      'Menu header background colour', 'Menu header title colour', 'Menu header subtitle colour',
      'Menu header body colour', 'Menu header instruction colour', 'Menu item colour',
      'Menu item colour - inverted', 'Menu item border colour',
      'Menu item progress fill colour', 'Menu item progress background colour',
      'Menu item progress border colour', 'Menu item button background colour',
      'Menu item button background colour - inverted', 'Menu item button background colour - hover',
      'Menu item button background colour - inverted hover',
    ],
  },
  {
    id: 'navigation', label: 'Navigation',
    fields: [
      'Navigation background colour', 'Navigation background colour - inverted',
      'Navigation button background colour', 'Navigation button background colour - inverted',
      'Navigation button background colour - hover', 'Navigation button background colour - inverted hover',
      'Navigation progress fill colour', 'Navigation progress background colour - inverted',
      'Navigation progress border colour', 'Navigation progress fill colour - hover',
      'Navigation progress background colour - inverted hover', 'Navigation progress border colour - hover',
    ],
  },
  {
    id: 'notify', label: 'Notify (Pop up)',
    fields: [
      'Notify background colour', 'Notify background colour - inverted',
      'Notify link font colour', 'Notify link font colour - hover',
      'Notify button background colour', 'Notify button background colour - inverted',
      'Notify button background colour - hover', 'Notify button background colour - inverted hover',
      'Notify icon button background colour', 'Notify icon button background colour - inverted',
      'Notify icon button background colour - hover', 'Notify icon button background colour - inverted hover',
    ],
  },
  {
    id: 'drawer', label: 'Drawer',
    fields: [
      'Drawer background colour', 'Drawer background colour - inverted',
      'Drawer link font colour', 'Drawer link font colour - hover',
      'Drawer icon button background colour', 'Drawer icon button background colour - inverted',
      'Drawer icon button background colour - hover', 'Drawer icon button background colour - inverted hover',
      'Drawer item background colour', 'Drawer item background colour - inverted',
      'Drawer item background colour - hover', 'Drawer item background colour - inverted hover',
      'Drawer item background colour - selected', 'Drawer item background colour - inverted selected',
      'Drawer progress fill colour', 'Drawer progress background colour', 'Drawer progress border colour',
      'Drawer progress colour - hover', 'Drawer progress colour - inverted hover',
      'Drawer progress border colour - hover',
    ],
  },
  {
    id: 'misc', label: 'Misc',
    fields: [
      'Background colour', 'Background colour - inverted',
      'Shadow background colour (loading / pop up background)', 'Shadow background colour - inverted',
      'Loading animation background colour', 'Loading animation colour - inverted',
    ],
  },
];

function ThemePanel({ initialThemeName, initialThemeVariables, initialPresetId, courseId }: {
  initialThemeName?: string;
  initialThemeVariables?: Record<string, unknown>;
  initialPresetId?: string;
  courseId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(mapThemeNameToId(initialThemeName));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Presets
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId ?? '');
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetNameInput, setShowPresetNameInput] = useState(false);

  // Load presets for the selected theme slug
  useEffect(() => {
    const themeSlugMap: Record<string, string> = { life: 'lifetheme', vanilla: 'vanillatheme', custom: 'customtheme' };
    const slug = selected ? themeSlugMap[selected] : undefined;
    if (!slug) { setPresets([]); return; }
    getThemePresets(slug).then(setPresets).catch(() => setPresets([]));
  }, [selected]);

  async function handleSave() {
    if (!courseId || !selected) return;
    const labelMap: Record<string, string> = { life: 'LIFE Theme', vanilla: 'Vanilla Theme', custom: 'Custom Theme' };
    const themeLabel = labelMap[selected];
    if (!themeLabel) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveThemeForCourse(courseId, themeLabel);
      // Build themeVariables payload — always include component checkbox settings for LIFE/Custom
      let vars: Record<string, unknown> = {};
      if (selected === 'custom') vars = { ...customSettings };
      else if (selected === 'vanilla') vars = { ...vanillaColors };
      // Component configuration checkboxes (field names from theme schema)
      if (selected === 'life' || selected === 'custom') {
        vars._components = {
          _canShowFinalMarking: checkNotFinal,
          _hidePartiallyDisplayMarking: checkUnanswered,
          _hideFeedbackFirstAttempt: checkHideFeedback,
          _hidePartiallyFeedback: checkHidePartial,
        };
      }
      await saveThemeVariables(courseId, vars);
      // Apply preset if one is selected
      if (selectedPresetId) await applyThemePreset(selectedPresetId, courseId);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePreset() {
    if (!newPresetName.trim() || !selected || !courseId) return;
    const themeSlugMap: Record<string, string> = { life: 'lifetheme', vanilla: 'vanillatheme', custom: 'customtheme' };
    const slug = themeSlugMap[selected];
    let vars: Record<string, unknown> = {};
    if (selected === 'custom') vars = { ...customSettings };
    else if (selected === 'vanilla') vars = { ...vanillaColors };
    if (selected === 'life' || selected === 'custom') {
      vars._components = {
        _canShowFinalMarking: checkNotFinal,
        _hidePartiallyDisplayMarking: checkUnanswered,
        _hideFeedbackFirstAttempt: checkHideFeedback,
        _hidePartiallyFeedback: checkHidePartial,
      };
    }
    try {
      const created = await saveThemePreset(newPresetName.trim(), slug, vars);
      setPresets((prev) => [...prev, created]);
      setSelectedPresetId(created._id);
      setNewPresetName('');
      setShowPresetNameInput(false);
    } catch { /* silent */ }
  }
  const [checkNotFinal, setCheckNotFinal] = useState(false);
  const [checkUnanswered, setCheckUnanswered] = useState(false);
  const [checkHideFeedback, setCheckHideFeedback] = useState(false);
  const [checkHidePartial, setCheckHidePartial] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const [activeVanillaAccordion, setActiveVanillaAccordion] = useState<string | null>('global');
  const [vanillaColors, setVanillaColors] = useState<Record<string, string>>({});
  const [activeCustomAccordion, setActiveCustomAccordion] = useState<string | null>('global');
  const [customSettings, setCustomSettings] = useState({
    primaryColor: '#2d6fa8',
    secondaryColor: '#5aad78',
    headingFont: 'Lato',
    paragraphFont: 'Lato',
    fontColor: '#111827',
    headingFontColor: '#111827',
    instructionColor: '#6b7280',
    linkFontColor: '#2d6fa8',
    pageTitleSize: 'H1',
    pageBackgroundColor: '#ffffff',
    pageBorderColor: '#e5e7eb',
    progressFillColor: '#2d6fa8',
    progressBackgroundColor: '#e5e7eb',
    progressBorderColor: '#d1d5db',
    navBackground: '#ffffff',
    navTextColor: '#111827',
    navBorderColor: '#e5e7eb',
    navHoverColor: '#f9fafb',
    menuBackground: '#ffffff',
    menuTextColor: '#111827',
    menuHoverBackground: '#f9fafb',
    menuActiveColor: '#2d6fa8',
    successColor: '#22c55e',
    errorColor: '#ef4444',
    warningColor: '#f59e0b',
    infoColor: '#3b82f6',
    overlayBackground: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#ffffff',
    modalBorderColor: '#e5e7eb',
    modalShadowColor: 'rgba(0, 0, 0, 0.1)',
  });

  useEffect(() => {
    setSelected(mapThemeNameToId(initialThemeName));
  }, [initialThemeName]);

  // Load saved themeVariables into customSettings / vanillaColors / checkboxes
  useEffect(() => {
    if (!initialThemeVariables || Object.keys(initialThemeVariables).length === 0) return;
    const v = initialThemeVariables;
    // Custom theme fields
    const customKeys = ['primaryColor','secondaryColor','headingFont','paragraphFont','fontColor',
      'headingFontColor','instructionColor','linkFontColor','pageTitleSize','pageBackgroundColor',
      'pageBorderColor','progressFillColor','progressBackgroundColor','progressBorderColor',
      'navBackground','navTextColor','navBorderColor','navHoverColor','menuBackground',
      'menuTextColor','menuHoverBackground','menuActiveColor','successColor','errorColor',
      'warningColor','infoColor','overlayBackground','modalBackground','modalBorderColor','modalShadowColor'];
    const customPatch: Record<string, string> = {};
    customKeys.forEach((k) => { if (typeof v[k] === 'string') customPatch[k] = v[k] as string; });
    if (Object.keys(customPatch).length) setCustomSettings((prev) => ({ ...prev, ...customPatch }));
    // Vanilla colors are keyed like 'global::Font colour'
    const vanillaPatch: Record<string, string> = {};
    Object.keys(v).forEach((k) => { if (k.includes('::') && typeof v[k] === 'string') vanillaPatch[k] = v[k] as string; });
    if (Object.keys(vanillaPatch).length) setVanillaColors(vanillaPatch);
    // Component configuration checkboxes (restored from _components section of themeVariables)
    const comp = v._components as Record<string, unknown> | undefined;
    if (comp) {
      if (typeof comp._canShowFinalMarking === 'boolean') setCheckNotFinal(comp._canShowFinalMarking);
      if (typeof comp._hidePartiallyDisplayMarking === 'boolean') setCheckUnanswered(comp._hidePartiallyDisplayMarking);
      if (typeof comp._hideFeedbackFirstAttempt === 'boolean') setCheckHideFeedback(comp._hideFeedbackFirstAttempt);
      if (typeof comp._hidePartiallyFeedback === 'boolean') setCheckHidePartial(comp._hidePartiallyFeedback);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Color Picker Component
  const ColorPickerField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <p className="text-xs font-bold text-[#111827] mb-2">{label}</p>
      <div className="flex gap-2 items-center">
        <label className="w-8 h-8 rounded border border-[#d1d5db] cursor-pointer flex-shrink-0 block overflow-hidden relative">
          <span className="block w-full h-full" style={{ backgroundColor: value }} />
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <input type="text" value={value.toUpperCase()} onChange={e => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v); }} className="text-xs flex-1 border border-[#d1d5db] rounded px-2 py-1 text-[#111827] focus:border-[#2d6fa8] outline-none" />
      </div>
    </div>
  );

  // Font Dropdown Component
  const FontDropdownField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <p className="text-xs font-bold text-[#111827] mb-2">{label}</p>
      <select value={value} onChange={e => onChange(e.target.value)} className="text-xs w-full border border-[#d1d5db] rounded px-2 py-1 text-[#111827] bg-white cursor-pointer focus:border-[#2d6fa8] outline-none">
        {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
    </div>
  );

  // Live Preview Component
  const LivePreview = () => {
    const [darkMode, setDarkMode] = useState(false);
    const previewBg = darkMode ? '#1a1a1a' : '#f8f8f8';
    const textColor = darkMode ? '#e8e8e8' : customSettings.fontColor;
    const headingColor = darkMode ? '#ffffff' : customSettings.headingFontColor;
    const titleSize = PREVIEW_TITLE_SIZE[customSettings.pageTitleSize];

    return (
      <div className="border border-[#e5e7eb] rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-[#e5e7eb]">
          <div className="flex items-center gap-2">
            <div style={{ width: '13px', height: '13px', backgroundColor: customSettings.primaryColor, borderRadius: '2px' }} />
            <span className="text-xs font-bold text-[#111827]">Live Preview</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setDarkMode(!darkMode)} className="w-7 h-7 flex items-center justify-center bg-transparent border border-[#e5e7eb] rounded text-[#6b7280] hover:bg-[#f9fafb]" title="Toggle dark mode">
              {darkMode ? '☀' : '🌙'}
            </button>
          </div>
        </div>
        <div style={{ backgroundColor: previewBg, fontSize: '13px' }}>
          <div style={{ height: '4px', background: `linear-gradient(to right, ${customSettings.primaryColor} 60%, ${darkMode ? '#333' : '#e0e0e0'} 60%)` }} />
          <div style={{ background: customSettings.primaryColor, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px' }}>☰</span>
            <span style={{ fontFamily: `${customSettings.paragraphFont}, sans-serif`, fontSize: '11px', color: 'rgba(255,255,255,0.85)', flex: 1 }}>
              New Course Title <span style={{ opacity: 0.6 }}>/ Page Title</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>🔍</span>
          </div>
          <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontFamily: `${customSettings.headingFont}, sans-serif`, fontSize: titleSize ?? '1rem', fontWeight: 700, color: headingColor, lineHeight: 1.2 }}>
              {customSettings.pageTitleSize === 'H6' ? '—' : 'New Menu/Page Title'}
            </div>
            <div style={{ fontFamily: `${customSettings.paragraphFont}, sans-serif`, fontSize: '0.85rem', color: textColor, lineHeight: 1.5 }}>Body text</div>
            <div style={{ fontFamily: `${customSettings.paragraphFont}, sans-serif`, fontSize: '0.85rem', color: customSettings.linkFontColor, textDecoration: 'underline', cursor: 'pointer' }}>
              This is a sample link
            </div>
            <div style={{ fontFamily: `${customSettings.paragraphFont}, sans-serif`, fontSize: '0.82rem', color: customSettings.instructionColor, fontStyle: 'italic' }}>
              Choose one option then select Submit.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[{ label: 'Correct', selected: true }, { label: 'Incorrect', selected: false }].map(opt => (
                <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0, border: `2px solid ${opt.selected ? customSettings.secondaryColor : (darkMode ? '#555' : '#ccc')}`, background: opt.selected ? customSettings.secondaryColor : 'transparent' }} />
                  <span style={{ fontFamily: `${customSettings.paragraphFont}, sans-serif`, fontSize: '0.82rem', color: textColor }}>{opt.label}</span>
                </div>
              ))}
            </div>
            <div style={{ alignSelf: 'flex-start', background: customSettings.primaryColor, borderRadius: '6px', padding: '7px 16px', fontFamily: `${customSettings.paragraphFont}, sans-serif`, fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
              Submit
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Custom Theme Editor Component
  const CustomThemeEditor = ({ onBack }: { onBack: () => void }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
      {/* Left: breadcrumb + accordions */}
      <div className="space-y-5">
        <div className="flex items-center gap-1">
          <button onClick={onBack} className="flex items-center gap-1 bg-none border-none cursor-pointer text-[#2d6fa8] hover:opacity-75 p-0">
            <span>←</span>
            <span className="text-xs font-semibold">Theme</span>
          </button>
          <span className="text-[#6b7280]">›</span>
          <span className="text-xs font-bold text-[#111827]">Custom Theme</span>
        </div>

        <div className="space-y-2">
          {ACCORDION_DEFS.map((acc) => {
            const isOpen = activeCustomAccordion === acc.id;
            return (
              <div key={acc.id} className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                <button
                  onClick={() => setActiveCustomAccordion(isOpen ? null : acc.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors border-b border-[#e5e7eb] ${isOpen ? 'bg-[#f9fafb]' : 'bg-white hover:bg-[#f9fafb]'}`}
                >
                  <span className="text-xs font-bold text-[#111827]">{acc.label}</span>
                  <svg className={`w-4 h-4 text-[#6b7280] transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isOpen && acc.id === 'global' && (
                  <div className="px-4 py-4 bg-white border-t border-[#e5e7eb]">
                    <div className="grid grid-cols-2 gap-4">
                      <ColorPickerField label="Primary colour" value={customSettings.primaryColor} onChange={v => setCustomSettings({...customSettings, primaryColor: v})} />
                      <ColorPickerField label="Secondary colour" value={customSettings.secondaryColor} onChange={v => setCustomSettings({...customSettings, secondaryColor: v})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <FontDropdownField label="Heading font" value={customSettings.headingFont} onChange={v => setCustomSettings({...customSettings, headingFont: v})} />
                      <FontDropdownField label="Paragraph font" value={customSettings.paragraphFont} onChange={v => setCustomSettings({...customSettings, paragraphFont: v})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <ColorPickerField label="Font colour" value={customSettings.fontColor} onChange={v => setCustomSettings({...customSettings, fontColor: v})} />
                      <ColorPickerField label="Heading font colour" value={customSettings.headingFontColor} onChange={v => setCustomSettings({...customSettings, headingFontColor: v})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <ColorPickerField label="Instruction colour" value={customSettings.instructionColor} onChange={v => setCustomSettings({...customSettings, instructionColor: v})} />
                      <ColorPickerField label="Link font colour" value={customSettings.linkFontColor} onChange={v => setCustomSettings({...customSettings, linkFontColor: v})} />
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-bold text-[#111827] mb-2">Page Title Size</p>
                      <select value={customSettings.pageTitleSize} onChange={e => setCustomSettings({...customSettings, pageTitleSize: e.target.value})} className="text-xs w-full border-2 border-[#2d6fa8] rounded px-2 py-1 text-[#111827] bg-white cursor-pointer focus:outline-none">
                        {PAGE_TITLE_OPTIONS.map(h => <option key={h} value={h}>{PAGE_TITLE_LABELS[h]}</option>)}
                      </select>
                      {customSettings.pageTitleSize !== 'H6' && (
                        <div className="mt-2 border-l-[3px] border-l-[#2d6fa8] bg-[#f0f7ff] rounded-r px-3 py-2">
                          <p className="text-xs font-bold text-[#111827] mb-1">Calculated values for Desktop:</p>
                          {CALC_VALUES.map(row => (
                            <div key={row.label} className="text-xs text-[#2d6fa8] leading-relaxed">
                              {row.label}: {row.rem} ({row.px})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: live preview */}
      <div style={{ position: 'sticky', top: '32px' }}>
        <p className="text-xs font-bold text-[#111827] mb-3">Live Preview</p>
        <LivePreview />
        <p className="text-xs text-[#6b7280] mt-2 text-center">Preview updates as you change settings</p>
      </div>
    </div>
  );

  return (
    // <div className="max-w-3xl w-full px-6 py-6">
    <div className=" w-full px-6 py-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">
            Select Theme <span className="text-red-500">*</span>
          </h2>
          <p className="text-sm text-[#6b7280] mt-0.5">Choose a theme for your course.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saveError && <span className="text-xs text-[#ef4444]">{saveError}</span>}
          {saveSuccess && <span className="text-xs text-[#22c55e] font-medium">Saved!</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selected || !courseId}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
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

      {/* Separator */}
      <div className="h-px bg-[#e5e7eb] my-5" />

      {/* Preset Section */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#111827]">Preset:</span>
          <select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-[#d1d5db] rounded-md bg-white text-[#111827] cursor-pointer outline-none focus:border-[#2d6fa8]"
          >
            <option value="">No preset</option>
            {presets.map((p) => (
              <option key={p._id} value={p._id}>{p.displayName}</option>
            ))}
          </select>
        </div>
        {showPresetNameInput ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Preset name"
              className="text-xs px-2.5 py-1.5 border border-[#d1d5db] rounded-md focus:border-[#2d6fa8] outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') { setShowPresetNameInput(false); setNewPresetName(''); } }}
              autoFocus
            />
            <button onClick={handleSavePreset} className="text-xs font-semibold px-3 py-1.5 bg-[#2d6fa8] text-white rounded-md hover:bg-[#245c8f] transition-colors">
              OK
            </button>
            <button onClick={() => { setShowPresetNameInput(false); setNewPresetName(''); }} className="text-xs px-3 py-1.5 border border-[#d1d5db] text-[#6b7280] rounded-md hover:bg-[#f9fafb] transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPresetNameInput(true)}
            disabled={!selected}
            className="text-xs font-semibold px-5 py-1.5 border border-[#2d6fa8] text-[#2d6fa8] rounded-md hover:bg-[#f0f7ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save preset
          </button>
        )}
      </div>

      <p className="text-xs text-[#6b7280] mb-5 leading-relaxed">
        <strong className="text-[#111827]">Tip:</strong> You can save your selections as a 'preset' for quick access later.
      </p>

      {/* Separator */}
      <div className="h-px bg-[#e5e7eb] mb-4" />

      {/* Configuration Accordions - shown based on selected theme */}
      <div className="space-y-2">
        {/* Configuration: Course - LIFE and Custom only */}
        {selected !== "vanilla" && (
          <ThemeAccordion
            label="Configuration: Course"
            isOpen={activeAccordion === "Configuration: Course"}
            onToggle={() => setActiveAccordion(activeAccordion === "Configuration: Course" ? null : "Configuration: Course")}
          >
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-[#111827] mb-2.5">Custom Icons: Sprite Sheets</p>
                <button className="px-5 py-2 text-xs font-semibold text-white bg-[#2d6fa8] rounded-md hover:bg-[#1e5a96] transition-colors">
                  Add
                </button>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#111827] mb-2.5">Custom Icons: Single Icons</p>
                <button className="px-5 py-2 text-xs font-semibold text-white bg-[#2d6fa8] rounded-md hover:bg-[#1e5a96] transition-colors">
                  Add
                </button>
              </div>
            </div>
          </ThemeAccordion>
        )}

        {/* Configuration: Blocks - LIFE and Custom only */}
        {selected !== "vanilla" && (
          <ThemeAccordion
            label="Configuration: Blocks"
            isOpen={activeAccordion === "Configuration: Blocks"}
            onToggle={() => setActiveAccordion(activeAccordion === "Configuration: Blocks" ? null : "Configuration: Blocks")}
          >
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-[#111827] mb-2">Spacing top</p>
                <select className="text-xs px-2.5 py-1.5 border border-[#d1d5db] rounded-md bg-white text-[#111827] cursor-pointer outline-none focus:border-[#2d6fa8]" style={{ minWidth: "110px" }}>
                  <option>None</option>
                  <option>Single</option>
                  <option>Double</option>
                  <option>Triple</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#111827] mb-2">Spacing bottom</p>
                <select className="text-xs px-2.5 py-1.5 border border-[#d1d5db] rounded-md bg-white text-[#111827] cursor-pointer outline-none focus:border-[#2d6fa8]" style={{ minWidth: "110px" }}>
                  <option>None</option>
                  <option>Single</option>
                  <option>Double</option>
                  <option>Triple</option>
                </select>
              </div>
            </div>
          </ThemeAccordion>
        )}

        {/* Configuration: Components - LIFE and Custom only */}
        {selected !== "vanilla" && (
          <ThemeAccordion
            label="Configuration: Components"
            isOpen={activeAccordion === "Configuration: Components"}
            onToggle={() => setActiveAccordion(activeAccordion === "Configuration: Components" ? null : "Configuration: Components")}
          >
            <div className="space-y-5">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCheckNotFinal(!checkNotFinal)}>
                <div 
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    border: `1.5px solid ${checkNotFinal ? "#2d6fa8" : "#d1d5db"}`,
                    backgroundColor: checkNotFinal ? "#2d6fa8" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                    flexShrink: 0
                  }}
                >
                  {checkNotFinal && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#111827] leading-normal">Display marking for not-final attempts</span>
              </div>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCheckUnanswered(!checkUnanswered)}>
                <div 
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    border: `1.5px solid ${checkUnanswered ? "#2d6fa8" : "#d1d5db"}`,
                    backgroundColor: checkUnanswered ? "#2d6fa8" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                    flexShrink: 0
                  }}
                >
                  {checkUnanswered && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#111827] leading-normal">Display marking for unanswered correct responses</span>
              </div>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCheckHideFeedback(!checkHideFeedback)}>
                <div 
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    border: `1.5px solid ${checkHideFeedback ? "#2d6fa8" : "#d1d5db"}`,
                    backgroundColor: checkHideFeedback ? "#2d6fa8" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                    flexShrink: 0
                  }}
                >
                  {checkHideFeedback && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#111827] leading-normal">Hide feedback on first attempt on assessments</span>
              </div>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCheckHidePartial(!checkHidePartial)}>
                <div 
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    border: `1.5px solid ${checkHidePartial ? "#2d6fa8" : "#d1d5db"}`,
                    backgroundColor: checkHidePartial ? "#2d6fa8" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                    flexShrink: 0
                  }}
                >
                  {checkHidePartial && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#111827] leading-normal">Hide partially correct feedback on the question and result page</span>
              </div>
            </div>
          </ThemeAccordion>
        )}

        {/* On Screen Classes - always visible */}
        <ThemeAccordion
          label="On Screen Classes"
          isOpen={activeAccordion === "On Screen Classes"}
          onToggle={() => setActiveAccordion(activeAccordion === "On Screen Classes" ? null : "On Screen Classes")}
        >
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {}}
                className="relative w-10 h-5.5 rounded-full border-none cursor-pointer flex-shrink-0 transition-colors"
                style={{ backgroundColor: "#d1d5db" }}
              >
                <span
                  className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ boxShadow: "0 1px 3px rgba(0, 0, 0, 0.25)" }}
                />
              </button>
              <span className="text-xs text-[#111827] font-semibold">Enable On Screen Classes</span>
            </div>
          </div>
        </ThemeAccordion>
      </div>

      {/* Vanilla Theme Settings — only shown when Vanilla is selected */}
      {selected === "vanilla" && (
        <div className="border border-[#e5e7eb] rounded-xl p-6 bg-white mt-2">
          <h3 className="text-sm font-bold text-[#111827] mb-4">Vanilla Theme Settings</h3>
          <div className="space-y-2">
            {VANILLA_ACCORDION_DEFS.map((acc) => {
              const isOpen = activeVanillaAccordion === acc.id;
              return (
                <div key={acc.id} className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setActiveVanillaAccordion(isOpen ? null : acc.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 transition-colors border-b border-[#e5e7eb] ${isOpen ? 'bg-[#f9fafb]' : 'bg-white hover:bg-[#f9fafb]'}`}
                  >
                    <span className="text-xs font-bold text-[#111827]">{acc.label}</span>
                    <svg
                      className={`w-4 h-4 text-[#6b7280] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-4 py-4 bg-white border-t border-[#e5e7eb]">
                      <div className="flex flex-col gap-4">
                        {acc.fields.map((field) => {
                          const key = `${acc.id}::${field}`;
                          const colorVal = vanillaColors[key] ?? '';
                          const isEmpty = !colorVal;
                          return (
                            <div key={field}>
                              <p className="text-xs text-[#111827] mb-2 leading-snug">{field}</p>
                              <label
                                style={{
                                  display: 'block',
                                  width: '56px',
                                  height: '56px',
                                  borderRadius: '10px',
                                  border: '1px solid #e5e7eb',
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  position: 'relative',
                                  flexShrink: 0,
                                }}
                              >
                                {isEmpty ? (
                                  <div style={{ width: '100%', height: '100%', backgroundImage: 'repeating-conic-gradient(#d0d0d0 0% 25%, #f8f8f8 0% 50%)', backgroundSize: '10px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ opacity: 0.45 }}>
                                      <line x1="4" y1="4" x2="18" y2="18" stroke="#888" strokeWidth="2" strokeLinecap="round" />
                                      <line x1="18" y1="4" x2="4" y2="18" stroke="#888" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                  </div>
                                ) : (
                                  <div style={{ width: '100%', height: '100%', background: colorVal }} />
                                )}
                                <input
                                  type="color"
                                  value={colorVal || '#ffffff'}
                                  onChange={(e) => setVanillaColors(prev => ({ ...prev, [key]: e.target.value }))}
                                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }}
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Theme Settings — only shown when Custom is selected */}
      {selected === "custom" && (
        <div className="mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column: Breadcrumb + Accordions */}
            <div className="space-y-4">
              <div className="text-xs text-[#6b7280]">
                <span className="font-semibold">Theme</span>
                {activeCustomAccordion && (
                  <>
                    <span className="mx-1.5">/</span>
                    <span className="font-semibold">{ACCORDION_DEFS.find(a => a.id === activeCustomAccordion)?.label}</span>
                  </>
                )}
              </div>

              <div className="space-y-2">
                {ACCORDION_DEFS.map((acc) => {
                  const isOpen = activeCustomAccordion === acc.id;
                  return (
                    <div key={acc.id} className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                      <button
                        onClick={() => setActiveCustomAccordion(isOpen ? null : acc.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isOpen ? 'bg-[#f9fafb]' : 'bg-white hover:bg-[#f9fafb]'}`}
                      >
                        <span className="text-xs font-bold text-[#111827]">{acc.label}</span>
                        <svg
                          className={`w-4 h-4 text-[#6b7280] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="px-4 py-4 bg-white border-t border-[#e5e7eb]">
                          {acc.id === 'global' && (
                            <>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-4">
                                <ColorPickerField label="Primary Color" value={customSettings.primaryColor} onChange={(v) => setCustomSettings({ ...customSettings, primaryColor: v })} />
                                <ColorPickerField label="Secondary Color" value={customSettings.secondaryColor} onChange={(v) => setCustomSettings({ ...customSettings, secondaryColor: v })} />
                                <ColorPickerField label="Font Color" value={customSettings.fontColor} onChange={(v) => setCustomSettings({ ...customSettings, fontColor: v })} />
                                <ColorPickerField label="Heading Font Color" value={customSettings.headingFontColor} onChange={(v) => setCustomSettings({ ...customSettings, headingFontColor: v })} />
                                <ColorPickerField label="Instruction Color" value={customSettings.instructionColor} onChange={(v) => setCustomSettings({ ...customSettings, instructionColor: v })} />
                                <ColorPickerField label="Link Font Color" value={customSettings.linkFontColor} onChange={(v) => setCustomSettings({ ...customSettings, linkFontColor: v })} />
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                                <FontDropdownField label="Heading Font" value={customSettings.headingFont} onChange={(v) => setCustomSettings({ ...customSettings, headingFont: v })} />
                                <FontDropdownField label="Paragraph Font" value={customSettings.paragraphFont} onChange={(v) => setCustomSettings({ ...customSettings, paragraphFont: v })} />
                              </div>
                            </>
                          )}
                          {acc.id === 'page' && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                              <div className="col-span-2">
                                <p className="text-xs font-bold text-[#111827] mb-2">Page Title Size</p>
                                <select value={customSettings.pageTitleSize} onChange={(e) => setCustomSettings({ ...customSettings, pageTitleSize: e.target.value })} className="text-xs w-full border border-[#d1d5db] rounded px-2 py-1 text-[#111827] bg-white cursor-pointer focus:border-[#2d6fa8] outline-none">
                                  {PAGE_TITLE_OPTIONS.map(opt => <option key={opt} value={opt}>{PAGE_TITLE_LABELS[opt]}</option>)}
                                </select>
                              </div>
                              <ColorPickerField label="Page Background Color" value={customSettings.pageBackgroundColor || '#ffffff'} onChange={(v) => setCustomSettings({ ...customSettings, pageBackgroundColor: v })} />
                              <ColorPickerField label="Page Border Color" value={customSettings.pageBorderColor || '#e5e7eb'} onChange={(v) => setCustomSettings({ ...customSettings, pageBorderColor: v })} />
                            </div>
                          )}
                          {acc.id === 'progress' && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                              <ColorPickerField label="Progress Fill Color" value={customSettings.progressFillColor || '#2d6fa8'} onChange={(v) => setCustomSettings({ ...customSettings, progressFillColor: v })} />
                              <ColorPickerField label="Progress Background Color" value={customSettings.progressBackgroundColor || '#e5e7eb'} onChange={(v) => setCustomSettings({ ...customSettings, progressBackgroundColor: v })} />
                              <ColorPickerField label="Progress Border Color" value={customSettings.progressBorderColor || '#d1d5db'} onChange={(v) => setCustomSettings({ ...customSettings, progressBorderColor: v })} />
                            </div>
                          )}
                          {acc.id === 'navigation' && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                              <ColorPickerField label="Navigation Background" value={customSettings.navBackground || '#ffffff'} onChange={(v) => setCustomSettings({ ...customSettings, navBackground: v })} />
                              <ColorPickerField label="Navigation Text Color" value={customSettings.navTextColor || '#111827'} onChange={(v) => setCustomSettings({ ...customSettings, navTextColor: v })} />
                              <ColorPickerField label="Navigation Border Color" value={customSettings.navBorderColor || '#e5e7eb'} onChange={(v) => setCustomSettings({ ...customSettings, navBorderColor: v })} />
                              <ColorPickerField label="Navigation Hover Color" value={customSettings.navHoverColor || '#f9fafb'} onChange={(v) => setCustomSettings({ ...customSettings, navHoverColor: v })} />
                            </div>
                          )}
                          {acc.id === 'menu' && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                              <ColorPickerField label="Menu Background" value={customSettings.menuBackground || '#ffffff'} onChange={(v) => setCustomSettings({ ...customSettings, menuBackground: v })} />
                              <ColorPickerField label="Menu Text Color" value={customSettings.menuTextColor || '#111827'} onChange={(v) => setCustomSettings({ ...customSettings, menuTextColor: v })} />
                              <ColorPickerField label="Menu Hover Background" value={customSettings.menuHoverBackground || '#f9fafb'} onChange={(v) => setCustomSettings({ ...customSettings, menuHoverBackground: v })} />
                              <ColorPickerField label="Menu Active Color" value={customSettings.menuActiveColor || '#2d6fa8'} onChange={(v) => setCustomSettings({ ...customSettings, menuActiveColor: v })} />
                            </div>
                          )}
                          {acc.id === 'feedback' && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                              <ColorPickerField label="Success Color" value={customSettings.successColor || '#22c55e'} onChange={(v) => setCustomSettings({ ...customSettings, successColor: v })} />
                              <ColorPickerField label="Error Color" value={customSettings.errorColor || '#ef4444'} onChange={(v) => setCustomSettings({ ...customSettings, errorColor: v })} />
                              <ColorPickerField label="Warning Color" value={customSettings.warningColor || '#f59e0b'} onChange={(v) => setCustomSettings({ ...customSettings, warningColor: v })} />
                              <ColorPickerField label="Info Color" value={customSettings.infoColor || '#3b82f6'} onChange={(v) => setCustomSettings({ ...customSettings, infoColor: v })} />
                            </div>
                          )}
                          {acc.id === 'overlays' && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                              <ColorPickerField label="Overlay Background" value={customSettings.overlayBackground || 'rgba(0, 0, 0, 0.5)'} onChange={(v) => setCustomSettings({ ...customSettings, overlayBackground: v })} />
                              <ColorPickerField label="Modal Background" value={customSettings.modalBackground || '#ffffff'} onChange={(v) => setCustomSettings({ ...customSettings, modalBackground: v })} />
                              <ColorPickerField label="Modal Border Color" value={customSettings.modalBorderColor || '#e5e7eb'} onChange={(v) => setCustomSettings({ ...customSettings, modalBorderColor: v })} />
                              <ColorPickerField label="Modal Shadow Color" value={customSettings.modalShadowColor || 'rgba(0, 0, 0, 0.1)'} onChange={(v) => setCustomSettings({ ...customSettings, modalShadowColor: v })} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right column: Live Preview (Sticky) */}
            <div>
              <div className="sticky top-6">
                <LivePreview />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Theme Accordion Component ── */
function ThemeAccordion({
  label,
  children,
  isOpen,
  onToggle
}: {
  label: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[#f9fafb] transition-colors border-b border-[#e5e7eb]"
      >
        <span className="text-xs font-bold text-[#111827]">{label}</span>
        <svg
          className={`w-4 h-4 text-[#6b7280] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-white border-t border-[#e5e7eb]">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MENU PANEL — types, thumbnails, live preview, settings
   ───────────────────────────────────────────────────────────── */

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

/* ── Card thumbnail illustrations (matching the screenshot) ── */

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

/* ── Live preview rendered in the right panel ── */
function MenuLivePreview({ cfg }: { cfg: MenuConfig }) {
  const bgStyle: React.CSSProperties = cfg.bgType === "image" && cfg.bgImageUrl
    ? { backgroundImage: `url(${cfg.bgImageUrl})`, backgroundRepeat: cfg.bgRepeat, backgroundSize: cfg.bgSize, backgroundPosition: cfg.bgPosition }
    : { backgroundColor: cfg.bgColor };

  const alignClass = { left: "items-start text-left", center: "items-center text-center", right: "items-end text-right" }[cfg.titleAlign];

  /* header block (logo, title, description, header image) — no background, rendered on top of bgStyle container */
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
          {/* sidebar — inherits background from parent, adds border only */}
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
          {/* content area — semi-transparent overlay so background shows through */}
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
        {/* module list — semi-transparent card over background */}
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

/* ── Shared helpers ── */
function MenuFieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-xs font-semibold text-[#374151]">
      {children}{required && <span className="text-[#dc2626] ml-0.5">*</span>}
    </span>
  );
}

/* ── Rich text editor with formatting toolbar ── */
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

  // Set innerHTML only on mount — never re-set during typing (avoids cursor reset / reversed text)
  const initRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.innerHTML = html;
      (editorRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  // intentionally empty deps — run once on mount only
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

        {/* ── toolbar ── */}
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

          {/* font size dropdown — directly controls the cfg field, no execCommand */}
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

          {/* text color — directly controls the cfg field, anchored label for correct picker position */}
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

        {/* ── editable area — uncontrolled, innerHTML set once on mount ── */}
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

/* ── Main MenuPanel component ── */
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

      {/* ══ LEFT: settings (50%) ══ */}
      <div className="w-1/2 h-full overflow-y-auto border-r border-[#e5e7eb] bg-white">

        <div className="px-6 py-5 border-b border-[#e5e7eb]">
          <h2 className="text-xl font-bold text-[#111827]">Menu</h2>
          <p className="text-sm text-[#6b7280] mt-0.5">Configure how learners will navigate your course.</p>
        </div>

        <div className="flex flex-col divide-y divide-[#f3f4f6]">

          {/* ── 1. Menu Style ── */}
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

          {/* ── 2. Logo ── */}
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

          {/* ── 3. Menu Title + Description ── */}
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

          {/* ── 4. Header Image ── */}
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

          {/* ── 5. Background ── */}
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

      {/* ══ RIGHT: live preview (50%) ══ */}
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

/* ── Shared checkbox row used across panels ── */
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
          checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
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

/* ── Navigation Panel ── */
interface NavigationConfig {
  enableCourseMenu: boolean;
  includeSubMenuInNavigation: boolean;
  enableHeaderLogo: boolean;
  headerLogoSource: "asset" | "url";
  headerLogoUrl: string;
  headerLogoAssetUrl: string | null;
  headerLogoTooltip: string;
  enableNavigationFooter: boolean;
  footerLabels: {
    home: string;
    previous: string;
    next: string;
    up: string;
    close: string;
    custom: string;
  };
  startTopicId: string;
  skipTopicWhenViewed: boolean;
  forceRoutingFromTopicId: boolean;
  preventNavigationToMainMenu: boolean;
  menuLock: "custom" | "locklast" | "sequential" | "unlockfirst";
}

const DEFAULT_NAV_CFG: NavigationConfig = {
  enableCourseMenu: true,
  includeSubMenuInNavigation: false,
  enableHeaderLogo: false,
  headerLogoSource: "url",
  headerLogoUrl: "",
  headerLogoAssetUrl: null,
  headerLogoTooltip: "",
  enableNavigationFooter: true,
  footerLabels: {
    home: "Home",
    previous: "Previous",
    next: "Next",
    up: "Up",
    close: "Close",
    custom: "Custom",
  },
  startTopicId: "",
  skipTopicWhenViewed: false,
  forceRoutingFromTopicId: false,
  preventNavigationToMainMenu: false,
  menuLock: "sequential",
};

function NavSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af] mb-1 mt-1">{children}</p>
  );
}

function NavTextInput({
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

function NavigationPanel() {
  const [cfg, setCfg] = useState<NavigationConfig>(DEFAULT_NAV_CFG);

  function set<K extends keyof NavigationConfig>(k: K, v: NavigationConfig[K]) {
    setCfg((prev) => ({ ...prev, [k]: v }));
  }

  function setFooter(k: keyof NavigationConfig["footerLabels"], v: string) {
    setCfg((prev) => ({ ...prev, footerLabels: { ...prev.footerLabels, [k]: v } }));
  }

  function pickLogoAsset() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) set("headerLogoAssetUrl", URL.createObjectURL(f));
    };
    input.click();
  }

  const MENU_LOCK_OPTIONS: { value: NavigationConfig["menuLock"]; label: string }[] = [
    { value: "custom",      label: "Custom" },
    { value: "locklast",    label: "Lock Last" },
    { value: "sequential",  label: "Sequential" },
    { value: "unlockfirst", label: "Unlock First" },
  ];

  const FOOTER_FIELDS: { key: keyof NavigationConfig["footerLabels"]; label: string }[] = [
    { key: "home",     label: "Home" },
    { key: "previous", label: "Previous" },
    { key: "next",     label: "Next" },
    { key: "up",       label: "Up" },
    { key: "close",    label: "Close" },
    { key: "custom",   label: "Custom" },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden">

      {/* ══ LEFT: settings ══ */}
      <div className="w-full max-w-2xl h-full overflow-y-auto border-r border-[#e5e7eb] bg-white">

        <div className="px-6 py-5 border-b border-[#e5e7eb]">
          <h2 className="text-xl font-bold text-[#111827]">Navigation</h2>
          <p className="text-sm text-[#6b7280] mt-0.5">Configure how learners move through your course.</p>
        </div>

        <div className="flex flex-col divide-y divide-[#f3f4f6]">

          {/* ── Navigation Settings ── */}
          <section className="px-6 py-5 flex flex-col gap-1">
            <NavSectionHeading>Navigation Settings</NavSectionHeading>

            <CheckboxRow
              checked={cfg.enableCourseMenu}
              onChange={(v) => set("enableCourseMenu", v)}
              label="Enable Course Menu"
            />

            <CheckboxRow
              checked={cfg.includeSubMenuInNavigation}
              onChange={(v) => set("includeSubMenuInNavigation", v)}
              label="Include SubMenu in Navigation"
            />

            {/* Header Logo */}
            <CheckboxRow
              checked={cfg.enableHeaderLogo}
              onChange={(v) => set("enableHeaderLogo", v)}
              label="Enable Header Logo"
            />

            {cfg.enableHeaderLogo && (
              <div className="ml-7 mt-1 mb-1 flex flex-col gap-3 p-4 rounded-lg bg-[#f9fafb] border border-[#e5e7eb]">
                {/* Asset / URL toggle */}
                <div className="flex rounded-lg border border-[#d1d5db] overflow-hidden">
                  {(["asset", "url"] as const).map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => set("headerLogoSource", src)}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors ${cfg.headerLogoSource === src ? "bg-[#2d6fa8] text-white" : "bg-white text-[#6b7280] hover:bg-[#f3f4f6]"} ${i > 0 ? "border-l border-[#d1d5db]" : ""}`}
                    >
                      {src === "asset" ? "Upload Asset" : "URL"}
                    </button>
                  ))}
                </div>

                {cfg.headerLogoSource === "url" ? (
                  <NavTextInput
                    label="Logo URL"
                    value={cfg.headerLogoUrl}
                    onChange={(v) => set("headerLogoUrl", v)}
                    placeholder="https://example.com/logo.png"
                  />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-[#374151]">Logo Asset</span>
                    {cfg.headerLogoAssetUrl ? (
                      <div className="flex items-center gap-3 p-2 border border-[#e5e7eb] rounded-lg bg-white">
                        <img src={cfg.headerLogoAssetUrl} alt="logo" className="h-8 max-w-[64px] object-contain rounded" />
                        <div className="flex gap-1.5 ml-auto shrink-0">
                          <button type="button" onClick={pickLogoAsset} className="text-xs px-2 py-1 border border-[#d1d5db] rounded text-[#374151] hover:bg-[#f3f4f6]">Replace</button>
                          <button type="button" onClick={() => set("headerLogoAssetUrl", null)} className="text-xs px-2 py-1 border border-[#fca5a5] rounded text-[#dc2626] hover:bg-[#fef2f2]">Remove</button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-16 border-2 border-dashed border-[#d1d5db] rounded-lg cursor-pointer hover:border-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors group">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#2d6fa8] mb-0.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <span className="text-[11px] text-[#6b7280] group-hover:text-[#2d6fa8]">Click to upload logo</span>
                        <input type="file" accept="image/*" aria-label="Upload logo asset" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) set("headerLogoAssetUrl", URL.createObjectURL(f)); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                )}

                <NavTextInput
                  label="Tooltip Text"
                  value={cfg.headerLogoTooltip}
                  onChange={(v) => set("headerLogoTooltip", v)}
                  placeholder="e.g. Go to homepage"
                />
              </div>
            )}

            {/* Navigation Footer */}
            <CheckboxRow
              checked={cfg.enableNavigationFooter}
              onChange={(v) => set("enableNavigationFooter", v)}
              label="Enable Navigation Footer"
            />

            {cfg.enableNavigationFooter && (
              <div className="ml-7 mt-1 mb-1 p-4 rounded-lg bg-[#f9fafb] border border-[#e5e7eb] flex flex-col gap-3">
                <p className="text-xs font-semibold text-[#374151]">Button Labels</p>
                <div className="grid grid-cols-2 gap-3">
                  {FOOTER_FIELDS.map(({ key, label }) => (
                    <NavTextInput
                      key={key}
                      label={label}
                      value={cfg.footerLabels[key]}
                      onChange={(v) => setFooter(key, v)}
                      placeholder={label}
                    />
                  ))}
                </div>

                {/* Conditional: Include submenu in sequential navigation — only when includeSubMenuInNavigation is on */}
                <CheckboxRow
                  checked={cfg.includeSubMenuInNavigation}
                  onChange={(v) => set("includeSubMenuInNavigation", v)}
                  label="Include submenu in sequential navigation"
                  disabled={!cfg.includeSubMenuInNavigation}
                />
                {!cfg.includeSubMenuInNavigation && (
                  <p className="text-[11px] text-[#9ca3af] -mt-1 ml-7">Enable "Include SubMenu in Navigation" above to unlock this option.</p>
                )}
              </div>
            )}
          </section>

          {/* ── Start Settings ── */}
          <section className="px-6 py-5 flex flex-col gap-3">
            <NavSectionHeading>Start Settings</NavSectionHeading>

            <NavTextInput
              label="Topic ID"
              value={cfg.startTopicId}
              onChange={(v) => set("startTopicId", v)}
              placeholder="e.g. topic-1"
            />

            <div className="flex flex-col gap-0.5">
              <CheckboxRow
                checked={cfg.skipTopicWhenViewed}
                onChange={(v) => set("skipTopicWhenViewed", v)}
                label="Skip the topic when already viewed or completed"
              />
              <CheckboxRow
                checked={cfg.forceRoutingFromTopicId}
                onChange={(v) => set("forceRoutingFromTopicId", v)}
                label="Enable to force the routing from the Topic ID defined here"
              />
              <CheckboxRow
                checked={cfg.preventNavigationToMainMenu}
                onChange={(v) => set("preventNavigationToMainMenu", v)}
                label="Prevent the user from navigating to the main menu"
              />
            </div>

            {/* Menu Lock dropdown */}
            <div className="flex flex-col gap-1.5 mt-1">
              <span className="text-xs font-semibold text-[#374151]">Menu Lock</span>
              <div className="relative">
                <select
                  value={cfg.menuLock}
                  onChange={(e) => set("menuLock", e.target.value as NavigationConfig["menuLock"])}
                  aria-label="Menu Lock"
                  className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[#111827] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent pr-8"
                >
                  {MENU_LOCK_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

/* ── Accessibility Panel ── */

function A11yTextInput({
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
    <div className="flex flex-col gap-1">
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

function A11yNumberInput({
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
    <div className="flex flex-col gap-1">
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

function A11ySectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af] mb-2 mt-1">{children}</p>
  );
}

function A11ySubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-[#6b7280] mb-2 mt-1 flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
      {children}
    </p>
  );
}

interface A11yGlobal {
  skipToMainContentLabel: string;
  answeredIncorrectly: string;
  answeredCorrectly: string;
  selectedAnswer: string;
  unselectedAnswer: string;
  skipNavigation: string;
  previous: string;
  navigationDrawer: string;
  close: string;
  closeDrawer: string;
  closeResources: string;
  drawer: string;
  closePopup: string;
  next: string;
  done: string;
  complete: string;
  incomplete: string;
  incorrect: string;
  correct: string;
  locked: string;
  visited: string;
  required: string;
  optional: string;
  topOfContentObject: string;
  course: string;
  menu: string;
  page: string;
  alternativeFeedbackTitle: string;
}

interface A11yExtensions {
  resourcesAriaRegion: string;
  resourcesLabel: string;
  trickleIncompleteContent: string;
  bookmarkingResumeButtonText: string;
  bookmarkingResumeAriaLabel: string;
  tutorHideFeedback: string;
  plpLabel: string;
  plpIndicatorBar: string;
  plpMenuBar: string;
  plpEnd: string;
  plpOptionalContent: string;
  courseNotesShow: string;
  drawerNavBarOrder: string;
  drawerNavTooltip: boolean;
  drawerText: string;
  skipNavNavBarOrder: string;
  backNavBarOrder: string;
  backNavTooltip: boolean;
  backText: string;
}

interface A11yComponents {
  youtubeAriaRegion: string;
  youtubeSkipToTranscript: string;
}

const DEFAULT_A11Y_GLOBAL: A11yGlobal = {
  skipToMainContentLabel: "Skip navigation",
  answeredIncorrectly: "You answered incorrectly",
  answeredCorrectly: "You answered correctly",
  selectedAnswer: "selected",
  unselectedAnswer: "not selected",
  skipNavigation: "Skip Navigation",
  previous: "back",
  navigationDrawer: "Open course resources.",
  close: "Close",
  closeDrawer: "Close Drawer",
  closeResources: "Close Resources",
  drawer: "Top of side drawer",
  closePopup: "Close Popup",
  next: "Next",
  done: "Done",
  complete: "Complete",
  incomplete: "Incomplete",
  incorrect: "Incorrect",
  correct: "Correct",
  locked: "Locked",
  visited: "Visited",
  required: "Required",
  optional: "Optional",
  topOfContentObject: "-",
  course: "Main menu",
  menu: "sub Menu",
  page: "Page",
  alternativeFeedbackTitle: "Feedback",
};

const DEFAULT_A11Y_EXTENSIONS: A11yExtensions = {
  resourcesAriaRegion: "-",
  resourcesLabel: "Additional resources",
  trickleIncompleteContent: "There is incomplete content above. You must complete this before you can proceed through the course",
  bookmarkingResumeButtonText: "Resume",
  bookmarkingResumeAriaLabel: "Navigate to your furthest point of progress",
  tutorHideFeedback: "Hide feedback",
  plpLabel: "Page sections",
  plpIndicatorBar: "Page progress. Use this to listen to the list of regions in this topic and whether they're completed. You can jump directly to any that are incomplete or which sound particularly interesting. {{percentageComplete}}%",
  plpMenuBar: "Page completion {{percentageComplete}}%",
  plpEnd: "You have reached the end of the list of page sections.",
  plpOptionalContent: "Optional content",
  courseNotesShow: "Course notes",
  drawerNavBarOrder: "100",
  drawerNavTooltip: true,
  drawerText: "-",
  skipNavNavBarOrder: "-100",
  backNavBarOrder: "0",
  backNavTooltip: true,
  backText: "-",
};

const DEFAULT_A11Y_COMPONENTS: A11yComponents = {
  youtubeAriaRegion: "This is a media component which displays a YouTube video. Select the play / pause button to watch it.",
  youtubeSkipToTranscript: "Skip to transcript",
};

function AccessibilityPanel() {
  const [global, setGlobal] = useState<A11yGlobal>(DEFAULT_A11Y_GLOBAL);
  const [extensions, setExtensions] = useState<A11yExtensions>(DEFAULT_A11Y_EXTENSIONS);
  const [components, setComponents] = useState<A11yComponents>(DEFAULT_A11Y_COMPONENTS);

  function setG<K extends keyof A11yGlobal>(k: K, v: A11yGlobal[K]) {
    setGlobal((prev) => ({ ...prev, [k]: v }));
  }
  function setE<K extends keyof A11yExtensions>(k: K, v: A11yExtensions[K]) {
    setExtensions((prev) => ({ ...prev, [k]: v }));
  }
  function setC<K extends keyof A11yComponents>(k: K, v: A11yComponents[K]) {
    setComponents((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div className="max-w-2xl w-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#111827]">Accessibility</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Configure ARIA labels and accessible text used throughout the course.</p>
      </div>

      <div className="flex flex-col gap-6">

        {/* ── Category: Global ── */}
        <div className="border border-[#e5e7eb] rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#e5e7eb]">
            <A11ySectionHeading>Global</A11ySectionHeading>
          </div>
          <div className="px-4 py-4 grid grid-cols-1 gap-3">
            <A11yTextInput label="Skip to main content label" value={global.skipToMainContentLabel} onChange={(v) => setG("skipToMainContentLabel", v)} placeholder="Skip navigation" />
            <A11yTextInput label="Answered Incorrectly" value={global.answeredIncorrectly} onChange={(v) => setG("answeredIncorrectly", v)} placeholder="You answered incorrectly" />
            <A11yTextInput label="Answered Correctly" value={global.answeredCorrectly} onChange={(v) => setG("answeredCorrectly", v)} placeholder="You answered correctly" />
            <A11yTextInput label="Selected Answer" value={global.selectedAnswer} onChange={(v) => setG("selectedAnswer", v)} placeholder="selected" />
            <A11yTextInput label="Unselected Answer" value={global.unselectedAnswer} onChange={(v) => setG("unselectedAnswer", v)} placeholder="not selected" />
            <A11yTextInput label="Skip Navigation" value={global.skipNavigation} onChange={(v) => setG("skipNavigation", v)} placeholder="Skip Navigation" />
            <A11yTextInput label="Previous" value={global.previous} onChange={(v) => setG("previous", v)} placeholder="back" />
            <A11yTextInput label="Navigation Drawer" value={global.navigationDrawer} onChange={(v) => setG("navigationDrawer", v)} placeholder="Open course resources." />
            <A11yTextInput label="Close" value={global.close} onChange={(v) => setG("close", v)} placeholder="Close" />
            <A11yTextInput label="Close Drawer" value={global.closeDrawer} onChange={(v) => setG("closeDrawer", v)} placeholder="Close Drawer" />
            <A11yTextInput label="Close Resources" value={global.closeResources} onChange={(v) => setG("closeResources", v)} placeholder="Close Resources" />
            <A11yTextInput label="Drawer" value={global.drawer} onChange={(v) => setG("drawer", v)} placeholder="Top of side drawer" />
            <A11yTextInput label="Close Popup" value={global.closePopup} onChange={(v) => setG("closePopup", v)} placeholder="Close Popup" />
            <A11yTextInput label="Next" value={global.next} onChange={(v) => setG("next", v)} placeholder="Next" />
            <A11yTextInput label="Done" value={global.done} onChange={(v) => setG("done", v)} placeholder="Done" />
            <A11yTextInput label="Complete" value={global.complete} onChange={(v) => setG("complete", v)} placeholder="Complete" />
            <A11yTextInput label="Incomplete" value={global.incomplete} onChange={(v) => setG("incomplete", v)} placeholder="Incomplete" />
            <A11yTextInput label="Incorrect" value={global.incorrect} onChange={(v) => setG("incorrect", v)} placeholder="Incorrect" />
            <A11yTextInput label="Correct" value={global.correct} onChange={(v) => setG("correct", v)} placeholder="Correct" />
            <A11yTextInput label="Locked" value={global.locked} onChange={(v) => setG("locked", v)} placeholder="Locked" />
            <A11yTextInput label="Visited" value={global.visited} onChange={(v) => setG("visited", v)} placeholder="Visited" />
            <A11yTextInput label="Required" value={global.required} onChange={(v) => setG("required", v)} placeholder="Required" />
            <A11yTextInput label="Optional" value={global.optional} onChange={(v) => setG("optional", v)} placeholder="Optional" />
            <A11yTextInput label="Top Of Content Object" value={global.topOfContentObject} onChange={(v) => setG("topOfContentObject", v)} placeholder="-" />
            <A11yTextInput label="Course" value={global.course} onChange={(v) => setG("course", v)} placeholder="Main menu" />
            <A11yTextInput label="Menu" value={global.menu} onChange={(v) => setG("menu", v)} placeholder="sub Menu" />
            <A11yTextInput label="Page" value={global.page} onChange={(v) => setG("page", v)} placeholder="Page" />
            <A11yTextInput label="Alternative Feedback Title" value={global.alternativeFeedbackTitle} onChange={(v) => setG("alternativeFeedbackTitle", v)} placeholder="Feedback" />
          </div>
        </div>

        {/* ── Category: Extensions ── */}
        <div className="border border-[#e5e7eb] rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#e5e7eb]">
            <A11ySectionHeading>Extensions</A11ySectionHeading>
          </div>
          <div className="px-4 py-4 flex flex-col gap-5">

            {/* Resources */}
            <div>
              <A11ySubHeading>Resources</A11ySubHeading>
              <div className="grid grid-cols-1 gap-3">
                <A11yTextInput label="Aria Region" value={extensions.resourcesAriaRegion} onChange={(v) => setE("resourcesAriaRegion", v)} placeholder="-" />
                <A11yTextInput label="Resources" value={extensions.resourcesLabel} onChange={(v) => setE("resourcesLabel", v)} placeholder="Additional resources" />
              </div>
            </div>

            {/* Trickle */}
            <div>
              <A11ySubHeading>Trickle</A11ySubHeading>
              <div className="grid grid-cols-1 gap-3">
                <A11yTextInput label="Incomplete Content" value={extensions.trickleIncompleteContent} onChange={(v) => setE("trickleIncompleteContent", v)} placeholder="There is incomplete content above. You must complete this before you can proceed through the course" />
              </div>
            </div>

            {/* Bookmarking */}
            <div>
              <A11ySubHeading>Bookmarking</A11ySubHeading>
              <div className="grid grid-cols-1 gap-3">
                <A11yTextInput label="Resume button text" value={extensions.bookmarkingResumeButtonText} onChange={(v) => setE("bookmarkingResumeButtonText", v)} placeholder="Resume" />
                <A11yTextInput label="Resume ARIA label" value={extensions.bookmarkingResumeAriaLabel} onChange={(v) => setE("bookmarkingResumeAriaLabel", v)} placeholder="Navigate to your furthest point of progress" />
              </div>
            </div>

            {/* Tutor */}
            <div>
              <A11ySubHeading>Tutor</A11ySubHeading>
              <div className="grid grid-cols-1 gap-3">
                <A11yTextInput label="Hide feedback" value={extensions.tutorHideFeedback} onChange={(v) => setE("tutorHideFeedback", v)} placeholder="Hide feedback" />
              </div>
            </div>

            {/* Laerdal Page Level Progress */}
            <div>
              <A11ySubHeading>Laerdal Page Level Progress</A11ySubHeading>
              <div className="grid grid-cols-1 gap-3">
                <A11yTextInput label="Laerdal Page Level Progress" value={extensions.plpLabel} onChange={(v) => setE("plpLabel", v)} placeholder="Page sections" />
                <A11yTextInput label="Page Level Progress Indicator Bar" value={extensions.plpIndicatorBar} onChange={(v) => setE("plpIndicatorBar", v)} placeholder="Page progress. ... {{percentageComplete}}%" />
                <A11yTextInput label="Page Level Progress Menu Bar" value={extensions.plpMenuBar} onChange={(v) => setE("plpMenuBar", v)} placeholder="Page completion {{percentageComplete}}%" />
                <A11yTextInput label="Page Level Progress End" value={extensions.plpEnd} onChange={(v) => setE("plpEnd", v)} placeholder="You have reached the end of the list of page sections." />
                <A11yTextInput label="Optional Content" value={extensions.plpOptionalContent} onChange={(v) => setE("plpOptionalContent", v)} placeholder="Optional content" />
              </div>
            </div>

            {/* Course Notes */}
            <div>
              <A11ySubHeading>Course Notes</A11ySubHeading>
              <div className="grid grid-cols-1 gap-3">
                <A11yTextInput label="Show Course notes" value={extensions.courseNotesShow} onChange={(v) => setE("courseNotesShow", v)} placeholder="Course notes" />
              </div>
            </div>

            {/* Drawer */}
            <div>
              <A11ySubHeading>Drawer</A11ySubHeading>
              <div className="grid grid-cols-1 gap-3">
                <A11yNumberInput label="Navigation bar order" value={extensions.drawerNavBarOrder} onChange={(v) => setE("drawerNavBarOrder", v)} placeholder="100" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[#374151]">Navigation tooltip</span>
                  <CheckboxRow checked={extensions.drawerNavTooltip} onChange={(v) => setE("drawerNavTooltip", v)} label="Checkbox" />
                </div>
                <A11yTextInput label="Text" value={extensions.drawerText} onChange={(v) => setE("drawerText", v)} placeholder="-" />
              </div>
            </div>

            {/* Skip navigation button */}
            <div>
              <A11ySubHeading>Skip navigation button</A11ySubHeading>
              <div className="grid grid-cols-1 gap-3">
                <A11yNumberInput label="Navigation bar order" value={extensions.skipNavNavBarOrder} onChange={(v) => setE("skipNavNavBarOrder", v)} placeholder="-100" />
              </div>
            </div>

            {/* Back button */}
            <div>
              <A11ySubHeading>Back button</A11ySubHeading>
              <div className="grid grid-cols-1 gap-3">
                <A11yNumberInput label="Navigation bar order" value={extensions.backNavBarOrder} onChange={(v) => setE("backNavBarOrder", v)} placeholder="0" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[#374151]">Back tooltip</span>
                  <CheckboxRow checked={extensions.backNavTooltip} onChange={(v) => setE("backNavTooltip", v)} label="Checkbox" />
                </div>
                <A11yTextInput label="Text" value={extensions.backText} onChange={(v) => setE("backText", v)} placeholder="-" />
              </div>
            </div>

          </div>
        </div>

        {/* ── Category: Components ── */}
        <div className="border border-[#e5e7eb] rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#e5e7eb]">
            <A11ySectionHeading>Components</A11ySectionHeading>
          </div>
          <div className="px-4 py-4 flex flex-col gap-5">

            {/* YouTube */}
            <div>
              <A11ySubHeading>YouTube</A11ySubHeading>
              <div className="grid grid-cols-1 gap-3">
                <A11yTextInput label="ARIA region" value={components.youtubeAriaRegion} onChange={(v) => setC("youtubeAriaRegion", v)} placeholder="This is a media component which displays a YouTube video. Select the play / pause button to watch it." />
                <A11yTextInput label="Skip To Transcript" value={components.youtubeSkipToTranscript} onChange={(v) => setC("youtubeSkipToTranscript", v)} placeholder="Skip to transcript" />
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Tracking & Analytics Panel ── */

interface TrackingState {
  /* Heading 1 — Tracking */
  trackingStandard: "scorm" | "xapi" | "hyperbridge" | "";

  /* Category 1 — Basic Settings */
  submitCompletionOnEveryAttempt: boolean;
  submitScoreToLms: boolean;

  /* Sub-category 1 — Tracking */
  storeQuestionState: boolean;
  storeQuestionAttemptState: boolean;
  recordInteractions: boolean;
  recordObjectives: boolean;
  shouldCompressData: boolean;

  /* Sub-category 2 — Reporting */
  trackingSuccessStatus: string;
  assessmentFailureStatus: string;

  /* Category 2 — Advanced Settings */
  scormVersion: string;
  scormDebugWindow: boolean;
  commitDataOnStatusChange: boolean;
  commitDataOnAnyChange: boolean;
  commitFrequencyMins: string;
  maxCommitRetries: string;
  commitRetryDelay: string;

  /* Heading 2 — Analytics */
  enableAnalytics: boolean;
  analyticsProvider: string;

  /* Advanced Settings — Analytics */
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

function TrackingAnalyticsPanel() {
  const [cfg, setCfg] = useState<TrackingState>(DEFAULT_TRACKING);
  const [standards, setStandards] = useState<string[]>([]);
  const [ecl, setEcl] = useState<string[]>([]);

  function set<K extends keyof TrackingState>(k: K, v: TrackingState[K]) {
    setCfg((prev) => ({ ...prev, [k]: v }));
  }

  const TRACKING_STANDARD_OPTIONS: { id: "scorm" | "xapi" | "hyperbridge"; label: string; description: string }[] = [
    { id: "scorm",       label: "SCORM",       description: "Sharable Content Object Reference Model" },
    { id: "xapi",        label: "xAPI",        description: "Experience API (Tin Can API)" },
    { id: "hyperbridge", label: "HyperBridge", description: "Laerdal HyperBridge protocol" },
  ];

  const SUCCESS_STATUS_OPTIONS = [
    { value: "passed",     label: "Passed" },
    { value: "completed",  label: "Completed" },
    { value: "incomplete", label: "Incomplete" },
    { value: "failed",     label: "Failed" },
  ];

  const FAILURE_STATUS_OPTIONS = [
    { value: "failed",     label: "Failed" },
    { value: "incomplete", label: "Incomplete" },
    { value: "unknown",    label: "Unknown" },
  ];

  const SCORM_VERSION_OPTIONS = [
    { value: "1.2",  label: "SCORM 1.2" },
    { value: "2004", label: "SCORM 2004" },
  ];

  const ANALYTICS_PROVIDER_OPTIONS = [
    { value: "google",  label: "Google Analytics" },
    { value: "adobe",   label: "Adobe Analytics" },
    { value: "matomo",  label: "Matomo" },
    { value: "segment", label: "Segment" },
  ];

  return (
    <div className="max-w-2xl w-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#111827]">Tracking &amp; Analytics</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Configure LMS tracking standards and analytics integrations for this course.</p>
      </div>

      <div className="flex flex-col gap-4">

        {/* ══════════════════════════════════════════════
            HEADING 1 — Tracking (Accordion)
        ══════════════════════════════════════════════ */}
        <Accordion
          defaultOpen
          title="Tracking"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          }
        >
          {/* Standard picker */}
          <div className="mt-3">
            <p className="text-xs text-[#6b7280] mb-3">Choose the basic tracking standard for the course</p>
            <div className="flex flex-col gap-1.5">
              {TRACKING_STANDARD_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 py-2.5 px-3 rounded-lg border cursor-pointer transition-colors ${
                    cfg.trackingStandard === opt.id
                      ? "border-[#2d6fa8] bg-[#f0f7ff]"
                      : "border-[#e5e7eb] hover:border-[#93c5fd] hover:bg-[#f9fafb]"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full shrink-0 border-2 flex items-center justify-center transition-colors ${
                      cfg.trackingStandard === opt.id ? "border-[#2d6fa8]" : "border-[#d1d5db]"
                    }`}
                    onClick={() => set("trackingStandard", opt.id)}
                  >
                    {cfg.trackingStandard === opt.id && (
                      <div className="w-2 h-2 rounded-full bg-[#2d6fa8]" />
                    )}
                  </div>
                  <div onClick={() => set("trackingStandard", opt.id)}>
                    <p className="text-sm font-semibold text-[#111827]">{opt.label}</p>
                    <p className="text-xs text-[#6b7280]">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ── Category 1 — Basic Settings ── */}
          <div className="mt-5">
            <TrackingSectionLabel>Basic Settings</TrackingSectionLabel>
            <div className="flex flex-col gap-0.5">
              <CheckboxRow
                checked={cfg.submitCompletionOnEveryAttempt}
                onChange={(v) => set("submitCompletionOnEveryAttempt", v)}
                label="Submit completion on every assessment attempt"
              />
              <CheckboxRow
                checked={cfg.submitScoreToLms}
                onChange={(v) => set("submitScoreToLms", v)}
                label="Submit score to LMS"
              />
            </div>
          </div>

          {/* ── Sub-category 1 — Tracking ── */}
          <div className="mt-4 ml-4 pl-3 border-l-2 border-[#e5e7eb]">
            <TrackingSubLabel>Tracking</TrackingSubLabel>
            <div className="flex flex-col gap-0.5">
              <CheckboxRow checked={cfg.storeQuestionState} onChange={(v) => set("storeQuestionState", v)} label="Store question state" />
              <CheckboxRow checked={cfg.storeQuestionAttemptState} onChange={(v) => set("storeQuestionAttemptState", v)} label="Store question attempt state" />
              <CheckboxRow checked={cfg.recordInteractions} onChange={(v) => set("recordInteractions", v)} label="Record interactions" />
              <CheckboxRow checked={cfg.recordObjectives} onChange={(v) => set("recordObjectives", v)} label="Record objectives" />
              <CheckboxRow checked={cfg.shouldCompressData} onChange={(v) => set("shouldCompressData", v)} label="Should compress data" />
            </div>
          </div>

          {/* ── Sub-category 2 — Reporting ── */}
          <div className="mt-4 ml-4 pl-3 border-l-2 border-[#e5e7eb]">
            <TrackingSubLabel>Reporting</TrackingSubLabel>
            <div className="flex flex-col gap-3">
              <TrackingSelect
                label="Tracking success status"
                value={cfg.trackingSuccessStatus}
                options={SUCCESS_STATUS_OPTIONS}
                onChange={(v) => set("trackingSuccessStatus", v)}
              />
              <TrackingSelect
                label="Assessment failure status"
                value={cfg.assessmentFailureStatus}
                options={FAILURE_STATUS_OPTIONS}
                onChange={(v) => set("assessmentFailureStatus", v)}
              />
            </div>
          </div>

          {/* ── Category 2 — Advanced Settings ── */}
          <div className="mt-5">
            <TrackingSectionLabel>Advanced Settings</TrackingSectionLabel>
            <div className="flex flex-col gap-3">
              <TrackingSelect
                label="SCORM version"
                value={cfg.scormVersion}
                options={SCORM_VERSION_OPTIONS}
                onChange={(v) => set("scormVersion", v)}
              />
              <CheckboxRow checked={cfg.scormDebugWindow} onChange={(v) => set("scormDebugWindow", v)} label="SCORM debug window" />
              <CheckboxRow checked={cfg.commitDataOnStatusChange} onChange={(v) => set("commitDataOnStatusChange", v)} label="Commit data on status change" />
              <CheckboxRow checked={cfg.commitDataOnAnyChange} onChange={(v) => set("commitDataOnAnyChange", v)} label="Commit data on any change" />
              <TrackingTextInput
                label="Frequency (mins) of automatic commits"
                value={cfg.commitFrequencyMins}
                onChange={(v) => set("commitFrequencyMins", v)}
                placeholder="e.g. 5"
              />
              <TrackingTextInput
                label="Maximum number of commit retries"
                value={cfg.maxCommitRetries}
                onChange={(v) => set("maxCommitRetries", v)}
                placeholder="e.g. 3"
              />
              <TrackingTextInput
                label="Commit retry delay"
                value={cfg.commitRetryDelay}
                onChange={(v) => set("commitRetryDelay", v)}
                placeholder="e.g. 2000"
              />
            </div>
          </div>
        </Accordion>

        {/* ══════════════════════════════════════════════
            HEADING 2 — Analytics (Accordion)
        ══════════════════════════════════════════════ */}
        <Accordion
          title="Analytics"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          }
        >
          <div className="mt-3 flex flex-col gap-3">
            <CheckboxRow
              checked={cfg.enableAnalytics}
              onChange={(v) => set("enableAnalytics", v)}
              label="Enable Analytics"
            />

            {cfg.enableAnalytics && (
              <TrackingSelect
                label="Analytics provider"
                value={cfg.analyticsProvider}
                options={ANALYTICS_PROVIDER_OPTIONS}
                onChange={(v) => set("analyticsProvider", v)}
              />
            )}
          </div>

          {/* Advanced Settings */}
          <div className="mt-5">
            <TrackingSectionLabel>Advanced Settings</TrackingSectionLabel>
            <div className="flex flex-col gap-3">
              <TrackingTextInput
                label="Project tag"
                value={cfg.projectTag}
                onChange={(v) => set("projectTag", v)}
                placeholder="Enter project tag"
              />
              <TrackingTextInput
                label="Portfolio"
                value={cfg.portfolio}
                onChange={(v) => set("portfolio", v)}
                placeholder="Enter portfolio"
              />
              <TrackingTextInput
                label="Resource Link ID"
                value={cfg.resourceLinkId}
                onChange={(v) => set("resourceLinkId", v)}
                placeholder="Enter resource link ID"
              />

              {/* Standard */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[#374151]">Standard</span>
                <div className="flex flex-wrap gap-2">
                  {standards.map((s, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-[#dbeeff] text-[#2d6fa8] font-medium">
                      {s}
                      <button
                        type="button"
                        onClick={() => setStandards((prev) => prev.filter((_, idx) => idx !== i))}
                        className="hover:text-[#1a4f7a]"
                        aria-label={`Remove ${s}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <AddTagButton
                    label="Add"
                    onClick={() => {
                      const val = window.prompt("Enter standard value:");
                      if (val?.trim()) setStandards((prev) => [...prev, val.trim()]);
                    }}
                  />
                </div>
              </div>

              {/* ECL */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[#374151]">ECL (e-Course Library)</span>
                <div className="flex flex-wrap gap-2">
                  {ecl.map((s, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0] font-medium">
                      {s}
                      <button
                        type="button"
                        onClick={() => setEcl((prev) => prev.filter((_, idx) => idx !== i))}
                        className="hover:text-[#15803d]"
                        aria-label={`Remove ${s}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <AddTagButton
                    label="Add"
                    onClick={() => {
                      const val = window.prompt("Enter ECL value:");
                      if (val?.trim()) setEcl((prev) => [...prev, val.trim()]);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Accordion>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPLETION & PROGRESS PANEL
   ═══════════════════════════════════════════════════════════════ */

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
  /* 1 – Completion Rules */
  pageCompletionRule: "all-content" | "required-interaction";
  courseCompletionRule: "all-content" | "assessment";

  /* 2 – Completion Feedback */
  notifierLine1: string;
  notifierLine2: string;

  /* 3 – Resume & Bookmarking */
  bookmarkingEnabled: boolean;
  bookmarkingLevel: BookmarkLocation;
  bookmarkingReturn: BookmarkReturn;
  resumeEnabled: boolean;
  resumeTitle: string;
  resumeMessage: string;

  /* 4 – Progress Indicators */
  progressIndicators: string[];
  progressType: ProgressType;
  progressFormat: ProgressFormat;

  /* 5 – Time Estimate */
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

      {/* ── Page header ── */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#111827]">Completion &amp; Progress</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Configure how course and page completion is tracked and displayed to learners.</p>
      </div>

      {/* ════════════════════════════════════
          H1 — COMPLETION RULES
      ════════════════════════════════════ */}
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

      {/* ════════════════════════════════════
          H2 — COMPLETION FEEDBACK
      ════════════════════════════════════ */}
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

      {/* ════════════════════════════════════
          H3 — RESUME & BOOKMARKING
      ════════════════════════════════════ */}
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
                label="Bookmarking location — learner is taken back to"
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

      {/* ════════════════════════════════════
          H3 — PROGRESS INDICATORS
      ════════════════════════════════════ */}
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

      {/* ════════════════════════════════════
          H4 — TIME ESTIMATE
      ════════════════════════════════════ */}
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

/* ─────────────────────────────────────────────────────────────
   LEARNER EXPERIENCE PANEL — Learning Resources accordion
   ───────────────────────────────────────────────────────────── */

type ResourceFormat = "document" | "media" | "link" | "custom";

interface LearningResource {
  id: string;
  format: ResourceFormat;
  forceDownload: boolean;
  title: string;
  fileName: string;
  description: string;
  sourceType: "asset" | "url";
  assetValue: string;
  urlValue: string;
  displayOnEveryPage: boolean;
}

interface LearningResourcesState {
  enabled: boolean;
  sectionTitle: string;
  description: string;
  resources: LearningResource[];
}

const RESOURCE_FORMAT_OPTIONS: { value: ResourceFormat; label: string }[] = [
  { value: "document", label: "Document" },
  { value: "media",    label: "Media" },
  { value: "link",     label: "Link" },
  { value: "custom",   label: "Custom" },
];

function newResource(): LearningResource {
  return {
    id: Math.random().toString(36).slice(2),
    format: "document",
    forceDownload: false,
    title: "",
    fileName: "",
    description: "",
    sourceType: "asset",
    assetValue: "",
    urlValue: "",
    displayOnEveryPage: false,
  };
}

/* small helpers */
function LrToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6fa8] ${checked ? "bg-[#2d6fa8]" : "bg-[#d1d5db]"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150 ${checked ? "translate-x-4" : ""}`} />
      </button>
      <span className="text-sm text-[#374151]">{label}</span>
    </label>
  );
}

function LrField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[#374151]">{label}</label>
      {children}
    </div>
  );
}

const LR_INPUT = "w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent";
const LR_TEXTAREA = `${LR_INPUT} resize-none`;

/* Add Resource modal/drawer */
function AddResourceDialog({
  initial,
  onAdd,
  onCancel,
}: {
  initial?: LearningResource;
  onAdd: (r: LearningResource) => void;
  onCancel: () => void;
}) {
  const [res, setRes] = useState<LearningResource>(initial ?? newResource());
  const set = <K extends keyof LearningResource>(k: K, v: LearningResource[K]) =>
    setRes((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f6] shrink-0">
          <h3 className="text-base font-bold text-[#111827]">Add Resource</h3>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Resource Format */}
          <LrField label="Resource Format">
            <div className="relative">
              <select
                value={res.format}
                onChange={(e) => set("format", e.target.value as ResourceFormat)}
                aria-label="Resource Format"
                className={`${LR_INPUT} appearance-none pr-8`}
              >
                {RESOURCE_FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </LrField>

          {/* Force Download */}
          <LrToggle
            checked={res.forceDownload}
            onChange={(v) => set("forceDownload", v)}
            label="Force download"
          />

          {/* Title */}
          <LrField label="Title">
            <input
              type="text"
              value={res.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Enter resource title"
              className={LR_INPUT}
            />
          </LrField>

          {/* File Name */}
          <LrField label="File Name">
            <input
              type="text"
              value={res.fileName}
              onChange={(e) => set("fileName", e.target.value)}
              placeholder="Enter file name"
              className={LR_INPUT}
            />
          </LrField>

          {/* Description */}
          <LrField label="Description">
            <textarea
              value={res.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Enter resource description"
              rows={3}
              className={LR_TEXTAREA}
            />
          </LrField>

          {/* Source — asset vs URL tabs */}
          <LrField label="Source">
            <div className="flex rounded-lg border border-[#e5e7eb] overflow-hidden mb-2">
              {(["asset", "url"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("sourceType", t)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    res.sourceType === t ? "bg-[#2d6fa8] text-white" : "bg-white text-[#6b7280] hover:bg-[#f9fafb]"
                  }`}
                >
                  {t === "asset" ? "Select from Asset" : "URL"}
                </button>
              ))}
            </div>
            {res.sourceType === "asset" ? (
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#d1d5db] rounded-xl py-4 text-sm text-[#6b7280] hover:border-[#2d6fa8] hover:text-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                {res.assetValue ? res.assetValue : "Browse assets…"}
              </button>
            ) : (
              <input
                type="url"
                value={res.urlValue}
                onChange={(e) => set("urlValue", e.target.value)}
                placeholder="https://example.com/resource"
                className={LR_INPUT}
              />
            )}
          </LrField>

          {/* Display on every page */}
          <LrToggle
            checked={res.displayOnEveryPage}
            onChange={(v) => set("displayOnEveryPage", v)}
            label="Is display on every page?"
          />
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#f3f4f6] shrink-0 bg-[#f9fafb]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#e5e7eb] rounded-lg hover:bg-[#f3f4f6] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onAdd(res)}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

/* Resource format icon */
function ResourceFormatIcon({ format }: { format: ResourceFormat }) {
  if (format === "document") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
  if (format === "media") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  );
  if (format === "link") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

/* ── Course Feedback types ── */
type CourseFeedbackOption = "autoOpen" | "hideAfterSubmit";

interface CourseFeedbackState {
  enabled: boolean;
  options: CourseFeedbackOption[];
  buttonText: string;
  widgetTitle: string;
  highestRatingLabel: string;
  lowestRatingLabel: string;
  commentTitle: string;
  commentPlaceholder: string;
  thankYouMessage: string;
}

const COURSE_FEEDBACK_OPTIONS: { value: CourseFeedbackOption; label: string }[] = [
  { value: "autoOpen",        label: "Auto-open on course complete" },
  { value: "hideAfterSubmit", label: "Hide button after submission" },
];

/* ── Ask AI Tutor types ── */
type AiTutorCapability = "allPages" | "answerFromContent" | "useLearnerNotes" | "stepByStep";
type AiTutorKnowledge  = "concise" | "detailed";
type AiTutorControl    = "drawer" | "floating";

interface AiTutorDocument {
  id: string;
  name: string;
}

interface AiTutorState {
  enabled: boolean;
  title: string;
  availability: string;
  capabilities: AiTutorCapability[];
  knowledge: AiTutorKnowledge;
  documents: AiTutorDocument[];
  control: AiTutorControl;
  promptPlaceholder: string;
}

const AI_TUTOR_CAPABILITIES: { value: AiTutorCapability; label: string }[] = [
  { value: "allPages",          label: "Available on all pages" },
  { value: "answerFromContent", label: "Answer question from course content" },
  { value: "useLearnerNotes",   label: "Use learner notes" },
  { value: "stepByStep",        label: "Provide step-by-step guidance" },
];

const AI_TUTOR_KNOWLEDGE_OPTIONS: { value: AiTutorKnowledge; label: string }[] = [
  { value: "concise",  label: "Concise" },
  { value: "detailed", label: "Detailed" },
];

const AI_TUTOR_CONTROL_OPTIONS: { value: AiTutorControl; label: string }[] = [
  { value: "drawer",   label: "Drawer" },
  { value: "floating", label: "Floating button" },
];

/* ── Learner Notes types ── */
type NotesAvailability = "all" | "selected";
type NotesFeature = "create" | "upload" | "download" | "search";

interface LearnerNotesState {
  enabled: boolean;
  sectionTitle: string;
  helperText: string;
  availability: NotesAvailability;
  features: NotesFeature[];
  editorPlaceholder: string;
}

const NOTES_AVAILABILITY_OPTIONS: { value: NotesAvailability; label: string }[] = [
  { value: "all",      label: "Available on all pages" },
  { value: "selected", label: "Only on selected pages" },
];

const NOTES_FEATURES: { value: NotesFeature; label: string }[] = [
  { value: "create",   label: "Allow note creation" },
  { value: "upload",   label: "Allow file upload" },
  { value: "download", label: "Allow download / export" },
  { value: "search",   label: "Enable search" },
];

/* ── Learner Search types ── */
type SearchMatchRule =
  | "begins"
  | "contains"
  | "equals"
  | "startsWith";

type SearchFeature = "highlight" | "showKeywords";
type SearchResultPreview = "short" | "medium" | "long";

interface LearnerSearchState {
  enabled: boolean;
  sectionTitle: string;
  helperText: string;
  matchRules: SearchMatchRule[];
  features: SearchFeature[];
  resultPreview: SearchResultPreview;
  searchPlaceholder: string;
  noResultMessage: string;
  loadingMessage: string;
}

const SEARCH_MATCH_RULES: { value: SearchMatchRule; label: string }[] = [
  { value: "begins",     label: "A word in the content begins the search phrase word" },
  { value: "contains",   label: "A word in the content contains the search phrase word" },
  { value: "equals",     label: "A word in the content equals the search phrase word" },
  { value: "startsWith", label: "A word in the content starts with the search phrase word" },
];

const SEARCH_FEATURES: { value: SearchFeature; label: string }[] = [
  { value: "highlight",    label: "Highlight search terms in result" },
  { value: "showKeywords", label: "Show matching keywords" },
];

const SEARCH_RESULT_PREVIEW_OPTIONS: { value: SearchResultPreview; label: string }[] = [
  { value: "short",  label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long",   label: "Long" },
];

/* shared multi-select checkbox list */
function LrCheckList<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (v: T[]) => void;
}) {
  function toggle(val: T) {
    onChange(
      selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val],
    );
  }
  return (
    <div className="space-y-1">
      {options.map(({ value, label }) => {
        const checked = selected.includes(value);
        return (
          <label
            key={value}
            className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-[#f9fafb] cursor-pointer group"
          >
            <div
              onClick={() => toggle(value)}
              className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${
                checked
                  ? "bg-[#2d6fa8] border-[#2d6fa8]"
                  : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
              }`}
            >
              {checked && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <span className="text-sm text-[#374151] leading-snug">{label}</span>
          </label>
        );
      })}
    </div>
  );
}

/* shared single-select radio list */
function LrRadioList<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {options.map(({ value, label }) => {
        const active = selected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              active
                ? "bg-[#2d6fa8] border-[#2d6fa8] text-white"
                : "bg-white border-[#e5e7eb] text-[#374151] hover:border-[#93c5fd] hover:bg-[#f0f7ff]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* reusable accordion shell used by both Learning Resources and Learner Search */
function LeAccordion({
  open,
  onToggle,
  icon,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#e5e7eb] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-[#f9fafb] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[#6b7280]">{icon}</span>
          <span className="text-sm font-semibold text-[#111827]">{title}</span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-5 pt-1 border-t border-[#f3f4f6] bg-white space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

function LearnerExperiencePanel() {
  /* ── Learning Resources state ── */
  const [lrState, setLrState] = useState<LearningResourcesState>({
    enabled: false,
    sectionTitle: "",
    description: "",
    resources: [],
  });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [lrOpen, setLrOpen] = useState(false);

  const setLr = <K extends keyof LearningResourcesState>(k: K, v: LearningResourcesState[K]) =>
    setLrState((prev) => ({ ...prev, [k]: v }));

  function handleAddResource(r: LearningResource) {
    setLrState((prev) => ({ ...prev, resources: [...prev.resources, r] }));
    setShowAddDialog(false);
  }

  function handleRemoveResource(id: string) {
    setLrState((prev) => ({ ...prev, resources: prev.resources.filter((r) => r.id !== id) }));
  }

  /* ── Learner Search state ── */
  const [lsOpen, setLsOpen] = useState(false);
  const [lsState, setLsState] = useState<LearnerSearchState>({
    enabled: false,
    sectionTitle: "Search",
    helperText: "",
    matchRules: [],
    features: [],
    resultPreview: "medium",
    searchPlaceholder: "",
    noResultMessage: "",
    loadingMessage: "",
  });

  const setLs = <K extends keyof LearnerSearchState>(k: K, v: LearnerSearchState[K]) =>
    setLsState((prev) => ({ ...prev, [k]: v }));

  /* ── Learner Notes state ── */
  const [lnOpen, setLnOpen] = useState(false);
  const [lnState, setLnState] = useState<LearnerNotesState>({
    enabled: false,
    sectionTitle: "",
    helperText: "",
    availability: "all",
    features: [],
    editorPlaceholder: "",
  });

  const setLn = <K extends keyof LearnerNotesState>(k: K, v: LearnerNotesState[K]) =>
    setLnState((prev) => ({ ...prev, [k]: v }));

  /* ── Ask AI Tutor state ── */
  const [atOpen, setAtOpen] = useState(false);
  const [atState, setAtState] = useState<AiTutorState>({
    enabled: false,
    title: "",
    availability: "",
    capabilities: [],
    knowledge: "concise",
    documents: [],
    control: "drawer",
    promptPlaceholder: "",
  });

  const setAt = <K extends keyof AiTutorState>(k: K, v: AiTutorState[K]) =>
    setAtState((prev) => ({ ...prev, [k]: v }));

  /* ── Course Feedback state ── */
  const [cfOpen, setCfOpen] = useState(false);
  const [cfState, setCfState] = useState<CourseFeedbackState>({
    enabled: false,
    options: [],
    buttonText: "",
    widgetTitle: "",
    highestRatingLabel: "",
    lowestRatingLabel: "",
    commentTitle: "",
    commentPlaceholder: "",
    thankYouMessage: "",
  });

  const setCf = <K extends keyof CourseFeedbackState>(k: K, v: CourseFeedbackState[K]) =>
    setCfState((prev) => ({ ...prev, [k]: v }));

  function handleAddDocument() {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        setAtState((prev) => ({
          ...prev,
          documents: [...prev.documents, { id: Math.random().toString(36).slice(2), name: file.name }],
        }));
      }
    };
    input.click();
  }

  function handleRemoveDocument(id: string) {
    setAtState((prev) => ({ ...prev, documents: prev.documents.filter((d) => d.id !== id) }));
  }

  return (
    <div className="max-w-2xl w-full">
      {/* header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#111827]">Learner Experience</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Configure what learners see and can access throughout the course.</p>
      </div>

      <div className="space-y-3">

        {/* ── Learning Resources accordion ── */}
        <LeAccordion
          open={lrOpen}
          onToggle={() => setLrOpen((o) => !o)}
          title="Learning Resources"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          }
        >
          {/* Enable toggle */}
          <div className="pt-3">
            <LrToggle
              checked={lrState.enabled}
              onChange={(v) => setLr("enabled", v)}
              label="Enable Learning Resources"
            />
          </div>

          {lrState.enabled && (
            <>
              {/* Section Title */}
              <LrField label="Section Title">
                <input
                  type="text"
                  value={lrState.sectionTitle}
                  onChange={(e) => setLr("sectionTitle", e.target.value)}
                  placeholder="e.g. Additional Resources"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Description */}
              <LrField label="Description">
                <textarea
                  value={lrState.description}
                  onChange={(e) => setLr("description", e.target.value)}
                  placeholder="Briefly describe the resources available to learners"
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Resources list */}
              {lrState.resources.length > 0 && (
                <div className="space-y-2">
                  {lrState.resources.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
                      <span className="text-[#6b7280] shrink-0">
                        <ResourceFormatIcon format={r.format} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">{r.title || <span className="text-[#9ca3af] font-normal">Untitled resource</span>}</p>
                        <p className="text-xs text-[#6b7280] capitalize">{r.format}{r.displayOnEveryPage ? " · Every page" : ""}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveResource(r.id)}
                        className="p-1 rounded text-[#9ca3af] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-colors shrink-0"
                        title="Remove resource"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add resource button */}
              <button
                type="button"
                onClick={() => setShowAddDialog(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-[#d1d5db] text-sm text-[#6b7280] hover:border-[#2d6fa8] hover:text-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors w-full justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add resource
              </button>
            </>
          )}
        </LeAccordion>

        {/* ── Learner Search accordion ── */}
        <LeAccordion
          open={lsOpen}
          onToggle={() => setLsOpen((o) => !o)}
          title="Learner Search"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          }
        >
          {/* Enable toggle */}
          <div className="pt-3">
            <LrToggle
              checked={lsState.enabled}
              onChange={(v) => setLs("enabled", v)}
              label="Enable Search"
            />
          </div>

          {lsState.enabled && (
            <>
              {/* Section Title */}
              <LrField label="Section Title">
                <input
                  type="text"
                  value={lsState.sectionTitle}
                  onChange={(e) => setLs("sectionTitle", e.target.value)}
                  placeholder="Search"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Helper Text */}
              <LrField label="Helper Text">
                <textarea
                  value={lsState.helperText}
                  onChange={(e) => setLs("helperText", e.target.value)}
                  placeholder="Add helper text shown to learners above the search input"
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Search Scope ── Match On Rules */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Search Scope</p>
                  <p className="text-xs font-semibold text-[#111827] mt-2 mb-0.5">Match On Rules</p>
                  <p className="text-xs text-[#6b7280]">Select which word-matching strategies are active.</p>
                </div>
                <div className="px-4 py-2">
                  <LrCheckList<SearchMatchRule>
                    options={SEARCH_MATCH_RULES}
                    selected={lsState.matchRules}
                    onChange={(v) => setLs("matchRules", v)}
                  />
                </div>
              </div>

              {/* Features */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Features</p>
                  <p className="text-xs text-[#6b7280] mt-1">Enable optional search result display features.</p>
                </div>
                <div className="px-4 py-2">
                  <LrCheckList<SearchFeature>
                    options={SEARCH_FEATURES}
                    selected={lsState.features}
                    onChange={(v) => setLs("features", v)}
                  />
                </div>
              </div>

              {/* Result Preview */}
              <LrField label="Result Preview">
                <LrRadioList<SearchResultPreview>
                  options={SEARCH_RESULT_PREVIEW_OPTIONS}
                  selected={lsState.resultPreview}
                  onChange={(v) => setLs("resultPreview", v)}
                />
              </LrField>

              {/* Search Placeholder */}
              <LrField label="Search Placeholder">
                <input
                  type="text"
                  value={lsState.searchPlaceholder}
                  onChange={(e) => setLs("searchPlaceholder", e.target.value)}
                  placeholder="e.g. Type to search…"
                  className={LR_INPUT}
                />
              </LrField>

              {/* No Result Message */}
              <LrField label="No Result Message">
                <input
                  type="text"
                  value={lsState.noResultMessage}
                  onChange={(e) => setLs("noResultMessage", e.target.value)}
                  placeholder="e.g. No results found for your search."
                  className={LR_INPUT}
                />
              </LrField>

              {/* Loading Message */}
              <LrField label="Loading Message">
                <input
                  type="text"
                  value={lsState.loadingMessage}
                  onChange={(e) => setLs("loadingMessage", e.target.value)}
                  placeholder="e.g. Searching…"
                  className={LR_INPUT}
                />
              </LrField>
            </>
          )}
        </LeAccordion>

        {/* ── Learner Notes accordion ── */}
        <LeAccordion
          open={lnOpen}
          onToggle={() => setLnOpen((o) => !o)}
          title="Learner Notes"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          }
        >
          {/* Enable toggle */}
          <div className="pt-3">
            <LrToggle
              checked={lnState.enabled}
              onChange={(v) => setLn("enabled", v)}
              label="Enable Notes"
            />
          </div>

          {lnState.enabled && (
            <>
              {/* Section Title */}
              <LrField label="Section Title">
                <input
                  type="text"
                  value={lnState.sectionTitle}
                  onChange={(e) => setLn("sectionTitle", e.target.value)}
                  placeholder="e.g. My Notes"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Helper Text */}
              <LrField label="Helper Text">
                <textarea
                  value={lnState.helperText}
                  onChange={(e) => setLn("helperText", e.target.value)}
                  placeholder="Add helper text shown to learners above the notes editor"
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Notes Availability */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Notes Availability</p>
                  <p className="text-xs text-[#6b7280] mt-1">Choose which pages the notes panel is available on.</p>
                </div>
                <div className="px-4 py-3 space-y-1">
                  {NOTES_AVAILABILITY_OPTIONS.map(({ value, label }) => {
                    const active = lnState.availability === value;
                    return (
                      <label
                        key={value}
                        className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[#f9fafb] cursor-pointer group"
                      >
                        <div
                          onClick={() => setLn("availability", value)}
                          className={`w-4 h-4 rounded-full shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${
                            active
                              ? "border-[#2d6fa8] bg-[#2d6fa8]"
                              : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
                          }`}
                        >
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                        </div>
                        <span className="text-sm text-[#374151]">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Features */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Features</p>
                  <p className="text-xs text-[#6b7280] mt-1">Enable optional note-taking capabilities.</p>
                </div>
                <div className="px-4 py-2">
                  <LrCheckList<NotesFeature>
                    options={NOTES_FEATURES}
                    selected={lnState.features}
                    onChange={(v) => setLn("features", v)}
                  />
                </div>
              </div>

              {/* Editor Placeholder Text */}
              <LrField label="Editor Placeholder Text">
                <input
                  type="text"
                  value={lnState.editorPlaceholder}
                  onChange={(e) => setLn("editorPlaceholder", e.target.value)}
                  placeholder="e.g. Start typing your notes here…"
                  className={LR_INPUT}
                />
              </LrField>
            </>
          )}
        </LeAccordion>

        {/* ── Ask AI Tutor accordion ── */}
        <LeAccordion
          open={atOpen}
          onToggle={() => setAtOpen((o) => !o)}
          title="Ask AI Tutor"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        >
          {/* Enable toggle */}
          <div className="pt-3">
            <LrToggle
              checked={atState.enabled}
              onChange={(v) => setAt("enabled", v)}
              label="Enable AI Tutor"
            />
          </div>

          {atState.enabled && (
            <>
              {/* Title */}
              <LrField label="Title">
                <input
                  type="text"
                  value={atState.title}
                  onChange={(e) => setAt("title", e.target.value)}
                  placeholder="e.g. Ask the AI Tutor"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Availability */}
              <LrField label="Availability">
                <textarea
                  value={atState.availability}
                  onChange={(e) => setAt("availability", e.target.value)}
                  placeholder="Describe when and where the AI Tutor is available to learners"
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Capabilities */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Capabilities</p>
                  <p className="text-xs text-[#6b7280] mt-1">Select what the AI Tutor is allowed to do.</p>
                </div>
                <div className="px-4 py-2">
                  <LrCheckList<AiTutorCapability>
                    options={AI_TUTOR_CAPABILITIES}
                    selected={atState.capabilities}
                    onChange={(v) => setAt("capabilities", v)}
                  />
                </div>
              </div>

              {/* Knowledge Sources */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Knowledge Sources</p>
                  <p className="text-xs text-[#6b7280] mt-1">Choose the response style for the AI Tutor.</p>
                </div>
                <div className="px-4 py-3">
                  <LrRadioList<AiTutorKnowledge>
                    options={AI_TUTOR_KNOWLEDGE_OPTIONS}
                    selected={atState.knowledge}
                    onChange={(v) => setAt("knowledge", v)}
                  />
                </div>
              </div>

              {/* Documents */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Documents</p>
                  <p className="text-xs text-[#6b7280] mt-1">Upload reference documents for the AI Tutor to draw from.</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {atState.documents.length > 0 && (
                    <div className="space-y-1.5">
                      {atState.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                          <span className="flex-1 text-sm text-[#374151] truncate">{doc.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="p-1 rounded text-[#9ca3af] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-colors shrink-0"
                            title="Remove document"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleAddDocument}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-[#d1d5db] text-sm text-[#6b7280] hover:border-[#2d6fa8] hover:text-[#2d6fa8] hover:bg-[#f0f7ff] transition-colors w-full justify-center"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add document
                  </button>
                </div>
              </div>

              {/* Controls */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Controls</p>
                  <p className="text-xs text-[#6b7280] mt-1">Choose how learners open the AI Tutor.</p>
                </div>
                <div className="px-4 py-3">
                  <LrRadioList<AiTutorControl>
                    options={AI_TUTOR_CONTROL_OPTIONS}
                    selected={atState.control}
                    onChange={(v) => setAt("control", v)}
                  />
                </div>
              </div>

              {/* Prompt Placeholder */}
              <LrField label="Prompt Placeholder">
                <textarea
                  value={atState.promptPlaceholder}
                  onChange={(e) => setAt("promptPlaceholder", e.target.value)}
                  placeholder="e.g. Ask me anything about this course…"
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>
            </>
          )}
        </LeAccordion>

        {/* ── Course Feedback accordion ── */}
        <LeAccordion
          open={cfOpen}
          onToggle={() => setCfOpen((o) => !o)}
          title="Course Feedback"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          }
        >
          {/* Enable toggle */}
          <div className="pt-3">
            <LrToggle
              checked={cfState.enabled}
              onChange={(v) => setCf("enabled", v)}
              label="Enable Course Feedback"
            />
          </div>

          {cfState.enabled && (
            <>
              {/* Options — multi-select */}
              <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#f3f4f6]">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Options</p>
                </div>
                <div className="px-4 py-2">
                  <LrCheckList<CourseFeedbackOption>
                    options={COURSE_FEEDBACK_OPTIONS}
                    selected={cfState.options}
                    onChange={(v) => setCf("options", v)}
                  />
                </div>
              </div>

              {/* Button text */}
              <LrField label="Text displayed on the feedback button">
                <input
                  type="text"
                  value={cfState.buttonText}
                  onChange={(e) => setCf("buttonText", e.target.value)}
                  placeholder="e.g. Give Feedback"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Widget title */}
              <LrField label="Title for the feedback widget">
                <input
                  type="text"
                  value={cfState.widgetTitle}
                  onChange={(e) => setCf("widgetTitle", e.target.value)}
                  placeholder="e.g. How did we do?"
                  className={LR_INPUT}
                />
              </LrField>

              {/* Rating labels */}
              <div className="grid grid-cols-2 gap-3">
                <LrField label="Highest rating label">
                  <input
                    type="text"
                    value={cfState.highestRatingLabel}
                    onChange={(e) => setCf("highestRatingLabel", e.target.value)}
                    placeholder="e.g. Excellent"
                    className={LR_INPUT}
                  />
                </LrField>
                <LrField label="Lowest rating label">
                  <input
                    type="text"
                    value={cfState.lowestRatingLabel}
                    onChange={(e) => setCf("lowestRatingLabel", e.target.value)}
                    placeholder="e.g. Poor"
                    className={LR_INPUT}
                  />
                </LrField>
              </div>

              {/* Comment title */}
              <LrField label="Comment title">
                <textarea
                  value={cfState.commentTitle}
                  onChange={(e) => setCf("commentTitle", e.target.value)}
                  placeholder="e.g. Tell us more about your experience"
                  rows={2}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Comment placeholder */}
              <LrField label="Placeholder text for the comment section">
                <textarea
                  value={cfState.commentPlaceholder}
                  onChange={(e) => setCf("commentPlaceholder", e.target.value)}
                  placeholder="e.g. Share your thoughts…"
                  rows={2}
                  className={LR_TEXTAREA}
                />
              </LrField>

              {/* Thank you message */}
              <LrField label="Message shown on the Thank you screen">
                <textarea
                  value={cfState.thankYouMessage}
                  onChange={(e) => setCf("thankYouMessage", e.target.value)}
                  placeholder="e.g. Thank you for your feedback! We really appreciate it."
                  rows={3}
                  className={LR_TEXTAREA}
                />
              </LrField>
            </>
          )}
        </LeAccordion>

      </div>

      {showAddDialog && (
        <AddResourceDialog
          onAdd={handleAddResource}
          onCancel={() => setShowAddDialog(false)}
        />
      )}

      <div className="h-8" />
    </div>
  );
}

/* ── Technical Settings panel ── */
const SCREEN_SIZE_OPTIONS = ["Small", "Medium", "Large", "Extra Large"];
const LOG_LEVEL_OPTIONS   = ["Info", "Debug", "Warn", "Error", "None"];

function TsAccordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#e5e7eb] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-[#f9fafb] transition-colors"
      >
        <span className="text-sm font-semibold text-[#111827]">{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 pt-2 border-t border-[#f3f4f6] bg-white flex flex-col gap-4">{children}</div>}
    </div>
  );
}

function TsDropdown({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#374151]">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 border border-[#d1d5db] rounded-lg bg-white text-sm text-[#374151] hover:border-[#9ca3af] transition-colors"
        >
          <span>{value}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-20 py-1 overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt} type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors ${
                  value === opt ? "bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"
                }`}
              >
                {opt}
                {value === opt && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TsCheckbox({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer select-none group">
      <div
        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
          checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "bg-white border-[#d1d5db] group-hover:border-[#93c5fd]"
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className="text-sm text-[#374151]">{label}</span>
    </label>
  );
}

function TechnicalSettingsPanel() {
  const [screenSize, setScreenSize]   = useState("Medium");
  const [smallBp, setSmallBp]         = useState("");
  const [mediumBp, setMediumBp]       = useState("");
  const [largeBp, setLargeBp]         = useState("");
  const [xlBp, setXlBp]               = useState("");

  const [optimizedScroll, setOptimizedScroll] = useState(false);
  const [sourceMaps, setSourceMaps]           = useState(false);
  const [screenReader, setScreenReader]       = useState(false);

  const [enableLogging, setEnableLogging] = useState(false);
  const [logLevel, setLogLevel]           = useState("Info");
  const [strictMode, setStrictMode]       = useState(false);

  const [customCss, setCustomCss]     = useState("");
  const [cssExpanded, setCssExpanded] = useState(false);

  const taClass = "w-full text-sm text-[#374151] border border-[#d1d5db] rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]";

  return (
    <div className="max-w-2xl w-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#111827]">Technical Settings</h2>
        <p className="text-sm text-[#6b7280] mt-0.5">Advanced configuration settings for developers and advanced users</p>
      </div>

      <div className="flex flex-col gap-4">

        {/* Display & Responsiveness */}
        <TsAccordion title="Display & Responsiveness" defaultOpen>
          <TsDropdown label="Screen Size" value={screenSize} options={SCREEN_SIZE_OPTIONS} onChange={setScreenSize} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">Small</label>
            <textarea rows={2} value={smallBp} onChange={(e) => setSmallBp(e.target.value)} placeholder="Small breakpoint CSS" className={taClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">Medium</label>
            <textarea rows={2} value={mediumBp} onChange={(e) => setMediumBp(e.target.value)} placeholder="Medium breakpoint CSS" className={taClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">Large</label>
            <textarea rows={2} value={largeBp} onChange={(e) => setLargeBp(e.target.value)} placeholder="Large breakpoint CSS" className={taClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">Extra Large</label>
            <textarea rows={2} value={xlBp} onChange={(e) => setXlBp(e.target.value)} placeholder="Extra large breakpoint CSS" className={taClass} />
          </div>
        </TsAccordion>

        {/* Accessibility & Embedding */}
        <TsAccordion title="Accessibility & Embedding">
          <p className="text-sm text-[#6b7280] -mt-1">Control how your course behaves in assistive and embedded environments.</p>
          <div className="flex flex-col gap-3">
            <TsCheckbox id="ts-opt-scroll" label="Enable optimized scrolling in iFrames" checked={optimizedScroll} onChange={setOptimizedScroll} />
            <TsCheckbox id="ts-src-maps"   label="Generate source maps"                  checked={sourceMaps}      onChange={setSourceMaps} />
          </div>
          <div className="pt-3 border-t border-[#f3f4f6] flex flex-col gap-2">
            <p className="text-sm font-semibold text-[#374151]">Accessibility</p>
            <TsCheckbox id="ts-screen-reader" label="Enable screen reader support" checked={screenReader} onChange={setScreenReader} />
          </div>
        </TsAccordion>

        {/* Runtime Behavior */}
        <TsAccordion title="Runtime Behavior">
          <p className="text-sm text-[#6b7280] -mt-1">Configure how your course operates when run.</p>
          <div className="flex flex-col gap-3">
            <TsCheckbox id="ts-logging" label="Enable logging" checked={enableLogging} onChange={setEnableLogging} />
            {enableLogging && (
              <TsDropdown label="Log Level" value={logLevel} options={LOG_LEVEL_OPTIONS} onChange={setLogLevel} />
            )}
            <TsCheckbox id="ts-strict" label="Use strict mode?" checked={strictMode} onChange={setStrictMode} />
          </div>
        </TsAccordion>

        {/* Custom CSS/LESS */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[#374151]">Custom CSS/LESS</label>
            <button
              type="button"
              aria-label={cssExpanded ? "Collapse CSS editor" : "Expand CSS editor"}
              onClick={() => setCssExpanded((o) => !o)}
              className="w-7 h-7 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
            >
              {cssExpanded ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              )}
            </button>
          </div>
          <div className={`border border-[#d1d5db] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#2d6fa8] focus-within:border-transparent ${cssExpanded ? "fixed inset-8 z-50 shadow-2xl flex flex-col bg-white" : ""}`}>
            {cssExpanded && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7eb] bg-[#f9fafb] shrink-0">
                <span className="text-sm font-semibold text-[#374151]">Custom CSS/LESS</span>
                <button type="button" aria-label="Close expanded editor" onClick={() => setCssExpanded(false)} className="w-7 h-7 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#e5e7eb] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
            <textarea
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder="/* Add your custom CSS or LESS here */"
              spellCheck={false}
              className={`w-full text-sm text-[#374151] px-4 py-3 resize-none focus:outline-none placeholder-[#9ca3af] bg-white font-mono ${cssExpanded ? "flex-1 h-0" : "h-48"}`}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Export Panel ── */
function AssetOrUrlPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [tab, setTab] = useState<"asset" | "url">("asset");
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <div className="flex border border-[#e5e7eb] rounded-lg overflow-hidden w-fit">
        {(["asset", "url"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === t ? "bg-[#2d6fa8] text-white" : "bg-white text-[#6b7280] hover:bg-[#f3f4f6]"}`}
          >
            {t === "asset" ? "From Asset Library" : "From URL"}
          </button>
        ))}
      </div>
      {tab === "asset" ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-[#e5e7eb] rounded-lg bg-[#f9fafb] text-sm text-[#9ca3af]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {value && !value.startsWith("http") ? value : "No asset selected"}
          </div>
          <button type="button" className="px-3 py-2 text-xs font-medium text-[#2d6fa8] border border-[#2d6fa8] rounded-lg hover:bg-[#dbeeff] transition-colors">
            Browse
          </button>
        </div>
      ) : (
        <input
          type="url"
          value={value.startsWith("http") ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/image.png"
          className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] placeholder-[#9ca3af] text-[#374151]"
        />
      )}
    </div>
  );
}

function ExportCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
      <span
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "border-[#d1d5db] bg-white group-hover:border-[#2d6fa8]"}`}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 6 5 9 10 3" />
          </svg>
        )}
      </span>
      <span className="text-sm text-[#374151]">{label}</span>
    </label>
  );
}

function ExportTextField({ label, placeholder, value, onChange, optional }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[#374151]">
        {label}{optional && <span className="ml-1 text-[#9ca3af] font-normal">(Optional)</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] placeholder-[#9ca3af] text-[#374151]"
      />
    </div>
  );
}

function ExportSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-[#374151]">{label}</label>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] text-[#374151] bg-white"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ExportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-[#111827] border-b border-[#f3f4f6] pb-2">{title}</h3>
      {children}
    </div>
  );
}

function PdfExportForm() {
  const [coverImage, setCoverImage]               = useState("");
  const [tocPageTitles, setTocPageTitles]         = useState(true);
  const [tocArticleTitles, setTocArticleTitles]   = useState(true);
  const [tocBlockTitles, setTocBlockTitles]       = useState(false);
  const [tocComponentTitles, setTocComponentTitles] = useState(false);
  const [pdfTitle, setPdfTitle]                   = useState("");
  const [pdfAuthor, setPdfAuthor]                 = useState("");
  const [pdfSubject, setPdfSubject]               = useState("");
  const [pdfCopyright, setPdfCopyright]           = useState("");
  const [footerLogo, setFooterLogo]               = useState("");
  const [passwordEnabled, setPasswordEnabled]     = useState(false);
  const [userPassword, setUserPassword]           = useState("");
  const [ownerPassword, setOwnerPassword]         = useState("");
  const [encryptionLevel, setEncryptionLevel]     = useState("AES-128");
  const [disablePrinting, setDisablePrinting]     = useState(false);
  const [disableCopying, setDisableCopying]       = useState(false);
  const [disableAnnotations, setDisableAnnotations] = useState(false);
  const [allowWatermark, setAllowWatermark]       = useState(false);
  const [watermarkText, setWatermarkText]         = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState("Center");

  return (
    <div className="flex flex-col gap-8 max-w-2xl">

      {/* Cover Page */}
      <ExportSection title="Cover Page">
        <AssetOrUrlPicker label="Cover Page Image" value={coverImage} onChange={setCoverImage} />
      </ExportSection>

      {/* Table of Contents */}
      <ExportSection title="Table of Contents">
        <div className="flex flex-col gap-3">
          <ExportCheckbox checked={tocPageTitles}      onChange={setTocPageTitles}      label="Include Page Titles in TOC" />
          <ExportCheckbox checked={tocArticleTitles}   onChange={setTocArticleTitles}   label="Include Article Titles in TOC" />
          <ExportCheckbox checked={tocBlockTitles}     onChange={setTocBlockTitles}     label="Include Block Titles in TOC" />
          <ExportCheckbox checked={tocComponentTitles} onChange={setTocComponentTitles} label="Include Component Titles in TOC" />
        </div>
      </ExportSection>

      {/* Document Metadata */}
      <ExportSection title="Document Metadata">
        <div className="grid grid-cols-2 gap-4">
          <ExportTextField label="PDF Title"     placeholder="e.g. Introduction to Digital Marketing" value={pdfTitle}     onChange={setPdfTitle} />
          <ExportTextField label="PDF Author"    placeholder="e.g. Laerdal Medical"                    value={pdfAuthor}   onChange={setPdfAuthor} />
          <ExportTextField label="PDF Subject"   placeholder="e.g. Healthcare Training"                value={pdfSubject}  onChange={setPdfSubject} />
          <ExportTextField label="PDF Copyright" placeholder="e.g. © 2026 Laerdal Medical"             value={pdfCopyright} onChange={setPdfCopyright} />
        </div>
      </ExportSection>

      {/* Footer */}
      <ExportSection title="Footer">
        <AssetOrUrlPicker label="PDF Footer Logo" value={footerLogo} onChange={setFooterLogo} />
      </ExportSection>

      {/* Password Protection */}
      <ExportSection title="Password Protection">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setPasswordEnabled((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${passwordEnabled ? "bg-[#2d6fa8]" : "bg-[#d1d5db]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${passwordEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <span className="text-sm font-medium text-[#374151]">Enable Password Protection</span>
        </label>

        {passwordEnabled && (
          <div className="flex flex-col gap-4 pl-0 pt-1">
            <div className="grid grid-cols-2 gap-4">
              <ExportTextField label="User Password"  placeholder="Required to open PDF"  value={userPassword}  onChange={setUserPassword} />
              <ExportTextField label="Owner Password" placeholder="Required to edit PDF"  value={ownerPassword} onChange={setOwnerPassword} optional />
            </div>
            <ExportSelect label="Encryption Level" value={encryptionLevel} options={["RC4-40", "RC4-128", "AES-128", "AES-256"]} onChange={setEncryptionLevel} />

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#374151]">Permissions</span>
              <div className="flex flex-col gap-3 pl-1">
                <ExportCheckbox checked={disablePrinting}    onChange={setDisablePrinting}    label="Disable Printing" />
                <ExportCheckbox checked={disableCopying}     onChange={setDisableCopying}     label="Disable Copying" />
                <ExportCheckbox checked={disableAnnotations} onChange={setDisableAnnotations} label="Disable Annotations" />
              </div>
            </div>
          </div>
        )}
      </ExportSection>

      {/* Watermark */}
      <ExportSection title="Watermark">
        <ExportCheckbox checked={allowWatermark} onChange={setAllowWatermark} label="Add Watermark" />
        {allowWatermark && (
          <div className="flex flex-col gap-4 pt-1">
            <ExportTextField label="Watermark Text" placeholder="e.g. CONFIDENTIAL" value={watermarkText} onChange={setWatermarkText} />
            <ExportSelect label="Watermark Position" value={watermarkPosition} options={["Top Left", "Top Center", "Top Right", "Center", "Bottom Left", "Bottom Center", "Bottom Right", "Diagonal"]} onChange={setWatermarkPosition} />
          </div>
        )}
      </ExportSection>

      {/* Export button */}
      <div className="pt-2 border-t border-[#f3f4f6]">
        <button
          type="button"
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2E7FA1] hover:bg-[#266580] rounded-lg transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export as PDF
        </button>
      </div>
    </div>
  );
}

function ExportPanel() {
  const [activeExport, setActiveExport] = useState<"choose" | "source" | "pdf">("choose");

  if (activeExport === "source") {
    return (
      <div className="max-w-2xl w-full flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveExport("choose")}
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-lg font-semibold text-[#111827]">Export Source</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border border-dashed border-[#e5e7eb] rounded-xl bg-[#f9fafb]">
          <div className="w-14 h-14 rounded-2xl bg-white border border-[#e5e7eb] flex items-center justify-center shadow-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#374151]">Export Source Files</p>
            <p className="text-xs text-[#9ca3af] mt-1 max-w-xs">Download the raw course source files for backup or import into another authoring tool.</p>
          </div>
          <button type="button" className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2E7FA1] hover:bg-[#266580] rounded-lg transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Source
          </button>
        </div>
      </div>
    );
  }

  if (activeExport === "pdf") {
    return (
      <div className="max-w-2xl w-full flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveExport("choose")}
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-lg font-semibold text-[#111827]">Export as PDF</h2>
        </div>
        <PdfExportForm />
      </div>
    );
  }

  /* Choose export type */
  return (
    <div className="max-w-2xl w-full flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-[#111827]">Export</h2>
        <p className="text-sm text-[#6b7280] mt-1">Choose how you'd like to export this course.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Export Source */}
        <button
          type="button"
          onClick={() => setActiveExport("source")}
          className="flex flex-col items-start gap-4 p-5 bg-white border border-[#e5e7eb] rounded-xl hover:border-[#2d6fa8] hover:shadow-sm transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#f3f4f6] group-hover:bg-[#dbeeff] flex items-center justify-center transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#2d6fa8]">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Export Source</p>
            <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">Download the raw source files for backup or migration.</p>
          </div>
          <span className="mt-auto text-xs font-medium text-[#2d6fa8] flex items-center gap-1">
            Select
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </button>

        {/* Export as PDF */}
        <button
          type="button"
          onClick={() => setActiveExport("pdf")}
          className="flex flex-col items-start gap-4 p-5 bg-white border border-[#e5e7eb] rounded-xl hover:border-[#2d6fa8] hover:shadow-sm transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#f3f4f6] group-hover:bg-[#dbeeff] flex items-center justify-center transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#2d6fa8]">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M9 13h6M9 17h6M9 9h1" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Export as PDF</p>
            <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">Generate a styled PDF with TOC, metadata, and security options.</p>
          </div>
          <span className="mt-auto text-xs font-medium text-[#2d6fa8] flex items-center gap-1">
            Select
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}

/* ── Publish Panel ── */
function PublishCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none group">
      <span
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "border-[#d1d5db] bg-white group-hover:border-[#2d6fa8]"}`}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 6 5 9 10 3" />
          </svg>
        )}
      </span>
      <span className="text-sm text-[#374151] leading-snug">{children}</span>
    </label>
  );
}

function PublishPanel() {
  const [preflight, setPreflight]               = useState(true);
  const [includeCourseVal, setIncludeCourseVal] = useState(true);
  const [includeA11y, setIncludeA11y]           = useState(false);
  const [includeScorm, setIncludeScorm]         = useState(false);
  const [a11yChecked, setA11yChecked]           = useState(false);
  const [scormChecked, setScormChecked]         = useState(false);

  return (
    <div className="max-w-2xl w-full flex flex-col gap-8">

      {/* Heading */}
      <div>
        <h2 className="text-xl font-semibold text-[#111827]">Publish</h2>
        <p className="text-sm text-[#6b7280] mt-1.5 leading-relaxed">
          Configure your publish settings and optionally run a Preflight Validation to generate a report before publishing.
        </p>
      </div>

      {/* Preflight Validation toggle */}
      <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-[#f9fafb] border-b border-[#e5e7eb]">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Preflight Validation</p>
            <p className="text-xs text-[#6b7280] mt-0.5">Generate a validation report before publishing</p>
          </div>
          <button
            type="button"
            onClick={() => setPreflight((v) => !v)}
            aria-label="Toggle preflight validation"
            className={`relative inline-flex w-12 h-7 rounded-full transition-colors duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6fa8] focus-visible:ring-offset-2 ${preflight ? "bg-[#2d6fa8]" : "bg-[#d1d5db]"}`}
          >
            <span className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full shadow-sm transition-transform duration-200 flex items-center justify-center ${preflight ? "bg-white translate-x-[18px]" : "bg-[#3d3d3d] translate-x-0"}`}>
              {preflight && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#2d6fa8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </span>
          </button>
        </div>

        {preflight && (
          <div className="px-5 py-4 flex flex-col gap-3 bg-white">
            <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Include in report</p>
            <PublishCheckbox checked={includeCourseVal} onChange={setIncludeCourseVal}>Course Validation</PublishCheckbox>
            <PublishCheckbox checked={includeA11y}      onChange={setIncludeA11y}>Accessibility Report</PublishCheckbox>
            <PublishCheckbox checked={includeScorm}     onChange={setIncludeScorm}>SCORM Validation for LMS</PublishCheckbox>
          </div>
        )}
      </div>

      {/* Course Validation section */}
      <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
        <div className="px-5 py-4 bg-[#f9fafb] border-b border-[#e5e7eb]">
          <p className="text-sm font-semibold text-[#111827]">Course Evaluation</p>
        </div>
        <div className="px-5 py-5 flex flex-col gap-4 bg-white">
          <p className="text-sm text-[#374151] leading-relaxed">
            It is recommended to do the Course Evaluation and correct any findings before proceeding to the SCORM/Hyperbridge Validation.
          </p>
          <ul className="flex flex-col gap-2 pl-1">
            {[
              "Identifies duplicate IDs within the course",
              "Validates the syntax of the IDs for Assessments",
              "Finds if all necessary extensions are included; for example, courses with the Hyperbridge extension should also include the CDN Deployment extension",
              "Alerts if both SPOOR and Hyperbridge extensions are included in a course",
              "Alerts when assessment completion is set as the course completion criteria, but assessment extension is not enabled for any article in the course",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-[#6b7280]">
                <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d6fa8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <div className="pt-1">
            <button type="button" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
              </svg>
              Validation
            </button>
          </div>
        </div>
      </div>

      {/* Accessibility Checker + SCORM/HyperBridge Validation */}
      <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
        <div className="px-5 py-4 bg-[#f9fafb] border-b border-[#e5e7eb]">
          <p className="text-sm font-semibold text-[#111827]">Accessibility Checker &amp; SCORM/HyperBridge Validation</p>
        </div>
        <div className="px-5 py-5 flex flex-col gap-5 bg-white">

          {/* Prerequisites */}
          <div className="rounded-lg bg-[#fffbeb] border border-[#fcd34d] px-4 py-3 flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-[#92400e] uppercase tracking-wide flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Prerequisites: Dependent Extensions for Validation
            </p>
            <p className="text-xs text-[#78350f] leading-relaxed">
              To run these validation reports it is required to enable the below extensions well in advance to ensure successful validation.
            </p>
            <ul className="flex flex-col gap-1 mt-1">
              {["Laerdal Validator Enabler", "SPOOR/HyperBridge Extension", "CDN config"].map((ext) => (
                <li key={ext} className="flex items-center gap-2 text-xs text-[#92400e]">
                  <span className="w-1 h-1 rounded-full bg-[#d97706] shrink-0" />
                  {ext}
                </li>
              ))}
            </ul>
          </div>

          {/* Validation options */}
          <div className="flex flex-col gap-5">
            <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Select validations to run</p>

            {/* Accessibility Checker */}
            <div
              onClick={() => setA11yChecked((v) => !v)}
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${a11yChecked ? "border-[#2d6fa8] bg-[#f0f7ff]" : "border-[#e5e7eb] bg-white hover:border-[#93c5fd]"}`}
            >
              <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${a11yChecked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "border-[#d1d5db] bg-white"}`}>
                {a11yChecked && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                )}
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-[#111827]">Accessibility Checker</p>
                <p className="text-xs text-[#6b7280] leading-relaxed">
                  Runs the course through the AXE library from Deque to identify potential errors and warnings in compliance with WCAG A and AA standards. This includes checks for color contrast ratios, missing alternative text for images, heading structures, and keyboard navigation support.
                </p>
              </div>
            </div>

            {/* SCORM/Hyperbridge Validation */}
            <div
              onClick={() => setScormChecked((v) => !v)}
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${scormChecked ? "border-[#2d6fa8] bg-[#f0f7ff]" : "border-[#e5e7eb] bg-white hover:border-[#93c5fd]"}`}
            >
              <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${scormChecked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "border-[#d1d5db] bg-white"}`}>
                {scormChecked && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                )}
              </span>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-[#111827]">SCORM/Hyperbridge Validation</p>
                <ul className="flex flex-col gap-1">
                  {[
                    "Checks the suspend data length varies for SPOOR and HyperBridge.",
                    "Identifies any potential bugs that may occur during LMS deployment.",
                    "Confirms if the course registers completion and if the assessment score is pushed where relevant.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-[#6b7280]">
                      <span className="w-1 h-1 rounded-full bg-[#9ca3af] shrink-0 mt-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Run validations button */}
          {(a11yChecked || scormChecked) && (
            <button type="button" className="self-start flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
              </svg>
              Run {[a11yChecked && "Accessibility", scormChecked && "SCORM"].filter(Boolean).join(" & ")} Validation
            </button>
          )}
        </div>
      </div>

      {/* Publish action */}
      <div className="flex items-center justify-between pt-2 border-t border-[#f3f4f6]">
        <p className="text-xs text-[#9ca3af]">Complete any outstanding validations before publishing.</p>
        <button type="button" className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2E7FA1] hover:bg-[#266580] rounded-lg transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Publish Course
        </button>
      </div>

    </div>
  );
}

/* ── Placeholder panel for sections not yet built ── */
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

/* ── Main page ── */
function CourseCreationCenterContent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialTitle = params.get("title") ?? "Untitled Course";
  const initialDescription = params.get("description") ?? "";
  const courseId = params.get("courseId") ?? "";

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [savedThemeName, setSavedThemeName] = useState("");
  const [savedMenuName, setSavedMenuName] = useState("");
  const [savedThemeVariables, setSavedThemeVariables] = useState<Record<string, unknown>>({});
  const [savedPresetId, setSavedPresetId] = useState("");

  const [activeNav, setActiveNav] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);

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
        setTitle(data.title || initialTitle);
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

  const activeItem = NAV_ITEMS.find((n) => !n.heading && n.id === activeNav)!;

  function renderPanel() {
    if (activeNav === "overview") return <CourseOverviewPanel title={title} description={description} />;
    if (activeNav === "structure")
      return (
        <CourseStructurePanel
          courseId={courseId}
          courseTitle={title}
          onOpenEditor={(pageId) =>
            navigate(`/course/${courseId}`, { state: { pageId } })
          }
        />
      );
    if (activeNav === "theme") return <ThemePanel initialThemeName={savedThemeName} initialThemeVariables={savedThemeVariables} initialPresetId={savedPresetId} courseId={courseId} />;
    if (activeNav === "menu") return <MenuPanel initialMenuName={savedMenuName} />;
    if (activeNav === "navigation") return <NavigationPanel />;
    if (activeNav === "accessibility") return <AccessibilityPanel />;
    if (activeNav === "tracking") return <TrackingAnalyticsPanel />;
    if (activeNav === "completion") return <CompletionProgressPanel />;
    if (activeNav === "learner-experience") return <LearnerExperiencePanel />;
    if (activeNav === "technical-settings") return <TechnicalSettingsPanel />;
    if (activeNav === "export") return <ExportPanel />;
    if (activeNav === "publish") return <PublishPanel />;
    return <ComingSoonPanel label={activeItem?.label ?? ""} />;
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {!courseId && (
        <div className="mx-4 mt-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          No backend course was initialized for this setup flow. Start from Create New Course on the dashboard.
        </div>
      )}
      {/* ── Header ── */}
      <header className="h-14 bg-white border-b border-[#e5e7eb] flex items-center shrink-0 px-4 relative z-10">
        {/* Left: logo + back */}
        <div className="flex items-center gap-3 w-56 shrink-0">
          <img src="/adapt-logo.jpeg" alt="Adapt logo" width={32} height={32} className="rounded-lg shrink-0" />
          <span className="font-semibold text-[#111827] text-sm tracking-tight">Adapt Studio</span>
        </div>

        {/* Center: page title */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <span className="text-sm font-semibold text-[#111827]">Course Creation Center</span>
          <span className="text-[#d1d5db]">|</span>
          <span className="text-sm text-[#6b7280] truncate max-w-[200px]">{title}</span>
        </div>

        {/* Right: actions */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6] rounded-lg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <button type="button" className="flex items-center gap-2 px-3.5 py-2 text-sm text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
            Preview
          </button>
          <button
            type="button"
            onClick={() => setActiveNav("export")}
            className={`flex items-center gap-2 px-3.5 py-2 text-sm border rounded-lg transition-colors ${activeNav === "export" ? "border-[#2d6fa8] bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] border-[#e5e7eb] hover:bg-[#f9fafb]"}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
          <button
            type="button"
            onClick={() => setActiveNav("publish")}
            className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors ${activeNav === "publish" ? "border border-[#2d6fa8] bg-[#dbeeff] text-[#2d6fa8]" : "text-white bg-[#2E7FA1] hover:bg-[#266580]"}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Publish
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ── */}
        <aside
          className={`h-full bg-white border-r border-[#e5e7eb] flex flex-col shrink-0 transition-all duration-200 ${collapsed ? "w-14" : "w-56"}`}
        >
          {/* Collapse toggle */}
          <div className={`flex items-center h-12 border-b border-[#e5e7eb] px-2 shrink-0 ${collapsed ? "justify-center" : "justify-end"}`}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand panel" : "Collapse panel"}
              title={collapsed ? "Expand panel" : "Collapse panel"}
              className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col gap-0.5 px-2 pt-3 flex-1 overflow-y-auto pb-4">
            {NAV_ITEMS.map((item) => {
              if (item.heading) {
                return collapsed ? (
                  <div key={item.id} className="mx-2 my-1 border-t border-[#e5e7eb]" />
                ) : (
                  <p key={item.id} className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">
                    {item.label}
                  </p>
                );
              }
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-colors text-left w-full ${
                    isActive
                      ? "bg-[#dbeeff] text-[#2d6fa8] font-semibold"
                      : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151]"
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <span className="truncate leading-tight">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Skip to editor — bottom */}
          {!collapsed && (
            <div className="px-3 pb-4 border-t border-[#e5e7eb] pt-3 shrink-0">
              <button
                type="button"
                disabled={!courseId}
                onClick={() => navigate(`/course/${courseId}`)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#6b7280] hover:text-[#2d6fa8] hover:bg-[#f3f4f6] rounded-lg transition-colors border border-[#e5e7eb]"
              >
                Skip to Editor
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </aside>

        {/* ── Right content panel ── */}
        <main className={`flex-1 overflow-hidden ${activeNav === "menu" || activeNav === "navigation" ? "" : "overflow-y-auto px-8 py-8 min-h-0"}`}>
          {renderPanel()}
        </main>
      </div>
      <AiAssistant context="Course Creation Center" suggestions={[
        'How do I set up my course structure?',
        'What does the Preflight Validator check?',
        'How do I configure SCORM tracking?',
      ]} />
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
