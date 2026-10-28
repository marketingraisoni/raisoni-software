import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LoginBrandingSettingsPage } from './login-branding'

const { getPublicBranding, uploadLoginBrandingImage } = vi.hoisted(() => ({
  getPublicBranding: vi.fn(),
  uploadLoginBrandingImage: vi.fn(),
}))

vi.mock('@/services/branding-service', () => ({
  publicBrandingQueryKey: ['settings', 'public-branding'],
  getPublicBranding,
  uploadLoginBrandingImage,
  resolveBrandingImageUrl: (value: string) => value,
}))

vi.mock('@/services/auth-service', () => ({
  getApiErrorMessage: () => 'Request failed',
}))

describe('LoginBrandingSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublicBranding.mockResolvedValue({
      appName: 'Raisoni ERP',
      loginImageUrl: '',
    })
    uploadLoginBrandingImage.mockResolvedValue({
      message: 'Login image updated successfully',
      branding: {
        appName: 'Raisoni ERP',
        loginImageUrl: '/uploads/branding/login.png',
      },
    })
  })

  it('previews and uploads an administrator-selected image', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const screen = await render(
      <QueryClientProvider client={client}>
        <LoginBrandingSettingsPage />
      </QueryClientProvider>
    )
    await expect
      .element(screen.getByRole('button', { name: 'Choose image' }))
      .toBeVisible()

    await screen
      .getByLabelText('Login image file')
      .upload('public/images/logo.png')

    await userEvent.click(screen.getByRole('button', { name: 'Save image' }))

    await vi.waitFor(() =>
      expect(uploadLoginBrandingImage).toHaveBeenCalledWith(expect.any(File))
    )
  })
})
