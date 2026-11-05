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
    <div className="w-80 h-full bg-white border-l border-[var(--life-neutral-100)] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--life-neutral-100)] shrink-0">
        <span className="text-xs font-bold tracking-widest text-[var(--life-neutral-850)] uppercase">
          Add Component
        </span>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="life-icon-btn life-icon-btn--xs"
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
          <div className="py-6 text-sm text-[var(--life-neutral-600)]">Loading components...</div>
        ) : error ? (
          <div className="py-6 text-sm text-[var(--life-critical-600)]">{error}</div>
        ) : (
          <div className="space-y-2">
            {components.map((comp) => (
              <button
                key={comp._id}
                onClick={() => {
                  onSelectComponent(comp);
                  onClose();
                }}
                className="w-full text-left px-4 py-3 rounded-lg border-2 transition-all border-[var(--life-neutral-200)] hover:border-[var(--life-primary-500)] hover:bg-[#f0f8ff] cursor-pointer"
              >
                <p className="font-medium text-sm">{comp.displayName}</p>
                <p className="text-xs text-[var(--life-neutral-600)] mt-1">{comp.description || comp.component}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
