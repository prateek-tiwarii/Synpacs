import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchUser } from '@/store/authSlice'

export const useUser = () => {
  const dispatch = useAppDispatch()
  const { user, loading, error, isAuthenticated } = useAppSelector((state) => state.auth)

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
  }
}

