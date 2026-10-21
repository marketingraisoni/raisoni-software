import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  ref?: React.Ref<HTMLInputElement>
  disableAutofill?: boolean
}

export function PasswordInput({
  className,
  disabled,
  ref,
  onFocus,
  onBlur,
  autoComplete,
  disableAutofill = true,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false)
  const isAutoFillDisabled = disableAutofill && autoComplete !== 'current-password'
  const [isReadOnly, setIsReadOnly] = React.useState(isAutoFillDisabled)

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (isAutoFillDisabled) {
      setTimeout(() => {
        setIsReadOnly(false)
      }, 50)
    }
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (isAutoFillDisabled) {
      setIsReadOnly(true)
    }
    onBlur?.(e)
  }

  return (
    <div className={cn('relative rounded-md', className)}>
      <input
        {...props}
        type={showPassword ? 'text' : 'password'}
        autoComplete={isAutoFillDisabled ? (autoComplete || 'one-time-code') : autoComplete}
        readOnly={props.readOnly ?? isReadOnly}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-lpignore={isAutoFillDisabled ? 'true' : (props as Record<string, unknown>)['data-lpignore']}
        data-1p-ignore={isAutoFillDisabled ? 'true' : (props as Record<string, unknown>)['data-1p-ignore']}
        data-bwignore={isAutoFillDisabled ? 'true' : (props as Record<string, unknown>)['data-bwignore']}
        data-form-type={isAutoFillDisabled ? 'other' : (props as Record<string, unknown>)['data-form-type']}
        spellCheck={false}
        className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50'
        ref={ref}
        disabled={disabled}
      />
      <Button
        type='button'
        size='icon'
        variant='ghost'
        disabled={disabled}
        className='absolute inset-e-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md text-muted-foreground'
        onClick={() => setShowPassword((prev) => !prev)}
      >
        {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
        <span className='sr-only'>
          {showPassword ? 'Hide password' : 'Show password'}
        </span>
      </Button>
    </div>
  )
}
