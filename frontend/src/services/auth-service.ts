import axios from 'axios'
import {
  USER_TYPE_LABEL,
  legacyRoleToUserType,
  type UserType,
} from '@/constants/user-types'
import { apiClient } from '@/lib/api-client'
import { type AuthUser } from '@/stores/auth-store'
import { type ApiErrorResponse, type ApiResponse } from '@/types/api'
import { getDefaultPermissions, type PermissionGrant } from '@/constants/permissions'

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
  user: AuthUser | (Omit<AuthUser, 'userType' | 'userTypeLabel' | 'permissions'> & {
    role: string
    permissions?: PermissionGrant[]
  })
}

type LegacyCurrentUserResponse = {
  success: boolean
  message?: string
  user: AuthUser | (Omit<AuthUser, 'userType' | 'userTypeLabel' | 'permissions'> & {
    role: string
    permissions?: PermissionGrant[]
  })
}

function normalizeAuthUser(user: LegacyLoginResponse['user']): AuthUser {
  if ('userType' in user) {
    const userType = user.userType
    return {
      ...user,
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
    lastLogin: user.lastLogin,
    userType,
    userTypeLabel: USER_TYPE_LABEL[userType],
    permissions: user.permissions || getDefaultPermissions(userType),
  }
}

export async function login(username: string, password: string) {
  const { data: response } = await apiClient.post<
    ApiResponse<LoginData> | LegacyLoginResponse
  >('/auth/login', { username, password })

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
  return normalizeAuthUser('data' in response ? response.data.user : response.user)
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
