// "Add Content" dropdown (spec AC3/AC5/AC6). Categorised insert menu matching
// the Figma design (Course Creation Center → StoryboardPanel
// `CONTENT_TYPE_CATALOG`): Text & Visual / Media / Survey / Assessment.
// Icons, labels, order and grouping are 1:1 with that catalog so the two
// surfaces stay in lockstep.
//
// Rendered in a portal with fixed positioning so it can never be clipped or
// mis-stacked by the editor's scroll/overflow/backdrop-blur ancestors (that was
// the "breaking" dropdown). Height is capped to the viewport and scrolls.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Type,
  Layers,
  Image as ImageIcon,
  Film,
  Mic,
  Puzzle,
  ClipboardList,
  CheckSquare,
  LayoutList,
  PenLine,
  ArrowUpDown,
  ListChecks,
  SlidersHorizontal,
  Trophy,
  ChevronDown,
} from 'lucide-react';
import type { StoryboardInsertKind } from '@/types/storyboard';

interface MenuItem {
  kind: StoryboardInsertKind;
  label: string;
  Icon: typeof Type;
}
interface MenuGroup {
  label: string;
  items: MenuItem[];
}

// Groups + order mirror `CONTENT_TYPE_CATALOG` in the Figma Make source
// (StoryboardPanel.tsx) exactly. Do not add/reorder without updating both.
const GROUPS: MenuGroup[] = [
  {
    label: 'Text & Visual',
    items: [
      { kind: 'text', label: 'Text', Icon: Type },
      { kind: 'groupedContent', label: 'Grouped Content', Icon: Layers },
      { kind: 'image', label: 'Image', Icon: ImageIcon },
    ],
  },
  {
    label: 'Media',
    items: [
      { kind: 'video', label: 'Video', Icon: Film },
      { kind: 'audio', label: 'Audio', Icon: Mic },
      { kind: 'h5p', label: 'H5P', Icon: Puzzle },
    ],
  },
  {
    label: 'Survey',
    items: [{ kind: 'laerdalForm', label: 'Laerdal Form', Icon: ClipboardList }],
  },
  {
    label: 'Assessment',
    items: [
      { kind: 'mcq', label: 'MCQ', Icon: CheckSquare },
      { kind: 'gmcq', label: 'GMCQ', Icon: CheckSquare },
      { kind: 'matching', label: 'Matching', Icon: LayoutList },
      { kind: 'textInput', label: 'Text Input', Icon: PenLine },
      { kind: 'reorder', label: 'Sentence Reordering', Icon: ArrowUpDown },
      { kind: 'checklist', label: 'Checklist', Icon: ListChecks },
      { kind: 'slider', label: 'Slider', Icon: SlidersHorizontal },
      { kind: 'assessmentResult', label: 'Assessment Result', Icon: Trophy },
    ],
  },
];

const MENU_WIDTH = 260;

// Add Content lists ONLY course-content components. AI and Comment are authoring
// ACTIONS on a component card (see componentBlock/assessmentBlock headers), not
// content components — they are intentionally NOT in this menu.
export default function AddContentMenu({ onInsert }: { onInsert: (kind: StoryboardInsertKind) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number }>({ left: 0, top: 0, maxHeight: 360 });
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
    // Close on scroll of an ANCESTOR (fixed menu would otherwise detach), but
    // NOT when scrolling inside the menu's own scroll area — that capture-phase
    // event was closing the menu on the first wheel tick ("scroll not working").
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const choose = (kind: StoryboardInsertKind) => {
    onInsert(kind);
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
        <Plus className="h-3.5 w-3.5" /> Add Content
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
            {GROUPS.map((group) => (
              <div key={group.label}>
                <div className="sb-menu-group-label">{group.label}</div>
                {group.items.map(({ kind, label, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    role="menuitem"
                    onClick={() => choose(kind)}
                    className="sb-menu-item"
                  >
                    <Icon className="sb-menu-item-icon h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
