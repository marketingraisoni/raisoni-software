import { useMemo } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { type OverviewChartPoint } from '@/services/dashboard-service'

const defaultData: OverviewChartPoint[] = [
  { name: 'Jan', total: 0, pieces: 0 },
  { name: 'Feb', total: 0, pieces: 0 },
  { name: 'Mar', total: 0, pieces: 0 },
  { name: 'Apr', total: 0, pieces: 0 },
  { name: 'May', total: 0, pieces: 0 },
  { name: 'Jun', total: 0, pieces: 0 },
  { name: 'Jul', total: 0, pieces: 0 },
  { name: 'Aug', total: 0, pieces: 0 },
  { name: 'Sep', total: 0, pieces: 0 },
  { name: 'Oct', total: 0, pieces: 0 },
  { name: 'Nov', total: 0, pieces: 0 },
  { name: 'Dec', total: 0, pieces: 0 },
]

function OverviewTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number | string
    color?: string
  }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null

  const rawItem = (payload[0] as any)?.payload
  const headerTitle = rawItem?.name || label

  return (
    <div className='min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl'>
      {headerTitle && (
        <p className='mb-1.5 border-b border-border pb-1 font-semibold text-foreground'>
          {headerTitle} Production
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
                  backgroundColor: entry.color || 'var(--chart-1)',
                }}
              />
              <span>{entry.name}</span>
            </span>
            <span className='font-mono font-semibold text-foreground'>
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString()
                : entry.value}{' '}
              {entry.name?.includes('Carat') ? 'Cts' : entry.name?.includes('Density') ? 'Cts/Pkt' : 'Pkt'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Overview({ data }: { data?: OverviewChartPoint[] }) {
  const chartData = useMemo(() => {
    const raw = data && data.length > 0 ? data : defaultData
    return raw.map((item) => {
      const pieces = item.pieces || Math.round(item.total * 0.06)
      const avgDensity = pieces > 0 ? Math.round((item.total / pieces) * 10) / 10 : 0
      return {
        name: item.name,
        roughCarat: item.total,
        totalPieces: pieces,
        avgDensity,
      }
    })
  }, [data])

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-end gap-4 text-xs text-muted-foreground px-2'>
        <div className='flex items-center gap-1.5'>
          <span className='size-2.5 rounded-xs' style={{ backgroundColor: '#3b82f6' }} />
          <span>Rough Carats (Area)</span>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='size-2.5 rounded-xs' style={{ backgroundColor: '#10b981' }} />
          <span>Pkt Count (Bar)</span>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='size-2.5 rounded-full' style={{ backgroundColor: '#f59e0b' }} />
          <span>Density (Line)</span>
        </div>
      </div>
      <ResponsiveContainer width='100%' height={340}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id='overviewAreaGrad' x1='0' y1='0' x2='0' y2='1'>
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
            tickFormatter={(value) => `${value.toLocaleString()}`}
          />
          <YAxis
            yAxisId='right'
            orientation='right'
            stroke='#888888'
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={38}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip content={<OverviewTooltip />} />
          <Area
            yAxisId='left'
            type='monotone'
            dataKey='roughCarat'
            name='Rough Carats'
            stroke='#3b82f6'
            strokeWidth={2}
            fill='url(#overviewAreaGrad)'
          />
          <Bar
            yAxisId='left'
            dataKey='totalPieces'
            name='Pkt Count'
            barSize={20}
            fill='#10b981'
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId='right'
            type='monotone'
            dataKey='avgDensity'
            name='Avg Density'
            stroke='#f59e0b'
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#f59e0b' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

