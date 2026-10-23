import { useState } from 'react'
import {
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  DataTable,
  type DataTableAsyncState,
} from '@/components/data-table'
import { USER_TABLE_COLUMN, userTypes } from '../data/data'
import { USER_STATUS, type User } from '../data/schema'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { usersColumns as columns } from './users-columns'
import { UsersPrimaryButtons } from './users-primary-buttons'

type DataTableProps = {
  data: User[]
  pageCount: number
  totalRows: number
  pagination?: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  asyncState?: DataTableAsyncState
  search?: Record<string, unknown>
  navigate?: unknown
}

export function UsersTable({
  data,
  pageCount,
  totalRows,
  pagination,
  onPaginationChange,
  columnFilters,
  onColumnFiltersChange,
  sorting,
  onSortingChange,
  asyncState,
}: DataTableProps) {
  const [rowSelection, setRowSelection] = useState({})
  const [internalPagination, setInternalPagination] = useState<PaginationState>(
    { pageIndex: 0, pageSize: 10 }
  )
  const [internalColumnFilters, setInternalColumnFilters] =
    useState<ColumnFiltersState>([])
  const [internalSorting, setInternalSorting] = useState<SortingState>([])

  const currentPagination = pagination ?? internalPagination
  const currentColumnFilters = columnFilters ?? internalColumnFilters
  const currentSorting = sorting ?? internalSorting

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: currentSorting,
      pagination: currentPagination,
      rowSelection,
      columnFilters: currentColumnFilters,
    },
    enableRowSelection: true,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    pageCount,
    getRowId: (row) => row.id,
    onPaginationChange: onPaginationChange ?? setInternalPagination,
    onColumnFiltersChange: onColumnFiltersChange ?? setInternalColumnFilters,
    onRowSelectionChange: setRowSelection,
    onSortingChange: onSortingChange ?? setInternalSorting,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className='flex min-h-0 flex-1 flex-col max-sm:mb-16'>
      <DataTable
        table={table}
        title='User List'
        toolbar={{
          searchPlaceholder: 'Filter users...',
          searchKey: USER_TABLE_COLUMN.USERNAME,
          searchDebounceMs: 400,
          showFilterCounts: false,
          actions: <UsersPrimaryButtons />,
          filters: [
            {
              columnId: USER_TABLE_COLUMN.STATUS,
              title: 'Status',
              options: [
                { label: 'Active', value: USER_STATUS.ACTIVE },
                { label: 'Inactive', value: USER_STATUS.INACTIVE },
              ],
            },
            {
              columnId: USER_TABLE_COLUMN.USER_TYPE,
              title: 'User Type',
              options: userTypes.map((userType) => ({
                ...userType,
                value: String(userType.value),
              })),
            },
          ],
        }}
        pagination={{ totalRows }}
        asyncState={asyncState}
        messages={{ errorTitle: 'Unable to load users.' }}
      />
      <DataTableBulkActions table={table} />
    </div>
  )
}
