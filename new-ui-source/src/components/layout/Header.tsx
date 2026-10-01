import type { ReactNode } from 'react'
import ProfileMenu from '@/components/common/ProfileMenu'

interface HeaderProps {
  onMenuToggle?: () => void;
  actions?: ReactNode;
}

export default function Header({ onMenuToggle, actions }: HeaderProps) {
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
        <ProfileMenu />
      </div>
    </header>
  )
}
