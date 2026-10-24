import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Building2, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { getApiErrorMessage } from '@/services/auth-service'
import {
  createVendor,
  fetchVendors,
  issueToSemiPolish,
  semiPolishQueryKeys,
} from '@/services/semi-polish-service'
import { formatCarat } from '@/lib/format-carat'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { optionalMobileSchema } from '@/lib/validators'
import { type EligibleLot, type Vendor } from '../data/schema'
import { ProcessSummary } from './process-summary'

const vendorFormSchema = z.object({
  name: z.string().trim().min(1, 'Vendor name is required.').max(100),
  mobile: optionalMobileSchema,
})

const startOfDay = (date: Date) => {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function createIssueFormSchema(entryDate?: string | Date) {
  return z
    .object({
      vendorId: z.string().min(1, 'Select a 4P vendor.'),
      issueDate: z.date({ error: 'Issue date is required.' }),
      expectedReturnDate: z.date().optional(),
      notes: z.string().trim().max(500, 'Instructions cannot exceed 500 characters.'),
    })
    .superRefine((values, context) => {
      const issueDate = startOfDay(values.issueDate)
      const today = startOfDay(new Date())

      if (issueDate < today) {
        context.addIssue({
          code: 'custom',
          path: ['issueDate'],
          message: 'Issue date must be today or a future date.',
        })
      }

      if (entryDate && issueDate < startOfDay(new Date(entryDate))) {
        context.addIssue({
          code: 'custom',
          path: ['issueDate'],
          message: 'Issue date cannot be earlier than the lot entry date.',
        })
      }

      if (
        values.expectedReturnDate &&
        startOfDay(values.expectedReturnDate) < issueDate
      ) {
        context.addIssue({
          code: 'custom',
          path: ['expectedReturnDate'],
          message: 'Expected return date cannot be earlier than the issue date.',
        })
      }
    })
}

type IssueForm = z.infer<ReturnType<typeof createIssueFormSchema>>
type VendorForm = z.infer<typeof vendorFormSchema>

type Props = {
  lot: EligibleLot | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const issueFormDefaults = (): IssueForm => ({
  vendorId: '',
  issueDate: new Date(),
  expectedReturnDate: undefined,
  notes: '',
})

export function IssueDialog({ lot, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isAddingVendor, setIsAddingVendor] = useState(false)
  const issueSchema = useMemo(
    () => createIssueFormSchema(lot?.entryDate),
    [lot?.entryDate]
  )
  const form = useForm<IssueForm>({
    resolver: zodResolver(issueSchema),
    defaultValues: issueFormDefaults(),
  })
  const vendorForm = useForm<VendorForm>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: { name: '', mobile: '' },
  })
  const issueDate = useWatch({ control: form.control, name: 'issueDate' })

  const { data: vendors = [], isLoading: isLoadingVendors } = useQuery({
    queryKey: semiPolishQueryKeys.vendors,
    queryFn: fetchVendors,
    enabled: open,
  })

  const resetDialog = () => {
    form.reset(issueFormDefaults())
    vendorForm.reset()
    setIsAddingVendor(false)
  }

  const createVendorMutation = useMutation({
    mutationFn: createVendor,
    onSuccess: async (newVendor) => {
      const vendorId = newVendor._id || newVendor.id
      queryClient.setQueryData(
        semiPolishQueryKeys.vendors,
        (oldVendors: Vendor[] = []) => {
          const exists = oldVendors.some(
            (v) => (v._id || v.id) === vendorId
          )
          if (exists) return oldVendors
          return [...oldVendors, newVendor].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        }
      )
      await queryClient.invalidateQueries({
        queryKey: semiPolishQueryKeys.vendors,
      })
      if (vendorId) {
        form.setValue('vendorId', vendorId, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
      toast.success(`Vendor "${newVendor.name}" ready`)
      vendorForm.reset({ name: '', mobile: '' })
      setIsAddingVendor(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const issueMutation = useMutation({
    mutationFn: issueToSemiPolish,
    onSuccess: async (process) => {
      const processId = process._id || process.id
      if (processId) {
        queryClient.setQueryData(semiPolishQueryKeys.detail(processId), process)
      }
      await queryClient.invalidateQueries({ queryKey: semiPolishQueryKeys.all })
      toast.success(
        `Lot ${process.kapanNo} issued to 4P with Issue No: ${process.issueNo}`
      )
      resetDialog()
      onOpenChange(false)
      if (processId) {
        await navigate({
          to: '/semi-polish/$processId',
          params: { processId },
        })
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (issueMutation.isPending || createVendorMutation.isPending) return
    if (!nextOpen) resetDialog()
    onOpenChange(nextOpen)
  }

  const handleIssue = (values: IssueForm) => {
    const lotId = lot?._id || lot?.id
    if (!lotId) {
      toast.error('Lot information is missing. Close the dialog and select the lot again.')
      return
    }

    issueMutation.mutate({
      lotId,
      vendorId: values.vendorId,
      issueDate: values.issueDate.toISOString(),
      expectedReturnDate: values.expectedReturnDate?.toISOString(),
      notes: values.notes,
    })
  }

  const minimumIssueDate = (() => {
    const today = startOfDay(new Date())
    if (!lot?.entryDate) return today
    const lotEntryDate = startOfDay(new Date(lot.entryDate))
    return lotEntryDate > today ? lotEntryDate : today
  })()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader className='text-start'>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <Sparkles className='size-5' />
            </div>
            <div className='space-y-1'>
              <DialogTitle>Issue to 4P Semi-Polish</DialogTitle>
              <DialogDescription className='sr-only'>
                Select or create a vendor and issue the selected lot for 4P
                semi-polish processing.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {lot && (
          <ProcessSummary
            title='Assorted lot summary'
            items={[
              { label: 'Lot No', value: lot.kapanNo },
              { label: 'Total Pieces', value: `${lot.totalPcs} PCs` },
              {
                label: 'Total Carat',
                value: `${formatCarat(lot.totalCarat)} CT`,
                accent: true,
              },
            ]}
          />
        )}

        {isAddingVendor ? (
          <Form key='vendor-form' {...vendorForm}>
            <form
              id='semi-polish-vendor-form'
              className='space-y-4 rounded-lg border bg-muted/10 p-4'
              onSubmit={(e) => {
                e.preventDefault()
                vendorForm.handleSubmit((values) =>
                  createVendorMutation.mutate(values)
                )(e)
              }}
            >
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center gap-2'>
                  <Building2 className='size-4 text-primary' />
                  <h3 className='text-sm font-semibold'>Add new 4P vendor</h3>
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label='Cancel adding vendor'
                  onClick={() => {
                    vendorForm.reset({ name: '', mobile: '' })
                    setIsAddingVendor(false)
                  }}
                >
                  <X className='size-4' />
                </Button>
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={vendorForm.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='Enter Vendor...'
                          autoComplete='organization'
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vendorForm.control}
                  name='mobile'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile number (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type='tel'
                          inputMode='tel'
                          placeholder='Enter mobile number...'
                          autoComplete='tel'
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <button type='submit' className='hidden' tabIndex={-1} aria-hidden='true' />
            </form>
          </Form>
        ) : (
          <Form key='issue-form' {...form}>
            <form
              id='semi-polish-issue-form'
              className='space-y-5'
              onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit(handleIssue)(e)
              }}
            >
              <FormField
                control={form.control}
                name='vendorId'
                render={({ field }) => (
                  <FormItem>
                    <div className='flex items-center justify-between gap-3'>
                      <FormLabel>4P vendor</FormLabel>
                      <Button
                        type='button'
                        variant='link'
                        size='sm'
                        className='h-auto p-0 text-xs'
                        onClick={() => setIsAddingVendor(true)}
                      >
                        <Plus className='size-3' />
                        Add vendor
                      </Button>
                    </div>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isLoadingVendors}
                    >
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue
                            placeholder={
                              isLoadingVendors ? 'Loading vendors…' : 'Select 4P vendor'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors.map((vendor) => {
                          const vendorId = vendor._id || vendor.id
                          if (!vendorId) return null
                          return (
                            <SelectItem key={vendorId} value={vendorId}>
                              {vendor.name}
                              {vendor.mobile ? ` · ${vendor.mobile}` : ''}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='issueDate'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue date</FormLabel>
                      <FormControl>
                        <DatePicker
                          selected={field.value}
                          onSelect={(date) => {
                            if (!date) return
                            field.onChange(date)
                            const expectedDate = form.getValues('expectedReturnDate')
                            if (expectedDate && startOfDay(expectedDate) < startOfDay(date)) {
                              form.setValue('expectedReturnDate', undefined)
                            }
                          }}
                          disablePast
                          minDate={minimumIssueDate}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='expectedReturnDate'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected return (optional)</FormLabel>
                      <FormControl>
                        <DatePicker
                          selected={field.value}
                          onSelect={field.onChange}
                          placeholder='Select expected date'
                          minDate={issueDate}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='notes'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions / remarks (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Add processing or handling instructions'
                        className='min-h-24 resize-y'
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
            onClick={() => {
              if (isAddingVendor) {
                vendorForm.reset({ name: '', mobile: '' })
                setIsAddingVendor(false)
              } else {
                handleOpenChange(false)
              }
            }}
          >
            Cancel
          </Button>
          {isAddingVendor ? (
            <Button
              type='button'
              disabled={createVendorMutation.isPending}
              onClick={() => {
                vendorForm.handleSubmit((values) =>
                  createVendorMutation.mutate(values)
                )()
              }}
            >
              {createVendorMutation.isPending && <Loader2 className='animate-spin' />}
              Save vendor
            </Button>
          ) : (
            <Button
              type='button'
              disabled={issueMutation.isPending || !lot}
              onClick={() => {
                form.handleSubmit(handleIssue)()
              }}
            >
              {issueMutation.isPending && <Loader2 className='animate-spin' />}
              {issueMutation.isPending ? 'Issuing…' : 'Issue to 4P'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
