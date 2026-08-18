// Single source of truth for Storyboard ↔ Adapt component mapping (ADAPT-3760).
//
// Storyboard kind → ordered list of acceptable Adapt `_component` values. The
// FIRST candidate that is actually installed on the tenant (present in
// /api/componenttype) is used. There is deliberately NO "text" fallback: if a
// kind maps to no installed plugin it is reported as unsupported so the author
// can install it — we never silently persist the wrong component type.
//
// All `_component` strings are verbatim from the installed plugins' bower.json
// (audited 2026-08): note the odd casings — `textinput` (lowercase),
// `sentenceOrdering`, `laerdal-*`.

export type StoryboardComponentKind =
  | 'text'
  | 'groupedContent'
  | 'image'
  | 'video'
  | 'audio'
  | 'h5p'
  | 'laerdalForm'
  | 'mcq'
  | 'gmcq'
  | 'matching'
  | 'reorder'
  | 'textInput'
  | 'slider'
  | 'hotgraphic'
  | 'hotgrid'
  | 'actionplan'
  | 'instruction';

// Ordered candidate `_component` values per storyboard kind.
export const COMPONENT_CANDIDATES: Record<StoryboardComponentKind, string[]> = {
  text: ['text', 'laerdal-text'],
  groupedContent: ['accordion', 'laerdal-narrative', 'narrative'],
  image: ['graphic'],
  video: ['media', 'laerdal-media'],
  audio: ['media', 'laerdal-media'],
  h5p: ['laerdal-h5p', 'h5p'],
  laerdalForm: ['laerdal-form'],
  mcq: ['mcq'],
  gmcq: ['gmcq'],
  matching: ['matching'],
  reorder: ['sentenceOrdering'],
  textInput: ['textinput'],
  slider: ['slider'],
  hotgraphic: ['laerdal-hotgraphic', 'hotgraphic'],
  hotgrid: ['hotgrid'],
  actionplan: ['actionplan', 'laerdal-actionplan'],
  instruction: ['text', 'laerdal-text'],
};

// Resolve a storyboard kind to an installed Adapt `_component`, or null if none
// of its candidates are installed. `installed` is the set of `_component`
// values returned by /api/componenttype.
export function resolveAdaptComponent(
  kind: string,
  installed: Set<string>
): string | null {
  const candidates = COMPONENT_CANDIDATES[kind as StoryboardComponentKind];
  if (!candidates) return null;
  for (const c of candidates) if (installed.has(c)) return c;
  return null;
}

// Reverse: Adapt `_component` → storyboard kind (for reload / read-back). Media
// (`media`/`laerdal-media`) is ambiguous between image/video/audio and must be
// disambiguated from its `_media` fields by the caller — so it maps to a
// sentinel 'media' handled specially.
const REVERSE: Record<string, StoryboardComponentKind | 'media'> = {
  text: 'text',
  'laerdal-text': 'text',
  graphic: 'image',
  media: 'media',
  'laerdal-media': 'media',
  accordion: 'groupedContent',
  'laerdal-narrative': 'groupedContent',
  narrative: 'groupedContent',
  'laerdal-h5p': 'h5p',
  h5p: 'h5p',
  'laerdal-form': 'laerdalForm',
  mcq: 'mcq',
  gmcq: 'gmcq',
  matching: 'matching',
  sentenceOrdering: 'reorder',
  textinput: 'textInput',
  slider: 'slider',
  'laerdal-hotgraphic': 'hotgraphic',
  hotgraphic: 'hotgraphic',
  hotgrid: 'hotgrid',
  actionplan: 'actionplan',
  'laerdal-actionplan': 'actionplan',
};

export function reverseKind(component?: string): StoryboardComponentKind | 'media' | null {
  if (!component) return null;
  return REVERSE[component] ?? null;
}

export const ASSESSMENT_KINDS = new Set<string>(['mcq', 'gmcq', 'matching', 'reorder', 'textInput', 'slider']);
export const isAssessmentComponentKind = (k: string): boolean => ASSESSMENT_KINDS.has(k);
