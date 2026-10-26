import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'
import {
  PERMISSION_ACTION,
  hasPermission,
  type PermissionAction,
  type PermissionGrant,
  type PermissionModule,
} from '@/constants/permissions'
import { type UserType } from '@/constants/user-types'

const ACCESS_TOKEN = 'raisoni_access_token'
const AUTH_USER = 'raisoni_auth_user'

export interface AuthUser {
  id: string
  name: string
  username: string
  email: string
  avatarUrl?: string
  userType: UserType
  userTypeLabel: string
  permissions: PermissionGrant[]
  lastLogin?: string
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    setSession: (user: AuthUser, accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
    canAccess: (module: PermissionModule, action?: PermissionAction) => boolean
  }
}

function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(AUTH_USER)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    window.localStorage.removeItem(AUTH_USER)
    return null
  }
}

function getStoredToken(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(ACCESS_TOKEN)
      if (raw) return raw
    } catch {
      // ignore
    }
  }

  const cookieState = getCookie(ACCESS_TOKEN)
  if (cookieState) {
    try {
      const parsedToken: unknown = JSON.parse(cookieState)
      if (typeof parsedToken === 'string') return parsedToken
      removeCookie(ACCESS_TOKEN)
    } catch {
      removeCookie(ACCESS_TOKEN)
    }
  }
  return ''
}

function persistSession(user: AuthUser | null, accessToken?: string) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (user) {
        window.localStorage.setItem(AUTH_USER, JSON.stringify(user))
      } else {
        window.localStorage.removeItem(AUTH_USER)
      }
      if (accessToken !== undefined) {
        if (accessToken) {
          window.localStorage.setItem(ACCESS_TOKEN, accessToken)
        } else {
          window.localStorage.removeItem(ACCESS_TOKEN)
        }
      }
    } catch {
      // ignore quota issues
    }
  }

  if (accessToken !== undefined) {
    if (accessToken) {
      setCookie(ACCESS_TOKEN, JSON.stringify(accessToken))
    } else {
      removeCookie(ACCESS_TOKEN)
    }
  }
}

export const useAuthStore = create<AuthState>()((set, get) => {
  const initToken = getStoredToken()
  const initUser = getStoredUser()

  return {
    auth: {
      user: initUser,
      setUser: (user) =>
        set((state) => {
          persistSession(user)
          return { ...state, auth: { ...state.auth, user } }
        }),
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          persistSession(state.auth.user, accessToken)
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      setSession: (user, accessToken) =>
        set((state) => {
          persistSession(user, accessToken)
          return { ...state, auth: { ...state.auth, user, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          persistSession(state.auth.user, '')
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          persistSession(null, '')
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
      canAccess: (module, action = PERMISSION_ACTION.READ) =>
        hasPermission(get().auth.user, module, action),
    },
  }
})
