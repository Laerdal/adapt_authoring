import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { logout } from '@/api/adaptAuthoring'

interface HeaderProps {
  onMenuToggle?: () => void;
  actions?: ReactNode;
}

export default function Header({ onMenuToggle, actions }: HeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const { user, loading } = useAuth()
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
  const displayName = fullName || user?.email || (loading ? 'Loading…' : 'Not signed in')
  const email = user?.email ?? ''
  const role = user?.rolesAsName?.[0] ?? ''

  async function handleLogout() {
    setProfileOpen(false)
    try {
      await logout()
    } finally {
      window.location.assign('/') // back to the engine (login screen)
    }
  }

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  return (
    <header className="h-14 bg-white border-b border-[#e5e7eb] flex items-center justify-between px-4 md:px-6 shrink-0">
      {/* Left: hamburger (mobile) + logo (mobile only) */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Open navigation"
          className="md:hidden p-2 rounded-lg text-[#374151] hover:bg-[#f3f4f6] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="flex md:hidden items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#2d6fa8] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <span className="font-semibold text-[#111827] text-sm tracking-tight">Adapt Studio</span>
        </div>
      </div>

      {/* Right: optional action buttons + user */}
      <div className="flex items-center gap-2 md:gap-3">
        {actions}

        {/* Profile button + dropdown */}
        <div ref={profileRef} className="relative flex items-center gap-2">
          <span className="hidden sm:block text-sm text-[#374151] font-medium">{displayName}</span>
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            aria-label="Profile menu"
            aria-expanded={profileOpen}
            className="w-9 h-9 rounded-lg bg-[#2d6fa8] hover:bg-[#245c8f] flex items-center justify-center shrink-0 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#e5e7eb] rounded-xl shadow-xl z-50 overflow-hidden">
              {/* User info */}
              <div className="px-4 py-3 border-b border-[#f3f4f6]">
                <p className="text-sm font-semibold text-[#111827]">{displayName}</p>
                {email && <p className="text-xs text-[#6b7280] mt-0.5">{email}</p>}
                {role && <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold">{role}</span>}
              </div>

              <div className="border-t border-[#f3f4f6] py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#ef4444] hover:bg-[#fef2f2] transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      </div>
    </header>
  )
}
