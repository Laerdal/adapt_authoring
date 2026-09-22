import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { logout } from "@/api/adaptAuthoring";

function getInitials(firstName?: string, lastName?: string, email?: string) {
  const initials = [firstName?.trim()[0], lastName?.trim()[0]].filter(Boolean).join("").toUpperCase();
  if (initials) return initials;
  return email?.trim()[0]?.toUpperCase() || "?";
}

function toDisplayNamePart(value?: string) {
  return value?.trim().toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, separator, character) => `${separator}${character.toUpperCase()}`) || "";
}

function openFeedback() {
  document.querySelector<HTMLAnchorElement>("#atlwdg-trigger")?.click();
}

function openSupport() {
  window.open("https://laerdal.atlassian.net/servicedesk/customer/portal/2", "_blank", "noopener,noreferrer");
}

export default function ProfileMenu() {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, loading } = useAuth();
  const fullName = [toDisplayNamePart(user?.firstName), toDisplayNamePart(user?.lastName)].filter(Boolean).join(" ");
  const displayName = fullName || user?.email || (loading ? "Loading..." : "Not signed in");
  const email = user?.email ?? "";
  const role = user?.rolesAsName?.[0] ?? "";
  const initials = getInitials(user?.firstName, user?.lastName, user?.email);

  async function handleLogout() {
    setProfileOpen(false);
    try {
      await logout();
    } finally {
      window.location.assign("/");
    }
  }

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div ref={profileRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setProfileOpen((open) => !open)}
        aria-label="Profile menu"
        aria-expanded={profileOpen}
        className="w-9 h-9 rounded-lg bg-[#2d6fa8] hover:bg-[#245c8f] flex items-center justify-center shrink-0 transition-colors text-xs font-bold text-white"
      >
        {initials}
      </button>

      {profileOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#e5e7eb] rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f3f4f6]">
            <p className="text-sm font-semibold text-[#111827]">{displayName}</p>
            {email && <p className="text-xs text-[#6b7280] mt-0.5">{email}</p>}
            {role && <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold">{role}</span>}
          </div>

          <div className="py-1">
            <button type="button" onClick={() => { setProfileOpen(false); openFeedback(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#374151] hover:text-[var(--life-primary-700)] transition-colors cursor-pointer">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Feedback
            </button>
            <button type="button" onClick={() => { setProfileOpen(false); openSupport(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#374151] hover:text-[var(--life-primary-700)] transition-colors cursor-pointer">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.6 2.6 0 1 1 4.3 2c-.9.7-1.8 1.1-1.8 2.3" />
                <path d="M12 17h.01" />
              </svg>
              Support
            </button>
          </div>

          <div className="border-t border-[#f3f4f6] py-1">
            <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#ef4444] hover:bg-[#fef2f2] transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}