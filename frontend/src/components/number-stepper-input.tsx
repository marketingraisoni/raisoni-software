import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'

type NumberStepperInputProps = {
  ariaLabel: string
  value: number
  onChange: (value: number) => void
  min: number
  max?: number
  step: number
  suffix: string
  disabled?: boolean
  autoFocus?: boolean
  invalid?: boolean
  className?: string
}

export function NumberStepperInput({
  ariaLabel,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  disabled,
  autoFocus,
  invalid,
  className,
}: NumberStepperInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasValue = Number.isFinite(value)
  const precision = step.toString().split('.')[1]?.length ?? 0
  const adjustValue = (direction: 1 | -1) => {
    const baseValue = hasValue ? value : min
    const adjustedValue = hasValue ? baseValue + direction * step : baseValue
    const clampedValue = Math.min(Math.max(adjustedValue, min), max ?? Number.POSITIVE_INFINITY)
    onChange(Number(clampedValue.toFixed(precision)))
  }

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [autoFocus, disabled])

  return (
    <div className={className}>
      <div className='relative'>
        <Input
          ref={inputRef}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          type='number'
          min={min}
          max={max}
          step='any'
          value={hasValue ? value : ''}
          disabled={disabled}
          className='h-9 pe-[4.5rem] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
          onChange={(event) => onChange(event.target.value === '' ? Number.NaN : event.target.valueAsNumber)}
        />
        <span className='pointer-events-none absolute inset-y-px end-8 flex w-10 items-center justify-center text-xs text-muted-foreground'>
          {suffix}
        </span>
        <div className='absolute inset-y-px end-px flex w-8 flex-col overflow-hidden rounded-e-[5px] border-s border-input bg-muted/20'>
          <button
            type='button'
            aria-label={`Increase ${ariaLabel}`}
            disabled={disabled || (hasValue && max !== undefined && value >= max)}
            className='flex min-h-0 flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40'
            onClick={() => adjustValue(1)}
          >
            <ChevronUp className='size-3.5' />
          </button>
          <button
            type='button'
            aria-label={`Decrease ${ariaLabel}`}
            disabled={disabled || (hasValue && value <= min)}
            className='flex min-h-0 flex-1 items-center justify-center border-t text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40'
            onClick={() => adjustValue(-1)}
          >
            <ChevronDown className='size-3.5' />
          </button>
        </div>
      </div>
    </div>
  )
}
