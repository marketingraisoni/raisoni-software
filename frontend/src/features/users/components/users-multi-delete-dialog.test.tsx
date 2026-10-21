import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type Table } from '@tanstack/react-table'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { type User } from '../data/schema'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

const { deleteUser } = vi.hoisted(() => ({ deleteUser: vi.fn() }))

vi.mock('@/services/users-service', () => ({
  deleteUser,
  usersQueryKey: ['users'],
}))

vi.mock('@/services/auth-service', () => ({
  getApiErrorMessage: () => 'Request failed',
}))

const users: User[] = ['one', 'two'].map((suffix) => ({
  id: `user-${suffix}`,
  name: `User ${suffix}`,
  username: `user.${suffix}`,
  email: `${suffix}@example.com`,
  userType: 4,
  userTypeLabel: 'Staff',
  status: 'active',
  permissions: [],
  notes: '',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
}))

function createUsersTable() {
  const resetRowSelection = vi.fn()
  const table = {
    getFilteredSelectedRowModel: () => ({
      rows: users.map((original) => ({ original })),
    }),
    resetRowSelection,
  } as unknown as Table<User>
  return { table, resetRowSelection }
}

describe('UsersMultiDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteUser.mockResolvedValue({ message: 'User deleted' })
  })

  it('deletes every selected user after DELETE is confirmed', async () => {
    const { table, resetRowSelection } = createUsersTable()
    const client = new QueryClient()
    const screen = await render(
      <QueryClientProvider client={client}>
        <UsersMultiDeleteDialog
          open
          table={table}
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>
    )

    const button = screen.getByRole('button', { name: 'Delete' })
    await expect.element(button).toBeDisabled()
    await userEvent.fill(screen.getByRole('textbox'), 'DELETE')
    await userEvent.click(button)

    await vi.waitFor(() => expect(deleteUser).toHaveBeenCalledTimes(2))
    expect(deleteUser).toHaveBeenCalledWith('user-one')
    expect(deleteUser).toHaveBeenCalledWith('user-two')
    expect(resetRowSelection).toHaveBeenCalledOnce()
  })
})
