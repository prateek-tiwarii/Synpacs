import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Auth } from '@/pages/Auth'
import Dashboard from './pages/Dashboard'
import { Automation } from '@/pages/Automation'
import { NotFound } from '@/pages/NotFound'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAppSelector } from '@/store/hooks'
import './App.css'
import UserCreate from './pages/UserCreate'
import Patient from './pages/Patient'
import SinglePatient from './pages/SinglePatient'
import Performance from './pages/Performance'
import Settings from './pages/Settings'
import { MainLayout } from '@/components/MainLayout'
import { Toaster } from 'react-hot-toast'


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
            <Route path="/manage-users" element={<UserCreate />} />
            <Route path="/manage-patients" element={<Patient />} />
            <Route path="/patient/:id" element={<SinglePatient />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </div>
  )
}

export default App