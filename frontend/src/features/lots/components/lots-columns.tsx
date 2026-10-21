import { format } from 'date-fns'
import { type ColumnDef } from '@tanstack/react-table'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { hasPermission } from '@/constants/permissions'
import { formatCarat } from '@/lib/format-carat'
import { getApiErrorMessage } from '@/services/auth-service'
import { lotsQueryKey, updateLotStatus } from '@/services/lots-service'
import { useAuthStore } from '@/stores/auth-store'
import { Switch } from '@/components/ui/switch'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { type Lot } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const lotsColumns: ColumnDef<Lot>[] = [
  {
    accessorKey: 'kapanNo',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Kapan No' />,
    cell: ({ row }) => <LongText className='font-medium'>{row.original.kapanNo}</LongText>,
    meta: { className: 'ps-4' },
    enableHiding: false,
    enableSorting: false,
  },
  {
    accessorKey: 'totalCarat',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Total Carat' />,
    cell: ({ row }) => <span>{formatCarat(row.original.totalCarat)} CT</span>,
    enableSorting: false,
  },
  {
    accessorKey: 'totalPcs',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Total PCs' />,
    cell: ({ row }) => <span>{row.original.totalPcs.toLocaleString()} PCs</span>,
    enableSorting: false,
  },
  {
    accessorKey: 'entryDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Entry Date' />,
    cell: ({ row }) => <span>{format(row.original.entryDate, 'MMM d, yyyy')}</span>,
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
    cell: ({ row }) => <LotStatusSwitch lot={row.original} />,
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
    meta: { className: 'w-44 pe-4' },
  },
]

function LotStatusSwitch({ lot }: { lot: Lot }) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const canUpdate = hasPermission(user, 'lots', 'update')
  const mutation = useMutation({
    mutationFn: (active: boolean) => updateLotStatus(lot.id, active ? 'active' : 'closed'),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: lotsQueryKey })
      toast.success(response.message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  return (
    <div className='flex items-center gap-2'>
      <Switch
        checked={lot.status === 'active'}
        disabled={!canUpdate || mutation.isPending}
        onCheckedChange={(checked) => mutation.mutate(checked)}
        aria-label={`Mark ${lot.kapanNo} as ${lot.status === 'active' ? 'closed' : 'active'}`}
      />
      <span className='text-sm capitalize'>{lot.status}</span>
    </div>
  )
}
