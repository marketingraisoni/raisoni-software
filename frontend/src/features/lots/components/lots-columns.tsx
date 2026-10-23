import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { getApiErrorMessage } from '@/services/auth-service'
import { lotsQueryKey, updateLotStatus } from '@/services/lots-service'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { formatCarat } from '@/lib/format-carat'
import { formatDate } from '@/lib/format-date'
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  hasPermission,
} from '@/constants/permissions'
import { Switch } from '@/components/ui/switch'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { LOT_STATUS, type Lot } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const lotsColumns: ColumnDef<Lot>[] = [
  {
    accessorKey: 'kapanNo',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Kapan No' />
    ),
    cell: ({ row }) => (
      <LongText className='font-medium'>{row.original.kapanNo}</LongText>
    ),
    meta: { className: 'ps-4' },
    enableSorting: false,
  },
  {
    accessorKey: 'totalCarat',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Total Carat' />
    ),
    cell: ({ row }) => <span>{formatCarat(row.original.totalCarat)} CT</span>,
    enableSorting: false,
  },
  {
    accessorKey: 'totalPcs',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Total PCs' />
    ),
    cell: ({ row }) => <span>{row.original.totalPcs.toLocaleString()}</span>,
    enableSorting: false,
  },
  {
    accessorKey: 'entryDate',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Entry Date' />
    ),
    cell: ({ row }) => <span>{formatDate(row.original.entryDate)}</span>,
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => <LotStatusSwitch lot={row.original} />,
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
    meta: { className: 'w-64 pe-4' },
  },
]

function LotStatusSwitch({ lot }: { lot: Lot }) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const canUpdate = hasPermission(
    user,
    PERMISSION_MODULE.LOTS,
    PERMISSION_ACTION.UPDATE
  )
  const isActive = lot.status === LOT_STATUS.ACTIVE
  const nextStatus = isActive ? LOT_STATUS.CLOSED : LOT_STATUS.ACTIVE
  const mutation = useMutation({
    mutationFn: (active: boolean) =>
      updateLotStatus(
        lot.id,
        active ? LOT_STATUS.ACTIVE : LOT_STATUS.CLOSED
      ),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: lotsQueryKey })
      toast.success(response.message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  return (
    <div className='flex items-center gap-2'>
      <Switch
        checked={isActive}
        disabled={!canUpdate || mutation.isPending}
        onCheckedChange={(checked) => mutation.mutate(checked)}
        aria-label={`Mark ${lot.kapanNo} as ${nextStatus}`}
      />
      <span className='text-sm capitalize'>{lot.status}</span>
    </div>
  )
}
