import { useState } from 'react'
import {
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTableLayout,
  DataTablePagination,
  DataTableSkeleton,
  DataTableToolbar,
} from '@/components/data-table'
import { userTypes } from '../data/data'
import { type User } from '../data/schema'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { UsersPrimaryButtons } from './users-primary-buttons'
import { usersColumns as columns } from './users-columns'

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
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
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
  isLoading = false,
  error,
  onRetry,
}: DataTableProps) {
  // Local UI-only states
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  // Fallback internal states when used without external controller
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([])
  const [internalSorting, setInternalSorting] = useState<SortingState>([])

  const currentPagination = pagination ?? internalPagination
  const currentColumnFilters = columnFilters ?? internalColumnFilters
  const currentSorting = sorting ?? internalSorting

  const handlePaginationChange = onPaginationChange ?? setInternalPagination
  const handleColumnFiltersChange = onColumnFiltersChange ?? setInternalColumnFilters
  const handleSortingChange = onSortingChange ?? setInternalSorting

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: currentSorting,
      pagination: currentPagination,
      rowSelection,
      columnFilters: currentColumnFilters,
      columnVisibility,
    },
    enableRowSelection: true,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    pageCount,
    getRowId: (row) => row.id,
    onPaginationChange: handlePaginationChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  })

  const hasRows = table.getRowModel().rows.length > 0
  const hasEmptyOrErrorState = Boolean(error) || (!isLoading && !hasRows)

  return (
    <div className='flex min-h-0 flex-1 flex-col max-sm:mb-16'>
      <DataTableLayout
        title='User List'
        description='Manage user accounts, access roles, and account status.'
        actions={<UsersPrimaryButtons />}
        toolbar={
          <DataTableToolbar
            table={table}
            searchPlaceholder='Filter users...'
            searchKey='username'
            searchDebounceMs={400}
            showFilterCounts={false}
            filters={[
              {
                columnId: 'status',
                title: 'Status',
                options: [
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' },
                ],
              },
              {
                columnId: 'userType',
                title: 'User Type',
                options: userTypes.map((userType) => ({
                  ...userType,
                  value: String(userType.value),
                })),
              },
            ]}
          />
        }
        pagination={
          <DataTablePagination
            table={table}
            className='px-0'
            totalRows={totalRows}
          />
        }
        contentClassName='[&_[data-slot=table-container]]:h-full'
      >
        <Table className={cn(hasEmptyOrErrorState && 'h-full')}>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        header.column.columnDef.meta?.className,
                        header.column.columnDef.meta?.thClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn(hasEmptyOrErrorState && 'h-full')}>
            {isLoading ? (
              <DataTableSkeleton
                columnCount={table.getVisibleLeafColumns().length || columns.length}
                rowCount={currentPagination.pageSize || 10}
              />
            ) : error ? (
              <TableRow className='h-full'>
                <TableCell colSpan={columns.length} className='h-full text-center'>
                  <div className='flex flex-col items-center gap-3'>
                    <div>
                      <p className='font-medium'>Unable to load users.</p>
                      <p className='text-sm text-muted-foreground'>
                        Check the backend connection and try again.
                      </p>
                    </div>
                    {onRetry ? (
                      <Button variant='outline' onClick={onRetry}>
                        <RefreshCw /> Try again
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : hasRows ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='group/row'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className='h-full'>
                <TableCell
                  colSpan={columns.length}
                  className='h-full text-center'
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableLayout>
      <DataTableBulkActions table={table} />
    </div>
  )
}
