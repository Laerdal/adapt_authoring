// "Add Content" dropdown (spec AC3/AC5/AC6). Categorised insert menu matching
// the reference: Text & Visual / Media / Survey / Assessment / Interactive.
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
  Video,
  AudioLines,
  Puzzle,
  ClipboardList,
  ListChecks,
  Images,
  Shuffle,
  ArrowDownUp,
  TextCursorInput,
  SlidersHorizontal,
  Target,
  Grid3x3,
  ListTodo,
  Rows3,
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
      { kind: 'video', label: 'Video', Icon: Video },
      { kind: 'audio', label: 'Audio', Icon: AudioLines },
      { kind: 'h5p', label: 'H5P', Icon: Puzzle },
    ],
  },
  { label: 'Survey', items: [{ kind: 'laerdalForm', label: 'Laerdal Form', Icon: ClipboardList }] },
  {
    label: 'Assessment',
    items: [
      { kind: 'mcq', label: 'MCQ', Icon: ListChecks },
      { kind: 'gmcq', label: 'Graphic MCQ', Icon: Images },
      { kind: 'matching', label: 'Matching', Icon: Shuffle },
      { kind: 'reorder', label: 'Sentence Reordering', Icon: ArrowDownUp },
      { kind: 'textInput', label: 'Text Input', Icon: TextCursorInput },
      { kind: 'slider', label: 'Slider', Icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Interactive',
    items: [
      // Accordion has no distinct storyboard block yet — map it to Grouped
      // Content (heading + body rows), per product decision.
      { kind: 'groupedContent', label: 'Accordion', Icon: Rows3 },
      { kind: 'hotgraphic', label: 'Hot Graphic', Icon: Target },
      { kind: 'hotgrid', label: 'Hot Grid', Icon: Grid3x3 },
      { kind: 'actionplan', label: 'Laerdal Action Plan', Icon: ListTodo },
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
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
      >
        <Plus className="h-3.5 w-3.5" /> Add Content
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', left: pos.left, top: pos.top, width: MENU_WIDTH, maxHeight: pos.maxHeight }}
            className="z-[1000] overflow-y-auto rounded-md border bg-background py-1 shadow-lg"
          >
            {GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
                {group.items.map(({ kind, label, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => choose(kind)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
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
