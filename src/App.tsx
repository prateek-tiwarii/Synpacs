import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { About } from '@/pages/About'
import { Auth } from '@/pages/Auth'
import Dashboard from './pages/Dashboard'
import { Worklist } from '@/pages/Worklist'
import { PacList } from '@/pages/PacList'
import { Automation } from '@/pages/Automation'

import { NotFound } from '@/pages/NotFound'
import { Navigation } from '@/components/Navigation'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAppSelector } from '@/store/hooks'
import './App.css'

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

        {/* Dashboard Routes with Navbar */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/worklist" element={<Worklist />} />
        <Route path="/pac-list" element={<PacList />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="/settings" element={<Settings/>} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/worklist"
            element={
              <ProtectedRoute>
                <Worklist />
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
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
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
