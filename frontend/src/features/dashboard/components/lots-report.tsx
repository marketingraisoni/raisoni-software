import { useMemo } from 'react'
import {
  Boxes,
  CheckCircle2,
  Clock,
  Gem,
} from 'lucide-react'
import {
  Area,
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
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  type DashboardMetrics,
  type OverviewChartPoint,
  type RecentSaleItem,
} from '@/services/dashboard-service'
import { RecentSales } from './recent-sales'

interface LotsReportProps {
  metrics?: DashboardMetrics
  recentLots?: RecentSaleItem[]
  chartData?: OverviewChartPoint[]
}

function CustomChartTooltip({
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

export function LotsReport({ metrics, recentLots, chartData }: LotsReportProps) {
  const totalLots = metrics?.totalLots ?? 0
  const activeLots = metrics?.activeLots ?? 0
  const closedLots = metrics?.closedLots ?? 0
  const totalCarat = metrics?.totalRoughCarats ?? metrics?.totalCarat ?? 0
  const totalPieces = metrics?.totalPieces ?? 0
  const activeRatio = totalLots > 0 ? Math.round((activeLots / totalLots) * 100) : 0
  const closedRatio = totalLots > 0 ? Math.round((closedLots / totalLots) * 100) : 0

  // 1. RadialBarChart Data for Lot Lifecycle Gauges
  const radialLotsData = useMemo(() => {
    return [
      { name: 'Active Lots Ratio', value: activeRatio, fill: '#3b82f6' },
      { name: 'Closed Lots Ratio', value: closedRatio, fill: '#10b981' },
      {
        name: 'Rough Inward Target',
        value: Math.min(100, Math.round((totalCarat / 15000) * 100)),
        fill: '#f59e0b',
      },
      { name: 'Pieces Capacity', value: 85, fill: '#8b5cf6' },
    ]
  }, [activeRatio, closedRatio, totalCarat])

  // 2. Custom Shape Bar Chart Data: Kapan Lots by Rough Carat
  const customBarLotsData = useMemo(() => {
    if (recentLots && recentLots.length > 0) {
      return recentLots.map((lot, idx) => {
        const carats = parseInt(lot.amount.replace(/[^0-9]/g, ''), 10) || 1500
        const isActive = lot.detail.includes('Active')
        return {
          name: lot.name,
          carats,
          fill: isActive
            ? ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'][idx % 6]
            : '#64748b',
          status: isActive ? 'Active' : 'Closed',
        }
      })
    }
    return [
      { name: 'Kapan 101', carats: 2474, fill: '#3b82f6', status: 'Active' },
      { name: 'Kapan 102', carats: 1980, fill: '#10b981', status: 'Active' },
      { name: 'Kapan 103', carats: 3120, fill: '#2563eb', status: 'Active' },
      { name: 'Kapan 104', carats: 1850, fill: '#64748b', status: 'Closed' },
      { name: 'Kapan 105', carats: 2479, fill: '#f59e0b', status: 'Active' },
    ]
  }, [recentLots])

  // 3. Composed Chart Data (Area + Bar + Line) for Monthly Inward Trends
  const composedMonthlyData = useMemo(() => {
    if (!chartData || chartData.length === 0) return []
    return chartData.map((item) => {
      const pieces = item.pieces || Math.round(item.total * 0.06)
      const avgPcsSize = pieces > 0 ? Math.round((item.total / pieces) * 10) / 10 : 0
      return {
        name: item.name,
        roughCarat: item.total,
        totalPieces: pieces,
        avgPcsSize,
      }
    })
  }, [chartData])

  return (
    <div className='space-y-4'>
      {/* KPI Cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Rough Carat</CardTitle>
            <Gem className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {totalCarat > 0 ? `${totalCarat.toLocaleString()} Cts` : '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Rough Pkt</CardTitle>
            <Boxes className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {totalPieces > 0 ? `+${totalPieces.toLocaleString()} Pkt` : '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active Lots</CardTitle>
            <Clock className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='flex items-baseline gap-2'>
              <span className='text-2xl font-bold'>{activeLots}</span>
              <Badge variant='outline' className='text-xs font-normal border-amber-500/30 text-amber-600 dark:text-amber-400'>
                {activeRatio}% of total
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Closed Lots</CardTitle>
            <CheckCircle2 className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{closedLots}</div>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Composed Chart (4 cols) + Recent Lots Inward Feed (3 cols) */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2'>
            <CardTitle>Rough Inward Monthly Production</CardTitle>
            <div className='flex items-center gap-4 text-xs text-muted-foreground'>
              <div className='flex items-center gap-1.5'>
                <span className='size-2.5 rounded-xs' style={{ backgroundColor: '#3b82f6' }} />
                <span>Rough Carats</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='size-2.5 rounded-xs' style={{ backgroundColor: '#10b981' }} />
                <span>Piece Count</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='size-2.5 rounded-full' style={{ backgroundColor: '#f59e0b' }} />
                <span>Avg Cts/Piece</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={340}>
              <ComposedChart
                data={composedMonthlyData}
                margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id='lotsAreaGrad' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.35} />
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
                  width={38}
                  tickFormatter={(val: number) => `${val}`}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Area
                  yAxisId='left'
                  type='monotone'
                  dataKey='roughCarat'
                  name='Rough Carats (CT)'
                  fill='url(#lotsAreaGrad)'
                  stroke='#3b82f6'
                  strokeWidth={2}
                />
                <Bar
                  yAxisId='left'
                  dataKey='totalPieces'
                  name='Inward Pieces'
                  barSize={20}
                  fill='#10b981'
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId='right'
                  type='monotone'
                  dataKey='avgPcsSize'
                  name='Avg Cts / Piece'
                  stroke='#f59e0b'
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f59e0b' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Lots Feed in balanced 3-col card */}
        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader>
            <CardTitle>Recent Lots Inward</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentSales items={recentLots} />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Custom Shape Bar Chart (4 cols) + RadialBarChart Gauges (3 cols) */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        {/* Rough Inventory Volume by Kapan */}
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader className='pb-2'>
            <CardTitle>Rough Inventory by Kapan Lot</CardTitle>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={270}>
              <BarChart
                data={customBarLotsData}
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
                <Tooltip content={<CustomChartTooltip suffix=' Cts' />} />
                <Bar
                  dataKey='carats'
                  name='Rough Carats'
                  shape={<CustomShapeBar />}
                  maxBarSize={56}
                  label={{
                    position: 'top',
                    fill: 'var(--muted-foreground)',
                    fontSize: 12,
                    formatter: (val: any) => `${val} Cts`,
                  }}
                >
                  {customBarLotsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className='flex flex-wrap items-center justify-end gap-3 pt-2 text-xs text-muted-foreground'>
              <span className='flex items-center gap-1'>
                <span className='size-2 rounded-xs bg-[#3b82f6]' /> Active Lots
              </span>
              <span className='flex items-center gap-1'>
                <span className='size-2 rounded-xs bg-[#64748b]' /> Closed Lots
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Lot Pipeline Distribution */}
        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader className='pb-2'>
            <CardTitle>Lot Pipeline Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <RadialBarChart
                cx='50%'
                cy='50%'
                innerRadius='20%'
                outerRadius='95%'
                barSize={12}
                data={radialLotsData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar
                  background={{ fill: 'currentColor', opacity: 0.08 }}
                  dataKey='value'
                  cornerRadius={6}
                />
                <Tooltip content={<CustomChartTooltip suffix='%' />} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className='grid grid-cols-2 gap-2 border-t border-border/60 pt-3'>
              {radialLotsData.map((item) => (
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
