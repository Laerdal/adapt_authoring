// Storyboard top bar (spec AC8/AC10/AC11), Figma-aligned.
//   Back · Draft status · Save · Import · Export ▾ · Share for Review ·
//   Generate Course →
// Backend-dependent actions (Import/Export/Share/Generate) are stubbed with a
// toast + phase note until their respective phases land. Visual language is
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
} from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ReviewStatus } from '@/types/storyboard';

const STATUS_META: Record<
  ReviewStatus,
  { label: string; pillClass: string; next: ReviewStatus; nextLabel: string }
> = {
  draft:     { label: 'Draft',     pillClass: 'sb-status-pill--draft',    next: 'in_review', nextLabel: 'Send for review' },
  in_review: { label: 'In Review', pillClass: 'sb-status-pill--review',   next: 'approved',  nextLabel: 'Approve' },
  approved:  { label: 'Approved',  pillClass: 'sb-status-pill--approved', next: 'draft',     nextLabel: 'Reopen as draft' },
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
  onCycleStatus,
  onBack,
  onStub,
  onImport,
  onExport,
  onGenerate,
  onSave,
  dirty,
  saving,
}: {
  status: ReviewStatus;
  onCycleStatus: () => void;
  onBack: () => void;
  onStub: (action: string, phase: string) => void;
  onImport: () => void;
  onExport: (format: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  dirty: boolean;
  saving: boolean;
}) {
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
      <button type="button" onClick={onBack} className="sb-toolbar-btn" title="Back">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <button
        type="button"
        onClick={onCycleStatus}
        title={`Click to ${meta.nextLabel.toLowerCase()}`}
        className={`sb-status-pill ${meta.pillClass}`}
      >
        {meta.label}
      </button>

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
          onClick={() => onStub('Share for Review', 'Phase 5')}
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
    </header>
  );
}
