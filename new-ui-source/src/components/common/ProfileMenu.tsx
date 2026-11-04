import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { logout } from "@/api/adaptAuthoring";
import { redirectToLogin } from "@/utils/authRedirect";
import EditorMaskIcon from "@/components/editor/EditorMaskIcon";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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
      // Straight to the real login target (SSO or /classic) in one hop -
      // reloading "/" first and letting AuthContext redirect a second time
      // fires two navigations back to back, which Chrome's flood-protection
      // throttles, leaving the page looking stuck instead of redirecting.
      redirectToLogin();
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

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (!profileOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [profileOpen]);

  function closeMenu(restoreFocus: boolean) {
    setProfileOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    } else if (event.key === "Tab") {
      closeMenu(false);
      return;
    }
    if (next !== null) {
      event.preventDefault();
      items[next].focus();
    }
  }

  function switchToClassic() {
    setProfileOpen(false);
    window.location.href = "/classic";
  }

  return (
    <div ref={profileRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setProfileOpen((open) => !open)}
        aria-label="Profile menu"
        aria-expanded={profileOpen}
        aria-haspopup="menu"
        className="life-profile-btn shrink-0"
      >
        {initials}
      </button>

      {profileOpen && (
        <div ref={menuRef} role="menu" aria-label="Profile" onKeyDown={handleMenuKeyDown} className="life-menu absolute right-0 top-full mt-2 w-56 z-50 overflow-hidden !p-0">
          <div className="px-4 py-3 border-b border-[var(--life-color-border-subtle)]">
            <p className="text-sm font-semibold text-[var(--life-color-text-default)]">{displayName}</p>
            {email && <p className="text-xs text-[var(--life-color-text-subtle)] mt-0.5">{email}</p>}
            {role && <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-[var(--life-warning-100)] text-[var(--life-neutral-700)] text-[10px] font-semibold">{role}</span>}
          </div>

          <div className="py-1">
            <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); openFeedback(); }} className="life-menu-item px-4">
              <EditorMaskIcon file="feedback-icon.svg" className="block w-[15px] h-[15px] shrink-0 bg-current" />
              Feedback
            </button>
            <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); openSupport(); }} className="life-menu-item px-4">
              <EditorMaskIcon file="support-icon.svg" className="block w-[15px] h-[15px] shrink-0 bg-current" />
              Support
            </button>
          </div>

          <div className="border-t border-[var(--life-color-border-subtle)] py-1">
            <button type="button" role="menuitem" onClick={switchToClassic} className="life-menu-item justify-between px-4">
              <span>Switch to Classic</span>
              <span className="relative inline-flex h-4 w-7 shrink-0 items-center rounded-full bg-[var(--life-neutral-200)]" aria-hidden="true">
                <span className="inline-block h-3 w-3 translate-x-0.5 rounded-full bg-white shadow" />
              </span>
            </button>
          </div>

          <div className="border-t border-[var(--life-color-border-subtle)] py-1">
            <button type="button" role="menuitem" onClick={handleLogout} className="life-menu-item life-menu-item--critical px-4">
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