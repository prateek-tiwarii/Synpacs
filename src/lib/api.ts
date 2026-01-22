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

interface HospitalStatsResponse {
  success: boolean
  message: string
  data: {
    total_assigned_cases: number
    total_unassigned_cases: number
    total_critical_cases: number
  }
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
      // Cookie expires in 1 hour to match JWT token expiry
      setCookie('jwt', data.data.token, 1)
      return data
    }

    throw new Error('Invalid response from server')
  }

  async logout() {
    removeCookie('jwt')
    localStorage.clear()
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
    role: string;
    speciality: string;
    qualification: string;
    medical_registration_number: string;
    scope: string;
    available_days: string[];
    available_times: Array<{ start: string; end: string }>;
    on_call: boolean;
  }) {
    return this.request('/api/v1/doctor/create-new', {
      method: 'POST',
      body: JSON.stringify(doctorData),
    })
  }

  async getAllUsers() {
    const hospitalId = localStorage.getItem('active_hospital')
    return this.request('/api/v1/user/get-all-users', {
      method: 'POST',
      body: JSON.stringify({ active_hospital: hospitalId }),
    })
  }

  async deleteUser(userId: string) {
    return this.request(`/api/v1/user/delete/${userId}`, {
      method: 'DELETE',
    })
  }

  async getAllDoctors() {
    return this.request('/api/v1/doctor/get-all-doctors', {
      method: 'POST',
      body: JSON.stringify({ active_hospital: localStorage.getItem('active_hospital') }),
    })
  }

  async getAvailableDoctors() {
    const hospitalId = localStorage.getItem('active_hospital')
    return this.request('/api/v1/doctor/get-available-doctors', {
      method: 'POST',
      body: JSON.stringify({ active_hospital: hospitalId }),
    })
  }

  async getAllPacCases(page: number = 1, limit: number = 10, filters?: {
    start_date?: string;
    end_date?: string;
    patient_name?: string;
    body_part?: string;
    gender?: string;
    hospital?: string;
    modality?: string;
  }) {
    const requestBody: any = {
      active_hospital: localStorage.getItem('active_hospital'),
      page,
      limit,
    };

    if (filters) {
      requestBody.filters = filters;
    }

    return this.request('/api/v1/cases/get-all-cases', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })
  }

  async getRecentPatients() {
    const hospitalId = localStorage.getItem('active_hospital')
    return this.request('/api/v1/patient/get-all', {
      method: 'POST',
      body: JSON.stringify({ active_hospital: hospitalId }),
    })
  }

  async assignCaseToDoctor(case_id: string, assigned_to: string) {
    return this.request(`/api/v1/cases/assign-case`, {
      method: 'POST',
      body: JSON.stringify({ assigned_to: assigned_to, case_id: case_id }),
    })
  }

  async getAllManagedHospitals() {
    return this.request('/api/v1/auth/get-all-managed-hospitals', {
      method: 'GET',
    })
  }

  async updateProfile(profileData: { email: string; full_name: string; phone: string }) {
    return this.request('/api/v1/user/update-profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    })
  }

  async updatePassword(passwordData: { old_password: string; new_password: string }) {
    return this.request('/api/v1/user/update-password', {
      method: 'PUT',
      body: JSON.stringify(passwordData),
    })
  }


  async getAssignedCases(filters?: any) {
    return this.request('/api/v1/cases/get-assigned-cases', {
      method: 'POST',
      body: JSON.stringify({ filters }),
    })
  }

  async getAllCases(page: number = 1, limit: number = 20) {
    const hospitalId = localStorage.getItem('active_hospital')
    return this.request('/api/v1/cases/get-all-cases', {
      method: 'POST',
      body: JSON.stringify({
        active_hospital: hospitalId,
        page,
        limit,
      }),
    })
  }

  async getAllCasesWithFilters(page: number = 1, limit: number = 20, filters: any = {}) {
    const hospitalId = localStorage.getItem('active_hospital')
    return this.request('/api/v1/cases/get-all-cases', {
      method: 'POST',
      body: JSON.stringify({
        active_hospital: hospitalId,
        page,
        limit,
        filters,
      }),
    })
  }

  async getPatientById(patientId: string) {
    return this.request(`/api/v1/patient/${patientId}`, {
      method: 'GET',
    })
  }

  async createCaseNote(caseId: string, noteData: { note: string; flag_type: string }) {
    return this.request(`/api/v1/cases/add-note`, {
      method: 'POST',
      body: JSON.stringify({ case_id: caseId, note: noteData.note, flag_type: noteData.flag_type }),
    })
  }

  async uploadPatientDocument(patientId: string, file: File, title: string, description: string) {
    const token = getCookie('jwt')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title)
    formData.append('description', description)

    const response = await fetch(`${this.baseUrl}/api/v1/patient/${patientId}/documents`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    if (response.status === 401) {
      removeCookie('jwt')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }))
      throw new Error(error.message || 'Upload failed')
    }

    return response.json()
  }

  async getHospitalStats(): Promise<HospitalStatsResponse> {
    const hospitalId = localStorage.getItem('active_hospital')
    return this.request<HospitalStatsResponse>('/api/v1/hospital/get-stats', {
      method: 'POST',
      body: JSON.stringify({ active_hospital: hospitalId }),
    })
  }

  async bookmarkCase(caseId: string) {
    return this.request('/api/v1/cases/bookmark', {
      method: 'POST',
      body: JSON.stringify({ case_id: caseId }),
    })
  }

  async deleteBookmark(caseId: string) {
    return this.request('/api/v1/cases/bookmark', {
      method: 'DELETE',
      body: JSON.stringify({ case_id: caseId }),
    })
  }

  async getBookmarkedCases() {
    return this.request('/api/v1/cases/bookmark', {
      method: 'GET',
    })
  }

  async getCaseById(caseId: string) {
    return this.request(`/api/v1/cases/${caseId}`, {
      method: 'GET',
    })
  }

  async getSeriesImages(seriesId: string) {
    return this.request(`/api/v1/series/${seriesId}/instances`, {
      method: 'GET',
    })
  }

  async getImageUrl(s3Key: string): Promise<{ success: boolean; data: { url: string } }> {
    return this.request(`/api/v1/images/presigned-url`, {
      method: 'POST',
      body: JSON.stringify({ s3_key: s3Key }),
    })
  }

  async getInstanceDicomUrl(instanceUid: string): Promise<{ success: boolean; data: { url: string } }> {
    return this.request(`/api/v1/instances/${instanceUid}/dicom`, {
      method: 'GET',
    })
  }

  async createReport(reportData: {
    case_id: string;
    patient_id: string;
    assigned_to?: string;
    hospital_id?: string;
    content: Record<string, any>;
    content_html: string;
    content_plain_text: string;
    title: string;
    template_id?: string;
    impression?: string;
  }) {
    return this.request('/api/v1/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    })
  }

  async updateReport(reportId: string, reportData: {
    content?: Record<string, any>;
    content_html?: string;
    content_plain_text?: string;
    title?: string;
    impression?: string;
    is_draft?: boolean;
    is_reviewed?: boolean;
    is_signed_off?: boolean;
  }) {
    return this.request(`/api/v1/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify(reportData),
    })
  }

  async getReportByCase(caseId: string) {
    return this.request(`/api/v1/reports/case/${caseId}`, {
      method: 'GET',
    })
  }

  async getReportById(reportId: string) {
    return this.request(`/api/v1/reports/${reportId}`, {
      method: 'GET',
    })
  }

  async downloadReport(reportId: string) {
    return this.request(`/api/v1/reports/${reportId}/download`, {
      method: 'GET',
    })
  }

  async uploadSignature(file: File) {
    const token = getCookie('jwt')
    const formData = new FormData()
    formData.append('signature', file)

    const response = await fetch(`${this.baseUrl}/api/v1/doctor/upload-signature`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    if (response.status === 401) {
      removeCookie('jwt')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }))
      throw new Error(error.message || 'Upload failed')
    }

    return response.json()
  }

  async getPatientsByCenter(centerId: string) {
    return this.request(`/api/v1/doctor/center/${centerId}/patients`, {
      method: 'GET',
    })
  }
  async getAllPatients(activeHospital: string, page: number = 1, limit: number = 20) {
    return this.request('/api/v1/patient/get-all', {
      method: 'POST',
      body: JSON.stringify({
        active_hospital: activeHospital,
        page,
        limit
      })
    });
  }}

export const apiService = new ApiService(API_BASE_URL)
