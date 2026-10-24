import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { type AnalyticsChartPoint } from '@/services/dashboard-service'

const defaultData = [
  { name: 'Mon', clicks: 120, uniques: 80 },
  { name: 'Tue', clicks: 140, uniques: 90 },
  { name: 'Wed', clicks: 180, uniques: 110 },
  { name: 'Thu', clicks: 160, uniques: 105 },
  { name: 'Fri', clicks: 210, uniques: 130 },
  { name: 'Sat', clicks: 190, uniques: 120 },
  { name: 'Sun', clicks: 150, uniques: 95 },
]

function AnalyticsCustomTooltip({
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
  const isLabelNumeric =
    typeof label === 'number' || (typeof label === 'string' && /^\d+$/.test(label.trim()))
  const headerTitle =
    (isLabelNumeric && rawItem?.name) ||
    rawItem?.name ||
    rawItem?.month ||
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
              {entry.name?.includes('Carat') ? 'Cts' : 'Pkt'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnalyticsChart({ data }: { data?: AnalyticsChartPoint[] }) {
  const chartData = data && data.length > 0 ? data : defaultData

  return (
    <ResponsiveContainer width='100%' height={320}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id='analyticsClicksGrad' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.35} />
            <stop offset='95%' stopColor='#3b82f6' stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id='analyticsUniquesGrad' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='5%' stopColor='#10b981' stopOpacity={0.3} />
            <stop offset='95%' stopColor='#10b981' stopOpacity={0.02} />
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
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip content={<AnalyticsCustomTooltip />} />
        <Area
          type='monotone'
          dataKey='clicks'
          name='Diamond Packets'
          stroke='#3b82f6'
          strokeWidth={2}
          fill='url(#analyticsClicksGrad)'
        />
        <Area
          type='monotone'
          dataKey='uniques'
          name='Rough Carats'
          stroke='#10b981'
          strokeWidth={2}
          fill='url(#analyticsUniquesGrad)'
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

