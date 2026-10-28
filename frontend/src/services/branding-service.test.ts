import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resolveBrandingImageUrl,
  uploadLoginBrandingImage,
} from './branding-service'

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: postMock,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveBrandingImageUrl', () => {
  it('resolves backend upload paths against the current server', () => {
    expect(resolveBrandingImageUrl('/uploads/branding/login.webp')).toBe(
      `${window.location.origin}/uploads/branding/login.webp`
    )
  })

  it('keeps valid remote image URLs', () => {
    expect(resolveBrandingImageUrl('https://cdn.example.com/login.webp')).toBe(
      'https://cdn.example.com/login.webp'
    )
  })

  it('rejects unsupported URL protocols', () => {
    expect(resolveBrandingImageUrl('javascript:alert(1)')).toBe('')
  })

  it('uploads the selected image to the protected branding endpoint', async () => {
    postMock.mockResolvedValue({
      data: {
        message: 'Login image updated successfully',
        data: {
          branding: {
            appName: 'Raisoni ERP',
            loginImageUrl: '/uploads/branding/login.png',
          },
        },
      },
    })
    const file = new File(['image'], 'login.png', { type: 'image/png' })

    await expect(uploadLoginBrandingImage(file)).resolves.toEqual({
      message: 'Login image updated successfully',
      branding: {
        appName: 'Raisoni ERP',
        loginImageUrl: '/uploads/branding/login.png',
      },
    })
    expect(postMock).toHaveBeenCalledWith('/settings/branding/image', file, {
      headers: { 'Content-Type': 'image/png' },
    })
  })
})
