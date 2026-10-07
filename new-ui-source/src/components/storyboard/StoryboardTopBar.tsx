// Storyboard top bar (spec AC8/AC10/AC11), Figma-aligned.
//   Back · Draft status · Save · Import · Export ▾ · Share for Review ·
//   Generate Course →
// Backend-dependent actions (Import/Export/Generate) are stubbed with a
// toast + phase note until their respective phases land; Share for Review is
// fully wired (opens ShareForReviewDialog). Visual language is
// the LIFE design system (font-family-primary, --life-color-* tokens, the
// `.sb-toolbar-btn` and `.sb-status-pill` utilities in index.css) so the port
// from the Figma "Course Creation Center" prototype is 1:1.
//
// AI is no longer a top-bar action — it lives under Add Content → AI Assistance
// (Samaritan Assistance popover). The underlying /api/storyboard/ai proxy and
// the card-level AI buttons are unchanged.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  Download,
  Users,
  ArrowRight,
  ChevronDown,
  Save,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { REVIEW_STATUS_LABEL, type ReviewStatus } from '@/types/storyboard';
import GuideDialog, { type GuidePanel, type GuideSection } from '@/components/common/GuideDialog';

const STORYBOARD_GUIDE_PANELS: GuidePanel[] = [
  {
    title: 'Left panel: Contents',
    description: 'Browse the Storyboard outline, expand or collapse content, and select the Topic, Section, Content Group, or content item you want to review.',
  },
  {
    title: 'Middle panel: Storyboard',
    description: 'Build and review the course narrative in a document-style view. Add headings and content, edit existing items, and assess the learning flow before detailed authoring.',
  },
  {
    title: 'Right panel: Review Center',
    description: 'View the Storyboard summary and status, monitor comments, and manage review feedback. Select a content block to comment in context, or switch between open and resolved feedback.',
  },
];

const STORYBOARD_GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'A useful working flow',
    description: 'Build the narrative, review the overall flow, and then move into detailed authoring.',
    items: [
      'Select a Topic in Contents or add a new heading.',
      'Add and organize content to develop the learning flow.',
      'Edit content in the middle panel and review the Storyboard as a complete narrative.',
      'Use Ask Samaritan to generate or refine content where support is needed.',
      'Select a content block and use the Review Center to add contextual feedback.',
      'Share the Storyboard with another creator on this Adapt Studio instance when collaboration or review is needed.',
      'Address comments and update their status as review progresses.',
      'Continue to Page Editor when the content direction and review are complete.',
    ],
  },
  {
    title: 'Review Center: Storyboard summary',
    description: 'Use the summary to understand the Storyboard size and see whether feedback still needs attention.',
    items: [
      'Number of Topics, Sections, content items, and assets.',
      'Number of open and resolved comments.',
      'Current Storyboard status.',
    ],
  },
  {
    title: 'Review Center: Comments and review',
    items: [
      'Select a content block before adding a comment so feedback stays attached to the right context.',
      'Use Open to review comments that still need attention.',
      'Use Resolved to view feedback that has been addressed.',
      'Resolve comments when the requested change or decision is complete.',
      'Review outstanding comments before changing Storyboard status or moving to detailed authoring.',
    ],
  },
  {
    title: 'Collaborating on a Storyboard',
    items: [
      'Share with specific collaborators on the same Adapt Studio instance.',
      'Keep discussions connected to the relevant content with comments.',
      'Address feedback in the Storyboard rather than a separate document.',
      'Resolve completed discussions so outstanding feedback is easy to find.',
      'Check status and open comments before moving to Page Editor.',
    ],
  },
  {
    title: 'Working with AI assistance',
    items: [
      'Use Ask Samaritan to generate an initial content direction or first draft.',
      'Refine headings, instructional text, summaries, or learning activities.',
      'Explore alternate ways to organize or present complex information.',
      'Treat AI suggestions as a starting point, not approved content.',
      'Review suggestions for accuracy, relevance, tone, and learning value.',
      'Confirm generated content aligns with approved sources and intended outcomes.',
    ],
  },
  {
    title: 'Recommendations',
    items: [
      'Give each Topic a clear learning purpose.',
      'Sequence content so it is easy for learners to follow.',
      'Keep headings short and descriptive for easy navigation in Contents.',
      'Agree on content direction in Storyboard before detailed visual configuration.',
      'Use comments for review discussions instead of unresolved notes in learning content.',
      'Review the complete Storyboard, not only individual items.',
      'Address important feedback before moving into Page Editor.',
    ],
  },
  {
    title: 'Best practices',
    items: [
      'Start with the intended learning outcome.',
      'Keep each part focused on a distinct idea or stage in the learning journey.',
      'Balance information with activities, reflection, and checks for understanding.',
      'Select the exact content block before commenting.',
      'Check the summary regularly to monitor content and review progress.',
      'Resolve completed comments to keep Review Center manageable.',
      'Save substantial changes regularly.',
      'Complete structural and content review before detailed authoring.',
    ],
  },
  {
    title: 'Moving from Storyboard to Page Editor',
    items: [
      'Confirm the Topic sequence and overall learning flow.',
      'Review the Storyboard summary and current status.',
      'Address or resolve outstanding comments and confirm collaborator review is complete.',
      'Continue to Page Editor to configure layouts, presentation, interactions, and behavior.',
      'Use Preview to validate the completed learner experience.',
    ],
  },
];

// Status is fully automatic — driven by comment state (see
// recomputeStatus in requestHandlers.js): no comments -> Draft, any
// unresolved comment -> In Review, all resolved -> Approved. The pill is a
// read-only reflection of that, not a manual control.
const STATUS_META: Record<ReviewStatus, { label: string; pillClass: string; hint: string }> = {
  draft: { label: REVIEW_STATUS_LABEL.draft, pillClass: 'sb-status-pill--draft', hint: 'No comments yet' },
  in_review: { label: REVIEW_STATUS_LABEL.in_review, pillClass: 'sb-status-pill--review', hint: 'Has unresolved comments' },
  approved: { label: REVIEW_STATUS_LABEL.approved, pillClass: 'sb-status-pill--approved', hint: 'All comments resolved' },
};

// A small portal-hosted dropdown used for Export — mirrors the Figma popover
// (subtle border, elevation-lg shadow, Life tokens) and can never be clipped
// by the sticky header's overflow context.
function Dropdown({
  label,
  Icon,
  items,
  onSelect,
}: {
  label: string;
  Icon: typeof Upload;
  items: string[];
  onSelect: (item: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const MENU_W = 200;
    const left = Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8);
    setPos({ left: Math.max(8, left), top: r.bottom + 4 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="sb-toolbar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon className="h-3.5 w-3.5" /> {label}
        <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--life-color-text-subtle)' }} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="sb-menu"
            style={{ position: 'fixed', left: pos.left, top: pos.top, width: 200, zIndex: 1000 }}
          >
            {items.map((item) => (
              <button
                key={item}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect(item);
                  setOpen(false);
                }}
                className="sb-menu-item"
              >
                {item}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export default function StoryboardTopBar({
  status,
  onBack,
  showBack = true,
  onImport,
  onExport,
  onGenerate,
  onSave,
  onShareForReview,
  dirty,
  saving,
}: {
  status: ReviewStatus;
  onBack: () => void;
  /** Hide this bar's own Back button when the host screen already renders
   *  its own (e.g. SetupPage's embedded Storyboard panel sits under
   *  CommonCourseTopBarRow, which has a Back of its own) — defaults to
   *  shown, since the standalone `/course/:id/storyboard` route has no
   *  other Back control at all. */
  showBack?: boolean;
  onImport: () => void;
  onExport: (format: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  onShareForReview: () => void;
  dirty: boolean;
  saving: boolean;
}) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const meta = STATUS_META[status];

  return (
    <header
      className="flex items-center gap-3 px-4 py-2.5"
      style={{
        background: 'var(--life-color-bg-surface-default)',
        borderBottom: '1px solid var(--life-color-border-subtle)',
        fontFamily: 'var(--font-family-primary)',
      }}
    >
      {showBack && (
        <button type="button" onClick={onBack} className="sb-toolbar-btn" title="Back">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}

      <span title={meta.hint} className={`sb-status-pill ${meta.pillClass}`}>
        {meta.label}
      </span>

      {dirty && (
        <span
          className="text-xs"
          style={{ color: 'var(--life-color-text-warning)', fontWeight: 500 }}
        >
          Unsaved changes
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="sb-toolbar-btn"
          title="Save storyboard"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          type="button"
          onClick={onImport}
          title="Import Word, PDF or PowerPoint"
          className="sb-toolbar-btn"
        >
          <Upload className="h-3.5 w-3.5" /> Import
        </button>

        <Dropdown
          label="Export"
          Icon={Download}
          items={['Word (.docx)', 'PDF (.pdf)']}
          onSelect={onExport}
        />

        <button
          type="button"
          onClick={onShareForReview}
          className="sb-toolbar-btn"
        >
          <Users className="h-3.5 w-3.5" /> Share for Review
        </button>

        <button
          type="button"
          onClick={onGenerate}
          className="sb-toolbar-btn sb-toolbar-btn-primary"
          title="Generate the Adapt course from this storyboard"
        >
          Generate Course <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <GuideDialog
        open={isGuideOpen}
        title="Storyboard How-To Guide"
        description="A practical overview of the Storyboard panels, review workflow, collaboration, and moving into detailed authoring."
        panels={STORYBOARD_GUIDE_PANELS}
        sections={STORYBOARD_GUIDE_SECTIONS}
        onClose={() => setIsGuideOpen(false)}
      />
    </header>
  );
}
