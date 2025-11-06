import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Auth } from '@/pages/Auth'
import Dashboard from './pages/Dashboard'

import { Worklist } from '@/pages/Worklist'
import { PacList } from '@/pages/PacList'
import { Automation } from '@/pages/Automation'

import { NotFound } from '@/pages/NotFound'
import { RoleBasedRoute } from '@/components/RoleBasedRoute'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { fetchUser } from '@/store/authSlice'
import { useEffect } from 'react'
import './App.css'
import UserCreate from './pages/UserCreate'
import DoctorDashboard from './pages/DoctorDashboard'


function RootRedirect() {
  const dispatch = useAppDispatch()
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)

  useEffect(() => {
    if (isAuthenticated && !user) {
      dispatch(fetchUser())
    }
  }, [isAuthenticated, user, dispatch])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Wait for user data to load
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect based on role
  switch (user.role) {
    case 'doctor':
      return <Navigate to="/doctor-dashboard" replace />
    case 'super_coordinator':
    case 'coordinator':
      return <Navigate to="/dashboard" replace />
    default:
      return <Navigate to="/login" replace />
  }
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

          {/* Doctor Routes */}
          <Route
            path="/doctor-dashboard"
            element={
              <RoleBasedRoute allowedRoles={['doctor']}>
                <DoctorDashboard />
              </RoleBasedRoute>
            }
          />

          {/* Coordinator/Super Coordinator Routes */}
          <Route
            path="/dashboard"
            element={
              <RoleBasedRoute allowedRoles={['super_coordinator', 'coordinator']}>
                <Dashboard />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/worklist"
            element={
              <RoleBasedRoute allowedRoles={['super_coordinator', 'coordinator']}>
                <Worklist />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/pac-list"
            element={
              <RoleBasedRoute allowedRoles={['super_coordinator', 'coordinator']}>
                <PacList />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/automation"
            element={
              <RoleBasedRoute allowedRoles={['super_coordinator', 'coordinator']}>
                <Automation />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/User-Create"
            element={
              <RoleBasedRoute allowedRoles={['super_coordinator']}>
                <UserCreate />
              </RoleBasedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </div>
  )
}

export default App