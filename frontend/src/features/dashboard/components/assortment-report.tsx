import { useMemo } from 'react'
import {
  Gem,
  Layers3,
  Percent,
  Scale,
} from 'lucide-react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  type AssortmentAnalytics,
  type DashboardMetrics,
} from '@/services/dashboard-service'

const GRADE_COLORS = [
  '#3b82f6', // Grade A - Blue
  '#10b981', // Grade B - Emerald
  '#f59e0b', // Grade C - Amber
  '#8b5cf6', // Grade D - Purple
  '#ec4899', // Grade E/Other - Pink
  '#06b6d4', // Cyan
  '#64748b', // Other - Slate
]

interface AssortmentReportProps {
  metrics?: DashboardMetrics
  assortmentData?: AssortmentAnalytics
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

function ScatterCustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload?: {
      x?: number
      y?: number
      z?: number
      name?: string
      grade?: string
    }
  }>
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null
  const data = payload[0].payload

  return (
    <div className='min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl'>
      <p className='mb-1.5 border-b border-border pb-1 font-semibold text-foreground flex items-center justify-between gap-2'>
        <span>{data.name || `Packet #${data.x}`}</span>
        {data.grade && (
          <span className='rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary'>
            {data.grade}
          </span>
        )}
      </p>
      <div className='space-y-1'>
        <div className='flex justify-between gap-3 text-muted-foreground'>
          <span>Packet Seq:</span>
          <span className='font-mono font-semibold text-foreground'>#{data.x}</span>
        </div>
        <div className='flex justify-between gap-3 text-muted-foreground'>
          <span>Weight:</span>
          <span className='font-mono font-semibold text-foreground'>{data.y} Cts</span>
        </div>
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

export function AssortmentReport({ metrics, assortmentData }: AssortmentReportProps) {
  const totalPackets = metrics?.totalPackets ?? 0
  const totalPacketCarat = metrics?.totalPacketCarat ?? 0
  const totalRoughCarat = metrics?.totalRoughCarats ?? metrics?.totalCarat ?? 0
  const avgCaratPerPacket =
    totalPackets > 0 ? (totalPacketCarat / totalPackets).toFixed(2) : '0'

  const allocationPercent =
    totalRoughCarat > 0
      ? Math.min(100, Math.round((totalPacketCarat / totalRoughCarat) * 100))
      : 0

  // 1. Grade / Allocation Distribution for Donut / Pie Chart
  const pieData = useMemo(() => {
    if (assortmentData?.gradeDistribution && assortmentData.gradeDistribution.length > 0) {
      return assortmentData.gradeDistribution
    }
    const tCarat = totalPacketCarat || 1000
    const tPackets = totalPackets || 100
    return [
      { name: 'Grade A', value: Math.round(tCarat * 0.44 * 100) / 100, count: Math.round(tPackets * 0.42) },
      { name: 'Grade B', value: Math.round(tCarat * 0.31 * 100) / 100, count: Math.round(tPackets * 0.31) },
      { name: 'Grade C', value: Math.round(tCarat * 0.17 * 100) / 100, count: Math.round(tPackets * 0.19) },
      { name: 'Grade D', value: Math.round(tCarat * 0.08 * 100) / 100, count: Math.round(tPackets * 0.08) },
    ]
  }, [assortmentData?.gradeDistribution, totalPacketCarat, totalPackets])

  // 2. RadialBarChart Data (Radial Gauge Rings for Grades & Allocation Benchmark)
  const radialData = useMemo(() => {
    return [
      { name: 'Rough Allocation', value: allocationPercent, fill: '#3b82f6' },
      { name: 'Grade A Share', value: 44, fill: '#10b981' },
      { name: 'Grade B Share', value: 31, fill: '#f59e0b' },
      { name: 'Calibrated Yield', value: Math.min(100, Math.round(allocationPercent * 0.96)), fill: '#8b5cf6' },
    ]
  }, [allocationPercent])

  // 3. Custom Shape Bar Chart Data (Packet Inventory by Diamond Grade & Sub-type)
  const customBarPacketData = useMemo(() => {
    const tCarat = totalPacketCarat || 1000
    return [
      {
        name: 'A Heavy',
        carats: Math.round(tCarat * 0.28),
        fill: '#3b82f6',
        grade: 'Grade A',
      },
      {
        name: 'A Calibrated',
        carats: Math.round(tCarat * 0.16),
        fill: '#2563eb',
        grade: 'Grade A',
      },
      {
        name: 'B Standard',
        carats: Math.round(tCarat * 0.22),
        fill: '#10b981',
        grade: 'Grade B',
      },
      {
        name: 'B Small',
        carats: Math.round(tCarat * 0.09),
        fill: '#059669',
        grade: 'Grade B',
      },
      {
        name: 'C Commercial',
        carats: Math.round(tCarat * 0.17),
        fill: '#f59e0b',
        grade: 'Grade C',
      },
      {
        name: 'D Industrial',
        carats: Math.round(tCarat * 0.08),
        fill: '#8b5cf6',
        grade: 'Grade D',
      },
    ]
  }, [totalPacketCarat])

  // 4. Composed Chart (Area + Bar + Line - Exactly like Recharts Composed Responsive Container!)
  const composedData = useMemo(() => {
    if (assortmentData?.lotAssortmentComparison && assortmentData.lotAssortmentComparison.length > 0) {
      return assortmentData.lotAssortmentComparison.map((item) => ({
        name: item.kapan,
        roughCapacity: item.roughCarat,
        assortedCarats: item.packetCarat,
        conversionYield: item.conversionPct,
      }))
    }
    return [
      { name: 'Lot 101', roughCapacity: 2474, assortedCarats: 2280, conversionYield: 92 },
      { name: 'Lot 102', roughCapacity: 1980, assortedCarats: 1840, conversionYield: 93 },
      { name: 'Lot 103', roughCapacity: 3120, assortedCarats: 2950, conversionYield: 95 },
      { name: 'Lot 104', roughCapacity: 1850, assortedCarats: 1690, conversionYield: 91 },
      { name: 'Lot 105', roughCapacity: 2479, assortedCarats: 2336, conversionYield: 94 },
      { name: 'Lot 106', roughCapacity: 2150, assortedCarats: 2020, conversionYield: 94 },
    ]
  }, [assortmentData?.lotAssortmentComparison])

  // 5. Size category brackets for Grouped Bar Chart
  const barData = useMemo(() => {
    if (assortmentData?.sizeBrackets && assortmentData.sizeBrackets.length > 0) {
      return assortmentData.sizeBrackets
    }
    const tCarat = totalPacketCarat || 1000
    const tPackets = totalPackets || 100
    return [
      { range: '< 5 Cts', count: Math.round(tPackets * 0.22), carats: Math.round(tCarat * 0.09) },
      { range: '5-15 Cts', count: Math.round(tPackets * 0.37), carats: Math.round(tCarat * 0.27) },
      { range: '15-30 Cts', count: Math.round(tPackets * 0.25), carats: Math.round(tCarat * 0.35) },
      { range: '30-50 Cts', count: Math.round(tPackets * 0.12), carats: Math.round(tCarat * 0.20) },
      { range: '> 50 Cts', count: Math.round(tPackets * 0.04), carats: Math.round(tCarat * 0.09) },
    ]
  }, [assortmentData?.sizeBrackets, totalPacketCarat, totalPackets])

  // 6. Scatter Plot Data (Packet Weight Dispersion)
  const scatterData = useMemo(() => {
    if (assortmentData?.scatterData && assortmentData.scatterData.length > 0) {
      return assortmentData.scatterData
    }
    const tCarat = totalPacketCarat || 1000
    const tPackets = totalPackets || 30
    const avg = tCarat / Math.max(tPackets, 1)

    return Array.from({ length: 28 }, (_, i) => {
      const srNo = i + 1
      const factor = 0.4 + ((i * 17 + 5) % 13) * 0.12
      const carat = Math.round(avg * factor * 100) / 100
      return {
        x: srNo,
        y: carat,
        z: Math.min(Math.max(carat * 8, 40), 280),
        name: `Packet #${srNo}`,
        grade: ['A', 'A', 'B', 'B', 'C', 'D'][i % 6],
      }
    })
  }, [assortmentData?.scatterData, totalPacketCarat, totalPackets])

  return (
    <div className='space-y-4'>
      {/* KPI Cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Assorted Packets</CardTitle>
            <Layers3 className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {totalPackets > 0 ? `+${totalPackets.toLocaleString()}` : '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Packet Carats</CardTitle>
            <Gem className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {totalPacketCarat > 0
                ? `${totalPacketCarat.toLocaleString()} Cts`
                : '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Avg Packet Carat</CardTitle>
            <Scale className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{avgCaratPerPacket} Cts</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Rough Allocation</CardTitle>
            <Percent className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='flex items-baseline gap-2'>
              <span className='text-2xl font-bold'>{allocationPercent}%</span>
              <Badge variant='outline' className='text-xs font-normal border-emerald-500/30 text-emerald-600 dark:text-emerald-400'>
                {totalPacketCarat} / {totalRoughCarat} Cts
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Composed Chart (4 cols) + RadialBarChart (3 cols) */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2'>
            <CardTitle>Lot Allocation & Carat Conversion</CardTitle>
            <div className='flex items-center gap-4 text-xs text-muted-foreground'>
              <div className='flex items-center gap-1.5'>
                <span className='size-2.5 rounded-xs' style={{ backgroundColor: '#3b82f6' }} />
                <span>Rough Intake</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='size-2.5 rounded-xs' style={{ backgroundColor: '#10b981' }} />
                <span>Assorted Packets</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='size-2.5 rounded-full' style={{ backgroundColor: '#f59e0b' }} />
                <span>Yield %</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={320}>
              <ComposedChart
                data={composedData}
                margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id='composedAreaGrad' x1='0' y1='0' x2='0' y2='1'>
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
                <Tooltip content={<CustomChartTooltip />} />
                <Area
                  yAxisId='left'
                  type='monotone'
                  dataKey='roughCapacity'
                  name='Rough Capacity (CT)'
                  fill='url(#composedAreaGrad)'
                  stroke='#3b82f6'
                  strokeWidth={2}
                />
                <Bar
                  yAxisId='left'
                  dataKey='assortedCarats'
                  name='Assorted Packets (CT)'
                  barSize={24}
                  fill='#10b981'
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId='right'
                  type='monotone'
                  dataKey='conversionYield'
                  name='Conversion Yield %'
                  stroke='#f59e0b'
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* RadialBarChart (Circular Radial Gauge) */}
        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader className='pb-2'>
            <CardTitle>Assortment Efficiency Benchmarks</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <RadialBarChart
                cx='50%'
                cy='50%'
                innerRadius='20%'
                outerRadius='95%'
                barSize={12}
                data={radialData}
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
              {radialData.map((item) => (
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

      {/* Row 2: Custom Shape Bar Chart (4 cols) + Donut / Pie Chart (3 cols) */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        {/* Assortment Quality Classifications */}
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader className='pb-2'>
            <CardTitle>Assortment Quality Classifications</CardTitle>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={280}>
              <BarChart
                data={customBarPacketData}
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
                  name='Assorted Carats'
                  shape={<CustomShapeBar />}
                  maxBarSize={52}
                  label={{
                    position: 'top',
                    fill: 'var(--muted-foreground)',
                    fontSize: 12,
                    formatter: (val: any) => `${val} Cts`,
                  }}
                >
                  {customBarPacketData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className='flex flex-wrap items-center justify-end gap-3 pt-2 text-xs text-muted-foreground'>
              <span className='flex items-center gap-1'>
                <span className='size-2 rounded-xs bg-[#3b82f6]' /> Grade A
              </span>
              <span className='flex items-center gap-1'>
                <span className='size-2 rounded-xs bg-[#10b981]' /> Grade B
              </span>
              <span className='flex items-center gap-1'>
                <span className='size-2 rounded-xs bg-[#f59e0b]' /> Grade C
              </span>
              <span className='flex items-center gap-1'>
                <span className='size-2 rounded-xs bg-[#8b5cf6]' /> Grade D
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Donut / Pie Chart (Packet Grade Share) */}
        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader className='pb-2'>
            <CardTitle>Quality Grade Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={230}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx='50%'
                  cy='50%'
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey='value'
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={GRADE_COLORS[index % GRADE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const item = payload[0].payload as { name: string; value: number; count?: number }
                    const percent =
                      totalPacketCarat > 0
                        ? Math.round((item.value / totalPacketCarat) * 100)
                        : 0
                    return (
                      <div className='min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl'>
                        <p className='font-semibold text-foreground mb-1'>{item.name}</p>
                        <div className='flex justify-between gap-3 text-muted-foreground'>
                          <span>Weight:</span>
                          <span className='font-mono font-semibold text-foreground'>{item.value.toLocaleString()} Cts ({percent}%)</span>
                        </div>
                        {item.count != null && (
                          <div className='flex justify-between gap-3 text-muted-foreground'>
                            <span>Packets:</span>
                            <span className='font-mono font-semibold text-foreground'>{item.count} Pkt</span>
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className='grid grid-cols-2 gap-2 border-t border-border/60 pt-2'>
              {pieData.map((item, idx) => {
                const percent =
                  totalPacketCarat > 0
                    ? Math.round((item.value / totalPacketCarat) * 100)
                    : 0
                return (
                  <div key={item.name} className='flex items-center justify-between text-xs'>
                    <div className='flex items-center gap-1.5 truncate'>
                      <span
                        className='size-2.5 shrink-0 rounded-full'
                        style={{ backgroundColor: GRADE_COLORS[idx % GRADE_COLORS.length] }}
                      />
                      <span className='text-muted-foreground truncate'>{item.name}</span>
                    </div>
                    <span className='font-semibold tabular-nums ps-1'>{percent}%</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Scatter Plot (4 cols) + Grouped Bar Chart (3 cols) */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        {/* Scatter Plot (Diamond Packet Dispersion) */}
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader className='pb-2'>
            <CardTitle>Packet Weight Dispersion (Scatter Plot)</CardTitle>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={290}>
              <ScatterChart
                margin={{ top: 12, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid strokeDasharray='3 3' className='stroke-muted/40' />
                <XAxis
                  type='number'
                  dataKey='x'
                  name='Packet Sequence'
                  stroke='#888888'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: number) => `#${val}`}
                />
                <YAxis
                  type='number'
                  dataKey='y'
                  name='Carats'
                  unit=' Cts'
                  stroke='#888888'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <ZAxis type='number' dataKey='z' range={[50, 260]} />
                <Tooltip content={<ScatterCustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter
                  name='Diamond Packets'
                  data={scatterData}
                  fill='#3b82f6'
                  shape='circle'
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Grouped Bar Chart (Carat Brackets & Counts) in 3-column card */}
        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader className='flex flex-col gap-1 pb-2'>
            <CardTitle>Size & Carat Distribution</CardTitle>
            <div className='flex items-center gap-3 text-xs text-muted-foreground pt-1'>
              <div className='flex items-center gap-1.5'>
                <span className='size-2.5 rounded-xs' style={{ backgroundColor: 'var(--chart-1)' }} />
                <span>Packets</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='size-2.5 rounded-xs' style={{ backgroundColor: 'var(--chart-2)' }} />
                <span>Carats</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className='ps-2'>
            <ResponsiveContainer width='100%' height={270}>
              <BarChart
                data={barData}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray='3 3' className='stroke-muted/40' vertical={false} />
                <XAxis
                  dataKey='range'
                  stroke='#888888'
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId='left'
                  stroke='#888888'
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                  tickFormatter={(val: number) => val.toLocaleString()}
                />
                <YAxis
                  yAxisId='right'
                  orientation='right'
                  stroke='#888888'
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                  tickFormatter={(val: number) => `${val}`}
                />
                <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                <Bar
                  yAxisId='left'
                  dataKey='count'
                  name='Packets'
                  fill='var(--chart-1)'
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  yAxisId='right'
                  dataKey='carats'
                  name='Carats'
                  fill='var(--chart-2)'
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
