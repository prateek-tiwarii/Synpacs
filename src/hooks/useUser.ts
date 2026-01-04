import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchUser } from '@/store/authSlice'

export const useUser = () => {
  const dispatch = useAppDispatch()
  const { user, loading, error, isAuthenticated } = useAppSelector((state) => state.auth)
  const role = user?.role || 'N/A'
  const hasFetched = useRef(false)

  useEffect(() => {
    // Only fetch once per session when authenticated and user is not loaded
    if (isAuthenticated && !user && !loading && !hasFetched.current) {
      hasFetched.current = true
      dispatch(fetchUser())
    }
  }, [isAuthenticated, user, loading, dispatch])

  const refetch = () => {
    dispatch(fetchUser())
  }

  return {
    user,
    loading,
    error,
    refetch,
    role,
  }
}

