import type { ReactNode } from 'react'
import {
  flexRender,
  type Row,
  type Table as TanStackTable,
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
import { DataTableLayout } from './layout'
import {
  DataTablePagination,
  type DataTablePaginationProps,
} from './pagination'
import { DataTableSkeleton } from './skeleton'
import { DataTableToolbar, type DataTableToolbarProps } from './toolbar'

type DataTableProps<TData> = {
  table: TanStackTable<TData>
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  toolbar?: Omit<DataTableToolbarProps<TData>, 'table'>
  pagination?: false | Omit<DataTablePaginationProps<TData>, 'table'>
  asyncState?: DataTableAsyncState
  messages?: DataTableMessages
  skeletonRowCount?: number
  className?: string
  contentClassName?: string
  tableClassName?: string
  headerClassName?: string
  headerRowClassName?: string
  rowClassName?: string | ((row: Row<TData>) => string | undefined)
  headClassName?: string
  cellClassName?: string
}

export type DataTableAsyncState = {
  isLoading?: boolean
  isPending?: boolean
  isError?: boolean
  error?: unknown
  refetch?: () => unknown
}

type DataTableMessages = {
  errorTitle?: ReactNode
  errorDescription?: ReactNode
  empty?: ReactNode
  retry?: ReactNode
}

export function DataTable<TData>({
  table,
  title,
  description,
  actions,
  toolbar,
  pagination = {},
  asyncState,
  messages,
  skeletonRowCount,
  className,
  contentClassName = '[&_[data-slot=table-container]]:h-full',
  tableClassName,
  headerClassName = 'sticky top-0 z-10 bg-background',
  headerRowClassName,
  rowClassName,
  headClassName,
  cellClassName,
}: DataTableProps<TData>) {
  const isLoading = asyncState?.isLoading ?? asyncState?.isPending ?? false
  const error = asyncState?.error ?? (asyncState?.isError ? true : undefined)
  const errorTitle = messages?.errorTitle ?? 'Unable to load data.'
  const errorDescription =
    messages?.errorDescription ?? 'Check the backend connection and try again.'
  const emptyContent = messages?.empty ?? 'No data found.'
  const retryLabel = messages?.retry ?? 'Try again'
  const rows = table.getRowModel().rows
  const hasRows = rows.length > 0
  const hasEmptyOrErrorState = Boolean(error) || (!isLoading && !hasRows)
  const columnCount = table.getVisibleLeafColumns().length || 1
  const loadingRowCount =
    skeletonRowCount ?? table.getState().pagination?.pageSize ?? 10

  return (
    <DataTableLayout
      title={title}
      description={description}
      actions={actions}
      toolbar={
        toolbar ? <DataTableToolbar table={table} {...toolbar} /> : undefined
      }
      pagination={
        pagination !== false ? (
          <DataTablePagination table={table} className='px-0' {...pagination} />
        ) : undefined
      }
      className={className}
      contentClassName={contentClassName}
    >
      <Table className={cn(hasEmptyOrErrorState && 'h-full', tableClassName)}>
        <TableHeader className={headerClassName}>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className={cn('group/row', headerRowClassName)}
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={cn(
                    'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                    header.column.columnDef.meta?.className,
                    header.column.columnDef.meta?.thClassName,
                    headClassName
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody className={cn(hasEmptyOrErrorState && 'h-full')}>
          {isLoading ? (
            <DataTableSkeleton
              columnCount={columnCount}
              rowCount={loadingRowCount}
            />
          ) : error ? (
            <TableRow className='h-full'>
              <TableCell colSpan={columnCount} className='h-full text-center'>
                <div className='flex flex-col items-center gap-3'>
                  <div>
                    <p className='font-medium'>{errorTitle}</p>
                    {errorDescription ? (
                      <p className='text-sm text-muted-foreground'>
                        {errorDescription}
                      </p>
                    ) : null}
                  </div>
                  {asyncState?.refetch ? (
                    <Button
                      variant='outline'
                      onClick={() => void asyncState.refetch?.()}
                    >
                      <RefreshCw /> {retryLabel}
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ) : hasRows ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                className={cn(
                  'group/row',
                  typeof rowClassName === 'function'
                    ? rowClassName(row)
                    : rowClassName
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                      cell.column.columnDef.meta?.className,
                      cell.column.columnDef.meta?.tdClassName,
                      cellClassName
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className='h-full'>
              <TableCell
                colSpan={columnCount}
                className='h-full text-center text-muted-foreground'
              >
                {emptyContent}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </DataTableLayout>
  )
}
