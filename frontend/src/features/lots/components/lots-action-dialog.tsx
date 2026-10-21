import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/services/auth-service'
import { createLot, lotsQueryKey } from '@/services/lots-service'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/date-picker'
import { NumberStepperInput } from '@/components/number-stepper-input'
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

const formSchema = z.object({
  kapanNo: z
    .string()
    .trim()
    .length(2, 'Kapan No must contain exactly 2 letters.')
    .regex(/^[A-Z]{2}$/, 'Only letters from A to Z are allowed.'),
  totalCarat: z.number({ error: 'Total Carat is required.' }).positive('Total Carat must be greater than 0.').multipleOf(0.001, 'Use up to 3 decimal places.'),
  totalPcs: z.number({ error: 'Total PCs is required.' }).int('Total PCs must be a whole number.').positive('Total PCs must be at least 1.'),
  entryDate: z.date(),
})

type LotForm = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LotsActionDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const form = useForm<LotForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      kapanNo: '',
      totalCarat: Number.NaN,
      totalPcs: Number.NaN,
      entryDate: new Date(),
    },
  })

  const mutation = useMutation({
    mutationFn: (values: LotForm) => {
      const base = {
        kapanNo: values.kapanNo.trim().toUpperCase(),
        totalCarat: values.totalCarat,
        totalPcs: values.totalPcs,
      }
      return createLot({ ...base, entryDate: values.entryDate.toISOString() })
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: lotsQueryKey })
      toast.success(response.message)
      form.reset()
      onOpenChange(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={(state) => {
      if (!mutation.isPending) {
        if (!state) form.reset()
        onOpenChange(state)
      }
    }}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>Create Lot</DialogTitle>
          <DialogDescription>Register a new master Kapan entry.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='lot-form'
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className='space-y-4'
          >
            <FormField control={form.control} name='kapanNo' render={({ field }) => (
              <FormItem className='grid grid-cols-6 items-center gap-x-4 gap-y-1 space-y-0'>
                <FormLabel className='col-span-2 text-end'>Kapan No</FormLabel>
                <FormControl>
                  <Input
                    className='col-span-4 uppercase'
                    placeholder='AA'
                    maxLength={2}
                    autoComplete='off'
                    {...field}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2)
                      )
                    }
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )} />

            <NumberField form={form} name='totalCarat' label='Total Carat' suffix='CT' step={0.1} />
            <NumberField form={form} name='totalPcs' label='Total PCs' suffix='PCs' step={1} />

            <FormField control={form.control} name='entryDate' render={({ field }) => (
              <FormItem className='grid grid-cols-6 items-center gap-x-4 gap-y-1 space-y-0'>
                <FormLabel className='col-span-2 text-end'>Entry Date</FormLabel>
                <FormControl>
                  <div className='col-span-4'><DatePicker selected={field.value} onSelect={field.onChange} disabled /></div>
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )} />

          </form>
        </Form>
        <DialogFooter>
          <Button type='submit' form='lot-form' disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className='animate-spin' />}
            Create lot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type NumberFieldProps = {
  form: ReturnType<typeof useForm<LotForm>>
  name: 'totalCarat' | 'totalPcs'
  label: string
  suffix: string
  step: number
}

function NumberField({ form, name, label, suffix, step }: NumberFieldProps) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className='grid grid-cols-6 items-center gap-x-4 gap-y-1 space-y-0'>
        <FormLabel className='col-span-2 text-end'>{label}</FormLabel>
        <FormControl>
          <NumberStepperInput
            className='col-span-4'
            ariaLabel={label}
            value={typeof field.value === 'number' ? field.value : Number.NaN}
            onChange={field.onChange}
            min={step}
            step={step}
            suffix={suffix}
          />
        </FormControl>
        <FormMessage className='col-span-4 col-start-3' />
      </FormItem>
    )} />
  )
}
