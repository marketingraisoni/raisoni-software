import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/services/auth-service'
import { useAuthStore } from '@/stores/auth-store'
import {
  createUser,
  updateUser,
  usersQueryKey,
} from '@/services/users-service'
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
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { SelectDropdown } from '@/components/select-dropdown'
import { USER_TYPE } from '@/constants/user-types'
import { userTypes } from '../data/data'
import {
  type User,
  userStatusSchema,
  userTypeSchema,
} from '../data/schema'

const formSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters.')
      .max(30, 'Username cannot exceed 30 characters.'),
    email: z.string().email('Please enter a valid email address.'),
    password: z.string(),
    confirmPassword: z.string(),
    userType: userTypeSchema,
    status: userStatusSchema,
    notes: z.string().max(500, 'Notes cannot exceed 500 characters.').optional(),
    isEdit: z.boolean(),
  })
  .refine(
    ({ isEdit, username }) => isEdit || !/\s/.test(username),
    {
      message: 'Username cannot contain spaces.',
      path: ['username'],
    }
  )
  .refine(
    ({ isEdit, username }) => isEdit || username === username.toLowerCase(),
    {
      message: 'Username must be lowercase.',
      path: ['username'],
    }
  )
  .refine(
    ({ isEdit, username }) => isEdit || (/[a-z]/.test(username) && /\d/.test(username)),
    {
      message: 'Username must contain both letters and numbers (e.g. john123).',
      path: ['username'],
    }
  )
  .refine(
    ({ isEdit, username }) => isEdit || /^[a-z0-9._-]+$/.test(username),
    {
      message: 'Username can only contain lowercase letters, numbers, and ._-',
      path: ['username'],
    }
  )
  .refine(({ isEdit, password }) => isEdit || password.length >= 6, {
    message: 'Password must be at least 6 characters.',
    path: ['password'],
  })
  .refine(
    ({ password }) => password.length === 0 || password.length >= 6,
    {
      message: 'Password must be at least 6 characters.',
      path: ['password'],
    }
  )
  .refine(
    ({ password, confirmPassword }) => password === confirmPassword,
    {
      message: "Passwords don't match.",
      path: ['confirmPassword'],
    }
  )

type UserForm = z.infer<typeof formSchema>

type UserActionDialogProps = {
  currentRow?: User
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersActionDialog({
  currentRow,
  open,
  onOpenChange,
}: UserActionDialogProps) {
  const isEdit = !!currentRow
  const queryClient = useQueryClient()
  const currentUserType = useAuthStore((state) => state.auth.user?.userType)
  const assignableUserTypes = userTypes.filter(
    ({ value }) =>
      currentUserType === USER_TYPE.SUPER_ADMIN || value !== USER_TYPE.SUPER_ADMIN
  )
  const form = useForm<UserForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: currentRow?.name || '',
      username: currentRow?.username || '',
      email: currentRow?.email || '',
      userType: currentRow?.userType || USER_TYPE.STAFF,
      status: currentRow?.status || 'active',
      notes: currentRow?.notes || '',
      password: '',
      confirmPassword: '',
      isEdit,
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: UserForm) => {
      if (currentRow) {
        return updateUser(currentRow.id, {
          name: values.name,
          email: values.email,
          userType: values.userType,
          status: values.status,
          notes: values.notes,
          ...(values.password ? { password: values.password } : {}),
        })
      }

      return createUser({
        name: values.name,
        username: values.username,
        email: values.email,
        password: values.password,
        userType: values.userType,
        status: values.status,
        notes: values.notes,
      })
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
      toast.success(response.message)
      form.reset()
      onOpenChange(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!mutation.isPending) {
          if (!state) form.reset()
          onOpenChange(state)
        }
      }}
    >
      <DialogContent
        className='sm:max-w-lg'
        onOpenAutoFocus={(e) => {
          if (isEdit) {
            e.preventDefault()
          }
        }}
      >
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? 'Edit User' : 'Add New User'}</DialogTitle>
          <DialogDescription className='sr-only'>
            {isEdit
              ? 'Update this account, user type, and status.'
              : 'Create a user who can sign in to Raisoni ERP.'}
          </DialogDescription>
        </DialogHeader>
        <div className='max-h-[65vh] w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='user-form'
              autoComplete='off'
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className='space-y-4 px-0.5'
            >
              {/* Decoy inputs to absorb Chrome autofill heuristics */}
              <div className='sr-only' aria-hidden='true'>
                <input
                  type='text'
                  name='chrome_prevent_autofill_user'
                  tabIndex={-1}
                  autoComplete='off'
                />
                <input
                  type='password'
                  name='chrome_prevent_autofill_pass'
                  tabIndex={-1}
                  autoComplete='off'
                />
              </div>

              <UserTextField
                form={form}
                name='name'
                label='Full Name'
                placeholder='John Doe'
              />
              <UserTextField
                form={form}
                name='username'
                label='Username'
                placeholder='john123'
                disabled={isEdit}
              />
              <UserTextField
                form={form}
                name='email'
                label='Email'
                placeholder='john@example.com'
                type='email'
              />

              <FormField
                control={form.control}
                name='userType'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center gap-x-4 gap-y-1 space-y-0'>
                    <FormLabel className='col-span-2 text-end'>User Type</FormLabel>
                    <SelectDropdown
                      defaultValue={String(field.value)}
                      onValueChange={(value) => field.onChange(Number(value))}
                      placeholder='Select a user type'
                      className='col-span-4'
                      items={assignableUserTypes.map(({ label, value }) => ({
                        label,
                        value: String(value),
                      }))}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center gap-x-4 gap-y-1 space-y-0'>
                    <FormLabel className='col-span-2 text-end'>Status</FormLabel>
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      className='col-span-4'
                      items={[
                        { label: 'Active', value: 'active' },
                        { label: 'Inactive', value: 'inactive' },
                      ]}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center gap-x-4 gap-y-1 space-y-0'>
                    <FormLabel className='col-span-2 text-end'>
                      {isEdit ? 'New Password' : 'Password'}
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete='one-time-code'
                        disableAutofill
                        placeholder={isEdit ? 'Leave blank to keep current' : 'Minimum 6 characters'}
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center gap-x-4 gap-y-1 space-y-0'>
                    <FormLabel className='col-span-2 text-end'>Confirm</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete='one-time-code'
                        disableAutofill
                        placeholder='Repeat password'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='user-form' disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className='animate-spin' />}
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type UserTextFieldProps = {
  form: ReturnType<typeof useForm<UserForm>>
  name: 'name' | 'username' | 'email'
  label: string
  placeholder: string
  type?: React.HTMLInputTypeAttribute
  disabled?: boolean
}

function UserTextField({
  form,
  name,
  label,
  placeholder,
  type = 'text',
  disabled,
}: UserTextFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className='grid grid-cols-6 items-center gap-x-4 gap-y-1 space-y-0'>
          <FormLabel className='col-span-2 text-end'>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              autoComplete='off'
              data-lpignore='true'
              className='col-span-4'
              {...field}
              onChange={(e) => {
                if (name === 'username') {
                  const sanitized = e.target.value.toLowerCase().replace(/\s+/g, '')
                  field.onChange(sanitized)
                } else {
                  field.onChange(e)
                }
              }}
              onKeyDown={(e) => {
                if (name === 'username' && e.key === ' ') {
                  e.preventDefault()
                }
              }}
            />
          </FormControl>
          <FormMessage className='col-span-4 col-start-3' />
        </FormItem>
      )}
    />
  )
}
