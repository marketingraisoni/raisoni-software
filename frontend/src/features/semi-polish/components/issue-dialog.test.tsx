import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { IssueDialog } from './issue-dialog'

const { createVendor, fetchVendors, navigate } = vi.hoisted(() => ({
  createVendor: vi.fn(),
  fetchVendors: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('@/services/semi-polish-service', () => ({
  createVendor,
  fetchVendors,
  issueToSemiPolish: vi.fn(),
  semiPolishQueryKeys: {
    all: ['semi-polish'],
    vendors: ['semi-polish', 'vendors'],
    detail: (id: string) => ['semi-polish', 'detail', id],
  },
}))

vi.mock('@/services/auth-service', () => ({
  getApiErrorMessage: () => 'Request failed',
}))

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <IssueDialog
        open
        onOpenChange={vi.fn()}
        lot={{
          _id: 'lot-1',
          kapanNo: 'UN',
          totalCarat: 10,
          totalPcs: 5,
          entryDate: new Date().toISOString(),
        }}
      />
    </QueryClientProvider>
  )
}

describe('IssueDialog vendor creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchVendors.mockResolvedValue([])
    createVendor.mockResolvedValue({
      _id: 'vendor-1',
      name: 'Raisoni Polish',
      mobile: '9876543210',
    })
  })

  it('keeps typed vendor details and submits them', async () => {
    const screen = await renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Add vendor' }))
    const nameInput = screen.getByLabelText('Vendor name')
    const mobileInput = screen.getByLabelText('Mobile number (optional)')

    await userEvent.fill(nameInput, 'Raisoni Polish')
    await userEvent.fill(mobileInput, '9876543210')

    await expect.element(nameInput).toHaveValue('Raisoni Polish')
    await expect.element(mobileInput).toHaveValue('9876543210')

    await userEvent.click(screen.getByRole('button', { name: 'Save vendor' }))

    await vi.waitFor(() => expect(createVendor).toHaveBeenCalledOnce())
    expect(createVendor.mock.calls[0]?.[0]).toEqual({
      name: 'Raisoni Polish',
      mobile: '9876543210',
    })
  })
})
