// Custom BlockNote block: simplified assessment authoring (spec AC5).
//
// One block covers MCQ / Graphic MCQ / Matching / Sentence Reordering / Text
// Input / Slider. It shows only the essential authoring fields — advanced
// settings (feedback, scoring, attempts) are deferred to the Page Editor. The
// structured model is stored as JSON in the `data` prop (BlockNote props are
// primitives only) and validated inline so it's generation-ready for Phase 4.

import { useState } from 'react';
import { Plus, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createReactBlockSpec } from '@blocknote/react';
import {
  defaultAssessmentData,
  isAssessmentKind,
  validateAssessment,
  type AssessmentData,
  type AssessmentKind,
  type McqOption,
} from '@/types/storyboard';

const LABELS: Record<AssessmentKind, string> = {
  mcq: 'MCQ',
  gmcq: 'Graphic MCQ',
  matching: 'Matching',
  reorder: 'Sentence Reordering',
  textInput: 'Text Input',
  slider: 'Slider',
};

function parseData(kind: AssessmentKind, raw: string): AssessmentData {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as AssessmentData;
  } catch {
    /* fall through to default */
  }
  return defaultAssessmentData(kind);
}

// Small presentational helpers ------------------------------------------------

const inputCls =
  'w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary';
const stop = (e: React.KeyboardEvent) => e.stopPropagation(); // keep keys out of BlockNote

function RowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      <Plus className="h-3 w-3" /> {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove"
      className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

// Per-kind forms --------------------------------------------------------------

function OptionsForm({
  data,
  graphic,
  update,
}: {
  data: AssessmentData;
  graphic: boolean;
  update: (next: AssessmentData) => void;
}) {
  const options = data.options ?? [];
  const setOptions = (next: McqOption[]) => update({ ...data, options: next });
  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={opt.correct}
            onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, correct: e.target.checked } : o)))}
            title="Correct answer"
            className="h-4 w-4 shrink-0 accent-[color:var(--primary)]"
          />
          <input
            value={opt.text}
            placeholder={`Option ${i + 1}`}
            onKeyDown={stop}
            onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, text: e.target.value } : o)))}
            className={inputCls}
          />
          {graphic && (
            <input
              value={opt.image ?? ''}
              placeholder="Image URL"
              onKeyDown={stop}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, image: e.target.value } : o)))}
              className={`${inputCls} max-w-[9rem]`}
            />
          )}
          <RemoveButton onClick={() => setOptions(options.filter((_, j) => j !== i))} />
        </div>
      ))}
      <RowButton onClick={() => setOptions([...options, { text: '', correct: false }])} label="Add option" />
    </div>
  );
}

function MatchingForm({ data, update }: { data: AssessmentData; update: (n: AssessmentData) => void }) {
  const pairs = data.pairs ?? [];
  const setPairs = (next: typeof pairs) => update({ ...data, pairs: next });
  return (
    <div className="space-y-1.5">
      {pairs.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={p.prompt}
            placeholder="Prompt"
            onKeyDown={stop}
            onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))}
            className={inputCls}
          />
          <span className="text-muted-foreground">↔</span>
          <input
            value={p.answer}
            placeholder="Correct match"
            onKeyDown={stop}
            onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
            className={inputCls}
          />
          <RemoveButton onClick={() => setPairs(pairs.filter((_, j) => j !== i))} />
        </div>
      ))}
      <RowButton onClick={() => setPairs([...pairs, { prompt: '', answer: '' }])} label="Add pair" />
    </div>
  );
}

function ListForm({
  values,
  placeholder,
  addLabel,
  hint,
  onChange,
}: {
  values: string[];
  placeholder: (i: number) => string;
  addLabel: string;
  hint?: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          {placeholder(i).startsWith('#') && (
            <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
          )}
          <input
            value={v}
            placeholder={placeholder(i).replace(/^#/, '')}
            onKeyDown={stop}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
            className={inputCls}
          />
          <RemoveButton onClick={() => onChange(values.filter((_, j) => j !== i))} />
        </div>
      ))}
      <RowButton onClick={() => onChange([...values, ''])} label={addLabel} />
    </div>
  );
}

function SliderForm({ data, update }: { data: AssessmentData; update: (n: AssessmentData) => void }) {
  const s = data.slider ?? { min: 0, max: 10, step: 1, correct: 5 };
  const set = (patch: Partial<typeof s>) => update({ ...data, slider: { ...s, ...patch } });
  const num = (v: string) => (v === '' ? 0 : Number(v));
  return (
    <div className="grid grid-cols-4 gap-2">
      {(['min', 'max', 'step', 'correct'] as const).map((k) => (
        <label key={k} className="text-xs text-muted-foreground">
          <span className="mb-0.5 block capitalize">{k}</span>
          <input
            type="number"
            value={s[k]}
            onKeyDown={stop}
            onChange={(e) => set({ [k]: num(e.target.value) })}
            className={inputCls}
          />
        </label>
      ))}
    </div>
  );
}

// The block ------------------------------------------------------------------

export const assessmentBlock = createReactBlockSpec(
  {
    type: 'sbAssessment',
    propSchema: {
      kind: { default: 'mcq', values: ['mcq', 'gmcq', 'matching', 'reorder', 'textInput', 'slider'] },
      title: { default: '' },
      adaptComponent: { default: 'adapt-contrib-mcq' },
      data: { default: '{}' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const kind = (isAssessmentKind(block.props.kind as string) ? block.props.kind : 'mcq') as AssessmentKind;
      const [model, setModel] = useState<AssessmentData>(() => parseData(kind, block.props.data as string));

      const update = (next: AssessmentData) => {
        setModel(next);
        editor.updateBlock(block, { props: { data: JSON.stringify(next), title: next.question || '' } });
      };

      const issues = validateAssessment(kind, model);
      const ready = issues.length === 0;

      return (
        <div className="my-2 rounded-md border border-dashed border-primary/50 bg-primary/5 p-3" contentEditable={false}>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
              Assessment
            </span>
            <span className="text-sm font-medium text-foreground">{LABELS[kind]}</span>
            <span
              className={`ml-auto inline-flex items-center gap-1 text-xs ${ready ? 'text-[#166534]' : 'text-[#92400e]'}`}
              title={ready ? 'Generation-ready' : issues.join('\n')}
            >
              {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {ready ? 'Ready' : `${issues.length} to fix`}
            </span>
          </div>

          <input
            value={model.question}
            placeholder="Question / instruction…"
            onKeyDown={stop}
            onChange={(e) => update({ ...model, question: e.target.value })}
            className={`${inputCls} mb-2 font-medium`}
          />

          {(kind === 'mcq' || kind === 'gmcq') && (
            <OptionsForm data={model} graphic={kind === 'gmcq'} update={update} />
          )}
          {kind === 'matching' && <MatchingForm data={model} update={update} />}
          {kind === 'reorder' && (
            <ListForm
              values={model.items ?? []}
              placeholder={() => '#Item'}
              addLabel="Add item"
              hint="List items in their correct order."
              onChange={(next) => update({ ...model, items: next })}
            />
          )}
          {kind === 'textInput' && (
            <ListForm
              values={model.answers ?? []}
              placeholder={() => 'Acceptable answer'}
              addLabel="Add acceptable answer"
              onChange={(next) => update({ ...model, answers: next })}
            />
          )}
          {kind === 'slider' && <SliderForm data={model} update={update} />}

          <p className="mt-2 text-xs text-muted-foreground">
            Advanced settings (feedback, scoring, attempts) are configured in the Page Editor.
          </p>
        </div>
      );
    },
  }
);
