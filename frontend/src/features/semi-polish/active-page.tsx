import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/services/auth-service';
import {
  ArrowDownToLine,
  Eye,
  XCircle,
  RefreshCw,
  Building2,
  Plus,
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
  DataTableActionButton,
} from '@/components/data-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCarat } from '@/lib/format-carat';
import { formatDate } from '@/lib/format-date';
import {
  fetchSemiPolishList,
  cancelSemiPolish,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service';
import { type SemiPolishProcess } from './data/schema';

export function SemiPolishActivePage() {
  const queryClient = useQueryClient();

  const [processToCancel, setProcessToCancel] = useState<SemiPolishProcess | null>(null);

  // Table states
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const currentSort = sorting[0];
  const queryParams = useMemo(() => ({
    page: 1,
    limit: 100,
    status: 'in_process',
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

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelSemiPolish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: semiPolishQueryKeys.all });
      toast.success('4P issue has been cancelled');
      setProcessToCancel(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const processes = listData?.processes || [];
  const inProcessList = useMemo(() => {
    return processes.filter((p) => p.status === 'in_process');
  }, [processes]);

  const handleConfirmCancel = () => {
    if (!processToCancel) return;
    const id = (processToCancel._id || processToCancel.id) as string;
    cancelMutation.mutate(id);
  };

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
      accessorKey: 'expectedReturnDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Exp. Return' />,
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {row.original.expectedReturnDate ? formatDate(row.original.expectedReturnDate) : '-'}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'issuedPieces',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Return Progress' />,
      cell: ({ row }) => (
        <div>
          <span className='font-semibold'>
            {row.original.returnedPacketCount ?? 0} / {row.original.issuedPieces} packets
          </span>
          <p className='text-xs text-muted-foreground'>
            {row.original.activePlanningImport ? 'Planning imported' : 'Planning pending'}
          </p>
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'issuedCarat',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Issued Carat' />,
      cell: ({ row }) => (
        <span className='font-semibold text-primary'>
          {formatCarat(row.original.issuedCarat)} CT
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
      cell: () => (
        <Badge variant='outline' className='border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'>
          In 4P Process
        </Badge>
      ),
      meta: { className: 'text-center' },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: () => <span className='text-right block pe-4'>Actions</span>,
      cell: ({ row }) => (
        <div className='flex items-center justify-end gap-1.5 pe-4'>
          <DataTableActionButton tooltip='Receive / verify packets' asChild>
            <Link
              to='/semi-polish/planning-returns/$processId'
              params={{ processId: (row.original._id || row.original.id) as string }}
              aria-label='Receive or verify packets'
            >
              <ArrowDownToLine className='size-4' />
            </Link>
          </DataTableActionButton>
          <DataTableActionButton tooltip='View Details' asChild>
            <Link
              to='/semi-polish/$processId'
              params={{ processId: (row.original._id || row.original.id) as string }}
              aria-label='View process details'
            >
              <Eye className='size-4' />
            </Link>
          </DataTableActionButton>
          <DataTableActionButton
            tooltip='Cancel Issue'
            onClick={() => setProcessToCancel(row.original)}
            aria-label='Cancel issue'
          >
            <XCircle className='size-4' />
          </DataTableActionButton>
        </div>
      ),
      meta: { className: 'w-36 pe-4' },
      enableSorting: false,
    },
  ], []);

  const table = useReactTable({
    data: inProcessList,
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
            title='Active 4P Handover'
            /* description='Lots currently at external 4P vendors undergoing table, crown, pavilion & girdle blocking.' */
            toolbar={
              <DataTableToolbar
                table={table}
                searchPlaceholder='Filter by Kapan No...'
                searchKey='kapanNo'
                searchDebounceMs={200}
                showFilterCounts={false}
                actions={
                  <div className='flex items-center gap-2'>
                    <Link to='/semi-polish/ready-for-issue'>
                      <Button size='sm' className='cursor-pointer gap-1.5 font-semibold'>
                        Issue New Lot
                        <Plus className='size-3.5' />
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
            pagination={<DataTablePagination table={table} className='px-0' totalRows={inProcessList.length} />}
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
                          <p className='font-medium'>Unable to load active 4P handovers.</p>
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
                      No active 4P issues found.{' '}
                      <Link to='/semi-polish/ready-for-issue' className='text-primary font-medium hover:underline'>
                        Issue a lot ready from assortment &rarr;
                      </Link>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableLayout>
        </div>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog
          open={!!processToCancel}
          onOpenChange={(isOpen) => !isOpen && setProcessToCancel(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel 4P Issue?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel Issue{' '}
                <span className='font-mono font-bold text-foreground'>
                  {processToCancel?.issueNo}
                </span>{' '}
                for Lot{' '}
                <span className='font-bold text-foreground'>{processToCancel?.kapanNo}</span>?
                This will release the lot back to the assortment stage.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className='cursor-pointer'>Keep Issue</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmCancel}
                className='bg-destructive hover:bg-destructive/90 text-white cursor-pointer'
              >
                Cancel Issue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Main>
    </>
  );
}
