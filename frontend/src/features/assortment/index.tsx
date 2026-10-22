import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowRight, Layers3, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCarat } from '@/lib/format-carat'
import { getLots, lotsQueryKey } from '@/services/lots-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import {
  DataTableColumnHeader,
  DataTableLayout,
  DataTablePagination,
  DataTableSkeleton,
  DataTableToolbar,
} from '@/components/data-table'
import { lotStatuses } from '@/features/lots/data/data'
import { type Lot, type LotStatus } from '@/features/lots/data/schema'
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
    const filter = columnFilters.find((f) => f.id === 'kapanNo')
    return typeof filter?.value === 'string' && filter.value.trim()
      ? filter.value.trim()
      : undefined
  }, [columnFilters])

  const statusFilter = useMemo(() => {
    const filter = columnFilters.find((f) => f.id === 'status')
    return Array.isArray(filter?.value) && filter.value.length
      ? (filter.value as LotStatus[])
      : undefined
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
    updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)
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
          <DataTableColumnHeader column={column} title='Total Pieces' />
        ),
        cell: ({ row }) => (
          <span>{row.original.totalPcs.toLocaleString()} PCs</span>
        ),
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
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === 'active' ? 'default' : 'secondary'}
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
                variant={lot.status === 'active' ? 'default' : 'outline'}
                onClick={() => onAssort(lot.id)}
              >
                <Layers3 /> {lot.status === 'active' ? 'Assort' : 'View'}{' '}
                <ArrowRight />
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

  const hasRows = table.getRowModel().rows.length > 0
  const hasEmptyOrErrorState =
    Boolean(lotsQuery.isError) || (!lotsQuery.isLoading && !hasRows)

  return (
    <>
      <AppHeader fixed />
      <Main fixed fluid className='flex flex-1 flex-col'>
        <div className='flex min-h-0 flex-1 flex-col max-sm:mb-16'>
          <DataTableLayout
            title='Packet Creation'
            // description='Choose a Lot to begin or continue its assortment workflow.'
            toolbar={
              <DataTableToolbar
                table={table}
                searchPlaceholder='Filter by Kapan No...'
                searchKey='kapanNo'
                searchDebounceMs={400}
                showFilterCounts={false}
                filters={[
                  {
                    columnId: 'status',
                    title: 'Status',
                    options: [...lotStatuses],
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
                    {headerGroup.headers.map((header) => (
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
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className={cn(hasEmptyOrErrorState && 'h-full')}>
                {lotsQuery.isLoading ? (
                  <DataTableSkeleton
                    columnCount={columns.length}
                    rowCount={pagination.pageSize || 10}
                  />
                ) : lotsQuery.isError ? (
                  <TableRow className='h-full'>
                    <TableCell
                      colSpan={columns.length}
                      className='h-full text-center'
                    >
                      <div className='flex flex-col items-center gap-3'>
                        <div>
                          <p className='font-medium'>Unable to load lots.</p>
                          <p className='text-sm text-muted-foreground'>
                            Check the backend connection and try again.
                          </p>
                        </div>
                        <Button
                          variant='outline'
                          onClick={() => void lotsQuery.refetch()}
                        >
                          <RefreshCw /> Try again
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : hasRows ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className='group/row'>
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
                      No lots found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableLayout>
        </div>
      </Main>
    </>
  )
}
