import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ClipboardCheck, Loader2, RefreshCw } from 'lucide-react'
import { fetchSemiPolishById, semiPolishQueryKeys } from '@/services/semi-polish-service'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlanningReturnWorkspace } from './components/planning-return-workspace'

type Props = {
  processId: string
  onBack: () => void
  onFinalized: () => void
}

const statusLabels = {
  in_process: 'In 4P Process',
  returned: 'Returned',
  cancelled: 'Cancelled',
} as const

export function SemiPolishPlanningReturnPage({ processId, onBack, onFinalized }: Props) {
  const processQuery = useQuery({
    queryKey: semiPolishQueryKeys.detail(processId),
    queryFn: () => fetchSemiPolishById(processId),
  })

  if (processQuery.isLoading) {
    return (
      <>
        <AppHeader fixed />
        <Main fixed fluid className='grid flex-1 place-items-center'>
          <div className='flex items-center gap-2 text-muted-foreground'>
            <Loader2 className='size-5 animate-spin' />
            Loading planning and packet returns...
          </div>
        </Main>
      </>
    )
  }

  if (processQuery.isError || !processQuery.data) {
    return (
      <>
        <AppHeader fixed />
        <Main fixed fluid className='flex flex-1 flex-col gap-4'>
          <Button variant='outline' className='w-fit' onClick={onBack}>
            <ArrowLeft /> Back to process details
          </Button>
          <Alert variant='destructive'>
            <AlertTitle>Unable to load 4P process</AlertTitle>
            <AlertDescription className='flex flex-wrap items-center justify-between gap-3'>
              <span>Please check the process and try again.</span>
              <Button
                size='sm'
                variant='outline'
                onClick={() => void processQuery.refetch()}
              >
                <RefreshCw /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        </Main>
      </>
    )
  }

  const process = processQuery.data

  return (
    <>
      <AppHeader fixed />
      <Main fixed fluid className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4'>
          <div className='flex shrink-0 flex-wrap items-start gap-3'>
            <div className='flex min-w-0 items-start gap-3'>
              <Button
                variant='outline'
                size='icon'
                aria-label='Back to 4P process details'
                onClick={onBack}
              >
                <ArrowLeft />
              </Button>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <ClipboardCheck className='size-5 text-primary' />
                  <h1 className='truncate text-xl font-bold tracking-tight'>
                    Planning and packet returns
                  </h1>
                  <Badge variant='outline'>{statusLabels[process.status]}</Badge>
                </div>
                <p className='mt-1 text-sm text-muted-foreground'>
                  <span className='font-mono'>{process.issueNo}</span>
                  {' · '}
                  {process.kapanNo}
                  {' · '}
                  {process.vendorName}
                </p>
              </div>
            </div>
          </div>

          <PlanningReturnWorkspace
            process={process}
            processId={processId}
            onFinalized={onFinalized}
          />
        </div>
      </Main>
    </>
  )
}
