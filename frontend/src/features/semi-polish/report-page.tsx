import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  fetchSemiPolishList,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  Gem,
  Layers,
  RefreshCw,
  Scale,
  Search,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { formatCarat } from '@/lib/format-carat'
import { formatDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
const TREND_LIMIT = 10

function SimpleBarList({
  items,
  valueFormatter,
  barClass,
}: {
  items: { name: string; value: number }[]
  valueFormatter: (n: number) => string
  barClass: string
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className='space-y-3'>
      {items.map((i) => {
        const width = `${Math.round((i.value / max) * 100)}%`
        return (
          <li key={i.name} className='flex items-center justify-between gap-3'>
            <div className='min-w-0 flex-1'>
              <div className='mb-1 truncate text-xs text-muted-foreground'>
                {i.name}
              </div>
              <div className='h-2.5 w-full rounded-full bg-muted'>
                <div
                  className={`h-2.5 rounded-full ${barClass}`}
                  style={{ width }}
                />
              </div>
            </div>
            <div className='ps-2 text-xs font-medium tabular-nums'>
              {valueFormatter(i.value)}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = '',
}: {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number | string
    color?: string
    fill?: string
  }>
  label?: string | number
  suffix?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className='min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl'>
      {label && (
        <p className='mb-1.5 border-b border-border pb-1 font-semibold text-foreground'>
          {label}
        </p>
      )}
      <div className='space-y-1.5'>
        {payload.map((entry, idx) => (
          <div
            key={`tt-${idx}`}
            className='flex items-center justify-between gap-4'
          >
            <span className='flex items-center gap-1.5 text-muted-foreground'>
              <span
                className='size-2 shrink-0 rounded-full'
                style={{
                  backgroundColor: entry.color || entry.fill || 'var(--chart-1)',
                }}
              />
              <span>{entry.name}</span>
            </span>
            <span className='font-mono font-semibold text-foreground'>
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString()
                : entry.value}{' '}
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

  const {
    data: listData,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: semiPolishQueryKeys.list(REPORT_QUERY),
    queryFn: () => fetchSemiPolishList(REPORT_QUERY),
  })

  const allProcesses = useMemo(
    () => listData?.processes || [],
    [listData?.processes]
  )

  const latestProcesses = useMemo(
    () =>
      [...allProcesses]
        .sort(
          (a, b) =>
            new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
        )
        .slice(0, PREVIEW_LIMIT),
    [allProcesses]
  )

  const summary = useMemo(() => {
    const totalLots = allProcesses.length
    const activeLots = allProcesses.filter(
      (process) => process.status === 'in_process'
    ).length
    const completed = allProcesses.filter(
      (process) => process.status === 'returned'
    )
    const completedLots = completed.length
    const cancelledLots = allProcesses.filter(
      (process) => process.status === 'cancelled'
    ).length
    const totalIssuedCarat = allProcesses.reduce(
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
  }, [allProcesses])

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

    allProcesses.forEach((process) => {
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
  }, [allProcesses])

  const trendData = useMemo(() => {
    return [...allProcesses]
      .filter((process) => process.status === 'returned')
      .sort(
        (a, b) =>
          new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
      )
      .slice(-TREND_LIMIT)
      .map((process) => ({
        name: formatDate(process.issueDate),
        lossPct: process.processLossPercentage || 0,
        kapan: process.kapanNo,
      }))
  }, [allProcesses])

  const vendorLeaderboard = useMemo(() => {
    const vendorsByName = new Map<
      string,
      {
        name: string
        totalLots: number
        completedLots: number
        completedIssuedCarat: number
        returnedCarat: number
        lossCarat: number
      }
    >()

    allProcesses.forEach((process) => {
      const vendorName = process.vendorName || 'Vendor'
      const current = vendorsByName.get(vendorName) || {
        name: vendorName,
        totalLots: 0,
        completedLots: 0,
        completedIssuedCarat: 0,
        returnedCarat: 0,
        lossCarat: 0,
      }

      current.totalLots += 1
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
        return { name: vendor.name, value: recoveryRate }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [allProcesses])

  const yieldDistribution = useMemo(() => {
    let optimal = 0
    let standard = 0
    let high = 0
    let inProcess = 0
    let cancelled = 0

    allProcesses.forEach((process) => {
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
      { name: 'Optimal (<4% loss)', value: optimal },
      { name: 'Standard (4-6% loss)', value: standard },
      { name: 'High Loss (>6% loss)', value: high },
      { name: 'In Process', value: inProcess },
      { name: 'Cancelled', value: cancelled },
    ].filter((item) => item.value > 0)
  }, [allProcesses])

  const filteredTableRecords = useMemo(() => {
    if (!search.trim()) return allProcesses
    const term = search.trim().toLowerCase()
    return allProcesses.filter((process) => {
      return (
        process.kapanNo?.toLowerCase().includes(term) ||
        process.issueNo?.toLowerCase().includes(term) ||
        process.vendorName?.toLowerCase().includes(term)
      )
    })
  }, [allProcesses, search])

  const handleExportCSV = () => {
    if (!allProcesses.length) {
      toast.error('No records available to export')
      return
    }

    const headers = [
      'Kapan No',
      'Issue No',
      'Vendor',
      'Issue Date',
      'Issued Carat',
      'Issued Pcs',
      'Returned Carat',
      'Returned Pcs',
      'Loss Carat',
      'Loss %',
      'Status',
    ]

    const rows = filteredTableRecords.map((p) => [
      `"${p.kapanNo || ''}"`,
      `"${p.issueNo || ''}"`,
      `"${p.vendorName || ''}"`,
      `"${formatDate(p.issueDate)}"`,
      p.issuedCarat ?? '',
      p.issuedPieces ?? '',
      p.returnedCarat ?? '',
      p.returnedPieces ?? '',
      p.processLossCarat ?? '',
      p.processLossPercentage ?? '',
      `"${p.status || ''}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `4P_SemiPolish_Report_${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Report downloaded as CSV')
  }

  return (
    <>
      <AppHeader fixed />

      <Main fixed fluid className='flex flex-1 flex-col'>
        <div className='flex min-h-0 flex-1 flex-col max-sm:mb-16'>
          <div className='mb-3 flex shrink-0 items-center justify-between space-y-2'>
            <div>
              <h1 className='text-2xl font-bold tracking-tight'>4P Process Report</h1>
              <p className='text-xs text-muted-foreground'>
                Overall summary and yield performance across all 4P operations
              </p>
            </div>
            <div className='flex items-center space-x-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={isFetching}
                onClick={() => void refetch()}
                className='cursor-pointer gap-1.5'
              >
                <RefreshCw
                  className={cn('h-4 w-4', isFetching && 'animate-spin')}
                />
                Refresh
              </Button>
              <Button
                size='sm'
                onClick={handleExportCSV}
                className='cursor-pointer gap-1.5'
              >
                <Download className='h-4 w-4' />
                Download
              </Button>
            </div>
          </div>

          {isError && (
            <div className='mb-3 shrink-0 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive'>
              <span className='text-sm'>
                Failed to load analytics data. Please try refreshing.
              </span>
              <Button
                variant='outline'
                size='sm'
                onClick={() => void refetch()}
                className='cursor-pointer'
              >
                Try again
              </Button>
            </div>
          )}

          <Tabs
            defaultValue='overview'
            className='flex min-h-0 flex-1 flex-col space-y-3'
          >
            <div className='w-full shrink-0 overflow-x-auto pb-1'>
              <TabsList>
                <TabsTrigger value='overview'>Overview</TabsTrigger>
                <TabsTrigger value='analytics'>Analytics</TabsTrigger>
                <TabsTrigger value='reports'>Detailed Records</TabsTrigger>
              </TabsList>
            </div>

            {/* OVERVIEW TAB */}
            <TabsContent
              value='overview'
              className='flex-1 overflow-y-auto space-y-4 pb-4 data-[state=inactive]:hidden'
            >
            {/* KPI Cards Row (Dashboard Pattern) */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Total Batches
                  </CardTitle>
                  <Layers className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{summary.totalLots}</div>
                  <p className='text-xs text-muted-foreground'>
                    {summary.completedLots} completed, {summary.activeLots} active
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Issued Weight
                  </CardTitle>
                  <Gem className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {formatCarat(summary.totalIssuedCarat)} CT
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Total material sent to 4P
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Returned Weight
                  </CardTitle>
                  <CheckCircle2 className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {formatCarat(summary.totalReturnedCarat)} CT
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {summary.yieldRate}% overall recovery
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Process Loss
                  </CardTitle>
                  <Scale className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {formatCarat(summary.totalLossCarat)} CT
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {summary.avgLossPercentage}% average loss rate
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 7-Column Grid: Overview Bar Chart + Recent Activity */}
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='col-span-1 lg:col-span-4'>
                <CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2'>
                  <div>
                    <CardTitle>Vendor Distribution</CardTitle>
                    {/* <CardDescription>
                      Issued vs returned volume (CT) by vendor
                    </CardDescription> */}
                  </div>
                  <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                    <div className='flex items-center gap-1.5'>
                      <span
                        className='size-2.5 rounded-xs'
                        style={{ backgroundColor: 'var(--chart-1)' }}
                      />
                      <span>Issued (CT)</span>
                    </div>
                    <div className='flex items-center gap-1.5'>
                      <span
                        className='size-2.5 rounded-xs'
                        style={{ backgroundColor: 'var(--chart-2)' }}
                      />
                      <span>Returned (CT)</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className='ps-2'>
                  {vendorChartData.length === 0 ? (
                    <div className='flex h-[350px] items-center justify-center text-sm text-muted-foreground'>
                      No vendor data available
                    </div>
                  ) : (
                    <ResponsiveContainer width='100%' height={350}>
                      <BarChart data={vendorChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey='name'
                          stroke='#888888'
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke='#888888'
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          width={48}
                          tickFormatter={(value: number) => value.toLocaleString()}
                        />
                        <Tooltip
                          content={<ChartTooltip suffix=' CT' />}
                          cursor={{ fill: 'currentColor', opacity: 0.05 }}
                        />
                        <Bar
                          dataKey='Issued Carat'
                          fill='var(--chart-1)'
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey='Returned Carat'
                          fill='var(--chart-2)'
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className='col-span-1 lg:col-span-3'>
                <CardHeader>
                  <CardTitle>Recent 4P Activity</CardTitle>
                  {/* <CardDescription>
                    Latest {latestProcesses.length} process lots recorded
                  </CardDescription> */}
                </CardHeader>
                <CardContent>
                  {latestProcesses.length === 0 ? (
                    <div className='flex h-[350px] items-center justify-center text-sm text-muted-foreground'>
                      No recent activity
                    </div>
                  ) : (
                    <div className='space-y-6'>
                      {latestProcesses.map((process) => {
                        const vendorInitials =
                          process.vendorName?.slice(0, 2).toUpperCase() || '4P'
                        return (
                          <div
                            key={process._id || process.id}
                            className='flex items-center gap-4'
                          >
                            <Avatar className='h-9 w-9'>
                              <AvatarFallback className='text-xs font-semibold'>
                                {vendorInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div className='flex flex-1 flex-wrap items-center justify-between gap-1'>
                              <div className='space-y-1 min-w-0'>
                                <p className='text-sm leading-none font-medium truncate'>
                                  Lot {process.kapanNo}
                                </p>
                                <p className='text-xs text-muted-foreground truncate'>
                                  {process.vendorName} • {formatDate(process.issueDate)}
                                </p>
                              </div>
                              <div className='text-right'>
                                <div className='font-medium font-mono text-sm'>
                                  {formatCarat(process.issuedCarat)} CT
                                </div>
                                <div className='text-xs'>
                                  {process.status === 'in_process' ? (
                                    <span className='font-medium text-amber-600 dark:text-amber-400'>
                                      In Process
                                    </span>
                                  ) : process.status === 'returned' ? (
                                    <span className='font-medium text-emerald-600 dark:text-emerald-400'>
                                      {process.processLossPercentage}% loss
                                    </span>
                                  ) : (
                                    <span className='text-muted-foreground'>
                                      Cancelled
                                    </span>
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
          </TabsContent>

          {/* ANALYTICS TAB (Dashboard Analytics Component Pattern) */}
          <TabsContent
            value='analytics'
            className='flex-1 overflow-y-auto space-y-4 pb-4 data-[state=inactive]:hidden'
          >
            {/* Top Chart Card */}
            <Card>
              <CardHeader>
                <CardTitle>Process Loss Trend</CardTitle>
                <CardDescription>
                  Loss percentage across completed returns over time
                </CardDescription>
              </CardHeader>
              <CardContent className='px-6'>
                {trendData.length === 0 ? (
                  <div className='flex h-[300px] items-center justify-center text-sm text-muted-foreground'>
                    No completed return data available to display trend
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height={300}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient
                          id='lossTrendGradient'
                          x1='0'
                          y1='0'
                          x2='0'
                          y2='1'
                        >
                          <stop
                            offset='5%'
                            stopColor='var(--chart-1)'
                            stopOpacity={0.35}
                          />
                          <stop
                            offset='95%'
                            stopColor='var(--chart-1)'
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey='name'
                        stroke='#888888'
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke='#888888'
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        content={<ChartTooltip suffix='%' />}
                        cursor={{
                          stroke: 'currentColor',
                          strokeDasharray: '4 4',
                          opacity: 0.25,
                        }}
                      />
                      <Area
                        type='monotone'
                        dataKey='lossPct'
                        name='Loss Percentage'
                        stroke='var(--chart-1)'
                        strokeWidth={2}
                        fill='url(#lossTrendGradient)'
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Analytics KPI Row */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Yield Recovery Rate
                  </CardTitle>
                  <Gem className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{summary.yieldRate}%</div>
                  <p className='text-xs text-muted-foreground'>
                    {formatCarat(summary.totalReturnedCarat)} CT recovered
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Mean Process Loss
                  </CardTitle>
                  <Scale className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {summary.avgLossPercentage}%
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Target is ≤ 4.0%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Completion Rate
                  </CardTitle>
                  <CheckCircle2 className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {summary.completionRate}%
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {summary.completedLots} of {summary.totalLots} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Active in 4P
                  </CardTitle>
                  <Layers className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{summary.activeLots}</div>
                  <p className='text-xs text-muted-foreground'>
                    Lots currently with vendors
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Analytics 7-Column Grid */}
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='col-span-1 lg:col-span-4'>
                <CardHeader>
                  <CardTitle>Vendor Yield Performance</CardTitle>
                  <CardDescription>
                    Recovery rates across active vendors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {vendorLeaderboard.length === 0 ? (
                    <p className='text-xs text-muted-foreground'>
                      No completed vendor returns available
                    </p>
                  ) : (
                    <SimpleBarList
                      items={vendorLeaderboard}
                      barClass='bg-primary'
                      valueFormatter={(n) => `${n}%`}
                    />
                  )}
                </CardContent>
              </Card>

              <Card className='col-span-1 lg:col-span-3'>
                <CardHeader>
                  <CardTitle>Yield Quality Distribution</CardTitle>
                  <CardDescription>
                    Lot breakdown by process loss band
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {yieldDistribution.length === 0 ? (
                    <p className='text-xs text-muted-foreground'>
                      No distribution data available
                    </p>
                  ) : (
                    <SimpleBarList
                      items={yieldDistribution}
                      barClass='bg-muted-foreground'
                      valueFormatter={(n) => `${n} lots`}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* REPORTS / DETAILED RECORDS TAB */}
          <TabsContent
            value='reports'
            className='flex min-h-0 flex-1 flex-col space-y-3 pb-2 data-[state=inactive]:hidden'
          >
            <div className='flex shrink-0 flex-wrap items-center justify-between gap-3'>
              <div className='relative w-72 max-w-sm'>
                <Search className='absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Filter by lot, issue no, vendor...'
                  className='h-8 bg-background ps-9 text-sm'
                />
              </div>
              <div className='text-xs font-medium text-muted-foreground'>
                Showing {filteredTableRecords.length} of {allProcesses.length} records
              </div>
            </div>

            <div className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-background'>
              {filteredTableRecords.length === 0 ? (
                <div className='flex h-full items-center justify-center p-12 text-sm text-muted-foreground'>
                  No records found matching your search.
                </div>
              ) : (
                <div className='min-h-0 flex-1 overflow-auto'>
                  <Table>
                    <TableHeader className='sticky top-0 z-10 bg-muted/90 backdrop-blur-xs'>
                      <TableRow className='border-b hover:bg-transparent'>
                        <TableHead className='h-10 px-4 text-left font-medium text-muted-foreground text-sm'>
                          Lot (Kapan)
                        </TableHead>
                        <TableHead className='h-10 px-4 text-left font-medium text-muted-foreground text-sm'>
                          Issue No
                        </TableHead>
                        <TableHead className='h-10 px-4 text-left font-medium text-muted-foreground text-sm'>
                          4P Vendor
                        </TableHead>
                        <TableHead className='h-10 px-4 text-left font-medium text-muted-foreground text-sm'>
                          Issue Date
                        </TableHead>
                        <TableHead className='h-10 px-4 text-left font-medium text-muted-foreground text-sm'>
                          Issued Wt
                        </TableHead>
                        <TableHead className='h-10 px-4 text-left font-medium text-muted-foreground text-sm'>
                          Returned Wt
                        </TableHead>
                        <TableHead className='h-10 px-4 text-left font-medium text-muted-foreground text-sm'>
                          Process Loss
                        </TableHead>
                        <TableHead className='h-10 px-4 text-center font-medium text-muted-foreground text-sm'>
                          Status
                        </TableHead>
                        <TableHead className='h-10 px-4 text-right font-medium text-muted-foreground text-sm pe-4'>
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTableRecords.map((process) => {
                        const isReturned = process.status === 'returned'
                        return (
                          <TableRow
                            key={process._id || process.id}
                            className='border-b transition-colors hover:bg-muted/50'
                          >
                            <TableCell className='px-4 py-3 font-semibold text-foreground text-sm'>
                              {process.kapanNo}
                            </TableCell>
                            <TableCell className='px-4 py-3 font-mono font-medium text-primary text-sm'>
                              {process.issueNo}
                            </TableCell>
                            <TableCell className='px-4 py-3 font-medium text-foreground text-sm'>
                              {process.vendorName}
                            </TableCell>
                            <TableCell className='px-4 py-3 text-muted-foreground text-sm'>
                              {formatDate(process.issueDate)}
                            </TableCell>
                            <TableCell className='px-4 py-3 text-left font-medium text-sm'>
                              <span className='font-semibold text-primary'>
                                {formatCarat(process.issuedCarat)} CT
                              </span>{' '}
                              <span className='text-muted-foreground font-normal'>
                                ({process.issuedPieces} pcs)
                              </span>
                            </TableCell>
                            <TableCell className='px-4 py-3 text-left font-medium text-sm'>
                              {isReturned ? (
                                <>
                                  <span className='font-semibold text-foreground'>
                                    {formatCarat(process.returnedCarat ?? 0)} CT
                                  </span>{' '}
                                  <span className='text-muted-foreground font-normal'>
                                    ({process.returnedPieces} pcs)
                                  </span>
                                </>
                              ) : (
                                <span className='text-muted-foreground font-normal'>-</span>
                              )}
                            </TableCell>
                            <TableCell className='px-4 py-3 text-left text-sm'>
                              {isReturned ? (
                                <span
                                  className={cn(
                                    'font-semibold font-mono',
                                    (process.processLossPercentage || 0) > 6
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : (process.processLossPercentage || 0) > 4
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                  )}
                                >
                                  {formatCarat(process.processLossCarat ?? 0)} CT ({process.processLossPercentage ?? 0}%)
                                </span>
                              ) : (
                                <span className='text-muted-foreground'>-</span>
                              )}
                            </TableCell>
                            <TableCell className='px-4 py-3 text-center'>
                              <Badge
                                variant='outline'
                                className={cn(
                                  'font-medium text-xs',
                                  process.status === 'in_process'
                                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : process.status === 'returned'
                                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : 'border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300'
                                )}
                              >
                                {process.status === 'in_process'
                                  ? 'In 4P Process'
                                  : process.status === 'returned'
                                    ? 'Returned'
                                    : 'Cancelled'}
                              </Badge>
                            </TableCell>
                            <TableCell className='px-4 py-3 text-right pe-4'>
                              <Button
                                variant='ghost'
                                size='sm'
                                asChild
                                className='h-8 px-2 font-medium text-primary hover:text-primary cursor-pointer'
                              >
                                <Link
                                  to='/semi-polish/$processId'
                                  params={{
                                    processId: (process._id ||
                                      process.id) as string,
                                  }}
                                >
                                  View
                                  <ArrowUpRight className='ms-1 size-3.5' />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Main>
    </>
  )
}

export default SemiPolishReportPage
