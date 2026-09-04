import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { canAccessDashboardSection, type DashboardSection, useAuth } from "@/context/AuthContext";

const navMain = [
  {
    label: "My Courses",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    active: true,
  },
  {
    label: "Shared with Me",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

const navSecondary: Array<{ label: string; sectionKey: DashboardSection; icon: React.ReactNode }> = [
  {
    label: "Asset Management",
    sectionKey: "asset-management",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Template Management",
    sectionKey: "template-management",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    label: "User Management",
    sectionKey: "user-management",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 00-3-3m-12 3a3 3 0 013-3" />
      </svg>
    ),
  },
  {
    label: "Plugin Management",
    sectionKey: "plugin-management",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-5M16 4l4 4-8 8H8v-4l8-8z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 2l4 4" />
      </svg>
    ),
  },
];

interface SidebarProps {
  /** Controlled open state for mobile. When undefined the sidebar manages its own desktop display. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const visibleSecondaryNav = navSecondary.filter((item) => canAccessDashboardSection(user, item.sectionKey));
  const [active, setActive] = useState(
    location.pathname === "/users" ? "User Management" :
    location.pathname === "/plugins" ? "Plugin Management" :
    location.pathname === "/assets" ? "Asset Management" :
    location.pathname === "/templates" ? "Template Management" :
    location.pathname === "/shared" ? "Shared with Me" :
    "My Courses"
  );

  // Close drawer on route change / escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onMobileClose?.();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onMobileClose]);

  // Prevent body scroll when drawer is open on mobile
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const NAV_ROUTES: Record<string, string> = {
    "My Courses": "/my-courses",
    "Shared with Me": "/shared",
    "User Management": "/users",
    "Plugin Management": "/plugins",
    "Asset Management": "/assets",
    "Template Management": "/templates",
  };

  const NavItem = ({ label, icon }: { label: string; icon: React.ReactNode }) => {
    const isActive = active === label;
    const href = NAV_ROUTES[label];
    const cls = `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
      isActive ? "bg-[#2d6fa8] text-white font-medium" : "text-[#374151] hover:bg-[#f3f4f6] font-normal"
    }`;
    const content = (
      <>
        <span className={isActive ? "text-white" : "text-[#6b7280]"}>{icon}</span>
        {label}
      </>
    );
    if (href) {
      return (
        <Link to={href} onClick={() => { setActive(label); onMobileClose?.(); }} className={cls}>
          {content}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => { setActive(label); onMobileClose?.(); }} className={cls}>
        {content}
      </button>
    );
  };

  const sidebarContent = (
    <aside className="w-56 h-full bg-white border-r border-[#e5e7eb] flex flex-col">
      {/* Logo */}
      <div className="px-4 h-14 flex items-center justify-between border-b border-[#e5e7eb] shrink-0">
        <div className="flex items-center gap-2.5">
          <img
            src="/adapt-logo.jpeg"
            alt="Adapt logo"
            width={32}
            height={32}
            className="rounded-lg shrink-0"
          />
          <span className="font-semibold text-[#111827] text-sm tracking-tight">Adapt Studio</span>
        </div>
        {/* Close button — only visible inside mobile drawer */}
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="md:hidden p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Primary nav */}
      <nav className="px-3 pt-4 space-y-0.5">
        {navMain.map((item) => (
          <NavItem key={item.label} label={item.label} icon={item.icon} />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-3 border-t border-[#e5e7eb]" />

      {/* Secondary nav */}
      <nav className="px-3 space-y-0.5 overflow-y-auto flex-1 pb-4">
        {visibleSecondaryNav.map((item) => (
          <NavItem key={item.label} label={item.label} icon={item.icon} />
        ))}
      </nav>
    </aside>
  );

  return (
    <>
      {/* ── Desktop: static sidebar ── */}
      <div className="hidden md:flex shrink-0 h-screen">
        {sidebarContent}
      </div>

      {/* ── Mobile: drawer overlay ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div className="relative z-50 h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
