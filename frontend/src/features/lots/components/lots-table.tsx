import {
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableLayout, DataTablePagination, DataTableSkeleton, DataTableToolbar } from '@/components/data-table'
import { lotStatuses } from '../data/data'
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
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
}

export function LotsTable({ data, pageCount, totalRows, pagination, onPaginationChange, columnFilters, onColumnFiltersChange, isLoading = false, error, onRetry }: Props) {
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

  const hasRows = table.getRowModel().rows.length > 0
  const hasEmptyOrErrorState = Boolean(error) || (!isLoading && !hasRows)

  return (
    <div className='flex min-h-0 flex-1 flex-col max-sm:mb-16'>
      <DataTableLayout
        title='Lot List'
        // description='Manage master Kapan entries and rough diamond quantities.'
        toolbar={
          <DataTableToolbar
            table={table}
            searchPlaceholder='Filter by Kapan No...'
            searchKey='kapanNo'
            searchDebounceMs={400}
            showFilterCounts={false}
            filters={[{ columnId: 'status', title: 'Status', options: [...lotStatuses] }]}
            actions={<LotsPrimaryButtons />}
          />
        }
        pagination={<DataTablePagination table={table} className='px-0' totalRows={totalRows} />}
        contentClassName='[&_[data-slot=table-container]]:h-full'
      >
        <Table className={cn(hasEmptyOrErrorState && 'h-full')}>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className={header.column.columnDef.meta?.className}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn(hasEmptyOrErrorState && 'h-full')}>
            {isLoading ? (
              <DataTableSkeleton columnCount={columns.length} rowCount={pagination.pageSize} />
            ) : error ? (
              <TableRow className='h-full'><TableCell colSpan={columns.length} className='h-full text-center'>
                <div className='flex flex-col items-center gap-3'>
                  <div><p className='font-medium'>Unable to load lots.</p><p className='text-sm text-muted-foreground'>Check the backend connection and try again.</p></div>
                  {onRetry && <Button variant='outline' onClick={onRetry}><RefreshCw /> Try again</Button>}
                </div>
              </TableCell></TableRow>
            ) : hasRows ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className='h-full'><TableCell colSpan={columns.length} className='h-full text-center'>No lots found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableLayout>
    </div>
  )
}
