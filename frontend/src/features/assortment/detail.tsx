import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  AlertTriangle,
  Check,
  CheckCircle2,
  Gem,
  Loader2,
  LockKeyhole,
  MoreVertical,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { hasPermission } from '@/constants/permissions'
import { formatCarat } from '@/lib/format-carat'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/services/auth-service'
import {
  createLotGrade,
  createLotPacket,
  deleteLotGrade,
  getLot,
  getLotPackets,
  lotPacketsQueryKey,
  lotQueryKey,
  updateLotGrade,
  updateLotPacket,
} from '@/services/lots-service'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { NumberStepperInput } from '@/components/number-stepper-input'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import {
  type AssortmentPacket,
  type AssortmentSummary,
  type Lot,
} from '@/features/lots/data/schema'

const gradeFormSchema = z.object({
  grade: z
    .string()
    .length(1, 'Grade is required.')
    .regex(/^[A-Z]$/, 'Grade must be one letter from A to Z.'),
  targetPcs: z
    .number({ error: 'Pieces is required.' })
    .int('Pieces must be a whole number.')
    .positive('Pieces must be at least 1.'),
})

const caratFormSchema = z.object({
  carat: z
    .number({ error: 'Carat is required.' })
    .positive('Carat must be greater than 0.')
    .multipleOf(0.001, 'Use up to 3 decimal places.'),
})

const editGradeFormSchema = z.object({
  targetPcs: z
    .number({ error: 'Pieces is required.' })
    .int('Pieces must be a whole number.')
    .positive('Pieces must be at least 1.'),
})

type GradeForm = z.infer<typeof gradeFormSchema>
type CaratForm = z.infer<typeof caratFormSchema>
type EditGradeForm = z.infer<typeof editGradeFormSchema>
type GradeProgress = AssortmentSummary['grades'][number]

type Props = {
  lotId: string
  onBack: () => void
}

export function AssortmentDetail({ lotId, onBack }: Props) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const canCreate = hasPermission(user, 'lots', 'create')
  const canUpdate = hasPermission(user, 'lots', 'update')
  const canDelete = hasPermission(user, 'lots', 'delete')
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)
  const [gradeToEdit, setGradeToEdit] = useState<GradeProgress | null>(null)
  const [packetToEdit, setPacketToEdit] = useState<{
    packet: AssortmentPacket
    position: number
  } | null>(null)
  const [gradeToDelete, setGradeToDelete] = useState<GradeProgress | null>(null)
  const [isAddingGrade, setIsAddingGrade] = useState(false)
  const lotQuery = useQuery({
    queryKey: lotQueryKey(lotId),
    queryFn: ({ signal }) => getLot(lotId, signal),
  })
  const packetsQuery = useQuery({
    queryKey: lotPacketsQueryKey(lotId),
    queryFn: ({ signal }) => getLotPackets(lotId, signal),
  })
  const gradeForm = useForm<GradeForm>({
    resolver: zodResolver(gradeFormSchema),
    defaultValues: { grade: '', targetPcs: Number.NaN },
  })
  const editGradeForm = useForm<EditGradeForm>({
    resolver: zodResolver(editGradeFormSchema),
    defaultValues: { targetPcs: Number.NaN },
  })
  const editPacketForm = useForm<CaratForm>({
    resolver: zodResolver(caratFormSchema),
    defaultValues: { carat: Number.NaN },
  })

  const gradeMutation = useMutation({
    mutationFn: (values: GradeForm) => createLotGrade(lotId, values),
    onSuccess: async (response, values) => {
      await queryClient.invalidateQueries({ queryKey: lotPacketsQueryKey(lotId) })
      setSelectedGrade(values.grade)
      setIsAddingGrade(false)
      toast.success(response.message)
      gradeForm.reset({ grade: '', targetPcs: Number.NaN })
      window.setTimeout(() => gradeForm.setFocus('grade'), 0)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const deleteGradeMutation = useMutation({
    mutationFn: (grade: GradeProgress) => deleteLotGrade(lotId, grade.id),
    onSuccess: async (response, grade) => {
      await queryClient.invalidateQueries({ queryKey: lotPacketsQueryKey(lotId) })
      if (selectedGrade === grade.grade) setSelectedGrade(null)
      setGradeToDelete(null)
      toast.success(response.message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const updateGradeMutation = useMutation({
    mutationFn: (values: EditGradeForm) => {
      if (!gradeToEdit) throw new Error('Grade is required')
      return updateLotGrade(lotId, gradeToEdit.id, values)
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: lotPacketsQueryKey(lotId) })
      setGradeToEdit(null)
      editGradeForm.reset({ targetPcs: Number.NaN })
      toast.success(response.message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const updatePacketMutation = useMutation({
    mutationFn: (values: CaratForm) => {
      if (!packetToEdit) throw new Error('Packet is required')
      return updateLotPacket(lotId, packetToEdit.packet.id, values)
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: lotPacketsQueryKey(lotId) })
      setPacketToEdit(null)
      editPacketForm.reset({ carat: Number.NaN })
      toast.success(response.message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const lot = lotQuery.data
  const packetData = packetsQuery.data
  const grades = packetData?.summary.grades ?? []
  const gradeCaratTotals = useMemo(() => {
    return (packetData?.packets ?? []).reduce<Record<string, number>>((totals, packet) => {
      totals[packet.grade] = (totals[packet.grade] ?? 0) + packet.carat
      return totals
    }, {})
  }, [packetData?.packets])

  useEffect(() => {
    if (!grades.length) {
      setSelectedGrade(null)
      return
    }

    if (!grades.some((grade) => grade.grade === selectedGrade)) {
      setSelectedGrade(grades[0].grade)
    }
  }, [grades, selectedGrade])

  const activeGrade =
    grades.find((grade) => grade.grade === selectedGrade) ?? null
  const activeGradePackets = activeGrade
    ? (packetData?.packets ?? [])
        .filter((packet) => packet.grade === activeGrade.grade)
        .sort((left, right) => left.srNo - right.srNo)
    : []

  return (
    <div className='absolute inset-0 flex min-h-0 flex-col overflow-hidden overscroll-none'>
      <AppHeader fixed />
      <Main fixed fluid className='flex min-h-0 flex-1 flex-col gap-3 overflow-hidden'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <Button variant='outline' size='icon' onClick={onBack} aria-label='Back to Packet Creation'>
              <ArrowLeft />
            </Button>
            <h1 className='text-xl font-bold tracking-tight'>Assortment Workspace</h1>
          </div>
          {lot && (
            <Badge variant={lot.status === 'active' ? 'default' : 'secondary'} className='capitalize'>
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
            Unable to load this Lot&apos;s assortment workspace.
          </div>
        ) : (
          <div className='flex h-0 min-h-0 flex-1 flex-col gap-3 overflow-hidden'>
            <section className='shrink-0 rounded-lg border bg-background p-3'>
              <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(180px,0.8fr)_repeat(4,minmax(0,1fr))]'>
                <div className='flex min-w-0 flex-col justify-center px-1 md:col-span-2 xl:col-span-1'>
                  <div className='flex items-center gap-2'>
                    <Gem className='size-4 shrink-0 text-primary' />
                    <h2 className='truncate text-lg font-semibold'>Lot {lot.kapanNo}</h2>
                  </div>
                </div>
                <SummaryCard label='Packets Created' value={`${packetData.summary.totalPackets} / ${packetData.summary.targetPackets}`} progress={packetData.summary.targetPackets ? packetData.summary.totalPackets / packetData.summary.targetPackets : 0} />
                <SummaryCard label='Remaining Pieces' value={String(packetData.summary.remainingPackets)} />
                <SummaryCard label='Carat Allocated' value={`${formatCarat(packetData.summary.totalCarat)} / ${formatCarat(packetData.summary.targetCarat)} CT`} progress={packetData.summary.targetCarat ? packetData.summary.totalCarat / packetData.summary.targetCarat : 0} />
                <SummaryCard label='Remaining Carat' value={`${formatCarat(packetData.summary.remainingCarat)} CT`} />
              </div>
            </section>

            <div className='grid h-0 min-h-0 flex-1 items-start gap-3 overflow-y-auto overscroll-contain lg:grid-cols-[300px_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden'>
              <aside className='min-h-0 lg:h-full'>
                <section className='rounded-lg border bg-background p-3 lg:flex lg:h-full lg:min-h-0 lg:flex-col'>
                  <div className='shrink-0 pb-3'>
                    <h3 className='font-semibold'>Grades</h3>
                    <p className='text-sm text-muted-foreground'>Select a grade to fill its packets.</p>
                  </div>
                  {grades.length ? (
                    <div className='space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pe-1'>
                      {grades.map((grade) => (
                        <div
                          key={grade.id}
                          className={cn(
                            'relative rounded-lg border bg-background transition-colors',
                            grade.complete && 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10',
                            !grade.complete && 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10',
                            // grade.complete && selectedGrade === grade.grade && 'ring-1 ring-emerald-500/60',
                            // !grade.complete && selectedGrade === grade.grade && 'ring-1 ring-amber-500/60'
                          )}
                        >
                          <button
                            type='button'
                            onClick={() => setSelectedGrade(grade.grade)}
                            className='w-full p-3 pe-12 text-start'
                          >
                            <div className='flex items-center justify-between gap-3'>
                              <div className='flex min-w-0 items-center gap-2'>
                                <span className='text-2xl font-bold'>{grade.grade}</span>
                                {grade.complete && (
                                  <Badge className='shrink-0 border-transparent bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:text-emerald-950'>
                                    {formatCarat(gradeCaratTotals[grade.grade] ?? 0)} CT
                                  </Badge>
                                )}
                              </div>
                              <Badge variant='secondary'>
                                {grade.createdPackets} / {grade.targetPcs} PCs
                              </Badge>
                            </div>
                            <div className={cn('mt-2 h-1.5 overflow-hidden rounded-full', grade.complete ? 'bg-emerald-500/15' : 'bg-amber-500/15')}>
                              <div className={cn('h-full rounded-full', grade.complete ? 'bg-emerald-500/70' : 'bg-amber-500/70')} style={{ width: `${grade.targetPcs ? (grade.createdPackets / grade.targetPcs) * 100 : 0}%` }} />
                            </div>
                            <p className={cn('mt-1.5 flex items-center gap-1.5 text-xs', grade.complete ? 'text-emerald-600' : 'text-amber-600')}>
                              {grade.complete ? <CheckCircle2 className='size-3.5' /> : <AlertTriangle className='size-3.5' />}
                              {grade.complete ? 'Complete' : 'Incomplete'}
                            </p>
                          </button>
                          {(canUpdate || canDelete) && lot.status === 'active' && (
                            <div className='absolute end-1.5 top-1.5'>
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type='button'
                                    size='icon'
                                    variant='ghost'
                                    className='size-8 text-muted-foreground'
                                    aria-label={`Open Grade ${grade.grade} menu`}
                                  >
                                    <MoreVertical />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align='end' className='w-40'>
                                  {canUpdate && (
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        setGradeToEdit(grade)
                                        editGradeForm.reset({ targetPcs: grade.targetPcs })
                                      }}
                                    >
                                      <Pencil /> Edit Piece
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <DropdownMenuItem
                                      className='text-destructive focus:bg-destructive/10 focus:text-destructive'
                                      onSelect={() => setGradeToDelete(grade)}
                                    >
                                      <Trash2 /> Delete Grade
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className='rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground lg:flex lg:flex-1 lg:items-center lg:justify-center'>No grades added yet.</p>
                  )}

                  <div className='mt-3 shrink-0 border-t pt-3'>
                    {lot.status === 'closed' ? (
                      <Button type='button' variant='outline' className='w-full' disabled>Lot Closed</Button>
                    ) : packetData.summary.unplannedPackets === 0 ? (
                      <Button type='button' variant='outline' className='w-full' disabled>All Pieces Assigned</Button>
                    ) : !canCreate ? (
                      <Button type='button' variant='outline' className='w-full' disabled>Add Grade</Button>
                    ) : isAddingGrade ? (
                      <Form {...gradeForm}>
                        <form
                          onSubmit={gradeForm.handleSubmit((values) => gradeMutation.mutate(values))}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape' && !gradeMutation.isPending) {
                              setIsAddingGrade(false)
                              gradeForm.clearErrors()
                            }
                          }}
                        >
                          <div className='grid grid-cols-2 items-start gap-2'>
                            <FormField control={gradeForm.control} name='grade' render={({ field }) => (
                              <FormItem>
                                <FormLabel className='sr-only'>Grade</FormLabel>
                                <FormControl>
                                  <Input autoFocus placeholder='Grade' maxLength={1} autoComplete='off' disabled={gradeMutation.isPending} {...field} onChange={(event) => field.onChange(event.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 1))} />
                                </FormControl>
                                <FormMessage className='text-xs' />
                              </FormItem>
                            )} />
                            <FormField control={gradeForm.control} name='targetPcs' render={({ field }) => (
                              <FormItem>
                                <FormLabel className='sr-only'>Pieces</FormLabel>
                                <FormControl>
                                  <NumberStepperInput
                                    ariaLabel='Grade pieces'
                                    value={field.value}
                                    onChange={field.onChange}
                                    min={1}
                                    max={packetData.summary.unplannedPackets}
                                    step={1}
                                    suffix='PCs'
                                    disabled={gradeMutation.isPending}
                                  />
                                </FormControl>
                                <FormMessage className='text-xs' />
                              </FormItem>
                            )} />
                          </div>
                          <div className='mt-2 flex items-center justify-between gap-2'>
                            <p className='text-xs text-muted-foreground'>
                              {packetData.summary.unplannedPackets} PCs available
                            </p>
                            <Button type='submit' size='sm' disabled={gradeMutation.isPending}>
                              {gradeMutation.isPending ? <Loader2 className='animate-spin' /> : <Plus />}
                              Add Grade
                            </Button>
                          </div>
                        </form>
                      </Form>
                    ) : (
                      <Button
                        type='button'
                        variant='outline'
                        className='w-full'
                        onClick={() => {
                          setIsAddingGrade(true)
                          window.setTimeout(() => gradeForm.setFocus('grade'), 0)
                        }}
                      >
                        <Plus /> Add Grade
                      </Button>
                    )}
                  </div>
                </section>
              </aside>

              <section className='min-w-0 rounded-lg border bg-background justify-center p-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden'>
                {activeGrade ? (
                  <>
                    <div className='mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-2.5'>
                      <div>
                        <div className='flex items-center gap-3'>
                          <span className='flex size-10 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground'>
                            {activeGrade.grade}
                          </span>
                          <div>
                            <div className='flex flex-wrap items-center gap-2'>
                              <h3 className='font-semibold'>Grade {activeGrade.grade} Packets</h3>
                              {activeGrade.complete && (
                                <Badge className='border-transparent bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:text-emerald-950'>
                                  Total {formatCarat(gradeCaratTotals[activeGrade.grade] ?? 0)} CT
                                </Badge>
                              )}
                            </div>
                            {/* <p className='text-sm text-muted-foreground'>Enter carat in the next available packet.</p> */}
                          </div>
                        </div>
                      </div>
                      <Badge variant={activeGrade.complete ? 'default' : 'secondary'}>
                        {activeGrade.createdPackets} / {activeGrade.targetPcs} PCs
                      </Badge>
                    </div>

                    <div className='grid auto-rows-max content-start grid-cols-2 gap-3 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pe-1 xl:grid-cols-4 2xl:grid-cols-5'>
                      {Array.from({ length: activeGrade.targetPcs }, (_, index) => {
                        const packet = activeGradePackets[index]
                        const isNext = index === activeGradePackets.length

                        if (packet) {
                          return (
                            <CompletedPacketBox
                              key={packet.id}
                              packet={packet}
                              position={index + 1}
                              canEdit={canUpdate && lot.status === 'active'}
                              onEdit={() => {
                                setPacketToEdit({ packet, position: index + 1 })
                                editPacketForm.reset({ carat: packet.carat })
                              }}
                            />
                          )
                        }

                        if (isNext && !activeGrade.complete) {
                          return (
                            <NextPacketBox
                              key={`${activeGrade.id}-${index}`}
                              lot={lot}
                              lotId={lotId}
                              grade={activeGrade}
                              position={index + 1}
                              canCreate={canCreate}
                              assortmentComplete={packetData.summary.complete}
                            />
                          )
                        }

                        return (
                          <WaitingPacketBox
                            key={`${activeGrade.id}-${index}`}
                            grade={activeGrade.grade}
                            position={index + 1}
                          />
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className='flex min-h-64 flex-col items-center justify-center text-center'>
                    <Plus className='mb-3 size-9 text-muted-foreground' />
                    <h3 className='font-semibold'>Add the first grade</h3>
                    <p className='mt-1 text-sm text-muted-foreground'>Its complete packet box count will appear here automatically.</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </Main>
      {gradeToEdit && packetData && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !updateGradeMutation.isPending) {
              setGradeToEdit(null)
              editGradeForm.reset({ targetPcs: Number.NaN })
            }
          }}
        >
          <DialogContent className='sm:max-w-md'>
            <DialogHeader className='text-start'>
              <DialogTitle>Edit Grade {gradeToEdit.grade} PCS</DialogTitle>
              <DialogDescription>
                Change how many packets belong to this grade.
              </DialogDescription>
            </DialogHeader>
            <Form {...editGradeForm}>
              <form
                id='edit-grade-form'
                onSubmit={editGradeForm.handleSubmit((values) => updateGradeMutation.mutate(values))}
                className='space-y-2'
              >
                <FormField control={editGradeForm.control} name='targetPcs' render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pieces</FormLabel>
                    <FormControl>
                      <NumberStepperInput
                        ariaLabel={`Grade ${gradeToEdit.grade} pieces`}
                        value={field.value}
                        onChange={field.onChange}
                        min={Math.max(gradeToEdit.createdPackets, 1)}
                        max={gradeToEdit.targetPcs + packetData.summary.unplannedPackets}
                        step={1}
                        suffix='PCs'
                        disabled={updateGradeMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <p className='text-xs text-muted-foreground'>
                  {gradeToEdit.createdPackets} already created · Maximum {gradeToEdit.targetPcs + packetData.summary.unplannedPackets} PCs
                </p>
              </form>
            </Form>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                disabled={updateGradeMutation.isPending}
                onClick={() => setGradeToEdit(null)}
              >
                Cancel
              </Button>
              <Button type='submit' form='edit-grade-form' disabled={updateGradeMutation.isPending}>
                {updateGradeMutation.isPending && <Loader2 className='animate-spin' />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {packetToEdit && packetData && (
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
              <DialogTitle>
                Edit Packet {packetToEdit.packet.grade}-{packetToEdit.position}
              </DialogTitle>
              <DialogDescription>
                Update this created packet&apos;s carat weight.
              </DialogDescription>
            </DialogHeader>
            <Form {...editPacketForm}>
              <form
                id='edit-packet-form'
                onSubmit={editPacketForm.handleSubmit((values) => updatePacketMutation.mutate(values))}
              >
                <FormField control={editPacketForm.control} name='carat' render={({ field }) => (
                  <FormItem>
                    <FormLabel>Packet Carat</FormLabel>
                    <FormControl>
                      <NumberStepperInput
                        ariaLabel={`Packet ${packetToEdit.packet.grade}-${packetToEdit.position} carat`}
                        value={field.value}
                        onChange={field.onChange}
                        min={0.001}
                        max={packetToEdit.packet.carat + packetData.summary.remainingCarat}
                        step={0.10}
                        suffix='CT'
                        disabled={updatePacketMutation.isPending}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
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
              <Button type='submit' form='edit-packet-form' disabled={updatePacketMutation.isPending}>
                {updatePacketMutation.isPending && <Loader2 className='animate-spin' />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {gradeToDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && !deleteGradeMutation.isPending && setGradeToDelete(null)}
          handleConfirm={() => deleteGradeMutation.mutate(gradeToDelete)}
          isLoading={deleteGradeMutation.isPending}
          title={(
            <span className='text-destructive'>
              <AlertTriangle className='me-1 inline-block' size={18} /> Delete Grade {gradeToDelete.grade}
            </span>
          )}
          desc={(
            <>
              Delete Grade <strong>{gradeToDelete.grade}</strong>?
              {gradeToDelete.createdPackets > 0 && (
                <> Its <strong>{gradeToDelete.createdPackets}</strong> packet carat {gradeToDelete.createdPackets === 1 ? 'entry' : 'entries'} will also be permanently deleted.</>
              )}{' '}
              This action cannot be undone.
            </>
          )}
          confirmText='Delete Grade'
          destructive
        />
      )}
    </div>
  )
}

function CompletedPacketBox({
  packet,
  position,
  canEdit,
  onEdit,
}: {
  packet: AssortmentPacket
  position: number
  canEdit: boolean
  onEdit: () => void
}) {
  return (
    <div className='min-h-32 rounded-lg border border-emerald-300 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/20'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-lg font-bold'>{packet.grade}-{position}</span>
        <div className='flex items-center gap-1'>
          {canEdit && (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-7 text-muted-foreground hover:text-foreground'
              aria-label={`Edit Packet ${packet.grade}-${position}`}
              onClick={onEdit}
            >
              <Pencil className='size-3.5' />
            </Button>
          )}
          <CheckCircle2 className='size-4 text-emerald-600' />
        </div>
      </div>
      <p className='mt-1 text-xs text-muted-foreground'>Packet number</p>
      <p className='mt-5 text-lg font-bold'>{formatCarat(packet.carat)} CT</p>
    </div>
  )
}

function NextPacketBox({
  lot,
  lotId,
  grade,
  position,
  canCreate,
  assortmentComplete,
}: {
  lot: Lot
  lotId: string
  grade: GradeProgress
  position: number
  canCreate: boolean
  assortmentComplete: boolean
}) {
  const queryClient = useQueryClient()
  const form = useForm<CaratForm>({
    resolver: zodResolver(caratFormSchema),
    defaultValues: { carat: Number.NaN },
  })
  const mutation = useMutation({
    mutationFn: (values: CaratForm) =>
      createLotPacket(lotId, { grade: grade.grade, carat: values.carat }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: lotPacketsQueryKey(lotId) })
      form.reset({ carat: Number.NaN })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
  const disabled =
    !canCreate ||
    lot.status === 'closed' ||
    grade.complete ||
    assortmentComplete ||
    mutation.isPending

  return (
    <div className='min-h-32 rounded-lg border-2 border-primary bg-primary/5 p-3 shadow-sm'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-lg font-bold'>{grade.grade}-{position}</span>
        <Badge className='px-2 py-0 text-[10px]'>NEXT</Badge>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='mt-3 space-y-2'>
          <FormField control={form.control} name='carat' render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className='sr-only'>Packet {grade.grade}-{position} carat</FormLabel>
              <FormControl>
                <NumberStepperInput
                  ariaLabel={`Packet ${grade.grade}-${position} carat`}
                  value={field.value}
                  onChange={field.onChange}
                  min={0.001}
                  step={0.10}
                  suffix='CT'
                  disabled={disabled}
                  autoFocus
                  invalid={fieldState.invalid}
                />
              </FormControl>
            </FormItem>
          )} />
          <Button type='submit' size='sm' className='w-full' disabled={disabled}>
            {mutation.isPending ? <Loader2 className='animate-spin' /> : <PackagePlus />}
            Add Carat
          </Button>
        </form>
      </Form>
    </div>
  )
}

function WaitingPacketBox({ grade, position }: { grade: string; position: number }) {
  return (
    <div className='min-h-32 rounded-lg border border-dashed bg-muted/20 p-3 text-muted-foreground'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-lg font-bold'>{grade}-{position}</span>
        <LockKeyhole className='size-3.5' />
      </div>
      <div className='flex h-20 items-center justify-center'>
        <span className='flex items-center gap-1.5 text-xs'><Check className='size-3.5 opacity-0' />Waiting</span>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, progress }: { label: string; value: string; progress?: number }) {
  return (
    <div className='rounded-md border px-3 py-2'>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='mt-0.5 text-sm font-semibold'>{value}</p>
      {progress !== undefined && (
        <div className='mt-1.5 h-1 overflow-hidden rounded-full bg-muted'>
          <div className='h-full rounded-full bg-primary transition-all' style={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }} />
        </div>
      )}
    </div>
  )
}
