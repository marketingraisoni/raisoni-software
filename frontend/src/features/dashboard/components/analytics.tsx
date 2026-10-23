import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Boxes, Gem, Layers3, Percent } from 'lucide-react'
import { type DashboardAnalytics } from '@/services/dashboard-service'
import { AnalyticsChart } from './analytics-chart'

export function Analytics({ data }: { data?: DashboardAnalytics }) {
  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Production & Process Volume</CardTitle>
          <CardDescription>Daily diamond pieces and rough carats in processing</CardDescription>
        </CardHeader>
        <CardContent className='px-6'>
          <AnalyticsChart data={data?.chart} />
        </CardContent>
      </Card>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Pieces</CardTitle>
            <Boxes className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.totalPieces ?? data?.totalClicks ?? '—'}</div>
            <p className='text-xs text-muted-foreground'>Total diamond pieces in inventory</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Carats
            </CardTitle>
            <Gem className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.totalCarats ?? data?.uniqueVisitors ?? '—'}</div>
            <p className='text-xs text-muted-foreground'>Total intake rough weight</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>4P Yield Rate</CardTitle>
            <Percent className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.yieldRate ?? data?.bounceRate ?? '—'}</div>
            <p className='text-xs text-muted-foreground'>Average polished recovery yield</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Assorted Packets</CardTitle>
            <Layers3 className='h-5 w-5 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.totalPackets ?? data?.avgSession ?? '—'}</div>
            <p className='text-xs text-muted-foreground'>Grade A assortment packets</p>
          </CardContent>
        </Card>
      </div>
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader>
            <CardTitle>4P Vendors</CardTitle>
            <CardDescription>Carats issued to external processing vendors</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarList
              items={data?.referrers ?? [
                { name: 'In-House 4P', value: 100 },
              ]}
              barClass='bg-primary'
              valueFormatter={(n) => `${n} Cts`}
            />
          </CardContent>
        </Card>
        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader>
            <CardTitle>Pipeline Distribution</CardTitle>
            <CardDescription>Current status of lots and 4P batches</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarList
              items={data?.devices ?? [
                { name: 'Active Lots', value: 0 },
                { name: 'Closed Lots', value: 0 },
                { name: 'In-Process 4P', value: 0 },
              ]}
              barClass='bg-muted-foreground'
              valueFormatter={(n) => `${n}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

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
