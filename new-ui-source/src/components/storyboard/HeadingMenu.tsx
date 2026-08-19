// "Add Heading" dropdown (spec AC4). Matches the Lovable design: a HEADINGS
// group offering H1 — Topic / H2 — Section / H3 — Content Group Heading.
//
// Rendered in a portal with fixed positioning so it can never be clipped or
// mis-stacked by the editor's scroll/overflow/backdrop-blur ancestors — the
// same treatment as AddContentMenu.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heading1, ChevronDown } from 'lucide-react';

interface HeadingOption {
  level: number;
  label: string;
}

// H1–H3 only (H4/component is authored via Add Content cards).
const HEADINGS: HeadingOption[] = [
  { level: 1, label: 'H1 — Topic' },
  { level: 2, label: 'H2 — Section' },
  { level: 3, label: 'H3 — Content Group Heading' },
];

const MENU_WIDTH = 240;

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
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
      >
        <Heading1 className="h-3.5 w-3.5" /> Add Heading
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', left: pos.left, top: pos.top, width: MENU_WIDTH, maxHeight: pos.maxHeight }}
            className="z-[1000] overflow-y-auto rounded-md border bg-background py-1 shadow-lg"
          >
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Headings
            </div>
            {HEADINGS.map(({ level, label }) => (
              <button
                key={level}
                type="button"
                onClick={() => choose(level)}
                className="flex w-full items-center px-3 py-1.5 text-sm hover:bg-muted"
              >
                {label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
