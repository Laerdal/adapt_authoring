import { useState, useRef } from "react";

interface CourseSettingsPanelProps {
  onClose: () => void;
}

const SCREEN_SIZE_OPTIONS = ["Small", "Medium", "Large", "Extra Large"];
const LOG_LEVEL_OPTIONS = ["Info", "Debug", "Warn", "Error", "None"];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#f9fafb] hover:bg-[#f3f4f6] transition-colors text-left"
      >
        <span className="text-sm font-semibold text-[#111827]">{title}</span>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="px-4 py-4 flex flex-col gap-4 bg-white">{children}</div>}
    </div>
  );
}

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-[#374151]">{label}</label>}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 border border-[#d1d5db] rounded-lg bg-white text-sm text-[#374151] hover:border-[#9ca3af] transition-colors"
        >
          <span>{value}</span>
          <ChevronIcon open={open} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-20 py-1 overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors ${
                  value === opt
                    ? "bg-[#dbeeff] text-[#2d6fa8] font-medium"
                    : "text-[#374151] hover:bg-[#f9fafb]"
                }`}
              >
                {opt}
                {value === opt && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Checkbox({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer select-none group">
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "bg-white border-[#d1d5db] group-hover:border-[#9ca3af]"
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-sm text-[#374151]">{label}</span>
    </label>
  );
}

export default function CourseSettingsPanel({ onClose }: CourseSettingsPanelProps) {
  // Display & Responsiveness
  const [screenSize, setScreenSize] = useState("Medium");
  const [smallBreakpoint, setSmallBreakpoint] = useState("");
  const [mediumBreakpoint, setMediumBreakpoint] = useState("");
  const [largeBreakpoint, setLargeBreakpoint] = useState("");
  const [extraLargeBreakpoint, setExtraLargeBreakpoint] = useState("");

  // Accessibility & Embedding
  const [optimizedScrolling, setOptimizedScrolling] = useState(false);
  const [generateSourceMaps, setGenerateSourceMaps] = useState(false);
  const [screenReaderSupport, setScreenReaderSupport] = useState(false);

  // Runtime Behavior
  const [enableLogging, setEnableLogging] = useState(false);
  const [logLevel, setLogLevel] = useState("Info");
  const [strictMode, setStrictMode] = useState(false);

  // Custom CSS/LESS
  const [customCss, setCustomCss] = useState("");
  const [cssExpanded, setCssExpanded] = useState(false);

  return (
    <aside className="w-80 h-full bg-white border-l border-[#e5e7eb] flex flex-col shrink-0">
      {/* Panel label */}
      <div className="px-4 h-10 flex items-center border-b border-[#e5e7eb] shrink-0">
        <span className="text-xs font-semibold text-[#6b7280] tracking-wide uppercase">Settings Panel</span>
        <button
          type="button"
          aria-label="Close settings panel"
          onClick={onClose}
          className="ml-auto w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Section header */}
      <div className="px-4 py-3 border-b border-[#e5e7eb] shrink-0">
        <h2 className="text-sm font-semibold text-[#111827]">Technical Settings</h2>
        <p className="text-xs text-[#9ca3af] mt-0.5">Advanced configuration settings for developers and advanced users</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">

        {/* Display & Responsiveness */}
        <AccordionSection title="Display & Responsiveness">
          <Dropdown
            label="Screen Size"
            value={screenSize}
            options={SCREEN_SIZE_OPTIONS}
            onChange={setScreenSize}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Small</label>
            <textarea
              rows={2}
              value={smallBreakpoint}
              onChange={(e) => setSmallBreakpoint(e.target.value)}
              placeholder="Small breakpoint CSS"
              className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Medium</label>
            <textarea
              rows={2}
              value={mediumBreakpoint}
              onChange={(e) => setMediumBreakpoint(e.target.value)}
              placeholder="Medium breakpoint CSS"
              className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Large</label>
            <textarea
              rows={2}
              value={largeBreakpoint}
              onChange={(e) => setLargeBreakpoint(e.target.value)}
              placeholder="Large breakpoint CSS"
              className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Extra Large</label>
            <textarea
              rows={2}
              value={extraLargeBreakpoint}
              onChange={(e) => setExtraLargeBreakpoint(e.target.value)}
              placeholder="Extra large breakpoint CSS"
              className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
            />
          </div>
        </AccordionSection>

        {/* Accessibility & Embedding */}
        <AccordionSection title="Accessibility & Embedding">
          <p className="text-xs text-[#6b7280] -mt-1">
            Control how your course behaves in assistive and embedded environments.
          </p>

          <div className="flex flex-col gap-3">
            <Checkbox
              id="optimized-scroll"
              label="Enable optimized scrolling in iFrames"
              checked={optimizedScrolling}
              onChange={setOptimizedScrolling}
            />
            <Checkbox
              id="source-maps"
              label="Generate source maps"
              checked={generateSourceMaps}
              onChange={setGenerateSourceMaps}
            />
          </div>

          <div className="pt-1 border-t border-[#f3f4f6]">
            <p className="text-xs font-semibold text-[#374151] mb-2.5">Accessibility</p>
            <Checkbox
              id="screen-reader"
              label="Enable screen reader support"
              checked={screenReaderSupport}
              onChange={setScreenReaderSupport}
            />
          </div>
        </AccordionSection>

        {/* Runtime Behavior */}
        <AccordionSection title="Runtime Behavior">
          <p className="text-xs text-[#6b7280] -mt-1">
            Configure how your course operates when run.
          </p>

          <div className="flex flex-col gap-3">
            <Checkbox
              id="enable-logging"
              label="Enable logging"
              checked={enableLogging}
              onChange={setEnableLogging}
            />

            {enableLogging && (
              <Dropdown
                label="Log Level"
                value={logLevel}
                options={LOG_LEVEL_OPTIONS}
                onChange={setLogLevel}
              />
            )}

            <Checkbox
              id="strict-mode"
              label="Use strict mode?"
              checked={strictMode}
              onChange={setStrictMode}
            />
          </div>
        </AccordionSection>

        {/* Custom CSS/LESS */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#374151]">Custom CSS/LESS</label>
            <button
              type="button"
              aria-label={cssExpanded ? "Collapse" : "Expand"}
              onClick={() => setCssExpanded((o) => !o)}
              className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
            >
              {cssExpanded ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              )}
            </button>
          </div>
          <div
            className={`border border-[#d1d5db] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#2d6fa8] focus-within:border-transparent ${
              cssExpanded ? "fixed inset-4 z-50 shadow-2xl flex flex-col bg-white" : ""
            }`}
          >
            {cssExpanded && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#e5e7eb] bg-[#f9fafb] shrink-0">
                <span className="text-xs font-semibold text-[#374151]">Custom CSS/LESS</span>
                <button
                  type="button"
                  onClick={() => setCssExpanded(false)}
                  className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#e5e7eb] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
            <textarea
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder="/* Add your custom CSS or LESS here */"
              spellCheck={false}
              className={`w-full text-xs text-[#374151] px-3 py-2.5 resize-none focus:outline-none placeholder-[#9ca3af] bg-white font-mono ${
                cssExpanded ? "flex-1 h-0" : "h-36"
              }`}
            />
          </div>
        </div>

      </div>
    </aside>
  );
}
