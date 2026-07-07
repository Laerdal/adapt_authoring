import { useState } from 'react'
import { Outlet, useOutletContext } from 'react-router-dom'
import { Header, Sidebar } from './index'
import type { ReactNode } from 'react'

type LayoutContext = { setHeaderActions: (actions: ReactNode) => void }

export function useDashboardLayout() {
  return useOutletContext<LayoutContext>()
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [headerActions, setHeaderActions] = useState<ReactNode>(null)

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header onMenuToggle={() => setSidebarOpen((o) => !o)} actions={headerActions} />
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ setHeaderActions } satisfies LayoutContext} />
        </main>
      </div>
    </div>
  )
}
