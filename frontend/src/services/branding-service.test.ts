import { describe, expect, it } from 'vitest'
import { resolveBrandingImageUrl } from './branding-service'

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
})
