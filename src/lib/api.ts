import { getCookie, setCookie, removeCookie } from './cookies'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  success: boolean
  message: string
  data?: {
    token: string
  }
  error?: string
}

class ApiService {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private getAuthHeaders() {
    const token = getCookie('jwt')
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    }
  }

  async login(credentials: LoginRequest) {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    const data: LoginResponse = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Login failed')
    }

    if (data.success && data.data?.token) {
      setCookie('jwt', data.data.token, 1/24)
      return data
    }

    throw new Error('Invalid response from server')
  }

  async logout() {
    removeCookie('jwt')
  }

  getToken() {
    return getCookie('jwt')
  }

  isAuthenticated() {
    return !!this.getToken()
  }

  async request<T>(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options?.headers,
      },
    })

    if (response.status === 401) {
      removeCookie('jwt')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || 'Request failed')
    }

    return response.json() as Promise<T>
  }
}

export const apiService = new ApiService(API_BASE_URL)

