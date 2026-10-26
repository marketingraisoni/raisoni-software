import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { PasswordSettingsPage } from './password'

const { changeCurrentUserPassword } = vi.hoisted(() => ({
  changeCurrentUserPassword: vi.fn(),
}))

vi.mock('@/services/auth-service', () => ({
  changeCurrentUserPassword,
  getApiErrorMessage: () => 'Request failed',
}))

describe('PasswordSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    changeCurrentUserPassword.mockResolvedValue('Password changed successfully')
  })

  it('validates confirmation and submits the current and new passwords', async () => {
    const client = new QueryClient()
    const screen = await render(
      <QueryClientProvider client={client}>
        <PasswordSettingsPage />
      </QueryClientProvider>
    )

    await userEvent.fill(
      screen.getByLabelText('Current password', { exact: true }),
      'CurrentPassword123'
    )
    await userEvent.fill(
      screen.getByLabelText('New password', { exact: true }),
      'NewPassword456'
    )
    await userEvent.fill(
      screen.getByLabelText('Confirm new password', { exact: true }),
      'DifferentPassword'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Change password' })
    )

    await expect
      .element(screen.getByText('Passwords do not match.'))
      .toBeVisible()
    expect(changeCurrentUserPassword).not.toHaveBeenCalled()

    await userEvent.fill(
      screen.getByLabelText('Confirm new password', { exact: true }),
      'NewPassword456'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Change password' })
    )

    await vi.waitFor(() =>
      expect(changeCurrentUserPassword).toHaveBeenCalledWith({
        currentPassword: 'CurrentPassword123',
        newPassword: 'NewPassword456',
      })
    )
  })
})
