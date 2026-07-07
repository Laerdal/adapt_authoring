import { Routes } from './routes'
import { AuthProvider } from '@/context/AuthContext'

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  )
}
