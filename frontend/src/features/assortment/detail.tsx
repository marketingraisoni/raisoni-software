import { useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { getApiErrorMessage } from '@/services/auth-service'
import {
  createLotPacket,
  getLot,
  getLotPackets,
  lotPacketsQueryKey,
  lotQueryKey,
  lotsQueryKey,
  updateLotPacket,
} from '@/services/lots-service'
import {
  ArrowRight,
  CheckCircle2,
  FileCheck,
  Gem,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { formatCarat } from '@/lib/format-carat'
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  hasPermission,
} from '@/constants/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { BackButton } from '@/components/back-button'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { NumberStepperInput } from '@/components/number-stepper-input'
import {
  LOT_STATUS,
  type AssortmentPacket,
  type Lot,
} from '@/features/lots/data/schema'
import { AssortmentExcelButton } from './components/assortment-excel-button'

const caratFormSchema = z.object({
  carat: z
    .number({ message: 'Carat is required.' })
    .positive('Carat must be greater than 0.')
    .multipleOf(0.001, 'Use up to 3 decimal places.'),
})

type CaratForm = z.infer<typeof caratFormSchema>
type PacketQueryData = Awaited<ReturnType<typeof getLotPackets>>

type Props = {
  lotId: string
}

function createPacketRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export function AssortmentDetail({ lotId }: Props) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const canCreate = hasPermission(
    user,
    PERMISSION_MODULE.ASSORTMENT,
    PERMISSION_ACTION.CREATE
  )
  const canUpdate = hasPermission(
    user,
    PERMISSION_MODULE.ASSORTMENT,
    PERMISSION_ACTION.UPDATE
  )
  const [packetToEdit, setPacketToEdit] = useState<{
    packet: AssortmentPacket
    position: number
  } | null>(null)
  const lotQuery = useQuery({
    queryKey: lotQueryKey(lotId),
    queryFn: ({ signal }) => getLot(lotId, signal),
  })
  const packetsQuery = useQuery({
    queryKey: lotPacketsQueryKey(lotId),
    queryFn: ({ signal }) => getLotPackets(lotId, signal),
  })
  const editPacketForm = useForm<CaratForm>({
    resolver: zodResolver(caratFormSchema),
    defaultValues: { carat: Number.NaN },
  })

  const updatePacketMutation = useMutation({
    mutationFn: (values: CaratForm) => {
      if (!packetToEdit) throw new Error('Packet is required')
      return updateLotPacket(lotId, packetToEdit.packet.id, values)
    },
    onSuccess: (response) => {
      queryClient.setQueryData<PacketQueryData>(
        lotPacketsQueryKey(lotId),
        (current) => {
          if (!current) return current

          return {
            packets: current.packets.map((packet) =>
              packet.id === response.data.packet.id
                ? response.data.packet
                : packet
            ),
            summary: response.data.summary,
          }
        }
      )
      void queryClient.invalidateQueries({ queryKey: lotsQueryKey })
      setPacketToEdit(null)
      editPacketForm.reset({ carat: Number.NaN })
      toast.success(response.message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const lot = lotQuery.data
  const packetData = packetsQuery.data
  const primaryProgress =
    packetData && lot
      ? {
          targetPcs: lot.totalPcs,
          startSrNo: 1,
          createdPackets: packetData.summary.totalPackets,
          complete: packetData.summary.totalPackets === lot.totalPcs,
        }
      : null
  const primaryPackets = [...(packetData?.packets ?? [])].sort(
    (left, right) => left.srNo - right.srNo
  )

  return (
    <div className='absolute inset-0 flex min-h-0 flex-col overflow-hidden overscroll-none'>
      <AppHeader fixed />
      <Main
        fixed
        fluid
        className='flex min-h-0 flex-1 flex-col gap-3 overflow-hidden'
      >
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <BackButton fallback={{ to: '/packets' }} />
            <h1 className='text-xl font-bold tracking-tight'>
              Packet Assortment
            </h1>
          </div>
          {lot && (
            <Badge
              variant={
                lot.status === LOT_STATUS.ACTIVE ? 'default' : 'secondary'
              }
              className='capitalize'
            >
              {lot.status}
            </Badge>
          )}
        </div>

        {lotQuery.isLoading || packetsQuery.isLoading ? (
          <div className='flex min-h-72 flex-1 items-center justify-center rounded-lg border bg-background'>
            <Loader2 className='animate-spin text-muted-foreground' />
          </div>
        ) : lotQuery.isError || packetsQuery.isError || !lot || !packetData ? (
          <div className='rounded-lg border border-destructive/40 bg-background p-6 text-destructive'>
            Unable to load this Lot&apos;s assortment details.
          </div>
        ) : (
          <div className='flex h-0 min-h-0 flex-1 flex-col gap-3 overflow-hidden'>
            <section className='shrink-0 rounded-lg border bg-background p-3'>
              <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(180px,0.8fr)_repeat(4,minmax(0,1fr))]'>
                <div className='flex min-w-0 flex-col justify-center px-1 md:col-span-2 xl:col-span-1'>
                  <div className='flex items-center gap-2'>
                    <Gem className='size-4 shrink-0 text-primary' />
                    <h2 className='truncate text-lg font-semibold'>
                      Lot {lot.kapanNo}
                    </h2>
                  </div>
                </div>
                <SummaryCard
                  label='Packets Created'
                  value={`${packetData.summary.totalPackets} / ${lot.totalPcs}`}
                  progress={
                    lot.totalPcs
                      ? packetData.summary.totalPackets / lot.totalPcs
                      : 0
                  }
                />
                <SummaryCard
                  label='Remaining Packets'
                  value={String(packetData.summary.remainingPackets)}
                />
                <SummaryCard
                  label='Carat Allocated'
                  value={`${formatCarat(packetData.summary.totalCarat)} / ${formatCarat(lot.totalCarat)} CT`}
                  progress={
                    lot.totalCarat
                      ? packetData.summary.totalCarat / lot.totalCarat
                      : 0
                  }
                />
                <SummaryCard
                  label='Remaining Carat'
                  value={`${formatCarat(packetData.summary.remainingCarat)} CT`}
                />
              </div>
            </section>

            <div className='flex h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain lg:overflow-hidden'>
              <section className='w-full min-w-0 flex-1 justify-center rounded-lg border bg-background p-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden'>
                {primaryProgress ? (
                  <>
                    <div className='mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-2.5'>
                      <div>
                        <div className='flex items-center gap-3'>
                          <span className='flex size-10 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground'>
                            A
                          </span>
                          <div>
                            <div className='flex flex-wrap items-center gap-2'>
                              <h3 className='font-semibold'>Assort Packets</h3>
                              {primaryProgress.complete && (
                                <Badge className='border-transparent bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:text-emerald-950'>
                                  Total{' '}
                                  {formatCarat(packetData.summary.totalCarat)}{' '}
                                  CT
                                </Badge>
                              )}
                            </div>
                            {/* <p className='text-sm text-muted-foreground'>All packets use the default Grade A.</p> */}
                          </div>
                        </div>
                      </div>
                      <div className='flex items-center gap-2'>
                        {packetData.summary.complete && (
                          <>
                            <AssortmentExcelButton
                              lotId={lot.id}
                              kapanNo={lot.kapanNo}
                            />
                            <Link to='/semi-polish/ready-for-issue'>
                              <Button
                                size='sm'
                                className='cursor-pointer gap-1.5'
                              >
                                <FileCheck className='size-3.5' />
                                Issue In 4P
                                <ArrowRight className='size-3.5' />
                              </Button>
                            </Link>
                          </>
                        )}
                        <Badge
                          variant={
                            primaryProgress.complete ? 'default' : 'secondary'
                          }
                        >
                          {primaryProgress.createdPackets} /{' '}
                          {primaryProgress.targetPcs} Pkt
                        </Badge>
                      </div>
                    </div>

                    <div className='grid auto-rows-max grid-cols-2 content-start gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-4 lg:overflow-y-auto lg:overscroll-contain lg:pe-1 xl:grid-cols-5 2xl:grid-cols-6'>
                      {Array.from(
                        { length: primaryProgress.targetPcs },
                        (_, index) => {
                          const packet = primaryPackets[index]
                          const isNext = index === primaryPackets.length
                          const packetNumber = primaryProgress.startSrNo + index

                          if (packet) {
                            return (
                              <CompletedPacketBox
                                key={packet.id}
                                packet={packet}
                                canEdit={
                                  canUpdate && lot.status === LOT_STATUS.ACTIVE
                                }
                                onEdit={() => {
                                  setPacketToEdit({
                                    packet,
                                    position: packetNumber,
                                  })
                                  editPacketForm.reset({ carat: packet.carat })
                                }}
                              />
                            )
                          }

                          if (isNext && !primaryProgress.complete) {
                            return (
                              <NextPacketBox
                                key={`packet-a-${index}`}
                                lot={lot}
                                lotId={lotId}
                                complete={primaryProgress.complete}
                                position={packetNumber}
                                canCreate={canCreate}
                                assortmentComplete={packetData.summary.complete}
                              />
                            )
                          }

                          return (
                            <WaitingPacketBox
                              key={`packet-a-${index}`}
                              lotNo={lot.kapanNo}
                              position={packetNumber}
                            />
                          )
                        }
                      )}
                    </div>
                  </>
                ) : (
                  <div className='flex min-h-64 flex-col items-center justify-center text-center'>
                    <Loader2 className='mb-3 size-9 animate-spin text-muted-foreground' />
                    <h3 className='font-semibold'>Preparing Grade A</h3>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </Main>
      {packetToEdit && packetData && lot && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !updatePacketMutation.isPending) {
              setPacketToEdit(null)
              editPacketForm.reset({ carat: Number.NaN })
            }
          }}
        >
          <DialogContent className='sm:max-w-md'>
            <DialogHeader className='text-start'>
              <DialogTitle>Edit Packet {packetToEdit.packet.name}</DialogTitle>
              <DialogDescription>
                Update this created packet&apos;s carat weight.
              </DialogDescription>
            </DialogHeader>
            <Form {...editPacketForm}>
              <form
                id='edit-packet-form'
                onSubmit={editPacketForm.handleSubmit((values) =>
                  updatePacketMutation.mutate(values)
                )}
              >
                <FormField
                  control={editPacketForm.control}
                  name='carat'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Packet Carat</FormLabel>
                      <FormControl>
                        <NumberStepperInput
                          ariaLabel={`Packet ${packetToEdit.packet.name} carat`}
                          value={field.value}
                          onChange={field.onChange}
                          min={0.001}
                          max={
                            packetToEdit.packet.carat +
                            packetData.summary.remainingCarat
                          }
                          step={0.1}
                          suffix='CT'
                          disabled={updatePacketMutation.isPending}
                          autoFocus
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                disabled={updatePacketMutation.isPending}
                onClick={() => setPacketToEdit(null)}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                form='edit-packet-form'
                disabled={updatePacketMutation.isPending}
              >
                {updatePacketMutation.isPending && (
                  <Loader2 className='animate-spin' />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function CompletedPacketBox({
  packet,
  canEdit,
  onEdit,
}: {
  packet: AssortmentPacket
  canEdit: boolean
  onEdit: () => void
}) {
  return (
    <div className='min-h-32 rounded-lg border border-emerald-300 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/20'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-lg font-bold'>{packet.name}</span>
        <div className='flex items-center gap-1'>
          {canEdit && (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-7 text-muted-foreground hover:text-foreground'
              aria-label={`Edit Packet ${packet.name}`}
              onClick={onEdit}
            >
              <Pencil className='size-3.5' />
            </Button>
          )}
          <CheckCircle2 className='size-4 text-emerald-600' />
        </div>
      </div>
      <p className='text-xs text-muted-foreground'>Packet number</p>
      <p className='mt-5 text-lg font-bold'>{formatCarat(packet.carat)} CT</p>
    </div>
  )
}

function NextPacketBox({
  lot,
  lotId,
  complete,
  position,
  canCreate,
  assortmentComplete,
}: {
  lot: Lot
  lotId: string
  complete: boolean
  position: number
  canCreate: boolean
  assortmentComplete: boolean
}) {
  const queryClient = useQueryClient()
  const submissionLock = useRef(false)
  const form = useForm<CaratForm>({
    resolver: zodResolver(caratFormSchema),
    defaultValues: { carat: Number.NaN },
  })
  const mutation = useMutation({
    mutationFn: (values: CaratForm & { requestId: string }) =>
      createLotPacket(lotId, values),
    onSuccess: (response) => {
      queryClient.setQueryData<PacketQueryData>(
        lotPacketsQueryKey(lotId),
        (current) => {
          if (!current) return current
          if (
            current.packets.some(
              (packet) => packet.id === response.data.packet.id
            )
          ) {
            return current
          }

          return {
            packets: [...current.packets, response.data.packet],
            summary: response.data.summary,
          }
        }
      )
      void queryClient.invalidateQueries({ queryKey: lotsQueryKey })
      form.reset({ carat: Number.NaN })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSettled: () => {
      submissionLock.current = false
    },
  })
  const submitPacket = form.handleSubmit((values) => {
    // isPending is rendered asynchronously, so a rapid double Enter/click can
    // otherwise send the same packet twice before the button becomes disabled.
    if (submissionLock.current) return
    submissionLock.current = true
    mutation.mutate({ ...values, requestId: createPacketRequestId() })
  })
  const disabled =
    !canCreate ||
    lot.status === LOT_STATUS.CLOSED ||
    complete ||
    assortmentComplete ||
    mutation.isPending

  return (
    <div className='min-h-32 rounded-lg border-2 border-primary bg-primary/5 p-3 shadow-sm'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-lg font-bold'>
          {formatPacketNumber(lot.kapanNo, position)}
        </span>
        {/* <Badge className='px-2 py-0 text-[10px]'>NEXT</Badge> */}
      </div>
      <Form {...form}>
        <form
          onSubmit={submitPacket}
          className='mt-3 space-y-2'
        >
          <FormField
            control={form.control}
            name='carat'
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel className='sr-only'>
                  Packet {formatPacketNumber(lot.kapanNo, position)} carat
                </FormLabel>
                <FormControl>
                  <NumberStepperInput
                    ariaLabel={`Packet ${formatPacketNumber(lot.kapanNo, position)} carat`}
                    value={field.value}
                    onChange={field.onChange}
                    min={0.001}
                    step={0.1}
                    suffix='CT'
                    disabled={disabled}
                    autoFocus
                    invalid={fieldState.invalid}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button
            type='submit'
            size='sm'
            className='w-full'
            disabled={disabled}
          >
            {mutation.isPending ? (
              <Loader2 className='animate-spin' />
            ) : (
              <Plus />
            )}
            Add
          </Button>
        </form>
      </Form>
    </div>
  )
}

function WaitingPacketBox({
  lotNo,
  position,
}: {
  lotNo: string
  position: number
}) {
  return (
    <div className='min-h-32 rounded-lg border border-dashed bg-muted/20 p-3 text-muted-foreground'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-lg font-bold'>
          {formatPacketNumber(lotNo, position)}
        </span>
        <LockKeyhole className='size-3.5' />
      </div>
      <div className='flex h-20 items-center justify-center'>
        <span className='flex items-center gap-1.5 text-xs'>Locked</span>
      </div>
    </div>
  )
}

function formatPacketNumber(lotNo: string, sequence: number) {
  return `${lotNo}-${sequence}A`
}

function SummaryCard({
  label,
  value,
  progress,
}: {
  label: string
  value: string
  progress?: number
}) {
  return (
    <div className='rounded-md border px-3 py-2'>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='mt-0.5 text-sm font-semibold'>{value}</p>
      {progress !== undefined && (
        <div className='mt-1.5 h-1 overflow-hidden rounded-full bg-muted'>
          <div
            className='h-full rounded-full bg-primary transition-all'
            style={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}
