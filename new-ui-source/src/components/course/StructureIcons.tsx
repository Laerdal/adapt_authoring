// Shared glyphs for the Course Structure hierarchy, used by both the Tree and
// Map views so the two stay visually consistent with the design:
//   Module → grid of tiles · Topic → stacked layers · Section → document ·
//   Content Group → 3D box/cube · Component → panel layout.
// Uses stroke="currentColor" so the caller controls colour via text colour.

import type { StructureLevel } from "../../types/structure";

const ICON_BASE = "/new/assets/icons";

export const STRUCTURE_ICON_COLOR_CLASS: Record<StructureLevel, string> = {
  module: "text-[var(--life-accent1-400)]",
  topic: "text-[var(--life-primary-500)]",
  section: "text-[var(--life-accent3-500)]",
  contentGroup: "text-[var(--life-accent4-500)]",
  component: "text-[var(--life-neutral-500)]",
};

function MaskIcon({
  file,
  size,
  className = "",
}: {
  file: string;
  size: number;
  className?: string;
}) {
  const iconPath = `${ICON_BASE}/${file}`;
  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 bg-current ${className}`.trim()}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: `url(${iconPath})`,
        maskImage: `url(${iconPath})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export function StructureIcon({
  level,
  size = 16,
  className = "",
}: {
  level: StructureLevel;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (level) {
    case "module":
      return <MaskIcon file="module-icon.svg" size={size} className={className} />;
    case "topic":
      return <MaskIcon file="topic-icon.svg" size={size} className={className} />;
    case "section":
      return <MaskIcon file="section-icon.svg" size={size} className={className} />;
    case "contentGroup":
      return <MaskIcon file="contentGroup-icon.svg" size={size} className={className} />;
    case "component":
      return <MaskIcon file="component-icon.svg" size={size} className={className} />;
  }
}
