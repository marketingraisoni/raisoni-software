import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { type User } from '../data/schema'
import { UsersDeleteDialog } from './users-delete-dialog'

const { deleteUser } = vi.hoisted(() => ({ deleteUser: vi.fn() }))

vi.mock('@/services/users-service', () => ({
  deleteUser,
  usersQueryKey: ['users'],
}))

vi.mock('@/services/auth-service', () => ({
  getApiErrorMessage: () => 'Request failed',
}))

const user: User = {
  id: 'user-1',
  name: 'John Doe',
  username: 'john.doe',
  email: 'john@example.com',
  userType: 4,
  userTypeLabel: 'Staff',
  status: 'active',
  permissions: [],
  notes: '',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
}

describe('UsersDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteUser.mockResolvedValue({ message: 'User deleted' })
  })

  it('deletes only after the username is confirmed', async () => {
    const client = new QueryClient()
    const screen = await render(
      <QueryClientProvider client={client}>
        <UsersDeleteDialog open currentRow={user} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    const button = screen.getByRole('button', { name: 'Delete' })

    await expect.element(button).toBeDisabled()
    await userEvent.fill(screen.getByRole('textbox'), user.username)
    await userEvent.click(button)

    await vi.waitFor(() => expect(deleteUser).toHaveBeenCalledWith(user.id))
  })
})
