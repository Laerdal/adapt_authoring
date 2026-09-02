//
// Matches the Figma "Course Creation Center" HeadingDropdown: each option is
// a two-line row with a bold H1/H2/H3 badge (`.sb-heading-chip`) and the
// Topic / Section / Content Group label + descriptor. Rendered in a portal
// with fixed positioning so it can never be clipped or mis-stacked by the
// editor's scroll/overflow/backdrop-blur ancestors — same treatment as
// AddContentMenu.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heading1, ChevronDown } from 'lucide-react';

interface HeadingOption {
  level: 1 | 2 | 3;
  chip: string;
  title: string;
  desc: string;
}

// H1–H3 only (H4/component is authored via Add Content cards).
const HEADINGS: HeadingOption[] = [
  { level: 1, chip: 'H1', title: 'H1 — Topic',         desc: 'Top-level heading' },
  { level: 2, chip: 'H2', title: 'H2 — Section',       desc: 'Under a Topic' },
  { level: 3, chip: 'H3', title: 'H3 — Content Group', desc: 'Under a Section' },
];

const MENU_WIDTH = 260;

export default function HeadingMenu({ onSelect }: { onSelect: (level: number) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number }>({ left: 0, top: 0, maxHeight: 320 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(r.left, window.innerWidth - MENU_WIDTH - margin);
    const top = r.bottom + 4;
    const maxHeight = Math.max(160, window.innerHeight - top - margin);
    setPos({ left: Math.max(margin, left), top, maxHeight });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const choose = (level: number) => {
    onSelect(level);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="sb-toolbar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Heading1 className="h-3.5 w-3.5" /> Add Heading
        <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--life-color-text-subtle)' }} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="sb-menu"
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              width: MENU_WIDTH,
              maxHeight: pos.maxHeight,
              zIndex: 1000,
            }}
          >
            <div className="sb-menu-group-label">Headings</div>
            {HEADINGS.map(({ level, chip, title, desc }) => (
              <button
                key={level}
                type="button"
                role="menuitem"
                onClick={() => choose(level)}
                className="sb-menu-item"
              >
                <span className="sb-heading-chip">{chip}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--life-color-text-default)',
                      lineHeight: 1.25,
                    }}
                  >
                    {title}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--life-color-text-subtle)',
                      lineHeight: 1.3,
                    }}
                  >
                    {desc}
                  </span>
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
