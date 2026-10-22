import { Fragment, useMemo, useRef, useState, type DragEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  PackageCheck,
  Search,
  UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/services/auth-service'
import {
  confirmSemiPolishPlanning,
  downloadPlanningWorkbook,
  fetchSemiPolishPlanning,
  finalizeSemiPolishReturn,
  importSemiPolishPlanning,
  receiveSemiPolishPacket,
  resolveSemiPolishPacketIssue,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import { formatCarat } from '@/lib/format-carat'
import { cn } from '@/lib/utils'
import {
  DataTableColumnHeader,
  DataTableToolbar,
} from '@/components/data-table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type PlanningDifference,
  type SemiPolishPacketPlan,
  type SemiPolishPacketReturn,
  type SemiPolishPlanningImport,
  type SemiPolishProcess,
} from '../data/schema'

type Props = {
  process: SemiPolishProcess
  processId: string
  onFinalized: () => void
}

type PendingConfirmation = {
  planningImport: SemiPolishPlanningImport
  differences: PlanningDifference[]
}

type ReceivePacketInput = {
  plan: SemiPolishPacketPlan
  hasDifference: boolean
  issueType?: string
  issueDetails?: string
  observedPieceCount: number
  notes?: string
}

function getId(value: { id?: string; _id?: string }) {
  return value.id || value._id || ''
}

function getUserName(value: unknown) {
  if (!value || typeof value !== 'object') return 'Unknown user'
  const record = value as Record<string, unknown>
  return String(record.name || record.username || 'Unknown user')
}

function formatTimestamp(value: Date | string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-muted/20 px-3 py-2.5',
        tone === 'good' && 'border-emerald-500/30 bg-emerald-500/5',
        tone === 'warn' && 'border-amber-500/30 bg-amber-500/5'
      )}
    >
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='mt-0.5 text-base font-bold'>{value}</p>
    </div>
  )
}

export function PlanningReturnWorkspace({ process, processId, onFinalized }: Props) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [dismissedPendingImportId, setDismissedPendingImportId] = useState('')
  const [confirmationReason, setConfirmationReason] = useState('')
  const [packetInput, setPacketInput] = useState('')
  const [focusedPacketNumber, setFocusedPacketNumber] = useState<number | null>(null)
  const [packetExpansion, setPacketExpansion] = useState<Record<number, boolean>>({})
  const [differencePacketNumber, setDifferencePacketNumber] = useState<number | null>(null)
  const [resolutionPacketNumber, setResolutionPacketNumber] = useState<number | null>(null)
  const [issueType, setIssueType] = useState('Piece count mismatch')
  const [issueDetails, setIssueDetails] = useState('')
  const [observedPieceCount, setObservedPieceCount] = useState(0)
  const [returnNotes, setReturnNotes] = useState('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [finalizeNotes, setFinalizeNotes] = useState('')
  const [planningDetailsOpen, setPlanningDetailsOpen] = useState(false)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

  const planningQuery = useQuery({
    queryKey: semiPolishQueryKeys.planning(processId),
    queryFn: () => fetchSemiPolishPlanning(processId),
  })

  const refreshPlanning = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: semiPolishQueryKeys.planning(processId) }),
      queryClient.invalidateQueries({ queryKey: semiPolishQueryKeys.detail(processId) }),
      queryClient.invalidateQueries({ queryKey: semiPolishQueryKeys.all }),
    ])
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => importSemiPolishPlanning(processId, file),
    onSuccess: async (result) => {
      if (result.requiresConfirmation) {
        setPendingConfirmation({
          planningImport: result.planningImport,
          differences: result.differences,
        })
        return
      }
      toast.success('Planning file imported successfully.')
      await refreshPlanning()
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const confirmMutation = useMutation({
    mutationFn: (confirmation: PendingConfirmation) => {
      return confirmSemiPolishPlanning(
        processId,
        getId(confirmation.planningImport),
        confirmationReason
      )
    },
    onSuccess: async () => {
      toast.success('Planning differences confirmed and import activated.')
      setPendingConfirmation(null)
      setConfirmationReason('')
      await refreshPlanning()
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const receiveMutation = useMutation({
    mutationFn: (input: ReceivePacketInput) =>
      receiveSemiPolishPacket(processId, input.plan.packetNumber, {
        hasDifference: input.hasDifference,
        issueType: input.issueType,
        issueDetails: input.issueDetails,
        observedPieceCount: input.observedPieceCount,
        notes: input.notes,
        source: 'manual',
      }),
    onSuccess: async (_, input) => {
      toast.success(
        input.hasDifference
          ? `Packet ${input.plan.packetNumber} recorded with an issue.`
          : `Packet ${input.plan.packetNumber} and ${input.plan.plannedPieceCount} pieces verified.`
      )
      setPacketExpansion((current) => ({
        ...current,
        [input.plan.packetNumber]: input.hasDifference,
      }))
      resetInlineForms()
      setPacketInput('')
      await refreshPlanning()
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ plan, returned }: { plan: SemiPolishPacketPlan; returned: SemiPolishPacketReturn }) =>
      resolveSemiPolishPacketIssue(processId, plan.packetNumber, {
        resolutionNote,
        verifiedPieceCount: returned.issue?.observedPieceCount ?? plan.plannedPieceCount,
      }),
    onSuccess: async (_, { plan }) => {
      toast.success(`Packet ${plan.packetNumber} issue resolved.`)
      setPacketExpansion((current) => ({ ...current, [plan.packetNumber]: false }))
      resetInlineForms()
      await refreshPlanning()
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeSemiPolishReturn(processId, finalizeNotes),
    onSuccess: async () => {
      toast.success('4P return finalized successfully.')
      setFinalizeOpen(false)
      await refreshPlanning()
      onFinalized()
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const data = planningQuery.data
  const visiblePendingConfirmation = pendingConfirmation ?? (
    data?.pendingPlanningImport && getId(data.pendingPlanningImport) !== dismissedPendingImportId
      ? {
          planningImport: data.pendingPlanningImport,
          differences: data.pendingPlanningImport.differences,
        }
      : null
  )
  const returnedByPacket = useMemo(
    () => new Map((data?.packetReturns ?? []).map((item) => [item.packetNumber, item])),
    [data?.packetReturns]
  )
  const canFinalize = Boolean(
    data?.planningImport &&
      data.progress.expectedPackets > 0 &&
      data.progress.verifiedPackets === data.progress.expectedPackets &&
      data.progress.issuePackets === 0 &&
      process.status === 'in_process'
  )

  const columns = useMemo<ColumnDef<SemiPolishPacketPlan>[]>(
    () => [
      {
        id: 'packet',
        accessorFn: (plan) =>
          `${plan.packetNumber} ${plan.rawPacketLabel} ${plan.planningLotNo}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Packet' />
        ),
        cell: ({ row }) => {
          const returned = returnedByPacket.get(row.original.packetNumber)
          const isExpanded =
            packetExpansion[row.original.packetNumber] ?? returned?.status !== 'verified'
          return (
            <div className='flex items-center gap-2'>
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform duration-300',
                  !isExpanded && '-rotate-90'
                )}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className='font-mono font-semibold'>
                    #{row.original.packetNumber}
                  </span>
                </TooltipTrigger>
                <TooltipContent side='right'>
                  {row.original.rawPacketLabel} · {row.original.planningLotNo}
                </TooltipContent>
              </Tooltip>
            </div>
          )
        },
      },
      {
        accessorKey: 'roughCarat',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Rough CT' />
        ),
        cell: ({ row }) => (
          <span className='font-mono'>
            {formatCarat(row.original.roughCarat)}
          </span>
        ),
      },
      {
        accessorKey: 'plannedPieceCount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Pieces' />
        ),
        cell: ({ row }) => (
          <span className='font-semibold'>{row.original.plannedPieceCount}</span>
        ),
      },
      {
        accessorKey: 'plannedPolishedCarat',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Polished CT' />
        ),
        cell: ({ row }) => (
          <span className='font-mono'>
            {formatCarat(row.original.plannedPolishedCarat)}
          </span>
        ),
      },
      {
        id: 'status',
        accessorFn: (plan) => {
          const returned = returnedByPacket.get(plan.packetNumber)
          if (returned?.status === 'verified') return 'verified'
          if (returned?.status === 'issue') return 'issue'
          return plan.matchStatus === 'matched' ? 'pending' : 'difference'
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: ({ row }) => {
          const status = row.getValue<string>('status')
          if (status === 'verified') {
            return (
              <Badge className='bg-emerald-600'>
                <CheckCircle2 /> Verified
              </Badge>
            )
          }
          if (status === 'issue') {
            return (
              <Badge variant='destructive'>
                <AlertTriangle /> Issue
              </Badge>
            )
          }
          if (status === 'pending') {
            return (
              <Badge variant='secondary'>
                <Clock3 /> Pending
              </Badge>
            )
          }
          return (
            <Badge
              variant='outline'
              className='border-amber-500 text-amber-700'
            >
              Planning difference
            </Badge>
          )
        },
        filterFn: (row, columnId, values: string[]) =>
          values.includes(row.getValue(columnId)),
      },
      {
        id: 'receivedAt',
        accessorFn: (plan) =>
          returnedByPacket.get(plan.packetNumber)?.receivedAt ?? '',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Received' />
        ),
        cell: ({ row }) => {
          const returned = returnedByPacket.get(row.original.packetNumber)
          return (
            <span className='text-sm text-muted-foreground'>
              {returned ? formatTimestamp(returned.receivedAt) : '—'}
            </span>
          )
        },
      },
    ],
    [packetExpansion, returnedByPacket]
  )

  const packetTable = useReactTable({
    data: data?.packetPlans ?? [],
    columns,
    state: { columnFilters, sorting },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  function resetInlineForms() {
    setDifferencePacketNumber(null)
    setResolutionPacketNumber(null)
    setIssueType('Piece count mismatch')
    setIssueDetails('')
    setObservedPieceCount(0)
    setReturnNotes('')
    setResolutionNote('')
  }

  function beginDifference(plan: SemiPolishPacketPlan) {
    resetInlineForms()
    setDifferencePacketNumber(plan.packetNumber)
    setObservedPieceCount(plan.plannedPieceCount)
  }

  function beginResolution(packetNumber: number) {
    resetInlineForms()
    setResolutionPacketNumber(packetNumber)
  }

  function handleFile(file?: File) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Select an .xlsx planning file.')
      return
    }
    uploadMutation.mutate(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    handleFile(event.dataTransfer.files[0])
  }

  function handlePacketLookup() {
    const number = Number(packetInput.trim())
    if (!Number.isInteger(number) || number < 1) {
      toast.error('Enter a valid numeric packet number.')
      return
    }
    const packetPlans = data?.packetPlans ?? []
    const plan = packetPlans.find((item) => item.packetNumber === number)
    if (!plan) {
      toast.error(`Packet ${number} is not in the active planning file.`)
      return
    }
    packetTable.resetColumnFilters()
    packetTable.resetSorting()
    setFocusedPacketNumber(number)
    setPacketExpansion((current) => ({ ...current, [number]: true }))
    window.setTimeout(() => {
      document.getElementById(`packet-row-${number}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 50)
  }

  if (planningQuery.isLoading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' /> Loading planning and return records…
        </CardContent>
      </Card>
    )
  }

  if (planningQuery.isError || !data) {
    return (
      <Alert variant='destructive'>
        <AlertTriangle />
        <AlertTitle>Unable to load planning records</AlertTitle>
        <AlertDescription>{getApiErrorMessage(planningQuery.error)}</AlertDescription>
      </Alert>
    )
  }

  const planningImport = data.planningImport

  return (
    <>
      <Card className='flex min-h-[620px] flex-1 flex-col gap-0 overflow-hidden py-0 shadow-none'>
        <CardHeader className='flex! flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-3!'>
          {planningImport ? (
            <div className='flex flex-wrap items-center gap-x-5 gap-y-2 text-sm'>
              <div>
                <span className='font-bold text-foreground'>
                  {data.progress.verifiedPackets}
                </span>
                <span className='text-muted-foreground'>
                  {' '}
                  / {data.progress.expectedPackets} verified
                </span>
              </div>
              <div>
                <span className='font-bold text-foreground'>
                  {data.progress.pendingPackets}
                </span>
                <span className='text-muted-foreground'> pending</span>
              </div>
              <div>
                <span
                  className={cn(
                    'font-bold',
                    data.progress.issuePackets
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  )}
                >
                  {data.progress.issuePackets}
                </span>
                <span className='text-muted-foreground'> issues</span>
              </div>
              <div className='hidden text-muted-foreground lg:block'>
                {data.progress.verifiedPieces} / {data.progress.plannedPieces}{' '}
                pieces
              </div>
            </div>
          ) : (
            <div>
              <CardTitle className='text-base'>Upload planning file</CardTitle>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                Import the plan before receiving packets.
              </p>
            </div>
          )}
          {planningImport && (
            <div className='flex flex-wrap justify-end gap-2'>
              {data.pendingPlanningImport && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    setDismissedPendingImportId('')
                    setPendingConfirmation({
                      planningImport: data.pendingPlanningImport!,
                      differences: data.pendingPlanningImport!.differences,
                    })
                  }}
                >
                  <AlertTriangle /> Review pending import
                </Button>
              )}
              <Button size='sm' variant='outline' onClick={() => setPlanningDetailsOpen(true)}>
                <Info /> Planning details
              </Button>
              <Button
                size='sm'
                disabled={!canFinalize}
                onClick={() => setFinalizeOpen(true)}
              >
                <PackageCheck /> Finalize return
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className='flex min-h-0 flex-1 flex-col gap-3 p-4'>
          <input
            ref={fileInputRef}
            type='file'
            accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            className='hidden'
            onChange={(event) => {
              handleFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />

          {!planningImport && data.pendingPlanningImport && !visiblePendingConfirmation && (
            <Alert>
              <AlertTriangle />
              <AlertTitle>A planning import is waiting for confirmation</AlertTitle>
              <AlertDescription className='flex flex-wrap items-center justify-between gap-3'>
                <span>Review its packet or rough-weight differences before activating it.</span>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    setDismissedPendingImportId('')
                    setPendingConfirmation({
                      planningImport: data.pendingPlanningImport!,
                      differences: data.pendingPlanningImport!.differences,
                    })
                  }}
                >
                  Review differences
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!planningImport ? (
            <div
              className={cn(
                'flex min-h-56 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/10'
              )}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {uploadMutation.isPending ? (
                <Loader2 className='size-9 animate-spin text-primary' />
              ) : (
                <FileSpreadsheet className='size-10 text-primary' />
              )}
              <h3 className='mt-4 font-semibold'>Drop the 4P planning workbook here</h3>
              <p className='mt-1 max-w-lg text-sm text-muted-foreground'>
                The original Excel and every packet/polished-piece detail will be stored. Importing does not mark any packet as returned.
              </p>
              <Button
                className='mt-5'
                disabled={uploadMutation.isPending || process.status !== 'in_process'}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud /> Select Excel file
              </Button>
            </div>
          ) : (
            <div className='flex min-h-[500px] flex-1 flex-col overflow-hidden rounded-md border bg-background'>
              <div className='border-b p-3'>
                <DataTableToolbar
                  table={packetTable}
                  searchKey='packet'
                  searchPlaceholder='Search packet...'
                  searchDebounceMs={150}
                  filters={[
                    {
                      columnId: 'status',
                      title: 'Status',
                      options: [
                        { label: 'Verified', value: 'verified', icon: CheckCircle2 },
                        { label: 'Pending', value: 'pending', icon: Clock3 },
                        { label: 'Issue', value: 'issue', icon: AlertTriangle },
                        { label: 'Planning difference', value: 'difference', icon: AlertTriangle },
                      ],
                    },
                  ]}
                  actions={
                    <div className='flex items-center gap-2'>
                      <Input
                        id='packet-number'
                        inputMode='numeric'
                        autoComplete='off'
                        aria-label='Returned packet number'
                        className='h-8 w-48 lg:w-64'
                        placeholder='Returned packet number'
                        value={packetInput}
                        onChange={(event) =>
                          setPacketInput(event.target.value.replace(/\D/g, ''))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handlePacketLookup()
                        }}
                        disabled={process.status !== 'in_process'}
                      />
                      <Button
                        size='sm'
                        onClick={handlePacketLookup}
                        disabled={process.status !== 'in_process'}
                      >
                        <Search /> Verify packet
                      </Button>
                    </div>
                  }
                />
              </div>
              <div className='min-h-0 flex-1 overflow-auto'>
                <Table>
                <TableHeader className='sticky top-0 z-10 bg-background'>
                  {packetTable.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={header.column.columnDef.meta?.className}
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
                <TableBody>
                  {packetTable.getRowModel().rows.length ? (
                    packetTable.getRowModel().rows.map((row) => {
                      const plan = row.original
                      const returned = returnedByPacket.get(plan.packetNumber) ?? null
                      const pieces = returned?.pieces ?? plan.pieces
                      const isExpanded =
                        packetExpansion[plan.packetNumber] ?? returned?.status !== 'verified'
                      const differenceActive = differencePacketNumber === plan.packetNumber
                      const resolutionActive = resolutionPacketNumber === plan.packetNumber
                      const receivingThisPacket =
                        receiveMutation.isPending &&
                        receiveMutation.variables?.plan.packetNumber === plan.packetNumber
                      const resolvingThisPacket =
                        resolveMutation.isPending &&
                        resolveMutation.variables?.plan.packetNumber === plan.packetNumber

                      return (
                        <Fragment key={row.id}>
                          <TableRow
                            id={`packet-row-${plan.packetNumber}`}
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            className={cn(
                              'h-12 cursor-pointer bg-muted/20 hover:bg-muted/30',
                              focusedPacketNumber === plan.packetNumber &&
                                'bg-primary/10 hover:bg-primary/10'
                            )}
                            onClick={() => {
                              setFocusedPacketNumber(plan.packetNumber)
                              setPacketExpansion((current) => ({
                                ...current,
                                [plan.packetNumber]: !isExpanded,
                              }))
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setFocusedPacketNumber(plan.packetNumber)
                                setPacketExpansion((current) => ({
                                  ...current,
                                  [plan.packetNumber]: !isExpanded,
                                }))
                              }
                            }}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell
                                key={cell.id}
                                className={cell.column.columnDef.meta?.className}
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow
                            aria-hidden={!isExpanded}
                            className={cn(
                              isExpanded
                                ? 'border-b-2 bg-muted/10 hover:bg-muted/10'
                                : 'h-0 border-0 bg-transparent hover:bg-transparent'
                            )}
                          >
                            <TableCell
                              colSpan={packetTable.getVisibleLeafColumns().length}
                              className='p-0'
                            >
                              <div
                                className={cn(
                                  'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
                                  isExpanded
                                    ? 'grid-rows-[1fr] opacity-100'
                                    : 'grid-rows-[0fr] opacity-0'
                                )}
                              >
                                <div className='min-h-0 overflow-hidden' inert={!isExpanded}>
                              <div
                                className={cn(
                                  'm-4 overflow-hidden rounded-lg border border-primary/20 bg-background shadow-sm',
                                  returned?.status === 'verified' &&
                                    'border-emerald-500/35 bg-emerald-500/[0.025]'
                                )}
                              >
                                <div
                                  className={cn(
                                    'border-b bg-primary/[0.055] px-4 py-3',
                                    returned?.status === 'verified' &&
                                      'border-emerald-500/25 bg-emerald-500/10'
                                  )}
                                >
                                  <p
                                    className={cn(
                                      'text-sm font-semibold uppercase tracking-wide text-primary/80',
                                      returned?.status === 'verified' &&
                                        'text-emerald-700 dark:text-emerald-400'
                                    )}
                                  >
                                    {plan.planningLotNo} · {plan.rawPacketLabel}
                                  </p>
                                </div>

                                <div className='overflow-x-auto'>
                                  <div
                                    className={cn(
                                      'grid min-w-[1210px] grid-cols-11 text-sm [&>div]:border-r [&>div]:border-t [&>div]:border-border/70 [&>div]:px-3 [&>div]:py-1.5',
                                      returned?.status === 'verified' &&
                                        '[&>div]:border-emerald-500/20'
                                    )}
                                  >
                                    <div className='border-t-0! bg-muted/40 font-medium'>Piece</div>
                                    <div className='border-t-0! bg-muted/40 font-medium'>Polished CT</div>
                                    <div className='border-t-0! bg-muted/40 font-medium'>Shape</div>
                                    <div className='border-t-0! bg-muted/40 font-medium'>Cut</div>
                                    <div className='border-t-0! bg-muted/40 font-medium'>Color</div>
                                    <div className='border-t-0! bg-muted/40 font-medium'>Clarity</div>
                                    {['Total pieces', 'Issued carat', 'Polished total', 'Difference', 'Yield'].map(
                                      (label, labelIndex) => (
                                        <div
                                          key={label}
                                          className={cn(
                                            'border-t-0! bg-muted/40 font-medium',
                                            labelIndex === 4 && 'border-r-0!'
                                          )}
                                        >
                                          {label}
                                        </div>
                                      )
                                    )}

                                    {[
                                      {
                                        key: 'pieces',
                                        value: plan.plannedPieceCount,
                                        mono: false,
                                        warning: false,
                                      },
                                      {
                                        key: 'issued',
                                        value:
                                          plan.issuedRoughCarat == null
                                            ? '—'
                                            : formatCarat(plan.issuedRoughCarat) + ' CT',
                                        mono: true,
                                        warning: false,
                                      },
                                      {
                                        key: 'polished',
                                        value: formatCarat(plan.plannedPolishedCarat) + ' CT',
                                        mono: true,
                                        warning: false,
                                      },
                                      {
                                        key: 'difference',
                                        value:
                                          plan.roughCaratDifference == null
                                            ? '—'
                                            : formatCarat(plan.roughCaratDifference) + ' CT',
                                        mono: true,
                                        warning:
                                          plan.roughCaratDifference != null &&
                                          plan.roughCaratDifference !== 0,
                                      },
                                      {
                                        key: 'yield',
                                        value: Number(plan.yieldPercentage).toFixed(2) + '%',
                                        mono: false,
                                        warning: false,
                                      },
                                    ].map((summary, summaryIndex) => (
                                      <div
                                        key={summary.key}
                                        style={{
                                          gridColumn: summaryIndex + 7,
                                          gridRow: `2 / span ${Math.max(pieces.length, 1)}`,
                                        }}
                                        className={cn(
                                          'flex items-center justify-center text-center font-bold',
                                          summary.mono && 'font-mono',
                                          summary.warning && 'text-amber-700 dark:text-amber-400',
                                          summaryIndex === 4 && 'border-r-0!'
                                        )}
                                      >
                                        {summary.value}
                                      </div>
                                    ))}

                                    {pieces.map((piece) => (
                                      <Fragment key={piece.id || piece._id || piece.sourceRow}>
                                        <div className='font-medium'>#{piece.pieceNumber}</div>
                                        <div className='font-mono font-semibold'>{formatCarat(piece.polishedCarat)}</div>
                                        <div>{piece.shape || '—'}</div>
                                        <div>{piece.cut || '—'}</div>
                                        <div>{piece.color || '—'}</div>
                                        <div>{piece.clarity || '—'}</div>
                                      </Fragment>
                                    ))}
                                  </div>
                                </div>

                                {returned?.notes && (
                                  <div className='border-t px-4 py-3 text-sm'>
                                    <span className='text-muted-foreground'>Notes:</span> {returned.notes}
                                  </div>
                                )}

                                {(returned?.status === 'issue' ||
                                  (!returned && process.status === 'in_process')) && (
                                  <div className='border-t p-2'>
                                    {returned?.status === 'issue' ? (
                                      <div className='space-y-3'>
                                        <Alert variant='destructive'>
                                          <AlertTriangle />
                                          <AlertTitle>Return recorded with an issue</AlertTitle>
                                          <AlertDescription>
                                            {returned.verifiedPieceCount} pieces received {formatTimestamp(returned.receivedAt)} by {getUserName(returned.receivedBy)} via {returned.source}.
                                            {returned.issue?.type ? ' ' + returned.issue.type + ':' : ''}
                                            {returned.issue?.details ? ' ' + returned.issue.details : ''}
                                            {returned.notes ? ' Notes: ' + returned.notes : ''}
                                          </AlertDescription>
                                        </Alert>

                                        {process.status === 'in_process' && (
                                          resolutionActive ? (
                                            <div className='flex flex-col gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 lg:flex-row lg:items-end'>
                                              <div className='min-w-0 flex-1 space-y-1.5'>
                                                <Label htmlFor={'resolution-note-' + plan.packetNumber}>Resolution note</Label>
                                                <Textarea
                                                  id={'resolution-note-' + plan.packetNumber}
                                                  value={resolutionNote}
                                                  onChange={(event) => setResolutionNote(event.target.value)}
                                                  placeholder='Describe how the difference was checked and resolved.'
                                                />
                                              </div>
                                              <div className='flex justify-end gap-2'>
                                                <Button variant='outline' onClick={resetInlineForms}>Cancel</Button>
                                                <Button
                                                  disabled={!resolutionNote.trim() || resolveMutation.isPending}
                                                  onClick={() => resolveMutation.mutate({ plan, returned })}
                                                >
                                                  {resolvingThisPacket && <Loader2 className='animate-spin' />}
                                                  Resolve issue
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className='flex justify-end'>
                                              <Button size='sm' onClick={() => beginResolution(plan.packetNumber)}>
                                                Resolve issue
                                              </Button>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    ) : differenceActive ? (
                                      <div className='space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3'>
                                        <div className='grid gap-3 sm:grid-cols-2'>
                                          <div className='space-y-1.5'>
                                            <Label htmlFor={'observed-pieces-' + plan.packetNumber}>Observed pieces</Label>
                                            <Input
                                              id={'observed-pieces-' + plan.packetNumber}
                                              type='number'
                                              min={0}
                                              step={1}
                                              value={observedPieceCount}
                                              onChange={(event) => setObservedPieceCount(Number(event.target.value))}
                                            />
                                          </div>
                                          <div className='space-y-1.5'>
                                            <Label htmlFor={'issue-type-' + plan.packetNumber}>Issue type</Label>
                                            <Input
                                              id={'issue-type-' + plan.packetNumber}
                                              value={issueType}
                                              onChange={(event) => setIssueType(event.target.value)}
                                            />
                                          </div>
                                          <div className='space-y-1.5 sm:col-span-2'>
                                            <Label htmlFor={'issue-details-' + plan.packetNumber}>Issue details</Label>
                                            <Textarea
                                              id={'issue-details-' + plan.packetNumber}
                                              value={issueDetails}
                                              onChange={(event) => setIssueDetails(event.target.value)}
                                            />
                                          </div>
                                          <div className='space-y-1.5 sm:col-span-2'>
                                            <Label htmlFor={'return-notes-' + plan.packetNumber}>Return notes (optional)</Label>
                                            <Textarea
                                              id={'return-notes-' + plan.packetNumber}
                                              value={returnNotes}
                                              onChange={(event) => setReturnNotes(event.target.value)}
                                            />
                                          </div>
                                        </div>
                                        <div className='flex justify-end gap-2'>
                                          <Button variant='outline' onClick={resetInlineForms}>Cancel</Button>
                                          <Button
                                            variant='destructive'
                                            disabled={receiveMutation.isPending || !issueType.trim() || !issueDetails.trim()}
                                            onClick={() => receiveMutation.mutate({
                                              plan,
                                              hasDifference: true,
                                              issueType,
                                              issueDetails,
                                              observedPieceCount,
                                              notes: returnNotes,
                                            })}
                                          >
                                            {receivingThisPacket && <Loader2 className='animate-spin' />}
                                            Record issue
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className='flex flex-wrap items-center justify-end gap-3'>
                                        {/* <p className='text-sm text-muted-foreground'>
                                          Confirm this packet only after checking all {plan.plannedPieceCount} planned pieces above.
                                        </p> */}
                                        <div className='flex gap-2'>
                                          <Button size='sm' variant='destructive' onClick={() => beginDifference(plan)}>
                                            <AlertTriangle /> Report difference
                                          </Button>
                                          <Button
                                            size='sm'
                                            disabled={receiveMutation.isPending}
                                            onClick={() => receiveMutation.mutate({
                                              plan,
                                              hasDifference: false,
                                              observedPieceCount: plan.plannedPieceCount,
                                            })}
                                          >
                                            {receivingThisPacket && <Loader2 className='animate-spin' />}
                                            <CheckCircle2 /> Confirm {plan.plannedPieceCount} pieces
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      )
                    })
                  ) : (
                    <TableRow className='h-40'>
                      <TableCell
                        colSpan={packetTable.getVisibleLeafColumns().length}
                        className='text-center text-muted-foreground'
                      >
                        No packets match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {planningImport && (
        <Sheet open={planningDetailsOpen} onOpenChange={setPlanningDetailsOpen}>
          <SheetContent className='sm:max-w-md'>
            <SheetHeader className='border-b pe-12'>
              <SheetTitle>Planning details</SheetTitle>
              <SheetDescription>
                Workbook source, planning totals, and import history.
              </SheetDescription>
            </SheetHeader>
            <div className='flex-1 space-y-5 overflow-y-auto px-4'>
              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>Original workbook</p>
                <p className='break-all text-sm font-semibold'>
                  {planningImport.originalFileName}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Version {planningImport.version} · imported{' '}
                  {formatTimestamp(planningImport.createdAt)}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Uploaded by {getUserName(planningImport.uploadedBy)}
                </p>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <SummaryTile
                  label='Planned packets'
                  value={String(planningImport.packetCount)}
                />
                <SummaryTile
                  label='Polished pieces'
                  value={String(planningImport.plannedPieceCount)}
                />
                <SummaryTile
                  label='Planning rough'
                  value={`${formatCarat(planningImport.planningRoughCarat)} CT`}
                />
                <SummaryTile
                  label='Planned polished'
                  value={`${formatCarat(planningImport.plannedPolishedCarat)} CT`}
                />
                <SummaryTile
                  label='Returned packets'
                  value={`${data.progress.receivedPackets} / ${data.progress.expectedPackets}`}
                  tone='good'
                />
                <SummaryTile
                  label='Issues'
                  value={String(data.progress.issuePackets)}
                  tone={data.progress.issuePackets ? 'warn' : 'good'}
                />
              </div>
            </div>
            <SheetFooter className='border-t sm:flex-row'>
              <Button
                variant='outline'
                onClick={() =>
                  downloadPlanningWorkbook(
                    processId,
                    planningImport.originalFileName
                  )
                }
              >
                <Download /> Original Excel
              </Button>
              {process.status === 'in_process' && (
                <Button
                  onClick={() => {
                    setPlanningDetailsOpen(false)
                    fileInputRef.current?.click()
                  }}
                >
                  <UploadCloud /> Replace planning
                </Button>
              )}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      <AlertDialog
        open={Boolean(visiblePendingConfirmation)}
        onOpenChange={(open) => {
          if (!open && !confirmMutation.isPending) {
            if (visiblePendingConfirmation) {
              setDismissedPendingImportId(getId(visiblePendingConfirmation.planningImport))
            }
            setPendingConfirmation(null)
          }
        }}
      >
        <AlertDialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
          <AlertDialogHeader>
            <AlertDialogTitle>Planning differences need confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Review the differences before activating this planning version. Historical returned packets will not be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3'>
            {visiblePendingConfirmation?.differences.map((difference, index) => (
              <div key={`${difference.type}-${difference.packetNumber}-${index}`} className='flex gap-2 text-sm'>
                <AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-600' />
                <span>{difference.message}</span>
              </div>
            ))}
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='confirmation-reason'>Reason for accepting differences</Label>
            <Textarea
              id='confirmation-reason'
              value={confirmationReason}
              onChange={(event) => setConfirmationReason(event.target.value)}
              placeholder='Explain why this planning file is correct and may be activated.'
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmMutation.isPending}>Keep current planning</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmationReason.trim() || confirmMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (visiblePendingConfirmation) confirmMutation.mutate(visiblePendingConfirmation)
              }}
            >
              {confirmMutation.isPending && <Loader2 className='animate-spin' />}
              Confirm and activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize the complete 4P return?</AlertDialogTitle>
            <AlertDialogDescription>
              All {data.progress.expectedPackets} packets are verified. Finalization locks the planning and packet-return history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='space-y-1.5'>
            <Label htmlFor='finalize-notes'>Final return notes (optional)</Label>
            <Textarea id='finalize-notes' value={finalizeNotes} onChange={(event) => setFinalizeNotes(event.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={finalizeMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                finalizeMutation.mutate()
              }}
            >
              {finalizeMutation.isPending && <Loader2 className='animate-spin' />}
              Finalize return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
