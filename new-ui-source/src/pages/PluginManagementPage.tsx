import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { getPlugins } from "@/api/adaptAuthoring";
import AiAssistant from "@/components/common/AiAssistant";

type PluginStatus = "Enabled" | "Disabled";
type PluginCategory = "extensions" | "components" | "themes" | "menus";

interface Plugin {
  id: number;
  backendId?: string;   // engine _id (enable/disable contract still pending)
  name: string;
  description: string;
  version: string;
  author: string;
  category: PluginCategory;
  status: PluginStatus;
  installedDate: string;
}

const INITIAL_PLUGINS: Plugin[] = [
  { id: 1,  name: "Adapt Accordion",        description: "Collapsible accordion component for organising content into expandable sections.",         version: "3.2.1", author: "Adapt Learning",   category: "components", status: "Enabled",  installedDate: "12 Jan 2026" },
  { id: 2,  name: "Adapt Narrative",         description: "Step-by-step narrative component with image and text panels for guided learning paths.",    version: "5.1.0", author: "Adapt Learning",   category: "components", status: "Enabled",  installedDate: "12 Jan 2026" },
  { id: 3,  name: "Adapt MCQ",              description: "Multiple-choice question component with configurable feedback and scoring options.",          version: "7.0.2", author: "Adapt Learning",   category: "components", status: "Enabled",  installedDate: "12 Jan 2026" },
  { id: 4,  name: "Adapt Matching",         description: "Drag-and-drop matching question component for pairing related concepts.",                    version: "4.3.0", author: "Adapt Learning",   category: "components", status: "Enabled",  installedDate: "15 Jan 2026" },
  { id: 5,  name: "Adapt Media",            description: "Embeds video and audio content with full playback controls and transcript support.",         version: "6.1.1", author: "Adapt Learning",   category: "extensions", status: "Enabled",  installedDate: "20 Jan 2026" },
  { id: 6,  name: "H5P Integration",        description: "Integrates H5P interactive content types directly into Adapt courses.",                      version: "1.4.0", author: "Laerdal Labs",     category: "extensions", status: "Disabled", installedDate: "05 Feb 2026" },
  { id: 7,  name: "xAPI Analytics",         description: "Sends detailed xAPI statements to your LRS for advanced learner analytics and reporting.",   version: "2.0.3", author: "Laerdal Labs",     category: "extensions", status: "Enabled",  installedDate: "10 Feb 2026" },
  { id: 8,  name: "SCORM Analytics",        description: "Enhanced SCORM tracking with detailed completion and score reporting.",                       version: "3.5.0", author: "Community",        category: "extensions", status: "Disabled", installedDate: "18 Feb 2026" },
  { id: 9,  name: "Screen Reader Support",  description: "Enhances ARIA labels and keyboard navigation for improved screen reader compatibility.",     version: "1.1.0", author: "Laerdal Labs",     category: "themes", status: "Enabled",  installedDate: "22 Mar 2026" },
  { id: 10, name: "High Contrast Mode",     description: "Adds high contrast colour scheme toggle for users with low vision.",                         version: "1.0.2", author: "Community",        category: "themes", status: "Disabled", installedDate: "01 Apr 2026" },
  { id: 11, name: "Adapt Hotgraphic",       description: "Interactive image with clickable hotspots revealing additional information.",               version: "5.2.0", author: "Adapt Learning",   category: "menus", status: "Enabled",  installedDate: "05 Apr 2026" },
  { id: 12, name: "360° Image Viewer",      description: "Renders equirectangular images as interactive 360° panoramas within courses.",               version: "0.9.1", author: "Community",        category: "menus", status: "Disabled", installedDate: "15 May 2026" },
];

const CATEGORIES: PluginCategory[] = ["extensions", "components", "themes", "menus"];

type Toast = { id: number; message: string; type: "success" | "info" };

export default function PluginManagementPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);

  // Live list from the engine; graceful fallback to empty if unavailable.
  useEffect(() => { getPlugins().then(setPlugins).catch(() => setPlugins([])); }, []);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PluginCategory | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const showToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  function togglePlugin(id: number) {
    setPlugins((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = p.status === "Enabled" ? "Disabled" : "Enabled";
        showToast(`"${p.name}" ${next.toLowerCase()}`, next === "Enabled" ? "success" : "info");
        return { ...p, status: next };
      })
    );
  }

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plugins.filter((p) => {
      const matchSearch = q === "" || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.author.toLowerCase().includes(q);
      const matchCat = categoryFilter === null || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [plugins, search, categoryFilter]);

  const enabledCount = plugins.filter((p) => p.status === "Enabled").length;

  const CATEGORY_COLOURS: Record<PluginCategory, string> = {
    extensions: "bg-[#dbeafe] text-[#1e40af]",
    components: "bg-[#fef3c7] text-[#92400e]",
    themes: "bg-[#f3e8ff] text-[#6b21a8]",
    menus: "bg-[#dcfce7] text-[#166534]",
  };

  const CATEGORY_LABELS: Record<PluginCategory, string> = {
    extensions: "Extension",
    components: "Component",
    themes: "Theme",
    menus: "Menu",
  };

  return (
    <div className="px-4 sm:px-6 md:px-8 py-5 md:py-6">
      {/* Page heading */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#111827] leading-tight">Plugin Management</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            {enabledCount} of {plugins.length} plugins enabled
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Search */}
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setSearch(""); }}
            placeholder="Search plugins…"
            className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af] text-[#111827]"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto sm:ml-0" ref={filterRef}>
          {/* Category filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border rounded-lg transition-colors whitespace-nowrap ${
                categoryFilter
                  ? "border-[#2d6fa8] bg-[#dbeeff] text-[#2d6fa8] font-medium"
                  : "bg-white border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]"
              }`}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
              </svg>
              <span>{categoryFilter ? CATEGORY_LABELS[categoryFilter] : "Category"}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${filterOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {filterOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-20 py-1">
                <p className="px-3 py-1.5 text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Filter by category</p>
                {CATEGORIES.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setCategoryFilter(opt); setFilterOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                      categoryFilter === opt ? "bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"
                    }`}
                  >
                    {CATEGORY_LABELS[opt]}
                    {categoryFilter === opt && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-[#9ca3af] mb-3">{displayed.length} plugin{displayed.length !== 1 ? "s" : ""}</p>

      {/* Plugin list */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#9ca3af]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
            <path d="M11 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-5M16 4l4 4-8 8H8v-4l8-8z" />
          </svg>
          <p className="text-sm">No plugins found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayed.map((plugin) => (
            <div
              key={plugin.id}
              className={`bg-white border rounded-xl px-5 py-4 flex items-start gap-4 transition-colors ${
                plugin.status === "Disabled" ? "border-[#e5e7eb] opacity-60" : "border-[#e5e7eb] hover:border-[#cbd5e1]"
              }`}
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${plugin.status === "Enabled" ? "bg-[#dbeeff]" : "bg-[#f3f4f6]"}`}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={plugin.status === "Enabled" ? "#2d6fa8" : "#9ca3af"} strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-5M16 4l4 4-8 8H8v-4l8-8z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 2l4 4" />
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-[#111827]">{plugin.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLOURS[plugin.category]}`}>
                    {CATEGORY_LABELS[plugin.category]}
                  </span>
                  <span className="text-xs text-[#9ca3af]">v{plugin.version}</span>
                </div>
                <p className="text-xs text-[#6b7280] leading-relaxed mb-1">{plugin.description}</p>
                <p className="text-[11px] text-[#9ca3af]">
                  by {plugin.author} · installed {plugin.installedDate}
                </p>
              </div>

              {/* Toggle */}
              <div className="flex items-center gap-3 shrink-0 ml-2 mt-0.5">
                <span className={`text-xs font-medium ${plugin.status === "Enabled" ? "text-[#16a34a]" : "text-[#9ca3af]"}`}>
                  {plugin.status}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={plugin.status === "Enabled"}
                  onClick={() => togglePlugin(plugin.id)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2d6fa8] ${
                    plugin.status === "Enabled" ? "bg-[#2d6fa8]" : "bg-[#d1d5db]"
                  }`}
                  style={{ height: "22px", width: "40px" }}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${
                      plugin.status === "Enabled" ? "translate-x-[18px]" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AiAssistant context="Plugin Management" />

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto min-w-[260px] max-w-sm ${
              toast.type === "success" ? "bg-[#111827] text-white" : "bg-[#1e4d73] text-white"
            }`}
          >
            {toast.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#4ade80]">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#60a5fa]">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-white/60 hover:text-white transition-colors ml-1"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
