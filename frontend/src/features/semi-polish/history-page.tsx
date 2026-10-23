import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import {
  fetchSemiPolishList,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import { Building2, Clock, Eye, RefreshCw } from 'lucide-react'
import { formatCarat } from '@/lib/format-carat'
import { formatDate } from '@/lib/format-date'
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

export function SemiPolishHistoryPage() {
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
      limit: 200,
      status: SEMI_POLISH_PROCESS_STATUS.RETURNED,
      ...getSortQuery(sorting),
    }),
    [sorting]
  )

  const listQuery = useQuery({
    queryKey: semiPolishQueryKeys.list(queryParams),
    queryFn: () => fetchSemiPolishList(queryParams),
  })

  const returnedList = useMemo(() => {
    return (listQuery.data?.processes || []).filter(
      (process) => process.status === SEMI_POLISH_PROCESS_STATUS.RETURNED
    )
  }, [listQuery.data?.processes])

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
        accessorKey: 'returnDate',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Return Date' />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {row.original.returnDate
              ? formatDate(row.original.returnDate)
              : '-'}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'issuedCarat',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Issued Wt' />
        ),
        cell: ({ row }) => (
          <span>
            {formatCarat(row.original.issuedCarat)} CT (
            {row.original.issuedPieces} pcs)
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'returnedCarat',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Returned Wt' />
        ),
        cell: ({ row }) => (
          <span className='font-semibold text-foreground'>
            {row.original.returnedCarat
              ? `${formatCarat(row.original.returnedCarat)} CT`
              : '-'}{' '}
            ({row.original.returnedPieces ?? '-'} pcs)
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'processLossCarat',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Loss (Carat)' />
        ),
        cell: ({ row }) => (
          <span className='font-mono font-semibold text-rose-600 dark:text-rose-400'>
            {row.original.processLossCarat !== null &&
            row.original.processLossCarat !== undefined
              ? `${formatCarat(row.original.processLossCarat)} CT`
              : '-'}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'processLossPercentage',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Loss (%)' />
        ),
        cell: ({ row }) =>
          row.original.processLossPercentage !== null &&
          row.original.processLossPercentage !== undefined ? (
            <Badge variant='outline'>
              {row.original.processLossPercentage}%
            </Badge>
          ) : (
            '-'
          ),
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => <span className='block pe-4 text-right'>Details</span>,
        cell: ({ row }) => (
          <div className='flex items-center justify-end pe-4'>
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
          </div>
        ),
        meta: { className: 'w-24 pe-4' },
        enableSorting: false,
      },
    ],
    []
  )

  const table = useReactTable({
    data: returnedList,
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
            title='4P Returned History'
            toolbar={{
              searchPlaceholder: 'Filter by Kapan No...',
              searchKey: SEMI_POLISH_TABLE_COLUMN.KAPAN_NO,
              searchDebounceMs: 200,
              showFilterCounts: false,
              actions: (
                <div className='flex items-center gap-2'>
                  <Link to='/semi-polish'>
                    <Button
                      variant='outline'
                      size='sm'
                      className='cursor-pointer gap-1.5'
                    >
                      <Clock className='size-3.5' />
                      Active Handover
                    </Button>
                  </Link>
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
            pagination={{ totalRows: returnedList.length }}
            asyncState={listQuery}
            messages={{
              errorTitle: 'Unable to load history.',
              empty: 'No returned 4P records found.',
            }}
          />
        </div>
      </Main>
    </>
  )
}
