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
  fetchEligibleLots,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import { Sparkles, ArrowRight, Clock, RefreshCw } from 'lucide-react'
import { formatCarat } from '@/lib/format-carat'
import { formatDate } from '@/lib/format-date'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  DataTableColumnHeader,
  getSortQuery,
} from '@/components/data-table'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { IssueDialog } from './components/issue-dialog'
import { type EligibleLot } from './data/schema'
import { SEMI_POLISH_TABLE_COLUMN } from './data/table'

export function SemiPolishReadyForIssuePage() {
  const [selectedLotForIssue, setSelectedLotForIssue] =
    useState<EligibleLot | null>(null)
  const [isIssueOpen, setIsIssueOpen] = useState(false)

  // Table states
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

  const sortParams = useMemo(() => getSortQuery(sorting), [sorting])

  const eligibleLotsQuery = useQuery({
    queryKey: semiPolishQueryKeys.eligibleLots(sortParams),
    queryFn: () => fetchEligibleLots(sortParams),
  })
  const eligibleLots = eligibleLotsQuery.data ?? []

  const handleOpenIssue = (lot: EligibleLot) => {
    setSelectedLotForIssue(lot)
    setIsIssueOpen(true)
  }

  const columns = useMemo<ColumnDef<EligibleLot>[]>(
    () => [
      {
        accessorKey: 'kapanNo',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Lot (Kapan No)' />
        ),
        cell: ({ row }) => (
          <span className='block ps-4 font-bold text-foreground'>
            {row.original.kapanNo}
          </span>
        ),
        meta: { className: 'ps-4' },
        enableSorting: true,
      },
      {
        id: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: () => (
          <Badge
            variant='outline'
            className='border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400'
          >
            Complete
          </Badge>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'entryDate',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Lot Entry Date' />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {formatDate(row.original.entryDate)}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'totalPcs',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Assorted Pieces' />
        ),
        cell: ({ row }) => <span>{row.original.totalPcs} pcs</span>,
        enableSorting: false,
      },
      {
        accessorKey: 'totalCarat',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Total Weight' />
        ),
        cell: ({ row }) => (
          <span className='font-semibold text-primary'>
            {formatCarat(row.original.totalCarat)} CT
          </span>
        ),
        enableSorting: false,
      },
      {
        id: 'actions',
        header: () => <span className='block pe-4 text-right'>Action</span>,
        cell: ({ row }) => (
          <div className='flex items-center justify-end pe-4'>
            <Button
              size='sm'
              onClick={() => handleOpenIssue(row.original)}
              className='cursor-pointer gap-1.5 font-semibold'
            >
              <Sparkles className='size-3.5' />
              Issue to 4P
              <ArrowRight className='size-3.5' />
            </Button>
          </div>
        ),
        meta: { className: 'w-36 pe-4' },
        enableSorting: false,
      },
    ],
    []
  )

  const table = useReactTable({
    data: eligibleLots,
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
            title='Lots Ready for 4P Issue'
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
                      Active in 4P
                    </Button>
                  </Link>
                  <Button
                    variant='outline'
                    size='sm'
                    className='cursor-pointer gap-1.5'
                    onClick={() => void eligibleLotsQuery.refetch()}
                  >
                    <RefreshCw className='size-3.5' />
                    Refresh
                  </Button>
                </div>
              ),
            }}
            pagination={{ totalRows: eligibleLots.length }}
            asyncState={eligibleLotsQuery}
            messages={{
              errorTitle: 'Unable to load eligible lots.',
              empty:
                'No lots are currently awaiting 4P issue. All completed lots are either issued or lots are still in assortment.',
            }}
          />
        </div>

        {/* Issue Dialog */}
        <IssueDialog
          lot={selectedLotForIssue}
          open={isIssueOpen}
          onOpenChange={setIsIssueOpen}
        />
      </Main>
    </>
  )
}
