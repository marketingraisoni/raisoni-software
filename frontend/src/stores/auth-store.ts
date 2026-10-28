import { create } from 'zustand'
import { getCookie, removeCookie } from '@/lib/cookies'
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
    rememberMe: boolean
    setAccessToken: (accessToken: string) => void
    setSession: (
      user: AuthUser,
      accessToken: string,
      rememberMe?: boolean
    ) => void
    resetAccessToken: () => void
    reset: () => void
    canAccess: (module: PermissionModule, action?: PermissionAction) => boolean
  }
}

type StoredSession = {
  user: AuthUser | null
  accessToken: string
  rememberMe: boolean
}

type ElectronRememberedSessionState = {
  initialized: boolean
  session: StoredSession | null
}

type ElectronAuthApi = {
  getRememberedSession?: () => ElectronRememberedSessionState
  setRememberedSession?: (session: StoredSession) => boolean
  clearRememberedSession?: () => boolean
}

function getElectronAuthApi(): ElectronAuthApi | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { electronAPI?: ElectronAuthApi }).electronAPI
}

function readElectronRememberedSession():
  | ElectronRememberedSessionState
  | undefined {
  try {
    return getElectronAuthApi()?.getRememberedSession?.()
  } catch {
    return undefined
  }
}

function saveElectronRememberedSession(session: StoredSession) {
  try {
    getElectronAuthApi()?.setRememberedSession?.(session)
  } catch {
    // Browser storage remains available if Electron secure storage fails.
  }
}

function clearElectronRememberedSession() {
  try {
    getElectronAuthApi()?.clearRememberedSession?.()
  } catch {
    // Browser storage is still cleared below.
  }
}

function readUser(storage: Storage): AuthUser | null {
  try {
    const raw = storage.getItem(AUTH_USER)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    storage.removeItem(AUTH_USER)
    return null
  }
}

function readSession(
  storage: Storage,
  rememberMe: boolean
): StoredSession | null {
  try {
    const accessToken = storage.getItem(ACCESS_TOKEN) || ''
    if (!accessToken) return null
    return { user: readUser(storage), accessToken, rememberMe }
  } catch {
    return null
  }
}

function getStoredSession(): StoredSession {
  const emptySession: StoredSession = {
    user: null,
    accessToken: '',
    rememberMe: false,
  }
  if (typeof window === 'undefined') return emptySession

  const session = readSession(window.sessionStorage, false)
  if (session) return session

  const electronSessionState = readElectronRememberedSession()
  if (electronSessionState?.initialized) {
    return electronSessionState.session || emptySession
  }

  const rememberedSession = readSession(window.localStorage, true)
  if (rememberedSession) {
    saveElectronRememberedSession(rememberedSession)
    return rememberedSession
  }

  // Migrate the cookie used by older releases into the remembered-session flow.
  const cookieState = getCookie(ACCESS_TOKEN)
  if (!cookieState) return emptySession

  try {
    const parsedToken: unknown = JSON.parse(cookieState)
    if (typeof parsedToken === 'string' && parsedToken) {
      const migratedSession = {
        user: readUser(window.localStorage),
        accessToken: parsedToken,
        rememberMe: true,
      }
      persistSession(
        migratedSession.user,
        migratedSession.accessToken,
        migratedSession.rememberMe
      )
      return migratedSession
    }
  } catch {
    // Invalid legacy cookie; remove it below.
  }
  removeCookie(ACCESS_TOKEN)
  return emptySession
}

function clearStorage(storage: Storage) {
  try {
    storage.removeItem(AUTH_USER)
    storage.removeItem(ACCESS_TOKEN)
  } catch {
    // Storage may be unavailable in a restricted browser context.
  }
}

function persistSession(
  user: AuthUser | null,
  accessToken: string,
  rememberMe: boolean
) {
  if (typeof window !== 'undefined') {
    const target = rememberMe ? window.localStorage : window.sessionStorage
    const stale = rememberMe ? window.sessionStorage : window.localStorage

    clearStorage(stale)
    try {
      if (user) target.setItem(AUTH_USER, JSON.stringify(user))
      else target.removeItem(AUTH_USER)

      if (accessToken) target.setItem(ACCESS_TOKEN, accessToken)
      else target.removeItem(ACCESS_TOKEN)
    } catch {
      // Ignore quota or restricted-storage errors; the in-memory session still works.
    }
  }

  if (rememberMe && accessToken) {
    saveElectronRememberedSession({ user, accessToken, rememberMe: true })
  } else {
    clearElectronRememberedSession()
  }

  // Browsers use Web Storage; Electron also keeps remembered sessions encrypted.
  // Always remove the legacy token cookie.
  removeCookie(ACCESS_TOKEN)
}

export const useAuthStore = create<AuthState>()((set, get) => {
  const initialSession = getStoredSession()

  return {
    auth: {
      user: initialSession.user,
      setUser: (user) =>
        set((state) => {
          persistSession(user, state.auth.accessToken, state.auth.rememberMe)
          return { ...state, auth: { ...state.auth, user } }
        }),
      accessToken: initialSession.accessToken,
      rememberMe: initialSession.rememberMe,
      setAccessToken: (accessToken) =>
        set((state) => {
          persistSession(state.auth.user, accessToken, state.auth.rememberMe)
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      setSession: (user, accessToken, rememberMe = false) =>
        set((state) => {
          persistSession(user, accessToken, rememberMe)
          return {
            ...state,
            auth: { ...state.auth, user, accessToken, rememberMe },
          }
        }),
      resetAccessToken: () =>
        set((state) => {
          persistSession(state.auth.user, '', state.auth.rememberMe)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          if (typeof window !== 'undefined') {
            clearStorage(window.localStorage)
            clearStorage(window.sessionStorage)
          }
          clearElectronRememberedSession()
          removeCookie(ACCESS_TOKEN)
          return {
            ...state,
            auth: {
              ...state.auth,
              user: null,
              accessToken: '',
              rememberMe: false,
            },
          }
        }),
      canAccess: (module, action = PERMISSION_ACTION.READ) =>
        hasPermission(get().auth.user, module, action),
    },
  }
})
