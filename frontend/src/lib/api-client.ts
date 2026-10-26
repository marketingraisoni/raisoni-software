import axios from 'axios'
import { useAuthStore } from '@/stores/auth-store'

const apiBaseUrl = import.meta.env.VITE_API_URL.replace(/\/$/, '')

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().auth.accessToken

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

