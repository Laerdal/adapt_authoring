const modules = [
  {
    id: 1,
    title: "Introduction to Resuscitation",
    type: "Video + Quiz",
    duration: "45 min",
    completionRate: 92,
    status: "published",
    learners: 218,
  },
  {
    id: 2,
    title: "Airway Management Fundamentals",
    type: "Simulation",
    duration: "60 min",
    completionRate: 78,
    status: "published",
    learners: 195,
  },
  {
    id: 3,
    title: "Advanced Cardiac Life Support",
    type: "Interactive",
    duration: "90 min",
    completionRate: 61,
    status: "published",
    learners: 143,
  },
  {
    id: 4,
    title: "Debriefing & Feedback Techniques",
    type: "Video",
    duration: "30 min",
    completionRate: 44,
    status: "draft",
    learners: 0,
  },
  {
    id: 5,
    title: "Pediatric Emergency Protocols",
    type: "Simulation",
    duration: "75 min",
    completionRate: 0,
    status: "draft",
    learners: 0,
  },
];

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-[#e8e8f0] rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full bg-[#0072ce] transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default function ModuleList() {
  return (
    <div className="bg-white rounded-xl border border-[#d0d0dc] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e8e8f0] flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#1a1a2e]">Course Modules</h2>
        <button className="text-sm text-[#0072ce] font-medium hover:text-[#005ea6] transition-colors">
          Manage modules
        </button>
      </div>

      <div className="divide-y divide-[#e8e8f0]">
        {modules.map((mod) => (
          <div key={mod.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#fafafa] transition-colors">
            {/* Order number */}
            <div className="w-7 h-7 rounded-full bg-[#f4f4f8] flex items-center justify-center text-xs font-semibold text-[#6b6b8a] shrink-0">
              {mod.id}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-[#1a1a2e] truncate">{mod.title}</p>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                    mod.status === "published"
                      ? "bg-[#e8f5e9] text-[#2e7d32]"
                      : "bg-[#f4f4f8] text-[#6b6b8a]"
                  }`}
                >
                  {mod.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#8e8ea0]">
                <span>{mod.type}</span>
                <span>·</span>
                <span>{mod.duration}</span>
                {mod.learners > 0 && (
                  <>
                    <span>·</span>
                    <span>{mod.learners} learners</span>
                  </>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="w-32 shrink-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[#6b6b8a]">Completion</span>
                <span className="text-xs font-semibold text-[#1a1a2e]">{mod.completionRate}%</span>
              </div>
              <ProgressBar value={mod.completionRate} />
            </div>

            {/* Actions */}
            <button className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#8e8ea0] hover:bg-[#f4f4f8] hover:text-[#1a1a2e] transition-colors">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
