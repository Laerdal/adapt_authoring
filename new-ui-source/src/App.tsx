import { useEffect } from 'react'
import { Routes } from './routes'
import { AuthProvider } from '@/context/AuthContext'
import { logout } from '@/api/adaptAuthoring'

// Match the old UI (frontend/src/modules/user/index.js): log the user out after
// 1h of inactivity. Any activity resets the timer.
const IDLE_MS = 60 * 60 * 1000

function useIdleLogout() {
  useEffect(() => {
    let timer: number | undefined
    const reset = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void logout().finally(() => window.location.assign('/'))
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
      <Routes />
    </AuthProvider>
  )
}
