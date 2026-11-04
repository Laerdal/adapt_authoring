import { useEffect, useId, useMemo, useRef, useState } from "react";

// LIFE dropdown that draws its own list in the page instead of the browser's native <select> popup.
// Use it for long lists (e.g. 100+ locales): the native popup is painted outside the page and can
// render blank on some large displays. Includes type-to-filter, arrow-key navigation and Escape.

export interface LifeSelectOption {
  value: string;
  label: string;
}

interface LifeSelectProps {
  value: string;
  options: LifeSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export default function LifeSelect({ value, options, onChange, ariaLabel, disabled }: LifeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // On open: focus the filter box and bring the selected option into view.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "center" });
  }, [open]);

  function close(restoreFocus: boolean) {
    setOpen(false);
    setQuery("");
    if (restoreFocus) triggerRef.current?.focus();
  }

  function choose(next: string) {
    onChange(next);
    close(true);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[Math.min(index + 1, items.length - 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index <= 0) searchRef.current?.focus();
      else items[index - 1]?.focus();
    } else if (event.key === "Enter" && document.activeElement === searchRef.current && filtered.length) {
      event.preventDefault();
      choose(filtered[0].value);
    } else if (event.key === "Tab") {
      close(false);
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={open ? handleKeyDown : undefined}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        className={`life-field life-field--select-trigger ${open ? "life-field--open" : ""}`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? ""}</span>
      </button>

      {open && (
        <div className="life-menu absolute left-0 right-0 top-full z-50 mt-1 !p-0" onClick={(e) => e.preventDefault()}>
          <div className="p-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Filter options"
              className="life-field"
            />
          </div>
          <div ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto pb-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[var(--life-neutral-500)]">No matches</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  tabIndex={-1}
                  onClick={() => choose(o.value)}
                  className="life-menu-item px-4"
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
