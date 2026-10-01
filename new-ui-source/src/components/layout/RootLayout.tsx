import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { PageTransitionBoundary, usePageTransition } from '@/context/PageTransitionContext'

export default function RootLayout() {
  const location = useLocation()
  const { beginTransition } = usePageTransition()
  const isInitialRenderRef = useRef(true)

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
