import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { PageTransitionBoundary, usePageTransition } from '@/context/PageTransitionContext'
import { useAuth } from '@/context/AuthContext'
import { trackStudioPage } from '@/utils/studioHotjarAnalytics'

export default function RootLayout() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const { beginTransition } = usePageTransition()
  const isInitialRenderRef = useRef(true)

  useEffect(() => {
    if (loading || !user) return
    let active = true
    void trackStudioPage(() => active)
    return () => { active = false }
  }, [user, loading, location.pathname])

  useEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false
      return
    }
    beginTransition()
  }, [beginTransition, location.key])

  return (
    <PageTransitionBoundary key={location.key}>
      <Outlet />
    </PageTransitionBoundary>
  )
}
