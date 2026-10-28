import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { UserAuthForm } from './user-auth-form'

const FORM_MESSAGES = {
  usernameEmpty: 'Please enter your username or email.',
  passwordEmpty: 'Please enter your password.',
} as const

const {
  navigate,
  setSessionMock,
  loginMock,
  clearRememberedCredentialsMock,
  loadRememberedCredentialsMock,
  saveRememberedCredentialsMock,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSessionMock: vi.fn(),
  loginMock: vi.fn(),
  clearRememberedCredentialsMock: vi.fn(),
  loadRememberedCredentialsMock: vi.fn(),
  saveRememberedCredentialsMock: vi.fn(),
}))

vi.mock('./remembered-credentials', () => ({
  clearRememberedCredentials: clearRememberedCredentialsMock,
  loadRememberedCredentials: loadRememberedCredentialsMock,
  saveRememberedCredentials: saveRememberedCredentialsMock,
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    auth: {
      setSession: setSessionMock,
    },
  }),
}))

vi.mock('@/services/auth-service', () => ({
  login: loginMock,
  getApiErrorMessage: () => 'Unable to sign in.',
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
    Link: ({
      children,
      to,
      className,
      ...rest
    }: {
      children?: React.ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className} {...rest}>
        {children}
      </a>
    ),
  }
})

describe('UserAuthForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadRememberedCredentialsMock.mockResolvedValue(null)
    saveRememberedCredentialsMock.mockResolvedValue(undefined)
  })

  describe('Rendering without redirectTo', () => {
    let screen: RenderResult
    let usernameInput: Locator
    let passwordInput: Locator
    let signInButton: Locator

    beforeEach(async () => {
      loginMock.mockResolvedValue({
        success: true,
        message: 'Login successful',
        token: 'real-jwt-token',
        user: {
          id: 'user-1',
          name: 'Test Admin',
          username: 'admin',
          email: 'admin@example.com',
          userType: 2,
          userTypeLabel: 'Administrator',
        },
      })
      screen = await render(<UserAuthForm />)
      usernameInput = screen.getByRole('textbox', {
        name: /^Username or email$/i,
      })
      passwordInput = screen.getByLabelText(/^Password$/i)
      signInButton = screen.getByRole('button', { name: /^Sign in$/i })
    })

    it('renders the credential fields and submit button', async () => {
      await expect.element(usernameInput).toBeInTheDocument()
      await expect.element(passwordInput).toBeInTheDocument()
      await expect.element(signInButton).toBeInTheDocument()
    })

    it('shows validation messages when submitting empty form', async () => {
      await userEvent.click(signInButton)

      await expect
        .element(screen.getByText(FORM_MESSAGES.usernameEmpty))
        .toBeInTheDocument()
      await expect
        .element(screen.getByText(FORM_MESSAGES.passwordEmpty))
        .toBeInTheDocument()
    })

    it('authenticates and navigates to default route on success', async () => {
      await userEvent.fill(usernameInput, 'admin')
      await userEvent.fill(passwordInput, '123456')

      await userEvent.click(signInButton)

      await vi.waitFor(() => expect(loginMock).toHaveBeenCalledOnce())
      expect(loginMock).toHaveBeenCalledWith('admin', '123456', false)
      expect(setSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin', userType: 2 }),
        'real-jwt-token',
        false
      )

      await vi.waitFor(() =>
        expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })
      )
    })

    it('creates a persistent session when Remember me is selected', async () => {
      const rememberMeCheckbox = screen.getByRole('checkbox', {
        name: /Remember me/i,
      })

      await userEvent.fill(usernameInput, 'admin')
      await userEvent.fill(passwordInput, '123456')
      await userEvent.click(rememberMeCheckbox)

      await userEvent.click(signInButton)

      await vi.waitFor(() =>
        expect(loginMock).toHaveBeenCalledWith('admin', '123456', true)
      )
      expect(setSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin' }),
        'real-jwt-token',
        true
      )
      expect(saveRememberedCredentialsMock).toHaveBeenCalledWith({
        username: 'admin',
        password: '123456',
      })
      await expect.element(rememberMeCheckbox).toBeChecked()

      await userEvent.click(rememberMeCheckbox)
      expect(clearRememberedCredentialsMock).toHaveBeenCalledOnce()
      await expect.element(rememberMeCheckbox).not.toBeChecked()
    })
  })

  it('fills saved credentials and keeps Remember me checked', async () => {
    vi.clearAllMocks()
    loadRememberedCredentialsMock.mockResolvedValue({
      username: 'remembered.user',
      password: 'SavedPassword@123',
    })

    const screen = await render(<UserAuthForm />)

    await expect
      .element(
        screen.getByRole('textbox', { name: /^Username or email$/i })
      )
      .toHaveValue('remembered.user')
    await expect
      .element(screen.getByLabelText(/^Password$/i))
      .toHaveValue('SavedPassword@123')
    await expect.element(screen.getByRole('checkbox')).toBeChecked()
  })

  it('navigates to redirectTo when provided', async () => {
    vi.clearAllMocks()
    loginMock.mockResolvedValue({
      token: 'real-jwt-token',
      user: {
        id: 'user-1',
        name: 'Test Admin',
        username: 'admin',
        email: 'admin@example.com',
        userType: 2,
        userTypeLabel: 'Administrator',
      },
    })

    const { getByRole, getByLabelText } = await render(
      <UserAuthForm redirectTo='/lots' />
    )

    await userEvent.fill(
      getByRole('textbox', { name: /Username or email/i }),
      'admin'
    )
    await userEvent.fill(getByLabelText('Password'), '123456')

    await userEvent.click(getByRole('button', { name: /Sign in/i }))

    await vi.waitFor(() => expect(setSessionMock).toHaveBeenCalledOnce())

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/lots',
        replace: true,
      })
    )
  })
})
