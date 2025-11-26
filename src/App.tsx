import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Auth } from '@/pages/Auth'
import Dashboard from './pages/Dashboard'
import { PacList } from '@/pages/PacList'
import { Automation } from '@/pages/Automation'


import { NotFound } from '@/pages/NotFound'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAppSelector } from '@/store/hooks'
import './App.css'
import UserCreate from './pages/UserCreate'
import Patient from './pages/Patient'
import Performance from './pages/Performance'
import Settings from './pages/Settings'


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
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pac-list"
            element={
              <ProtectedRoute>
                <PacList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automation"
            element={
              <ProtectedRoute>
                <Automation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance"
            element={
              <ProtectedRoute>
                <Performance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage-users"
            element={
              <ProtectedRoute>
                <UserCreate />
              </ProtectedRoute>
            }
          />

          <Route
            path="/manage-patients"
            element={
              <ProtectedRoute>
                <Patient />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </div>
  )
}

export default App