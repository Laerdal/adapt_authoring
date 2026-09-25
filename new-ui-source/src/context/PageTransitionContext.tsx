import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type PageTransitionContextValue = {
  beginTransition: () => number
  settleTransition: (transitionId: number) => void
  setTrackedLoading: (loaderId: string, loading: boolean) => void
  currentTransitionId: number | null
}

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null)

let loaderSequence = 0

function PageTransitionOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-0 z-[140] flex items-center justify-center bg-[#f8fafc]/78 backdrop-blur-[2px] transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="flex min-w-[200px] items-center gap-3 rounded-2xl border border-[#d8dde6] bg-white px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e7f4f8] text-[#2e7fa1]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1f2937]">Loading page</p>
          <p className="text-xs text-[#6b7280]">Preparing the next view…</p>
        </div>
      </div>
    </div>
  )
}

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const transitionSequenceRef = useRef(0)
  const activeLoadersRef = useRef(new Set<string>())
  const [currentTransitionId, setCurrentTransitionId] = useState<number | null>(null)
  const [activeLoaderCount, setActiveLoaderCount] = useState(0)

  const beginTransition = useCallback(() => {
    const nextTransitionId = ++transitionSequenceRef.current
    setCurrentTransitionId(nextTransitionId)
    return nextTransitionId
  }, [])

  const settleTransition = useCallback((transitionId: number) => {
    setCurrentTransitionId((currentTransition) => (currentTransition === transitionId ? null : currentTransition))
  }, [])

  const setTrackedLoading = useCallback((loaderId: string, loading: boolean) => {
    const activeLoaders = activeLoadersRef.current
    const isTracked = activeLoaders.has(loaderId)

    if (loading && !isTracked) {
      activeLoaders.add(loaderId)
      setActiveLoaderCount(activeLoaders.size)
      return
    }

    if (!loading && isTracked) {
      activeLoaders.delete(loaderId)
      setActiveLoaderCount(activeLoaders.size)
    }
  }, [])

  const value = useMemo<PageTransitionContextValue>(() => ({
    beginTransition,
    settleTransition,
    setTrackedLoading,
    currentTransitionId,
  }), [beginTransition, settleTransition, setTrackedLoading, currentTransitionId])

  const visible = currentTransitionId !== null || activeLoaderCount > 0

  return (
    <PageTransitionContext.Provider value={value}>
      {children}
      <PageTransitionOverlay visible={visible} />
    </PageTransitionContext.Provider>
  )
}

export function usePageTransition() {
  const context = useContext(PageTransitionContext)
  if (!context) throw new Error('usePageTransition must be used within PageTransitionProvider')
  return context
}

export function usePageTransitionLoading(loading: boolean) {
  const { currentTransitionId, settleTransition, setTrackedLoading } = usePageTransition()
  const loaderIdRef = useRef<string | null>(null)
  const settledTransitionIdRef = useRef<number | null>(null)

  if (!loaderIdRef.current) {
    loaderIdRef.current = `page-loader-${++loaderSequence}`
  }

  useEffect(() => {
    const loaderId = loaderIdRef.current!
    setTrackedLoading(loaderId, loading)
    return () => {
      setTrackedLoading(loaderId, false)
    }
  }, [loading, setTrackedLoading])

  useEffect(() => {
    if (currentTransitionId === null || loading || settledTransitionIdRef.current === currentTransitionId) {
      return
    }

    const rafId = window.requestAnimationFrame(() => {
      settleTransition(currentTransitionId)
      settledTransitionIdRef.current = currentTransitionId
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [currentTransitionId, loading, settleTransition])
}

export function PageTransitionBoundary({ children }: { children: ReactNode }) {
  usePageTransitionLoading(false)
  return <>{children}</>
}