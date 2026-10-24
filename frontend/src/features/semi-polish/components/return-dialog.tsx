import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownToLine,
  Loader2,
  TrendingDown,
} from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { getApiErrorMessage } from '@/services/auth-service'
import {
  receiveFromSemiPolish,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import { formatCarat } from '@/lib/format-carat'
import { formatDate } from '@/lib/format-date'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/date-picker'
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
import { NumberStepperInput } from '@/components/number-stepper-input'
import { Textarea } from '@/components/ui/textarea'
import { type SemiPolishProcess } from '../data/schema'
import { ProcessSummary } from './process-summary'

const startOfDay = (date: Date) => {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function createReturnFormSchema(issuedCarat: number, issueDate?: Date) {
  return z
    .object({
      returnedPieces: z
        .number({ error: 'Returned pieces are required.' })
        .int('Returned pieces must be a whole number.')
        .positive('Returned pieces must be at least 1.'),
      returnedCarat: z
        .number({ error: 'Returned carat is required.' })
        .positive('Returned carat must be greater than 0.')
        .max(issuedCarat, 'Returned carat cannot exceed the issued carat.')
        .multipleOf(0.001, 'Use up to 3 decimal places.'),
      returnDate: z.date({ error: 'Return date is required.' }),
      returnNotes: z
        .string()
        .trim()
        .max(500, 'Return remarks cannot exceed 500 characters.'),
    })
    .superRefine((values, context) => {
      const returnDate = startOfDay(values.returnDate)
      if (issueDate && returnDate < startOfDay(issueDate)) {
        context.addIssue({
          code: 'custom',
          path: ['returnDate'],
          message: 'Return date cannot be earlier than the issue date.',
        })
      }

      if (returnDate > startOfDay(new Date())) {
        context.addIssue({
          code: 'custom',
          path: ['returnDate'],
          message: 'Return date cannot be in the future.',
        })
      }
    })
}

type ReturnForm = z.infer<ReturnType<typeof createReturnFormSchema>>

type Props = {
  process: SemiPolishProcess | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReturnDialog({ process, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const issuedCarat = process?.issuedCarat ?? 0
  const issuedPieces = process?.issuedPieces ?? 0
  const returnSchema = useMemo(
    () => createReturnFormSchema(issuedCarat, process?.issueDate),
    [issuedCarat, process?.issueDate]
  )
  const form = useForm<ReturnForm>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      returnedPieces: Number.NaN,
      returnedCarat: Number.NaN,
      returnDate: new Date(),
      returnNotes: '',
    },
  })
  const returnedPieces = useWatch({ control: form.control, name: 'returnedPieces' })
  const returnedCarat = useWatch({ control: form.control, name: 'returnedCarat' })

  const resetForm = () => {
    form.reset({
      returnedPieces: process?.issuedPieces ?? Number.NaN,
      returnedCarat: Number.NaN,
      returnDate: new Date(),
      returnNotes: '',
    })
  }

  useEffect(() => {
    if (open) resetForm()
    // Reset only when the selected process opens the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, process])

  const receiveMutation = useMutation({
    mutationFn: (values: ReturnForm) => {
      const processId = process?._id || process?.id
      if (!processId) throw new Error('Missing process ID')
      return receiveFromSemiPolish(processId, {
        returnedPieces: values.returnedPieces,
        returnedCarat: values.returnedCarat,
        returnDate: values.returnDate.toISOString(),
        returnNotes: values.returnNotes,
      })
    },
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: semiPolishQueryKeys.all })
      toast.success(
        `Return recorded for ${updated.issueNo}. Loss: ${formatCarat(
          updated.processLossCarat ?? 0
        )} CT (${updated.processLossPercentage ?? 0}%)`
      )
      form.reset()
      onOpenChange(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (receiveMutation.isPending) return
    if (!nextOpen) form.reset()
    onOpenChange(nextOpen)
  }

  const hasReturnedPieces = Number.isFinite(returnedPieces)
  const hasReturnedCarat = Number.isFinite(returnedCarat) && returnedCarat > 0
  const piecesDifference = hasReturnedPieces ? returnedPieces - issuedPieces : 0
  const lossCarat = hasReturnedCarat
    ? Math.round((issuedCarat - returnedCarat) * 1000) / 1000
    : 0
  const lossPercentage =
    hasReturnedCarat && issuedCarat > 0
      ? Math.round((lossCarat / issuedCarat) * 10000) / 100
      : 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader className='text-start'>
          <div className='flex items-start gap-3'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'>
              <ArrowDownToLine className='size-5' />
            </div>
            <div className='space-y-1'>
              <DialogTitle>Receive 4P return</DialogTitle>
              <DialogDescription>
                Record the returned material and review the calculated process loss.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {process && (
          <ProcessSummary
            title={`Issue ${process.issueNo} · ${formatDate(process.issueDate)}`}
            items={[
              { label: 'Lot No', value: process.kapanNo },
              {
                label: 'Vendor',
                value: process.vendorName,
                title: process.vendorName,
              },
              {
                label: 'Issued Material',
                value: `${formatCarat(process.issuedCarat)} CT · ${process.issuedPieces} Pkt`,
                accent: true,
              },
            ]}
          />
        )}

        {process && (
          <Form {...form}>
            <form
              id='semi-polish-return-form'
              className='space-y-5'
              onSubmit={form.handleSubmit((values) => receiveMutation.mutate(values))}
            >
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='returnedPieces'
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Returned pieces</FormLabel>
                      <FormControl>
                        <NumberStepperInput
                          ariaLabel='Returned pieces'
                          value={field.value}
                          onChange={field.onChange}
                          min={1}
                          step={1}
                          suffix='PCs'
                          invalid={fieldState.invalid}
                        />
                      </FormControl>
                      {piecesDifference !== 0 && hasReturnedPieces && (
                        <p className='flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400'>
                          <AlertTriangle className='size-3.5' />
                          {piecesDifference < 0
                            ? `${Math.abs(piecesDifference)} PCs missing`
                            : `${piecesDifference} extra PCs`}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='returnedCarat'
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Returned carat</FormLabel>
                      <FormControl>
                        <NumberStepperInput
                          ariaLabel='Returned carat'
                          value={field.value}
                          onChange={field.onChange}
                          min={0.001}
                          max={issuedCarat}
                          step={0.001}
                          suffix='CT'
                          autoFocus
                          invalid={fieldState.invalid}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {hasReturnedCarat && returnedCarat <= issuedCarat && (
                <div className='rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3'>
                  <div className='flex items-center justify-between gap-3 text-sm'>
                    <span className='flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300'>
                      <TrendingDown className='size-4' />
                      Process loss
                    </span>
                    <span className='font-semibold text-emerald-700 dark:text-emerald-300'>
                      {formatCarat(lossCarat)} CT · {lossPercentage}%
                    </span>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name='returnDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Return date</FormLabel>
                    <FormControl>
                      <DatePicker
                        selected={field.value}
                        onSelect={(date) => date && field.onChange(date)}
                        disableFuture
                        minDate={process.issueDate}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='returnNotes'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality / return remarks (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Add quality observations or return notes'
                        className='min-h-20 resize-y'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )}

        <DialogFooter className='gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type='submit'
            form='semi-polish-return-form'
            className='bg-emerald-600 text-white hover:bg-emerald-700'
            disabled={receiveMutation.isPending || !process}
          >
            {receiveMutation.isPending && <Loader2 className='animate-spin' />}
            {receiveMutation.isPending ? 'Recording…' : 'Confirm return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
