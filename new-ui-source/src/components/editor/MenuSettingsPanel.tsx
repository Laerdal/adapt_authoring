"use client";

import { useRef, useState } from "react";
import type { MenuPageData } from "./MenuPageCanvas";

type TextAlign = MenuPageData["textAlign"];

interface MenuSettingsPanelProps {
  data: MenuPageData;
  onUpdate: (patch: Partial<MenuPageData>) => void;
  onClose: () => void;
}

const MENU_STYLES = ["Box Menu", "Overview Menu", "LIFE Menu"];
const LOCK_TYPES = ["Sequential", "Free Navigation", "Locked"];

const TOOLBAR_ACTIONS = [
  {
    label: "Bold",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      </svg>
    ),
  },
  {
    label: "Italic",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" />
      </svg>
    ),
  },
  {
    label: "Bullet list",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" />
        <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Numbered list",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
        <path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
      </svg>
    ),
  },
  {
    label: "Link",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    label: "More options",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export default function MenuSettingsPanel({ data, onUpdate, onClose }: MenuSettingsPanelProps) {
  const [menuStyleOpen, setMenuStyleOpen] = useState(false);
  const [lockTypeOpen, setLockTypeOpen] = useState(false);

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
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#e5e7eb] shrink-0">
        <span className="text-sm font-semibold text-[#111827]">Edit MenuPage</span>
        <button
          type="button"
          aria-label="Close edit panel"
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col divide-y divide-[#f3f4f6]">

          {/* Display Title */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151] flex items-center gap-1">
              Display Title
              <span className="text-[#dc2626]">*</span>
            </label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Menu Page"
              className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
            />
          </section>

          {/* Subtitle */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Subtitle</label>
            <input
              type="text"
              value={data.subtitle}
              onChange={(e) => onUpdate({ subtitle: e.target.value })}
              placeholder="Course navigation menu"
              className="w-full text-sm text-[#374151] border border-[#d1d5db] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af]"
            />
          </section>

          {/* Page Body */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Page Body</label>
            <div className="border border-[#d1d5db] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#2d6fa8] focus-within:border-transparent">
              {/* Toolbar */}
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#e5e7eb] bg-[#f9fafb]">
                {TOOLBAR_ACTIONS.map((action, i) => (
                  <button
                    key={action.label}
                    type="button"
                    aria-label={action.label}
                    className={`w-7 h-7 flex items-center justify-center rounded text-[#374151] hover:bg-[#e5e7eb] transition-colors ${
                      i < TOOLBAR_ACTIONS.length - 1 &&
                      (action.label === "Italic" || action.label === "Numbered list" || action.label === "Link")
                        ? "mr-1"
                        : ""
                    }`}
                  >
                    {action.icon}
                  </button>
                ))}
              </div>
              {/* Body textarea */}
              <textarea
                rows={4}
                value={data.body}
                onChange={(e) => onUpdate({ body: e.target.value })}
                placeholder="Configure your course menu settings"
                className="w-full text-sm text-[#374151] px-3 py-2.5 resize-none focus:outline-none placeholder-[#9ca3af] bg-white"
              />
            </div>
          </section>

          {/* Menu Style */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Menu Style</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setMenuStyleOpen((o) => !o); setLockTypeOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-[#d1d5db] rounded-lg bg-white text-sm text-[#374151] hover:border-[#9ca3af] transition-colors"
              >
                <span>{data.menuStyle}</span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform text-[#6b7280] ${menuStyleOpen ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {menuStyleOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                  {MENU_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => { onUpdate({ menuStyle: style as MenuPageData["menuStyle"] }); setMenuStyleOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors ${
                        data.menuStyle === style
                          ? "bg-[#dbeeff] text-[#2d6fa8] font-medium"
                          : "text-[#374151] hover:bg-[#f9fafb]"
                      }`}
                    >
                      {style}
                      {data.menuStyle === style && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Menu Lock Type */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Menu Lock Type</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setLockTypeOpen((o) => !o); setMenuStyleOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-[#d1d5db] rounded-lg bg-white text-sm text-[#374151] hover:border-[#9ca3af] transition-colors"
              >
                <span className={data.menuLockType ? "text-[#374151]" : "text-[#9ca3af]"}>
                  {data.menuLockType || "Select lock type"}
                </span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform text-[#6b7280] ${lockTypeOpen ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {lockTypeOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                  {LOCK_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { onUpdate({ menuLockType: type }); setLockTypeOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors ${
                        data.menuLockType === type
                          ? "bg-[#dbeeff] text-[#2d6fa8] font-medium"
                          : "text-[#374151] hover:bg-[#f9fafb]"
                      }`}
                    >
                      {type}
                      {data.menuLockType === type && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Text Alignment */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">Text Alignment</label>
            <p className="text-xs text-[#9ca3af] -mt-0.5">Title Alignment</p>
            <div className="flex rounded-lg border border-[#d1d5db] overflow-hidden">
              {(["left", "center", "right"] as TextAlign[]).map((align) => (
                <button
                  key={align}
                  type="button"
                  aria-label={`Align ${align}`}
                  onClick={() => onUpdate({ textAlign: align })}
                  className={`flex-1 flex items-center justify-center py-2.5 transition-colors ${
                    data.textAlign === align
                      ? "bg-[#2d6fa8] text-white"
                      : "bg-white text-[#6b7280] hover:bg-[#f3f4f6]"
                  } ${align !== "left" ? "border-l border-[#d1d5db]" : ""}`}
                >
                  {align === "left" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" />
                      <line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
                    </svg>
                  )}
                  {align === "center" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="21" y1="6" x2="3" y2="6" /><line x1="17" y1="10" x2="7" y2="10" />
                      <line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="7" y2="18" />
                    </svg>
                  )}
                  {align === "right" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" />
                      <line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </section>

        </div>
      </div>
    </aside>
  );
}
