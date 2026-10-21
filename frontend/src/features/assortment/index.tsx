import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Layers3, Loader2, Search } from 'lucide-react'
import { getLots, lotsQueryKey } from '@/services/lots-service'
import { formatCarat } from '@/lib/format-carat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { AssortmentExcelButton } from './components/assortment-excel-button'

type Props = {
  onAssort: (lotId: string) => void
}

export function AssortmentLots({ onAssort }: Props) {
  const [search, setSearch] = useState('')
  const lotsQuery = useQuery({
    queryKey: [...lotsQueryKey, { page: 1, pageSize: 100, assortmentList: true }],
    queryFn: ({ signal }) => getLots({ page: 1, pageSize: 100 }, signal),
  })

  const lots = useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = lotsQuery.data?.lots ?? []
    return term
      ? rows.filter((lot) => lot.kapanNo.toLowerCase().includes(term))
      : rows
  }, [lotsQuery.data?.lots, search])

  return (
    <>
      <AppHeader fixed />
      <Main fixed fluid className='flex min-h-0 flex-1 flex-col gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Packet Creation</h1>
          <p className='text-muted-foreground'>Choose a Lot to begin or continue its assortment workflow.</p>
        </div>

        <section className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background'>
          <div className='flex flex-wrap items-center justify-between gap-3 border-b p-4'>
            <div>
              <h2 className='font-semibold'>Lots Ready for Assortment</h2>
              <p className='text-sm text-muted-foreground'>Open a Lot to create and review its packets.</p>
            </div>
            <div className='relative w-full sm:w-64'>
              <Search className='absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Search Kapan No...' className='ps-9' />
            </div>
          </div>

          <div className='min-h-0 flex-1 overflow-auto'>
            <Table>
              <TableHeader className='sticky top-0 z-10 bg-background'>
                <TableRow>
                  <TableHead>Kapan No</TableHead>
                  <TableHead>Total Pieces</TableHead>
                  <TableHead>Total Carat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='w-64 text-end'>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotsQuery.isLoading ? (
                  <TableRow><TableCell colSpan={5} className='h-48 text-center'><Loader2 className='mx-auto animate-spin text-muted-foreground' /></TableCell></TableRow>
                ) : lotsQuery.isError ? (
                  <TableRow><TableCell colSpan={5} className='h-48 text-center text-destructive'>Unable to load Lots.</TableCell></TableRow>
                ) : lots.length ? lots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className='font-semibold'>{lot.kapanNo}</TableCell>
                    <TableCell>{lot.totalPcs.toLocaleString()} PCs</TableCell>
                    <TableCell>{formatCarat(lot.totalCarat)} CT</TableCell>
                    <TableCell><Badge variant={lot.status === 'active' ? 'default' : 'secondary'} className='capitalize'>{lot.status}</Badge></TableCell>
                    <TableCell>
                      <div className='flex items-center justify-end gap-2'>
                        {lot.assortmentComplete && (
                          <AssortmentExcelButton lotId={lot.id} kapanNo={lot.kapanNo} compact />
                        )}
                        <Button size='sm' variant={lot.status === 'active' ? 'default' : 'outline'} onClick={() => onAssort(lot.id)}>
                          <Layers3 /> {lot.status === 'active' ? 'Assort' : 'View'} <ArrowRight />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className='h-48 text-center text-muted-foreground'>No Lots found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </Main>
    </>
  )
}
