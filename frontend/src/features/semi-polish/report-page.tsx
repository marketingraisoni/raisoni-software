import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchSemiPolishList,
  fetchVendors,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import {
  Award,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  FilterX,
  Gem,
  PieChart as PieIcon,
  RefreshCw,
  Scale,
  Search,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCarat } from '@/lib/format-carat'
import { formatDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/date-picker'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'

const REPORT_QUERY = {
  page: 1,
  limit: 100,
  sortBy: 'issueDate',
  sortOrder: 'desc' as const,
}

const PREVIEW_LIMIT = 5
const VENDOR_CHART_LIMIT = 6
const TREND_LIMIT = 12
type MetricTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate'

const metricToneClasses: Record<
  MetricTone,
  { icon: string; value: string }
> = {
  blue: {
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
  emerald: {
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
  },
  rose: {
    icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    value: 'text-rose-700 dark:text-rose-300',
  },
  violet: {
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    value: 'text-violet-700 dark:text-violet-300',
  },
  slate: {
    icon: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    value: 'text-foreground',
  },
}

function MetricCard({
  label,
  value,
  suffix,
  detail,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  suffix?: string
  detail: string
  icon: LucideIcon
  tone: MetricTone
}) {
  const colors = metricToneClasses[tone]

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{label}</CardTitle>
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-md',
            colors.icon
          )}
        >
          <Icon className='size-4' />
        </span>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'flex items-baseline gap-1.5 text-2xl font-bold',
            colors.value
          )}
        >
          {value}
          {suffix && (
            <span className='text-sm font-normal text-muted-foreground uppercase'>
              {suffix}
            </span>
          )}
        </div>
        <p className='mt-1 text-xs text-muted-foreground'>{detail}</p>
      </CardContent>
    </Card>
  )
}

function ChartEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className='flex min-h-64 flex-col items-center justify-center px-6 text-center'>
      <span className='flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground'>
        <Icon className='size-5' />
      </span>
      <p className='mt-3 text-sm font-semibold'>{title}</p>
      <p className='mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground'>
        {description}
      </p>
    </div>
  )
}

type AnalyticsTooltipItem = {
  color?: string
  dataKey?: string
  name?: string
  value?: number | string
  payload?: Record<string, unknown>
}

function AnalyticsTooltip({
  active,
  payload,
  label,
  suffix = '',
}: {
  active?: boolean
  payload?: AnalyticsTooltipItem[]
  label?: string | number
  suffix?: string
}) {
  if (!active || !payload?.length) return null

  const context = payload[0]?.payload
  const lotLabel = typeof context?.kapan === 'string' ? context.kapan : null

  return (
    <div className='min-w-40 rounded-xl border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-sm'>
      {(label || lotLabel) && (
        <div className='mb-2 border-b pb-2'>
          <p className='text-xs font-semibold'>{label}</p>
          {lotLabel && (
            <p className='mt-0.5 text-xs text-muted-foreground'>
              Lot {lotLabel}
            </p>
          )}
        </div>
      )}
      <div className='space-y-1.5'>
        {payload.map((item) => (
          <div
            key={`${item.dataKey || item.name}-${item.value}`}
            className='flex items-center justify-between gap-5 text-xs'
          >
            <span className='flex min-w-0 items-center gap-2 text-muted-foreground'>
              <span
                className='size-2 shrink-0 rounded-full'
                style={{ backgroundColor: item.color }}
              />
              <span className='truncate'>{item.name}</span>
            </span>
            <span className='font-mono font-bold'>
              {typeof item.value === 'number'
                ? item.value.toLocaleString(undefined, {
                    maximumFractionDigits: 3,
                  })
                : item.value}
              {suffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SemiPolishReportPage() {
  const [search, setSearch] = useState('')
  const [selectedVendorId, setSelectedVendorId] = useState('all')
  const [fromDate, setFromDate] = useState<Date | undefined>()
  const [toDate, setToDate] = useState<Date | undefined>()

  const {
    data: listData,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: semiPolishQueryKeys.list(REPORT_QUERY),
    queryFn: () => fetchSemiPolishList(REPORT_QUERY),
  })

  const { data: vendors = [] } = useQuery({
    queryKey: semiPolishQueryKeys.vendors,
    queryFn: fetchVendors,
  })

  const allProcesses = useMemo(
    () => listData?.processes || [],
    [listData?.processes]
  )

  const hasActiveFilters =
    selectedVendorId !== 'all' || Boolean(fromDate || toDate || search.trim())

  const filteredProcesses = useMemo(() => {
    return allProcesses.filter((process) => {
      if (selectedVendorId !== 'all') {
        const vendorId =
          typeof process.vendor === 'object' && process.vendor
            ? process.vendor._id || process.vendor.id
            : String(process.vendor)

        if (
          vendorId !== selectedVendorId &&
          process.vendorName !== selectedVendorId
        ) {
          return false
        }
      }

      if (fromDate && new Date(process.issueDate) < fromDate) return false

      if (toDate) {
        const endOfDay = new Date(toDate)
        endOfDay.setHours(23, 59, 59, 999)
        if (new Date(process.issueDate) > endOfDay) return false
      }

      if (search.trim()) {
        const term = search.trim().toLowerCase()
        const matches =
          process.kapanNo?.toLowerCase().includes(term) ||
          process.issueNo?.toLowerCase().includes(term) ||
          process.vendorName?.toLowerCase().includes(term)
        if (!matches) return false
      }

      return true
    })
  }, [allProcesses, fromDate, search, selectedVendorId, toDate])

  const latestProcesses = useMemo(
    () =>
      [...filteredProcesses]
        .sort(
          (a, b) =>
            new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
        )
        .slice(0, PREVIEW_LIMIT),
    [filteredProcesses]
  )

  const summary = useMemo(() => {
    const totalLots = filteredProcesses.length
    const activeLots = filteredProcesses.filter(
      (process) => process.status === 'in_process'
    ).length
    const completed = filteredProcesses.filter(
      (process) => process.status === 'returned'
    )
    const completedLots = completed.length
    const cancelledLots = filteredProcesses.filter(
      (process) => process.status === 'cancelled'
    ).length
    const totalIssuedCarat = filteredProcesses.reduce(
      (total, process) => total + (process.issuedCarat || 0),
      0
    )
    const completedIssuedCarat = completed.reduce(
      (total, process) => total + (process.issuedCarat || 0),
      0
    )
    const totalReturnedCarat = completed.reduce(
      (total, process) => total + (process.returnedCarat || 0),
      0
    )
    const totalLossCarat = completed.reduce(
      (total, process) => total + (process.processLossCarat || 0),
      0
    )
    const avgLossPercentage =
      completedIssuedCarat > 0
        ? Math.round((totalLossCarat / completedIssuedCarat) * 10000) / 100
        : 0
    const yieldRate =
      completedIssuedCarat > 0
        ? Math.round((totalReturnedCarat / completedIssuedCarat) * 10000) / 100
        : 0
    const completionRate =
      totalLots > 0 ? Math.round((completedLots / totalLots) * 10000) / 100 : 0

    return {
      totalLots,
      activeLots,
      completedLots,
      cancelledLots,
      totalIssuedCarat,
      totalReturnedCarat,
      totalLossCarat,
      avgLossPercentage,
      yieldRate,
      completionRate,
    }
  }, [filteredProcesses])

  const vendorChartData = useMemo(() => {
    const vendorsByName = new Map<
      string,
      {
        name: string
        issued: number
        returned: number
        loss: number
        count: number
      }
    >()

    filteredProcesses.forEach((process) => {
      const vendorName = process.vendorName || 'Other'
      const current = vendorsByName.get(vendorName) || {
        name: vendorName,
        issued: 0,
        returned: 0,
        loss: 0,
        count: 0,
      }

      current.count += 1
      current.issued += process.issuedCarat || 0
      if (process.status === 'returned') {
        current.returned += process.returnedCarat || 0
        current.loss += process.processLossCarat || 0
      }
      vendorsByName.set(vendorName, current)
    })

    return Array.from(vendorsByName.values())
      .map((vendor) => ({
        name: vendor.name,
        'Issued Carat': Math.round(vendor.issued * 100) / 100,
        'Returned Carat': Math.round(vendor.returned * 100) / 100,
        'Loss Carat': Math.round(vendor.loss * 100) / 100,
        count: vendor.count,
      }))
      .sort((a, b) => b['Issued Carat'] - a['Issued Carat'])
      .slice(0, VENDOR_CHART_LIMIT)
  }, [filteredProcesses])

  const yieldDistribution = useMemo(() => {
    let optimal = 0
    let standard = 0
    let high = 0
    let inProcess = 0
    let cancelled = 0

    filteredProcesses.forEach((process) => {
      if (process.status === 'in_process') {
        inProcess += 1
      } else if (process.status === 'cancelled') {
        cancelled += 1
      } else {
        const loss = process.processLossPercentage || 0
        if (loss <= 4) optimal += 1
        else if (loss <= 6) standard += 1
        else high += 1
      }
    })

    return [
      {
        name: 'Optimal',
        detail: '<4% loss',
        value: optimal,
        color: 'var(--chart-2)',
      },
      {
        name: 'Standard',
        detail: '4-6% loss',
        value: standard,
        color: 'var(--chart-4)',
      },
      {
        name: 'High loss',
        detail: '>6% loss',
        value: high,
        color: 'var(--chart-5)',
      },
      {
        name: 'In process',
        detail: 'Awaiting return',
        value: inProcess,
        color: 'var(--chart-1)',
      },
      {
        name: 'Cancelled',
        detail: 'Stopped',
        value: cancelled,
        color: 'var(--chart-3)',
      },
    ].filter((item) => item.value > 0)
  }, [filteredProcesses])

  const trendData = useMemo(() => {
    return [...filteredProcesses]
      .filter((process) => process.status === 'returned')
      .sort(
        (a, b) =>
          new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
      )
      .slice(-TREND_LIMIT)
      .map((process) => ({
        date: formatDate(process.issueDate),
        kapan: process.kapanNo,
        'Loss %': process.processLossPercentage || 0,
        'Loss CT': process.processLossCarat || 0,
      }))
  }, [filteredProcesses])

  const vendorLeaderboard = useMemo(() => {
    const vendorsByName = new Map<
      string,
      {
        vendorName: string
        totalLots: number
        completedLots: number
        completedIssuedCarat: number
        returnedCarat: number
        lossCarat: number
        latestActivityAt: number
      }
    >()

    filteredProcesses.forEach((process) => {
      const vendorName = process.vendorName || 'Vendor'
      const current = vendorsByName.get(vendorName) || {
        vendorName,
        totalLots: 0,
        completedLots: 0,
        completedIssuedCarat: 0,
        returnedCarat: 0,
        lossCarat: 0,
        latestActivityAt: 0,
      }

      current.totalLots += 1
      current.latestActivityAt = Math.max(
        current.latestActivityAt,
        new Date(process.issueDate).getTime()
      )
      if (process.status === 'returned') {
        current.completedLots += 1
        current.completedIssuedCarat += process.issuedCarat || 0
        current.returnedCarat += process.returnedCarat || 0
        current.lossCarat += process.processLossCarat || 0
      }
      vendorsByName.set(vendorName, current)
    })

    return Array.from(vendorsByName.values())
      .filter((vendor) => vendor.completedLots > 0)
      .map((vendor) => {
        const recoveryRate =
          vendor.completedIssuedCarat > 0
            ? Math.round(
                (vendor.returnedCarat / vendor.completedIssuedCarat) * 10000
              ) / 100
            : 0
        const lossPct =
          vendor.completedIssuedCarat > 0
            ? Math.round(
                (vendor.lossCarat / vendor.completedIssuedCarat) * 10000
              ) / 100
            : 0
        return { ...vendor, recoveryRate, lossPct }
      })
      .sort(
        (a, b) =>
          a.lossPct - b.lossPct ||
          b.recoveryRate - a.recoveryRate ||
          b.latestActivityAt - a.latestActivityAt
      )
      .slice(0, PREVIEW_LIMIT)
  }, [filteredProcesses])

  const reportInsights = useMemo(() => {
    const highestLossProcess = [...filteredProcesses]
      .filter((process) => process.status === 'returned')
      .sort(
        (a, b) =>
          (b.processLossPercentage || 0) - (a.processLossPercentage || 0)
      )[0]

    return {
      bestVendor: vendorLeaderboard[0],
      highestLossProcess,
      latestProcess: latestProcesses[0],
    }
  }, [filteredProcesses, latestProcesses, vendorLeaderboard])

  const handleClearFilters = () => {
    setSelectedVendorId('all')
    setFromDate(undefined)
    setToDate(undefined)
    setSearch('')
  }

  return (
    <>
      <AppHeader fixed />
      <Main fluid>
        <div className='space-y-4 pb-8 max-sm:mb-16'>
          <div className='mb-2 flex flex-wrap items-center justify-between gap-4'>
            <div>
              <h1 className='text-2xl font-bold tracking-tight'>
                4P Process Analytics & Yield Insights
              </h1>
              <p className='text-muted-foreground'>
                Monitor vendor recovery, process loss, throughput, and recent
                lot performance.
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='outline' className='gap-1.5 py-1.5 text-xs'>
                <CircleDot className='size-3.5 text-amber-500' />
                {summary.activeLots} active
              </Badge>
              <Badge variant='outline' className='gap-1.5 py-1.5 text-xs'>
                <CheckCircle2 className='size-3.5 text-emerald-500' />
                {summary.completedLots} returned
              </Badge>
              <Button
                type='button'
                variant='outline'
                disabled={isFetching}
                onClick={() => void refetch()}
                className='cursor-pointer'
              >
                <RefreshCw
                  className={cn('size-4', isFetching && 'animate-spin')}
                />
                Refresh
              </Button>
            </div>
          </div>

          {isError && (
            <div className='flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm'>
              <span>
                Some analytics could not be loaded. Try refreshing the report.
              </span>
              <Button
                variant='outline'
                size='sm'
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            </div>
          )}

          <Card>
            <CardHeader className='flex flex-row items-start justify-between gap-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <CardTitle>Report Filters</CardTitle>
                  <CardDescription>
                    Every metric and chart below follows these filters.
                  </CardDescription>
                </div>
              </div>
              <div className='flex shrink-0 items-center gap-2'>
                <Badge variant='secondary' className='text-xs'>
                  {filteredProcesses.length} matching records
                </Badge>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  disabled={!hasActiveFilters}
                  onClick={handleClearFilters}
                  className='cursor-pointer text-muted-foreground'
                >
                  <FilterX className='size-4' />
                  Clear filters
                </Button>
              </div>
            </CardHeader>
            <CardContent className='grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.2fr]'>
              <div className='space-y-2'>
                <Label>4P Vendor</Label>
                <Select
                  value={selectedVendorId}
                  onValueChange={setSelectedVendorId}
                >
                  <SelectTrigger className='w-full cursor-pointer'>
                    <SelectValue placeholder='All vendors' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all' className='cursor-pointer'>
                      All vendors ({vendors.length})
                    </SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem
                        key={vendor._id || vendor.id}
                        value={vendor._id || vendor.id || vendor.name}
                        className='cursor-pointer'
                      >
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Issue Date From</Label>
                <DatePicker
                  selected={fromDate}
                  onSelect={(date) => {
                    setFromDate(date)
                    if (date && toDate && date > toDate) setToDate(date)
                  }}
                  placeholder='dd/MM/yyyy'
                  disableFuture
                  maxDate={toDate}
                />
              </div>

              <div className='space-y-2'>
                <Label>Issue Date To</Label>
                <DatePicker
                  selected={toDate}
                  onSelect={(date) => {
                    setToDate(date)
                    if (date && fromDate && date < fromDate) setFromDate(date)
                  }}
                  placeholder='dd/MM/yyyy'
                  disableFuture
                  minDate={fromDate}
                />
              </div>

              <div className='space-y-2'>
                <Label>Search Records</Label>
                <div className='relative'>
                  <Search className='absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder='Lot, issue number, or vendor'
                    className='ps-9'
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <section>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <div>
                <h2 className='text-lg font-semibold'>Operational Overview</h2>
                <p className='text-sm text-muted-foreground'>
                  Current totals for the selected report scope.
                </p>
              </div>
              {summary.cancelledLots > 0 && (
                <Badge
                  variant='outline'
                  className='text-xs text-muted-foreground'
                >
                  {summary.cancelledLots} cancelled
                </Badge>
              )}
            </div>
            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6'>
              <MetricCard
                label='Batches handled'
                value={summary.totalLots}
                suffix='lots'
                detail={`${summary.completionRate}% completion rate`}
                icon={BarChart3}
                tone='slate'
              />
              <MetricCard
                label='Active at vendor'
                value={summary.activeLots}
                suffix='lots'
                detail='Awaiting 4P return'
                icon={CalendarClock}
                tone='amber'
              />
              <MetricCard
                label='Completed'
                value={summary.completedLots}
                suffix='lots'
                detail='Returned and verified'
                icon={CheckCircle2}
                tone='emerald'
              />
              <MetricCard
                label='Issued weight'
                value={formatCarat(summary.totalIssuedCarat)}
                suffix='ct'
                detail='Total material sent to 4P'
                icon={Gem}
                tone='blue'
              />
              <MetricCard
                label='Yield recovery'
                value={`${summary.yieldRate}%`}
                detail={`${formatCarat(summary.totalReturnedCarat)} CT returned`}
                icon={TrendingUp}
                tone='violet'
              />
              <MetricCard
                label='Process loss'
                value={formatCarat(summary.totalLossCarat)}
                suffix='ct'
                detail={`${summary.avgLossPercentage}% mean loss rate`}
                icon={Scale}
                tone='rose'
              />
            </div>
          </section>

          <section className='grid gap-3 lg:grid-cols-3'>
            <div className='relative overflow-hidden rounded-xl border bg-card px-4 py-3.5 shadow-xs'>
              <div className='absolute inset-y-0 start-0 w-1 bg-emerald-500' />
              <div className='flex items-start gap-3'>
                <span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600'>
                  <Award className='size-4' />
                </span>
                <div className='min-w-0'>
                  <p className='text-[10px] font-semibold tracking-wide text-muted-foreground uppercase'>
                    Best vendor yield
                  </p>
                  {reportInsights.bestVendor ? (
                    <>
                      <p className='mt-1 truncate text-sm font-bold'>
                        {reportInsights.bestVendor.vendorName}
                      </p>
                      <p className='mt-0.5 text-[11px] text-muted-foreground'>
                        {reportInsights.bestVendor.recoveryRate}% recovery /{' '}
                        {reportInsights.bestVendor.lossPct}% loss
                      </p>
                    </>
                  ) : (
                    <p className='mt-1 text-xs text-muted-foreground'>
                      Awaiting completed vendor returns
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className='relative overflow-hidden rounded-xl border bg-card px-4 py-3.5 shadow-xs'>
              <div className='absolute inset-y-0 start-0 w-1 bg-rose-500' />
              <div className='flex items-start gap-3'>
                <span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600'>
                  <Scale className='size-4' />
                </span>
                <div className='min-w-0'>
                  <p className='text-[10px] font-semibold tracking-wide text-muted-foreground uppercase'>
                    Highest loss to review
                  </p>
                  {reportInsights.highestLossProcess ? (
                    <>
                      <p className='mt-1 truncate text-sm font-bold'>
                        Lot {reportInsights.highestLossProcess.kapanNo}
                      </p>
                      <p className='mt-0.5 text-[11px] text-muted-foreground'>
                        {reportInsights.highestLossProcess
                          .processLossPercentage || 0}
                        % /{' '}
                        {formatCarat(
                          reportInsights.highestLossProcess.processLossCarat ||
                            0
                        )}{' '}
                        CT variance
                      </p>
                    </>
                  ) : (
                    <p className='mt-1 text-xs text-muted-foreground'>
                      No completed loss data available
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className='relative overflow-hidden rounded-xl border bg-card px-4 py-3.5 shadow-xs'>
              <div className='absolute inset-y-0 start-0 w-1 bg-blue-500' />
              <div className='flex items-start gap-3'>
                <span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600'>
                  <CalendarClock className='size-4' />
                </span>
                <div className='min-w-0'>
                  <p className='text-[10px] font-semibold tracking-wide text-muted-foreground uppercase'>
                    Latest process movement
                  </p>
                  {reportInsights.latestProcess ? (
                    <>
                      <p className='mt-1 truncate text-sm font-bold'>
                        Lot {reportInsights.latestProcess.kapanNo}
                      </p>
                      <p className='mt-0.5 text-[11px] text-muted-foreground'>
                        {reportInsights.latestProcess.vendorName} /{' '}
                        {formatDate(reportInsights.latestProcess.issueDate)}
                      </p>
                    </>
                  ) : (
                    <p className='mt-1 text-xs text-muted-foreground'>
                      No matching process activity
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className='grid gap-5 xl:grid-cols-3'>
            <Card className='gap-0 overflow-hidden py-0 shadow-none xl:col-span-2'>
              <CardHeader className='border-b px-5 py-4!'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <CardTitle className='flex items-center gap-2 text-base'>
                      <span className='flex size-8 items-center justify-center rounded-lg bg-blue-500/10'>
                        <Building2 className='size-4 text-blue-600 dark:text-blue-400' />
                      </span>
                      Vendor weight comparison
                    </CardTitle>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      Issued, returned, and lost carat across the highest-volume
                      vendors.
                    </p>
                  </div>
                  <Badge variant='secondary' className='text-[10px]'>
                    Top {vendorChartData.length} by volume
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className='p-5'>
                {vendorChartData.length === 0 ? (
                  <ChartEmptyState
                    icon={Building2}
                    title='No vendor data'
                    description='Vendor comparison will appear when records match the selected filters.'
                  />
                ) : (
                  <>
                    <div className='mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground'>
                      <span className='flex items-center gap-1.5'>
                        <span
                          className='size-2.5 rounded-sm'
                          style={{ backgroundColor: 'var(--chart-1)' }}
                        />{' '}
                        Issued
                      </span>
                      <span className='flex items-center gap-1.5'>
                        <span
                          className='size-2.5 rounded-sm'
                          style={{ backgroundColor: 'var(--chart-2)' }}
                        />{' '}
                        Returned
                      </span>
                      <span className='flex items-center gap-1.5'>
                        <span
                          className='size-2.5 rounded-sm'
                          style={{ backgroundColor: 'var(--chart-5)' }}
                        />{' '}
                        Loss
                      </span>
                    </div>
                    <ResponsiveContainer width='100%' height={310}>
                      <BarChart
                        data={vendorChartData}
                        layout='vertical'
                        margin={{ top: 0, right: 18, left: 6, bottom: 0 }}
                        barGap={3}
                      >
                        <CartesianGrid
                          strokeDasharray='3 3'
                          horizontal={false}
                          opacity={0.35}
                        />
                        <XAxis
                          type='number'
                          tickLine={false}
                          axisLine={false}
                          fontSize={10}
                          tickFormatter={(value) => `${value} CT`}
                        />
                        <YAxis
                          type='category'
                          dataKey='name'
                          width={92}
                          tickLine={false}
                          axisLine={false}
                          fontSize={11}
                        />
                        <Tooltip
                          content={<AnalyticsTooltip suffix=' CT' />}
                          cursor={{ fill: 'var(--muted)' }}
                        />
                        <Bar
                          dataKey='Issued Carat'
                          fill='var(--chart-1)'
                          radius={[0, 4, 4, 0]}
                        />
                        <Bar
                          dataKey='Returned Carat'
                          fill='var(--chart-2)'
                          radius={[0, 4, 4, 0]}
                        />
                        <Bar
                          dataKey='Loss Carat'
                          fill='var(--chart-5)'
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className='gap-0 overflow-hidden py-0 shadow-none'>
              <CardHeader className='border-b px-5 py-4!'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <CardTitle className='flex items-center gap-2 text-base'>
                      <span className='flex size-8 items-center justify-center rounded-lg bg-violet-500/10'>
                        <PieIcon className='size-4 text-violet-600 dark:text-violet-400' />
                      </span>
                      Yield quality mix
                    </CardTitle>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      Batch distribution by process-loss band.
                    </p>
                  </div>
                  <Badge variant='secondary' className='text-[10px]'>
                    {summary.totalLots} lots
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className='p-5'>
                {yieldDistribution.length === 0 ? (
                  <ChartEmptyState
                    icon={PieIcon}
                    title='No yield distribution'
                    description='Yield bands will appear when 4P records are available.'
                  />
                ) : (
                  <>
                    <div className='relative h-52'>
                      <ResponsiveContainer width='100%' height='100%'>
                        <PieChart>
                          <Pie
                            data={yieldDistribution}
                            cx='50%'
                            cy='50%'
                            innerRadius={58}
                            outerRadius={84}
                            paddingAngle={3}
                            dataKey='value'
                            stroke='transparent'
                          >
                            {yieldDistribution.map((item) => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={<AnalyticsTooltip suffix=' lots' />}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
                        <span className='text-2xl font-bold'>
                          {summary.totalLots}
                        </span>
                        <span className='text-[10px] tracking-wide text-muted-foreground uppercase'>
                          total lots
                        </span>
                      </div>
                    </div>
                    <div className='mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
                      {yieldDistribution.map((item) => (
                        <div
                          key={item.name}
                          className='flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2'
                        >
                          <div className='flex min-w-0 items-center gap-2'>
                            <span
                              className='size-2.5 shrink-0 rounded-full'
                              style={{ backgroundColor: item.color }}
                            />
                            <div className='min-w-0'>
                              <p className='truncate text-[11px] font-semibold'>
                                {item.name}
                              </p>
                              <p className='text-[9px] text-muted-foreground'>
                                {item.detail}
                              </p>
                            </div>
                          </div>
                          <span className='font-mono text-xs font-bold'>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className='grid gap-5 xl:grid-cols-3'>
            <Card className='gap-0 overflow-hidden py-0 shadow-none xl:col-span-2'>
              <CardHeader className='border-b px-5 py-4!'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <CardTitle className='flex items-center gap-2 text-base'>
                      <span className='flex size-8 items-center justify-center rounded-lg bg-rose-500/10'>
                        <TrendingUp className='size-4 text-rose-600 dark:text-rose-400' />
                      </span>
                      Process-loss trend
                    </CardTitle>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      Loss percentage across the latest completed returns.
                    </p>
                  </div>
                  <Badge variant='secondary' className='text-[10px]'>
                    Latest {trendData.length} returns
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className='p-5'>
                {trendData.length === 0 ? (
                  <ChartEmptyState
                    icon={TrendingUp}
                    title='No completed trend data'
                    description='The trend line will appear after at least one lot has been returned.'
                  />
                ) : (
                  <ResponsiveContainer width='100%' height={300}>
                    <AreaChart
                      data={trendData}
                      margin={{ top: 12, right: 12, left: -14, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id='lossGradient'
                          x1='0'
                          y1='0'
                          x2='0'
                          y2='1'
                        >
                          <stop
                            offset='5%'
                            stopColor='var(--chart-5)'
                            stopOpacity={0.3}
                          />
                          <stop
                            offset='95%'
                            stopColor='var(--chart-5)'
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray='3 3'
                        vertical={false}
                        opacity={0.35}
                      />
                      <XAxis
                        dataKey='date'
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        minTickGap={28}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip content={<AnalyticsTooltip suffix='%' />} />
                      <ReferenceLine
                        y={4}
                        stroke='var(--chart-4)'
                        strokeDasharray='5 5'
                        label={{
                          value: 'Target 4%',
                          position: 'insideTopRight',
                          fill: 'var(--muted-foreground)',
                          fontSize: 10,
                        }}
                      />
                      <Area
                        type='monotone'
                        dataKey='Loss %'
                        stroke='var(--chart-5)'
                        fill='url(#lossGradient)'
                        strokeWidth={2.5}
                        activeDot={{ r: 5, strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className='gap-0 overflow-hidden py-0 shadow-none'>
              <CardHeader className='border-b px-5 py-4!'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <CardTitle className='flex items-center gap-2 text-base'>
                      <span className='flex size-8 items-center justify-center rounded-lg bg-amber-500/10'>
                        <Award className='size-4 text-amber-600 dark:text-amber-400' />
                      </span>
                      Vendor yield leaderboard
                    </CardTitle>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      Ranked by lowest loss on completed work.
                    </p>
                  </div>
                  <Badge variant='secondary' className='shrink-0 text-[10px]'>
                    Top 5
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className='p-0'>
                {vendorLeaderboard.length === 0 ? (
                  <ChartEmptyState
                    icon={Award}
                    title='No vendor ranking yet'
                    description='Completed vendor returns are required to calculate yield rankings.'
                  />
                ) : (
                  <div className='divide-y'>
                    {vendorLeaderboard.map((vendor, index) => (
                      <div
                        key={vendor.vendorName}
                        className='space-y-2.5 px-5 py-3 transition-colors hover:bg-muted/20'
                      >
                        <div className='flex items-center justify-between gap-3'>
                          <div className='flex min-w-0 items-center gap-3'>
                            <span
                              className={cn(
                                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                                index === 0
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {index + 1}
                            </span>
                            <div className='min-w-0'>
                              <p className='truncate text-sm font-semibold'>
                                {vendor.vendorName}
                              </p>
                              <p className='text-[10px] text-muted-foreground'>
                                {vendor.completedLots} of {vendor.totalLots}{' '}
                                completed
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant='outline'
                            className={cn(
                              'shrink-0 text-[10px]',
                              vendor.lossPct <= 4
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : vendor.lossPct <= 6
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                  : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                            )}
                          >
                            {vendor.lossPct}% loss
                          </Badge>
                        </div>
                        <div className='flex items-center justify-between text-[10px] text-muted-foreground'>
                          <span>
                            Recovery{' '}
                            <strong className='text-emerald-600'>
                              {vendor.recoveryRate}%
                            </strong>
                          </span>
                          <span>
                            Loss{' '}
                            <strong className='text-rose-600'>
                              {formatCarat(vendor.lossCarat)} CT
                            </strong>
                          </span>
                        </div>
                        <div className='h-1.5 overflow-hidden rounded-full bg-rose-500/15'>
                          <div
                            className='h-full rounded-full bg-emerald-500'
                            style={{
                              width: `${Math.min(vendor.recoveryRate, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className='gap-0 overflow-hidden py-0 shadow-none'>
            <CardHeader className='border-b px-5 py-4!'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <span className='flex size-8 items-center justify-center rounded-lg bg-primary/10'>
                      <Scale className='size-4 text-primary' />
                    </span>
                    Lot-by-lot yield & carat variance
                  </CardTitle>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    The five latest matching process records, newest first.
                  </p>
                </div>
                <Badge variant='secondary' className='text-[10px]'>
                  Latest {latestProcesses.length} of {filteredProcesses.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='p-0'>
              {latestProcesses.length === 0 ? (
                <ChartEmptyState
                  icon={Scale}
                  title='No matching lots'
                  description='Adjust the report filters to see recent lot-level yield performance.'
                />
              ) : (
                <div className='divide-y'>
                  {latestProcesses.map((process, index) => {
                    const lossPercentage = process.processLossPercentage || 0
                    const isReturned = process.status === 'returned'
                    const recoveryPercentage = isReturned
                      ? Math.max(0, Math.min(100, 100 - lossPercentage))
                      : 0

                    return (
                      <div
                        key={process._id || process.id}
                        className='px-5 py-4 transition-colors hover:bg-muted/20'
                      >
                        <div className='grid gap-4 xl:grid-cols-[minmax(240px,1.2fr)_minmax(330px,1.5fr)_minmax(200px,0.8fr)] xl:items-center'>
                          <div className='flex min-w-0 items-start gap-3'>
                            <span className='flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary'>
                              {index + 1}
                            </span>
                            <div className='min-w-0'>
                              <div className='flex flex-wrap items-center gap-2'>
                                <h3 className='text-sm font-bold'>
                                  Lot {process.kapanNo}
                                </h3>
                                <Badge
                                  variant='outline'
                                  className={cn(
                                    'text-[10px]',
                                    process.status === 'in_process'
                                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                      : process.status === 'returned'
                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                        : 'border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300'
                                  )}
                                >
                                  {process.status === 'in_process'
                                    ? 'In 4P'
                                    : process.status === 'returned'
                                      ? 'Returned'
                                      : 'Cancelled'}
                                </Badge>
                              </div>
                              <p className='mt-0.5 truncate font-mono text-[10px] text-muted-foreground'>
                                {process.issueNo}
                              </p>
                              <p className='mt-1 truncate text-xs font-medium'>
                                {process.vendorName}
                                <span className='mx-1.5 text-muted-foreground'>
                                  /
                                </span>
                                <span className='font-normal text-muted-foreground'>
                                  {formatDate(process.issueDate)}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className='grid grid-cols-3 divide-x rounded-xl border bg-background/60 py-2.5 text-center'>
                            <div className='px-2'>
                              <p className='text-[9px] font-semibold tracking-wide text-muted-foreground uppercase'>
                                Issued
                              </p>
                              <p className='mt-0.5 font-mono text-xs font-bold'>
                                {formatCarat(process.issuedCarat)} CT
                              </p>
                              <p className='text-[9px] text-muted-foreground'>
                                {process.issuedPieces} pcs
                              </p>
                            </div>
                            <div className='px-2'>
                              <p className='text-[9px] font-semibold tracking-wide text-muted-foreground uppercase'>
                                Returned
                              </p>
                              <p className='mt-0.5 font-mono text-xs font-bold text-emerald-600'>
                                {process.returnedCarat !== null &&
                                process.returnedCarat !== undefined
                                  ? `${formatCarat(process.returnedCarat)} CT`
                                  : '-'}
                              </p>
                              <p className='text-[9px] text-muted-foreground'>
                                {process.returnedPieces !== null &&
                                process.returnedPieces !== undefined
                                  ? `${process.returnedPieces} pcs`
                                  : '-'}
                              </p>
                            </div>
                            <div className='px-2'>
                              <p className='text-[9px] font-semibold tracking-wide text-muted-foreground uppercase'>
                                Variance
                              </p>
                              <p className='mt-0.5 font-mono text-xs font-bold text-rose-600'>
                                {process.processLossCarat !== null &&
                                process.processLossCarat !== undefined
                                  ? `${formatCarat(process.processLossCarat)} CT`
                                  : '-'}
                              </p>
                              <p className='text-[9px] font-semibold'>
                                {isReturned
                                  ? `${lossPercentage}% loss`
                                  : 'Pending'}
                              </p>
                            </div>
                          </div>

                          <div className='space-y-2'>
                            <div className='flex items-center justify-between text-[10px]'>
                              <span className='text-muted-foreground'>
                                Yield recovery
                              </span>
                              <span
                                className={cn(
                                  isReturned
                                    ? 'font-bold text-emerald-600'
                                    : 'font-medium text-muted-foreground'
                                )}
                              >
                                {isReturned
                                  ? `${recoveryPercentage}%`
                                  : process.status === 'cancelled'
                                    ? 'Cancelled'
                                    : 'Awaiting return'}
                              </span>
                            </div>
                            <div className='flex h-2 overflow-hidden rounded-full bg-muted'>
                              <div
                                className='h-full bg-emerald-500 transition-all'
                                style={{ width: `${recoveryPercentage}%` }}
                              />
                              {isReturned && (
                                <div
                                  className='h-full bg-rose-500 transition-all'
                                  style={{
                                    width: `${Math.min(lossPercentage, 100)}%`,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}

export default SemiPolishReportPage
