// Storyboard top bar (spec AC8/AC10/AC11).
//   Back · Draft status · Import · AI Actions ▾ · Export ▾ · Share for Review ·
//   Generate Course →
// Backend-dependent actions (Import/AI/Export/Share/Generate) are stubbed with
// a toast and a Phase note until their respective phases land.

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  Sparkles,
  Download,
  Users,
  ArrowRight,
  ChevronDown,
  Save,
} from 'lucide-react';
import type { ReviewStatus } from '@/types/storyboard';
import type { StoryboardAiAction } from '@/api/ai';

const AI_ACTION_LABELS: { label: string; action: StoryboardAiAction }[] = [
  { label: 'Improve', action: 'improve' },
  { label: 'Rewrite', action: 'rewrite' },
  { label: 'Summarize', action: 'summarize' },
  { label: 'Generate Suggestions', action: 'suggest' },
];

const STATUS_META: Record<ReviewStatus, { label: string; className: string; next: ReviewStatus }> = {
  draft: { label: 'Draft', className: 'bg-muted text-foreground', next: 'in_review' },
  in_review: { label: 'In Review', className: 'bg-[#FCE3CF] text-[#92400e]', next: 'approved' },
  approved: { label: 'Approved', className: 'bg-[#CCEED2] text-[#166534]', next: 'draft' },
};

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
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
      >
        <Icon className="h-3.5 w-3.5" /> {label}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-md border bg-background py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
              className="flex w-full items-center px-3 py-1.5 text-sm hover:bg-muted"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StoryboardTopBar({
  status,
  onCycleStatus,
  onBack,
  onStub,
  onAiAction,
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
  onAiAction: (action: StoryboardAiAction) => void;
  onImport: () => void;
  onExport: (format: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  dirty: boolean;
  saving: boolean;
}) {
  const meta = STATUS_META[status];

  return (
    <header className="flex items-center gap-2 border-b bg-background px-4 py-2">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <button
        type="button"
        onClick={onCycleStatus}
        title="Click to change review status"
        className={`rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}
      >
        {meta.label}
      </button>
      {dirty && <span className="text-xs text-[#92400e]">Unsaved changes</span>}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onImport}
          title="Import Word, PDF or PowerPoint"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          <Upload className="h-3.5 w-3.5" /> Import
        </button>
        <Dropdown
          label="AI Actions"
          Icon={Sparkles}
          items={AI_ACTION_LABELS.map((a) => a.label)}
          onSelect={(label) => {
            const match = AI_ACTION_LABELS.find((a) => a.label === label);
            if (match) onAiAction(match.action);
          }}
        />
        <Dropdown label="Export" Icon={Download} items={['Word (.docx)', 'PDF (.pdf)']} onSelect={onExport} />
        <button
          type="button"
          onClick={() => onStub('Share for Review', 'Phase 5')}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          <Users className="h-3.5 w-3.5" /> Share for Review
        </button>
        <button
          type="button"
          onClick={onGenerate}
          className="inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          style={{ background: 'var(--primary)' }}
        >
          Generate Course <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
