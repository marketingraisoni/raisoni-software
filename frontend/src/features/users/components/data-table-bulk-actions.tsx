import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type Table } from '@tanstack/react-table'
import { Trash2, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/services/auth-service'
import { updateUser, usersQueryKey } from '@/services/users-service'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { type User, type UserStatus } from '../data/schema'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/constants/permissions'

type DataTableBulkActionsProps = {
  table: Table<User>
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const queryClient = useQueryClient()
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedUsers = selectedRows.map((row) => row.original)
  const user = useAuthStore((state) => state.auth.user)
  const canUpdate = hasPermission(user, 'users', 'update')
  const canDelete = hasPermission(user, 'users', 'delete')

  const statusMutation = useMutation({
    mutationFn: async (status: UserStatus) => {
      await Promise.all(
        selectedUsers.map((user) => updateUser(user.id, { status }))
      )
      return status
    },
    onSuccess: async (status) => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
      table.resetRowSelection()
      toast.success(
        `${status === 'active' ? 'Activated' : 'Deactivated'} ${selectedUsers.length} user${selectedUsers.length === 1 ? '' : 's'}.`
      )
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  if (!canUpdate && !canDelete) return null

  return (
    <>
      <BulkActionsToolbar table={table} entityName='user'>
        {canUpdate && <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => statusMutation.mutate('active')}
              disabled={statusMutation.isPending}
              className='size-8'
              aria-label='Activate selected users'
            >
              <UserCheck />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Activate selected users</TooltipContent>
        </Tooltip>}

        {canUpdate && <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => statusMutation.mutate('inactive')}
              disabled={statusMutation.isPending}
              className='size-8'
              aria-label='Deactivate selected users'
            >
              <UserX />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deactivate selected users</TooltipContent>
        </Tooltip>}

        {canDelete && <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              disabled={statusMutation.isPending}
              className='size-8'
              aria-label='Delete selected users'
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete selected users</TooltipContent>
        </Tooltip>}
      </BulkActionsToolbar>

      {canDelete && <UsersMultiDeleteDialog
        table={table}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      />}
    </>
  )
}
