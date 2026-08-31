// Rich component authoring card (spec AC3). One BlockNote block renders the
// full inline editor for every non-assessment content type, matching the
// Lovable design: a common header (type badge, title, Show title, Replace, AI,
// Source, Delete, Done) + a per-type body + a "Suggested components" footer.
//
// Media (image/video/audio) use the real DAM picker (AssetPickerModal) via
// AssetField — "Select an Asset" browses/uploads course assets, "Select an
// External Asset" accepts a URL. The chosen asset's course-relative link is
// persisted into the Adapt graphic/media component fields (see mediaMapping.ts).
// Data is stored as JSON in the `data` prop (BlockNote props are primitives only).

import { useState } from 'react';
import {
  Type,
  Layers,
  Image as ImageIcon,
  Video,
  AudioLines,
  Puzzle,
  ClipboardList,
  Award,
  RefreshCw,
  Sparkles,
  Code,
  Trash2,
  Check,
  Plus,
  X,
  FolderOpen,
  Link2,
  MessageSquare,
} from 'lucide-react';
import { createReactBlockSpec } from '@blocknote/react';
import { storyboardActions } from '../storyboardActions';
import type { AssetKind } from '@/api/adaptAuthoring';
import AssetPickerModal from '@/components/common/AssetPickerModal';
import { emptyMediaData, toEmbedUrl, type AssetRef, type ImageData, type MediaData } from '../mediaMapping';

// YouTube/Vimeo → iframe embed; direct file URLs → <video>. Matches Lovable.
function VideoView({ src, poster, className }: { src: string; poster?: string; className?: string }) {
  const embed = toEmbedUrl(src);
  if (embed) {
    return (
      <div className={`aspect-video w-full overflow-hidden rounded ${className ?? ''}`}>
        <iframe
          src={embed}
          title="Video"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }
  return <video src={src} poster={poster || undefined} controls className={className ?? 'w-full rounded'} />;
}

// ── Kinds + metadata ─────────────────────────────────────────────────────────

export type ComponentKind =
  | 'text'
  | 'groupedContent'
  | 'image'
  | 'video'
  | 'audio'
  | 'h5p'
  | 'laerdalForm'
  | 'assessmentResult';

export const COMPONENT_KINDS: ComponentKind[] = [
  'text',
  'groupedContent',
  'image',
  'video',
  'audio',
  'h5p',
  'laerdalForm',
  'assessmentResult',
];

const META: Record<ComponentKind, { badge: string; Icon: typeof Type; comp: string; suggest: ComponentKind[] }> = {
  text: { badge: 'Text', Icon: Type, comp: 'text', suggest: ['groupedContent', 'image'] },
  groupedContent: { badge: 'Grouped Content', Icon: Layers, comp: 'text', suggest: ['image', 'text'] },
  image: { badge: 'Image', Icon: ImageIcon, comp: 'graphic', suggest: ['groupedContent', 'video'] },
  video: { badge: 'Video', Icon: Video, comp: 'media', suggest: ['audio', 'image'] },
  audio: { badge: 'Audio', Icon: AudioLines, comp: 'media', suggest: ['video', 'text'] },
  h5p: { badge: 'H5P', Icon: Puzzle, comp: 'h5p', suggest: ['video', 'groupedContent'] },
  laerdalForm: { badge: 'Laerdal Form', Icon: ClipboardList, comp: 'text', suggest: ['text'] },
  assessmentResult: { badge: 'Assessment Result', Icon: Award, comp: 'assessmentResults', suggest: ['text'] },
};

const LABEL_TO_KIND: Record<string, ComponentKind> = Object.fromEntries(
  COMPONENT_KINDS.map((k) => [META[k].badge, k])
) as Record<string, ComponentKind>;

// ── Data model ───────────────────────────────────────────────────────────────

interface GroupedItem {
  title: string;
  body: string;
  image: string; // PERSISTED value → `_graphic.src` (course/assets/<file> or external URL)
  imageUrl?: string; // servable preview URL (/api/asset/serve/<id>); not persisted verbatim
  imageAssetId?: string; // DAM asset id, for the courseasset publish link
}
interface FormField {
  control: string;
  label: string;
  placeholder: string;
  mandatory: boolean;
}
// adapt-contrib-assessmentResults: bands + retry + completion body. Bound to an
// Adapt article-level assessment via `_assessmentId` — the user picks the
// article id (visible in the Page Editor) or leaves it blank to use the first
// assessment in the course at runtime.
interface ResultBand {
  score: number;
  feedback: string;
  allowRetry: boolean;
}
interface AssessmentResultConfig {
  assessmentId: string;
  completionBody: string;
  retryButton: string;
  retryFeedback: string;
  bands: ResultBand[];
}
interface ComponentData {
  showTitle: boolean;
  description: string;
  instruction: string;
  items?: GroupedItem[];
  image?: ImageData; // image card (→ _graphic)
  media?: MediaData; // video/audio card (→ _media)
  fields?: FormField[];
  result?: AssessmentResultConfig; // assessmentResult card
}

const FORM_CONTROLS = ['Single-Line Text', 'Multi-Line Text', 'Number', 'Checkbox', 'Dropdown'];

export function defaultComponentData(kind: ComponentKind): ComponentData {
  const base: ComponentData = { showTitle: true, description: '', instruction: '' };
  switch (kind) {
    case 'groupedContent':
      return { ...base, items: [{ title: '', body: '', image: '' }, { title: '', body: '', image: '' }] };
    case 'image':
      return { ...base, image: { link: '', url: '', alt: '' } };
    case 'video':
    case 'audio':
    case 'h5p':
      return { ...base, media: emptyMediaData() };
    case 'laerdalForm':
      return { ...base, fields: [{ control: 'Single-Line Text', label: 'Your answer', placeholder: 'Type here', mandatory: false }] };
    case 'assessmentResult':
      return {
        ...base,
        result: {
          assessmentId: '',
          completionBody: 'You scored {{scoreAsPercent}}%.',
          retryButton: 'Try again',
          retryFeedback: 'Take another go and see if you can improve your score.',
          bands: [
            { score: 0, feedback: 'You did not pass. Please review the material and try again.', allowRetry: true },
            { score: 80, feedback: 'Well done — you passed!', allowRetry: false },
          ],
        },
      };
    default:
      return base;
  }
}

export function makeComponentBlock(
  kind: ComponentKind,
  opts?: { title?: string; data?: Partial<ComponentData> }
) {
  const data = { ...defaultComponentData(kind), ...(opts?.data as Partial<ComponentData>) };
  return {
    type: 'sbComponent',
    props: { kind, title: opts?.title ?? '', adaptComponent: META[kind].comp, data: JSON.stringify(data) },
  };
}

export const isComponentKind = (k: string): k is ComponentKind => (COMPONENT_KINDS as string[]).includes(k);

function parseData(kind: ComponentKind, raw: string): ComponentData {
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object') return { ...defaultComponentData(kind), ...p };
  } catch {
    /* fall through */
  }
  return defaultComponentData(kind);
}

// A component with real content (loaded from an existing document/course)
// opens collapsed in read-only Preview (ADAPT-3785); a brand-new, still-blank
// component (just inserted from Add Content) opens expanded so the author can
// start typing immediately instead of clicking Edit first.
//
// A DAM-picked asset counts as content even when its persisted `link` is
// still empty (the publish link is derived from `assetId` later), so every
// media check also looks at the asset id.
const refHasMedia = (a?: AssetRef): boolean =>
  !!(a && ((a.assetId || '').trim() || (a.link || '').trim() || (a.url || '').trim()));

function hasComponentContent(kind: ComponentKind, data: ComponentData, title: string): boolean {
  if (title.trim() || data.description.trim() || data.instruction.trim()) return true;
  switch (kind) {
    case 'groupedContent':
      return (data.items || []).some(
        (it) => it.title.trim() || it.body.trim() || it.image.trim() || (it.imageUrl || '').trim() || (it.imageAssetId || '').trim()
      );
    case 'image':
      return refHasMedia(data.image);
    case 'video':
    case 'audio':
      return refHasMedia(data.media?.asset) || refHasMedia(data.media?.poster);
    case 'h5p':
      return refHasMedia(data.media?.asset);
    case 'laerdalForm':
      return (data.fields || []).some((f) => f.label.trim());
    case 'assessmentResult':
      return !!(data.result?.assessmentId.trim() || (data.result?.bands || []).some((b) => b.feedback.trim()));
    default:
      return false;
  }
}

// ── Presentational helpers ───────────────────────────────────────────────────

const inputCls =
  'w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary';
const labelCls = 'mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const stop = (e: React.KeyboardEvent) => e.stopPropagation();

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

// Preview a chosen asset by kind. Prefers the resolvable preview `url`, falling
// back to the persisted `link` (e.g. an external URL).
function AssetPreview({ assetType, value }: { assetType: AssetKind; value: AssetRef }) {
  const src = value.url || value.link || '';
  if (!src) return null;
  if (assetType === 'image') return <img src={src} alt="" className="max-h-48 w-full rounded object-contain" />;
  if (assetType === 'audio') return <audio src={src} controls className="w-full" />;
  if (assetType === 'h5p') {
    // H5P files (.h5p) can't be played inline in the editor — show a badge.
    return (
      <div className="flex items-center gap-2 rounded border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Puzzle className="h-4 w-4" /> H5P package selected
      </div>
    );
  }
  return <VideoView src={src} className="max-h-64 w-full rounded" />;
}

// The Lovable asset field: "Select an Asset" (DAM picker) / "Select an External
// Asset" (URL) when empty; asset preview + path + Change/Remove when set.
function AssetField({
  assetType,
  value,
  onChange,
}: {
  assetType: AssetKind;
  value?: AssetRef;
  onChange: (next: AssetRef | undefined) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [external, setExternal] = useState(false);
  const [url, setUrl] = useState('');
  const has = !!(value && (value.link || value.url));

  const applyExternal = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onChange({ link: trimmed, url: trimmed, external: true });
    setExternal(false);
    setUrl('');
  };

  return (
    <div className="rounded-md border border-border p-3">
      {has ? (
        <div>
          <AssetPreview assetType={assetType} value={value as AssetRef} />
          <div className="mt-2 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={value?.link}>
              {value?.link}
            </span>
            <button type="button" onClick={() => setPicking(true)} className="rounded border border-primary px-2 py-0.5 text-xs text-primary hover:bg-primary/5">
              Change
            </button>
            <button type="button" onClick={() => onChange(undefined)} className="rounded border border-red-500 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">
              Remove
            </button>
          </div>
        </div>
      ) : external ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') applyExternal();
            }}
            placeholder="https://… (or YouTube / Vimeo link)"
            className={inputCls}
          />
          <button type="button" onClick={applyExternal} className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
            Add
          </button>
          <button type="button" onClick={() => setExternal(false)} className="text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <FolderOpen className="h-3.5 w-3.5" /> Select an Asset
          </button>
          <button
            type="button"
            onClick={() => setExternal(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5"
          >
            <Link2 className="h-3.5 w-3.5" /> Select an External Asset
          </button>
        </div>
      )}

      {picking && (
        <AssetPickerModal
          assetType={assetType}
          onClose={() => setPicking(false)}
          onSelect={(asset) => {
            onChange({ assetId: asset.id, link: asset.assetLink, url: asset.url, external: false });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

// ── Per-kind bodies ──────────────────────────────────────────────────────────

function TranscriptFields({ kind, media, set }: { kind: 'video' | 'audio'; media: MediaData; set: (m: MediaData) => void }) {
  const field = (key: keyof MediaData, label: string, ph: string) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input value={(media[key] as string) || ''} placeholder={ph} onKeyDown={stop} onChange={(e) => set({ ...media, [key]: e.target.value })} className={inputCls} />
    </label>
  );
  return (
    <div className="space-y-2">
      <div>
        <span className={labelCls}>{kind === 'audio' ? 'Audio' : 'Video'} source</span>
        <AssetField assetType={kind} value={media.asset} onChange={(a) => set({ ...media, asset: a })} />
      </div>
      {kind === 'video' && (
        <div>
          <span className={labelCls}>Poster image</span>
          <AssetField assetType="image" value={media.poster} onChange={(a) => set({ ...media, poster: a })} />
        </div>
      )}
      <div className="rounded border border-border p-2">
        <div className={labelCls}>Transcript, captions &amp; chapters</div>
        {field('transcriptSource', 'Transcript source', 'https://… .vtt / .txt')}
        <label className="mt-1 block">
          <span className={labelCls}>Transcript text (in the storyboard)</span>
          <textarea value={media.transcriptText} onKeyDown={stop} onChange={(e) => set({ ...media, transcriptText: e.target.value })} rows={2} placeholder="Paste or write the transcript here" className={`${inputCls} resize-y`} />
        </label>
        {field('captionsSource', 'Captions source', 'https://… .vtt')}
        {field('descriptionsSource', 'Descriptions source', 'https://… .vtt')}
        {field('chaptersSource', 'Chapters source', 'https://… .vtt')}
      </div>
    </div>
  );
}

function ComponentBody({ kind, data, set }: { kind: ComponentKind; data: ComponentData; set: (d: ComponentData) => void }) {
  if (kind === 'text') {
    return (
      <div>
        <span className={labelCls}>Description</span>
        <textarea value={data.description} onKeyDown={stop} onChange={(e) => set({ ...data, description: e.target.value })} rows={2} placeholder="New component content…" className={`${inputCls} resize-y`} />
      </div>
    );
  }

  if (kind === 'groupedContent') {
    const items = data.items ?? [];
    const setItems = (n: GroupedItem[]) => set({ ...data, items: n });
    return (
      <div className="space-y-2">
        <p className="text-sm italic text-muted-foreground">Select each heading to find out more.</p>
        {items.map((it, i) => (
          <div key={i} className="rounded border border-border p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Item {i + 1} of {items.length}</span>
              <button type="button" aria-label="Remove item" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <input value={it.title} placeholder="Item title" onKeyDown={stop} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className={`${inputCls} mb-1`} />
            <textarea value={it.body} placeholder="Item body — what should the learner read here?" onKeyDown={stop} rows={2} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} className={`${inputCls} mb-1 resize-y`} />
            <AssetField
              assetType="image"
              value={
                it.image || it.imageUrl
                  ? { link: it.image, url: it.imageUrl || it.image, assetId: it.imageAssetId }
                  : undefined
              }
              onChange={(a) =>
                setItems(
                  items.map((x, j) =>
                    j === i
                      ? { ...x, image: a?.link || '', imageUrl: a?.url || '', imageAssetId: a?.assetId }
                      : x
                  )
                )
              }
            />
          </div>
        ))}
        <button type="button" onClick={() => setItems([...items, { title: '', body: '', image: '' }])} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Plus className="h-3 w-3" /> Add item
        </button>
      </div>
    );
  }

  if (kind === 'image') {
    const image = data.image ?? { link: '', url: '', alt: '' };
    return (
      <div className="space-y-2">
        <AssetField
          assetType="image"
          value={image.link || image.url ? image : undefined}
          onChange={(a) => set({ ...data, image: { ...(a ?? { link: '', url: '' }), alt: image.alt } })}
        />
        <label className="block">
          <span className={labelCls}>Alternative text</span>
          <input value={image.alt} placeholder="Describe the image for screen readers" onKeyDown={stop} onChange={(e) => set({ ...data, image: { ...image, alt: e.target.value } })} className={inputCls} />
        </label>
      </div>
    );
  }

  if (kind === 'video' || kind === 'audio') {
    const media = data.media ?? emptyMediaData();
    return <TranscriptFields kind={kind} media={media} set={(m) => set({ ...data, media: m })} />;
  }

  if (kind === 'h5p') {
    // laerdal-h5p supports EITHER a `.h5p` DAM asset (→ `h5pAsset`) OR an
    // external embed URL (→ `_h5pExternalAsset`). The `.external` flag on the
    // stored AssetRef distinguishes the two; the picker below only accepts
    // `.h5p` uploads so the DAM branch is never fed an unsupported file.
    const asset = data.media?.asset;
    return (
      <div className="space-y-2">
        <span className={labelCls}>H5P source</span>
        <AssetField
          assetType="h5p"
          value={asset}
          onChange={(a) => set({ ...data, media: { ...(data.media ?? emptyMediaData()), asset: a } })}
        />
        <p className="text-[11px] italic text-muted-foreground">
          Choose a <code>.h5p</code> package from the asset library, upload one, or paste an external URL.
        </p>
      </div>
    );
  }

  if (kind === 'laerdalForm') {
    const fields = data.fields ?? [];
    const setFields = (n: FormField[]) => set({ ...data, fields: n });
    return (
      <div className="space-y-2">
        {fields.map((f, i) => (
          <div key={i} className="rounded border border-border p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Field {i + 1}/{fields.length}</span>
              <button type="button" aria-label="Remove field" onClick={() => setFields(fields.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="block">
              <span className={labelCls}>Form control</span>
              <select value={f.control} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, control: e.target.value } : x)))} className={inputCls}>
                {FORM_CONTROLS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="mt-1 block">
              <span className={labelCls}>Label</span>
              <input value={f.label} onKeyDown={stop} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={inputCls} />
            </label>
            <label className="mt-1 block">
              <span className={labelCls}>Placeholder</span>
              <input value={f.placeholder} onKeyDown={stop} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, placeholder: e.target.value } : x)))} className={inputCls} />
            </label>
            <label className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
              <input type="checkbox" checked={f.mandatory} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, mandatory: e.target.checked } : x)))} className="h-4 w-4 accent-[color:var(--primary)]" />
              Is mandatory
            </label>
          </div>
        ))}
        <button type="button" onClick={() => setFields([...fields, { control: 'Single-Line Text', label: '', placeholder: '', mandatory: false }])} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Plus className="h-3 w-3" /> Add form control
        </button>
      </div>
    );
  }

  if (kind === 'assessmentResult') {
    const r = data.result ?? {
      assessmentId: '',
      completionBody: '',
      retryButton: 'Try again',
      retryFeedback: '',
      bands: [] as ResultBand[],
    };
    const setR = (patch: Partial<AssessmentResultConfig>) => set({ ...data, result: { ...r, ...patch } });
    const setBands = (bands: ResultBand[]) => setR({ bands });
    const bands = r.bands ?? [];
    return (
      <div className="space-y-2">
        <label className="block">
          <span className={labelCls}>Assessment ID (article id)</span>
          <input
            value={r.assessmentId}
            placeholder="Leave blank to bind to the first assessment on the page"
            onKeyDown={stop}
            onChange={(e) => setR({ assessmentId: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Completion body</span>
          <textarea
            value={r.completionBody}
            placeholder="e.g. You scored {{scoreAsPercent}}%."
            rows={2}
            onKeyDown={stop}
            onChange={(e) => setR({ completionBody: e.target.value })}
            className={`${inputCls} resize-y`}
          />
          <span className="mt-0.5 block text-[11px] italic text-muted-foreground">
            Supports {'{{score}}'}, {'{{scoreAsPercent}}'}, {'{{maxScore}}'}, {'{{correct}}'}, {'{{questionCount}}'}.
          </span>
        </label>
        <div className="rounded border border-border p-2">
          <div className={labelCls}>Score bands</div>
          {bands.map((b, i) => (
            <div key={i} className="mb-2 grid grid-cols-[80px_1fr_auto] gap-2 rounded border border-border p-2">
              <label className="block">
                <span className={labelCls}>Min %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={b.score}
                  onKeyDown={stop}
                  onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, score: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)))}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Feedback</span>
                <textarea
                  value={b.feedback}
                  rows={2}
                  onKeyDown={stop}
                  onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, feedback: e.target.value } : x)))}
                  className={`${inputCls} resize-y`}
                />
                <label className="mt-1 flex items-center gap-1.5 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={b.allowRetry}
                    onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, allowRetry: e.target.checked } : x)))}
                    className="h-4 w-4 accent-[color:var(--primary)]"
                  />
                  Allow retry
                </label>
              </label>
              <button
                type="button"
                aria-label="Remove band"
                onClick={() => setBands(bands.filter((_, j) => j !== i))}
                className="self-start text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBands([...bands, { score: 0, feedback: '', allowRetry: false }])}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="h-3 w-3" /> Add band
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded border border-border p-2">
          <label className="block">
            <span className={labelCls}>Retry button label</span>
            <input value={r.retryButton} onKeyDown={stop} onChange={(e) => setR({ retryButton: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Retry feedback</span>
            <input value={r.retryFeedback} onKeyDown={stop} onChange={(e) => setR({ retryFeedback: e.target.value })} className={inputCls} />
          </label>
        </div>
      </div>
    );
  }

  return null;
}

// ── Read-only preview (the "Done"/collapsed state) ───────────────────────────
// Matches the Lovable design: the finished card renders as it would read in the
// course (image full-width, grouped content as heading + body + thumbnail rows,
// media as a player, form as its controls) rather than a bare summary strip.

function PreviewImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-xs text-muted-foreground ${className ?? 'h-40'}`}>
        <ImageIcon className="mr-1.5 h-4 w-4" /> No image source
      </div>
    );
  }
  return <img src={src} alt={alt} className={`rounded-lg object-cover ${className ?? 'w-full'}`} />;
}

function MediaPlaceholder({ Icon, label }: { Icon: typeof Type; label: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-xs text-muted-foreground">
      <Icon className="mr-1.5 h-4 w-4" /> {label}
    </div>
  );
}

function ComponentPreview({ kind, title, data }: { kind: ComponentKind; title: string; data: ComponentData }) {
  const heading = data.showTitle && title ? <h4 className="mb-2 text-base font-semibold text-foreground">{title}</h4> : null;
  const instruction = data.instruction ? <p className="mt-2 text-sm italic text-muted-foreground">{data.instruction}</p> : null;

  if (kind === 'text') {
    return (
      <div>
        {heading}
        {data.description ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{data.description}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">No content yet — click Edit to add some.</p>
        )}
        {instruction}
      </div>
    );
  }

  if (kind === 'groupedContent') {
    const items = data.items ?? [];
    return (
      <div>
        {heading}
        <p className="mb-4 text-sm italic text-muted-foreground">Select each heading to find out more.</p>
        <div className="space-y-5">
          {items.map((it, i) => (
            <div key={i} className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground">{it.title || `Item ${i + 1}`}</div>
                {it.body && <div className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{it.body}</div>}
              </div>
              {(it.imageUrl || it.image) && <img src={it.imageUrl || it.image} alt="" className="h-20 w-32 shrink-0 rounded-md object-cover" />}
            </div>
          ))}
        </div>
        {instruction}
      </div>
    );
  }

  if (kind === 'image') {
    const img = data.image;
    const src = img?.url || img?.link || '';
    return (
      <div className="space-y-3">
        {heading}
        <PreviewImage src={src} alt={img?.alt || ''} />
        {instruction}
      </div>
    );
  }

  if (kind === 'video') {
    const src = data.media?.asset?.url || data.media?.asset?.link || '';
    const poster = data.media?.poster?.url || data.media?.poster?.link || undefined;
    return (
      <div>
        {heading}
        {src ? (
          <VideoView src={src} poster={poster} className="w-full rounded-lg" />
        ) : (
          <MediaPlaceholder Icon={Video} label="No video source" />
        )}
        {instruction}
      </div>
    );
  }

  if (kind === 'audio') {
    const src = data.media?.asset?.url || data.media?.asset?.link || '';
    return (
      <div>
        {heading}
        {src ? <audio src={src} controls className="w-full" /> : <MediaPlaceholder Icon={AudioLines} label="No audio source" />}
        {instruction}
      </div>
    );
  }

  if (kind === 'h5p') {
    return (
      <div>
        {heading}
        <MediaPlaceholder Icon={Puzzle} label="H5P interactive content" />
        {instruction}
      </div>
    );
  }

  if (kind === 'laerdalForm') {
    const fields = data.fields ?? [];
    return (
      <div>
        {heading}
        <div className="space-y-3">
          {fields.map((f, i) => (
            <label key={i} className="block">
              <span className="mb-0.5 block text-sm font-medium text-foreground">
                {f.label || `Field ${i + 1}`}
                {f.mandatory && <span className="ml-0.5 text-red-600">*</span>}
              </span>
              {f.control === 'Multi-Line Text' ? (
                <textarea disabled placeholder={f.placeholder} rows={2} className={`${inputCls} resize-none bg-muted/40`} />
              ) : f.control === 'Dropdown' ? (
                <select disabled className={`${inputCls} bg-muted/40`}>
                  <option>{f.placeholder || 'Select…'}</option>
                </select>
              ) : f.control === 'Checkbox' ? (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <input type="checkbox" disabled className="h-4 w-4" /> {f.placeholder}
                </span>
              ) : (
                <input disabled type={f.control === 'Number' ? 'number' : 'text'} placeholder={f.placeholder} className={`${inputCls} bg-muted/40`} />
              )}
            </label>
          ))}
        </div>
        {instruction}
      </div>
    );
  }

  if (kind === 'assessmentResult') {
    const r = data.result;
    const bands = r?.bands ?? [];
    return (
      <div>
        {heading}
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3">
          <div className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Award className="h-3.5 w-3.5" /> Assessment result
          </div>
          {r?.completionBody ? (
            <p className="whitespace-pre-wrap text-sm text-foreground">{r.completionBody}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">Completion body not set.</p>
          )}
          {bands.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {bands.map((b, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="min-w-[3rem] rounded bg-background px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">≥ {b.score}%</span>
                  <span className="text-foreground">{b.feedback || <span className="italic text-muted-foreground">(no feedback)</span>}</span>
                  {b.allowRetry && <span className="text-muted-foreground">· retry</span>}
                </li>
              ))}
            </ul>
          )}
          {r?.assessmentId && (
            <div className="mt-2 text-[11px] text-muted-foreground">Bound to assessment id: <code>{r.assessmentId}</code></div>
          )}
        </div>
        {instruction}
      </div>
    );
  }

  return null;
}

// ── The block ────────────────────────────────────────────────────────────────

export const componentBlock = createReactBlockSpec(
  {
    type: 'sbComponent',
    propSchema: {
      kind: { default: 'text', values: COMPONENT_KINDS },
      title: { default: '' },
      adaptComponent: { default: 'text' },
      data: { default: '{}' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const kind = (COMPONENT_KINDS.includes(block.props.kind as ComponentKind) ? block.props.kind : 'text') as ComponentKind;
      const meta = META[kind];
      const [model, setModel] = useState<ComponentData>(() => parseData(kind, block.props.data as string));
      // ADAPT-3785: content already on the page opens in read-only Preview —
      // the author clicks "Edit" to reveal the editable fields, rather than
      // landing in edit mode every time the document loads. A brand-new,
      // still-blank component (just inserted) opens expanded instead.
      const [collapsed, setCollapsed] = useState(() => hasComponentContent(kind, model, block.props.title as string));
      const [source, setSource] = useState(false);
      const [dismissed, setDismissed] = useState(false);
      const title = block.props.title as string;

      const setData = (next: ComponentData) => {
        setModel(next);
        editor.updateBlock(block, { props: { data: JSON.stringify(next) } });
      };
      const setTitle = (t: string) => editor.updateBlock(block, { props: { title: t } });

      // AI is an ACTION: open the Samaritan popup seeded with this card's text.
      // Both Apply modes stay INSIDE this component (no new component is
      // created): Replace overwrites the content, Insert appends to it.
      const openAi = () => {
        storyboardActions.openAi({
          initialText: model.description || (model.items || []).map((i) => i.body).join('\n'),
          onReplace: (text) => setData({ ...model, description: text }),
          onInsert: (text) =>
            setData({ ...model, description: model.description ? `${model.description}\n\n${text}` : text }),
        });
      };

      // Comment is an ACTION attached to this component's block id (uses the
      // storyboardcomment backend; does NOT touch the course structure).
      const openComment = () => {
        storyboardActions.openComment({ blockId: block.id, label: `CONTENT · ${meta.badge.toUpperCase()}` });
      };

      const insertSuggestion = (k: ComponentKind) => {
        editor.insertBlocks([makeComponentBlock(k) as never], block, 'after');
      };

      if (collapsed) {
        return (
          <div className="group relative my-2 rounded-lg px-1 py-2 hover:bg-muted/20" contentEditable={false}>
            <ComponentPreview kind={kind} title={title} data={model} />
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-muted group-hover:opacity-100"
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
              <meta.Icon className="h-3 w-3" /> {meta.badge}
            </span>
            <input value={title} placeholder={`${meta.badge} title`} onKeyDown={stop} onChange={(e) => setTitle(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground" />
            <HeaderBtn onClick={() => setData({ ...model, showTitle: !model.showTitle })} active={model.showTitle} title="Show the title to learners">
              <Check className="h-3 w-3" /> Show title
            </HeaderBtn>
            <HeaderBtn onClick={() => {}} title="Change type in the Page Editor">
              <RefreshCw className="h-3 w-3" /> Replace
            </HeaderBtn>
            <HeaderBtn onClick={openAi} title="AI Assistance">
              <Sparkles className="h-3 w-3" /> AI
            </HeaderBtn>
            <HeaderBtn onClick={() => setSource((s) => !s)} active={source} title="Toggle source view">
              <Code className="h-3 w-3" /> Source
            </HeaderBtn>
            <HeaderBtn onClick={openComment} title="Comment on this component">
              <MessageSquare className="h-3 w-3" /> Comment
            </HeaderBtn>
            <HeaderBtn onClick={() => editor.removeBlocks([block])} title="Delete component">
              <Trash2 className="h-3 w-3" /> Delete
            </HeaderBtn>
            <HeaderBtn onClick={() => setCollapsed(true)} title="Collapse">
              <Check className="h-3 w-3" /> Done
            </HeaderBtn>
          </div>

          {/* Body */}
          {source ? (
            <textarea value={JSON.stringify(model, null, 2)} readOnly rows={6} className={`${inputCls} font-mono text-xs`} />
          ) : (
            <ComponentBody kind={kind} data={model} set={setData} />
          )}

          {/* Instruction */}
          <label className="mt-2 block">
            <span className={labelCls}>Instruction text (optional)</span>
            <input value={model.instruction} placeholder="e.g. Watch the video before continuing." onKeyDown={stop} onChange={(e) => setData({ ...model, instruction: e.target.value })} className={inputCls} />
          </label>

          {/* Suggested components */}
          {!dismissed && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-samaritan/30 bg-samaritan/5 px-2 py-1.5 text-xs">
              <span className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--samaritan)' }}>
                <Sparkles className="h-3 w-3" /> Suggested
              </span>
              {meta.suggest.map((k) => (
                <button key={k} type="button" onClick={() => insertSuggestion(k)} className="rounded-full border px-2 py-0.5 hover:bg-muted">
                  {META[k].badge}
                </button>
              ))}
              <button type="button" onClick={() => setDismissed(true)} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      );
    },
  }
);

export { LABEL_TO_KIND };
