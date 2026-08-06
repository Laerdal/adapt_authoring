import { useEffect, useState, useCallback, useRef } from "react";
import { saveThemeForCourse, saveThemeVariables, getThemePresets, saveThemePreset, applyThemePreset, getThemePresetParentTheme, renameThemePreset, deleteThemePreset, type ThemePreset } from "../../api/adaptAuthoring";
import { UnsavedChangesModal } from "./unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";

// Extracted from SetupPage to keep select-theme feature isolated with no behavior changes.

/* Theme panel helpers */
const THEMES = [
  {
    id: "life",
    name: "LIFE Theme",
    description: "Use the pre-designed LIFE theme with standardized branding and layout",
    swatches: ["#1b3a4b", "#2d6a8f", "#dbeeff"],
  },
  {
    id: "custom",
    name: "Custom Theme",
    description: "Create your own custom theme with personalized colors and branding",
    swatches: ["#7c6fcd", "#5aad78", "#e06c4a"],
  },
  {
    id: "vanilla",
    name: "Vanilla Theme",
    description: "A clean, minimal theme with neutral tones and no preset branding",
    swatches: ["#f5f5f0", "#e8e4d4", "#c8c0a0"],
  },
];

const FONT_OPTIONS = [
  "Lato", "Georgia", "Helvetica Neue", "Inter", "Merriweather",
  "Montserrat", "Open Sans", "Poppins", "Roboto", "Source Sans Pro",
];

const PAGE_TITLE_OPTIONS = ["H1", "H2", "H3", "H4", "H5", "H6", "Paragraph"];

const PAGE_TITLE_LABELS: Record<string, string> = {
  H1: "H1 - 3.5rem", H2: "H2 - 3rem", H3: "H3 - 2.5rem",
  H4: "H4 - 2rem", H5: "H5 - 1.5rem", H6: "H6 - -",
  Paragraph: "Paragraph - 1.125rem",
};

const PREVIEW_TITLE_SIZE: Record<string, string | null> = {
  H1: "1.7rem", H2: "1.45rem", H3: "1.25rem",
  H4: "1.1rem", H5: "1rem", H6: null,
  Paragraph: "0.95rem",
};

const CALC_VALUES = [
  { label: "H1 (Page Title)", rem: "3.5rem", px: "56px" },
  { label: "H2", rem: "3rem", px: "48px" },
  { label: "H3", rem: "2.5rem", px: "40px" },
  { label: "H4", rem: "2rem", px: "32px" },
  { label: "H5", rem: "1.5rem", px: "24px" },
  { label: "Paragraph", rem: "1.125rem", px: "18px" },
];

function DesktopCalculatedValues() {
  return (
    <div className="mt-2 px-4 py-3 text-xs text-[var(--life-neutral-500)] space-y-0.5 bg-[var(--life-primary-020)] border-l-4 border-[var(--life-primary-500)]">
      <p className="font-semibold text-[var(--life-base-black)] mb-1">Calculated values for Desktop:</p>
      {CALC_VALUES.map((s) => (
        <p key={s.label}><span className="font-semibold">{s.label}:</span> {s.rem} ({s.px})</p>
      ))}
    </div>
  );
}

const H1_SIZE_OPTIONS = [
  { label: "H1 - 3.5rem", value: "3.5rem" },
  { label: "H2 - 3rem",   value: "3rem" },
  { label: "H3 - 2.5rem", value: "2.5rem" },
  { label: "H4 - 2rem",   value: "2rem" },
  { label: "H5 - 1.5rem", value: "1.5rem" },
  { label: "H6 - -",      value: "h6" },
  { label: "Paragraph - 1.125rem", value: "1.125rem" },
];

type CustomThemeValues = {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  paragraphFont: string;
  fontColor: string;
  headingFontColor: string;
  instructionColor: string;
  linkFontColor: string;
  pageTitleSize: string;
};

const DEFAULT_CUSTOM: CustomThemeValues = {
  primaryColor: "#4a90a4",
  secondaryColor: "#3a8a7a",
  headingFont: "Lato",
  paragraphFont: "Lato",
  fontColor: "#111111",
  headingFontColor: "#111111",
  instructionColor: "#111111",
  linkFontColor: "#4a90a4",
  pageTitleSize: "3.5rem",
};

/* colour swatch picker row */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#374151] flex items-center gap-1">
        {label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <label className="w-11 h-11 rounded-lg border-2 border-[#e5e7eb] overflow-hidden cursor-pointer hover:border-[var(--life-primary-500)] transition-colors block">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} title={label} className="w-full h-full opacity-0 absolute" />
        <span className="w-full h-full block rounded-md" style={{ backgroundColor: value }} />
      </label>
    </div>
  );
}

/* font dropdown */
function FontSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#374151] flex items-center gap-1">
        {label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          title={label}
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[#111827] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent pr-8"
        >
          {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

/* accordion wrapper */
function Accordion({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#e5e7eb] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-[#f9fafb] transition-colors"
      >
        <div className="flex items-center gap-2.5 text-sm font-semibold text-[#111827]">
          <span className="text-[#6b7280]">{icon}</span>
          {title}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-[22px] py-[20px] border-t border-[#f3f4f6] bg-white">{children}</div>}
    </div>
  );
}

/* live preview pane */
function ThemePreview({ cfg }: { cfg: CustomThemeValues }) {
  const headingStyle = { fontFamily: cfg.headingFont, color: cfg.headingFontColor };
  const bodyStyle    = { fontFamily: cfg.paragraphFont, color: cfg.fontColor };
  const h1Size = cfg.pageTitleSize === "h6" ? "1rem" : cfg.pageTitleSize;

  return (
    <div className="flex flex-col h-full bg-[#f0f4f8]">
      {/* preview header */}
      <div className="h-10 bg-white border-b border-[#e5e7eb] flex items-center justify-between px-4 shrink-0">
        <span className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill={cfg.primaryColor} stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Live Preview
        </span>
        <div className="flex items-center gap-1.5">
          <button type="button" title="Toggle dark mode" aria-label="Toggle dark mode" className="p-1.5 rounded-lg border border-[#e5e7eb] hover:bg-[#f3f4f6] transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
          <button type="button" title="Expand preview" aria-label="Expand preview" className="p-1.5 rounded-lg border border-[#e5e7eb] hover:bg-[#f3f4f6] transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
      </div>

      {/* simulated course shell */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white rounded-xl border border-[#e5e7eb] overflow-hidden shadow-sm">
          {/* progress bar */}
          <div className="h-1" style={{ backgroundColor: cfg.primaryColor }} />

          {/* course nav bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f3f4f6]" style={{ backgroundColor: cfg.primaryColor }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span className="text-xs text-white flex-1" style={{ fontFamily: cfg.headingFont }}>New Course Title / New Menu/Page Title</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>

          <div className="p-4">
            {/* page title */}
            <h1 className="font-bold mb-3" style={{ ...headingStyle, fontSize: h1Size }}>{cfg.pageTitleSize === "h6" ? "-" : "New Menu/Page Title"}</h1>

            {/* article block */}
            <div className="border border-[#e5e7eb] rounded-lg p-3 mb-3">
              <h2 className="font-semibold text-sm mb-1" style={headingStyle}>New Article Title</h2>
              <div className="border border-[#e5e7eb] rounded-md p-3">
                <h3 className="font-semibold text-xs mb-1" style={headingStyle}>New Block Title</h3>
                <div className="border border-[#e5e7eb] rounded p-3">
                  <p className="font-semibold text-xs mb-1" style={headingStyle}>New Component Title</p>
                  <p className="text-xs mb-1" style={bodyStyle}>Body text</p>
                  <a href="#" className="text-xs underline block mb-1" style={{ color: cfg.linkFontColor, fontFamily: cfg.paragraphFont }}>This is a sample link</a>
                  <p className="text-xs italic mb-3" style={{ color: cfg.instructionColor, fontFamily: cfg.paragraphFont }}>Choose one option then select Submit.</p>

                  {/* MCQ */}
                  <div className="space-y-2 mb-3">
                    {["Correct", "Incorrect"].map((opt, i) => (
                      <div key={opt} className="flex items-center gap-2 border border-[#e5e7eb] rounded-md px-3 py-2" style={{ backgroundColor: i === 0 ? cfg.secondaryColor + "22" : "" }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.secondaryColor }}>
                          {i === 0 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <span className="text-xs" style={bodyStyle}>{opt}</span>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="px-4 py-1.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: cfg.primaryColor, fontFamily: cfg.paragraphFont }}>Submit</button>
                </div>
              </div>
            </div>

            {/* nav buttons */}
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" className="px-4 py-1.5 rounded text-xs font-medium border" style={{ borderColor: cfg.primaryColor, color: cfg.primaryColor, fontFamily: cfg.paragraphFont }}>Previous</button>
              <button type="button" className="px-4 py-1.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: cfg.primaryColor, fontFamily: cfg.paragraphFont }}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Global Theme accordion content */
function GlobalThemeSection({ cfg, setCfg }: { cfg: CustomThemeValues; setCfg: (v: CustomThemeValues) => void }) {
  const set = <K extends keyof CustomThemeValues>(k: K, v: CustomThemeValues[K]) => setCfg({ ...cfg, [k]: v });

  const calcSizes = () => {
    const base = cfg.pageTitleSize === "h6" ? null : parseFloat(cfg.pageTitleSize);
    if (!base) return null;
    return [
      { label: "H1 (Page Title)", size: base, px: Math.round(base * 16) },
      { label: "H2", size: +(base - 0.5).toFixed(1), px: Math.round((base - 0.5) * 16) },
      { label: "H3", size: +(base - 1).toFixed(1), px: Math.round((base - 1) * 16) },
      { label: "H4", size: +(base - 1.5).toFixed(1), px: Math.round((base - 1.5) * 16) },
      { label: "H5", size: +(base - 2).toFixed(1), px: Math.round((base - 2) * 16) },
      { label: "Paragraph", size: 1.125, px: 18 },
    ];
  };

  const sizes = calcSizes();

  return (
    <div className="space-y-5 mt-4">
      {/* colours row 1 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <ColorField label="Primary colour" value={cfg.primaryColor} onChange={(v) => set("primaryColor", v)} />
        <ColorField label="Secondary colour" value={cfg.secondaryColor} onChange={(v) => set("secondaryColor", v)} />
      </div>
      {/* fonts */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <FontSelect label="Heading font" value={cfg.headingFont} onChange={(v) => set("headingFont", v)} />
        <FontSelect label="Paragraph font" value={cfg.paragraphFont} onChange={(v) => set("paragraphFont", v)} />
      </div>
      {/* font colours */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <ColorField label="Font colour" value={cfg.fontColor} onChange={(v) => set("fontColor", v)} />
        <ColorField label="Heading font colour" value={cfg.headingFontColor} onChange={(v) => set("headingFontColor", v)} />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <ColorField label="Instruction colour" value={cfg.instructionColor} onChange={(v) => set("instructionColor", v)} />
        <ColorField label="Link font colour" value={cfg.linkFontColor} onChange={(v) => set("linkFontColor", v)} />
      </div>
      {/* page title size */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[#374151] flex items-center gap-1">
          Page Title Size (H1)
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <button type="button" onClick={() => set("pageTitleSize", DEFAULT_CUSTOM.pageTitleSize)} title="Reset" className="ml-1 text-[#9ca3af] hover:text-[#6b7280]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
            </svg>
          </button>
        </span>
        <div className="relative max-w-xs">
          <select
            value={cfg.pageTitleSize}
            onChange={(e) => set("pageTitleSize", e.target.value)}
            aria-label="Page Title Size (H1)"
            title="Page Title Size (H1)"
            className="w-full border-2 border-[var(--life-primary-500)] rounded-lg px-3 py-2.5 text-sm text-[#111827] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] pr-8"
          >
            {H1_SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        {sizes && <DesktopCalculatedValues />}
      </div>
    </div>
  );
}

/* Custom theme full editor */
function CustomThemeEditor({ onBack }: { onBack: () => void }) {
  const [cfg, setCfg] = useState<CustomThemeValues>(DEFAULT_CUSTOM);

  const [componentConfig, setComponentConfig] = useState({
    markingNotFinal: false,
    markingUnansweredCorrect: false,
    hideFeedbackFirstAttempt: false,
    hidePartiallyCorrect: false,
  });

  const toggleConfig = (key: keyof typeof componentConfig) =>
    setComponentConfig((prev) => ({ ...prev, [key]: !prev[key] }));

  const ACCORDIONS = [
    {
      id: "global",
      title: "Global Theme",
      defaultOpen: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      ),
      content: <GlobalThemeSection cfg={cfg} setCfg={setCfg} />,
    },
    {
      id: "page",
      title: "Page Structure",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Page structure options coming soon.</div>,
    },
    {
      id: "progress",
      title: "Progress Styling",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Progress styling options coming soon.</div>,
    },
    {
      id: "navigation",
      title: "Navigation Styling",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Navigation styling options coming soon.</div>,
    },
    {
      id: "menu",
      title: "Menu Styling",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Menu styling options coming soon.</div>,
    },
    {
      id: "feedback",
      title: "Feedback & Validation",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Feedback & validation options coming soon.</div>,
    },
    {
      id: "overlays",
      title: "Overlays Styling",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        </svg>
      ),
      content: <div className="pt-4 text-sm text-[#9ca3af] italic">Overlays styling options coming soon.</div>,
    },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* left: accordion editor */}
      <div className="w-1/2 h-full overflow-y-auto border-r border-[#e5e7eb] bg-white">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#f3f4f6] shrink-0">
          <button type="button" onClick={onBack} className="text-xs text-[var(--life-primary-500)] hover:underline flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Theme
          </button>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          <span className="text-xs text-[#374151] font-medium">Custom Theme</span>
        </div>
        {/* Custom Icons: Sprite Sheets */}
        <div className="px-5 pt-4 pb-5 border-b border-[#f3f4f6]">
          <p className="text-xs font-semibold text-[#374151] mb-1">Custom Icons: Sprite Sheets</p>
          <p className="text-xs text-[#6b7280] mb-3 leading-relaxed">Upload an SVG sprite sheet to replace default icons across the course.</p>
          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-[#d1d5db] rounded-xl cursor-pointer hover:border-[var(--life-primary-500)] hover:bg-[var(--life-primary-020)] transition-colors group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[var(--life-primary-500)] transition-colors mb-1">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span className="text-xs text-[#6b7280] group-hover:text-[var(--life-primary-500)] transition-colors">Click to upload sprite sheet (.svg)</span>
            <input type="file" accept=".svg" aria-label="Upload SVG sprite sheet" className="hidden" />
          </label>
        </div>

        {/* Custom Icons: Single Icons */}
        <div className="px-5 pt-4 pb-5 border-b border-[#f3f4f6]">
          <p className="text-xs font-semibold text-[#374151] mb-1">Custom Icons: Single Icons</p>
          <p className="text-xs text-[#6b7280] mb-3 leading-relaxed">Upload individual SVG icon files to override specific icons in the course.</p>
          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-[#d1d5db] rounded-xl cursor-pointer hover:border-[var(--life-primary-500)] hover:bg-[var(--life-primary-020)] transition-colors group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[var(--life-primary-500)] transition-colors mb-1">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span className="text-xs text-[#6b7280] group-hover:text-[var(--life-primary-500)] transition-colors">Click to upload icons (.svg)</span>
            <input type="file" accept=".svg" multiple aria-label="Upload single SVG icons" className="hidden" />
          </label>
        </div>

        {/* Configuration: Component */}
        <div className="px-5 pt-4 pb-5 border-b border-[#f3f4f6]">
          <p className="text-xs font-semibold text-[#374151] mb-0.5">Configuration: Component</p>
          <p className="text-xs text-[#6b7280] mb-3 leading-relaxed">Component-level behavior and feedback configuration.</p>
          <div className="space-y-1">
            {(
              [
                { key: "markingNotFinal",          label: "Display marking for not-final attempts" },
                { key: "markingUnansweredCorrect",  label: "Display marking for unanswered correct responses" },
                { key: "hideFeedbackFirstAttempt",  label: "Hide feedback on first attempt on assessments" },
                { key: "hidePartiallyCorrect",      label: "Hide partially correct feedback on the question and result page" },
              ] as { key: keyof typeof componentConfig; label: string }[]
            ).map(({ key, label }) => (
              <label key={key} className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-[#f9fafb] cursor-pointer group">
                <div
                  onClick={() => toggleConfig(key)}
                  className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${
                    componentConfig[key] ? "bg-[var(--life-primary-500)] border-[var(--life-primary-500)]" : "border-[#d1d5db] bg-white group-hover:border-[var(--life-primary-300)]"
                  }`}
                >
                  {componentConfig[key] && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#374151] leading-snug">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Accordions */}
        <div className="px-4 pb-6 space-y-2 mt-3">
          {ACCORDIONS.map((a) => (
            <Accordion key={a.id} title={a.title} icon={a.icon} defaultOpen={a.defaultOpen}>
              {a.content}
            </Accordion>
          ))}
        </div>
      </div>

      {/* right: live preview */}
      <div className="w-1/2 h-full overflow-hidden">
        <ThemePreview cfg={cfg} />
      </div>
    </div>
  );
}

/* Theme selection panel */
function normalizeName(v?: string): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapThemeNameToId(themeName?: string): string | null {
  const n = normalizeName(themeName);
  if (!n) return null;
  if (n.includes("life")) return "life";
  if (n.includes("vanilla")) return "vanilla";
  if (n.includes("custom")) return "custom";
  return null;
}

type CustomFieldDef = {
  key: string;
  label: string;
  inputType: 'color' | 'select';
  options?: { value: string; label: string }[];
};

type CustomSectionDef = {
  id: string;
  label: string;
  fields: CustomFieldDef[];
};

const CUSTOM_SELECT_PADDING_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'double', label: 'Double' },
  { value: 'half', label: 'Half' },
  { value: 'remove', label: 'Remove' },
];

const CUSTOM_SELECT_PAGE_TITLE_SIZE_OPTIONS = [
  { value: '3.5rem', label: '3.5rem' },
  { value: '3rem', label: '3rem (Default)' },
  { value: '2.5rem', label: '2.5rem' },
  { value: '2.25rem', label: '2.25rem' },
];

const CUSTOM_ACCORDION_DEFS: CustomSectionDef[] = [
  {
    id: '_global',
    label: 'Global Theme',
    fields: [
      { key: '_primaryBrandColor', label: 'Primary colour', inputType: 'color' },
      { key: '_secondaryBrandColor', label: 'Secondary colour', inputType: 'color' },
      { key: 'heading-font-family', label: 'Heading font', inputType: 'select', options: FONT_OPTIONS.map((font) => ({ value: font, label: font })) },
      { key: 'paragraph-font-family', label: 'Paragraph font', inputType: 'select', options: FONT_OPTIONS.map((font) => ({ value: font, label: font })) },
      { key: 'font-color', label: 'Font colour', inputType: 'color' },
      { key: 'heading-color', label: 'Heading font colour', inputType: 'color' },
      { key: 'instruction-color', label: 'Instruction colour', inputType: 'color' },
      { key: 'link', label: 'Link font colour', inputType: 'color' },
      { key: 'page-heading-font-size', label: 'Page Title Size (H1)', inputType: 'select', options: CUSTOM_SELECT_PAGE_TITLE_SIZE_OPTIONS },
    ],
  },
  {
    id: '_pageStructure',
    label: 'Page Structure',
    fields: [
      { key: 'page-bg-color', label: 'Page background', inputType: 'color' },
      { key: 'article-bg-color', label: 'Article background', inputType: 'color' },
      { key: 'block-bg-color', label: 'Block background', inputType: 'color' },
      { key: 'component-bg-color', label: 'Component background', inputType: 'color' },
      { key: 'page-header-background-color', label: 'Page header background colour', inputType: 'color' },
      { key: 'page-header-title-color', label: 'Page header title colour', inputType: 'color' },
      { key: 'page-header-subtitle-color', label: 'Page header subtitle colour', inputType: 'color' },
      { key: 'page-header-body-color', label: 'Page header body colour', inputType: 'color' },
      { key: 'page-header-instruction-color', label: 'Page header instruction colour', inputType: 'color' },
      { key: 'article-top-padding', label: 'Article top padding', inputType: 'select', options: CUSTOM_SELECT_PADDING_OPTIONS },
      { key: 'article-bottom-padding', label: 'Article bottom padding', inputType: 'select', options: CUSTOM_SELECT_PADDING_OPTIONS },
      { key: 'block-top-padding', label: 'Block top padding', inputType: 'select', options: CUSTOM_SELECT_PADDING_OPTIONS },
      { key: 'block-bottom-padding', label: 'Block bottom padding', inputType: 'select', options: CUSTOM_SELECT_PADDING_OPTIONS },
    ],
  },
  {
    id: '_validation',
    label: 'Feedback & Validation',
    fields: [
      { key: 'validation-success', label: 'Validation success colour', inputType: 'color' },
      { key: 'validation-error', label: 'Validation error colour', inputType: 'color' },
    ],
  },
  {
    id: '_progress',
    label: 'Progress Styling',
    fields: [
      { key: 'progress', label: 'Progress fill colour', inputType: 'color' },
      { key: 'progress-inverted', label: 'Progress background colour', inputType: 'color' },
      { key: 'progress-border', label: 'Progress border colour', inputType: 'color' },
    ],
  },
  {
    id: '_menu',
    label: 'Menu Styling',
    fields: [
      { key: 'menu-header-background-color', label: 'Menu header background colour', inputType: 'color' },
      { key: 'menu-item', label: 'Menu item colour', inputType: 'color' },
      { key: 'menu-item-progress', label: 'Menu item progress fill colour', inputType: 'color' },
    ],
  },
  {
    id: '_nav',
    label: 'Navigation Styling',
    fields: [
      { key: 'nav', label: 'Navigation background colour', inputType: 'color' },
      { key: 'nav-progress', label: 'Navigation progress fill colour', inputType: 'color' },
    ],
  },
  {
    id: '_notify',
    label: 'Overlays Styling',
    fields: [
      { key: 'notify', label: 'Notify background colour', inputType: 'color' },
      { key: 'drawer', label: 'Drawer background colour', inputType: 'color' },
      { key: 'notify-title-color', label: 'Notify title colour', inputType: 'color' },
    ],
  },
];

const CUSTOM_FIELD_DEFAULTS: Record<string, string> = {
  '_global::_primaryBrandColor': '#2e7fa1',
  '_global::_secondaryBrandColor': '#25837e',
  '_global::heading-font-family': 'Lato',
  '_global::paragraph-font-family': 'Lato',
  '_global::font-color': '#1f1f1f',
  '_global::heading-color': '#333333',
  '_global::instruction-color': '#1f1f1f',
  '_global::link': '#2e7fa1',
  '_global::page-heading-font-size': '3rem',
  '_pageStructure::page-bg-color': '',
  '_pageStructure::article-bg-color': '',
  '_pageStructure::block-bg-color': '',
  '_pageStructure::component-bg-color': '',
  '_pageStructure::page-header-background-color': '',
  '_pageStructure::page-header-title-color': '',
  '_pageStructure::page-header-subtitle-color': '',
  '_pageStructure::page-header-body-color': '',
  '_pageStructure::page-header-instruction-color': '',
  '_pageStructure::article-top-padding': 'standard',
  '_pageStructure::article-bottom-padding': 'standard',
  '_pageStructure::block-top-padding': 'standard',
  '_pageStructure::block-bottom-padding': 'standard',
  '_validation::validation-success': '#065f28',
  '_validation::validation-error': '#ff0000',
  '_progress::progress': '#2e7fa1',
  '_progress::progress-inverted': '#e5e5e5',
  '_progress::progress-border': 'transparent',
  '_menu::menu-header-background-color': '',
  '_menu::menu-item': '',
  '_menu::menu-item-progress': '',
  '_nav::nav': '#2e7fa1',
  '_nav::nav-progress': '#2e7fa1',
  '_notify::notify': '#ffffff',
  '_notify::drawer': '#ffffff',
  '_notify::notify-title-color': '',
};

// Mirrors linkedProperties in custom-theme properties.schema.
// Format uses UI keys: "sectionId::fieldKey".
const CUSTOM_LINKED_PROPERTY_MAP: Record<string, string[]> = {
  '_global::_primaryBrandColor': ['_progress::progress', '_global::link', '_nav::nav', '_pageStructure::page-header-background-color'],
  '_progress::progress': ['_nav::nav-progress', '_menu::menu-item-progress'],
};

const VANILLA_ACCORDION_DEFS: { id: string; label: string; fields: { key: string; label: string }[] }[] = [
  {
    id: '_global', label: 'Global',
    fields: [
      { key: 'font-color', label: 'Font colour' },
      { key: 'font-color-inverted', label: 'Font colour inverted' },
      { key: 'link', label: 'Link font colour' },
      { key: 'link-inverted', label: 'Link font colour - inverted' },
      { key: 'link-hover', label: 'Link font colour - hover' },
      { key: 'link-inverted-hover', label: 'Link font colour - inverted hover' },
      { key: 'heading-color', label: 'Heading colour' },
      { key: 'heading-color-inverted', label: 'Heading colour - inverted' },
      { key: 'body-background-color', label: 'Body background colour' },
    ],
  },
  {
    id: '_items', label: 'Content Items',
    fields: [
      { key: 'item-color', label: 'Item colour' },
      { key: 'item-color-inverted', label: 'Item colour - inverted' },
      { key: 'item-color-hover', label: 'Item colour - hover' },
      { key: 'item-color-inverted-hover', label: 'Item colour - inverted hover' },
      { key: 'item-color-focus', label: 'Item colour - focus' },
      { key: 'item-color-inverted-focus', label: 'Item colour - inverted focus' },
      { key: 'item-color-selected', label: 'Item colour - selected' },
      { key: 'item-color-inverted-selected', label: 'Item colour - inverted selected' },
      { key: 'visited', label: 'Item colour - visited' },
      { key: 'visited-inverted', label: 'Item colour - inverted visited' },
      { key: 'item-color-disabled', label: 'Item colour - disabled' },
      { key: 'item-color-inverted-disabled', label: 'Item colour - inverted disabled' },
    ],
  },
  {
    id: '_itemsUi', label: 'Content Items UI',
    fields: [
      { key: 'item-ui-color', label: 'Item UI colour' },
      { key: 'item-ui-color-inverted', label: 'Item UI colour - inverted' },
      { key: 'item-ui-color-hover', label: 'Item UI colour - hover' },
      { key: 'item-ui-color-inverted-hover', label: 'Item UI colour - inverted hover' },
      { key: 'item-ui-color-focus', label: 'Item UI colour - focus' },
      { key: 'item-ui-color-inverted-focus', label: 'Item UI colour - inverted focus' },
      { key: 'item-ui-color-selected', label: 'Item UI colour - selected' },
      { key: 'item-ui-color-inverted-selected', label: 'Item UI colour - inverted selected' },
      { key: 'item-ui-color-visited', label: 'Item UI colour - visited' },
      { key: 'item-ui-color-inverted-visited', label: 'Item UI colour - inverted visited' },
      { key: 'item-ui-color-locked', label: 'Item UI colour - locked' },
      { key: 'item-ui-color-inverted-locked', label: 'Item UI colour - inverted locked' },
      { key: 'item-ui-color-disabled', label: 'Item UI colour - disabled' },
      { key: 'item-ui-color-inverted-disabled', label: 'Item UI colour - inverted disabled' },
    ],
  },
  {
    id: '_buttons', label: 'Buttons',
    fields: [
      { key: 'btn-color', label: 'Button colour' },
      { key: 'btn-color-inverted', label: 'Button colour - inverted' },
      { key: 'btn-color-hover', label: 'Button colour - hover' },
      { key: 'btn-color-inverted-hover', label: 'Button colour - inverted hover' },
      { key: 'btn-color-focus', label: 'Button colour - focus' },
      { key: 'btn-color-inverted-focus', label: 'Button colour - inverted focus' },
      { key: 'btn-color-selected', label: 'Button colour - selected' },
      { key: 'btn-color-inverted-selected', label: 'Button colour - inverted selected' },
      { key: 'btn-color-locked', label: 'Button colour - locked' },
      { key: 'btn-color-inverted-locked', label: 'Button colour - inverted locked' },
      { key: 'disabled', label: 'Button colour - disabled' },
      { key: 'disabled-inverted', label: 'Button colour - inverted disabled' },
      { key: 'btn-icon-color', label: 'Button icon colour' },
      { key: 'btn-icon-color-inverted', label: 'Button icon colour - inverted' },
      { key: 'btn-icon-color-hover', label: 'Button icon colour - hover' },
      { key: 'btn-icon-color-inverted-hover', label: 'Button icon colour - inverted hover' },
    ],
  },
  {
    id: '_globalUi', label: 'Global UI',
    fields: [
      { key: 'ui-color', label: 'UI colour' },
      { key: 'ui-color-inverted', label: 'UI colour - inverted' },
    ],
  },
  {
    id: '_validation', label: 'Validation States',
    fields: [
      { key: 'validation-success', label: 'Validation success colour' },
      { key: 'validation-success-inverted', label: 'Validation success colour - inverted' },
      { key: 'validation-error', label: 'Validation error colour' },
      { key: 'validation-error-inverted', label: 'Validation error colour - inverted' },
    ],
  },
  {
    id: '_progress', label: 'Progress',
    fields: [
      { key: 'progress', label: 'Progress fill colour' },
      { key: 'progress-inverted', label: 'Progress background colour' },
      { key: 'progress-border', label: 'Progress border colour' },
    ],
  },
  {
    id: '_page', label: 'Page',
    fields: [
      { key: 'page-header-background-color', label: 'Page header background colour' },
      { key: 'page-header-title-color', label: 'Page header title colour' },
      { key: 'page-header-subtitle-color', label: 'Page header subtitle colour' },
      { key: 'page-header-body-color', label: 'Page header body colour' },
      { key: 'page-header-instruction-color', label: 'Page header instruction colour' },
    ],
  },
  {
    id: '_menu', label: 'Menu',
    fields: [
      { key: 'menu-header-background-color', label: 'Menu header background colour' },
      { key: 'menu-header-title-color', label: 'Menu header title colour' },
      { key: 'menu-header-subtitle-color', label: 'Menu header subtitle colour' },
      { key: 'menu-header-body-color', label: 'Menu header body colour' },
      { key: 'menu-header-instruction-color', label: 'Menu header instruction colour' },
      { key: 'menu-item', label: 'Menu item colour' },
      { key: 'menu-item-inverted', label: 'Menu item colour - inverted' },
      { key: 'menu-item-border-color', label: 'Menu item border colour' },
      { key: 'menu-item-progress', label: 'Menu item progress fill colour' },
      { key: 'menu-item-progress-inverted', label: 'Menu item progress background colour' },
      { key: 'menu-item-progress-border', label: 'Menu item progress border colour' },
      { key: 'menu-item-btn-color', label: 'Menu item button background colour' },
      { key: 'menu-item-btn-color-inverted', label: 'Menu item button background colour - inverted' },
      { key: 'menu-item-btn-color-hover', label: 'Menu item button background colour - hover' },
      { key: 'menu-item-btn-color-inverted-hover', label: 'Menu item button background colour - inverted hover' },
      { key: 'menu-item-btn-color-focus', label: 'Menu item button background colour - focus' },
      { key: 'menu-item-btn-color-inverted-focus', label: 'Menu item button background colour - inverted focus' },
      { key: 'menu-item-btn-color-locked', label: 'Menu item button background colour - locked' },
      { key: 'menu-item-btn-color-inverted-locked', label: 'Menu item button background colour - inverted locked' },
    ],
  },
  {
    id: '_nav', label: 'Navigation',
    fields: [
      { key: 'nav', label: 'Navigation background colour' },
      { key: 'nav-inverted', label: 'Navigation background colour - inverted' },
      { key: 'nav-icon', label: 'Navigation button background colour' },
      { key: 'nav-icon-inverted', label: 'Navigation button background colour - inverted' },
      { key: 'nav-icon-hover', label: 'Navigation button background colour - hover' },
      { key: 'nav-icon-inverted-hover', label: 'Navigation button background colour - inverted hover' },
      { key: 'nav-icon-focus', label: 'Navigation button background colour - focus' },
      { key: 'nav-icon-inverted-focus', label: 'Navigation button background colour - inverted focus' },
      { key: 'nav-icon-locked', label: 'Navigation button background colour - locked' },
      { key: 'nav-icon-inverted-locked', label: 'Navigation button background colour - inverted locked' },
      { key: 'nav-icon-disabled', label: 'Navigation button background colour - disabled' },
      { key: 'nav-icon-inverted-disabled', label: 'Navigation button background colour - inverted disabled' },
      { key: 'nav-progress', label: 'Navigation progress fill color' },
      { key: 'nav-progress-inverted', label: 'Navigation progress background color - inverted' },
      { key: 'nav-progress-border', label: 'Navigation progress border colour' },
      { key: 'nav-progress-hover', label: 'Navigation progress fill color - hover' },
      { key: 'nav-progress-inverted-hover', label: 'Navigation progress background color - inverted hover' },
      { key: 'nav-progress-border-hover', label: 'Navigation progress border colour - hover' },
    ],
  },
  {
    id: '_notify', label: 'Notify (Pop up)',
    fields: [
      { key: 'notify', label: 'Notify background colour' },
      { key: 'notify-inverted', label: 'Notify background colour - inverted' },
      { key: 'notify-link', label: 'Notify link font colour' },
      { key: 'notify-link-hover', label: 'Notify link font colour - hover' },
      { key: 'notify-icon', label: 'Notify icon button background colour' },
      { key: 'notify-icon-inverted', label: 'Notify icon button background colour - inverted' },
      { key: 'notify-icon-hover', label: 'Notify icon button background colour - hover' },
      { key: 'notify-icon-inverted-hover', label: 'Notify icon button background colour - inverted hover' },
      { key: 'notify-icon-focus', label: 'Notify icon button background colour - focus' },
      { key: 'notify-icon-inverted-focus', label: 'Notify icon button background colour - inverted focus' },
      { key: 'notify-icon-disabled', label: 'Notify icon button background colour - disabled' },
      { key: 'notify-icon-inverted-disabled', label: 'Notify icon button background colour - inverted disabled' },
      { key: 'notify-btn', label: 'Notify button background colour' },
      { key: 'notify-btn-inverted', label: 'Notify button background colour - inverted' },
      { key: 'notify-btn-hover', label: 'Notify button background colour - hover' },
      { key: 'notify-btn-inverted-hover', label: 'Notify button background colour - inverted hover' },
      { key: 'notify-btn-focus', label: 'Notify button background colour - focus' },
      { key: 'notify-btn-inverted-focus', label: 'Notify button background colour - inverted focus' },
      { key: 'notify-btn-selected', label: 'Notify button background colour - selected' },
      { key: 'notify-btn-inverted-selected', label: 'Notify button background colour - inverted selected' },
      { key: 'notify-btn-locked', label: 'Notify button background colour - locked' },
      { key: 'notify-btn-inverted-locked', label: 'Notify button background colour - inverted locked' },
      { key: 'notify-btn-disabled', label: 'Notify button background colour - disabled' },
      { key: 'notify-btn-inverted-disabled', label: 'Notify button background colour - inverted disabled' },
    ],
  },
  {
    id: '_drawer', label: 'Drawer',
    fields: [
      { key: 'drawer', label: 'Drawer background colour' },
      { key: 'drawer-inverted', label: 'Drawer background colour - inverted' },
      { key: 'drawer-link', label: 'Drawer link font colour' },
      { key: 'drawer-link-hover', label: 'Drawer link font colour - hover' },
      { key: 'drawer-icon', label: 'Drawer icon button background colour' },
      { key: 'drawer-icon-inverted', label: 'Drawer icon button background colour - inverted' },
      { key: 'drawer-icon-hover', label: 'Drawer icon button background colour - hover' },
      { key: 'drawer-icon-inverted-hover', label: 'Drawer icon button background colour - inverted hover' },
      { key: 'drawer-icon-focus', label: 'Drawer icon button background colour - focus' },
      { key: 'drawer-icon-inverted-focus', label: 'Drawer icon button background colour - inverted focus' },
      { key: 'drawer-item', label: 'Drawer item background colour' },
      { key: 'drawer-item-inverted', label: 'Drawer item background colour - inverted' },
      { key: 'drawer-item-hover', label: 'Drawer item background colour - hover' },
      { key: 'drawer-item-inverted-hover', label: 'Drawer item background colour - inverted hover' },
      { key: 'drawer-item-focus', label: 'Drawer item background colour - focus' },
      { key: 'drawer-item-inverted-focus', label: 'Drawer item background colour - inverted focus' },
      { key: 'drawer-item-selected', label: 'Drawer item background colour - selected' },
      { key: 'drawer-item-inverted-selected', label: 'Drawer item background colour - inverted selected' },
      { key: 'drawer-item-selected-underline', label: 'Drawer item colour - selected underline' },
      { key: 'drawer-item-locked', label: 'Drawer item background colour - locked' },
      { key: 'drawer-item-inverted-locked', label: 'Drawer item background colour - inverted locked' },
      { key: 'drawer-progress', label: 'Drawer progress fill colour' },
      { key: 'drawer-progress-inverted', label: 'Drawer progress background colour' },
      { key: 'drawer-progress-border', label: 'Drawer progress border colour' },
      { key: 'drawer-progress-hover', label: 'Drawer progress colour - hover' },
      { key: 'drawer-progress-inverted-hover', label: 'Drawer progress colour - inverted hover' },
      { key: 'drawer-progress-border-hover', label: 'Drawer progress border colour - hover' },
    ],
  },
  {
    id: '_pullQuote', label: 'Pull Quotes',
    fields: [
      { key: 'pull-quote', label: 'Pull quote background colour' },
      { key: 'pull-quote-inverted', label: 'Pull quote text colour' },
      { key: 'pull-quote-border', label: 'Pull quote border colour' },
    ],
  },
  {
    id: '_misc', label: 'Misc',
    fields: [
      { key: 'background', label: 'Background colour' },
      { key: 'background-inverted', label: 'Background colour - inverted' },
      { key: 'shadow', label: 'Shadow background colour (loading / popup background)' },
      { key: 'shadow-inverted', label: 'Shadow background colour - inverted' },
      { key: 'shadow-opacity', label: 'Shadow opacity' },
      { key: 'loading', label: 'Loading animation background colour' },
      { key: 'loading-inverted', label: 'Loading animation colour - inverted' },
    ],
  },
  {
    id: '_tooltip', label: 'Tooltip',
    fields: [
      { key: 'tooltip-color', label: 'Tooltip background colour' },
      { key: 'tooltip-text-color', label: 'Tooltip text colour' },
    ],
  },
];

type LifeSpriteSheet = { _spriteSheetId: string; src: string };
type LifeSingleIcon = { iconId: string; src: string };
type LifeCourseConfig = {
  _svgSpriteSheets: LifeSpriteSheet[];
  _singleIcons: LifeSingleIcon[];
};
type LifeBlocksConfig = {
  _paddingTop: string;
  _paddingBottom: string;
};

type OnScreenLevelKey = 'page' | 'section' | 'contentGroup' | 'content';
type OnScreenLevelConfig = {
  _classes: string;
  _percentInviewVertical: number;
};
type OnScreenLevelsConfig = Record<OnScreenLevelKey, OnScreenLevelConfig>;

type OnScreenConfig = {
  _isEnabled: boolean;
  _classes: string;
  _percentInviewVertical: number;
  _levels: OnScreenLevelsConfig;
};

const DEFAULT_LIFE_COURSE_CONFIG: LifeCourseConfig = {
  _svgSpriteSheets: [],
  _singleIcons: [],
};

const DEFAULT_LIFE_BLOCKS_CONFIG: LifeBlocksConfig = {
  _paddingTop: "",
  _paddingBottom: "",
};

const DEFAULT_ON_SCREEN_CONFIG: OnScreenConfig = {
  _isEnabled: false,
  _classes: "",
  _percentInviewVertical: 50,
  _levels: {
    page: { _classes: '', _percentInviewVertical: 50 },
    section: { _classes: '', _percentInviewVertical: 50 },
    contentGroup: { _classes: '', _percentInviewVertical: 50 },
    content: { _classes: '', _percentInviewVertical: 50 },
  },
};

const ON_SCREEN_ROW_DEFS: Array<{ key: OnScreenLevelKey; label: string }> = [
  { key: 'page', label: 'Page' },
  { key: 'section', label: 'Section' },
  { key: 'contentGroup', label: 'Content Group (Block)' },
  { key: 'content', label: 'Content (Component)' },
];

const ON_SCREEN_CLASS_OPTIONS = [
  '',
  'fade-in',
  'fade-in-left',
  'fade-in-right',
  'fade-in-top',
  'fade-in-bottom',
  'fade-out',
];

function LifeListField({
  title,
  description,
  items,
  onAdd,
  onRemove,
  onChange,
  idLabel,
  idKey,
}: {
  title: string;
  description: string;
  items: Array<LifeSpriteSheet | LifeSingleIcon>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, key: string, value: string) => void;
  idLabel: string;
  idKey: '_spriteSheetId' | 'iconId';
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-[#111827] mb-1.5">{title}</p>
        <p className="text-xs text-[#6b7280] leading-relaxed">{description}</p>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${idKey}-${index}`} className="border border-[#e5e7eb] rounded-lg p-3 space-y-3 bg-[#fafafa]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-[#111827] mb-2">{idLabel}</p>
                <input
                  type="text"
                  value={idKey === '_spriteSheetId' ? (item as LifeSpriteSheet)._spriteSheetId : (item as LifeSingleIcon).iconId}
                  onChange={(e) => onChange(index, idKey, e.target.value)}
                  className="text-xs w-full border border-[#d1d5db] rounded px-2 py-1.5 text-[#111827] focus:border-[var(--life-primary-500)] outline-none"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#111827] mb-2">External Source</p>
                <input
                  type="text"
                  value={item.src}
                  onChange={(e) => onChange(index, 'src', e.target.value)}
                  className="text-xs w-full border border-[#d1d5db] rounded px-2 py-1.5 text-[#111827] focus:border-[var(--life-primary-500)] outline-none"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="text-xs font-semibold px-3 py-1.5 border border-[#ef4444] text-[#ef4444] rounded-md hover:bg-[#fef2f2] transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="px-5 py-2 text-xs font-semibold text-white bg-[var(--life-primary-500)] rounded-md hover:bg-[var(--life-primary-700)] transition-colors"
      >
        Add
      </button>
    </div>
  );
}

export default function SelectThemePage({ initialThemeName, initialThemeVariables, initialPresetId, courseId, onNavigationRequest, pendingNavigation, onPendingNavigationHandled, onThemeSaved }: {
  initialThemeName?: string;
  initialThemeVariables?: Record<string, unknown>;
  initialPresetId?: string;
  courseId?: string;
  onNavigationRequest?: (nav: string) => void;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
  onThemeSaved?: (payload: { themeName: string; themeVariables: Record<string, unknown>; themePresetId: string }) => void;
}) {
  const initialSelectedThemeId = mapThemeNameToId(initialThemeName);
  const [selected, setSelected] = useState<string | null>(initialSelectedThemeId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [initialHydrationComplete, setInitialHydrationComplete] = useState(false);
  const [lastSavedStateSnapshot, setLastSavedStateSnapshot] = useState("");

  // Presets
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId ?? '');
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetNameInput, setShowPresetNameInput] = useState(false);
  const [showManagePresetsModal, setShowManagePresetsModal] = useState(false);
  const [dbThemeVariables, setDbThemeVariables] = useState<Record<string, unknown>>(initialThemeVariables ?? {});
  const [selectedPresetParentTheme, setSelectedPresetParentTheme] = useState<string>("");
  const hasMountedWithInitialTheme = useRef(false);

  function escapePresetName(value: string): string {
    return value.replace(/[&<>'"`]/g, (char) => {
      const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
        "`": "&#96;",
      };
      return map[char] || char;
    });
  }

  // Load presets for selected theme using the same parentTheme key old UI uses.
  useEffect(() => {
    const themeLabelMap: Record<string, string> = { life: 'LIFE Theme', vanilla: 'Vanilla Theme', custom: 'Custom Theme' };
    const fallbackMap: Record<string, string> = { life: 'lifetheme', vanilla: 'vanillatheme', custom: 'customtheme' };
    const themeLabel = selected ? themeLabelMap[selected] : undefined;

    if (!themeLabel || !selected) {
      setPresets([]);
      setSelectedPresetParentTheme("");
      return;
    }

    let cancelled = false;
    (async () => {
      const resolvedParentTheme = await getThemePresetParentTheme(themeLabel).catch(() => null);
      const parentTheme = resolvedParentTheme || fallbackMap[selected];
      if (cancelled) return;

      setSelectedPresetParentTheme(parentTheme);
      const loaded = await getThemePresets(parentTheme).catch(() => [] as ThemePreset[]);
      if (cancelled) return;

      setPresets(loaded);
      if (selectedPresetId && !loaded.some((p) => p._id === selectedPresetId)) {
        setSelectedPresetId('');
      }
    })();

    if (!hasMountedWithInitialTheme.current) {
      hasMountedWithInitialTheme.current = true;
    } else {
      setSelectedPresetId('');
    }

    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    setDbThemeVariables(initialThemeVariables ?? {});
  }, [initialThemeVariables]);

  function getErrorMessage(error: unknown): string {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;

    const maybe = error as {
      message?: string;
      status?: number;
      statusText?: string;
      response?: { status?: number; statusText?: string; data?: unknown };
      data?: unknown;
    };

    const status = maybe.response?.status ?? maybe.status;
    const statusText = maybe.response?.statusText ?? maybe.statusText;
    const msg = maybe.message || '';

    if (status) {
      return `${status}${statusText ? ` ${statusText}` : ''}${msg ? `: ${msg}` : ''}`;
    }
    return msg || 'Unknown error';
  }

  async function handleSave() {
    if (!courseId || !selected) return;
    const labelMap: Record<string, string> = { life: 'LIFE Theme', vanilla: 'Vanilla Theme', custom: 'Custom Theme' };
    const themeLabel = labelMap[selected];
    if (!themeLabel) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      // Avoid re-applying the same theme family on every save, which can
      // accidentally switch between similarly named LIFE variants.
      if (selected !== initialSelectedThemeId) {
        await saveThemeForCourse(courseId, themeLabel);
      }
      // If a preset is selected, apply it first so config linkage is preserved,
      // then write current editor values last to keep new->old reflection correct.
      if (selectedPresetId) {
        try {
          await applyThemePreset(selectedPresetId, courseId);
        } catch {
          // Non-fatal: continue saving current values.
        }
      }
      // Build themeVariables payload - keep schema nesting to preserve old/new UI parity.
      let vars: Record<string, unknown> = {};
      if (selected === 'custom') vars = buildMergedCustomThemeVariables(dbThemeVariables);
      else if (selected === 'vanilla') vars = buildMergedVanillaThemeVariables(dbThemeVariables);
      else if (selected === 'life') {
        vars = buildMergedLifeThemeVariables(dbThemeVariables);
      }
      // LIFE uses _components; Custom uses _componentConfig (handled in builder).
      if (selected === 'life') {
        vars._components = {
          _canShowFinalMarking: checkNotFinal,
          _hidePartiallyDisplayMarking: checkUnanswered,
          _hideFeedbackFirstAttempt: checkHideFeedback,
          _hidePartiallyFeedback: checkHidePartial,
        };
      }
      await saveThemeVariables(courseId, vars);
      setDbThemeVariables(vars);
      onThemeSaved?.({
        themeName: themeLabel,
        themeVariables: vars,
        themePresetId: selectedPresetId,
      });
      setLastSavedStateSnapshot(buildUnsavedStateSnapshot());

      const navTarget = consumePendingNavigation();
      if (navTarget) onNavigationRequest?.(navTarget);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      const reason = getErrorMessage(error);
      console.error('Theme save failed', { error, selected, themeLabel, courseId });
      setSaveError(`Failed to save: ${reason}`);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardChanges() {
    setSelected(mapThemeNameToId(initialThemeName));
    setSelectedPresetId(initialPresetId ?? '');
    hydrateThemeVariablesIntoEditors(dbThemeVariables);
    // Re-anchor the snapshot so hasChanges becomes false
    setLastSavedStateSnapshot('');
  }

  async function handleSavePreset() {
    const input = newPresetName.trim();
    if (!input || !selected || !courseId) return;
    if (!selectedPresetParentTheme) {
      setSaveError('Failed to save preset: Theme is not ready yet. Please try again.');
      return;
    }

    const duplicate = presets.some((preset) =>
      preset.parentTheme === selectedPresetParentTheme &&
      (preset.displayName || '').trim().toLowerCase() === input.toLowerCase()
    );
    if (duplicate) {
      setSaveError('Failed to save preset: A preset with this name already exists for this theme.');
      return;
    }

    setSaveError(null);

    let vars: Record<string, unknown> = {};
    if (selected === 'custom') vars = buildMergedCustomThemeVariables({});
    else if (selected === 'vanilla') vars = buildMergedVanillaThemeVariables({});
    else if (selected === 'life') {
      vars = buildMergedLifeThemeVariables({});
    }
    if (selected === 'life') {
      vars._components = {
        _canShowFinalMarking: checkNotFinal,
        _hidePartiallyDisplayMarking: checkUnanswered,
        _hideFeedbackFirstAttempt: checkHideFeedback,
        _hidePartiallyFeedback: checkHidePartial,
      };
    }
    try {
      const created = await saveThemePreset(escapePresetName(input), selectedPresetParentTheme, vars);
      setPresets((prev) => [...prev, created]);
      setSelectedPresetId(created._id);
      setNewPresetName('');
      setShowPresetNameInput(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      const reason = getErrorMessage(error);
      setSaveError(`Failed to save preset: ${reason}`);
    }
  }
  const [checkNotFinal, setCheckNotFinal] = useState(false);
  const [checkUnanswered, setCheckUnanswered] = useState(false);
  const [checkHideFeedback, setCheckHideFeedback] = useState(false);
  const [checkHidePartial, setCheckHidePartial] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const [lifeCourseConfig, setLifeCourseConfig] = useState<LifeCourseConfig>(DEFAULT_LIFE_COURSE_CONFIG);
  const [lifeBlocksConfig, setLifeBlocksConfig] = useState<LifeBlocksConfig>(DEFAULT_LIFE_BLOCKS_CONFIG);
  const [onScreenConfig, setOnScreenConfig] = useState<OnScreenConfig>(DEFAULT_ON_SCREEN_CONFIG);
  const [activeVanillaAccordion, setActiveVanillaAccordion] = useState<string | null>('_global');
  const [vanillaColors, setVanillaColors] = useState<Record<string, string>>({});
  const [activeCustomAccordion, setActiveCustomAccordion] = useState<string | null>('_global');
  const [customSettings, setCustomSettings] = useState<Record<string, string>>(CUSTOM_FIELD_DEFAULTS);

  const updateOnScreenRow = useCallback((rowKey: OnScreenLevelKey, patch: Partial<OnScreenLevelConfig>) => {
    setOnScreenConfig((prev) => {
      const nextRow = {
        ...prev._levels[rowKey],
        ...patch,
      };
      const nextLevels = {
        ...prev._levels,
        [rowKey]: nextRow,
      };
      const next = {
        ...prev,
        _levels: nextLevels,
      };
      if (rowKey === 'content') {
        next._classes = nextRow._classes;
        next._percentInviewVertical = nextRow._percentInviewVertical;
      }
      return next;
    });
  }, []);

  const setCustomSettingWithDependencies = useCallback((key: string, value: string) => {
    setCustomSettings((prev) => {
      const next = { ...prev, [key]: value };
      const visited = new Set<string>();
      const queue: string[] = [key];

      while (queue.length) {
        const sourceKey = queue.shift();
        if (!sourceKey || visited.has(sourceKey)) continue;
        visited.add(sourceKey);

        const linkedKeys = CUSTOM_LINKED_PROPERTY_MAP[sourceKey] ?? [];
        linkedKeys.forEach((linkedKey) => {
          next[linkedKey] = next[sourceKey];
          queue.push(linkedKey);
        });
      }

      return next;
    });
  }, []);

  const buildUnsavedStateSnapshot = useCallback(() => {
    const normalizeRecord = (record: Record<string, string>) => Object.keys(record)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        acc[key] = record[key] ?? "";
        return acc;
      }, {});

    return JSON.stringify({
      selected,
      selectedPresetId,
      checkNotFinal,
      checkUnanswered,
      checkHideFeedback,
      checkHidePartial,
      lifeCourseConfig,
      lifeBlocksConfig,
      onScreenConfig,
      vanillaColors: normalizeRecord(vanillaColors),
      customSettings: normalizeRecord(customSettings),
    });
  }, [
    checkHideFeedback,
    checkHidePartial,
    checkNotFinal,
    checkUnanswered,
    customSettings,
    lifeBlocksConfig,
    lifeCourseConfig,
    onScreenConfig,
    selected,
    selectedPresetId,
    vanillaColors,
  ]);

  useEffect(() => {
    if (!initialHydrationComplete || lastSavedStateSnapshot) return;
    setLastSavedStateSnapshot(buildUnsavedStateSnapshot());
  }, [buildUnsavedStateSnapshot, initialHydrationComplete, lastSavedStateSnapshot]);

  const hasChanges =
    initialHydrationComplete &&
    !!lastSavedStateSnapshot &&
    buildUnsavedStateSnapshot() !== lastSavedStateSnapshot;

  const {
    showConfirmModal,
    consumePendingNavigation,
    clearPendingNavigation,
  } = useUnsavedChangesNavigationGuard({
    hasChanges,
    pendingNavigation,
    onPendingNavigationHandled,
    onNavigate: onNavigationRequest,
  });

  const buildMergedLifeThemeVariables = useCallback((baseVars: Record<string, unknown>) => {
    const merged: Record<string, unknown> = { ...(baseVars ?? {}) };
    merged._course = {
      ...(merged._course && typeof merged._course === 'object' && !Array.isArray(merged._course)
        ? merged._course as Record<string, unknown>
        : {}),
      _svgSpriteSheets: lifeCourseConfig._svgSpriteSheets.map((item) => ({
        _spriteSheetId: item._spriteSheetId,
        src: item.src,
      })),
      _singleIcons: lifeCourseConfig._singleIcons.map((item) => ({
        iconId: item.iconId,
        src: item.src,
      })),
    };
    merged._blocks = {
      ...(merged._blocks && typeof merged._blocks === 'object' && !Array.isArray(merged._blocks)
        ? merged._blocks as Record<string, unknown>
        : {}),
      _paddingTop: lifeBlocksConfig._paddingTop,
      _paddingBottom: lifeBlocksConfig._paddingBottom,
    };
    merged._onScreen = {
      ...(merged._onScreen && typeof merged._onScreen === 'object' && !Array.isArray(merged._onScreen)
        ? merged._onScreen as Record<string, unknown>
        : {}),
      _isEnabled: onScreenConfig._isEnabled,
      _classes: onScreenConfig._classes,
      _percentInviewVertical: onScreenConfig._percentInviewVertical,
      _levels: {
        page: { ...onScreenConfig._levels.page },
        section: { ...onScreenConfig._levels.section },
        contentGroup: { ...onScreenConfig._levels.contentGroup },
        content: { ...onScreenConfig._levels.content },
      },
    };
    return merged;
  }, [lifeBlocksConfig, lifeCourseConfig, onScreenConfig]);

  const buildMergedVanillaThemeVariables = useCallback((baseVars: Record<string, unknown>) => {
    const merged: Record<string, unknown> = { ...(baseVars ?? {}) };

    VANILLA_ACCORDION_DEFS.forEach((section) => {
      const existing = merged[section.id];
      const existingSection = (existing && typeof existing === 'object' && !Array.isArray(existing))
        ? { ...(existing as Record<string, unknown>) }
        : {};

      section.fields.forEach((field) => {
        const uiKey = `${section.id}::${field.key}`;
        existingSection[field.key] = vanillaColors[uiKey] ?? '';
      });

      merged[section.id] = existingSection;
    });

    return merged;
  }, [vanillaColors]);

  const buildMergedCustomThemeVariables = useCallback((baseVars: Record<string, unknown>) => {
    const merged: Record<string, unknown> = { ...(baseVars ?? {}) };

    CUSTOM_ACCORDION_DEFS.forEach((section) => {
      const existing = merged[section.id];
      const existingSection = (existing && typeof existing === 'object' && !Array.isArray(existing))
        ? { ...(existing as Record<string, unknown>) }
        : {};

      section.fields.forEach((field) => {
        const uiKey = `${section.id}::${field.key}`;
        existingSection[field.key] = customSettings[uiKey] ?? '';
      });

      merged[section.id] = existingSection;
    });

    merged._course = {
      ...(merged._course && typeof merged._course === 'object' && !Array.isArray(merged._course)
        ? merged._course as Record<string, unknown>
        : {}),
      _svgSpriteSheets: lifeCourseConfig._svgSpriteSheets.map((item) => ({
        _spriteSheetId: item._spriteSheetId,
        src: item.src,
      })),
      _singleIcons: lifeCourseConfig._singleIcons.map((item) => ({
        iconId: item.iconId,
        src: item.src,
      })),
    };

    merged._componentConfig = {
      ...(merged._componentConfig && typeof merged._componentConfig === 'object' && !Array.isArray(merged._componentConfig)
        ? merged._componentConfig as Record<string, unknown>
        : {}),
      _canShowFinalMarking: checkNotFinal,
      _hidePartiallyDisplayMarking: checkUnanswered,
      _hideFeedbackFirstAttempt: checkHideFeedback,
      _hidePartiallyFeedback: checkHidePartial,
    };

    merged._blocks = {
      ...(merged._blocks && typeof merged._blocks === 'object' && !Array.isArray(merged._blocks)
        ? merged._blocks as Record<string, unknown>
        : {}),
      _paddingTop: lifeBlocksConfig._paddingTop,
      _paddingBottom: lifeBlocksConfig._paddingBottom,
    };

    merged._onScreen = {
      ...(merged._onScreen && typeof merged._onScreen === 'object' && !Array.isArray(merged._onScreen)
        ? merged._onScreen as Record<string, unknown>
        : {}),
      _isEnabled: onScreenConfig._isEnabled,
      _classes: onScreenConfig._classes,
      _percentInviewVertical: onScreenConfig._percentInviewVertical,
      _levels: {
        page: { ...onScreenConfig._levels.page },
        section: { ...onScreenConfig._levels.section },
        contentGroup: { ...onScreenConfig._levels.contentGroup },
        content: { ...onScreenConfig._levels.content },
      },
    };

    return merged;
  }, [checkHideFeedback, checkHidePartial, checkNotFinal, checkUnanswered, customSettings, lifeBlocksConfig, lifeCourseConfig, onScreenConfig]);

  useEffect(() => {
    setSelected(mapThemeNameToId(initialThemeName));
  }, [initialThemeName]);

  const hydrateThemeVariablesIntoEditors = useCallback((variables: Record<string, unknown>) => {
    const v = variables ?? {};
    // Custom fields: use nested schema keys, with legacy flat fallbacks.
    const customPatch: Record<string, string> = {};
    const legacyCustomMap: Record<string, string[]> = {
      '_global::_primaryBrandColor': ['primaryColor'],
      '_global::_secondaryBrandColor': ['secondaryColor'],
      '_global::heading-font-family': ['headingFont'],
      '_global::paragraph-font-family': ['paragraphFont'],
      '_global::font-color': ['fontColor'],
      '_global::heading-color': ['headingFontColor'],
      '_global::instruction-color': ['instructionColor'],
      '_global::link': ['linkFontColor'],
      '_global::page-heading-font-size': ['pageTitleSize'],
      '_pageStructure::page-bg-color': ['pageBackgroundColor'],
      '_progress::progress': ['progressFillColor'],
      '_progress::progress-inverted': ['progressBackgroundColor'],
      '_progress::progress-border': ['progressBorderColor'],
      '_menu::menu-header-background-color': ['menuBackground'],
      '_menu::menu-item': ['menuTextColor'],
      '_menu::menu-item-progress': ['menuActiveColor'],
      '_validation::validation-success': ['successColor'],
      '_validation::validation-error': ['errorColor'],
      '_notify::notify': ['modalBackground'],
      '_notify::drawer': ['overlayBackground'],
      '_notify::notify-title-color': ['modalBorderColor'],
      '_nav::nav': ['navBackground'],
      '_nav::nav-progress': ['navHoverColor'],
    };

    CUSTOM_ACCORDION_DEFS.forEach((section) => {
      const sectionValue = v[section.id];
      const sectionRecord = (sectionValue && typeof sectionValue === 'object' && !Array.isArray(sectionValue))
        ? sectionValue as Record<string, unknown>
        : undefined;

      section.fields.forEach((field) => {
        const uiKey = `${section.id}::${field.key}`;
        if (sectionRecord && typeof sectionRecord[field.key] === 'string') {
          customPatch[uiKey] = sectionRecord[field.key] as string;
          return;
        }

        const legacyFlatKeys = legacyCustomMap[uiKey] ?? [];
        const legacyKey = legacyFlatKeys.find((legacy) => typeof v[legacy] === 'string');
        if (legacyKey) customPatch[uiKey] = v[legacyKey] as string;
      });
    });
    setCustomSettings({ ...CUSTOM_FIELD_DEFAULTS, ...customPatch });

    // Vanilla colors: prefer nested old-ui schema keys; also accept legacy flat keys.
    const vanillaPatch: Record<string, string> = {};
    VANILLA_ACCORDION_DEFS.forEach((section) => {
      const sectionValue = v[section.id];
      const sectionRecord = (sectionValue && typeof sectionValue === 'object' && !Array.isArray(sectionValue))
        ? sectionValue as Record<string, unknown>
        : undefined;

      section.fields.forEach((field) => {
        const uiKey = `${section.id}::${field.key}`;
        if (sectionRecord && typeof sectionRecord[field.key] === 'string') {
          vanillaPatch[uiKey] = sectionRecord[field.key] as string;
          return;
        }

        const legacyCandidates = [
          `${section.id}::${field.label}`,
          `${section.id.replace(/^_/, '')}::${field.label}`,
          uiKey,
        ];

        const legacyKey = legacyCandidates.find((candidate) => typeof v[candidate] === 'string');
        if (legacyKey) vanillaPatch[uiKey] = v[legacyKey] as string;
      });
    });
    setVanillaColors(vanillaPatch);

    const course = v._course as Record<string, unknown> | undefined;
    const nextLifeCourseConfig: LifeCourseConfig = {
      _svgSpriteSheets: [],
      _singleIcons: [],
    };
    if (course && typeof course === 'object' && !Array.isArray(course)) {
      const spriteSheets = Array.isArray(course._svgSpriteSheets)
        ? course._svgSpriteSheets
            .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
            .map((item) => ({
              _spriteSheetId: typeof item._spriteSheetId === 'string' ? item._spriteSheetId : '',
              src: typeof item.src === 'string' ? item.src : '',
            }))
        : [];
      const singleIcons = Array.isArray(course._singleIcons)
        ? course._singleIcons
            .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
            .map((item) => ({
              iconId: typeof item.iconId === 'string' ? item.iconId : '',
              src: typeof item.src === 'string' ? item.src : '',
            }))
        : [];
      nextLifeCourseConfig._svgSpriteSheets = spriteSheets;
      nextLifeCourseConfig._singleIcons = singleIcons;
    }
    setLifeCourseConfig(nextLifeCourseConfig);

    const blocks = v._blocks as Record<string, unknown> | undefined;
    setLifeBlocksConfig({
      _paddingTop: blocks && typeof blocks._paddingTop === 'string' ? blocks._paddingTop : '',
      _paddingBottom: blocks && typeof blocks._paddingBottom === 'string' ? blocks._paddingBottom : '',
    });

    const onScreen = v._onScreen as Record<string, unknown> | undefined;
    const legacyClasses = onScreen && typeof onScreen._classes === 'string' ? onScreen._classes : '';
    const legacyPercent =
      onScreen && typeof onScreen._percentInviewVertical === 'number'
        ? onScreen._percentInviewVertical
        : DEFAULT_ON_SCREEN_CONFIG._percentInviewVertical;
    const levelsSource = onScreen && typeof onScreen._levels === 'object' && !Array.isArray(onScreen._levels)
      ? onScreen._levels as Record<string, unknown>
      : undefined;
    const parseOnScreenLevel = (levelKey: OnScreenLevelKey): OnScreenLevelConfig => {
      const source = levelsSource && typeof levelsSource[levelKey] === 'object' && !Array.isArray(levelsSource[levelKey])
        ? levelsSource[levelKey] as Record<string, unknown>
        : undefined;
      return {
        _classes: source && typeof source._classes === 'string' ? source._classes : legacyClasses,
        _percentInviewVertical:
          source && typeof source._percentInviewVertical === 'number'
            ? source._percentInviewVertical
            : legacyPercent,
      };
    };
    setOnScreenConfig({
      _isEnabled: !!(onScreen && typeof onScreen._isEnabled === 'boolean' && onScreen._isEnabled),
      _classes: legacyClasses,
      _percentInviewVertical: legacyPercent,
      _levels: {
        page: parseOnScreenLevel('page'),
        section: parseOnScreenLevel('section'),
        contentGroup: parseOnScreenLevel('contentGroup'),
        content: parseOnScreenLevel('content'),
      },
    });

    // Component configuration checkboxes: custom uses _componentConfig, LIFE uses _components.
    const comp = (v._componentConfig as Record<string, unknown> | undefined) ?? (v._components as Record<string, unknown> | undefined);
    setCheckNotFinal(!!(comp && typeof comp._canShowFinalMarking === 'boolean' && comp._canShowFinalMarking));
    setCheckUnanswered(!!(comp && typeof comp._hidePartiallyDisplayMarking === 'boolean' && comp._hidePartiallyDisplayMarking));
    setCheckHideFeedback(!!(comp && typeof comp._hideFeedbackFirstAttempt === 'boolean' && comp._hideFeedbackFirstAttempt));
    setCheckHidePartial(!!(comp && typeof comp._hidePartiallyFeedback === 'boolean' && comp._hidePartiallyFeedback));
  }, []);

  // Load saved themeVariables into customSettings / vanillaColors / checkboxes.
  useEffect(() => {
    hydrateThemeVariablesIntoEditors(initialThemeVariables ?? {});
    setInitialHydrationComplete(true);
  }, [hydrateThemeVariablesIntoEditors, initialThemeVariables]);

  // When selecting a preset, apply that preset's own properties into editor state.
  useEffect(() => {
    if (!selectedPresetId) return;

    const selectedPreset = presets.find((preset) => preset._id === selectedPresetId);
    if (!selectedPreset) return;

    const presetProperties = (selectedPreset.properties && typeof selectedPreset.properties === 'object' && !Array.isArray(selectedPreset.properties))
      ? selectedPreset.properties as Record<string, unknown>
      : {};

    setDbThemeVariables(presetProperties);
    hydrateThemeVariablesIntoEditors(presetProperties);
  }, [hydrateThemeVariablesIntoEditors, presets, selectedPresetId]);

  // Color Picker Component
  const ColorPickerField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <p className="text-xs font-bold text-[#111827] mb-2">{label}</p>
      <div className="flex gap-2 items-center">
        <label className="w-8 h-8 rounded border border-[#d1d5db] cursor-pointer flex-shrink-0 block overflow-hidden relative">
          <span className="block w-full h-full" style={{ backgroundColor: value }} />
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <input type="text" value={value.toUpperCase()} onChange={e => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v); }} className="text-xs flex-1 border border-[#d1d5db] rounded px-2 py-1 text-[#111827] focus:border-[var(--life-primary-500)] outline-none" />
      </div>
    </div>
  );

  // Font Dropdown Component
  const FontDropdownField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <p className="text-xs font-bold text-[#111827] mb-2">{label}</p>
      <select value={value} onChange={e => onChange(e.target.value)} className="text-xs w-full border border-[#d1d5db] rounded px-2 py-1 text-[#111827] bg-white cursor-pointer focus:border-[var(--life-primary-500)] outline-none">
        {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
    </div>
  );

  const getCustomSetting = (sectionId: string, fieldKey: string): string => {
    const key = `${sectionId}::${fieldKey}`;
    return customSettings[key] ?? CUSTOM_FIELD_DEFAULTS[key] ?? '';
  };

  // Live Preview Component
  const LivePreview = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const primaryColor = getCustomSetting('_global', '_primaryBrandColor') || '#2e7fa1';
    const secondaryColor = getCustomSetting('_global', '_secondaryBrandColor') || '#25837e';
    const paragraphFont = getCustomSetting('_global', 'paragraph-font-family') || 'Lato';
    const headingFont = getCustomSetting('_global', 'heading-font-family') || 'Lato';
    const fontColor = getCustomSetting('_global', 'font-color') || '#1f1f1f';
    const headingColorTheme = getCustomSetting('_global', 'heading-color') || '#333333';
    const instructionColor = getCustomSetting('_global', 'instruction-color') || '#1f1f1f';
    const linkColor = getCustomSetting('_global', 'link') || '#2e7fa1';
    const titleSizeRaw = getCustomSetting('_global', 'page-heading-font-size') || '3rem';
    const pageBgColor = getCustomSetting('_pageStructure', 'page-bg-color') || '#f8f8f8';
    const articleBgColor = getCustomSetting('_pageStructure', 'article-bg-color') || '#ffffff';
    const blockBgColor = getCustomSetting('_pageStructure', 'block-bg-color') || '#ffffff';
    const componentBgColor = getCustomSetting('_pageStructure', 'component-bg-color') || '#ffffff';
    const pageHeaderBg = getCustomSetting('_pageStructure', 'page-header-background-color') || primaryColor;
    const pageHeaderTitleColor = getCustomSetting('_pageStructure', 'page-header-title-color') || '#ffffff';
    const pageHeaderSubtitleColor = getCustomSetting('_pageStructure', 'page-header-subtitle-color') || 'rgba(255,255,255,0.8)';
    const pageHeaderBodyColor = getCustomSetting('_pageStructure', 'page-header-body-color') || 'rgba(255,255,255,0.85)';
    const pageHeaderInstructionColor = getCustomSetting('_pageStructure', 'page-header-instruction-color') || instructionColor;
    const articleTopPadding = getCustomSetting('_pageStructure', 'article-top-padding') || 'standard';
    const articleBottomPadding = getCustomSetting('_pageStructure', 'article-bottom-padding') || 'standard';
    const blockTopPadding = getCustomSetting('_pageStructure', 'block-top-padding') || 'standard';
    const blockBottomPadding = getCustomSetting('_pageStructure', 'block-bottom-padding') || 'standard';

    const progressFill = getCustomSetting('_progress', 'progress') || primaryColor;
    const progressBackground = getCustomSetting('_progress', 'progress-inverted') || '#e5e5e5';
    const progressBorder = getCustomSetting('_progress', 'progress-border') || 'transparent';

    const navBg = getCustomSetting('_nav', 'nav') || pageHeaderBg;

    const spacingScale: Record<string, number> = {
      remove: 0,
      half: 8,
      standard: 16,
      double: 24,
    };

    const previewBg = darkMode ? '#1a1a1a' : pageBgColor;
    const canvasBg = darkMode ? '#111827' : '#f0f4f8';
    const textColor = darkMode ? '#e8e8e8' : fontColor;
    const headingColor = darkMode ? '#ffffff' : headingColorTheme;
    const navIconColor = (pageHeaderTitleColor && pageHeaderTitleColor !== 'transparent') ? pageHeaderTitleColor : '#ffffff';
    const navTextColor = (pageHeaderBodyColor && pageHeaderBodyColor !== 'transparent') ? pageHeaderBodyColor : navIconColor;
    const titleSize = titleSizeRaw;
    const articleTop = spacingScale[articleTopPadding] ?? spacingScale.standard;
    const articleBottom = spacingScale[articleBottomPadding] ?? spacingScale.standard;
    const blockTop = spacingScale[blockTopPadding] ?? spacingScale.standard;
    const blockBottom = spacingScale[blockBottomPadding] ?? spacingScale.standard;

    useEffect(() => {
      if (!isExpanded) return;

      const previousOverflow = document.body.style.overflow;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setIsExpanded(false);
      };

      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKeyDown);

      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener('keydown', onKeyDown);
      };
    }, [isExpanded]);

    const previewContent = (
      <div className="min-h-0 flex-1 overflow-y-auto p-0" style={{ fontSize: '13px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div className="overflow-hidden rounded-xl border border-[#e5e7eb]" style={{ backgroundColor: previewBg }}>
            <div style={{ height: '4px', borderTop: `1px solid ${progressBorder}`, borderBottom: `1px solid ${progressBorder}`, background: `linear-gradient(to right, ${progressFill} 60%, ${progressBackground} 60%)` }} />
            <div style={{ background: navBg, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: darkMode ? '1px solid #374151' : '1px solid #f3f4f6' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={navIconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={navIconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span style={{ fontFamily: `${paragraphFont}, sans-serif`, fontSize: '0.76rem', color: navTextColor, flex: 1 }}>
                New Course Title <span style={{ opacity: 0.7 }}>/ New Page Title</span>
              </span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={navIconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div style={{ backgroundColor: previewBg, padding: '18px' }}>
              <div style={{ maxWidth: '560px', margin: '0 auto' }}>
                <div style={{ padding: '6px 0 14px' }}>
                  <div style={{ fontFamily: `${headingFont}, sans-serif`, fontSize: titleSize || '3rem', fontWeight: 700, color: headingColor, lineHeight: 1.2, marginBottom: '4px' }}>
                    New Page Title
                  </div>
                  <div style={{ fontFamily: `${paragraphFont}, sans-serif`, color: textColor, fontSize: '0.88rem', lineHeight: 1.45 }}>
                    Page subtitle
                  </div>
                </div>

                <div style={{ fontFamily: `${paragraphFont}, sans-serif`, fontSize: '0.84rem', color: linkColor, textDecoration: 'underline', cursor: 'pointer', marginBottom: '12px' }}>
                  This is a sample link
                </div>

                <div style={{ border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`, borderRadius: '10px', background: articleBgColor, padding: '12px' }}>
                  <div style={{ fontFamily: `${headingFont}, sans-serif`, fontSize: '0.9rem', fontWeight: 700, color: headingColor, lineHeight: 1.2, marginBottom: '8px' }}>
                    New Component Title
                  </div>
                  <div style={{ fontFamily: `${paragraphFont}, sans-serif`, fontSize: '0.82rem', color: instructionColor, fontStyle: 'italic', marginBottom: '10px' }}>
                    Choose one option then select Submit.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[{ label: 'Correct', selected: true }, { label: 'Incorrect', selected: false }].map((opt) => (
                      <div
                        key={opt.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`,
                          borderRadius: '999px',
                          padding: '8px 12px',
                          background: opt.selected ? `${secondaryColor}1F` : articleBgColor,
                        }}
                      >
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, border: `2px solid ${opt.selected ? secondaryColor : (darkMode ? '#6b7280' : '#cbd5e1')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: componentBgColor }}>
                          {opt.selected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: secondaryColor }} />}
                        </div>
                        <span style={{ fontFamily: `${paragraphFont}, sans-serif`, fontSize: '0.8rem', fontWeight: 600, color: textColor }}>{opt.label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ display: 'inline-block', background: primaryColor, borderRadius: '6px', padding: '7px 16px', fontFamily: `${paragraphFont}, sans-serif`, fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                      Submit
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                  <div style={{ display: 'inline-block', border: `1px solid ${primaryColor}`, borderRadius: '6px', padding: '7px 16px', fontFamily: `${paragraphFont}, sans-serif`, fontSize: '0.82rem', fontWeight: 600, color: primaryColor }}>
                    Previous
                  </div>
                  <div style={{ display: 'inline-block', background: primaryColor, borderRadius: '6px', padding: '7px 16px', fontFamily: `${paragraphFont}, sans-serif`, fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                    Next
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <>
        <div className="flex flex-col h-full rounded-xl overflow-hidden border border-[#e5e7eb]" style={{ backgroundColor: canvasBg }}>
          <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-[#e5e7eb] shrink-0">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill={primaryColor} stroke="none">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span className="text-xs font-semibold text-[#111827]">Live Preview</span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="w-8 h-8 flex items-center justify-center bg-transparent border border-[#e5e7eb] rounded-lg text-[#6b7280] hover:bg-[#f9fafb]"
                title="Toggle dark mode"
                aria-label="Toggle dark mode"
                type="button"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </button>
              <button
                onClick={() => setIsExpanded(true)}
                className="w-8 h-8 flex items-center justify-center bg-transparent border border-[#e5e7eb] rounded-lg text-[#6b7280] hover:bg-[#f9fafb]"
                title="Expand preview"
                aria-label="Expand preview"
                type="button"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>
          </div>
          {previewContent}
        </div>

        {isExpanded && (
          <div className="fixed inset-x-0 top-14 bottom-0 z-50 overflow-y-auto bg-black/50 p-4" onClick={() => setIsExpanded(false)}>
            <div
              className="mx-auto flex min-h-full w-full max-w-6xl min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#e5e7eb] shrink-0">
                <div className="flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={primaryColor} stroke="none">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span className="text-sm font-semibold text-[#111827]">Live Preview</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="w-9 h-9 flex items-center justify-center bg-transparent border border-[#e5e7eb] rounded-lg text-[#6b7280] hover:bg-[#f9fafb]"
                    title="Toggle dark mode"
                    aria-label="Toggle dark mode"
                    type="button"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="w-9 h-9 flex items-center justify-center bg-transparent border border-[#e5e7eb] rounded-lg text-[#6b7280] hover:bg-[#f9fafb]"
                    title="Collapse preview"
                    aria-label="Collapse preview"
                    type="button"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 3 3 3 3 9" />
                      <polyline points="15 21 21 21 21 15" />
                      <line x1="3" y1="3" x2="10" y2="10" />
                      <line x1="14" y1="14" x2="21" y2="21" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1" style={{ backgroundColor: canvasBg }}>
                {previewContent}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // Custom Theme Editor Component
  const CustomThemeEditor = ({ onBack }: { onBack: () => void }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
      {/* Left: breadcrumb + accordions */}
      <div className="space-y-5">
        <div className="flex items-center gap-1">
          <button onClick={onBack} className="flex items-center gap-1 bg-none border-none cursor-pointer text-[var(--life-primary-500)] hover:opacity-75 p-0">
            <span>{'<'}</span>
            <span className="text-xs font-semibold">Theme</span>
          </button>
          <span className="text-[#6b7280]">/</span>
          <span className="text-xs font-bold text-[#111827]">Custom Theme</span>
        </div>

        <div className="space-y-2">
          {CUSTOM_ACCORDION_DEFS.map((acc) => {
            const isOpen = activeCustomAccordion === acc.id;
            return (
              <div key={acc.id} className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                <button
                  onClick={() => setActiveCustomAccordion(isOpen ? null : acc.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors border-b border-[#e5e7eb] ${isOpen ? 'bg-[#f9fafb]' : 'bg-white hover:bg-[#f9fafb]'}`}
                >
                  <span className="text-xs font-bold text-[#111827]">{acc.label}</span>
                  <svg className={`w-4 h-4 text-[#6b7280] transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isOpen && acc.id === 'global' && (
                  <div className="px-4 py-4 bg-white border-t border-[#e5e7eb]">
                    <div className="grid grid-cols-2 gap-4">
                      <ColorPickerField label="Primary colour" value={customSettings.primaryColor} onChange={v => setCustomSettings({...customSettings, primaryColor: v})} />
                      <ColorPickerField label="Secondary colour" value={customSettings.secondaryColor} onChange={v => setCustomSettings({...customSettings, secondaryColor: v})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <FontDropdownField label="Heading font" value={customSettings.headingFont} onChange={v => setCustomSettings({...customSettings, headingFont: v})} />
                      <FontDropdownField label="Paragraph font" value={customSettings.paragraphFont} onChange={v => setCustomSettings({...customSettings, paragraphFont: v})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <ColorPickerField label="Font colour" value={customSettings.fontColor} onChange={v => setCustomSettings({...customSettings, fontColor: v})} />
                      <ColorPickerField label="Heading font colour" value={customSettings.headingFontColor} onChange={v => setCustomSettings({...customSettings, headingFontColor: v})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <ColorPickerField label="Instruction colour" value={customSettings.instructionColor} onChange={v => setCustomSettings({...customSettings, instructionColor: v})} />
                      <ColorPickerField label="Link font colour" value={customSettings.linkFontColor} onChange={v => setCustomSettings({...customSettings, linkFontColor: v})} />
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-bold text-[#111827] mb-2">Page Title Size</p>
                      <select value={customSettings.pageTitleSize} onChange={e => setCustomSettings({...customSettings, pageTitleSize: e.target.value})} className="text-xs w-full border-2 border-[var(--life-primary-500)] rounded px-2 py-1 text-[#111827] bg-white cursor-pointer focus:outline-none">
                        {PAGE_TITLE_OPTIONS.map(h => <option key={h} value={h}>{PAGE_TITLE_LABELS[h]}</option>)}
                      </select>
                      {customSettings.pageTitleSize !== 'H6' && <DesktopCalculatedValues />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: live preview */}
      <div style={{ position: 'sticky', top: '32px' }}>
        <p className="text-xs font-bold text-[#111827] mb-3">Live Preview</p>
        <LivePreview />
        <p className="text-xs text-[#6b7280] mt-2 text-center">Preview updates as you change settings</p>
      </div>
    </div>
  );

  return (
    // <div className="max-w-3xl w-full px-6 py-6">
    <div className="w-full px-6 py-6 font-[var(--font-family-primary)]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--life-base-black)]">
            Select Theme <span className="text-red-500">*</span>
          </h2>
          <p className="text-sm text-[var(--life-neutral-300)] mt-0.5">Choose a theme for your course.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {THEMES.map((theme) => {
          const isSelected = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setSelected(theme.id)}
              className={`relative text-left rounded-xl border-2 p-5 transition-all cursor-pointer focus:outline-none ${
                isSelected
                  ? "border-[var(--life-primary-500)] bg-[var(--life-primary-020)] shadow-md"
                  : "border-[#e5e7eb] bg-white hover:border-[var(--life-primary-300)] hover:shadow-sm"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--life-primary-500)] flex items-center justify-center shadow">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
              <p className="font-semibold text-[#111827] text-sm mb-1">{theme.name}</p>
              <p className="text-xs text-[#6b7280] leading-snug mb-4">{theme.description}</p>
              <div className="flex gap-2">
                {theme.swatches.map((color) => (
                  <span
                    key={color}
                    className="w-8 h-8 rounded-md border border-black/10 inline-block"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <div className="h-px bg-[#e5e7eb] my-5" />

      {/* Preset Section */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--life-base-black)]">Preset:</span>
          <select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-[#d1d5db] rounded-md bg-white text-[#111827] cursor-pointer outline-none focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent"
          >
            <option value="">No preset</option>
            {presets.map((p) => (
              <option key={p._id} value={p._id}>{p.displayName}</option>
            ))}
          </select>
        </div>
        {showPresetNameInput ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Preset name"
              className="text-xs px-2.5 py-1.5 border border-[#d1d5db] rounded-md focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') { setShowPresetNameInput(false); setNewPresetName(''); } }}
              autoFocus
            />
            <button onClick={handleSavePreset} className="text-xs font-semibold px-3 py-1.5 bg-[var(--life-primary-500)] text-white rounded-md hover:bg-[var(--life-primary-700)] transition-colors">
              OK
            </button>
            <button onClick={() => { setShowPresetNameInput(false); setNewPresetName(''); }} className="text-xs px-3 py-1.5 border border-[#d1d5db] text-[#6b7280] rounded-md hover:bg-[#f9fafb] transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPresetNameInput(true)}
            disabled={!selected}
            className="text-xs font-semibold px-5 py-1.5 border border-[var(--life-primary-500)] text-[var(--life-primary-500)] rounded-md hover:bg-[var(--life-primary-020)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save preset
          </button>
        )}
        {presets.length > 0 && !showPresetNameInput && (
          <button
            type="button"
            onClick={() => setShowManagePresetsModal(true)}
            disabled={!selected}
            className="text-xs font-semibold px-5 py-1.5 border border-[#d1d5db] text-[#374151] rounded-md hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Manage presets
          </button>
        )}
      </div>

      {showManagePresetsModal && (
        <ManagePresetsModal
          presets={presets}
          onClose={() => setShowManagePresetsModal(false)}
          onPresetRenamed={(updated) => {
            setPresets((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
          }}
          onPresetDeleted={(deletedId) => {
            setPresets((prev) => prev.filter((p) => p._id !== deletedId));
            if (selectedPresetId === deletedId) setSelectedPresetId('');
          }}
        />
      )}

      <p className="text-xs text-[#6b7280] mb-5 leading-relaxed">
        <strong className="text-[#111827]">Tip:</strong> You can save your selections as a 'preset' for quick access later.
      </p>

      {/* Separator */}
      <div className="h-px bg-[#e5e7eb] mb-4" />

      {/* Configuration Accordions - shown based on selected theme */}
      <div className="space-y-2">
        {/* Configuration: Course - LIFE and Custom */}
        {selected !== "vanilla" && (
          <ThemeAccordion
            label="Configuration: Course"
            isOpen={activeAccordion === "Configuration: Course"}
            onToggle={() => setActiveAccordion(activeAccordion === "Configuration: Course" ? null : "Configuration: Course")}
          >
            <div className="space-y-6">
              {selected === 'life' || selected === 'custom' ? (
                <>
                  <LifeListField
                    title="Custom Icons: Sprite Sheets"
                    description="Add a reference to an external sprite sheet with icons that can be used in the course."
                    items={lifeCourseConfig._svgSpriteSheets}
                    idLabel="Icon Set Name"
                    idKey="_spriteSheetId"
                    onAdd={() => setLifeCourseConfig((prev) => ({
                      ...prev,
                      _svgSpriteSheets: [...prev._svgSpriteSheets, { _spriteSheetId: '', src: '' }],
                    }))}
                    onRemove={(index) => setLifeCourseConfig((prev) => ({
                      ...prev,
                      _svgSpriteSheets: prev._svgSpriteSheets.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                    onChange={(index, key, value) => setLifeCourseConfig((prev) => ({
                      ...prev,
                      _svgSpriteSheets: prev._svgSpriteSheets.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, [key]: value } : item
                      )),
                    }))}
                  />
                  <LifeListField
                    title="Custom Icons: Single Icons"
                    description="Add a reference to an external individual icon that can be used in the course."
                    items={lifeCourseConfig._singleIcons}
                    idLabel="Icon Id"
                    idKey="iconId"
                    onAdd={() => setLifeCourseConfig((prev) => ({
                      ...prev,
                      _singleIcons: [...prev._singleIcons, { iconId: '', src: '' }],
                    }))}
                    onRemove={(index) => setLifeCourseConfig((prev) => ({
                      ...prev,
                      _singleIcons: prev._singleIcons.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                    onChange={(index, key, value) => setLifeCourseConfig((prev) => ({
                      ...prev,
                      _singleIcons: prev._singleIcons.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, [key]: value } : item
                      )),
                    }))}
                  />
                </>
              ) : null}
            </div>
          </ThemeAccordion>
        )}

        {/* Configuration: Blocks - LIFE and Custom */}
        {selected !== "vanilla" && (
          <ThemeAccordion
            label="Configuration: Blocks"
            isOpen={activeAccordion === "Configuration: Blocks"}
            onToggle={() => setActiveAccordion(activeAccordion === "Configuration: Blocks" ? null : "Configuration: Blocks")}
          >
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-[#111827] mb-2">Spacing top</p>
                <select
                  value={lifeBlocksConfig._paddingTop}
                  onChange={(e) => setLifeBlocksConfig((prev) => ({ ...prev, _paddingTop: e.target.value }))}
                  className="text-xs px-2.5 py-1.5 border border-[#d1d5db] rounded-md bg-white text-[#111827] cursor-pointer outline-none focus:border-[var(--life-primary-500)]"
                  style={{ minWidth: "110px" }}
                >
                  <option value=""></option>
                  <option value="double">Double</option>
                  <option value="half">Half</option>
                  <option value="remove">Remove</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#111827] mb-2">Spacing bottom</p>
                <select
                  value={lifeBlocksConfig._paddingBottom}
                  onChange={(e) => setLifeBlocksConfig((prev) => ({ ...prev, _paddingBottom: e.target.value }))}
                  className="text-xs px-2.5 py-1.5 border border-[#d1d5db] rounded-md bg-white text-[#111827] cursor-pointer outline-none focus:border-[var(--life-primary-500)]"
                  style={{ minWidth: "110px" }}
                >
                  <option value=""></option>
                  <option value="double">Double</option>
                  <option value="half">Half</option>
                  <option value="remove">Remove</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
            </div>
          </ThemeAccordion>
        )}

        {/* Configuration: Components - LIFE and Custom only */}
        {selected !== "vanilla" && (
          <ThemeAccordion
            label="Configuration: Components"
            isOpen={activeAccordion === "Configuration: Components"}
            onToggle={() => setActiveAccordion(activeAccordion === "Configuration: Components" ? null : "Configuration: Components")}
          >
            <div className="space-y-5">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCheckNotFinal(!checkNotFinal)}>
                <div 
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    border: `1.5px solid ${checkNotFinal ? "var(--life-primary-500)" : "#d1d5db"}`,
                    backgroundColor: checkNotFinal ? "var(--life-primary-500)" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                    flexShrink: 0
                  }}
                >
                  {checkNotFinal && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#111827] leading-normal">Display marking for not-final attempts</span>
              </div>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCheckUnanswered(!checkUnanswered)}>
                <div 
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    border: `1.5px solid ${checkUnanswered ? "var(--life-primary-500)" : "#d1d5db"}`,
                    backgroundColor: checkUnanswered ? "var(--life-primary-500)" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                    flexShrink: 0
                  }}
                >
                  {checkUnanswered && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#111827] leading-normal">Display marking for unanswered correct responses</span>
              </div>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCheckHideFeedback(!checkHideFeedback)}>
                <div 
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    border: `1.5px solid ${checkHideFeedback ? "var(--life-primary-500)" : "#d1d5db"}`,
                    backgroundColor: checkHideFeedback ? "var(--life-primary-500)" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                    flexShrink: 0
                  }}
                >
                  {checkHideFeedback && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#111827] leading-normal">Hide feedback on first attempt on assessments</span>
              </div>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCheckHidePartial(!checkHidePartial)}>
                <div 
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    border: `1.5px solid ${checkHidePartial ? "var(--life-primary-500)" : "#d1d5db"}`,
                    backgroundColor: checkHidePartial ? "var(--life-primary-500)" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                    flexShrink: 0
                  }}
                >
                  {checkHidePartial && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#111827] leading-normal">Hide partially correct feedback on the question and result page</span>
              </div>
            </div>
          </ThemeAccordion>
        )}

        {/* On Screen Classes - always visible */}
        <ThemeAccordion
          label="On Screen Classes"
          isOpen={activeAccordion === "On Screen Classes"}
          onToggle={() => setActiveAccordion(activeAccordion === "On Screen Classes" ? null : "On Screen Classes")}
        >
          <div className="space-y-5">
            <p className="text-xs text-[#6b7280] leading-relaxed">
              These settings allow you to attach classes when content is within the browser viewport.
              Supported classes include fade-in, fade-in-left, fade-in-right, fade-in-top, and fade-in-bottom.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setOnScreenConfig((prev) => ({ ...prev, _isEnabled: !prev._isEnabled }))}
                className="relative w-10 h-5.5 rounded-full border-none cursor-pointer flex-shrink-0 transition-colors"
                style={{ backgroundColor: onScreenConfig._isEnabled ? "var(--life-primary-500)" : "#d1d5db" }}
              >
                <span
                  className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all"
                  style={{
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.25)",
                    transform: onScreenConfig._isEnabled ? "translateX(18px)" : "translateX(0)",
                  }}
                />
              </button>
              <span className="text-xs text-[#111827] font-semibold">Enable On Screen Classes</span>
            </div>

            {onScreenConfig._isEnabled && (
              <div className="space-y-4 pt-1">
                {ON_SCREEN_ROW_DEFS.map((row) => {
                  const rowConfig = onScreenConfig._levels[row.key];
                  return (
                    <div key={row.key} className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4 space-y-3">
                      <span className="text-xs font-bold text-[#111827]">{row.label}</span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[#6b7280] mb-2">Classes</p>
                          <select
                            value={rowConfig._classes}
                            onChange={(e) => updateOnScreenRow(row.key, { _classes: e.target.value })}
                            className="text-xs w-full border border-[#d1d5db] rounded-md px-2.5 py-1.5 text-[#111827] bg-white focus:border-[var(--life-primary-500)] outline-none"
                          >
                            <option value="">Select a class</option>
                            {ON_SCREEN_CLASS_OPTIONS.filter((option) => option !== '').map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-[#6b7280] mb-2">Percent in view</p>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={rowConfig._percentInviewVertical}
                            onChange={(e) => {
                              const parsed = Number(e.target.value);
                              const safeValue = Number.isFinite(parsed)
                                ? Math.max(0, Math.min(100, parsed))
                                : DEFAULT_ON_SCREEN_CONFIG._percentInviewVertical;
                              updateOnScreenRow(row.key, { _percentInviewVertical: safeValue });
                            }}
                            className="text-xs w-full border border-[#d1d5db] rounded-md px-2.5 py-1.5 text-[#111827] bg-white focus:border-[var(--life-primary-500)] outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ThemeAccordion>
      </div>

      {/* Vanilla Theme Settings - only shown when Vanilla is selected */}
      {selected === "vanilla" && (
        <div className="border border-[#e5e7eb] rounded-xl p-6 bg-white mt-2">
          <h3 className="text-sm font-bold text-[#111827] mb-4">Vanilla Theme Settings</h3>
          <div className="space-y-2">
            {VANILLA_ACCORDION_DEFS.map((acc) => {
              const isOpen = activeVanillaAccordion === acc.id;
              return (
                <div key={acc.id} className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setActiveVanillaAccordion(isOpen ? null : acc.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 transition-colors border-b border-[#e5e7eb] ${isOpen ? 'bg-[#f9fafb]' : 'bg-white hover:bg-[#f9fafb]'}`}
                  >
                    <span className="text-xs font-bold text-[#111827]">{acc.label}</span>
                    <svg
                      className={`w-4 h-4 text-[#6b7280] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-4 py-4 bg-white border-t border-[#e5e7eb]">
                      <div className="flex flex-col gap-4">
                        {acc.fields.map((field) => {
                          const key = `${acc.id}::${field.key}`;
                          const colorVal = vanillaColors[key] ?? '';
                          const isEmpty = !colorVal;
                          return (
                            <div key={field.key}>
                              <p className="text-xs text-[#111827] mb-2 leading-snug">{field.label}</p>
                              <label
                                style={{
                                  display: 'block',
                                  width: '56px',
                                  height: '56px',
                                  borderRadius: '10px',
                                  border: '1px solid #e5e7eb',
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  position: 'relative',
                                  flexShrink: 0,
                                }}
                              >
                                {isEmpty ? (
                                  <div style={{ width: '100%', height: '100%', backgroundImage: 'repeating-conic-gradient(#d0d0d0 0% 25%, #f8f8f8 0% 50%)', backgroundSize: '10px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ opacity: 0.45 }}>
                                      <line x1="4" y1="4" x2="18" y2="18" stroke="#888" strokeWidth="2" strokeLinecap="round" />
                                      <line x1="18" y1="4" x2="4" y2="18" stroke="#888" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                  </div>
                                ) : (
                                  <div style={{ width: '100%', height: '100%', background: colorVal }} />
                                )}
                                <input
                                  type="color"
                                  value={colorVal || '#ffffff'}
                                  onChange={(e) => setVanillaColors(prev => ({ ...prev, [key]: e.target.value }))}
                                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }}
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Theme Settings - only shown when Custom is selected */}
      {selected === "custom" && (
        <div className="mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column: Breadcrumb + Accordions */}
            <div className="space-y-4">
              <div className="text-xs text-[#6b7280]">
                <span className="font-semibold">Theme</span>
                {activeCustomAccordion && (
                  <>
                    <span className="mx-1.5">/</span>
                    <span className="font-semibold">{CUSTOM_ACCORDION_DEFS.find(a => a.id === activeCustomAccordion)?.label}</span>
                  </>
                )}
              </div>

              <div className="space-y-2">
                {CUSTOM_ACCORDION_DEFS.map((acc) => {
                  const isOpen = activeCustomAccordion === acc.id;
                  return (
                    <div key={acc.id} className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                      <button
                        onClick={() => setActiveCustomAccordion(isOpen ? null : acc.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isOpen ? 'bg-[#f9fafb]' : 'bg-white hover:bg-[#f9fafb]'}`}
                      >
                        <span className="text-xs font-bold text-[#111827]">{acc.label}</span>
                        <svg
                          className={`w-4 h-4 text-[#6b7280] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="px-4 py-4 bg-white border-t border-[#e5e7eb]">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                            {acc.fields.map((field) => {
                              const key = `${acc.id}::${field.key}`;
                              const value = customSettings[key] ?? CUSTOM_FIELD_DEFAULTS[key] ?? '';

                              if (field.inputType === 'select') {
                                return (
                                  <div
                                    key={field.key}
                                    className={acc.id === '_global' && field.key === 'page-heading-font-size' ? 'col-span-2' : ''}
                                  >
                                    <p className="text-xs font-bold text-[#111827] mb-2">{field.label}</p>
                                    <select
                                      value={value}
                                      onChange={(e) => setCustomSettingWithDependencies(key, e.target.value)}
                                      className="text-xs w-full border border-[#d1d5db] rounded px-2 py-1 text-[#111827] bg-white cursor-pointer focus:border-[var(--life-primary-500)] outline-none"
                                    >
                                      {(field.options ?? []).map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                    {acc.id === '_global' && field.key === 'page-heading-font-size' && <DesktopCalculatedValues />}
                                  </div>
                                );
                              }

                              return (
                                <ColorPickerField
                                  key={field.key}
                                  label={field.label}
                                  value={value || '#ffffff'}
                                  onChange={(nextValue) => setCustomSettingWithDependencies(key, nextValue)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right column: Live Preview (Sticky) */}
            <div>
              <div className="sticky top-6">
                <LivePreview />
              </div>
            </div>
          </div>
        </div>
      )}

      <UnsavedChangesModal
        isOpen={showConfirmModal}
        isSaving={saving}
        onSave={handleSave}
        onDiscard={() => {
          handleDiscardChanges();
          const navTarget = consumePendingNavigation();
          if (navTarget) onNavigationRequest?.(navTarget);
        }}
        onClose={clearPendingNavigation}
      />

      {/* Floating "Unsaved changes" bar — only while the form is dirty */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-[var(--life-warning-100)] shadow-lg animate-fade-in-down">
          <span className="flex items-center gap-2 text-sm text-[#374151]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-warning-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Unsaved changes
          </span>
          {saveError && <span className="text-xs text-[#ef4444] max-w-[180px] truncate">{saveError}</span>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selected || !courseId}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--life-base-white)] bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Theme Accordion Component */
/* Manage Presets Modal */
function ManagePresetsModal({
  presets,
  onClose,
  onPresetRenamed,
  onPresetDeleted,
}: {
  presets: ThemePreset[];
  onClose: () => void;
  onPresetRenamed: (preset: ThemePreset) => void;
  onPresetDeleted: (presetId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function startEdit(preset: ThemePreset) {
    setEditingId(preset._id);
    setEditingName(preset.displayName);
    setEditError(null);
    setConfirmDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
    setEditError(null);
  }

  async function saveEdit(preset: ThemePreset) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditError('Name is required.');
      return;
    }
    const duplicate = presets.some(
      (p) => p._id !== preset._id && p.displayName.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setEditError('A preset with this name already exists.');
      return;
    }
    try {
      await renameThemePreset(preset._id, trimmed);
      onPresetRenamed({ ...preset, displayName: trimmed });
      setEditingId(null);
      setEditingName('');
      setEditError(null);
    } catch {
      setEditError('Failed to rename preset.');
    }
  }

  async function confirmDelete(preset: ThemePreset) {
    setDeletingId(preset._id);
    setErrorMsg(null);
    try {
      await deleteThemePreset(preset._id);
      onPresetDeleted(preset._id);
      setConfirmDeleteId(null);
    } catch {
      setErrorMsg('Failed to delete preset.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb]">
          <h3 className="text-sm font-bold text-[#111827]">Manage presets</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-[#6b7280] px-5 pt-4 pb-2 leading-relaxed">
          You can view, rename and delete the saved presets for the chosen theme here.
        </p>

        {errorMsg && (
          <p className="text-xs text-[#ef4444] px-5 pb-2">{errorMsg}</p>
        )}

        {/* Preset list */}
        <div className="px-5 pb-5 space-y-2 max-h-80 overflow-y-auto">
          {presets.length === 0 && (
            <p className="text-xs text-[#6b7280] italic py-3">No presets available.</p>
          )}
          {presets.map((preset) => (
            <div key={preset._id} className="border border-[#e5e7eb] rounded-lg px-3 py-2.5 bg-[#fafafa] space-y-2">
              {editingId === preset._id ? (
                /* Edit mode */
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => { setEditingName(e.target.value); setEditError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(preset); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    className="text-xs w-full border border-[#d1d5db] rounded-md px-2.5 py-1.5 text-[#111827] focus:ring-2 focus:ring-[var(--life-primary-500)] focus:border-transparent outline-none"
                  />
                  {editError && <p className="text-xs text-[#ef4444]">{editError}</p>}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => saveEdit(preset)}
                      className="text-xs font-semibold px-3 py-1.5 bg-[var(--life-primary-500)] text-white rounded-md hover:bg-[var(--life-primary-700)] transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="text-xs px-3 py-1.5 border border-[#d1d5db] text-[#6b7280] rounded-md hover:bg-[#f9fafb] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : confirmDeleteId === preset._id ? (
                /* Delete confirmation */
                <div className="space-y-1.5">
                  <p className="text-xs text-[#374151] leading-snug">
                    Delete preset <strong>"{preset.displayName}"</strong>?{' '}
                    <span className="font-semibold text-[#ef4444]">This will affect any existing courses using this preset.</span>
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => confirmDelete(preset)}
                      disabled={deletingId === preset._id}
                      className="text-xs font-semibold px-3 py-1.5 bg-[#ef4444] text-white rounded-md hover:bg-[#dc2626] disabled:opacity-50 transition-colors"
                    >
                      {deletingId === preset._id ? 'Deleting…' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs px-3 py-1.5 border border-[#d1d5db] text-[#6b7280] rounded-md hover:bg-[#f9fafb] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal row */
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#111827] truncate flex-1">{preset.displayName}</span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(preset)}
                      title="Rename preset"
                      className="p-1.5 rounded-md border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[var(--life-primary-500)] transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setConfirmDeleteId(preset._id); cancelEdit(); }}
                      title="Delete preset"
                      className="p-1.5 rounded-md border border-[#e5e7eb] text-[#6b7280] hover:bg-[#fef2f2] hover:text-[#ef4444] hover:border-[#ef4444] transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#e5e7eb] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-4 py-2 bg-[var(--life-primary-500)] text-white rounded-lg hover:bg-[var(--life-primary-700)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeAccordion({
  label,
  children,
  isOpen,
  onToggle
}: {
  label: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[var(--life-neutral-100)] transition-colors border-b border-[var(--life-neutral-200)]"
      >
        <span className="text-sm font-semibold text-[var(--life-base-black)]">{label}</span>
        <svg
          className={`w-4 h-4 text-[#6b7280] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-white border-t border-[#e5e7eb]">
          {children}
        </div>
      )}
    </div>
  );
}

