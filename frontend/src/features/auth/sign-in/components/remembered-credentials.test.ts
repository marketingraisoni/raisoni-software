import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearRememberedCredentials,
  loadRememberedCredentials,
  saveRememberedCredentials,
} from './remembered-credentials'

const STORAGE_KEY = 'raisoni_remembered_credentials'
const DATABASE_NAME = 'raisoni-secure-login'

function deleteKeyDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Key database is blocked'))
  })
}

describe('remembered credentials', () => {
  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEY)
    await deleteKeyDatabase()
  })

  it('encrypts and restores the saved username and password', async () => {
    await saveRememberedCredentials({
      username: 'remembered.user',
      password: 'SavedPassword@123',
    })

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBeTruthy()
    expect(stored).not.toContain('remembered.user')
    expect(stored).not.toContain('SavedPassword@123')
    await expect(loadRememberedCredentials()).resolves.toEqual({
      username: 'remembered.user',
      password: 'SavedPassword@123',
    })
  })

  it('removes an unreadable saved value', async () => {
    localStorage.setItem(STORAGE_KEY, 'invalid')

    await expect(loadRememberedCredentials()).resolves.toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('removes saved credentials when Remember Me is unchecked', async () => {
    await saveRememberedCredentials({
      username: 'remembered.user',
      password: 'SavedPassword@123',
    })

    clearRememberedCredentials()

    await expect(loadRememberedCredentials()).resolves.toBeNull()
  })
})
