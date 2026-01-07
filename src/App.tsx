import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Auth } from '@/pages/Auth'
import Dashboard from './pages/Dashboard'
import { Automation } from '@/pages/Automation'
import { NotFound } from '@/pages/NotFound'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAppSelector } from '@/store/hooks'
import './App.css'
import UserCreate from './pages/UserCreate'
import Pacs from './pages/Pacs'
import SinglePatient from './pages/SinglePatient'
import Performance from './pages/Performance'
import Settings from './pages/Settings'
import ViewerSettings from './pages/ViewerSettings'
import Research from './pages/Research'
import { MainLayout } from '@/components/MainLayout'
import { ViewerLayout } from '@/components/ViewerLayout'
import { ReportLayout } from '@/components/ReportLayout'
import { Toaster } from 'react-hot-toast'
import Bookmark from './pages/Bookmark'
import StudyViewer from './pages/StudyViewer'
import Report from './pages/Report'


function RootRedirect() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/login" replace />
}

function App() {
  return (
    <div className=''>
      <Toaster position="top-right" />
      <Router>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route
            path="/login"
            element={
              <div className="flex flex-col min-h-screen min-w-screen">
                <main className="flex-1">
                  <Auth />
                </main>
              </div>
            }
          />

          {/* Viewer Layout - separate fullscreen layout for study viewer */}
          <Route
            element={
              <ProtectedRoute>
                <ViewerLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/studies/:id/viewer" element={<StudyViewer />} />
          </Route>

          {/* Report Layout - separate layout for report editor */}
          <Route
            element={
              <ProtectedRoute>
                <ReportLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/studies/:id/report" element={<Report />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/automation" element={<Automation />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/viewer-settings" element={<ViewerSettings />} />
            <Route path="/bookmarks" element={<Bookmark />} />
            <Route path="/research" element={<Research />} />
            <Route path="/manage-users" element={<UserCreate />} />
            <Route path="/manage-pacs" element={<Pacs />} />
            <Route path="/patient/:id" element={<SinglePatient />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </div>
  )
}

export default App