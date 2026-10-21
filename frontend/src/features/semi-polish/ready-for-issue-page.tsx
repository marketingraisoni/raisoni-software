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
import {
  Sparkles,
  ArrowRight,
  Clock,
  RefreshCw,
} from 'lucide-react';
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
} from '@/components/data-table';
import { formatCarat } from '@/lib/format-carat';
import { formatDate } from '@/lib/format-date';
import {
  fetchEligibleLots,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service';
import { type EligibleLot } from './data/schema';
import { IssueDialog } from './components/issue-dialog';

export function SemiPolishReadyForIssuePage() {
  const [selectedLotForIssue, setSelectedLotForIssue] = useState<EligibleLot | null>(null);
  const [isIssueOpen, setIsIssueOpen] = useState(false);

  // Table states
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const currentSort = sorting[0];
  const sortParams = useMemo(() => (
    currentSort
      ? {
          sortBy: currentSort.id,
          sortOrder: currentSort.desc ? ('desc' as const) : ('asc' as const),
        }
      : undefined
  ), [currentSort?.id, currentSort?.desc]);

  const {
    data: eligibleLots = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: semiPolishQueryKeys.eligibleLots(sortParams),
    queryFn: () => fetchEligibleLots(sortParams),
  });

  const handleOpenIssue = (lot: EligibleLot) => {
    setSelectedLotForIssue(lot);
    setIsIssueOpen(true);
  };

  const columns = useMemo<ColumnDef<EligibleLot>[]>(() => [
    {
      accessorKey: 'kapanNo',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Lot (Kapan No)' />,
      cell: ({ row }) => (
        <span className='font-bold text-foreground ps-4 block'>
          {row.original.kapanNo}
        </span>
      ),
      meta: { className: 'ps-4' },
      enableSorting: true,
    },
    {
      id: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
      cell: () => (
        <Badge variant='outline' className='border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'>
          Complete
        </Badge>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'entryDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Lot Entry Date' />,
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {formatDate(row.original.entryDate)}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'totalPcs',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Assorted Pieces' />,
      cell: ({ row }) => <span>{row.original.totalPcs} pcs</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'totalCarat',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Total Weight' />,
      cell: ({ row }) => (
        <span className='font-semibold text-primary'>
          {formatCarat(row.original.totalCarat)} CT
        </span>
      ),
      enableSorting: false,
    },
    {
      id: 'actions',
      header: () => <span className='text-right block pe-4'>Action</span>,
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
  ], []);

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
  });

  const hasRows = table.getRowModel().rows.length > 0;
  const hasEmptyOrErrorState = Boolean(isError) || (!isLoading && !hasRows);

  return (
    <>
      <AppHeader fixed />
      <Main fixed fluid className='flex flex-1 flex-col'>
        <div className='flex min-h-0 flex-1 flex-col max-sm:mb-16'>
          <DataTableLayout
            title='Lots Ready for 4P Issue'
            /* description='Assorted lots that have completed 100% packet allocation and are ready for external 4P blocking.' */
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
                        Active in 4P
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
            pagination={<DataTablePagination table={table} className='px-0' totalRows={eligibleLots.length} />}
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
                          <p className='font-medium'>Unable to load eligible lots.</p>
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
                      No lots are currently awaiting 4P issue. All completed lots are either issued or lots are still in assortment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableLayout>
        </div>

        {/* Issue Dialog */}
        <IssueDialog
          lot={selectedLotForIssue}
          open={isIssueOpen}
          onOpenChange={setIsIssueOpen}
        />
      </Main>
    </>
  );
}
