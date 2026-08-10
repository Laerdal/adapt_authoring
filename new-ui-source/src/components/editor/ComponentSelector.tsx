"use client";

import { useEffect, useState } from "react";
import {
  getAvailableComponents,
  type ComponentTypeOption,
} from "@/api/adaptAuthoring";

interface ComponentSelectorProps {
  onSelectComponent: (type: ComponentTypeOption) => void;
  onClose: () => void;
}

export default function ComponentSelector({
  onSelectComponent,
  onClose,
}: ComponentSelectorProps) {
  const [components, setComponents] = useState<ComponentTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await getAvailableComponents();
        if (!cancelled) setComponents(list);
      } catch {
        if (!cancelled) setError("Failed to load components.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-80 h-full bg-white border-l border-[#e5e7eb] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[#e5e7eb] shrink-0">
        <span className="text-xs font-bold tracking-widest text-[#111827] uppercase">
          Add Component
        </span>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="py-6 text-sm text-[#6b7280]">Loading components...</div>
        ) : error ? (
          <div className="py-6 text-sm text-[#991b1b]">{error}</div>
        ) : (
          <div className="space-y-2">
            {components.map((comp) => (
            <button
              key={comp._id}
              onClick={() => {
                onSelectComponent(comp);
                onClose();
              }}
              className="w-full text-left px-4 py-3 rounded-lg border-2 transition-all border-[#d1d5db] hover:border-[#2d6fa8] hover:bg-[#f0f8ff] cursor-pointer"
            >
              <p className="font-medium text-sm">{comp.displayName}</p>
              <p className="text-xs text-[#6b7280] mt-1">{comp.description || comp.component}</p>
            </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
