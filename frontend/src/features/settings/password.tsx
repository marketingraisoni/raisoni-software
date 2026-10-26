import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import {
  changeCurrentUserPassword,
  getApiErrorMessage,
} from '@/services/auth-service'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PasswordInput } from '@/components/password-input'

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(6, 'New password must be at least 6 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine(
    ({ newPassword, confirmPassword }) => newPassword === confirmPassword,
    {
      message: 'Passwords do not match.',
      path: ['confirmPassword'],
    }
  )
  .refine(
    ({ currentPassword, newPassword }) => currentPassword !== newPassword,
    {
      message: 'New password must be different from the current password.',
      path: ['newPassword'],
    }
  )

type PasswordValues = z.infer<typeof passwordSchema>

export function PasswordSettingsPage() {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })
  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordValues) =>
      changeCurrentUserPassword({ currentPassword, newPassword }),
    onSuccess: (message) => {
      form.reset()
      toast.success(message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  return (
    <Card className='max-w-3xl'>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          Enter your current password before choosing a new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className='grid max-w-xl gap-5'
          >
            <PasswordField
              form={form}
              name='currentPassword'
              label='Current password'
              autoComplete='current-password'
            />
            <PasswordField
              form={form}
              name='newPassword'
              label='New password'
              autoComplete='new-password'
            />
            <PasswordField
              form={form}
              name='confirmPassword'
              label='Confirm new password'
              autoComplete='new-password'
            />
            <div>
              <Button type='submit' disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className='animate-spin' />}
                Change password
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function PasswordField({
  form,
  name,
  label,
  autoComplete,
}: {
  form: ReturnType<typeof useForm<PasswordValues>>
  name: keyof PasswordValues
  label: string
  autoComplete: 'current-password' | 'new-password'
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <PasswordInput
              autoComplete={autoComplete}
              disableAutofill={false}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
