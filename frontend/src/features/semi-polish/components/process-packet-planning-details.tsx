import { CheckCircle2, Clock3 } from 'lucide-react'
import { formatCarat } from '@/lib/format-carat'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type SemiPolishPacketPlan,
  type SemiPolishPacketReturn,
} from '../data/schema'

type Props = {
  plan: SemiPolishPacketPlan
  packetReturn?: SemiPolishPacketReturn | null
}

export function ProcessPacketPlanningDetails({ plan, packetReturn }: Props) {
  const receivedPieceNumbers = new Set([
    ...(packetReturn?.receivedPieceNumbers ?? []),
    ...(packetReturn?.receivedPieces ?? []).map((piece) => piece.pieceNumber),
  ])
  const receivedPieces = new Map(
    (packetReturn?.receivedPieces ?? []).map((piece) => [
      piece.pieceNumber,
      piece,
    ])
  )
  const summary = [
    { label: 'Planned pieces', value: String(plan.plannedPieceCount) },
    {
      label: 'Issued carat',
      value:
        plan.issuedRoughCarat == null
          ? '—'
          : `${formatCarat(plan.issuedRoughCarat)} CT`,
    },
    {
      label: 'Polished total',
      value: `${formatCarat(plan.plannedPolishedCarat)} CT`,
    },
    {
      label: 'Difference',
      value:
        plan.roughCaratDifference == null
          ? '—'
          : `${formatCarat(plan.roughCaratDifference)} CT`,
    },
    {
      label: 'Yield',
      value: `${Number(plan.yieldPercentage).toFixed(2)}%`,
    },
  ]

  return (
    <div className='m-4 overflow-hidden rounded-lg border border-primary/20 bg-background shadow-sm'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b bg-primary/[0.055] px-4 py-3'>
        <div>
          <p className='text-sm font-semibold tracking-wide text-primary/80 uppercase'>
            {plan.planningLotNo || 'Imported packet'} · {plan.rawPacketLabel}
          </p>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            Imported planning and received-piece details
          </p>
        </div>
        <Badge variant='outline'>Imported planning</Badge>
      </div>

      <div className='grid border-b sm:grid-cols-2 xl:grid-cols-5'>
        {summary.map((item) => (
          <div
            key={item.label}
            className='border-b px-4 py-3 last:border-b-0 sm:border-e xl:border-b-0 xl:last:border-e-0'
          >
            <p className='text-xs text-muted-foreground'>{item.label}</p>
            <p className='mt-0.5 font-mono text-sm font-semibold'>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <Table className='min-w-[1120px] table-fixed text-sm'>
        <TableHeader>
          <TableRow className='bg-muted/40 hover:bg-muted/40'>
            <TableHead className='w-20'>Piece</TableHead>
            <TableHead className='w-28'>Planned CT</TableHead>
            <TableHead className='w-28'>HPHT CT</TableHead>
            <TableHead className='w-28'>4P CT</TableHead>
            <TableHead className='w-32'>Shape</TableHead>
            <TableHead className='w-24'>Cut</TableHead>
            <TableHead className='w-24'>Color</TableHead>
            <TableHead className='w-24'>Clarity</TableHead>
            <TableHead className='w-40'>Barcode</TableHead>
            <TableHead className='w-28'>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.pieces.map((piece) => {
            const received = receivedPieces.get(piece.pieceNumber)
            const isReceived = receivedPieceNumbers.has(piece.pieceNumber)

            return (
              <TableRow key={piece.id || piece._id || piece.sourceRow}>
                <TableCell className='font-semibold'>
                  #{piece.pieceNumber}
                </TableCell>
                <TableCell className='font-mono font-semibold'>
                  {formatCarat(piece.polishedCarat)}
                </TableCell>
                <TableCell className='font-mono'>
                  {received?.hphtCarat == null
                    ? '—'
                    : formatCarat(received.hphtCarat)}
                </TableCell>
                <TableCell className='font-mono'>
                  {received?.fourPCarat == null
                    ? '—'
                    : formatCarat(received.fourPCarat)}
                </TableCell>
                <TableCell>{received?.shape || piece.shape || '—'}</TableCell>
                <TableCell>{piece.cut || '—'}</TableCell>
                <TableCell>{piece.color || '—'}</TableCell>
                <TableCell>{piece.clarity || '—'}</TableCell>
                <TableCell className='font-mono'>
                  {received?.barcode || '—'}
                </TableCell>
                <TableCell>
                  {isReceived ? (
                    <Badge className='bg-emerald-600'>
                      <CheckCircle2 /> Received
                    </Badge>
                  ) : (
                    <Badge variant='secondary'>
                      <Clock3 /> Pending
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
