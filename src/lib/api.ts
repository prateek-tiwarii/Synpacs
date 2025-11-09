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

  async createUser(userData: { email: string; full_name: string; phone: string; role: string }) {
    return this.request('/api/v1/user/create-user', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async createDoctor(doctorData: { 
    email: string; 
    full_name: string; 
    phone: string; 
    speciality: string;
    availability: Array<{
      available_days: string[];
      available_times: string[];
      on_call: boolean;
    }>;
  }) {
    return this.request('/api/v1/doctor/create-new', {
      method: 'POST',
      body: JSON.stringify(doctorData),
    })
  }

  async getAllUsers() {
    return this.request('/api/v1/user/get-all-users', {
      method: 'GET',
    })
  }

  async deleteUser(userId: string) {
    return this.request(`/api/v1/user/delete/${userId}`, {
      method: 'DELETE',
    })
  }

  async getAllDoctors() {
    return this.request('/api/v1/doctor/get-all-doctors', {
      method: 'GET',
    })
  }

  async getAllPatients() {
    return this.request('/api/v1/patient/get-all', {
      method: 'GET',
    })
  }

  async getRecentPatients() {
    return this.request('/api/v1/patient/get-recent', {
      method: 'GET',
    })
  }

  async assignPatientToDoctor(patientId: string, doctorId: string) {
    return this.request(`/api/v1/patient/assign/${patientId}`, {
      method: 'PUT',
      body: JSON.stringify({ doctor_id: doctorId }),
    })
  }
}

export const apiService = new ApiService(API_BASE_URL)

