import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchUser } from '@/store/authSlice'

export const useUser = () => {
  const dispatch = useAppDispatch()
  const { user, loading, error, isAuthenticated } = useAppSelector((state) => state.auth)
  const role = user?.role || 'N/A'

  useEffect(() => {
    if (isAuthenticated && !user && !loading) {
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

