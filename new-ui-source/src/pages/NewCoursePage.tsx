import { Header, Sidebar } from '../components/layout/index'

export default function NewCoursePage() {
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar mobileOpen={false} onMobileClose={() => {}} />
      <div className="flex flex-col flex-1">
        <Header onMenuToggle={() => {}} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">New Course Page</h1>
            <p className="text-gray-600 mt-2">This page will handle course creation flow</p>
          </div>
        </main>
      </div>
    </div>
  )
}
