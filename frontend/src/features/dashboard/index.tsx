import { useQuery } from '@tanstack/react-query'
import { Boxes, Clock, Gem, Layers3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
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

export function Dashboard() {
  const { data } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: ({ signal }) => fetchDashboardData(signal),
  })

  const metrics = data?.metrics

  return (
    <>
      {/* ===== Top Heading ===== */}
      <AppHeader leading={<TopNav links={topNav} className='me-auto' />}>
        <Search />
      </AppHeader>

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
          <div className='flex items-center space-x-2'>
            <Button>Download</Button>
          </div>
        </div>
        <Tabs
          orientation='vertical'
          defaultValue='overview'
          className='space-y-4'
        >
          <div className='w-full overflow-x-auto pb-2'>
            <TabsList>
              <TabsTrigger value='overview'>Overview</TabsTrigger>
              <TabsTrigger value='analytics'>Analytics</TabsTrigger>
              <TabsTrigger value='reports' disabled>
                Reports
              </TabsTrigger>
              <TabsTrigger value='notifications' disabled>
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value='overview' className='space-y-4'>
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
                  <p className='text-xs text-muted-foreground'>
                    {metrics ? `Across ${metrics.totalLots} total lots` : 'Registered lots'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    Total Pieces
                  </CardTitle>
                  <Boxes className='h-5 w-5 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {metrics ? `+${metrics.totalPieces.toLocaleString()}` : '—'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {metrics ? `In ${metrics.activeLots} active lots` : 'Active lot inventory'}
                  </p>
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
                  <p className='text-xs text-muted-foreground'>
                    {metrics ? `${metrics.totalPacketCarat.toLocaleString()} carats assorted` : 'Grade A packets'}
                  </p>
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
                  <p className='text-xs text-muted-foreground'>
                    {metrics ? `${metrics.totalProcesses} total 4P processes` : 'Active process batches'}
                  </p>
                </CardContent>
              </Card>
            </div>
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
                  <CardDescription>
                    {metrics ? `${metrics.totalLots} total lots registered in system.` : 'Recent lot inward operations.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentSales items={data?.recentSales} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value='analytics' className='space-y-4'>
            <Analytics data={data?.analytics} />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

const topNav = [
  {
    title: 'Overview',
    href: 'dashboard/overview',
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
    title: 'Packet Assortment',
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
