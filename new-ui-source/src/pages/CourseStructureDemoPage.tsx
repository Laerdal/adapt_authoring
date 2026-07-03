import { Header, Sidebar } from '../components/layout/index'
import { CourseStructureMap } from '../components/course/index'

export default function CourseStructureDemoPage() {
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar mobileOpen={false} onMobileClose={() => {}} />
      <div className="flex flex-col flex-1">
        <Header onMenuToggle={() => {}} />
        <main className="flex-1 overflow-auto p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Course Structure Demo</h1>
          <CourseStructureMap />
        </main>
      </div>
    </div>
  )
}
