import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type Table } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/services/auth-service'
import { deleteUser, usersQueryKey } from '@/services/users-service'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type User } from '../data/schema'

type UserMultiDeleteDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

const CONFIRM_WORD = 'DELETE'

export function UsersMultiDeleteDialog<TData>({
  open,
  onOpenChange,
  table,
}: UserMultiDeleteDialogProps<TData>) {
  const [value, setValue] = useState('')
  const queryClient = useQueryClient()
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedUsers = selectedRows.map((row) => row.original as User)

  const mutation = useMutation({
    mutationFn: () => Promise.all(selectedUsers.map((user) => deleteUser(user.id))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
      toast.success(
        `Deleted ${selectedUsers.length} user${selectedUsers.length === 1 ? '' : 's'}.`
      )
      setValue('')
      table.resetRowSelection()
      onOpenChange(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const handleDelete = () => {
    if (value.trim() === CONFIRM_WORD) mutation.mutate()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(state) => {
        if (!mutation.isPending) {
          if (!state) setValue('')
          onOpenChange(state)
        }
      }}
      form='users-multi-delete-form'
      disabled={value.trim() !== CONFIRM_WORD}
      isLoading={mutation.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          Delete {selectedUsers.length}{' '}
          {selectedUsers.length === 1 ? 'user' : 'users'}
        </span>
      }
      desc={
        <form
          id='users-multi-delete-form'
          onSubmit={(event) => {
            event.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p>
            Permanently delete the selected accounts? This action cannot be undone.
          </p>
          <Label className='my-4 flex flex-col items-start gap-1.5'>
            Confirm by typing &quot;{CONFIRM_WORD}&quot;:
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={`Type "${CONFIRM_WORD}" to confirm.`}
              autoFocus
            />
          </Label>
          <Alert variant='destructive'>
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Protected administrator accounts will be rejected by the server.
            </AlertDescription>
          </Alert>
        </form>
      }
      confirmText='Delete'
      destructive
    />
  )
}
