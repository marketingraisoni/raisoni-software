import axios from 'axios'
import { type ApiErrorResponse, type ApiResponse } from '@/types/api'
import { type AuthUser } from '@/stores/auth-store'
import { apiClient } from '@/lib/api-client'
import {
  getDefaultPermissions,
  type PermissionGrant,
} from '@/constants/permissions'
import {
  USER_TYPE_LABEL,
  legacyRoleToUserType,
  type UserType,
} from '@/constants/user-types'

type LoginData = {
  token: string
  userType: UserType
  user: AuthUser
}

type CurrentUserData = {
  user: AuthUser
}

type LegacyLoginResponse = {
  success: boolean
  message: string
  token: string
  user:
    | AuthUser
    | (Omit<AuthUser, 'userType' | 'userTypeLabel' | 'permissions'> & {
        role: string
        permissions?: PermissionGrant[]
      })
}

type LegacyCurrentUserResponse = {
  success: boolean
  message?: string
  user:
    | AuthUser
    | (Omit<AuthUser, 'userType' | 'userTypeLabel' | 'permissions'> & {
        role: string
        permissions?: PermissionGrant[]
      })
}

function resolveAvatarUrl(url?: string): string {
  if (!url) return ''
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:')
  ) {
    return url
  }
  const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
  return baseUrl ? `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}` : url
}

function normalizeAuthUser(user: LegacyLoginResponse['user']): AuthUser {
  if ('userType' in user) {
    const userType = user.userType
    return {
      ...user,
      avatarUrl: resolveAvatarUrl(user.avatarUrl),
      userTypeLabel: user.userTypeLabel || USER_TYPE_LABEL[userType] || 'Staff',
      permissions: user.permissions || getDefaultPermissions(user.userType),
    }
  }
  const userType = legacyRoleToUserType(user.role)
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatarUrl: resolveAvatarUrl(user.avatarUrl),
    lastLogin: user.lastLogin,
    userType,
    userTypeLabel: USER_TYPE_LABEL[userType],
    permissions: user.permissions || getDefaultPermissions(userType),
  }
}

export async function login(
  username: string,
  password: string,
  rememberMe = false
) {
  const { data: response } = await apiClient.post<
    ApiResponse<LoginData> | LegacyLoginResponse
  >('/auth/login', { username, password, rememberMe })

  if ('data' in response) {
    return {
      success: response.success,
      message: response.message,
      ...response.data,
      user: normalizeAuthUser(response.data.user),
    }
  }

  const user = normalizeAuthUser(response.user)

  return {
    success: response.success,
    message: response.message,
    token: response.token,
    user,
    userType: user.userType,
  }
}

export async function getCurrentUser() {
  const { data: response } = await apiClient.get<
    ApiResponse<CurrentUserData> | LegacyCurrentUserResponse
  >('/auth/me')
  return normalizeAuthUser(
    'data' in response ? response.data.user : response.user
  )
}

export async function updateCurrentUserProfile(input: {
  name: string
  username: string
}) {
  const { data: response } = await apiClient.put<
    ApiResponse<{ user: AuthUser }>
  >('/auth/profile', input)

  return {
    message: response.message,
    user: normalizeAuthUser(response.data.user),
  }
}

export async function uploadCurrentUserPhoto(file: File) {
  const { data: response } = await apiClient.post<
    ApiResponse<{ user: AuthUser }>
  >('/auth/profile/photo', file, {
    headers: { 'Content-Type': file.type },
  })

  return {
    message: response.message,
    user: normalizeAuthUser(response.data.user),
  }
}

export async function removeCurrentUserPhoto() {
  const { data: response } = await apiClient.delete<
    ApiResponse<{ user: AuthUser }>
  >('/auth/profile/photo')

  return {
    message: response.message,
    user: normalizeAuthUser(response.data.user),
  }
}

export async function changeCurrentUserPassword(input: {
  currentPassword: string
  newPassword: string
}) {
  const { data: response } = await apiClient.post<ApiResponse<null>>(
    '/auth/change-password',
    input
  )
  return response.message
}

export async function logout() {
  const { data } = await apiClient.post<ApiResponse<null>>('/auth/logout')
  return data
}

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message || error.message
  }

  return 'Unable to connect to the server. Please try again.'
}
