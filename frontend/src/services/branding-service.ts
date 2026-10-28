import { type ApiResponse } from '@/types/api'
import { apiClient } from '@/lib/api-client'

export type PublicBranding = {
  appName: string
  loginImageUrl: string
}

export const publicBrandingQueryKey = ['settings', 'public-branding'] as const

export async function getPublicBranding() {
  const { data: response } = await apiClient.get<
    ApiResponse<{ branding: PublicBranding }>
  >('/settings/public/branding', { timeout: 4_000 })

  return response.data.branding
}

export async function uploadLoginBrandingImage(file: File) {
  const { data: response } = await apiClient.post<
    ApiResponse<{ branding: PublicBranding }>
  >('/settings/branding/image', file, {
    headers: { 'Content-Type': file.type },
  })

  return {
    message: response.message,
    branding: response.data.branding,
  }
}

export function resolveBrandingImageUrl(value: string) {
  const imageUrl = value.trim()
  if (!imageUrl) return ''
  if (/^data:image\/(jpeg|png|webp);base64,/i.test(imageUrl)) return imageUrl

  const configuredApiUrl = import.meta.env.VITE_API_URL || '/api'
  const serverOrigin = configuredApiUrl.startsWith('http')
    ? new URL(configuredApiUrl).origin
    : window.location.origin

  try {
    const resolvedUrl = new URL(imageUrl, `${serverOrigin}/`)
    return ['http:', 'https:'].includes(resolvedUrl.protocol)
      ? resolvedUrl.toString()
      : ''
  } catch {
    return ''
  }
}
