import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  CheckCircle2,
  Gem,
  Layers,
  Scale,
  Search,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCarat } from '@/lib/format-carat'
import { formatDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
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
import {
  fetchSemiPolishList,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import { SEMI_POLISH_PROCESS_STATUS } from '@/features/semi-polish/data/schema'

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
    payload?: any
  }>
  label?: string | number
  suffix?: string
}) {
  if (!active || !payload?.length) return null

  const rawItem = payload[0]?.payload
  const isLabelNumeric =
    typeof label === 'number' || (typeof label === 'string' && /^\d+$/.test(label.trim()))

  const headerTitle =
    (isLabelNumeric && rawItem?.name) ||
    (!label && rawItem?.name) ||
    rawItem?.name ||
    rawItem?.category ||
    rawItem?.stage ||
    rawItem?.label ||
    (typeof label === 'string' && !isLabelNumeric ? label : null) ||
    (label != null && label !== '' ? String(label) : null)

  return (
    <div className='min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl'>
      {headerTitle && (
        <p className='mb-1.5 border-b border-border pb-1 font-semibold text-foreground'>
          {headerTitle}
        </p>
      )}
      <div className='space-y-1.5'>
        {payload.map((entry, idx) => {
          const isGenericName =
            !entry.name ||
            entry.name.toLowerCase() === 'value' ||
            entry.name === headerTitle

          const seriesName = isGenericName
            ? suffix === '%'
              ? 'Attainment'
              : suffix.trim() === 'Cts' || suffix.trim() === 'CT'
              ? 'Carats'
              : suffix.trim() === 'Lots'
              ? 'Lots'
              : 'Value'
            : entry.name

          return (
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
                <span>{seriesName}</span>
              </span>
              <span className='font-mono font-semibold text-foreground'>
                {typeof entry.value === 'number'
                  ? entry.value.toLocaleString()
                  : entry.value}{' '}
                {suffix}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const getCustomShapePath = (x: number, y: number, width: number, height: number) => {
  if (width <= 0 || height <= 0) return ''
  return `M${x},${y + height}
    C${x + width / 3},${y + height} ${x + width / 2},${y + height / 3} ${x + width / 2},${y}
    C${x + width / 2},${y + height / 3} ${x + (2 * width) / 3},${y + height} ${x + width},${y + height}
    Z`
}

const CustomShapeBar = (props: {
  fill?: string
  x?: number
  y?: number
  width?: number
  height?: number
}) => {
  const { fill = '#3b82f6', x = 0, y = 0, width = 0, height = 0 } = props
  if (width <= 0 || height <= 0) return null

  return (
    <g>
      <path d={getCustomShapePath(x, y, width, height)} stroke='none' fill={fill} />
      <circle cx={x + width / 2} cy={y} r={3} fill='#ffffff' opacity={0.9} />
    </g>
  )
}

export function SemiPolishReport() {
  const [search, setSearch] = useState('')

  const { data: listData } = useQuery({
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
      (process) =>
        process.status === SEMI_POLISH_PROCESS_STATUS.IN_PROCESS
    ).length
    const completed = allProcesses.filter(
      (process) => process.status === SEMI_POLISH_PROCESS_STATUS.RETURNED
    )
    const completedLots = completed.length
    const cancelledLots = allProcesses.filter(
      (process) => process.status === SEMI_POLISH_PROCESS_STATUS.CANCELLED
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
    const totalIssuedPackets = allProcesses.reduce(
      (total, process) => total + (process.issuedPieces || 0),
      0
    )
    const totalReturnedPieces = completed.reduce(
      (total, process) => total + (process.returnedPieces || 0),
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
      totalIssuedPackets,
      totalReturnedPieces,
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
      if (process.status === SEMI_POLISH_PROCESS_STATUS.RETURNED) {
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
      .filter(
        (process) => process.status === SEMI_POLISH_PROCESS_STATUS.RETURNED
      )
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
      if (process.status === SEMI_POLISH_PROCESS_STATUS.RETURNED) {
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
      if (process.status === SEMI_POLISH_PROCESS_STATUS.IN_PROCESS) {
        inProcess += 1
      } else if (process.status === SEMI_POLISH_PROCESS_STATUS.CANCELLED) {
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

  const radialVendorData = useMemo(() => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']
    return vendorLeaderboard.map((item, idx) => ({
      name: item.name,
      value: item.value,
      fill: colors[idx % colors.length],
    }))
  }, [vendorLeaderboard])

  const vendorCustomBarData = useMemo(() => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899']
    return vendorChartData.map((v, idx) => ({
      name: v.name,
      carats: Math.round(v['Issued Carat']),
      fill: colors[idx % colors.length],
    }))
  }, [vendorChartData])

  const composedProcessData = useMemo(() => {
    return [...allProcesses]
      .filter((p) => p.status === SEMI_POLISH_PROCESS_STATUS.RETURNED)
      .sort(
        (a, b) =>
          new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
      )
      .slice(-8)
      .map((p) => {
        const issued = p.issuedCarat || 0
        const returned = p.returnedCarat || 0
        const yieldRate =
          issued > 0 ? Math.round((returned / issued) * 1000) / 10 : 0
        return {
          name: `Lot ${p.kapanNo}`,
          issuedCarat: issued,
          returnedCarat: returned,
          yieldRate,
        }
      })
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


  return (
    <div className='space-y-4'>
      <Tabs defaultValue='overview' className='space-y-4'>
        {/* Sub-tabs header */}
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='analytics'>Analytics</TabsTrigger>
            <TabsTrigger value='records'>Detailed Records</TabsTrigger>
          </TabsList>
        </div>

        {/* 1. OVERVIEW SUB-TAB */}
        <TabsContent value='overview' className='space-y-4'>
          {/* KPI Cards */}
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Total Batches</CardTitle>
                <Layers className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{summary.totalLots}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Issued Weight</CardTitle>
                <Gem className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {formatCarat(summary.totalIssuedCarat)} CT
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Returned Weight</CardTitle>
                <CheckCircle2 className='h-4 w-4 text-emerald-600' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {formatCarat(summary.totalReturnedCarat)} CT
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Process Loss</CardTitle>
                <Scale className='h-4 w-4 text-rose-500' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold text-rose-600 dark:text-rose-400'>
                  {formatCarat(summary.totalLossCarat)} CT
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Double Bar Chart + Recent 4P Activity */}
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
            <Card className='col-span-1 lg:col-span-4'>
              <CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2'>
                <CardTitle>Vendor Distribution</CardTitle>
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
                    No vendor process data available
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height={350}>
                    <BarChart
                      data={vendorChartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
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
                      const isInProcess =
                        process.status === SEMI_POLISH_PROCESS_STATUS.IN_PROCESS
                      const isReturned =
                        process.status === SEMI_POLISH_PROCESS_STATUS.RETURNED
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
                                {isInProcess ? (
                                  <span className='font-medium text-amber-600 dark:text-amber-400'>
                                    In Process
                                  </span>
                                ) : isReturned ? (
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

        {/* 2. ANALYTICS SUB-TAB */}
        <TabsContent value='analytics' className='space-y-4'>
          {/* Analytics KPI Row */}
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Yield Recovery Rate</CardTitle>
                <Gem className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{summary.yieldRate}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Mean Process Loss</CardTitle>
                <Scale className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{summary.avgLossPercentage}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Completion Rate</CardTitle>
                <CheckCircle2 className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{summary.completionRate}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>In Process</CardTitle>
                <Layers className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{summary.activeLots}</div>
              </CardContent>
            </Card>
          </div>

          {/* Row 1: Composed Chart (4 cols) + RadialBarChart Gauges (3 cols) */}
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
            <Card className='col-span-1 lg:col-span-4'>
              <CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2'>
                <CardTitle>4P Process Yield & Recovery</CardTitle>
                <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                  <div className='flex items-center gap-1.5'>
                    <span className='size-2.5 rounded-xs' style={{ backgroundColor: '#3b82f6' }} />
                    <span>Issued Carats</span>
                  </div>
                  <div className='flex items-center gap-1.5'>
                    <span className='size-2.5 rounded-xs' style={{ backgroundColor: '#10b981' }} />
                    <span>Returned Carats</span>
                  </div>
                  <div className='flex items-center gap-1.5'>
                    <span className='size-2.5 rounded-full' style={{ backgroundColor: '#f59e0b' }} />
                    <span>Yield %</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='ps-2'>
                {composedProcessData.length === 0 ? (
                  <div className='flex h-[300px] items-center justify-center text-sm text-muted-foreground'>
                    No returned process data available
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height={320}>
                    <ComposedChart
                      data={composedProcessData}
                      margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id='processAreaGrad' x1='0' y1='0' x2='0' y2='1'>
                          <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.3} />
                          <stop offset='95%' stopColor='#3b82f6' stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray='3 3' className='stroke-muted/40' vertical={false} />
                      <XAxis
                        dataKey='name'
                        stroke='#888888'
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId='left'
                        stroke='#888888'
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tickFormatter={(val: number) => val.toLocaleString()}
                      />
                      <YAxis
                        yAxisId='right'
                        orientation='right'
                        stroke='#888888'
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={42}
                        tickFormatter={(val: number) => `${val}%`}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        yAxisId='left'
                        type='monotone'
                        dataKey='issuedCarat'
                        name='Issued Carats (CT)'
                        fill='url(#processAreaGrad)'
                        stroke='#3b82f6'
                        strokeWidth={2}
                      />
                      <Bar
                        yAxisId='left'
                        dataKey='returnedCarat'
                        name='Returned Carats (CT)'
                        barSize={24}
                        fill='#10b981'
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId='right'
                        type='monotone'
                        dataKey='yieldRate'
                        name='Yield Rate %'
                        stroke='#f59e0b'
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* RadialBarChart (Vendor Recovery Yield Gauges) */}
            <Card className='col-span-1 lg:col-span-3'>
              <CardHeader className='pb-2'>
                <CardTitle>Vendor Recovery Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {radialVendorData.length === 0 ? (
                  <p className='text-xs text-muted-foreground p-8 text-center'>
                    No completed vendor returns available
                  </p>
                ) : (
                  <>
                    <ResponsiveContainer width='100%' height={250}>
                      <RadialBarChart
                        cx='50%'
                        cy='50%'
                        innerRadius='20%'
                        outerRadius='95%'
                        barSize={12}
                        data={radialVendorData}
                        startAngle={180}
                        endAngle={0}
                      >
                        <RadialBar
                          background={{ fill: 'currentColor', opacity: 0.08 }}
                          dataKey='value'
                          cornerRadius={6}
                        />
                        <Tooltip content={<ChartTooltip suffix='%' />} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className='grid grid-cols-2 gap-2 border-t border-border/60 pt-3'>
                      {radialVendorData.map((item) => (
                        <div key={item.name} className='flex items-center justify-between text-xs'>
                          <div className='flex items-center gap-1.5 truncate'>
                            <span
                              className='size-2.5 shrink-0 rounded-full'
                              style={{ backgroundColor: item.fill }}
                            />
                            <span className='truncate text-muted-foreground'>{item.name}</span>
                          </div>
                          <span className='font-semibold tabular-nums'>{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Custom Shape Bar Chart (4 cols) + Yield Quality Distribution (3 cols) */}
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
            {/* 4P Vendor Workload Allocation */}
            <Card className='col-span-1 lg:col-span-4'>
              <CardHeader className='pb-2'>
                <CardTitle>4P Vendor Workload Allocation</CardTitle>
              </CardHeader>
              <CardContent className='ps-2'>
                {vendorCustomBarData.length === 0 ? (
                  <p className='text-xs text-muted-foreground p-8 text-center'>
                    No vendor workload data available
                  </p>
                ) : (
                  <ResponsiveContainer width='100%' height={270}>
                    <BarChart
                      data={vendorCustomBarData}
                      margin={{ top: 22, right: 16, left: -6, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray='3 3' className='stroke-muted/40' vertical={false} />
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
                        tickFormatter={(val: number) => val.toLocaleString()}
                      />
                      <Tooltip content={<ChartTooltip suffix=' CT' />} />
                      <Bar
                        dataKey='carats'
                        name='Issued Carat'
                        shape={<CustomShapeBar />}
                        maxBarSize={56}
                        label={{
                          position: 'top',
                          fill: 'var(--muted-foreground)',
                          fontSize: 12,
                          formatter: (val: any) => `${val} CT`,
                        }}
                      >
                        {vendorCustomBarData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Quality Distribution Breakdown */}
            <Card className='col-span-1 lg:col-span-3'>
              <CardHeader>
                <CardTitle>Yield Quality Distribution</CardTitle>
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

          {/* Row 3: Process Loss Trend (4 cols) + Vendor Yield Leaderboard (3 cols) */}
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
            {/* Loss Trend Area Chart */}
            <Card className='col-span-1 lg:col-span-4'>
              <CardHeader>
                <CardTitle>Process Loss Trend</CardTitle>
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
                          id='dashLossTrendGradient'
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
                        fill='url(#dashLossTrendGradient)'
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Vendor Yield Leaderboard */}
            <Card className='col-span-1 lg:col-span-3'>
              <CardHeader>
                <CardTitle>Vendor Yield Leaderboard</CardTitle>
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
          </div>
        </TabsContent>

        {/* 3. DETAILED RECORDS SUB-TAB */}
        <TabsContent value='records' className='space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
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

          <div className='overflow-hidden rounded-md border bg-background'>
            {filteredTableRecords.length === 0 ? (
              <div className='flex h-48 items-center justify-center p-12 text-sm text-muted-foreground'>
                No records found matching your search.
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader className='bg-muted/50'>
                    <TableRow className='border-b'>
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
                      const isInProcess =
                        process.status === SEMI_POLISH_PROCESS_STATUS.IN_PROCESS
                      const isReturned =
                        process.status === SEMI_POLISH_PROCESS_STATUS.RETURNED

                      return (
                        <TableRow
                          key={process._id || process.id}
                          className='border-b hover:bg-muted/40 transition-colors'
                        >
                          <TableCell className='px-4 py-3 font-semibold text-sm'>
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
                              ({process.issuedPieces} Pkt)
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
                                isInProcess
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : isReturned
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300'
                              )}
                            >
                              {isInProcess
                                ? 'In Process'
                                : isReturned
                                  ? 'Completed'
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
  )
}
