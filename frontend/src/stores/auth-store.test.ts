import { clearCookies } from '@/test-utils/cookies'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_ACTION, PERMISSION_MODULE } from '@/constants/permissions'

async function importAuthStore() {
  const { useAuthStore } = await import('./auth-store')
  return useAuthStore
}

const sampleUser = {
  id: 'user-1',
  name: 'Test User',
  username: 'testuser',
  email: 'user@example.com',
  userType: 4 as const,
  userTypeLabel: 'Staff',
  permissions: [],
}

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    clearCookies()
    vi.resetModules()
  })

  it('starts with an empty access token when nothing is persisted', async () => {
    const useAuthStore = await importAuthStore()

    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('keeps a non-remembered access token for the current browser session', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setAccessToken('session-token')

    vi.resetModules()
    const useAuthStoreAfterReload = await importAuthStore()

    expect(useAuthStoreAfterReload.getState().auth.accessToken).toBe(
      'session-token'
    )
    expect(sessionStorage.getItem('raisoni_access_token')).toBe('session-token')
    expect(localStorage.getItem('raisoni_access_token')).toBeNull()
  })

  it('clears persisted access token when resetAccessToken is used', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setAccessToken('to-clear')
    useAuthStore.getState().auth.resetAccessToken()

    vi.resetModules()
    const useAuthStoreAfterReload = await importAuthStore()

    expect(useAuthStoreAfterReload.getState().auth.accessToken).toBe('')
  })

  it('updates the signed-in user via setUser', async () => {
    const useAuthStore = await importAuthStore()

    useAuthStore.getState().auth.setUser({ ...sampleUser })

    expect(useAuthStore.getState().auth.user).toEqual(sampleUser)
  })

  it('sets a complete authenticated session at once', async () => {
    const useAuthStore = await importAuthStore()

    useAuthStore.getState().auth.setSession(sampleUser, 'session-token')

    expect(useAuthStore.getState().auth.user).toEqual(sampleUser)
    expect(useAuthStore.getState().auth.accessToken).toBe('session-token')
    expect(useAuthStore.getState().auth.rememberMe).toBe(false)
  })

  it('persists a remembered session across app restarts', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore
      .getState()
      .auth.setSession(sampleUser, 'remembered-token', true)

    sessionStorage.clear()
    vi.resetModules()
    const useAuthStoreAfterRestart = await importAuthStore()

    expect(useAuthStoreAfterRestart.getState().auth.user).toEqual(sampleUser)
    expect(useAuthStoreAfterRestart.getState().auth.accessToken).toBe(
      'remembered-token'
    )
    expect(useAuthStoreAfterRestart.getState().auth.rememberMe).toBe(true)
  })

  it('stores a non-remembered session only in session storage', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore
      .getState()
      .auth.setSession(sampleUser, 'temporary-token', false)

    expect(sessionStorage.getItem('raisoni_access_token')).toBe(
      'temporary-token'
    )
    expect(sessionStorage.getItem('raisoni_auth_user')).toBeTruthy()
    expect(localStorage.getItem('raisoni_access_token')).toBeNull()
    expect(localStorage.getItem('raisoni_auth_user')).toBeNull()
  })

  it('checks the current user permissions from the Zustand state', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setUser({
      ...sampleUser,
      permissions: [
        {
          module: PERMISSION_MODULE.DASHBOARD,
          actions: [PERMISSION_ACTION.READ],
        },
      ],
    })

    expect(
      useAuthStore.getState().auth.canAccess(PERMISSION_MODULE.DASHBOARD)
    ).toBe(true)
    expect(
      useAuthStore
        .getState()
        .auth.canAccess(PERMISSION_MODULE.DASHBOARD, PERMISSION_ACTION.UPDATE)
    ).toBe(false)
    expect(
      useAuthStore.getState().auth.canAccess(PERMISSION_MODULE.USERS)
    ).toBe(false)
  })

  it('reset clears user and access token and drops persistence', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setAccessToken('will-be-cleared')
    useAuthStore.getState().auth.setUser({ ...sampleUser })

    useAuthStore.getState().auth.reset()

    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(localStorage.getItem('raisoni_access_token')).toBeNull()
    expect(sessionStorage.getItem('raisoni_access_token')).toBeNull()

    vi.resetModules()
    const useAuthStoreAfterReload = await importAuthStore()

    expect(useAuthStoreAfterReload.getState().auth.user).toBeNull()
    expect(useAuthStoreAfterReload.getState().auth.accessToken).toBe('')
  })
})
