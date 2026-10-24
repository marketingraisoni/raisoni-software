import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { getApiErrorMessage } from '@/services/auth-service'
import { lotsQueryKey, updateLotStatus } from '@/services/lots-service'
import { toast } from 'sonner'
import { ArrowUpRight, CircleAlert, CircleCheck, CircleX } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { formatCarat } from '@/lib/format-carat'
import { formatDate } from '@/lib/format-date'
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  hasPermission,
} from '@/constants/permissions'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  ASSORTMENT_STATUS,
  FOUR_P_STATUS,
  LOT_STATUS,
  type Lot,
} from '../data/schema'
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
    accessorKey: 'assortmentStatus',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Assortment' />
    ),
    cell: ({ row }) => <AssortmentStatusIcon lot={row.original} />,
    meta: { className: 'w-28' },
    enableSorting: false,
  },
  {
    accessorKey: 'fourPStatus',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='4P Process' />
    ),
    cell: ({ row }) => <FourPProgress lot={row.original} />,
    meta: { className: 'min-w-60' },
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lot State' />
    ),
    cell: ({ row }) => <LotStatusSwitch lot={row.original} />,
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
    meta: { className: 'w-24 pe-4' },
  },
]

const assortmentStatusContent = {
  [ASSORTMENT_STATUS.COMPLETED]: {
    label: 'Assortment completed',
    icon: CircleCheck,
    className: 'text-emerald-600 dark:text-emerald-300',
  },
  [ASSORTMENT_STATUS.IN_PROGRESS]: {
    label: 'Assortment in progress',
    icon: CircleAlert,
    className: 'text-amber-600 dark:text-amber-300',
  },
  [ASSORTMENT_STATUS.PENDING]: {
    label: 'Assortment pending',
    icon: CircleX,
    className: 'text-destructive',
  },
}

function AssortmentStatusIcon({ lot }: { lot: Lot }) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const status = assortmentStatusContent[lot.assortmentStatus]
  const StatusIcon = status.icon
  const canOpenAssortment = hasPermission(
    user,
    PERMISSION_MODULE.ASSORTMENT,
    PERMISSION_ACTION.READ
  )

  return (
    <div className='flex items-center gap-2'>
      <span
        role='status'
        aria-label={status.label}
        title={status.label}
        className={cn(
          'inline-flex items-center justify-center',
          status.className
        )}
      >
        <StatusIcon className='size-5' aria-hidden='true' />
      </span>
      {canOpenAssortment ? (
        <ProcessNavigateButton
          label='Open assortment'
          onClick={() =>
            void navigate({
              to: '/packets/$lotId',
              params: { lotId: lot.id },
            })
          }
        />
      ) : null}
    </div>
  )
}

function FourPProgress({ lot }: { lot: Lot }) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const canReadFourP = hasPermission(
    user,
    PERMISSION_MODULE.SEMI_POLISH,
    PERMISSION_ACTION.READ
  )
  const canCreateFourP = hasPermission(
    user,
    PERMISSION_MODULE.SEMI_POLISH,
    PERMISSION_ACTION.CREATE
  )
  const canOpenProcess = Boolean(lot.fourPProcessId && canReadFourP)
  const canStartProcess = Boolean(
    !lot.fourPProcessId && lot.fourPReady && canCreateFourP
  )
  const expectedPackets = lot.fourPExpectedPackets || lot.totalPcs
  const progress =
    lot.fourPStatus === FOUR_P_STATUS.COMPLETED
      ? 100
      : expectedPackets
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                (lot.fourPReturnedPackets / expectedPackets) * 100
              )
            )
          )
        : 0

  return (
    <div className='flex w-56 items-center gap-2'>
      <div className='flex min-w-0 flex-1 flex-col gap-1.5 py-1'>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-sm font-medium tabular-nums'>
            {lot.fourPReturnedPackets.toLocaleString()} /{' '}
            {expectedPackets.toLocaleString()} packets
          </span>
          <span className='text-xs font-medium tabular-nums'>{progress}%</span>
        </div>
        <div className='bg-muted h-1.5 overflow-hidden rounded-full'>
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              lot.fourPStatus === FOUR_P_STATUS.COMPLETED
                ? 'bg-emerald-500'
                : lot.fourPStatus === FOUR_P_STATUS.IN_PROCESS
                  ? 'bg-blue-500'
                  : 'bg-slate-400'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {canOpenProcess || canStartProcess ? (
        <ProcessNavigateButton
          label={canStartProcess ? 'Start 4P process' : 'Open 4P process'}
          onClick={() => {
            if (lot.fourPProcessId) {
              void navigate({
                to: '/semi-polish/$processId',
                params: { processId: lot.fourPProcessId },
              })
              return
            }

            void navigate({
              to: '/semi-polish/ready-for-issue',
              search: { lotId: lot.id },
            })
          }}
        />
      ) : null}
    </div>
  )
}

function ProcessNavigateButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          size='icon'
          variant='ghost'
          className='size-7 shrink-0'
          aria-label={label}
          onClick={onClick}
        >
          <ArrowUpRight className='size-4' />
        </Button>
      </TooltipTrigger>
      <TooltipContent side='top'>{label}</TooltipContent>
    </Tooltip>
  )
}

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
