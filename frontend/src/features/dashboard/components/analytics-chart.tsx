import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
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

export function AnalyticsChart({ data }: { data?: AnalyticsChartPoint[] }) {
  const chartData = data && data.length > 0 ? data : defaultData

  return (
    <ResponsiveContainer width='100%' height={300}>
      <AreaChart data={chartData}>
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
        />
        <Area
          type='monotone'
          dataKey='clicks'
          stroke='currentColor'
          className='text-primary'
          fill='currentColor'
          fillOpacity={0.15}
        />
        <Area
          type='monotone'
          dataKey='uniques'
          stroke='currentColor'
          className='text-muted-foreground'
          fill='currentColor'
          fillOpacity={0.1}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
