import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/services/auth-service'
import { deleteUser, usersQueryKey } from '@/services/users-service'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type User } from '../data/schema'

type UserDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: User
}

export function UsersDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: UserDeleteDialogProps) {
  const [value, setValue] = useState('')
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deleteUser(currentRow.id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
      toast.success(response.message)
      setValue('')
      onOpenChange(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const handleDelete = () => {
    if (value.trim() === currentRow.username) mutation.mutate()
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
      form='users-delete-form'
      disabled={value.trim() !== currentRow.username}
      isLoading={mutation.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          Delete User
        </span>
      }
      desc={
        <form
          id='users-delete-form'
          onSubmit={(event) => {
            event.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            Permanently delete <strong>{currentRow.name}</strong> ({currentRow.username})?
            This action cannot be undone.
          </p>

          <Label className='my-2'>
            Type the username to confirm:
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={currentRow.username}
              autoFocus
            />
          </Label>

          <Alert variant='destructive'>
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              You cannot delete your own account or the only active administrator.
            </AlertDescription>
          </Alert>
        </form>
      }
      confirmText='Delete'
      destructive
    />
  )
}
