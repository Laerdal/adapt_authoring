import { useEffect, useMemo, useState } from "react";
import {
  getAvailableComponents,
  type ComponentTypeOption,
} from "../../api/adaptAuthoring";
import { StructureIcon, STRUCTURE_ICON_COLOR_CLASS } from "./StructureIcons";

// Category grouping for the picker, matching the spec's 4 groups. Unknown
// component keys fall into "Other" (a safety net, not one of the spec's own
// groups) so an installed component this map doesn't recognise still shows
// up somewhere instead of silently disappearing. Keyed by the engine
// `_component` name (lower-cased) — verified against each plugin's own
// bower.json `component` field in the sibling adapt-framework-plugins repo
// where possible; core Adapt framework contrib components (text, graphic,
// mcq, narrative, hotgraphic, slider, etc.) aren't in that repo at all, so
// their keys follow the community's standard naming convention.
//
// IMPORTANT: every key here MUST be all-lowercase. categoryOf() always does
// `key.toLowerCase()` before looking it up, so a mixed-case key (e.g. a
// bower.json `component` value with camelCase, like "lottieInteractivity")
// silently never matches and the component falls through to "Other" with no
// error — confirmed as a real mistake made twice when adding new entries.
const CATEGORY_BY_COMPONENT: Record<string, string> = {
  // Content — presenting information, media, or embedded content.
  text: "Content",
  graphic: "Content",
  image: "Content",
  media: "Content",
  video: "Content",
  audio: "Content",
  code: "Content",
  blank: "Content",
  "laerdal-imageslider": "Content", // adapt-laerdal-image-slider
  "laerdal-iframe": "Content",
  "animation-frame": "Content", // adapt-laerdal-animation-frame
  "manifest": "Content", // adapt-laerdal-lottie
  "laerdal-media-playlist": "Content", // adapt-laerdal-lottie
  "laerdal-text": "Content", // adapt-laerdal-lottie
  "laerdal-media": "Content", // adapt-laerdal-quiz
  "talk": "Content", // adapt-laerdal-quiz

  // Interactive — requires learner interaction to explore/reveal information.
  accordion: "Interactive",
  narrative: "Interactive",
  "laerdal-narrative": "Interactive",
  hotgraphic: "Interactive", // core adapt-contrib-hotgraphic ("Hot Graphic")
  "laerdal-hotgraphic": "Interactive", // adapt-laerdal-hotgraphic ("Laerdal Hot Graphic")
  hotgrid: "Interactive",
  "laerdal-h5p": "Interactive",
  tabs: "Interactive",
  reveal: "Interactive",
  "laerdal-flipcard": "Interactive",
  "laerdal-tabs": "Interactive",
  "actionplan": "Interactive",
  "laerdal-lottieinteractivity": "Interactive",
  "cards": "Interactive",

  // Questions — capturing or evaluating a learner response.
  mcq: "Questions",
  gmcq: "Questions",
  matching: "Questions",
  sentenceordering: "Questions", // adapt-laerdal-sentenceOrdering
  slider: "Questions",
  assessmentresults: "Questions", // core adapt-contrib-assessmentResults
  diagnosticresults: "Questions", // adapt-diagnosticResults
  "laerdal-slider": "Questions",
  textinput: "Questions",
  "draganddropzone": "Questions",
  "laerdal-checklist": "Questions",

  // Survey — collecting learner feedback/input that isn't assessment-based.
  "laerdal-user-feedback": "Survey",
  "laerdal-form": "Survey",
};

// Fallback for components whose exact engine key isn't confirmed above —
// matched against a normalized (lower-cased, non-alphanumeric stripped)
// displayName substring, since that's more likely to stay stable across
// plugin versions than guessing the internal `_component` string.
const CATEGORY_BY_DISPLAY_NAME_CONTAINS: Array<{ needle: string; category: string }> = [
  { needle: "imageslider", category: "Content" },
  { needle: "assessmentresults", category: "Questions" },
];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Content: "For presenting information, media, or embedded content.",
  Interactive: "For content that requires learner interaction to explore or reveal information.",
  Questions: "For capturing or evaluating a learner response.",
  Survey: "For collecting learner feedback or input that isn't primarily assessment-based.",
};

const CATEGORY_ORDER = ["Content", "Interactive", "Questions", "Survey", "Other"];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Normalizes CATEGORY_BY_COMPONENT's own keys to lowercase once, so a
// contributor accidentally typing a mixed-case key there (has happened twice)
// still works instead of silently falling through to "Other".
const NORMALIZED_CATEGORY_BY_COMPONENT: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_BY_COMPONENT).map(([key, category]) => [key.toLowerCase(), category])
);

function categoryOf(key: string, displayName: string): string {
  const byKey = NORMALIZED_CATEGORY_BY_COMPONENT[key.toLowerCase()];
  if (byKey) return byKey;
  const normalizedName = normalize(displayName);
  const match = CATEGORY_BY_DISPLAY_NAME_CONTAINS.find((m) => normalizedName.includes(m.needle));
  return match ? match.category : "Other";
}

interface AddComponentDrawerProps {
  onSelect: (componentType: ComponentTypeOption) => void;
  onClose: () => void;
}

export default function AddComponentDrawer({ onSelect, onClose }: AddComponentDrawerProps) {
  const [components, setComponents] = useState<ComponentTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getAvailableComponents();
        if (!cancelled) setComponents(list);
      } catch {
        if (!cancelled) setError("Failed to load components.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    // Animate in.
    const t = setTimeout(() => setOpen(true), 20);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keyup", onKey);
    return () => document.removeEventListener("keyup", onKey);
  }, [onClose]);

  // Filter + group by category.
  const grouped = useMemo(() => {
    const term = search.toLowerCase().trim();
    const filtered = components.filter((c) => {
      if (!term) return true;
      return (
        c.displayName.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term) ||
        c.component.toLowerCase().includes(term)
      );
    });
    const groups: Record<string, ComponentTypeOption[]> = {};
    for (const c of filtered) {
      const cat = categoryOf(c.component, c.displayName);
      (groups[cat] ||= []).push(c);
    }
    return CATEGORY_ORDER.filter((cat) => groups[cat]?.length).map((cat) => ({
      category: cat,
      items: groups[cat],
    }));
  }, [components, search]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`relative h-full w-[360px] max-w-[90vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Add Component"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#e5e7eb] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Add Component</h2>
            <p className="text-xs text-[#6b7280] mt-0.5">Select a component type</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[#e5e7eb] shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search components…"
              aria-label="Search components"
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-[#6b7280] py-10">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              </svg>
              Loading components…
            </div>
          ) : error ? (
            <p className="text-sm text-[#991b1b] px-2 py-4">{error}</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-[#9ca3af] px-2 py-4">No components available.</p>
          ) : (
            grouped.map(({ category, items }) => (
              <div key={category} className="mb-4">
                <div className="px-2 pb-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">
                    {category}
                  </p>
                  {CATEGORY_DESCRIPTIONS[category] && (
                    <p className="mt-0.5 text-[11px] normal-case tracking-normal text-[#9ca3af]">
                      {CATEGORY_DESCRIPTIONS[category]}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  {items.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => onSelect(c)}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[#f0f7ff] text-left transition-colors group"
                    >
                      <span className="shrink-0 w-9 h-9 rounded-lg bg-[#eef2f7] flex items-center justify-center">
                        <StructureIcon
                          level="component"
                          size={16}
                          className={STRUCTURE_ICON_COLOR_CLASS.component}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[#111827] truncate">{c.displayName}</span>
                        {c.description && (
                          <span className="block text-xs text-[#6b7280] truncate">{c.description}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
