import type { ReactNode } from 'react'

type PageTransitionContextValue = {
  beginTransition: () => number
  settleTransition: (transitionId: number) => void
  setTrackedLoading: (loaderId: string, loading: boolean) => void
  currentTransitionId: number | null
}

// ponytail: global full-page loading overlay reverted (ADAPT-3909 follow-up).
// It fired on every navigation and in-page tab switch, not just genuine slow
// loads, and a Sep 28 change decoupled it from real per-page loading state
// entirely. Root cause is per-page load time (asset/template management,
// preview) — fix that, then reconsider a per-page indicator, not a global one.
const noopValue: PageTransitionContextValue = {
  beginTransition: () => 0,
  settleTransition: () => {},
  setTrackedLoading: () => {},
  currentTransitionId: null,
}

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function usePageTransition() {
  return noopValue
}

export function usePageTransitionLoading(_loading: boolean) {}

export function PageTransitionBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>
}
