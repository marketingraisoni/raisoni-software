import {
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  DataTable,
  type DataTableAsyncState,
} from '@/components/data-table'
import { LOT_TABLE_COLUMN, lotStatuses } from '../data/data'
import { type Lot } from '../data/schema'
import { lotsColumns as columns } from './lots-columns'
import { LotsPrimaryButtons } from './lots-primary-buttons'

type Props = {
  data: Lot[]
  pageCount: number
  totalRows: number
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  columnFilters: ColumnFiltersState
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  asyncState?: DataTableAsyncState
}

export function LotsTable({
  data,
  pageCount,
  totalRows,
  pagination,
  onPaginationChange,
  columnFilters,
  onColumnFiltersChange,
  asyncState,
}: Props) {
  const table = useReactTable({
    data,
    columns,
    state: { pagination, columnFilters },
    manualFiltering: true,
    manualPagination: true,
    pageCount,
    getRowId: (row) => row.id,
    onPaginationChange,
    onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className='flex min-h-0 flex-1 flex-col max-sm:mb-16'>
      <DataTable
        table={table}
        title='Lot List'
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
          actions: <LotsPrimaryButtons />,
        }}
        pagination={{ totalRows }}
        asyncState={asyncState}
        messages={{
          errorTitle: 'Unable to load lots.',
          empty: 'No lots found.',
        }}
      />
    </div>
  )
}
