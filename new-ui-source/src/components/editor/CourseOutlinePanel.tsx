"use client";

import { useState, useRef, useEffect } from "react";
import type { ContentPageData } from "@/components/course/CourseEditor";

const SCREEN_SIZE_OPTIONS = ["Small", "Medium", "Large", "Extra Large"];
const LOG_LEVEL_OPTIONS = ["Info", "Debug", "Warn", "Error", "None"];

function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-[#f9fafb] hover:bg-[#f3f4f6] transition-colors text-left"
      >
        <span className="text-xs font-semibold text-[#374151]">{title}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform text-[#9ca3af] ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="px-3 py-3 flex flex-col gap-3 bg-white">{children}</div>}
    </div>
  );
}

function InlineDropdown({
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
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#374151]">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2 border border-[#d1d5db] rounded-lg bg-white text-xs text-[#374151] hover:border-[#9ca3af] transition-colors"
        >
          <span>{value}</span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-20 py-1 overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                  value === opt ? "bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"
                }`}
              >
                {opt}
                {value === opt && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

function InlineCheckbox({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none group">
      <div
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
          checked ? "bg-[#2d6fa8] border-[#2d6fa8]" : "bg-white border-[#d1d5db] group-hover:border-[#9ca3af]"
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className="text-xs text-[#374151]">{label}</span>
    </label>
  );
}

function TechnicalSettingsSection() {
  const [open, setOpen] = useState(false);

  // Display & Responsiveness
  const [screenSize, setScreenSize] = useState("Medium");
  const [smallBp, setSmallBp] = useState("");
  const [mediumBp, setMediumBp] = useState("");
  const [largeBp, setLargeBp] = useState("");
  const [xlBp, setXlBp] = useState("");

  // Accessibility & Embedding
  const [optimizedScroll, setOptimizedScroll] = useState(false);
  const [sourceMaps, setSourceMaps] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  // Runtime Behavior
  const [enableLogging, setEnableLogging] = useState(false);
  const [logLevel, setLogLevel] = useState("Info");
  const [strictMode, setStrictMode] = useState(false);

  // Custom CSS/LESS
  const [customCss, setCustomCss] = useState("");
  const [cssExpanded, setCssExpanded] = useState(false);

  return (
    <div className="border-t border-[#e5e7eb] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f9fafb] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <div className="text-left">
            <p className="text-xs font-bold text-[#111827]">Technical Settings</p>
            <p className="text-[10px] text-[#9ca3af] mt-0.5">Advanced configuration settings for developers and advanced users</p>
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform text-[#9ca3af] shrink-0 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* Display & Responsiveness */}
          <AccordionSection title="Display & Responsiveness">
            <InlineDropdown label="Screen Size" value={screenSize} options={SCREEN_SIZE_OPTIONS} onChange={setScreenSize} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#374151]">Small</label>
              <textarea rows={2} value={smallBp} onChange={(e) => setSmallBp(e.target.value)} placeholder="Small breakpoint CSS" className="w-full text-xs text-[#374151] border border-[#d1d5db] rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#374151]">Medium</label>
              <textarea rows={2} value={mediumBp} onChange={(e) => setMediumBp(e.target.value)} placeholder="Medium breakpoint CSS" className="w-full text-xs text-[#374151] border border-[#d1d5db] rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#374151]">Large</label>
              <textarea rows={2} value={largeBp} onChange={(e) => setLargeBp(e.target.value)} placeholder="Large breakpoint CSS" className="w-full text-xs text-[#374151] border border-[#d1d5db] rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#374151]">Extra Large</label>
              <textarea rows={2} value={xlBp} onChange={(e) => setXlBp(e.target.value)} placeholder="Extra large breakpoint CSS" className="w-full text-xs text-[#374151] border border-[#d1d5db] rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]" />
            </div>
          </AccordionSection>

          {/* Accessibility & Embedding */}
          <AccordionSection title="Accessibility & Embedding">
            <p className="text-xs text-[#6b7280] -mt-1">Control how your course behaves in assistive and embedded environments.</p>
            <div className="flex flex-col gap-2.5">
              <InlineCheckbox id="opt-scroll" label="Enable optimized scrolling in iFrames" checked={optimizedScroll} onChange={setOptimizedScroll} />
              <InlineCheckbox id="src-maps" label="Generate source maps" checked={sourceMaps} onChange={setSourceMaps} />
            </div>
            <div className="pt-2 border-t border-[#f3f4f6]">
              <p className="text-xs font-semibold text-[#374151] mb-2">Accessibility</p>
              <InlineCheckbox id="screen-reader" label="Enable screen reader support" checked={screenReader} onChange={setScreenReader} />
            </div>
          </AccordionSection>

          {/* Runtime Behavior */}
          <AccordionSection title="Runtime Behavior">
            <p className="text-xs text-[#6b7280] -mt-1">Configure how your course operates when run.</p>
            <div className="flex flex-col gap-2.5">
              <InlineCheckbox id="enable-log" label="Enable logging" checked={enableLogging} onChange={setEnableLogging} />
              {enableLogging && (
                <InlineDropdown label="Log Level" value={logLevel} options={LOG_LEVEL_OPTIONS} onChange={setLogLevel} />
              )}
              <InlineCheckbox id="strict-mode" label="Use strict mode?" checked={strictMode} onChange={setStrictMode} />
            </div>
          </AccordionSection>

          {/* Custom CSS/LESS */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#374151]">Custom CSS/LESS</label>
              <button
                type="button"
                aria-label={cssExpanded ? "Collapse" : "Expand"}
                onClick={() => setCssExpanded((o) => !o)}
                className="w-5 h-5 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
              >
                {cssExpanded ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                )}
              </button>
            </div>
            <div className={`border border-[#d1d5db] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#2d6fa8] focus-within:border-transparent ${cssExpanded ? "fixed inset-4 z-50 shadow-2xl flex flex-col bg-white" : ""}`}>
              {cssExpanded && (
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#e5e7eb] bg-[#f9fafb] shrink-0">
                  <span className="text-xs font-semibold text-[#374151]">Custom CSS/LESS</span>
                  <button type="button" aria-label="Collapse CSS editor" onClick={() => setCssExpanded(false)} className="w-5 h-5 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#e5e7eb] transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
                className={`w-full text-xs text-[#374151] px-2.5 py-2 resize-none focus:outline-none placeholder-[#9ca3af] bg-white font-mono ${cssExpanded ? "flex-1 h-0" : "h-28"}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type NavFlow = "Structure Order" | "Custom Flow";

interface CourseOutlinePanelProps {
  onClose: () => void;
  menuPageCreated: boolean;
  menuSelected: boolean;
  onMenuSelect: () => void;
  contentPages: ContentPageData[];
  selectedPageId: string | null;
  selectedSubPageId?: string | null;
  selectedArticleId?: string | null;
  onPageSelect: (pageId: string) => void;
  onSubPageSelect: (pageId: string, subPageId: string) => void;
  onArticleSelect: (pageId: string, articleId: string) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
  onAddArticle: (pageId: string) => void;
  onAddSubPage: (pageId: string) => void;
}

export default function CourseOutlinePanel({
  onClose,
  menuPageCreated,
  menuSelected,
  onMenuSelect,
  contentPages,
  selectedPageId,
  selectedSubPageId,
  selectedArticleId,
  onPageSelect,
  onSubPageSelect,
  onArticleSelect,
  onAddPage,
  onDeletePage,
  onAddArticle,
  onAddSubPage,
}: CourseOutlinePanelProps) {
  const [navFlow, setNavFlow] = useState<NavFlow>("Structure Order");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navOptions: NavFlow[] = ["Structure Order", "Custom Flow"];

  return (
    <div className="w-72 h-full bg-white border-r border-[#e5e7eb] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[#e5e7eb] shrink-0">
        <span className="text-xs font-bold tracking-widest text-[#111827] uppercase">
          Course Outline
        </span>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Navigation Flow */}
      <div className="px-4 pt-5 pb-4 border-b border-[#e5e7eb] shrink-0">
        <p className="text-sm font-bold text-[#111827] mb-3">Navigation Flow</p>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 border border-[#d1d5db] rounded-lg bg-white text-sm text-[#6b7280] hover:border-[#9ca3af] transition-colors"
          >
            <span>{navFlow}</span>
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform text-[#374151] ${dropdownOpen ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-20 py-1 overflow-hidden">
              {navOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { setNavFlow(opt); setDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                    navFlow === opt
                      ? "bg-[#dbeeff] text-[#2d6fa8] font-medium"
                      : "text-[#374151] hover:bg-[#f9fafb]"
                  }`}
                >
                  {opt}
                  {navFlow === opt && (
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

      {/* Course Outline section */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Section header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <span className="text-sm font-bold text-[#111827]">Course Outline</span>
          <div className="flex items-center gap-1">
            <div className="relative group">
              <button
                type="button"
                aria-label="Add page"
                onClick={onAddPage}
                className="w-7 h-7 flex items-center justify-center rounded text-[#2d6fa8] hover:bg-[#dbeeff] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <div className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-[#111827] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Add page
              </div>
            </div>
            <button
              type="button"
              aria-label="Add from template"
              className="w-7 h-7 flex items-center justify-center rounded text-[#2d6fa8] hover:bg-[#dbeeff] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="3" y="11" width="7" height="10" rx="1" />
                <rect x="14" y="11" width="7" height="10" rx="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Outline items */}
        <div className="flex-1 overflow-y-auto">
          {menuPageCreated ? (
            <div>
              {/* Menu Page */}
              <button
                type="button"
                onClick={onMenuSelect}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  menuSelected
                    ? "bg-[#dbeeff] border-l-2 border-[#2d6fa8]"
                    : "hover:bg-[#f9fafb] border-l-2 border-transparent"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  menuSelected ? "bg-[#2d6fa8]" : "bg-[#f3f4f6]"
                }`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={menuSelected ? "white" : "#6b7280"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${menuSelected ? "text-[#2d6fa8]" : "text-[#111827]"}`}>
                    Menu Page
                  </p>
                  <p className="text-xs text-[#9ca3af] truncate mt-0.5">Course navigation menu</p>
                </div>
              </button>

              {/* Content Pages */}
              {contentPages.map((page) => (
                <div key={page.id}>
                  <div
                    onClick={() => onPageSelect(page.id)}
                    className={`flex items-center gap-3 px-4 py-3 text-left transition-colors group cursor-pointer ${
                      selectedPageId === page.id
                        ? "bg-[#dbeeff] border-l-2 border-[#2d6fa8]"
                        : "hover:bg-[#f9fafb] border-l-2 border-transparent"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selectedPageId === page.id ? "bg-[#2d6fa8]" : "bg-[#f3f4f6]"
                    }`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={selectedPageId === page.id ? "white" : "#6b7280"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${selectedPageId === page.id ? "text-[#2d6fa8]" : "text-[#111827]"}`}>
                        {page.title}
                      </p>
                      {page.description && (
                        <p className="text-xs text-[#9ca3af] truncate mt-0.5">{page.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this page?")) {
                            onDeletePage(page.id);
                          }
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#dc2626] hover:bg-[#fee2e2] transition-all"
                        aria-label="Delete page"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6h16zM10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Articles */}
                  {page.articles.map((article) => (
                    <div
                      key={article.id}
                      onClick={() => onArticleSelect(page.id, article.id)}
                      className={`flex items-center gap-2 px-8 py-2 text-left text-xs cursor-pointer transition-colors ${
                        selectedArticleId === article.id
                          ? "bg-[#dbeeff] text-[#2d6fa8] border-l-2 border-[#2d6fa8]"
                          : "text-[#6b7280] hover:bg-[#f9fafb] border-l-2 border-transparent"
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      </svg>
                      <span className="truncate">{article.title}</span>
                    </div>
                  ))}

                  {/* Sub Pages */}
                  {page.subPages.map((subPage) => (
                    <div
                      key={subPage.id}
                      onClick={() => onSubPageSelect(page.id, subPage.id)}
                      className={`flex items-center gap-2 px-8 py-2 text-left text-xs cursor-pointer transition-colors ${
                        selectedSubPageId === subPage.id
                          ? "bg-[#dbeeff] text-[#2d6fa8] border-l-2 border-[#2d6fa8]"
                          : "text-[#6b7280] hover:bg-[#f9fafb] border-l-2 border-transparent"
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                      </svg>
                      <span className="truncate">{subPage.title}</span>
                    </div>
                  ))}

                  {/* Add Article button */}
                  <button
                    type="button"
                    onClick={() => onAddArticle(page.id)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs text-[#2d6fa8] hover:bg-[#f0f8ff] transition-colors mx-4 ml-8 mr-8 mt-1 rounded"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Add Article</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-start pt-10 px-4 text-center">
              <p className="text-sm text-[#9ca3af]">No content yet.</p>
              <p className="text-sm text-[#9ca3af]">Start by creating a menu page.</p>
            </div>
          )}
        </div>
      </div>

      <TechnicalSettingsSection />
    </div>
  );
}
