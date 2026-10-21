import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { type User } from '../data/schema'
import { UsersActionDialog } from './users-action-dialog'

const { createUser, updateUser } = vi.hoisted(() => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('@/services/users-service', () => ({
  createUser,
  updateUser,
  usersQueryKey: ['users'],
}))

vi.mock('@/services/auth-service', () => ({
  getApiErrorMessage: () => 'Request failed',
}))

const existingUser: User = {
  id: 'user-1',
  name: 'Alex Smith',
  username: 'alex.smith',
  email: 'alex@example.com',
  userType: 3,
  userTypeLabel: 'Manager',
  status: 'active',
  permissions: [],
  notes: 'Sales manager',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
}

function withQueryClient(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('UsersActionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createUser.mockResolvedValue({ message: 'User created' })
    updateUser.mockResolvedValue({ message: 'User updated' })
  })

  it('creates a backend user from the form', async () => {
    const onOpenChange = vi.fn()
    const screen = await render(
      withQueryClient(
        <UsersActionDialog open onOpenChange={onOpenChange} />
      )
    )

    await userEvent.fill(screen.getByLabelText('Full Name'), 'New User')
    await userEvent.fill(screen.getByLabelText('Username'), 'new.user1')
    await userEvent.fill(screen.getByLabelText('Email'), 'new@example.com')
    await userEvent.fill(screen.getByLabelText('Password'), '123456')
    await userEvent.fill(screen.getByLabelText('Confirm'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }))

    await vi.waitFor(() => expect(createUser).toHaveBeenCalledOnce())
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New User',
        username: 'new.user1',
        email: 'new@example.com',
        userType: 4,
        status: 'active',
      })
    )
  })

  it('updates a user without changing the username or password', async () => {
    const screen = await render(
      withQueryClient(
        <UsersActionDialog
          open
          currentRow={existingUser}
          onOpenChange={vi.fn()}
        />
      )
    )

    await expect.element(screen.getByLabelText('Username')).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Full Name'))
    await userEvent.fill(screen.getByLabelText('Full Name'), 'Alex Johnson')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledOnce())
    expect(updateUser).toHaveBeenCalledWith(
      existingUser.id,
      expect.objectContaining({ name: 'Alex Johnson' })
    )
    expect(updateUser.mock.calls[0]?.[1]).not.toHaveProperty('username')
    expect(updateUser.mock.calls[0]?.[1]).not.toHaveProperty('password')
  })
})
