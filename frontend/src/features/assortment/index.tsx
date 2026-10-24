import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { getLots, lotsQueryKey } from '@/services/lots-service'
import { ArrowRight, Layers3 } from 'lucide-react'
import { formatCarat } from '@/lib/format-carat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  DataTableColumnHeader,
  getArrayFilterValue,
  getStringFilterValue,
} from '@/components/data-table'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { LOT_TABLE_COLUMN, lotStatuses } from '@/features/lots/data/data'
import {
  LOT_STATUS,
  type Lot,
  type LotStatus,
} from '@/features/lots/data/schema'
import { AssortmentExcelButton } from './components/assortment-excel-button'

type Props = {
  onAssort: (lotId: string) => void
}

export function AssortmentLots({ onAssort }: Props) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const searchKapanNo = useMemo(() => {
    return getStringFilterValue(columnFilters, LOT_TABLE_COLUMN.KAPAN_NO)
  }, [columnFilters])

  const statusFilter = useMemo(() => {
    return getArrayFilterValue<LotStatus>(
      columnFilters,
      LOT_TABLE_COLUMN.STATUS
    )
  }, [columnFilters])

  const queryParams = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search: searchKapanNo,
    status: statusFilter,
  }

  const lotsQuery = useQuery({
    queryKey: [...lotsQueryKey, { ...queryParams, assortmentList: true }],
    queryFn: ({ signal }) => getLots(queryParams, signal),
    placeholderData: keepPreviousData,
  })

  const handleColumnFiltersChange = (
    updater:
      | ColumnFiltersState
      | ((prev: ColumnFiltersState) => ColumnFiltersState)
  ) => {
    setColumnFilters(updater)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const rawTotalPages = lotsQuery.data?.pagination.totalPages ?? 1
  const pageCount = Math.max(rawTotalPages, pagination.pageIndex + 1)
  const totalRows = lotsQuery.data?.pagination.total ?? 0

  const columns = useMemo<ColumnDef<Lot>[]>(
    () => [
      {
        accessorKey: 'kapanNo',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Kapan No' />
        ),
        cell: ({ row }) => (
          <span className='font-semibold'>{row.original.kapanNo}</span>
        ),
        meta: { className: 'ps-4' },
        enableSorting: false,
      },
      {
        accessorKey: 'totalPcs',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Total Pkt' />
        ),
        cell: ({ row }) => (
          <span>{row.original.totalPcs.toLocaleString()} Pkt</span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'totalCarat',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Total Carat' />
        ),
        cell: ({ row }) => (
          <span>{formatCarat(row.original.totalCarat)} CT</span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === LOT_STATUS.ACTIVE
                ? 'default'
                : 'secondary'
            }
            className='capitalize'
          >
            {row.original.status}
          </Badge>
        ),
        enableSorting: false,
      },
      {
        id: 'actions',
        header: () => <span className='block pe-4 text-end'>Action</span>,
        cell: ({ row }) => {
          const lot = row.original
          const isActive = lot.status === LOT_STATUS.ACTIVE
          return (
            <div className='flex items-center justify-end gap-2 pe-4'>
              {lot.assortmentComplete && (
                <AssortmentExcelButton
                  lotId={lot.id}
                  kapanNo={lot.kapanNo}
                  compact
                />
              )}
              <Button
                size='sm'
                variant={isActive ? 'default' : 'outline'}
                onClick={() => onAssort(lot.id)}
              >
                <Layers3 />
                {isActive ? 'Assort' : 'View'} <ArrowRight />
              </Button>
            </div>
          )
        },
        meta: { className: 'w-64 pe-4' },
        enableSorting: false,
      },
    ],
    [onAssort]
  )

  const table = useReactTable({
    data: lotsQuery.data?.lots ?? [],
    columns,
    state: {
      pagination,
      columnFilters,
    },
    manualFiltering: true,
    manualPagination: true,
    pageCount,
    getRowId: (row) => row.id,
    onPaginationChange: setPagination,
    onColumnFiltersChange: handleColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <AppHeader fixed />
      <Main fixed fluid className='flex flex-1 flex-col'>
        <div className='flex min-h-0 flex-1 flex-col max-sm:mb-16'>
          <DataTable
            table={table}
            title='Packet Creation'
            toolbar={{
              searchPlaceholder: 'Filter by Kapan No...',
              searchKey: LOT_TABLE_COLUMN.KAPAN_NO,
              searchDebounceMs: 400,
              showFilterCounts: false,
              filters: [
                {
                  columnId: LOT_TABLE_COLUMN.STATUS,
                  title: 'Status',
                  options: [...lotStatuses],
                },
              ],
            }}
            pagination={{ totalRows }}
            asyncState={lotsQuery}
            messages={{
              errorTitle: 'Unable to load lots.',
              empty: 'No lots found.',
            }}
          />
        </div>
      </Main>
    </>
  )
}
