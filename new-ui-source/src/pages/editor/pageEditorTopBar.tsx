import { useState } from "react";
import { Lightbulb } from "lucide-react";
import GuideDialog, { type GuidePanel, type GuideSection } from "../../components/common/GuideDialog";
import CommonCourseTopBarRow from "../../components/course/CommonCourseTopBarRow";
import PublishMenuButton from "../../components/publish/PublishMenuButton";

const PAGE_EDITOR_GUIDE_PANELS: GuidePanel[] = [
  {
    title: "Left panel · Structure",
    description: "Browse the course hierarchy, add or reorder levels, and select the part you want to work on.",
  },
  {
    title: "Middle panel · Preview",
    description: "See the learner-facing page. Select content here to bring its settings into focus.",
  },
  {
    title: "Right panel · Properties",
    description: "Edit the selected level's title, content, appearance, and available behaviour settings.",
  },
];

const PAGE_EDITOR_GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "How the levels fit together",
    items: [
      "Module: an optional course-level grouping for related Topics.",
      "Topic: a learner-facing page; Sections and Components live inside it.",
      "Section: groups related material within a Topic.",
      "Content Group: arranges Components together inside a Section.",
      "Component: the learning content itself, such as text, media, or a question.",
    ],
  },
  {
    title: "A useful working flow",
    description: "Build from the outline, then check the result in context.",
    items: [
      "Select or create a Topic, then add Sections and Content Groups where they help organize the page.",
      "Add Components, edit their content and settings, and review the middle preview as you go.",
      "Save when the outline and preview are ready; use the outline to move items into a clearer order.",
    ],
  },
  {
    title: "Recommendations",
    items: [
      "Give each Topic one clear purpose and use Sections to make longer pages easier to scan.",
      "Choose a Component that fits the learning task, rather than adding layout levels by default.",
      "Select the exact level before editing; the Properties panel changes with your selection.",
    ],
  },
  {
    title: "Best practices",
    items: [
      "Use short, descriptive titles so the outline remains easy to navigate.",
      "Keep related Components together and preview the page after substantial changes.",
      "Save regularly; unsaved edits are drafts until you save them.",
    ],
  },
  {
    title: "Linking content",
    items: [
      "Use the rich-text Link control when text should point learners to a web destination.",
      "Use the asset picker for course media so selected files are managed as course assets.",
      "Check links and media in the preview before saving and sharing the course.",
    ],
  },
];

interface PageEditorTopBarProps {
  courseTitle: string;
  onCourseTitleChange: (title: string) => void;
  onToggleLeftPanel: () => void;
  onBack: () => void;
  onHome: () => void;
  onSave: () => void;
  onSelectPreflight: () => void;
  onSelectPublish: () => void;
  onOpenCourseSettings: () => void;
  onOpenStoryboard: () => void;
  onOpenPreview: (startFromCurrentPage: boolean) => void;
  loginName: string;
  previewDisabled?: boolean;
  isSaving?: boolean;
  isSaveDisabled?: boolean;
}

const ICON_BASE = "/new/assets/icons";

function HeaderMaskIcon({ file, className }: { file: string; className?: string }) {
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

export default function PageEditorTopBar({
  courseTitle,
  onCourseTitleChange,
  onToggleLeftPanel,
  onBack,
  onHome,
  onSave,
  onSelectPreflight,
  onSelectPublish,
  onOpenCourseSettings,
  onOpenStoryboard,
  onOpenPreview,
  loginName,
  previewDisabled = false,
  isSaving = false,
  isSaveDisabled = false,
}: PageEditorTopBarProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const leadingSlot = (
    <button
      type="button"
      aria-label="Open course outline"
      onClick={onToggleLeftPanel}
      className="md:hidden p-2 rounded-lg text-[#474747] hover:bg-[#F2F2F2] transition-colors shrink-0"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );

  const trailingActions = (
    <div className="ml-auto flex items-center gap-3">
      <button
        type="button"
        onClick={() => setIsGuideOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isGuideOpen}
        className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-2 text-[13px] font-medium text-[#40515e] transition-colors hover:bg-[#f1f5f8] hover:text-[#1d3547] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d6fa8]"
      >
        <Lightbulb size={16} strokeWidth={1.8} aria-hidden="true" />
        <span>How-To Guide</span>
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaveDisabled || isSaving}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold bg-transparent text-[var(--life-base-black)] rounded-[8px] hover:bg-[var(--life-primary-050)] hover:text-[var(--life-primary-700)] active:bg-[var(--life-primary-100)] active:text-[var(--life-primary-800)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <HeaderMaskIcon file="save-icon.svg" />
        <span className="hidden lg:inline">{isSaving ? "Saving..." : "Save"}</span>
      </button>

      <PublishMenuButton onSelectPreflight={onSelectPreflight} onSelectPublish={onSelectPublish} />
    </div>
  );

  return (
    <div className="flex flex-col shrink-0">
      <CommonCourseTopBarRow
        courseTitle={
          <input
            value={courseTitle}
            onChange={(e) => onCourseTitleChange(e.target.value)}
            className="text-[15px] font-bold text-[#1a1a1a] bg-transparent border-none outline-none focus:ring-0 min-w-0 w-32 sm:w-48 md:w-72 truncate"
            aria-label="Course title"
          />
        }
        loginName={loginName}
        activeNav="editor"
        onBack={onBack}
        onHome={onHome}
        onOpenCourseSettings={onOpenCourseSettings}
        onOpenStoryboard={onOpenStoryboard}
        onOpenEditor={() => undefined}
        onOpenPreview={onOpenPreview}
        previewDisabled={previewDisabled}
        leadingSlot={leadingSlot}
      />

      <GuideDialog
        open={isGuideOpen}
        title="Page Editor How-To Guide"
        description="A quick overview of the editor panels, content levels, and a few practices for building a clear learner experience."
        panels={PAGE_EDITOR_GUIDE_PANELS}
        sections={PAGE_EDITOR_GUIDE_SECTIONS}
        onClose={() => setIsGuideOpen(false)}
      />

      <div className="h-[56px] bg-white border-b border-[#d8dde6] flex items-center px-4 md:px-6 gap-3">
        <div className="flex items-center gap-2 text-[#111827] min-w-0">
          <HeaderMaskIcon file="component-icon.svg" className="block w-[16px] h-[16px] shrink-0 bg-current opacity-80" />
          <span className="text-base font-semibold truncate">Course Editor</span>
        </div>
        {trailingActions}
      </div>
    </div>
  );
}
