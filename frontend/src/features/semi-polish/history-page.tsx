import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Building2, Clock, Eye, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppHeader } from '@/components/layout/app-header';
import { Main } from '@/components/layout/main';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DataTableLayout,
  DataTablePagination,
  DataTableSkeleton,
  DataTableToolbar,
  DataTableColumnHeader,
  DataTableActionButton,
} from '@/components/data-table';
import { formatCarat } from '@/lib/format-carat';
import { formatDate } from '@/lib/format-date';
import {
  fetchSemiPolishList,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service';
import { type SemiPolishProcess } from './data/schema';

export function SemiPolishHistoryPage() {
  // Table states
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const currentSort = sorting[0];
  const queryParams = useMemo(() => ({
    page: 1,
    limit: 200,
    status: 'returned',
    sortBy: currentSort?.id,
    sortOrder: currentSort ? (currentSort.desc ? ('desc' as const) : ('asc' as const)) : undefined,
  }), [currentSort?.id, currentSort?.desc]);

  const {
    data: listData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: semiPolishQueryKeys.list(queryParams),
    queryFn: () => fetchSemiPolishList(queryParams),
  });

  const processes = listData?.processes || [];
  const returnedList = useMemo(() => {
    return processes.filter((p) => p.status === 'returned');
  }, [processes]);

  const columns = useMemo<ColumnDef<SemiPolishProcess>[]>(() => [
    {
      accessorKey: 'issueNo',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Issue / Jangad No' />,
      cell: ({ row }) => (
        <span className='font-mono font-medium text-primary ps-4 block'>
          {row.original.issueNo}
        </span>
      ),
      meta: { className: 'ps-4' },
      enableSorting: false,
    },
    {
      accessorKey: 'kapanNo',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Lot (Kapan No)' />,
      cell: ({ row }) => <span className='font-semibold'>{row.original.kapanNo}</span>,
      enableSorting: true,
    },
    {
      accessorKey: 'vendorName',
      header: ({ column }) => <DataTableColumnHeader column={column} title='4P Vendor' />,
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
      header: ({ column }) => <DataTableColumnHeader column={column} title='Issue Date' />,
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {formatDate(row.original.issueDate)}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'returnDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Return Date' />,
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {row.original.returnDate ? formatDate(row.original.returnDate) : '-'}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'issuedCarat',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Issued Wt' />,
      cell: ({ row }) => (
        <span>
          {formatCarat(row.original.issuedCarat)} CT ({row.original.issuedPieces} pcs)
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'returnedCarat',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Returned Wt' />,
      cell: ({ row }) => (
        <span className='font-semibold text-foreground'>
          {row.original.returnedCarat ? `${formatCarat(row.original.returnedCarat)} CT` : '-'} (
          {row.original.returnedPieces ?? '-'} pcs)
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'processLossCarat',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Loss (Carat)' />,
      cell: ({ row }) => (
        <span className='font-mono font-semibold text-rose-600 dark:text-rose-400'>
          {row.original.processLossCarat !== null && row.original.processLossCarat !== undefined
            ? `${formatCarat(row.original.processLossCarat)} CT`
            : '-'}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'processLossPercentage',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Loss (%)' />,
      cell: ({ row }) => (
        row.original.processLossPercentage !== null && row.original.processLossPercentage !== undefined ? (
          <Badge variant='outline'>
            {row.original.processLossPercentage}%
          </Badge>
        ) : (
          '-'
        )
      ),
      enableSorting: true,
    },
    {
      id: 'actions',
      header: () => <span className='text-right block pe-4'>Details</span>,
      cell: ({ row }) => (
        <div className='flex items-center justify-end pe-4'>
          <DataTableActionButton tooltip='View Details' asChild>
            <Link
              to='/semi-polish/$processId'
              params={{ processId: (row.original._id || row.original.id) as string }}
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
  ], []);

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
  });

  const hasRows = table.getRowModel().rows.length > 0;
  const hasEmptyOrErrorState = Boolean(isError) || (!isLoading && !hasRows);

  return (
    <>
      <AppHeader fixed />
      <Main fixed fluid className='flex flex-1 flex-col'>
        <div className='flex min-h-0 flex-1 flex-col max-sm:mb-16'>
          <DataTableLayout
            title='4P Returned History'
            /* description='Completed 4P batches, returned diamond weights, and process loss audit trails.' */
            toolbar={
              <DataTableToolbar
                table={table}
                searchPlaceholder='Filter by Kapan No...'
                searchKey='kapanNo'
                searchDebounceMs={200}
                showFilterCounts={false}
                actions={
                  <div className='flex items-center gap-2'>
                    <Link to='/semi-polish'>
                      <Button variant='outline' size='sm' className='cursor-pointer gap-1.5'>
                        <Clock className='size-3.5' />
                        Active Handover
                      </Button>
                    </Link>
                    <Button
                      variant='outline'
                      size='sm'
                      className='cursor-pointer gap-1.5'
                      onClick={() => refetch()}
                    >
                      <RefreshCw className='size-3.5' />
                      Refresh
                    </Button>
                  </div>
                }
              />
            }
            pagination={<DataTablePagination table={table} className='px-0' totalRows={returnedList.length} />}
            contentClassName='[&_[data-slot=table-container]]:h-full'
          >
            <Table className={cn(hasEmptyOrErrorState && 'h-full')}>
              <TableHeader className='sticky top-0 z-10 bg-background'>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        className={header.column.columnDef.meta?.className}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className={cn(hasEmptyOrErrorState && 'h-full')}>
                {isLoading ? (
                  <DataTableSkeleton columnCount={columns.length} rowCount={pagination.pageSize} />
                ) : isError ? (
                  <TableRow className='h-full'>
                    <TableCell colSpan={columns.length} className='h-full text-center'>
                      <div className='flex flex-col items-center gap-3'>
                        <div>
                          <p className='font-medium'>Unable to load history.</p>
                          <p className='text-sm text-muted-foreground'>Check backend connection and try again.</p>
                        </div>
                        <Button variant='outline' onClick={() => refetch()}>
                          <RefreshCw className='me-2 size-4' /> Try again
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
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
                  <TableRow className='h-full'>
                    <TableCell colSpan={columns.length} className='h-full text-center text-muted-foreground'>
                      No returned 4P records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableLayout>
        </div>

      </Main>
    </>
  );
}
