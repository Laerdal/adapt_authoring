interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  icon: React.ReactNode;
  iconBg: string;
}

export default function StatCard({ label, value, delta, deltaPositive, icon, iconBg }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#d0d0dc] p-5 flex items-start justify-between hover:shadow-sm transition-shadow">
      <div className="space-y-1.5">
        <p className="text-sm text-[#6b6b8a] font-medium">{label}</p>
        <p className="text-2xl font-bold text-[#1a1a2e]">{value}</p>
        {delta && (
          <p className={`text-xs font-medium flex items-center gap-1 ${deltaPositive ? "text-[#2e7d32]" : "text-[#c62828]"}`}>
            <span>{deltaPositive ? "↑" : "↓"}</span>
            {delta}
          </p>
        )}
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}
