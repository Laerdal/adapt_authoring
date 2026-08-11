import { useEffect, useMemo, useState } from "react";
import {
  getTemplates,
  type DashboardTemplate,
  type TemplateScope,
  type TemplateType,
} from "../../api/adaptAuthoring";
import { StructureIcon, STRUCTURE_ICON_COLOR_CLASS } from "./StructureIcons";

type TemplateLevel = "topic" | "section" | "group" | "component";

const LEVEL_TO_TEMPLATE_TYPE: Record<TemplateLevel, TemplateType> = {
  topic: "Page",
  section: "Article",
  group: "Block",
  component: "Component",
};

const LEVEL_LABEL: Record<TemplateLevel, string> = {
  topic: "topic",
  section: "section",
  group: "content group",
  component: "component",
};

const LEVEL_ICON_PROPS: Record<TemplateLevel, { level: "topic" | "section" | "contentGroup" | "component"; className: string }> = {
  topic: { level: "topic", className: STRUCTURE_ICON_COLOR_CLASS.topic },
  section: { level: "section", className: STRUCTURE_ICON_COLOR_CLASS.section },
  group: { level: "contentGroup", className: STRUCTURE_ICON_COLOR_CLASS.contentGroup },
  component: { level: "component", className: STRUCTURE_ICON_COLOR_CLASS.component },
};

interface AddTemplateDrawerProps {
  level: TemplateLevel;
  onSelect: (template: DashboardTemplate) => Promise<void> | void;
  onClose: () => void;
}

export default function AddTemplateDrawer({ level, onSelect, onClose }: AddTemplateDrawerProps) {
  const [scope, setScope] = useState<TemplateScope>("mine");
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const expectedType = LEVEL_TO_TEMPLATE_TYPE[level];
  const iconProps = LEVEL_ICON_PROPS[level];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await getTemplates(scope);
        if (!cancelled) setTemplates(result);
      } catch {
        if (!cancelled) {
          setTemplates([]);
          setError("Failed to load templates.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scope]);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keyup", onKey);
    return () => document.removeEventListener("keyup", onKey);
  }, [onClose]);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (template.type !== expectedType) return false;
      if (!term) return true;

      return (
        template.name.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term) ||
        template.author.toLowerCase().includes(term)
      );
    });
  }, [templates, expectedType, search]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />

      <div
        className={`relative h-full w-[380px] max-w-[92vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Use Template"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#e5e7eb] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Use Template</h2>
            <p className="text-xs text-[#6b7280] mt-0.5">Select a {LEVEL_LABEL[level]} template</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-3 pb-2 border-b border-[#e5e7eb] shrink-0">
          <div className="inline-flex items-center rounded-lg border border-[#d1d5db] p-0.5 bg-[#f8fafc]">
            <button
              type="button"
              onClick={() => setScope("mine")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                scope === "mine"
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#6b7280] hover:text-[#374151]"
              }`}
            >
              My templates
            </button>
            <button
              type="button"
              onClick={() => setScope("shared")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                scope === "shared"
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#6b7280] hover:text-[#374151]"
              }`}
            >
              Shared templates
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-[#e5e7eb] shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search templates..."
              aria-label="Search templates"
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-[#6b7280] py-10">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              </svg>
              Loading templates...
            </div>
          ) : error ? (
            <p className="text-sm text-[#991b1b] px-2 py-4">{error}</p>
          ) : filteredTemplates.length === 0 ? (
            <p className="text-sm text-[#9ca3af] px-2 py-4">No matching templates found.</p>
          ) : (
            <div className="space-y-1">
              {filteredTemplates.map((template) => {
                const isApplying = submittingId === template.backendId;
                return (
                  <button
                    key={template.backendId}
                    type="button"
                    disabled={!!submittingId}
                    onClick={async () => {
                      try {
                        setSubmittingId(template.backendId);
                        await onSelect(template);
                      } finally {
                        setSubmittingId(null);
                      }
                    }}
                    className="w-full flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-[var(--life-primary-020)] text-left transition-colors disabled:opacity-60"
                  >
                    <span className="mt-0.5 shrink-0 w-8 h-8 rounded-[8px] bg-[var(--life-neutral-050)] flex items-center justify-center">
                      <StructureIcon level={iconProps.level} size={14} className={iconProps.className} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[#111827] truncate">{template.name}</span>
                      {template.description ? (
                        <span className="block text-xs text-[#6b7280] truncate">{template.description}</span>
                      ) : null}
                      {template.author ? (
                        <span className="block text-[11px] text-[#9ca3af] truncate">by {template.author}</span>
                      ) : null}
                    </span>
                    {isApplying ? (
                      <span className="text-[11px] text-[#6b7280] shrink-0">Adding...</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
