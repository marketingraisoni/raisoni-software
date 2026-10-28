const CREDENTIALS_STORAGE_KEY = 'raisoni_remembered_credentials'
const KEY_DATABASE_NAME = 'raisoni-secure-login'
const KEY_STORE_NAME = 'keys'
const ENCRYPTION_KEY_NAME = 'remembered-credentials'

type EncryptedCredentials = {
  version: 1
  iv: string
  value: string
}

export type RememberedCredentials = {
  username: string
  password: string
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

async function openKeyDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(KEY_DATABASE_NAME, 1)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(KEY_STORE_NAME)) {
      request.result.createObjectStore(KEY_STORE_NAME)
    }
  }
  return requestResult(request)
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const database = await openKeyDatabase()

  try {
    const readTransaction = database.transaction(KEY_STORE_NAME, 'readonly')
    const storedKey = await requestResult<CryptoKey | undefined>(
      readTransaction.objectStore(KEY_STORE_NAME).get(ENCRYPTION_KEY_NAME)
    )
    if (storedKey) return storedKey

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
    const writeTransaction = database.transaction(KEY_STORE_NAME, 'readwrite')
    writeTransaction
      .objectStore(KEY_STORE_NAME)
      .put(key, ENCRYPTION_KEY_NAME)
    await transactionComplete(writeTransaction)
    return key
  } finally {
    database.close()
  }
}

function toBase64(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return window.btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = window.atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export async function saveRememberedCredentials(
  credentials: RememberedCredentials
): Promise<void> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(credentials))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )
  const stored: EncryptedCredentials = {
    version: 1,
    iv: toBase64(iv),
    value: toBase64(new Uint8Array(encrypted)),
  }
  localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(stored))
}

export function clearRememberedCredentials(): void {
  localStorage.removeItem(CREDENTIALS_STORAGE_KEY)
}

export async function loadRememberedCredentials(): Promise<RememberedCredentials | null> {
  const raw = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
  if (!raw) return null

  try {
    const stored = JSON.parse(raw) as EncryptedCredentials
    if (
      stored.version !== 1 ||
      typeof stored.iv !== 'string' ||
      typeof stored.value !== 'string'
    ) {
      throw new Error('Invalid remembered credentials')
    }

    const key = await getEncryptionKey()
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(stored.iv) },
      key,
      fromBase64(stored.value)
    )
    const credentials = JSON.parse(
      new TextDecoder().decode(decrypted)
    ) as RememberedCredentials

    if (
      typeof credentials.username !== 'string' ||
      !credentials.username ||
      typeof credentials.password !== 'string' ||
      !credentials.password
    ) {
      throw new Error('Invalid remembered credentials')
    }
    return credentials
  } catch {
    localStorage.removeItem(CREDENTIALS_STORAGE_KEY)
    return null
  }
}
