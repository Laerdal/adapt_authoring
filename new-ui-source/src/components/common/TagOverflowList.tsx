import { useLayoutEffect, useRef, useState } from "react";

interface TagOverflowListProps {
  tags: string[];
  tagClassName?: string;
  moreClassName?: string;
  className?: string;
}

/**
 * Renders tags in a single row, fitting as many as the available width allows,
 * and collapses the rest into a "+N" badge (hover/focus shows the hidden tags).
 */
export default function TagOverflowList({
  tags,
  tagClassName = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#dbeeff] text-[#1e4d73]",
  moreClassName = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f3f4f6] text-[#6b7280] cursor-pointer",
  className = "",
}: TagOverflowListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tags.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    function recompute() {
      if (!container || !measure) return;
      const containerWidth = container.offsetWidth;
      const gap = 4; // matches gap-1
      const tagEls = Array.from(measure.children).slice(0, tags.length) as HTMLElement[];
      const moreEl = measure.lastElementChild as HTMLElement | null;

      let total = 0;
      let count = 0;
      for (let i = 0; i < tagEls.length; i++) {
        const w = tagEls[i].offsetWidth;
        const remainingAfter = tags.length - (i + 1);
        const moreWidth = remainingAfter > 0 && moreEl ? gap + moreEl.offsetWidth : 0;
        const candidateTotal = total + (i > 0 ? gap : 0) + w;
        if (candidateTotal + moreWidth <= containerWidth) {
          total = candidateTotal;
          count = i + 1;
        } else {
          break;
        }
      }
      // If nothing fit but there's at least one tag, still show the first one.
      setVisibleCount(count === 0 && tags.length > 0 ? 1 : count);
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [tags]);

  if (tags.length === 0) return null;

  const hiddenTags = tags.slice(visibleCount);

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      {/* Invisible measurement copy — determines how many tags fit */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="absolute top-0 left-0 flex gap-1 invisible pointer-events-none whitespace-nowrap"
        style={{ visibility: "hidden" }}
      >
        {tags.map((tag) => (
          <span key={tag} className={tagClassName}>{tag}</span>
        ))}
        <span className={moreClassName}>+{tags.length}</span>
      </div>

      {/* Visible tags */}
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, visibleCount).map((tag) => (
          <span key={tag} className={tagClassName}>{tag}</span>
        ))}
        {hiddenTags.length > 0 && (
          <span
            className={moreClassName}
            title={hiddenTags.join(", ")}
            tabIndex={0}
          >
            +{hiddenTags.length}
          </span>
        )}
      </div>
    </div>
  );
}
