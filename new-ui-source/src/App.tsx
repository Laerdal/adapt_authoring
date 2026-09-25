import { useEffect } from 'react'
import { Routes } from './routes'
import { AuthProvider } from '@/context/AuthContext'
import { PageTransitionProvider } from '@/context/PageTransitionContext'
import { logout } from '@/api/adaptAuthoring'
import { redirectToLogin } from '@/utils/authRedirect'

// Match the old UI (frontend/src/modules/user/index.js): log the user out after
// 1h of inactivity. Any activity resets the timer.
const IDLE_MS = 60 * 60 * 1000

function useIdleLogout() {
  useEffect(() => {
    let timer: number | undefined
    const reset = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        // Straight to the real login target in one hop - see ProfileMenu's
        // handleLogout for why reloading "/" first and redirecting a second
        // time from there causes Chrome to throttle the navigation.
        void logout().finally(() => redirectToLogin())
      }, IDLE_MS)
    }
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [])
}

export default function App() {
  useIdleLogout()
  return (
    <AuthProvider>
      <PageTransitionProvider>
        <Routes />
      </PageTransitionProvider>
    </AuthProvider>
  )
}
