"use client";

import { useRef } from "react";

type MenuStyle = "Box Menu" | "Overview Menu" | "LIFE Menu";
type TextAlign = "left" | "center" | "right";
type BgType = "Color" | "Image";

export interface MenuPageData {
  logoUrl: string | null;
  title: string;
  subtitle: string;
  body: string;
  menuStyle: MenuStyle;
  menuLockType: string;
  textAlign: TextAlign;
  bgType: BgType;
  bgColor: string;
  bgImageUrl: string | null;
}

interface MenuPageCanvasProps {
  data: MenuPageData;
  onUpdate: (patch: Partial<MenuPageData>) => void;
  onSelectSection: (e: React.MouseEvent) => void;
  isSelected: boolean;
  isEditingInPanel?: boolean;
}

const alignContainerClass: Record<TextAlign, string> = {
  left:   "menu-canvas-align-left",
  center: "menu-canvas-align-center",
  right:  "menu-canvas-align-right",
};

const alignInputClass: Record<TextAlign, string> = {
  left:   "menu-canvas-input-align-left",
  center: "menu-canvas-input-align-center",
  right:  "menu-canvas-input-align-right",
};

const logoJustifyClass: Record<TextAlign, string> = {
  left:   "justify-start",
  center: "justify-center",
  right:  "justify-end",
};

export default function MenuPageCanvas({
  data,
  onUpdate,
  onSelectSection,
  isSelected,
  isEditingInPanel,
}: MenuPageCanvasProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onUpdate({ logoUrl: URL.createObjectURL(file) });
  }

  function handleCardClick(e: React.MouseEvent) {
    e.stopPropagation();
    onSelectSection(e);
  }

  return (
    <div
      onClick={handleCardClick}
      className={`menu-canvas-card relative w-full max-w-3xl mx-auto cursor-pointer transition-all${isSelected ? " is-selected" : ""}${isEditingInPanel && !isSelected ? " is-editing" : ""}`}
    >
      <div className={`flex flex-col gap-5 px-10 py-8 ${alignContainerClass[data.textAlign]}`}>

        {/* "Menu Page" chip — always visible */}
        <div className="menu-canvas-chip self-start rounded-lg px-3 py-1 text-sm font-medium">
          Menu Page
        </div>

        {/* Logo area */}
        {data.logoUrl ? (
          <div className={`flex ${logoJustifyClass[data.textAlign]}`}>
            <div className="relative group">
              <img
                src={data.logoUrl}
                alt="Menu logo"
                className="h-14 max-w-[160px] object-contain rounded-lg"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUpdate({ logoUrl: null }); }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-[#e5e7eb] text-[#9ca3af] hover:text-[#374151] hidden group-hover:flex items-center justify-center shadow-sm"
                aria-label="Remove logo"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); logoInputRef.current?.click(); }}
            className="menu-canvas-logo-btn flex items-center gap-2.5 px-4 py-3 rounded-xl transition-colors self-start"
            aria-label="Upload logo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-sm font-medium">Add logo</span>
          </button>
        )}

        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          title="Upload menu logo"
          className="hidden"
          onChange={handleLogoUpload}
        />

        {/* Title */}
        <input
          type="text"
          value={data.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Menu Page"
          className={`menu-canvas-title ${alignInputClass[data.textAlign]} w-full bg-transparent border-none outline-none text-4xl font-bold placeholder-[#9ca3af] focus:ring-0 cursor-text leading-tight`}
          aria-label="Menu title"
        />

        {/* Subtitle */}
        <input
          type="text"
          value={data.subtitle}
          onChange={(e) => onUpdate({ subtitle: e.target.value })}
          placeholder="Course navigation menu"
          className={`menu-canvas-subtitle ${alignInputClass[data.textAlign]} w-full bg-transparent border-none outline-none text-lg placeholder-[#9ca3af] focus:ring-0 cursor-text -mt-3`}
          aria-label="Menu subtitle"
        />

        {/* Body */}
        <p className={`menu-canvas-body ${alignInputClass[data.textAlign]} text-base leading-relaxed`}>
          {data.body || "Configure your course menu settings"}
        </p>

      </div>
    </div>
  );
}
