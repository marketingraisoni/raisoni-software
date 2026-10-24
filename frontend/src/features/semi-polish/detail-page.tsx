import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  fetchSemiPolishById,
  fetchSemiPolishPlanning,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { formatCarat } from '@/lib/format-carat'
import { formatDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  hasPermission,
} from '@/constants/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BackButton } from '@/components/back-button'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { ProcessExcelButton } from './components/process-excel-button'
import { ProcessPacketPlanningDetails } from './components/process-packet-planning-details'
import {
  SEMI_POLISH_PROCESS_STATUS,
  type SemiPolishProcess,
} from './data/schema'

type Props = {
  processId: string
}

type OverviewItemProps = {
  label: string
  value: ReactNode
  mono?: boolean
  wide?: boolean
}

type TimelineStepProps = {
  title: string
  description: string
  state: 'complete' | 'current' | 'pending' | 'cancelled'
  last?: boolean
}

const statusDetails = {
  in_process: {
    label: 'In Process',
    className:
      'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  returned: {
    label: 'Completed',
    className:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
} as const

function getRecord(value: unknown) {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function getText(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function OverviewItem({ label, value, mono, wide }: OverviewItemProps) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate text-sm font-semibold text-foreground',
          mono && 'font-mono'
        )}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
    </div>
  )
}

function TimelineStep({ title, description, state, last }: TimelineStepProps) {
  const Icon =
    state === 'complete'
      ? CheckCircle2
      : state === 'cancelled'
        ? XCircle
        : state === 'current'
          ? CircleDot
          : CalendarClock

  return (
    <div className='relative flex gap-3'>
      {!last && (
        <div
          className={cn(
            'absolute top-7 bottom-[-1rem] left-[0.6875rem] w-px',
            state === 'complete' ? 'bg-emerald-500/50' : 'bg-border'
          )}
        />
      )}
      <div
        className={cn(
          'relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-background',
          state === 'complete' && 'text-emerald-600 dark:text-emerald-400',
          state === 'current' && 'text-amber-600 dark:text-amber-400',
          state === 'cancelled' && 'text-destructive',
          state === 'pending' && 'text-muted-foreground'
        )}
      >
        <Icon className='size-5' />
      </div>
      <div className={cn('min-w-0 pb-4', last && 'pb-0')}>
        <p className='text-sm font-semibold'>{title}</p>
        <p className='mt-0.5 text-xs leading-relaxed text-muted-foreground'>
          {description}
        </p>
      </div>
    </div>
  )
}

function ProcessLifecycle({ process }: { process: SemiPolishProcess }) {
  const isReturned = process.status === SEMI_POLISH_PROCESS_STATUS.RETURNED
  const isCancelled = process.status === SEMI_POLISH_PROCESS_STATUS.CANCELLED

  return (
    <Card className='gap-0 py-0 shadow-none'>
      <CardHeader className='grid-rows-1 place-items-center gap-0 border-b px-4 py-3!'>
        <CardTitle className='text-center text-base'>
          Process lifecycle
        </CardTitle>
      </CardHeader>
      <CardContent className='p-4'>
        <TimelineStep
          title='Packet assortment completed'
          description={`${process.issuedPieces} packets prepared for external 4P processing.`}
          state='complete'
        />
        <TimelineStep
          title='Issued to 4P vendor'
          description={`${formatDate(process.issueDate)} · ${process.vendorName} · ${process.issueNo}`}
          state='complete'
        />
        {isCancelled ? (
          <TimelineStep
            title='Issue cancelled'
            description={`The handover was cancelled on ${formatDate(process.updatedAt)}.`}
            state='cancelled'
            last
          />
        ) : (
          <>
            <TimelineStep
              title='Semi-polish processing'
              description={
                isReturned
                  ? 'External 4P processing was completed.'
                  : process.expectedReturnDate
                    ? `In progress · expected by ${formatDate(process.expectedReturnDate)}.`
                    : 'In progress with the vendor; no expected return date was set.'
              }
              state={isReturned ? 'complete' : 'current'}
            />
            <TimelineStep
              title={
                isReturned
                  ? 'Material received and verified'
                  : 'Return and verification'
              }
              description={
                isReturned && process.returnDate
                  ? `${formatDate(process.returnDate)} · ${process.returnedPieces ?? 0} pcs · ${formatCarat(process.returnedCarat ?? 0)} CT received.`
                  : 'Pending receipt from the vendor.'
              }
              state={isReturned ? 'complete' : 'pending'}
              last
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function SemiPolishDetailPage({ processId }: Props) {
  const [expandedPacketNumber, setExpandedPacketNumber] = useState<
    number | null
  >(null)
  const user = useAuthStore((state) => state.auth.user)
  const canUpdate = hasPermission(
    user,
    PERMISSION_MODULE.SEMI_POLISH,
    PERMISSION_ACTION.UPDATE
  )
  const processQuery = useQuery({
    queryKey: semiPolishQueryKeys.detail(processId),
    queryFn: () => fetchSemiPolishById(processId),
  })
  const planningQuery = useQuery({
    queryKey: semiPolishQueryKeys.planning(processId),
    queryFn: () => fetchSemiPolishPlanning(processId),
    enabled: Boolean(processQuery.data?.activePlanningImport),
  })
  const packetPlansById = useMemo(
    () =>
      new Map(
        (planningQuery.data?.packetPlans ?? [])
          .filter((plan) => plan.matchedPacket)
          .map((plan) => [String(plan.matchedPacket), plan])
      ),
    [planningQuery.data?.packetPlans]
  )
  const packetPlansByNumber = useMemo(
    () =>
      new Map(
        (planningQuery.data?.packetPlans ?? []).map((plan) => [
          plan.packetNumber,
          plan,
        ])
      ),
    [planningQuery.data?.packetPlans]
  )
  const packetReturnsByNumber = useMemo(
    () =>
      new Map(
        (planningQuery.data?.packetReturns ?? []).map((packetReturn) => [
          packetReturn.packetNumber,
          packetReturn,
        ])
      ),
    [planningQuery.data?.packetReturns]
  )

  if (processQuery.isLoading) {
    return (
      <>
        <AppHeader fixed />
        <Main fixed fluid className='flex flex-1 items-center justify-center'>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            Loading 4P process…
          </div>
        </Main>
      </>
    )
  }

  const process = processQuery.data
  if (processQuery.isError || !process) {
    return (
      <>
        <AppHeader fixed />
        <Main fixed fluid className='flex flex-1 items-center justify-center'>
          <div className='w-full max-w-lg rounded-xl border bg-background p-8 text-center'>
            <h1 className='text-lg font-semibold'>
              Unable to load this 4P process
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              The record may be unavailable or the server could not be reached.
            </p>
            <div className='mt-5 flex justify-center gap-2'>
              <BackButton fallback={{ to: '/semi-polish' }}>Back</BackButton>
              <Button onClick={() => processQuery.refetch()}>
                <RefreshCw /> Try again
              </Button>
            </div>
          </div>
        </Main>
      </>
    )
  }

  const status = statusDetails[process.status]
  const vendor = getRecord(process.vendor)
  const issuedBy = getRecord(process.issuedBy)
  const receivedBy = getRecord(process.receivedBy)
  const vendorMobile = getText(vendor, 'mobile')
  const issuedByName =
    getText(issuedBy, 'name') || getText(issuedBy, 'username')
  const receivedByName =
    getText(receivedBy, 'name') || getText(receivedBy, 'username')
  const isReturned = process.status === SEMI_POLISH_PROCESS_STATUS.RETURNED

  const togglePacket = (packetNumber: number) => {
    setExpandedPacketNumber((current) =>
      current === packetNumber ? null : packetNumber
    )
  }

  return (
    <>
      <AppHeader fixed />
      <Main
        fixed
        fluid
        className='flex min-h-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible print:p-0'
      >
        <div className='flex h-0 min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto pb-4 lg:overflow-hidden print:h-auto print:overflow-visible print:pb-0'>
          <div className='flex shrink-0 flex-wrap items-start justify-between gap-3 print:hidden'>
            <div className='flex min-w-0 items-start gap-3'>
              <BackButton fallback={{ to: '/semi-polish' }} />
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h1 className='truncate text-xl font-bold tracking-tight'>
                    {isReturned ? 'Completed 4P Process' : '4P Process Details'}
                  </h1>
                  <Badge variant='outline' className={status.className}>
                    {status.label}
                  </Badge>
                </div>
                <p className='mt-1 font-mono text-sm text-muted-foreground'>
                  {process.issueNo}
                </p>
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              {canUpdate && (
                <Button asChild>
                  <Link
                    to='/semi-polish/planning-returns/$processId'
                    params={{
                      processId: (process._id || process.id) as string,
                    }}
                  >
                    <ClipboardCheck />
                    {isReturned
                      ? 'Packet return records'
                      : 'Planning & returns'}
                  </Link>
                </Button>
              )}
              <ProcessExcelButton
                processId={(process._id || process.id) as string}
                issueNo={process.issueNo}
              />
            </div>
          </div>

          <section className='hidden border-b pb-4 print:block'>
            <p className='text-xs font-semibold tracking-wider text-muted-foreground uppercase'>
              Raisoni ERP · 4P Semi-Polish
            </p>
            <div className='mt-2 flex items-end justify-between gap-4'>
              <div>
                <h1 className='text-2xl font-bold'>4P Process Record</h1>
                <p className='font-mono text-sm'>{process.issueNo}</p>
              </div>
              <Badge variant='outline' className={status.className}>
                {status.label}
              </Badge>
            </div>
          </section>

          <div className='grid min-h-[700px] gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[420px_minmax(0,1fr)] print:block'>
            <aside className='space-y-3 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pe-1 print:overflow-visible print:pe-0'>
              <Card className='gap-0 py-0 shadow-none'>
                <CardHeader className='grid-rows-1 place-items-center gap-0 border-b px-4 py-3!'>
                  <CardTitle className='text-center text-base'>
                    Material summary
                  </CardTitle>
                </CardHeader>
                <CardContent className='grid grid-cols-2 gap-x-5 gap-y-3 p-4'>
                  <OverviewItem label='Lot / Kapan' value={process.kapanNo} />
                  <OverviewItem label='4P Vendor' value={process.vendorName} />
                  <OverviewItem
                    label='Issued packets'
                    value={`${process.issuedPieces} Pkt`}
                  />
                  <OverviewItem
                    label='Issued weight'
                    value={`${formatCarat(process.issuedCarat)} CT`}
                  />
                  {isReturned && (
                    <>
                      <OverviewItem
                        label='Returned pieces'
                        value={`${process.returnedPieces ?? 0} pcs`}
                      />
                      <OverviewItem
                        label='Returned weight'
                        value={`${formatCarat(process.returnedCarat ?? 0)} CT`}
                      />
                      <OverviewItem
                        label='Process loss'
                        value={`${formatCarat(process.processLossCarat ?? 0)} CT`}
                      />
                      <OverviewItem
                        label='Loss percentage'
                        value={
                          process.processLossPercentage != null
                            ? String(process.processLossPercentage).endsWith(
                                '%'
                              )
                              ? process.processLossPercentage
                              : `${process.processLossPercentage}%`
                            : '0%'
                        }
                      />
                      {process.plannedYieldPercentage != null && (
                        <OverviewItem
                          label='Planned yield'
                          value={`${Number(process.plannedYieldPercentage).toFixed(2)}%`}
                        />
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <ProcessLifecycle process={process} />

              <Card className='gap-0 py-0 shadow-none'>
                <CardHeader className='grid-rows-1 place-items-center gap-0 border-b px-4 py-3!'>
                  <CardTitle className='text-center text-base'>
                    Process overview
                  </CardTitle>
                </CardHeader>
                <CardContent className='grid gap-x-5 gap-y-3 p-4 sm:grid-cols-2 xl:grid-cols-2'>
                  <OverviewItem
                    label='Issue / Jangad No'
                    value={process.issueNo}
                    mono
                  />
                  <OverviewItem
                    label='Issue date'
                    value={formatDate(process.issueDate)}
                  />
                  <OverviewItem
                    label='Expected return'
                    value={
                      process.expectedReturnDate
                        ? formatDate(process.expectedReturnDate)
                        : 'Not specified'
                    }
                  />
                  <OverviewItem label='Issued by' value={issuedByName ?? '—'} />
                  <OverviewItem
                    label='Vendor contact'
                    value={vendorMobile ?? 'Not specified'}
                  />
                  {isReturned && (
                    <>
                      <OverviewItem
                        label='Return date'
                        value={
                          process.returnDate
                            ? formatDate(process.returnDate)
                            : '—'
                        }
                      />
                      <OverviewItem
                        label='Received by'
                        value={receivedByName ?? '—'}
                      />
                    </>
                  )}
                  <OverviewItem
                    label={isReturned ? 'Return remarks' : 'Instructions'}
                    value={
                      (isReturned ? process.returnNotes : process.notes) ||
                      'No remarks added'
                    }
                    wide
                  />
                </CardContent>
              </Card>
            </aside>

            <Card className='min-h-[520px] gap-0 overflow-hidden py-0 shadow-none xl:h-full xl:min-h-0 print:mt-3 print:min-h-0 print:overflow-visible'>
              <CardHeader className='grid-rows-1 place-items-center gap-0 border-b px-4 py-3!'>
                <div className='relative flex w-full items-center justify-center'>
                  <CardTitle className='text-center text-base'>
                    Packet handover manifest
                  </CardTitle>
                  <div className='absolute end-0 flex items-center gap-2'>
                    {planningQuery.data?.planningImport && (
                      <Badge variant='outline'>Imported details</Badge>
                    )}
                    <Badge variant='secondary'>
                      {(process.packets || []).length} packets
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='min-h-0 flex-1 overflow-auto p-0 print:overflow-visible [&_[data-slot=table-container]]:overflow-visible'>
                <Table>
                  <TableHeader className='sticky top-0 z-10 bg-background'>
                    <TableRow>
                      <TableHead className='w-24 ps-5'>Sr No</TableHead>
                      <TableHead>Packet No</TableHead>
                      <TableHead className='w-40'>Grade</TableHead>
                      <TableHead className='w-52 pe-5 text-right'>
                        Carat
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(process.packets || []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className='py-8 text-center text-muted-foreground'
                        >
                          No packet snapshots recorded for this process.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (process.packets || []).map((packet, index) => {
                        const plan =
                          packetPlansById.get(String(packet.packetId)) ??
                          packetPlansByNumber.get(packet.srNo)
                        const isExpanded = Boolean(
                          plan && expandedPacketNumber === plan.packetNumber
                        )

                        return (
                          <Fragment
                            key={packet.packetId || `${packet.name}-${index}`}
                          >
                            <TableRow
                              tabIndex={plan ? 0 : undefined}
                              aria-expanded={plan ? isExpanded : undefined}
                              className={cn(
                                plan &&
                                  'cursor-pointer bg-muted/10 hover:bg-muted/30'
                              )}
                              onClick={() =>
                                plan && togglePacket(plan.packetNumber)
                              }
                              onKeyDown={(event) => {
                                if (
                                  plan &&
                                  (event.key === 'Enter' || event.key === ' ')
                                ) {
                                  event.preventDefault()
                                  togglePacket(plan.packetNumber)
                                }
                              }}
                            >
                              <TableCell className='ps-5 font-mono text-muted-foreground'>
                                <span className='flex items-center gap-2'>
                                  {plan && (
                                    <ChevronDown
                                      className={cn(
                                        'size-4 transition-transform duration-300',
                                        !isExpanded && '-rotate-90'
                                      )}
                                    />
                                  )}
                                  {packet.srNo}
                                </span>
                              </TableCell>
                              <TableCell className='font-semibold'>
                                {packet.name}
                              </TableCell>
                              <TableCell>{packet.grade || 'A'}</TableCell>
                              <TableCell className='pe-5 text-right font-mono font-semibold'>
                                {formatCarat(packet.carat)} CT
                              </TableCell>
                            </TableRow>
                            {plan && isExpanded && (
                              <TableRow className='border-b-2 bg-muted/10 hover:bg-muted/10'>
                                <TableCell
                                  colSpan={4}
                                  className='p-0 whitespace-normal'
                                >
                                  <ProcessPacketPlanningDetails
                                    plan={plan}
                                    packetReturn={packetReturnsByNumber.get(
                                      plan.packetNumber
                                    )}
                                  />
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className='sticky bottom-0 z-10 mt-auto flex items-center justify-between border-t bg-muted/80 px-5 py-2.5! backdrop-blur-xs print:static print:bg-transparent'>
                <span className='text-sm font-semibold'>
                  Total issued · {process.issuedPieces} Pkt
                </span>
                <span className='font-mono text-sm font-bold text-primary'>
                  {formatCarat(process.issuedCarat)} CT
                </span>
              </CardFooter>
            </Card>
          </div>
        </div>
      </Main>
    </>
  )
}
