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
    <aside className="w-80 h-full bg-white border-l border-[var(--life-neutral-100)] flex flex-col shrink-0">
      {/* Panel label */}
      <div className="px-4 h-10 flex items-center border-b border-[var(--life-neutral-100)] shrink-0">
        <span className="text-xs font-semibold text-[var(--life-neutral-600)] tracking-wide uppercase">Settings Panel</span>
        <button
          type="button"
          aria-label="Close settings panel"
          onClick={onClose}
          className="life-icon-btn life-icon-btn--xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Section header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--life-neutral-100)] shrink-0">
        <span className="text-sm font-semibold text-[var(--life-neutral-850)]">Edit MenuPage</span>
        <button
          type="button"
          aria-label="Close edit panel"
          onClick={onClose}
          className="life-icon-btn life-icon-btn--xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col divide-y divide-[var(--life-neutral-050)]">

          {/* Display Title */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--life-neutral-700)] flex items-center gap-1">
              Display Title
              <span className="text-[var(--life-critical-600)]">*</span>
            </label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Menu Page"
              className="life-field"
            />
          </section>

          {/* Subtitle */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--life-neutral-700)]">Subtitle</label>
            <input
              type="text"
              value={data.subtitle}
              onChange={(e) => onUpdate({ subtitle: e.target.value })}
              placeholder="Course navigation menu"
              className="life-field"
            />
          </section>

          {/* Page Body */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--life-neutral-700)]">Page Body</label>
            <div className="border border-[var(--life-neutral-200)] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[var(--life-primary-500)] focus-within:border-transparent">
              {/* Toolbar */}
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--life-neutral-100)] bg-[var(--life-neutral-020)]">
                {TOOLBAR_ACTIONS.map((action, i) => (
                  <button
                    key={action.label}
                    type="button"
                    aria-label={action.label}
                    className={`w-7 h-7 flex items-center justify-center rounded text-[var(--life-neutral-700)] hover:bg-[var(--life-neutral-100)] transition-colors ${
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
                className="w-full text-sm text-[var(--life-neutral-700)] px-3 py-2.5 resize-none focus:outline-none placeholder-[var(--life-neutral-400)] bg-white"
              />
            </div>
          </section>

          {/* Menu Style */}
          <section className="px-4 py-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--life-neutral-700)]">Menu Style</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setMenuStyleOpen((o) => !o); setLockTypeOpen(false); }}
                className="life-btn life-btn--secondary"
              >
                <span>{data.menuStyle}</span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform text-[var(--life-neutral-600)] ${menuStyleOpen ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {menuStyleOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--life-neutral-100)] rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                  {MENU_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => { onUpdate({ menuStyle: style as MenuPageData["menuStyle"] }); setMenuStyleOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors ${
                        data.menuStyle === style
                          ? "bg-[var(--life-primary-100)] text-[var(--life-primary-500)] font-medium"
                          : "text-[var(--life-neutral-700)] hover:bg-[var(--life-neutral-020)]"
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
            <label className="text-xs font-semibold text-[var(--life-neutral-700)]">Menu Lock Type</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setLockTypeOpen((o) => !o); setMenuStyleOpen(false); }}
                className="life-btn life-btn--secondary"
              >
                <span className={data.menuLockType ? "text-[var(--life-neutral-700)]" : "text-[var(--life-neutral-400)]"}>
                  {data.menuLockType || "Select lock type"}
                </span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform text-[var(--life-neutral-600)] ${lockTypeOpen ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {lockTypeOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--life-neutral-100)] rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                  {LOCK_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { onUpdate({ menuLockType: type }); setLockTypeOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors ${
                        data.menuLockType === type
                          ? "bg-[var(--life-primary-100)] text-[var(--life-primary-500)] font-medium"
                          : "text-[var(--life-neutral-700)] hover:bg-[var(--life-neutral-020)]"
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
            <label className="text-xs font-semibold text-[var(--life-neutral-700)]">Text Alignment</label>
            <p className="text-xs text-[var(--life-neutral-400)] -mt-0.5">Title Alignment</p>
            <div className="flex rounded-lg border border-[var(--life-neutral-200)] overflow-hidden">
              {(["left", "center", "right"] as TextAlign[]).map((align) => (
                <button
                  key={align}
                  type="button"
                  aria-label={`Align ${align}`}
                  onClick={() => onUpdate({ textAlign: align })}
                  className={`flex-1 flex items-center justify-center py-2.5 transition-colors ${
                    data.textAlign === align
                      ? "bg-[var(--life-primary-500)] text-white"
                      : "bg-white text-[var(--life-neutral-600)] hover:bg-[var(--life-neutral-050)]"
                  } ${align !== "left" ? "border-l border-[var(--life-neutral-200)]" : ""}`}
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
