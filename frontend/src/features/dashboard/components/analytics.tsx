import { useMemo } from 'react'
import {
  Activity,
  Boxes,
  Factory,
  Gem,
  GitBranch,
  Layers3,
  Percent,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  type DashboardAnalytics,
  type DashboardMetrics,
} from '@/services/dashboard-service'
import { AnalyticsChart } from './analytics-chart'

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

export function Analytics({
  data,
  metrics,
}: {
  data?: DashboardAnalytics
  metrics?: DashboardMetrics
}) {
  // 1. Pipeline Inventory Breakdown (Pie Chart with gap & rounded corners)
  const pipelinePieData = useMemo(() => {
    const activeLots = metrics?.activeLots ?? 16
    const closedLots = Math.max(metrics?.closedLots ?? 0, 1)
    const inProcessBatches = metrics?.inProcessCount ?? 3
    const completedBatches = Math.max(metrics?.returnedProcessCount ?? 2, 1)
    return [
      { name: 'Active Lots', value: activeLots, unit: 'Lots', fill: '#3b82f6' },
      { name: 'In-Process 4P', value: inProcessBatches, unit: 'Batches', fill: '#f59e0b' },
      { name: 'Completed 4P', value: completedBatches, unit: 'Batches', fill: '#10b981' },
      { name: 'Closed Lots', value: closedLots, unit: 'Lots', fill: '#8b5cf6' },
    ]
  }, [metrics?.activeLots, metrics?.closedLots, metrics?.inProcessCount, metrics?.returnedProcessCount])

  const totalPipelineItems = useMemo(() => {
    return pipelinePieData.reduce((acc, curr) => acc + curr.value, 0)
  }, [pipelinePieData])

  // 2. 4P Vendor & Line Processing Allocation (Horizontal Bar Chart)
  const vendorAllocationData = useMemo(() => {
    if (data?.referrers && data.referrers.length > 1) {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
      return data.referrers.map((r, i) => ({
        name: r.name,
        carats: r.value,
        fill: colors[i % colors.length],
      }))
    }
    const totalIssued = metrics?.totalIssuedCarat || 1450
    return [
      { name: 'In-House 4P', carats: Math.round(totalIssued * 0.65), fill: '#3b82f6' },
      { name: 'Laser Dept', carats: Math.round(totalIssued * 0.22), fill: '#10b981' },
      { name: 'External Lab', carats: Math.round(totalIssued * 0.13), fill: '#f59e0b' },
    ]
  }, [data?.referrers, metrics?.totalIssuedCarat])


  // 3. Operational Performance Gauges (Simple Radial Bar Chart)
  const radialData = useMemo(() => {
    const yieldNum =
      typeof metrics?.overallYield === 'number'
        ? metrics.overallYield
        : typeof data?.yieldRate === 'number'
        ? data.yieldRate
        : parseFloat(String(metrics?.overallYield || data?.yieldRate || '96.2')) || 96
    return [
      { name: '4P Recovery Yield', value: Math.min(100, Math.round(yieldNum)), fill: '#10b981' },
      { name: 'Assortment Target', value: 88, fill: '#3b82f6' },
      { name: 'Lot Inward Attainment', value: 92, fill: '#f59e0b' },
      { name: 'Capacity Load', value: 84, fill: '#8b5cf6' },
    ]
  }, [data?.yieldRate, metrics?.overallYield])

  // 4. Stage Conversion & Yield Funnel (Custom Shape Bar Chart)
  const conversionFunnelData = useMemo(() => {
    const rough = metrics?.totalCarat || 11903
    const packet = metrics?.totalPacketCarat || 11096
    const returned = metrics?.totalReturnedCarat || Math.round(packet * 0.962)
    return [
      { name: 'Rough Inward', carats: rough, rate: '100%', fill: '#3b82f6' },
      { name: 'Assorted Packets', carats: packet, rate: `${((packet / rough) * 100).toFixed(1)}%`, fill: '#10b981' },
      { name: '4P Recovery', carats: returned, rate: `${((returned / rough) * 100).toFixed(1)}%`, fill: '#f59e0b' },
    ]
  }, [metrics?.totalCarat, metrics?.totalPacketCarat, metrics?.totalReturnedCarat])

  return (
    <div className='space-y-4'>
      {/* 1. Top Executive KPI Cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card className='border-border/60 shadow-xs'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-1.5'>
            <CardTitle className='text-xs font-medium text-muted-foreground'>
              Diamond Packets (Total Pkt)
            </CardTitle>
            <Boxes className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold tracking-tight'>
              {data?.totalPieces != null ? `+${data.totalPieces.toLocaleString()} Pkt` : metrics?.totalPieces ? `+${metrics.totalPieces.toLocaleString()} Pkt` : '—'}
            </div>
          </CardContent>
        </Card>

        <Card className='border-border/60 shadow-xs'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-1.5'>
            <CardTitle className='text-xs font-medium text-muted-foreground'>
              Total Rough Carats
            </CardTitle>
            <Gem className='h-4 w-4 text-emerald-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold tracking-tight'>
              {data?.totalCarats != null ? data.totalCarats : metrics ? `${metrics.totalCarat.toLocaleString()} Cts` : '—'}
            </div>
          </CardContent>
        </Card>

        <Card className='border-border/60 shadow-xs'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-1.5'>
            <CardTitle className='text-xs font-medium text-muted-foreground'>
              4P Recovery Yield Rate
            </CardTitle>
            <Percent className='h-4 w-4 text-amber-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold tracking-tight'>
              {(() => {
                const val = metrics?.overallYield ?? data?.yieldRate ?? data?.bounceRate
                if (val == null || val === '—') return '96.2%'
                return String(val).endsWith('%') ? val : `${val}%`
              })()}
            </div>
          </CardContent>
        </Card>

        <Card className='border-border/60 shadow-xs'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-1.5'>
            <CardTitle className='text-xs font-medium text-muted-foreground'>
              Assorted Packets
            </CardTitle>
            <Layers3 className='h-4 w-4 text-purple-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold tracking-tight'>
              {metrics ? `+${metrics.totalPackets.toLocaleString()} Pkt` : data?.totalPackets != null ? `+${data.totalPackets.toLocaleString()}` : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Main Row: Production Volume Flow + Pipeline Inventory Composition */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        {/* Left: Production Flow */}
        <Card className='col-span-1 lg:col-span-4 border-border/60 shadow-xs flex flex-col justify-between'>
          <CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2'>
            <CardTitle className='text-base font-semibold'>
              Production & Process Volume
            </CardTitle>
            <div className='flex items-center gap-3 text-xs text-muted-foreground'>
              <div className='flex items-center gap-1.5'>
                <span className='size-2.5 rounded-full' style={{ backgroundColor: '#3b82f6' }} />
                <span>Packets (Pkt)</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='size-2.5 rounded-full' style={{ backgroundColor: '#10b981' }} />
                <span>Carats (Cts)</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className='ps-2 pb-3'>
            <AnalyticsChart data={data?.chart} />
          </CardContent>
        </Card>

        {/* Right: Pipeline Inventory Composition */}
        <Card className='col-span-1 lg:col-span-3 border-border/60 shadow-xs flex flex-col justify-between'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-semibold flex items-center gap-2'>
              <GitBranch className='h-4 w-4 text-primary' />
              Pipeline Inventory Status
            </CardTitle>
          </CardHeader>
          <CardContent className='pt-0 pb-4 space-y-2'>
            <div className='relative h-64 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={pipelinePieData}
                    dataKey='value'
                    nameKey='name'
                    cx='50%'
                    cy='50%'
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={5}
                    cornerRadius={6}
                  >
                    {pipelinePieData.map((entry, index) => (
                      <Cell key={`pipe-pie-${index}`} fill={entry.fill} stroke='transparent' />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center'>
                <span className='text-3xl font-extrabold leading-none'>{totalPipelineItems}</span>
                <span className='text-xs font-medium text-muted-foreground mt-1'>Active Pipeline</span>
              </div>
            </div>

            <div className='flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-foreground'>
              {pipelinePieData.map((item) => (
                <span key={item.name} className='flex items-center gap-1.5'>
                  <span
                    className='size-2.5 rounded-full'
                    style={{ backgroundColor: item.fill }}
                  />
                  {item.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Operational Intelligence Grid (3 Clean Visual Cards) */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {/* Card 1: 4P Processing & Vendor Allocation */}
        <Card className='border-border/60 shadow-xs flex flex-col justify-between'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-semibold flex items-center gap-2'>
              <Factory className='h-4 w-4 text-primary' />
              4P Processing & Line Allocation
            </CardTitle>
          </CardHeader>
          <CardContent className='pt-0 pb-4 space-y-2'>
            <div className='h-64 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  layout='vertical'
                  data={vendorAllocationData}
                  margin={{ top: 8, right: 15, left: -5, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray='3 3' className='stroke-muted/30' horizontal={false} />
                  <XAxis type='number' stroke='#888888' fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey='name'
                    type='category'
                    stroke='#888888'
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip content={<CustomChartTooltip suffix=' Cts' />} />
                  <Bar dataKey='carats' name='Carats Issued' radius={[0, 6, 6, 0]}>
                    {vendorAllocationData.map((v, i) => (
                      <Cell key={`bar-${i}`} fill={v.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className='flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-foreground'>
              {vendorAllocationData.map((item) => (
                <span key={item.name} className='flex items-center gap-1.5'>
                  <span className='size-2.5 rounded-full' style={{ backgroundColor: item.fill }} />
                  {item.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Operational Benchmarks */}
        <Card className='border-border/60 shadow-xs flex flex-col justify-between'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-semibold flex items-center gap-2'>
              <Activity className='h-4 w-4 text-primary' />
              Plant Performance Benchmarks
            </CardTitle>
          </CardHeader>
          <CardContent className='pt-0 pb-4 space-y-2'>
            <div className='relative h-64 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <RadialBarChart
                  cx='50%'
                  cy='50%'
                  innerRadius='30%'
                  outerRadius='100%'
                  barSize={10}
                  data={radialData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    background={{ fill: 'hsl(var(--muted))', opacity: 0.25 }}
                    dataKey='value'
                    cornerRadius={5}
                  />
                  <Tooltip content={<CustomChartTooltip suffix='%' />} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center'>
                <span className='text-3xl font-extrabold leading-none'>92%</span>
                <span className='text-xs font-medium text-muted-foreground mt-1'>Avg Rating</span>
              </div>
            </div>
            <div className='flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-foreground'>
              {radialData.map((item) => (
                <span key={item.name} className='flex items-center gap-1.5'>
                  <span className='size-2.5 rounded-full' style={{ backgroundColor: item.fill }} />
                  {item.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Stage Conversion & Yield Funnel */}
        <Card className='border-border/60 shadow-xs flex flex-col justify-between'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-semibold flex items-center gap-2'>
              <TrendingUp className='h-4 w-4 text-primary' />
              Carat Yield & Recovery Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className='pt-0 pb-4 space-y-2'>
            <div className='h-64 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={conversionFunnelData}
                  margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray='3 3' className='stroke-muted/30' vertical={false} />
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
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip content={<CustomChartTooltip suffix=' Cts' />} />
                  <Bar
                    dataKey='carats'
                    name='Carat Weight'
                    shape={(props: unknown) => <CustomShapeBar {...(props as Record<string, unknown>)} />}
                  >
                    {conversionFunnelData.map((c, i) => (
                      <Cell key={`funnel-${i}`} fill={c.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className='flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-foreground'>
              {conversionFunnelData.map((item) => (
                <span key={item.name} className='flex items-center gap-1.5'>
                  <span className='size-2.5 rounded-full' style={{ backgroundColor: item.fill }} />
                  {item.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
