import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/services/auth-service'
import {
  lookupSemiPolishPacket,
  receiveSemiPolishPacket,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  Loader2,
  PackageCheck,
  QrCode,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatCarat } from '@/lib/format-carat'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  PACKET_RETURN_STATUS,
  PLANNING_MATCH_STATUS,
  SEMI_POLISH_PROCESS_STATUS,
  type PlannedPiece,
  type SemiPolishPacketLookup,
} from './data/schema'

type DiamondDraft = {
  selected: boolean
  hphtCarat: string
  fourPCarat: string
  shape: string
  barcode: string
}

function defaultDraft(piece: PlannedPiece): DiamondDraft {
  return {
    selected: false,
    hphtCarat: '',
    fourPCarat: String(piece.polishedCarat),
    shape: piece.shape || '',
    barcode: '',
  }
}

function processIdOf(result: SemiPolishPacketLookup) {
  return (result.process._id || result.process.id) as string
}

export function SemiPolishPacketReturnScannerPage() {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [packetCode, setPacketCode] = useState('')
  const [lookupResult, setLookupResult] =
    useState<SemiPolishPacketLookup | null>(null)
  const [drafts, setDrafts] = useState<Record<number, DiamondDraft>>({})

  const focusScanner = () => {
    inputRef.current?.focus()
    inputRef.current?.select()
    const timers = [
      window.setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50),
      window.setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 150),
      window.setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 300),
    ]
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }

  const clearPacket = () => {
    setPacketCode('')
    focusScanner()
  }

  useEffect(() => {
    const cleanup = focusScanner()
    return cleanup
  }, [])

  useEffect(() => {
    const handleWindowFocus = () => {
      if (!lookupResult) {
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('focus', handleWindowFocus)
    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [lookupResult])

  const lookupMutation = useMutation({
    mutationFn: lookupSemiPolishPacket,
    onSuccess: (result) => {
      setDrafts({})
      setLookupResult(result)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
      setPacketCode('')
      focusScanner()
    },
  })

  const closePacket = () => {
    setLookupResult(null)
    setDrafts({})
    setPacketCode('')
    focusScanner()
  }

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!lookupResult) throw new Error('No packet selected.')
      const selectedPieces = lookupResult.packetPlan.pieces.flatMap((piece) => {
        const draft = drafts[piece.pieceNumber] ?? defaultDraft(piece)
        if (!draft.selected) return []
        return [
          {
            pieceNumber: piece.pieceNumber,
            hphtCarat: draft.hphtCarat.trim()
              ? Number(draft.hphtCarat)
              : undefined,
            fourPCarat: draft.fourPCarat.trim()
              ? Number(draft.fourPCarat)
              : undefined,
            shape: draft.shape.trim() || undefined,
            barcode: draft.barcode.trim().toUpperCase() || undefined,
          },
        ]
      })
      return receiveSemiPolishPacket(
        processIdOf(lookupResult),
        lookupResult.packetPlan.packetNumber,
        {
          receivedPieces: selectedPieces,
          source: /\D/.test(packetCode.trim()) ? 'barcode' : 'manual',
        }
      )
    },
    onSuccess: async (result) => {
      const receivedCount = Number(result.packetReturn?.verifiedPieceCount || 0)
      const plannedCount = lookupResult?.packetPlan.plannedPieceCount || 0
      toast.success(
        receivedCount >= plannedCount
          ? 'Packet return completed.'
          : `Return saved. ${plannedCount - receivedCount} diamond(s) remain open.`
      )
      if (lookupResult) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: semiPolishQueryKeys.planning(processIdOf(lookupResult)),
          }),
          queryClient.invalidateQueries({
            queryKey: semiPolishQueryKeys.detail(processIdOf(lookupResult)),
          }),
        ])
      }
      closePacket()
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const findPacket = (customCode?: string) => {
    const value = (customCode ?? packetCode).trim().toUpperCase()
    if (!value) {
      toast.error('Scan a packet QR or enter a packet number.')
      focusScanner()
      return
    }
    setPacketCode(value)
    inputRef.current?.select()
    lookupMutation.mutate(value)
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      findPacket()
      return
    }
    if (event.key === 'Escape') {
      clearPacket()
      return
    }
  }

  const handleInputPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text').trim().toUpperCase()
    if (text) {
      setPacketCode(text)
      findPacket(text)
    }
  }

  const packetPlan = lookupResult?.packetPlan
  const packetReturn = lookupResult?.packetReturn
  const receivedNumbers = useMemo(
    () =>
      new Set([
        ...(packetReturn?.receivedPieceNumbers ?? []),
        ...(packetReturn?.receivedPieces ?? []).map(
          (piece) => piece.pieceNumber
        ),
      ]),
    [packetReturn]
  )
  const receivedByNumber = useMemo(
    () =>
      new Map(
        (packetReturn?.receivedPieces ?? []).map((piece) => [
          piece.pieceNumber,
          piece,
        ])
      ),
    [packetReturn]
  )

  const selectedPieces =
    packetPlan?.pieces.flatMap((piece) => {
      if (receivedNumbers.has(piece.pieceNumber)) return []
      const draft = drafts[piece.pieceNumber] ?? defaultDraft(piece)
      if (!draft.selected) return []
      return [draft]
    }) ?? []
  const selectedBarcodes = selectedPieces
    .map((draft) => draft.barcode.trim().toUpperCase())
    .filter(Boolean)
  const selectionValid =
    selectedPieces.length > 0 &&
    selectedPieces.every((draft) => {
      const hphtCarat = draft.hphtCarat.trim() ? Number(draft.hphtCarat) : null
      const fourPCarat = draft.fourPCarat.trim()
        ? Number(draft.fourPCarat)
        : null
      return (
        (hphtCarat == null || (Number.isFinite(hphtCarat) && hphtCarat > 0)) &&
        (fourPCarat == null || (Number.isFinite(fourPCarat) && fourPCarat > 0))
      )
    }) &&
    new Set(selectedBarcodes).size === selectedBarcodes.length

  const processIsActive =
    lookupResult?.process.status === SEMI_POLISH_PROCESS_STATUS.IN_PROCESS
  const planIsMatched =
    packetPlan?.matchStatus === PLANNING_MATCH_STATUS.MATCHED
  const packetStatus = packetReturn?.status
  const packetIsVerified = packetStatus === PACKET_RETURN_STATUS.VERIFIED
  const packetIsPartial = packetStatus === PACKET_RETURN_STATUS.PARTIAL
  const packetHasIssue = packetStatus === PACKET_RETURN_STATUS.ISSUE
  const canReceive = Boolean(
    processIsActive &&
    planIsMatched &&
    !packetIsVerified &&
    !packetHasIssue
  )

  const updateDraft = (piece: PlannedPiece, patch: Partial<DiamondDraft>) => {
    setDrafts((current) => ({
      ...current,
      [piece.pieceNumber]: {
        ...defaultDraft(piece),
        ...current[piece.pieceNumber],
        ...patch,
      },
    }))
  }

  const summaryCells = packetPlan
    ? [
        {
          label: 'Total pieces',
          value: `${packetReturn?.verifiedPieceCount ?? 0} / ${packetPlan.plannedPieceCount}`,
        },
        {
          label: 'Issued carat',
          value:
            packetPlan.issuedRoughCarat == null
              ? '—'
              : `${formatCarat(packetPlan.issuedRoughCarat)} CT`,
        },
        {
          label: 'Polished total',
          value: `${formatCarat(packetPlan.plannedPolishedCarat)} CT`,
        },
        {
          label: 'Difference',
          value:
            packetPlan.roughCaratDifference == null
              ? '—'
              : `${formatCarat(packetPlan.roughCaratDifference)} CT`,
        },
        {
          label: 'Yield',
          value: `${Number(packetPlan.yieldPercentage).toFixed(2)}%`,
        },
      ]
    : []

  return (
    <>
      <AppHeader fixed />
      <Main fixed fluid className='flex min-h-0 flex-1 flex-col gap-4 overflow-hidden'>
        <div className='flex shrink-0 items-center justify-between'>
          <div>
            <div className='flex items-center gap-2'>
              <QrCode className='size-5 text-primary' />
              <h1 className='text-xl sm:text-2xl font-bold tracking-tight'>
                Packet scanner
              </h1>
            </div>
            <p className='mt-0.5 text-xs sm:text-sm text-muted-foreground'>
              Find and receive a planned packet from any active 4P kapan.
            </p>
          </div>
        </div>

        <div
          role='region'
          aria-label='Packet scanner dropzone'
          onClick={focusScanner}
          className={cn(
            'relative flex min-h-0 flex-1 flex-col items-center justify-center',
            'rounded-2xl border-2 border-dashed border-border/80 bg-muted/10',
            'p-6 sm:p-12 text-center cursor-pointer shadow-xs overflow-y-auto'
          )}
        >
          <div className='pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent' />

          <div className='flex w-full max-w-xl flex-col items-center gap-5'>
            <div className='relative flex size-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-xs'>
              <QrCode className='size-10' />
              <span className='absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-emerald-600 ring-2 ring-background'>
                <span className='size-2 rounded-full bg-white animate-pulse' />
              </span>
            </div>

            <div className='inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-sm font-medium text-muted-foreground shadow-2xs backdrop-blur-xs'>
              <span className='size-2 rounded-full bg-emerald-500 animate-pulse' />
              Scanner ready & auto-focused
            </div>

            <div>
              <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
                Scan packet QR or enter code
              </h2>
            </div>

            <div
              className='mt-2 w-full max-w-lg'
              onClick={(event) => event.stopPropagation()}
            >
              <div className='flex flex-col gap-2.5 sm:flex-row'>
                <div className='relative flex-1'>
                  <Search className='pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    ref={inputRef}
                    autoFocus
                    value={packetCode}
                    autoComplete='off'
                    placeholder='Scan or enter packet number'
                    className='h-12 bg-background pl-10 pr-16 text-base shadow-xs'
                    onChange={(event) =>
                      setPacketCode(event.target.value.toUpperCase())
                    }
                    onKeyDown={handleInputKeyDown}
                    onPaste={handleInputPaste}
                    onFocus={(event) => event.target.select()}
                    onClick={(event) => event.currentTarget.select()}
                  />
                  {packetCode ? (
                    <button
                      type='button'
                      aria-label='Clear barcode'
                      onClick={clearPacket}
                      className='absolute right-3 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
                    >
                      <X className='size-3.5' />
                    </button>
                  ) : (
                    <kbd className='pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-muted-foreground sm:inline-flex'>
                      ↵ Enter
                    </kbd>
                  )}
                </div>
                <Button
                  className='h-12 shrink-0 px-6 font-medium shadow-xs'
                  disabled={lookupMutation.isPending}
                  onClick={() => findPacket()}
                >
                  {lookupMutation.isPending ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <Search className='size-4' />
                  )}
                  Find packet
                </Button>
              </div>
            </div>

            <div className='mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground'>
              <span className='inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 backdrop-blur-xs'>
                <Barcode className='size-3.5 text-primary' /> Barcode / QR wedge mode
              </span>
              <span className='inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 backdrop-blur-xs'>
                <CheckCircle2 className='size-3.5 text-emerald-500' /> All active kapans supported
              </span>
              <span className='inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 backdrop-blur-xs'>
                Click anywhere to focus scanner
              </span>
            </div>
          </div>
        </div>
      </Main>

      <Dialog
        open={Boolean(lookupResult)}
        onOpenChange={(open) => !open && closePacket()}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            focusScanner()
          }}
          className='flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[70vw] sm:max-w-[70vw]'
        >
          {lookupResult && packetPlan && (
            <>
              <DialogHeader className='shrink-0 border-b px-6 py-4 pe-14'>
                <div className='flex flex-wrap items-center gap-2'>
                  <DialogTitle>
                    Packet #{packetPlan.packetNumber} ·{' '}
                    {packetPlan.rawPacketLabel}
                  </DialogTitle>
                  {packetIsVerified ? (
                    <Badge className='bg-emerald-600'>
                      <CheckCircle2 /> Verified
                    </Badge>
                  ) : packetIsPartial ? (
                    <Badge variant='outline'>
                      {packetReturn?.verifiedPieceCount}/
                      {packetPlan.plannedPieceCount} received
                    </Badge>
                  ) : packetHasIssue ? (
                    <Badge variant='destructive'>
                      <AlertTriangle /> Issue
                    </Badge>
                  ) : (
                    <Badge variant='secondary'>Pending</Badge>
                  )}
                </div>
                <DialogDescription>
                  Kapan {lookupResult.process.kapanNo} ·{' '}
                  {lookupResult.process.issueNo} ·{' '}
                  {lookupResult.process.vendorName}
                </DialogDescription>
              </DialogHeader>

              <div className='min-h-0 overflow-y-auto p-4 sm:p-6'>
                {!planIsMatched && (
                  <Alert variant='destructive' className='mb-4'>
                    <AlertTriangle />
                    <AlertTitle>Planning packet is not matched</AlertTitle>
                    <AlertDescription>
                      Resolve the planning difference from this kapan before
                      receiving the packet.
                    </AlertDescription>
                  </Alert>
                )}
                {packetHasIssue && (
                  <Alert variant='destructive' className='mb-4'>
                    <AlertTriangle />
                    <AlertTitle>Packet has an unresolved issue</AlertTitle>
                    <AlertDescription>
                      {packetReturn?.issue?.details ||
                        'Resolve this packet issue from its planning return page first.'}
                    </AlertDescription>
                  </Alert>
                )}

                <div className='overflow-hidden rounded-lg border shadow-sm'>
                  <div className='border-b bg-muted/40 px-4 py-3 text-sm font-semibold'>
                    {packetPlan.planningLotNo} · {packetPlan.rawPacketLabel}
                  </div>
                  <Table className='min-w-[1780px] table-fixed text-sm [&_td]:border-r [&_td]:border-border/70 [&_th]:border-r [&_th]:border-border/70'>
                    <TableHeader>
                      <TableRow className='bg-muted/40 hover:bg-muted/40'>
                        <TableHead className='w-28'>Piece</TableHead>
                        <TableHead className='w-28'>Planned CT</TableHead>
                        <TableHead className='w-32'>HPHT CARAT</TableHead>
                        <TableHead className='w-32'>4P CARAT</TableHead>
                        <TableHead className='w-36'>SHAPE</TableHead>
                        <TableHead className='w-24'>CUT</TableHead>
                        <TableHead className='w-24'>COLOR</TableHead>
                        <TableHead className='w-24'>CLARITY</TableHead>
                        <TableHead className='w-48'>BARCODE</TableHead>
                        {summaryCells.map((summary) => (
                          <TableHead
                            key={summary.label}
                            className='w-36 text-center'
                          >
                            {summary.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packetPlan.pieces.map((piece, index) => {
                        const saved = receivedByNumber.get(piece.pieceNumber)
                        const isReceived = receivedNumbers.has(
                          piece.pieceNumber
                        )
                        const draft =
                          drafts[piece.pieceNumber] ?? defaultDraft(piece)
                        return (
                          <TableRow
                            key={piece._id || piece.id || piece.sourceRow}
                          >
                            <TableCell className='font-semibold'>
                              <div className='flex items-center gap-2'>
                                <Checkbox
                                  checked={isReceived || draft.selected}
                                  disabled={isReceived || !canReceive}
                                  onCheckedChange={(checked) =>
                                    updateDraft(piece, {
                                      selected: checked === true,
                                    })
                                  }
                                />
                                #{piece.pieceNumber}
                              </div>
                            </TableCell>
                            <TableCell className='font-mono font-semibold'>
                              {formatCarat(piece.polishedCarat)}
                            </TableCell>
                            <TableCell>
                              {isReceived ? (
                                <span className='font-mono'>
                                  {saved?.hphtCarat == null
                                    ? '—'
                                    : formatCarat(saved.hphtCarat)}
                                </span>
                              ) : (
                                <Input
                                  type='number'
                                  min='0.001'
                                  step='0.001'
                                  placeholder='Optional'
                                  className='h-8 font-mono placeholder:font-sans placeholder:normal-case'
                                  disabled={!canReceive}
                                  value={draft.hphtCarat}
                                  onChange={(event) =>
                                    updateDraft(piece, {
                                      selected: true,
                                      hphtCarat: event.target.value,
                                    })
                                  }
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {isReceived ? (
                                <span className='font-mono'>
                                  {saved?.fourPCarat == null
                                    ? '—'
                                    : formatCarat(saved.fourPCarat)}
                                </span>
                              ) : (
                                <Input
                                  type='number'
                                  min='0.001'
                                  step='0.001'
                                  className='h-8 font-mono'
                                  disabled={!canReceive}
                                  value={draft.fourPCarat}
                                  onChange={(event) =>
                                    updateDraft(piece, {
                                      selected: true,
                                      fourPCarat: event.target.value,
                                    })
                                  }
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {isReceived ? (
                                saved?.shape || '—'
                              ) : (
                                <Input
                                  className='h-8 uppercase'
                                  disabled={!canReceive}
                                  value={draft.shape}
                                  onChange={(event) =>
                                    updateDraft(piece, {
                                      selected: true,
                                      shape: event.target.value.toUpperCase(),
                                    })
                                  }
                                />
                              )}
                            </TableCell>
                            <TableCell>{piece.cut || '—'}</TableCell>
                            <TableCell>{piece.color || '—'}</TableCell>
                            <TableCell>{piece.clarity || '—'}</TableCell>
                            <TableCell>
                              {isReceived ? (
                                <span className='font-mono'>
                                  {saved?.barcode || '—'}
                                </span>
                              ) : (
                                <Input
                                  placeholder='Optional'
                                  className='h-8 font-mono uppercase placeholder:font-sans placeholder:normal-case'
                                  disabled={!canReceive}
                                  value={draft.barcode}
                                  onChange={(event) =>
                                    updateDraft(piece, {
                                      selected: true,
                                      barcode: event.target.value.toUpperCase(),
                                    })
                                  }
                                />
                              )}
                            </TableCell>
                            {index === 0 &&
                              summaryCells.map((summary) => (
                                <TableCell
                                  key={summary.label}
                                  rowSpan={packetPlan.pieces.length}
                                  className='text-center align-middle font-bold'
                                >
                                  {summary.value}
                                </TableCell>
                              ))}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter className='shrink-0 border-t px-6 py-4'>
                <Button variant='outline' onClick={closePacket}>
                  Close
                </Button>
                {canReceive && (
                  <Button
                    disabled={!selectionValid || receiveMutation.isPending}
                    onClick={() => receiveMutation.mutate()}
                  >
                    {receiveMutation.isPending ? (
                      <Loader2 className='animate-spin' />
                    ) : (
                      <PackageCheck />
                    )}
                    Confirm {selectedPieces.length}{' '}
                    {selectedPieces.length === 1 ? 'diamond' : 'diamonds'}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
