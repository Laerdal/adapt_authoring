// First screen of "Create New Course": choose manual setup vs. Samaritan-
// driven AI generation. Visual/interaction pattern follows the reference
// design (Adapt Studio DAMS 4.0's BuildMethodPickerModal) reimplemented with
// this app's own design tokens - DAMS's own "Build with AI" flow behind this
// picker is a client-side mock with no real generation; ours instead opens
// BuildWithAiWizard, which is wired to the real Samaritan backend.
import { useState } from "react";

interface Props {
  onClose: () => void;
  onBuildFromScratch: () => void;
  onBuildWithAI: () => void;
}

function Card({
  title,
  description,
  icon,
  onClick
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex-1 flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-colors ${
        hovered ? "border-[#2d6fa8] bg-[#eaf3fa]" : "border-[#e5e7eb] bg-white"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          hovered ? "bg-[#2d6fa8] text-white" : "bg-[#f3f4f6] text-[#111827]"
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-[#111827] mb-1">{title}</p>
        <p className="text-xs text-[#6b7280] leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

export default function BuildMethodPickerModal({ onClose, onBuildFromScratch, onBuildWithAI }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-visible" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div>
            <h2 className="font-semibold text-[#111827] text-base">Create New Course</h2>
            <p className="text-xs text-[#6b7280] mt-0.5">How would you like to build your course?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex gap-4 p-6">
          <Card
            title="Build from Scratch"
            description="Start with a blank course and configure every detail yourself."
            onClick={onBuildFromScratch}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            }
          />
          <Card
            title="Build with AI"
            description="Describe your course and let Samaritan generate the structure for you."
            onClick={onBuildWithAI}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}
