const activities = [
  {
    id: 1,
    learner: "Emma Johnson",
    initials: "EJ",
    action: "completed",
    module: "Introduction to Resuscitation",
    time: "2 min ago",
    color: "bg-[#e3f2fd] text-[#005ea6]",
  },
  {
    id: 2,
    learner: "Marcus Lee",
    initials: "ML",
    action: "started",
    module: "Airway Management Fundamentals",
    time: "18 min ago",
    color: "bg-[#e8f5e9] text-[#2e7d32]",
  },
  {
    id: 3,
    learner: "Sarah Chen",
    initials: "SC",
    action: "scored 94%",
    module: "ACLS Assessment",
    time: "1 hr ago",
    color: "bg-[#fff3e0] text-[#f57c00]",
  },
  {
    id: 4,
    learner: "David Kim",
    initials: "DK",
    action: "completed",
    module: "Introduction to Resuscitation",
    time: "2 hr ago",
    color: "bg-[#e3f2fd] text-[#005ea6]",
  },
  {
    id: 5,
    learner: "Priya Patel",
    initials: "PP",
    action: "started",
    module: "Advanced Cardiac Life Support",
    time: "3 hr ago",
    color: "bg-[#e8f5e9] text-[#2e7d32]",
  },
];

const actionColors: Record<string, string> = {
  completed: "text-[#2e7d32]",
  started: "text-[#0072ce]",
};

export default function RecentActivity() {
  return (
    <div className="bg-white rounded-xl border border-[#d0d0dc] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e8e8f0] flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#1a1a2e]">Recent Activity</h2>
        <button className="text-sm text-[#0072ce] font-medium hover:text-[#005ea6] transition-colors">
          View all
        </button>
      </div>

      <div className="divide-y divide-[#e8e8f0]">
        {activities.map((item) => (
          <div key={item.id} className="px-6 py-3.5 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${item.color}`}>
              {item.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#1a1a2e] truncate">
                <span className="font-medium">{item.learner}</span>
                {" "}
                <span className={actionColors[item.action] ?? "text-[#6b6b8a]"}>{item.action}</span>
                {" "}
                <span className="text-[#6b6b8a]">{item.module}</span>
              </p>
              <p className="text-xs text-[#8e8ea0] mt-0.5">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
