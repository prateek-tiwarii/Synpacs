import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { apiService } from '@/lib/api'
import { getCookie } from '@/lib/cookies'

export interface User {
  _id: string
  email: string
  full_name: string
  phone: string
  role: string
  is_active: boolean
  hospital_id: string | { _id: string }
  created_by: string | null
  last_login: string | null
  createdAt: string
  updatedAt: string
  __v: number
}

interface UserResponse {
  success: boolean
  message: string
  data: User
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

const checkInitialAuth = () => {
  return !!getCookie('jwt')
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: checkInitialAuth(),
  loading: false,
  error: null,
}

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await apiService.login(credentials)
      return response
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const fetchUser = createAsyncThunk(
  'auth/fetchUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.request<UserResponse>('/api/v1/auth/get-user')

      // Check and set active_hospital in localStorage
      const activeHospital = localStorage.getItem('active_hospital')
      if (!activeHospital && response.data.hospital_id) {
        const hospital = response.data.hospital_id
        // Handle both populated object and string ID cases
        const hospitalId = typeof hospital === 'object' ? hospital._id : hospital
        localStorage.setItem('active_hospital', hospitalId)
      }

      return response.data
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload
      state.isAuthenticated = true
      state.error = null
    },
    logout: (state) => {
      apiService.logout()
      state.user = null
      state.isAuthenticated = false
      state.error = null
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state) => {
        state.loading = false
        state.isAuthenticated = true
        state.error = null
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.isAuthenticated = false
        state.error = action.payload as string
      })
      .addCase(fetchUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload
        state.isAuthenticated = true
        state.error = null
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
        // If fetching user fails (e.g., 401 Unauthorized), reset auth state
        if (action.payload === 'Unauthorized') {
          state.isAuthenticated = false
          state.user = null
        }
      })
  },
})

export const { setUser, logout, updateUser, clearError } = authSlice.actions
export default authSlice.reducer
