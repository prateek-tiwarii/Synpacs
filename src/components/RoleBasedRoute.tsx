import { Navigate } from 'react-router-dom'
import { useAppSelector } from '@/store/hooks'
import { useEffect } from 'react'
import { useAppDispatch } from '@/store/hooks'
import { fetchUser } from '@/store/authSlice'

interface RoleBasedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export function RoleBasedRoute({ children, allowedRoles }: RoleBasedRouteProps) {
  const dispatch = useAppDispatch()
  const { isAuthenticated, user, loading } = useAppSelector((state) => state.auth)

  useEffect(() => {
    if (isAuthenticated && !user) {
      dispatch(fetchUser())
    }
  }, [isAuthenticated, user, dispatch])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Show loading state while fetching user data
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Check if user has required role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
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

  return <>{children}</>
}
