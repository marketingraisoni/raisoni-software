import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AppWindow,
  Boxes,
  Clock,
  Gem,
  Layers3,
  LayoutDashboard,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { Search } from '@/components/search'
import {
  dashboardQueryKey,
  fetchDashboardData,
} from '@/services/dashboard-service'
import { Analytics } from './components/analytics'
import { Overview } from './components/overview'
import { RecentSales } from './components/recent-sales'
import { LotsReport } from './components/lots-report'
import { AssortmentReport } from './components/assortment-report'
import { SemiPolishReport } from './components/semi-polish-report'


function OverviewCustomTooltip({
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

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  const { data } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: ({ signal }) => fetchDashboardData(signal),
  })

  const metrics = data?.metrics

  const overviewCustomBarData = useMemo(() => {
    const rough = metrics?.totalCarat || 0
    const packet = metrics?.totalPacketCarat || 0
    const returned = metrics?.totalReturnedCarat || 0
    if (rough === 0 && packet === 0 && returned === 0) return []
    return [
      { name: 'Rough Inward', carats: rough, fill: '#3b82f6' },
      { name: 'Assorted Packets', carats: packet, fill: '#10b981' },
      { name: '4P Semi-Polish', carats: returned, fill: '#f59e0b' },
    ]
  }, [metrics])

  const overviewGaugesData = useMemo(() => {
    const yieldNum =
      typeof metrics?.overallYield === 'number'
        ? metrics.overallYield
        : parseFloat(String(metrics?.overallYield || '0')) || 0
    const totalCarat = metrics?.totalCarat || 0
    const packetCarat = metrics?.totalPacketCarat || 0
    const allocRatio = totalCarat > 0 ? Math.min(100, Math.round((packetCarat / totalCarat) * 100)) : 0
    const activeRatio = metrics?.totalLots ? Math.round(((metrics.activeLots || 0) / metrics.totalLots) * 100) : 0

    const items = [
      { name: '4P Recovery Yield', value: Math.min(100, Math.round(yieldNum)), fill: '#10b981' },
      { name: 'Assortment Allocation', value: allocRatio, fill: '#3b82f6' },
      { name: 'Active Lots Ratio', value: activeRatio, fill: '#f59e0b' },
    ]
    return items.filter((item) => item.value > 0)
  }, [metrics])

  const [focusedRadialKey, setFocusedRadialKey] = useState<string | null>(null)

  // 1. Straight Angle Pie Chart Data (Lot Management)
  const straightAngleLotsData = useMemo(() => {
    const active = metrics?.activeLots || 0
    const closed = metrics?.closedLots || 0
    if (active === 0 && closed === 0) return []
    return [
      { name: 'Active Lots', value: active, fill: '#3b82f6' },
      { name: 'Closed Lots', value: closed, fill: '#10b981' },
    ].filter((item) => item.value > 0)
  }, [metrics?.activeLots, metrics?.closedLots])

  // 2. Pie Chart with gap and rounded corners (Packet Creation)
  const roundedGapPieData = useMemo(() => {
    if (data?.assortmentAnalytics?.gradeDistribution && data.assortmentAnalytics.gradeDistribution.length > 0) {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
      return data.assortmentAnalytics.gradeDistribution
        .filter((g) => g.value > 0 || (g.count && g.count > 0))
        .map((g, idx) => ({
          name: g.name,
          value: g.value,
          packets: g.count || 0,
          fill: colors[idx % colors.length],
        }))
    }
    return []
  }, [data?.assortmentAnalytics?.gradeDistribution])

  // 3. Radial Bar Chart with Click to Focus Legend (4P Semi-Polish)
  const clickToFocusRadialData = useMemo(() => {
    const inProcess = metrics?.inProcessCount || 0
    const completed = metrics?.returnedProcessCount || 0
    const yieldNum = typeof metrics?.overallYield === 'number' ? metrics.overallYield : 0
    if (inProcess === 0 && completed === 0 && yieldNum === 0) return []
    return [
      {
        name: 'In Process',
        value: Math.min(100, inProcess * 10),
        labelValue: `${inProcess} Batches`,
        fill: '#f59e0b',
      },
      {
        name: 'Completed',
        value: Math.min(100, completed * 10),
        labelValue: `${completed} Done`,
        fill: '#10b981',
      },
      {
        name: 'Yield Rate',
        value: Math.min(100, Math.round(yieldNum)),
        labelValue: `${yieldNum}%`,
        fill: '#3b82f6',
      },
    ].filter((item) => item.value > 0)
  }, [metrics?.inProcessCount, metrics?.overallYield, metrics?.returnedProcessCount])

  const focusedClickToFocusRadialData = useMemo(() => {
    return clickToFocusRadialData.map((d) => ({
      ...d,
      fillOpacity: focusedRadialKey ? (focusedRadialKey === d.name ? 1 : 0.22) : 0.9,
    }))
  }, [clickToFocusRadialData, focusedRadialKey])

  // 4. Simple Radial Bar Chart (Plant Health)
  const simpleRadialData = useMemo(() => {
    const activeLotsRatio = metrics?.totalLots ? Math.round(((metrics.activeLots || 0) / metrics.totalLots) * 100) : 0
    const yieldNum = typeof metrics?.overallYield === 'number' ? Math.min(100, Math.round(metrics.overallYield)) : 0
    const allocRatio = metrics?.totalCarat ? Math.min(100, Math.round(((metrics.totalPacketCarat || 0) / metrics.totalCarat) * 100)) : 0

    const items = [
      { name: 'Active Lots Ratio', value: activeLotsRatio, fill: '#3b82f6' },
      { name: '4P Laser Recovery', value: yieldNum, fill: '#10b981' },
      { name: 'Assortment Yield', value: allocRatio, fill: '#f59e0b' },
    ]
    return items.filter((item) => item.value > 0)
  }, [metrics])

  const simpleRadialAvg = useMemo(() => {
    if (simpleRadialData.length === 0) return '0%'
    const avg = Math.round(simpleRadialData.reduce((acc, curr) => acc + curr.value, 0) / simpleRadialData.length)
    return `${avg}%`
  }, [simpleRadialData])


  return (
    <>
      {/* ===== Top Heading ===== */}
      <AppHeader leading={<TopNav links={topNav} className='me-auto' />}>
        <Search />
      </AppHeader>

      {/* ===== Main ===== */}
      <Main fluid={true} className='flex flex-1 flex-col'>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className='space-y-4'
        >
          {/* Top Tabbing: Main (Overall) and Category Wise Reports */}
          <div className='w-full overflow-x-auto pb-2'>
            <TabsList className='h-10'>
              <TabsTrigger value='overview' className='flex items-center gap-1.5 px-3'>
                <LayoutDashboard className='h-4 w-4' />
                Overall
              </TabsTrigger>
              <TabsTrigger value='lots' className='flex items-center gap-1.5 px-3'>
                <Boxes className='h-4 w-4' />
                Lot Management
              </TabsTrigger>
              <TabsTrigger value='assortment' className='flex items-center gap-1.5 px-3'>
                <Layers3 className='h-4 w-4' />
                Packet Creation
              </TabsTrigger>
              <TabsTrigger value='semi-polish' className='flex items-center gap-1.5 px-3'>
                <AppWindow className='h-4 w-4' />
                4P Semi-Polish
              </TabsTrigger>
              <TabsTrigger value='analytics' className='flex items-center gap-1.5 px-3'>
                <TrendingUp className='h-4 w-4' />
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ===== 1. Overall / Main Dashboard ===== */}
          <TabsContent value='overview' className='space-y-4'>
            {/* High-level KPI Cards */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Total Rough Carat
                  </CardTitle>
                  <Gem className='h-5 w-5 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {metrics ? `${metrics.totalCarat.toLocaleString()} Cts` : '—'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Total Pkt
                  </CardTitle>
                  <Boxes className='h-5 w-5 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {metrics ? `+${metrics.totalPieces.toLocaleString()} Pkt` : '—'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Assorted Packets
                  </CardTitle>
                  <Layers3 className='h-5 w-5 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {metrics ? `+${metrics.totalPackets.toLocaleString()}` : '—'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    4P In Process
                  </CardTitle>
                  <Clock className='h-5 w-5 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {metrics ? `+${metrics.inProcessCount}` : '—'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Production Intake Chart & Recent Lots */}
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='col-span-1 lg:col-span-4'>
                <CardHeader>
                  <CardTitle>Production Intake Overview</CardTitle>
                </CardHeader>
                <CardContent className='ps-2'>
                  <Overview data={data?.overviewChart} />
                </CardContent>
              </Card>
              <Card className='col-span-1 lg:col-span-3'>
                <CardHeader>
                  <CardTitle>Recent Lots</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentSales items={data?.recentSales} />
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Factory Production Pipeline + Operational Benchmarks */}
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='col-span-1 lg:col-span-4'>
                <CardHeader className='pb-2'>
                  <CardTitle>Factory Production Pipeline</CardTitle>
                </CardHeader>
                <CardContent className='ps-2'>
                  {overviewCustomBarData.length === 0 ? (
                    <div className='flex h-[280px] flex-col items-center justify-center text-center text-xs text-muted-foreground'>
                      <p className='font-medium text-sm'>No production carat flow recorded</p>
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width='100%' height={280}>
                          <BarChart
                            data={overviewCustomBarData}
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
                            <Tooltip content={<OverviewCustomTooltip suffix=' Cts' />} />
                            <Bar
                              dataKey='carats'
                              name='Volume'
                              shape={<CustomShapeBar />}
                              maxBarSize={64}
                              label={{
                                position: 'top',
                                fill: 'var(--muted-foreground)',
                                fontSize: 12,
                                formatter: (val: any) => `${Number(val).toLocaleString()} Cts`,
                              }}
                            >
                              {overviewCustomBarData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className='flex flex-wrap items-center justify-end gap-3 pt-2 text-xs text-muted-foreground'>
                          <span className='flex items-center gap-1'>
                            <span className='size-2 rounded-xs bg-[#3b82f6]' /> Rough Inward
                          </span>
                          <span className='flex items-center gap-1'>
                            <span className='size-2 rounded-xs bg-[#10b981]' /> Assorted Packets
                          </span>
                          <span className='flex items-center gap-1'>
                            <span className='size-2 rounded-xs bg-[#f59e0b]' /> 4P Semi-Polish
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

              <Card className='col-span-1 lg:col-span-3'>
                <CardHeader className='pb-2'>
                  <CardTitle>Plant Operational Attainment</CardTitle>
                </CardHeader>
                <CardContent>
                  {overviewGaugesData.length === 0 ? (
                    <div className='flex h-[240px] flex-col items-center justify-center text-center text-xs text-muted-foreground'>
                      <p className='font-medium text-sm'>No attainment gauges available</p>
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width='100%' height={240}>
                        <RadialBarChart
                          cx='50%'
                          cy='50%'
                          innerRadius='20%'
                          outerRadius='95%'
                          barSize={12}
                          data={overviewGaugesData}
                          startAngle={180}
                          endAngle={0}
                        >
                          <RadialBar
                            background={{ fill: 'currentColor', opacity: 0.08 }}
                            dataKey='value'
                            cornerRadius={6}
                          />
                          <Tooltip content={<OverviewCustomTooltip suffix='%' />} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div className='flex flex-wrap items-center justify-center gap-3 border-t border-border/60 pt-2.5 text-xs text-muted-foreground'>
                        {overviewGaugesData.map((item) => (
                          <span key={item.name} className='flex items-center gap-1.5'>
                            <span
                              className='size-2.5 shrink-0 rounded-full'
                              style={{ backgroundColor: item.fill }}
                            />
                            {item.name}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Category KPI Summary Charts Grid */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              {/* 1. Lot Management */}
              <Card className='flex flex-col justify-between'>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-base font-semibold flex items-center gap-2'>
                    <Boxes className='h-4 w-4 text-primary' />
                    Lot Inventory Status
                  </CardTitle>
                </CardHeader>
                <CardContent className='pt-0 pb-4 space-y-2'>
                  {straightAngleLotsData.length === 0 ? (
                    <div className='flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground'>
                      <p className='font-medium text-sm'>No lot inventory</p>
                    </div>
                  ) : (
                    <>
                      <div className='relative h-64 w-full'>
                        <ResponsiveContainer width='100%' height='100%'>
                          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                            <Pie
                              data={straightAngleLotsData}
                              dataKey='value'
                              nameKey='name'
                              cx='50%'
                              cy='80%'
                              startAngle={180}
                              endAngle={0}
                              innerRadius={75}
                              outerRadius={120}
                              paddingAngle={4}
                              cornerRadius={6}
                            >
                              {straightAngleLotsData.map((entry, index) => (
                                <Cell key={`lots-pie-${index}`} fill={entry.fill} stroke='transparent' />
                              ))}
                            </Pie>
                            <Tooltip content={<OverviewCustomTooltip suffix=' Lots' />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className='pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-center'>
                          <span className='text-3xl font-extrabold leading-none'>{metrics?.activeLots ?? 0}</span>
                          <span className='block text-xs font-medium text-muted-foreground mt-1'>Active Lots</span>
                        </div>
                      </div>
                      <div className='flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground'>
                        <span className='flex items-center gap-1.5'>
                          <span className='size-2.5 rounded-full bg-[#3b82f6]' /> Active
                        </span>
                        <span className='flex items-center gap-1.5'>
                          <span className='size-2.5 rounded-full bg-[#10b981]' /> Closed
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* 2. Packet Creation */}
              <Card className='flex flex-col justify-between'>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-base font-semibold flex items-center gap-2'>
                    <Layers3 className='h-4 w-4 text-primary' />
                    Packet Assortment Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className='pt-0 pb-4 space-y-2'>
                  {roundedGapPieData.length === 0 ? (
                    <div className='flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground'>
                      <p className='font-medium text-sm'>No packets recorded</p>
                    </div>
                  ) : (
                    <>
                      <div className='relative h-64 w-full'>
                        <ResponsiveContainer width='100%' height='100%'>
                          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                            <Pie
                              data={roundedGapPieData}
                              dataKey='value'
                              nameKey='name'
                              cx='50%'
                              cy='50%'
                              innerRadius={70}
                              outerRadius={110}
                              paddingAngle={6}
                              cornerRadius={6}
                            >
                              {roundedGapPieData.map((entry, index) => (
                                <Cell key={`packet-pie-${index}`} fill={entry.fill} stroke='transparent' />
                              ))}
                            </Pie>
                            <Tooltip content={<OverviewCustomTooltip suffix=' Cts' />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center'>
                          <span className='text-3xl font-extrabold leading-none'>{metrics?.totalPackets ?? 0}</span>
                          <span className='text-xs font-medium text-muted-foreground mt-1'>Packets</span>
                        </div>
                      </div>
                      <div className='flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-foreground'>
                        {roundedGapPieData.map((g) => (
                          <span key={g.name} className='flex items-center gap-1.5'>
                            <span className='size-2.5 rounded-full' style={{ backgroundColor: g.fill }} />
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* 3. 4P Semi-Polish */}
              <Card className='flex flex-col justify-between'>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-base font-semibold flex items-center gap-2'>
                    <AppWindow className='h-4 w-4 text-primary' />
                    4P Semi-Polish Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className='pt-0 pb-4 space-y-2'>
                  {clickToFocusRadialData.length === 0 ? (
                    <div className='flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground'>
                      <p className='font-medium text-sm'>No 4P batches in process</p>
                    </div>
                  ) : (
                    <>
                      <div className='relative h-64 w-full'>
                        <ResponsiveContainer width='100%' height='100%'>
                          <RadialBarChart
                            cx='50%'
                            cy='50%'
                            innerRadius='35%'
                            outerRadius='105%'
                            barSize={11}
                            data={focusedClickToFocusRadialData}
                            startAngle={90}
                            endAngle={-270}
                          >
                            <RadialBar
                              background={{ fill: 'hsl(var(--muted))', opacity: 0.25 }}
                              dataKey='value'
                              cornerRadius={6}
                              onClick={(entry) =>
                                setFocusedRadialKey((prev) => (prev === (entry.name as string) ? null : ((entry.name as string) || null)))
                              }
                              className='cursor-pointer'
                            />
                            <Tooltip content={<OverviewCustomTooltip suffix='%' />} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                        <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center'>
                          <span className='text-3xl font-extrabold leading-none'>
                            {metrics?.overallYield != null ? `${metrics.overallYield}%` : '0%'}
                          </span>
                          <span className='text-xs font-medium text-muted-foreground mt-1'>
                            {focusedRadialKey || 'Recovery Yield'}
                          </span>
                        </div>
                      </div>
                      <div className='flex flex-wrap items-center justify-center gap-2 pt-2 text-xs'>
                        {clickToFocusRadialData.map((item) => {
                          const isFocused = focusedRadialKey === item.name
                          return (
                            <button
                              key={item.name}
                              type='button'
                              onClick={() => setFocusedRadialKey(isFocused ? null : item.name)}
                              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all ${
                                isFocused
                                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs ring-2 ring-primary/40'
                                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              <span
                                className='size-2 rounded-full'
                                style={{ backgroundColor: isFocused ? '#ffffff' : item.fill }}
                              />
                              <span>{item.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* 4. Factory Operations */}
              <Card className='flex flex-col justify-between'>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-base font-semibold flex items-center gap-2'>
                    <Activity className='h-4 w-4 text-primary' />
                    Plant Operational Health
                  </CardTitle>
                </CardHeader>
                <CardContent className='pt-0 pb-4 space-y-2'>
                  {simpleRadialData.length === 0 ? (
                    <div className='flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground'>
                      <p className='font-medium text-sm'>No plant health data</p>
                    </div>
                  ) : (
                    <>
                      <div className='relative h-64 w-full'>
                        <ResponsiveContainer width='100%' height='100%'>
                          <RadialBarChart
                            cx='50%'
                            cy='50%'
                            innerRadius='32%'
                            outerRadius='102%'
                            barSize={10}
                            data={simpleRadialData}
                            startAngle={90}
                            endAngle={-270}
                          >
                            <RadialBar
                              background={{ fill: 'hsl(var(--muted))', opacity: 0.25 }}
                              dataKey='value'
                              cornerRadius={5}
                            />
                            <Tooltip content={<OverviewCustomTooltip suffix='%' />} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                        <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center'>
                          <span className='text-3xl font-extrabold leading-none'>{simpleRadialAvg}</span>
                          <span className='text-xs font-medium text-muted-foreground mt-1'>Health Index</span>
                        </div>
                      </div>
                      <div className='flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-foreground'>
                        {simpleRadialData.map((item) => (
                          <span key={item.name} className='flex items-center gap-1.5'>
                            <span className='size-2.5 rounded-full' style={{ backgroundColor: item.fill }} />
                            {item.name}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== 2. Lot Management Category Report ===== */}
          <TabsContent value='lots' className='space-y-4'>
            <LotsReport
              metrics={data?.metrics}
              recentLots={data?.recentLots || data?.recentSales}
              chartData={data?.overviewChart}
            />
          </TabsContent>

          {/* ===== 3. Packet Creation Category Report ===== */}
          <TabsContent value='assortment' className='space-y-4'>
            <AssortmentReport
              metrics={data?.metrics}
              assortmentData={data?.assortmentAnalytics}
            />
          </TabsContent>

          {/* ===== 4. 4P Semi-Polish Category Report ===== */}
          <TabsContent value='semi-polish' className='space-y-4'>
            <SemiPolishReport />
          </TabsContent>

          {/* ===== 5. Analytics ===== */}
          <TabsContent value='analytics' className='space-y-4'>
            <Analytics data={data?.analytics} metrics={data?.metrics} />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

const topNav = [
  {
    title: 'Overview',
    href: '/dashboard',
    isActive: true,
    disabled: false,
  },
  {
    title: 'All Lots',
    href: '/lots',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Packet Creation',
    href: '/packets',
    isActive: false,
    disabled: false,
  },
  {
    title: '4P Semi-Polish',
    href: '/semi-polish',
    isActive: false,
    disabled: false,
  },
]
