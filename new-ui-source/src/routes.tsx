import { createBrowserRouter, Navigate, RouterProvider, useRouteError } from 'react-router-dom'
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
import { canAccessCourseSettings, canAccessDashboardSection, type DashboardSection, useAuth } from '@/context/AuthContext'
import ErrorDialog from './components/common/ErrorDialog'

function RootRouteError() {
  const error = useRouteError() as Error | null;
  console.error("Route error caught by ErrorBoundary:", error);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] px-4">
      <ErrorDialog
        open
        title="Error"
        message="An unexpected error occurred while loading this view."
        debugDetails={error?.message}
        primaryLabel="Reload page"
        secondaryLabel="Back to courses"
        onPrimary={() => window.location.reload()}
        onSecondary={() => { window.location.href = "/new/"; }}
        onClose={() => { window.location.href = "/new/"; }}
      />
    </div>
  );
}

function DashboardSectionGate({
  section,
  children,
}: {
  section: DashboardSection;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  // Not-yet-resolved and not-logged-in-at-all get the same blank screen: the
  // actual "not authenticated" escape is AuthContext's own redirectToLogin()
  // (a real full-page nav, already firing from its effect) - navigating to
  // /dashboard here too would be a no-op when this gate IS /dashboard's own,
  // and a pointless extra hop everywhere else. This gate only needs to act
  // once a user is confirmed, for the permission check below.
  if (loading || !user) {
    return <div className="h-screen w-full bg-[#f8fafc]" />;
  }

  if (!canAccessDashboardSection(user, section)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function CourseSetupRouteGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <div className="h-screen w-full bg-[#f8fafc]" />;
  }

  if (!canAccessCourseSettings(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function CourseWorkspaceRouteGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <div className="h-screen w-full bg-[#f8fafc]" />;
  }

  if (!canAccessCourseSettings(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RootRouteError />,
    children: [
      {
        // Dashboard shell — Sidebar + Header shared across these routes
        element: <DashboardLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardSectionGate section="my-courses"><HomePage /></DashboardSectionGate> },
          { path: '/shared', element: <DashboardSectionGate section="shared"><HomePage /></DashboardSectionGate> },
          { path: '/users', element: <DashboardSectionGate section="user-management"><UserManagementPage /></DashboardSectionGate> },
          { path: '/plugins', element: <DashboardSectionGate section="plugin-management"><PluginManagementPage /></DashboardSectionGate> },
          { path: '/assets', element: <DashboardSectionGate section="asset-management"><AssetManagementPage /></DashboardSectionGate> },
          { path: '/templates', element: <DashboardSectionGate section="template-management"><TemplateManagementPage /></DashboardSectionGate> },
        ],
      },
      // Full-screen routes (own chrome)
      { path: '/course/new', element: <NewCoursePage /> },
      { path: '/course/new/setup', element: <CourseSetupRouteGate><SetupPage /></CourseSetupRouteGate> },
      { path: '/course/:id/setup', element: <CourseSetupRouteGate><SetupPage /></CourseSetupRouteGate> },
      { path: '/course/:id', element: <CourseWorkspaceRouteGate><PageEditorPage /></CourseWorkspaceRouteGate> },
      { path: '/course/:id/storyboard', element: <CourseWorkspaceRouteGate><StoryboardPage /></CourseWorkspaceRouteGate> },
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
