export default function CourseOverview() {
  const overallProgress = 68;

  return (
    <div className="bg-white rounded-xl border border-[#d0d0dc] p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--life-neutral-850)]">Course Overview</h2>
          <p className="text-xs text-[var(--life-neutral-600)] mt-0.5">Dev Next Instance · Spring 2026</p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-[#e3f2fd] text-[#005ea6] rounded-full font-medium">Active</span>
      </div>

      {/* Overall Progress Ring */}
      <div className="flex items-center gap-6 mb-6">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#e8e8f0" strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="#0072ce"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 32}`}
              strokeDashoffset={`${2 * Math.PI * 32 * (1 - overallProgress / 100)}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-[var(--life-neutral-850)]">{overallProgress}%</span>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--life-neutral-850)]">Overall completion</p>
          <p className="text-xs text-[var(--life-neutral-600)]">248 enrolled learners</p>
          <p className="text-xs text-[var(--life-neutral-600)]">3 of 5 modules published</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-[var(--life-neutral-050)] px-4 py-3">
          <p className="text-xs text-[var(--life-neutral-600)] mb-1">Avg. Score</p>
          <p className="text-xl font-bold text-[var(--life-neutral-850)]">81<span className="text-sm font-normal text-[var(--life-neutral-600)]">%</span></p>
        </div>
        <div className="rounded-lg bg-[var(--life-neutral-050)] px-4 py-3">
          <p className="text-xs text-[var(--life-neutral-600)] mb-1">Avg. Time</p>
          <p className="text-xl font-bold text-[var(--life-neutral-850)]">52<span className="text-sm font-normal text-[var(--life-neutral-600)]"> min</span></p>
        </div>
        <div className="rounded-lg bg-[var(--life-neutral-050)] px-4 py-3">
          <p className="text-xs text-[var(--life-neutral-600)] mb-1">At Risk</p>
          <p className="text-xl font-bold text-[#c62828]">14</p>
        </div>
        <div className="rounded-lg bg-[var(--life-neutral-050)] px-4 py-3">
          <p className="text-xs text-[var(--life-neutral-600)] mb-1">Certified</p>
          <p className="text-xl font-bold text-[#2e7d32]">112</p>
        </div>
      </div>

      {/* Action */}
      <button className="life-btn life-btn--primary mt-5 w-full">
        View full report
      </button>
    </div>
  );
}
