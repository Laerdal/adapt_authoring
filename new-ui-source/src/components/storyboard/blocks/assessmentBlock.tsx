// Assessment authoring card (spec AC5) — matches the Lovable question block:
// a common header (badge, title, Show title, Replace, AI, Source, Delete, Done),
// a "Regenerate with AI" bar, a Body field, per-kind options (with per-option
// answer-specific feedback), a whole-question Feedback group, and a footer hint.
// The structured model is stored as JSON in the `data` prop and is generation-
// ready — options + feedback are written into the Adapt component on Save.

import { useState } from 'react';
import { RefreshCw, Sparkles, Code, Trash2, Check, Plus, AlertTriangle, MessageSquare, FolderOpen, Image as ImageIcon } from 'lucide-react';
import { storyboardActions } from '../storyboardActions';
import { createReactBlockSpec } from '@blocknote/react';
import { storyboardAi } from '@/api/ai';
import AssetPickerModal from '@/components/common/AssetPickerModal';
import {
  defaultAssessmentData,
  emptyFeedback,
  isAssessmentKind,
  validateAssessment,
  type AssessmentData,
  type AssessmentFeedback,
  type AssessmentKind,
  type MatchPair,
  type McqOption,
} from '@/types/storyboard';

const LABELS: Record<AssessmentKind, string> = {
  mcq: 'MCQ',
  gmcq: 'Graphic MCQ',
  matching: 'Matching',
  reorder: 'Sentence Reordering',
  textInput: 'Text Input',
  slider: 'Slider',
  checklist: 'Checklist',
};

const FOOTER: Record<AssessmentKind, string> = {
  mcq: 'Select one option and then select Submit.',
  gmcq: 'Select one option and then select Submit.',
  matching: 'Match each item to its correct pair and then select Submit.',
  reorder: 'Place the items in the correct order and then select Submit.',
  textInput: 'Type your answer and then select Submit.',
  slider: 'Move the slider to your answer and then select Submit.',
  checklist: 'Tick the items that apply and then select Submit.',
};

const inputCls =
  'w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary';
const labelCls = 'mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const stop = (e: React.KeyboardEvent) => e.stopPropagation();

function parseData(kind: AssessmentKind, raw: string): AssessmentData {
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object') return { ...defaultAssessmentData(kind), ...p };
  } catch {
    /* fall through */
  }
  return defaultAssessmentData(kind);
}

function HeaderBtn({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted ${active ? 'border-primary text-primary' : 'text-muted-foreground'}`}
    >
      {children}
    </button>
  );
}

// ── Feedback group (whole-question) ──────────────────────────────────────────

function FeedbackGroup({ fb, set }: { fb: AssessmentFeedback; set: (f: AssessmentFeedback) => void }) {
  const field = (key: keyof AssessmentFeedback, label: string) => (
    <label className="mt-1 block">
      <span className={labelCls}>{label}</span>
      <input value={fb[key]} onKeyDown={stop} onChange={(e) => set({ ...fb, [key]: e.target.value })} className={inputCls} />
    </label>
  );
  const empty = !Object.values(fb).some((v) => v.trim());
  return (
    <div className="mt-2 rounded border border-border p-2">
      <div className={labelCls}>Feedback</div>
      {field('correct', 'Correct')}
      {field('incorrect', 'Incorrect')}
      {field('incorrectNotFinal', 'Incorrect — not final')}
      {field('partlyCorrectFinal', 'Partly correct — final')}
      {field('partlyCorrectNotFinal', 'Partly correct — not final')}
      {empty && (
        <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#92400e]">
          <AlertTriangle className="h-3.5 w-3.5" /> Feedback not configured
        </div>
      )}
    </div>
  );
}

// ── Per-kind bodies ──────────────────────────────────────────────────────────

// Per-option image picker for Graphic MCQ. Opens the DAM AssetPickerModal and
// stores the picked asset's course link + preview URL + DAM id on the option
// (so publish can resolve the courseasset and the editor can show a thumbnail
// without re-fetching).
function OptionImagePicker({ value, onChange }: { value: McqOption; onChange: (patch: Partial<McqOption>) => void }) {
  const [picking, setPicking] = useState(false);
  // `imageUrl` is only ever set when the persisted link is directly loadable
  // (see parseAssessmentData) — a DAM-picked `course/assets/<file>` link is
  // NOT servable, so it must never be used as an `<img src>`. Falling back to
  // `value.image` here would resurrect the broken-image icon on round-trip.
  const hasImage = !!(value.imageUrl || value.image);
  return (
    <div className="mb-1 rounded border border-dashed border-border p-2">
      {hasImage ? (
        <div className="flex items-start gap-2">
          {value.imageUrl ? (
            <img src={value.imageUrl} alt={value.text || ''} className="h-20 w-24 shrink-0 rounded object-cover" />
          ) : (
            <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] text-muted-foreground" title={value.image}>{value.image}</div>
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="inline-flex items-center gap-1 rounded border border-primary px-2 py-0.5 text-xs text-primary hover:bg-primary/5"
              >
                <RefreshCw className="h-3 w-3" /> Change image
              </button>
              <button
                type="button"
                onClick={() => onChange({ image: '', imageUrl: '', imageAssetId: undefined })}
                className="inline-flex items-center gap-1 rounded border border-red-500 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <FolderOpen className="h-3.5 w-3.5" /> Select an image
          <span className="text-xs opacity-75">
            <ImageIcon className="ml-1 inline h-3 w-3" />
          </span>
        </button>
      )}
      {picking && (
        <AssetPickerModal
          assetType="image"
          onClose={() => setPicking(false)}
          onSelect={(asset) => {
            onChange({ image: asset.assetLink, imageUrl: asset.url, imageAssetId: asset.id });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function OptionsForm({ data, graphic, update }: { data: AssessmentData; graphic: boolean; update: (n: AssessmentData) => void }) {
  const options = data.options ?? [];
  const setOptions = (next: McqOption[]) => update({ ...data, options: next });
  const patch = (i: number, p: Partial<McqOption>) => setOptions(options.map((o, j) => (j === i ? { ...o, ...p } : o)));
  return (
    <div className="mt-2 rounded border border-border p-2">
      <div className={labelCls}>Options</div>
      {options.map((opt, i) => (
        <div key={i} className="mb-2 rounded border border-border p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <input type="checkbox" checked={opt.correct} onChange={(e) => patch(i, { correct: e.target.checked })} className="h-4 w-4 accent-[color:var(--primary)]" />
              Correct
              <span className="ml-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Option {i + 1}/{options.length}
              </span>
            </label>
            <button type="button" aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {graphic && <OptionImagePicker value={opt} onChange={(p) => patch(i, p)} />}
          <label className="block">
            <span className={labelCls}>Option text</span>
            <input value={opt.text} onKeyDown={stop} onChange={(e) => patch(i, { text: e.target.value })} className={inputCls} />
          </label>
          <label className="mt-1 block">
            <span className={labelCls}>Answer-specific feedback</span>
            <input value={opt.feedback ?? ''} placeholder="Shown when this option is selected" onKeyDown={stop} onChange={(e) => patch(i, { feedback: e.target.value })} className={inputCls} />
          </label>
        </div>
      ))}
      <button type="button" onClick={() => setOptions([...options, { text: '', correct: false, feedback: '' }])} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Plus className="h-3 w-3" /> Add option
      </button>
    </div>
  );
}

function MatchingForm({ data, update }: { data: AssessmentData; update: (n: AssessmentData) => void }) {
  const pairs = data.pairs ?? [];
  const setPairs = (next: MatchPair[]) => update({ ...data, pairs: next });
  return (
    <div className="mt-2 rounded border border-border p-2">
      <div className={labelCls}>Options &amp; matching options</div>
      {pairs.map((p, i) => (
        <div key={i} className="mb-2 rounded border border-border p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Option {i + 1}/{pairs.length}</span>
            <button type="button" aria-label="Remove pair" onClick={() => setPairs(pairs.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className="block">
            <span className={labelCls}>Text</span>
            <input value={p.prompt} onKeyDown={stop} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} className={inputCls} />
          </label>
          <label className="mt-1 block">
            <span className={labelCls}>Matching option</span>
            <input value={p.answer} placeholder="Correct match for this option" onKeyDown={stop} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} className={inputCls} />
          </label>
        </div>
      ))}
      <button type="button" onClick={() => setPairs([...pairs, { prompt: '', answer: '' }])} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Plus className="h-3 w-3" /> Add option
      </button>
    </div>
  );
}

function ListForm({ values, itemLabel, addLabel, onChange }: { values: string[]; itemLabel: string; addLabel: string; onChange: (n: string[]) => void }) {
  return (
    <div className="mt-2 rounded border border-border p-2">
      {values.map((v, i) => (
        <div key={i} className="mb-1 flex items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{itemLabel} {i + 1}</span>
          <input value={v} onKeyDown={stop} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
          <button type="button" aria-label="Remove" onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...values, ''])} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Plus className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  );
}

function SliderForm({ data, update }: { data: AssessmentData; update: (n: AssessmentData) => void }) {
  const s = data.slider ?? { min: 0, max: 10, step: 1, correct: 5 };
  const set = (patch: Partial<typeof s>) => update({ ...data, slider: { ...s, ...patch } });
  const num = (v: string) => (v === '' ? 0 : Number(v));
  return (
    <div className="mt-2 grid grid-cols-4 gap-2 rounded border border-border p-2">
      {(['min', 'max', 'step', 'correct'] as const).map((k) => (
        <label key={k} className="block">
          <span className={labelCls}>{k}</span>
          <input type="number" value={s[k]} onKeyDown={stop} onChange={(e) => set({ [k]: num(e.target.value) })} className={inputCls} />
        </label>
      ))}
    </div>
  );
}

function ChecklistForm({ data, update }: { data: AssessmentData; update: (n: AssessmentData) => void }) {
  const options = data.options ?? [];
  const setOptions = (next: McqOption[]) => update({ ...data, options: next });
  const patch = (i: number, p: Partial<McqOption>) => setOptions(options.map((o, j) => (j === i ? { ...o, ...p } : o)));
  const selectable = Math.max(1, Number(data.selectable ?? 1));
  return (
    <div className="mt-2 rounded border border-border p-2">
      <div className={labelCls}>Items</div>
      {options.map((opt, i) => (
        <div key={i} className="mb-2 rounded border border-border p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <input type="checkbox" checked={opt.correct} onChange={(e) => patch(i, { correct: e.target.checked })} className="h-4 w-4 accent-[color:var(--primary)]" />
              Correct
              <span className="ml-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Item {i + 1}/{options.length}
              </span>
            </label>
            <button type="button" aria-label="Remove item" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className="block">
            <span className={labelCls}>Item text</span>
            <input value={opt.text} onKeyDown={stop} onChange={(e) => patch(i, { text: e.target.value })} className={inputCls} />
          </label>
          <label className="mt-1 block">
            <span className={labelCls}>Answer-specific feedback</span>
            <input value={opt.feedback ?? ''} placeholder="Shown when this item is selected" onKeyDown={stop} onChange={(e) => patch(i, { feedback: e.target.value })} className={inputCls} />
          </label>
        </div>
      ))}
      <button type="button" onClick={() => setOptions([...options, { text: '', correct: false, feedback: '' }])} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Plus className="h-3 w-3" /> Add item
      </button>
      <label className="mt-2 block">
        <span className={labelCls}>Selectable (how many items the learner may tick)</span>
        <input
          type="number"
          min={1}
          value={selectable}
          onKeyDown={stop}
          onChange={(e) => update({ ...data, selectable: Math.max(1, Number(e.target.value) || 1) })}
          className={inputCls}
        />
      </label>
    </div>
  );
}

function Body({ kind, data, update }: { kind: AssessmentKind; data: AssessmentData; update: (n: AssessmentData) => void }) {
  switch (kind) {
    case 'mcq':
    case 'gmcq':
      return <OptionsForm data={data} graphic={kind === 'gmcq'} update={update} />;
    case 'checklist':
      return <ChecklistForm data={data} update={update} />;
    case 'matching':
      return <MatchingForm data={data} update={update} />;
    case 'reorder':
      return <ListForm values={data.items ?? []} itemLabel="Position" addLabel="Add item" onChange={(n) => update({ ...data, items: n })} />;
    case 'textInput':
      return <ListForm values={data.answers ?? []} itemLabel="Answer" addLabel="Add acceptable answer" onChange={(n) => update({ ...data, answers: n })} />;
    case 'slider':
      return <SliderForm data={data} update={update} />;
    default:
      return null;
  }
}

// ── The block ────────────────────────────────────────────────────────────────

export const assessmentBlock = createReactBlockSpec(
  {
    type: 'sbAssessment',
    propSchema: {
      kind: { default: 'mcq', values: ['mcq', 'gmcq', 'matching', 'reorder', 'textInput', 'slider', 'checklist'] },
      title: { default: '' },
      adaptComponent: { default: 'mcq' },
      data: { default: '{}' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const kind = (isAssessmentKind(block.props.kind as string) ? block.props.kind : 'mcq') as AssessmentKind;
      const [model, setModel] = useState<AssessmentData>(() => parseData(kind, block.props.data as string));
      //assessments open in Preview by default so the reader
      // sees the full question + options + feedback exactly as rendered in
      // the Word/PDF export. Editing is opt-in via the "Edit" button in the
      // preview header. This applies uniformly to loaded AND brand-new
      // questions — a blank question still shows an empty preview until the
      // author explicitly hits Edit.
      const [collapsed, setCollapsed] = useState(true);
      const [source, setSource] = useState(false);
      const title = block.props.title as string;
      const fb = model.feedback ?? emptyFeedback();

      const update = (next: AssessmentData) => {
        setModel(next);
        editor.updateBlock(block, { props: { data: JSON.stringify(next) } });
      };
      const setTitle = (t: string) => editor.updateBlock(block, { props: { title: t } });

      const regenerate = async () => {
        try {
          const seed = model.question || title || LABELS[kind];
          const r = (await storyboardAi('suggest', seed)).trim();
          if (r) update({ ...model, question: r });
        } catch {
          /* surfaced elsewhere */
        }
      };

      const issues = validateAssessment(kind, model, title);

      // Only these top-level labels have authored text worth showing.
      const feedbackRows: Array<[keyof AssessmentFeedback, string]> = [
        ['correct', 'Correct'],
        ['incorrect', 'Incorrect'],
        ['incorrectNotFinal', 'Incorrect — not final'],
        ['partlyCorrectFinal', 'Partly correct — final'],
        ['partlyCorrectNotFinal', 'Partly correct — not final'],
      ];
      const displayedFeedback = feedbackRows.filter(([k]) => fb[k] && fb[k].trim());
      const displayedOptions = (model.options ?? []).filter((o) => o.text.trim());
      const displayedItems = (model.items ?? []).filter((i) => i && i.trim());
      const displayedPairs = (model.pairs ?? []).filter((p) => p && (p.prompt || p.answer));
      const displayedAnswers = (model.answers ?? []).filter((a) => a && a.trim());

      // Question Title/Body resolution (PR review — no duplicated text):
      //   • The block-level Title is the primary header; when the author left
      //     it empty the question Body stands in as the header (matches how
      //     the backend hydrates `displayTitle` from `blockTitle || question`).
      //   • The question Body is rendered as its own paragraph only when it
      //     isn't already the header text — the same sentence never shows twice.
      const questionText = (model.question || '').trim();
      const blockTitle = (title || '').trim();
      const headerText = blockTitle || questionText || 'Untitled question';
      const showQuestionParagraph = !!questionText && questionText !== headerText;

      if (collapsed) {
        return (
          <div
            className="group relative my-2 rounded-lg border bg-muted/20 p-4"
            contentEditable={false}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {LABELS[kind]}
              </span>
              <span className="truncate text-base font-semibold text-foreground">
                {headerText}
              </span>
            </div>
            {showQuestionParagraph && (
              <p className="mb-2 whitespace-pre-wrap text-sm text-foreground">{questionText}</p>
            )}

            {/* MCQ / graphic MCQ / checklist — option list with correct/incorrect glyph + per-option feedback */}
            {(kind === 'mcq' || kind === 'gmcq' || kind === 'checklist') && displayedOptions.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {displayedOptions.map((o, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={`mt-[3px] inline-block h-3 w-3 shrink-0 rounded-full ${
                          o.correct ? 'bg-foreground' : 'border border-foreground/60'
                        }`}
                      />
                      <span className={o.correct ? 'font-medium text-foreground' : 'text-foreground'}>
                        {o.text}
                      </span>
                    </div>
                    {kind === 'gmcq' && (o.imageUrl || o.image) && (
                      <img
                        src={o.imageUrl || o.image}
                        alt={o.text}
                        className="ml-5 mt-1 h-20 w-32 rounded object-cover"
                      />
                    )}
                    {o.feedback && o.feedback.trim() && (
                      <div className="ml-5 mt-0.5 text-[13px] italic text-muted-foreground">
                        {o.feedback}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Matching */}
            {kind === 'matching' && displayedPairs.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {displayedPairs.map((p, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span aria-hidden>•</span>
                    <span>{p.prompt}</span>
                    <span className="font-semibold">→</span>
                    <span className="italic text-muted-foreground">{p.answer}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Reorder */}
            {kind === 'reorder' && displayedItems.length > 0 && (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {displayedItems.map((i, idx) => <li key={idx}>{i}</li>)}
              </ol>
            )}

            {/* Text input */}
            {kind === 'textInput' && displayedAnswers.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {displayedAnswers.map((a, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span aria-hidden>•</span>
                    <span className="italic text-muted-foreground">Accepted answer:</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Slider */}
            {kind === 'slider' && model.slider && (
              <p className="mt-2 text-sm text-foreground">
                Range: {model.slider.min ?? 0}–{model.slider.max ?? 10} step{' '}
                {model.slider.step ?? 1}, correct answer {model.slider.correct ?? ''}
              </p>
            )}

            {/* Whole-question feedback (only labels with authored text) */}
            {displayedFeedback.length > 0 && (
              <div className="mt-3 space-y-0.5 text-sm">
                {displayedFeedback.map(([k, lbl]) => (
                  <div key={k}>
                    <span className="font-semibold text-foreground">{lbl}:</span>{' '}
                    <span className="text-foreground">{fb[k]}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Submit instruction */}
            <p className="mt-3 text-sm italic text-muted-foreground">{FOOTER[kind]}</p>

            {issues.length > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-[#92400e]" title={issues.join('\n')}>
                <AlertTriangle className="h-3.5 w-3.5" /> {issues.length} to fix
              </div>
            )}

            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 focus:opacity-100"
              title="Edit this question"
            >
              <RefreshCw className="h-3 w-3" /> Edit
            </button>
          </div>
        );
      }

      return (
        <div className="my-2 rounded-lg border p-3" contentEditable={false}>
          {/* Header */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {LABELS[kind]}
            </span>
            <input value={title} placeholder={`${LABELS[kind]} title`} onKeyDown={stop} onChange={(e) => setTitle(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground" />
            <HeaderBtn onClick={() => update({ ...model, showTitle: !model.showTitle })} active={model.showTitle} title="Show the title to learners">
              <Check className="h-3 w-3" /> Show title
            </HeaderBtn>
            <HeaderBtn onClick={() => {}} title="Change type in the Page Editor">
              <RefreshCw className="h-3 w-3" /> Replace
            </HeaderBtn>
            <HeaderBtn onClick={regenerate} title="Draft with AI">
              <Sparkles className="h-3 w-3" /> AI
            </HeaderBtn>
            <HeaderBtn onClick={() => setSource((s) => !s)} active={source} title="Toggle source view">
              <Code className="h-3 w-3" /> Source
            </HeaderBtn>
            <HeaderBtn
              onClick={() => storyboardActions.openComment({ blockId: block.id, label: `ASSESSMENT · ${LABELS[kind].toUpperCase()}` })}
              title="Comment on this question"
            >
              <MessageSquare className="h-3 w-3" /> Comment
            </HeaderBtn>
            <HeaderBtn onClick={() => editor.removeBlocks([block])} title="Delete question">
              <Trash2 className="h-3 w-3" /> Delete
            </HeaderBtn>
            <HeaderBtn onClick={() => setCollapsed(true)} title="Collapse">
              <Check className="h-3 w-3" /> Done
            </HeaderBtn>
          </div>

          {/* Regenerate with AI bar */}
          <button
            type="button"
            onClick={regenerate}
            className="mb-2 flex w-full items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-left text-xs hover:opacity-90"
            style={{ borderColor: 'color-mix(in oklab, var(--samaritan) 40%, transparent)', background: 'color-mix(in oklab, var(--samaritan) 6%, transparent)' }}
          >
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--samaritan)' }}>
              <Sparkles className="h-3.5 w-3.5" /> Regenerate with AI
            </span>
            <span className="text-muted-foreground">Drafts the question, items and feedback from the course content and learning objectives.</span>
          </button>

          {source ? (
            <textarea value={JSON.stringify(model, null, 2)} readOnly rows={8} className={`${inputCls} font-mono text-xs`} />
          ) : (
            <>
              {/* Body */}
              <label className="block">
                <span className={labelCls}>Body</span>
                <textarea value={model.question} placeholder="Type the question here" onKeyDown={stop} rows={2} onChange={(e) => update({ ...model, question: e.target.value })} className={`${inputCls} resize-y`} />
              </label>

              <Body kind={kind} data={model} update={update} />
              <FeedbackGroup fb={fb} set={(f) => update({ ...model, feedback: f })} />
            </>
          )}

          {/* Footer + readiness */}
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm italic text-muted-foreground">{FOOTER[kind]}</p>
            {issues.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-[#92400e]" title={issues.join('\n')}>
                <AlertTriangle className="h-3.5 w-3.5" /> {issues.length} to fix
              </span>
            )}
          </div>
        </div>
      );
    },
  }
);
