import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SignIn2 } from './sign-in-2'

const { getPublicBrandingMock } = vi.hoisted(() => ({
  getPublicBrandingMock: vi.fn(),
}))

vi.mock('@/services/branding-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/branding-service')>()
  return { ...actual, getPublicBranding: getPublicBrandingMock }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useSearch: () => ({ redirect: undefined }) }
})

vi.mock('./components/user-auth-form', () => ({
  UserAuthForm: () => <div>Login form</div>,
}))

describe('SignIn2 branding image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show the fallback while the backend request is pending', async () => {
    getPublicBrandingMock.mockReturnValue(new Promise(() => {}))

    await render(<SignIn2 />)

    expect(
      document.querySelector('img[alt="Raisoni ERP dashboard"]')
    ).toBeNull()
  })

  it('shows the image URL returned by the public settings API', async () => {
    getPublicBrandingMock.mockResolvedValue({
      appName: 'Raisoni ERP',
      loginImageUrl: 'https://cdn.example.com/login.webp',
    })
    const screen = await render(<SignIn2 />)

    await expect
      .element(screen.getByAltText('Raisoni ERP dashboard'))
      .toHaveAttribute('src', 'https://cdn.example.com/login.webp')
  })

  it('uses the bundled image when the API has no login image', async () => {
    getPublicBrandingMock.mockResolvedValue({
      appName: 'Raisoni ERP',
      loginImageUrl: '',
    })
    const screen = await render(<SignIn2 />)

    await expect
      .element(screen.getByAltText('Raisoni ERP dashboard'))
      .toHaveAttribute('src', expect.stringContaining('dashboard-light'))
  })

  it('uses the bundled image when the branding request fails', async () => {
    getPublicBrandingMock.mockRejectedValue(new Error('Server unavailable'))
    const screen = await render(<SignIn2 />)

    await expect
      .element(screen.getByAltText('Raisoni ERP dashboard'))
      .toHaveAttribute('src', expect.stringContaining('dashboard-light'))
  })

  it('uses the bundled image when the backend image cannot be loaded', async () => {
    getPublicBrandingMock.mockResolvedValue({
      appName: 'Raisoni ERP',
      loginImageUrl: 'https://cdn.example.com/missing.webp',
    })
    const screen = await render(<SignIn2 />)
    const artwork = screen.getByAltText('Raisoni ERP dashboard')

    await expect
      .element(artwork)
      .toHaveAttribute('src', 'https://cdn.example.com/missing.webp')

    document
      .querySelector<HTMLImageElement>('img[alt="Raisoni ERP dashboard"]')
      ?.dispatchEvent(new Event('error'))

    await expect
      .element(artwork)
      .toHaveAttribute('src', expect.stringContaining('dashboard-light'))
  })
})
