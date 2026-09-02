import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import RootLayout from './components/layout/RootLayout'
import DashboardLayout from './components/layout/DashboardLayout'
import HomePage from './pages/HomePage'
import NewCoursePage from './pages/NewCoursePage'
import SetupPage from './pages/SetupPage'
import CoursePreviewPage from './pages/CoursePreviewPage'
import PageEditorPage from './pages/editor/pageEditorPage'
import StoryboardPage from './pages/StoryboardPage'
import CourseStructureDemoPage from './pages/CourseStructureDemoPage'
import UserManagementPage from './pages/UserManagementPage'
import AssetManagementPage from './pages/AssetManagementPage'
import TemplateManagementPage from './pages/TemplateManagementPage'
import PluginManagementPage from './pages/PluginManagementPage'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        // Dashboard shell — Sidebar + Header shared across these routes
        element: <DashboardLayout />,
        children: [
          { path: '/', element: <Navigate to="/my-courses" replace /> },
          { path: '/my-courses', element: <HomePage /> },
          { path: '/shared', element: <HomePage /> },
          { path: '/users', element: <UserManagementPage /> },
          { path: '/plugins', element: <PluginManagementPage /> },
          { path: '/assets', element: <AssetManagementPage /> },
          { path: '/templates', element: <TemplateManagementPage /> },
        ],
      },
      // Full-screen routes (own chrome)
      { path: '/course/new', element: <NewCoursePage /> },
      { path: '/course/new/setup', element: <SetupPage /> },
      { path: '/course/:id/setup', element: <SetupPage /> },
      { path: '/course/:id', element: <PageEditorPage /> },
      { path: '/course/:id/storyboard', element: <StoryboardPage /> },
      { path: '/course/:id/preview', element: <CoursePreviewPage /> },
      { path: '/course-structure-demo', element: <CourseStructureDemoPage /> },
    ],
  },
], {
  // The app is served under Vite's base (/new/ in the engine embed). Strip the
  // trailing slash so client routes resolve relative to it (becomes '' in dev).
  basename: import.meta.env.BASE_URL.replace(/\/$/, ''),
})

export function Routes() {
  return <RouterProvider router={router} />
}
