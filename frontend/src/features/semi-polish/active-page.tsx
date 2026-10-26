import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { getApiErrorMessage } from '@/services/auth-service'
import {
  fetchSemiPolishList,
  cancelSemiPolish,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import {
  ArrowDownToLine,
  Eye,
  XCircle,
  RefreshCw,
  Building2,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { formatCarat } from '@/lib/format-carat'
import { formatDate } from '@/lib/format-date'
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  hasPermission,
} from '@/constants/permissions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  DataTableColumnHeader,
  DataTableActionButton,
  getSortQuery,
} from '@/components/data-table'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import {
  SEMI_POLISH_PROCESS_STATUS,
  type SemiPolishProcess,
} from './data/schema'
import { SEMI_POLISH_TABLE_COLUMN } from './data/table'

export function SemiPolishActivePage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const canCreate = hasPermission(
    user,
    PERMISSION_MODULE.SEMI_POLISH,
    PERMISSION_ACTION.CREATE
  )
  const canUpdate = hasPermission(
    user,
    PERMISSION_MODULE.SEMI_POLISH,
    PERMISSION_ACTION.UPDATE
  )
  const canDelete = hasPermission(
    user,
    PERMISSION_MODULE.SEMI_POLISH,
    PERMISSION_ACTION.DELETE
  )

  const [processToCancel, setProcessToCancel] =
    useState<SemiPolishProcess | null>(null)

  // Table states
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

  const queryParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      status: SEMI_POLISH_PROCESS_STATUS.IN_PROCESS,
      ...getSortQuery(sorting),
    }),
    [sorting]
  )

  const listQuery = useQuery({
    queryKey: semiPolishQueryKeys.list(queryParams),
    queryFn: () => fetchSemiPolishList(queryParams),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelSemiPolish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: semiPolishQueryKeys.all })
      toast.success('4P issue has been cancelled')
      setProcessToCancel(null)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const inProcessList = useMemo(
    () =>
      (listQuery.data?.processes || []).filter(
        (process) => process.status === SEMI_POLISH_PROCESS_STATUS.IN_PROCESS
      ),
    [listQuery.data?.processes]
  )

  const handleConfirmCancel = () => {
    if (!processToCancel) return
    const id = (processToCancel._id || processToCancel.id) as string
    cancelMutation.mutate(id)
  }

  const columns = useMemo<ColumnDef<SemiPolishProcess>[]>(
    () => [
      {
        accessorKey: 'issueNo',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Issue / Jangad No' />
        ),
        cell: ({ row }) => (
          <span className='block ps-4 font-mono font-medium text-primary'>
            {row.original.issueNo}
          </span>
        ),
        meta: { className: 'ps-4' },
        enableSorting: false,
      },
      {
        accessorKey: 'kapanNo',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Lot (Kapan No)' />
        ),
        cell: ({ row }) => (
          <span className='font-semibold'>{row.original.kapanNo}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'vendorName',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='4P Vendor' />
        ),
        cell: ({ row }) => (
          <div className='flex items-center gap-1.5'>
            <Building2 className='size-3.5 text-muted-foreground' />
            <span>{row.original.vendorName}</span>
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'issueDate',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Issue Date' />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {formatDate(row.original.issueDate)}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'expectedReturnDate',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Exp. Return' />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {row.original.expectedReturnDate
              ? formatDate(row.original.expectedReturnDate)
              : '-'}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'issuedPieces',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Return Progress' />
        ),
        cell: ({ row }) => (
          <div>
            <span className='font-semibold'>
              {row.original.returnedPacketCount ?? 0} /{' '}
              {row.original.issuedPieces} packets
            </span>
            <p className='text-xs text-muted-foreground'>
              {row.original.activePlanningImport
                ? 'Planning imported'
                : 'Planning pending'}
            </p>
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'issuedCarat',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Issued Carat' />
        ),
        cell: ({ row }) => (
          <span className='font-semibold text-primary'>
            {formatCarat(row.original.issuedCarat)} CT
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: () => (
          <Badge
            variant='outline'
            className='border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          >
            In Process
          </Badge>
        ),
        meta: { className: 'text-center' },
        enableSorting: false,
      },
      {
        id: 'actions',
        header: () => <span className='block pe-4 text-right'>Actions</span>,
        cell: ({ row }) => (
          <div className='flex items-center justify-end gap-1.5 pe-4'>
            {canUpdate && (
              <DataTableActionButton tooltip='Receive / verify packets' asChild>
                <Link
                  to='/semi-polish/planning-returns/$processId'
                  params={{
                    processId: (row.original._id || row.original.id) as string,
                  }}
                  aria-label='Receive or verify packets'
                >
                  <ArrowDownToLine className='size-4' />
                </Link>
              </DataTableActionButton>
            )}
            <DataTableActionButton tooltip='View Details' asChild>
              <Link
                to='/semi-polish/$processId'
                params={{
                  processId: (row.original._id || row.original.id) as string,
                }}
                aria-label='View process details'
              >
                <Eye className='size-4' />
              </Link>
            </DataTableActionButton>
            {canDelete && (
              <DataTableActionButton
                tooltip='Cancel Issue'
                onClick={() => setProcessToCancel(row.original)}
                aria-label='Cancel issue'
              >
                <XCircle className='size-4' />
              </DataTableActionButton>
            )}
          </div>
        ),
        meta: { className: 'w-36 pe-4' },
        enableSorting: false,
      },
    ],
    [canDelete, canUpdate]
  )

  const table = useReactTable({
    data: inProcessList,
    columns,
    state: { pagination, columnFilters, sorting },
    getRowId: (row) => (row._id || row.id) as string,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    manualSorting: true,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <>
      <AppHeader fixed />
      <Main fixed fluid className='flex flex-1 flex-col'>
        <div className='flex min-h-0 flex-1 flex-col max-sm:mb-16'>
          <DataTable
            table={table}
            title='Active 4P Process'
            toolbar={{
              searchPlaceholder: 'Filter by Kapan No...',
              searchKey: SEMI_POLISH_TABLE_COLUMN.KAPAN_NO,
              searchDebounceMs: 200,
              showFilterCounts: false,
              actions: (
                <div className='flex items-center gap-2'>
                  {canCreate && (
                    <Link to='/semi-polish/ready-for-issue'>
                      <Button
                        size='sm'
                        className='cursor-pointer gap-1.5 font-semibold'
                      >
                        Issue New Lot
                        <Plus className='size-3.5' />
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant='outline'
                    size='sm'
                    className='cursor-pointer gap-1.5'
                    onClick={() => void listQuery.refetch()}
                  >
                    <RefreshCw className='size-3.5' />
                    Refresh
                  </Button>
                </div>
              ),
            }}
            pagination={{ totalRows: inProcessList.length }}
            asyncState={listQuery}
            messages={{
              errorTitle: 'Unable to load active 4P handovers.',
              empty: 'No active 4P issues found.',
            }}
          />
        </div>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog
          open={!!processToCancel}
          onOpenChange={(isOpen) => !isOpen && setProcessToCancel(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel 4P Issue?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel Issue{' '}
                <span className='font-mono font-bold text-foreground'>
                  {processToCancel?.issueNo}
                </span>{' '}
                for Lot{' '}
                <span className='font-bold text-foreground'>
                  {processToCancel?.kapanNo}
                </span>
                ? This will release the lot back to the assortment stage.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className='cursor-pointer'>
                Keep
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmCancel}
                className='cursor-pointer bg-destructive text-white hover:bg-destructive/90'
              >
                Cancel Issue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Main>
    </>
  )
}
