import { formatDate } from '@/lib/format-date'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type DatePickerProps = {
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  disablePast?: boolean
  disableFuture?: boolean
  allowFuture?: boolean
  minDate?: Date
  maxDate?: Date
  disabledDays?: (date: Date) => boolean
}

export function DatePicker({
  selected,
  onSelect,
  placeholder = 'Pick a date',
  disabled = false,
  className,
  disablePast = false,
  disableFuture = false,
  allowFuture,
  minDate,
  maxDate,
  disabledDays,
}: DatePickerProps) {
  // If allowFuture is explicitly provided as false, or disableFuture is true
  const shouldDisableFuture =
    disableFuture || (allowFuture === false)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          disabled={disabled}
          data-empty={!selected}
          className={cn(
            'w-full justify-start text-start font-normal data-[empty=true]:text-muted-foreground',
            className
          )}
        >
          {selected ? (
            formatDate(selected)
          ) : (
            <span>{placeholder}</span>
          )}
          <CalendarIcon className='ms-auto h-4 w-4 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='single'
          captionLayout='dropdown'
          selected={selected}
          onSelect={onSelect}
          disabled={(date: Date) => {
            // Absolute sanity check
            if (date < new Date('1900-01-01')) return true

            // Disable all past days (before start of today)
            if (disablePast) {
              const todayStart = new Date()
              todayStart.setHours(0, 0, 0, 0)
              if (date < todayStart) return true
            }

            // Disable all future days (after end of today)
            if (shouldDisableFuture) {
              const todayEnd = new Date()
              todayEnd.setHours(23, 59, 59, 999)
              if (date > todayEnd) return true
            }

            // Disable days before minDate
            if (minDate) {
              const minStart = new Date(minDate)
              minStart.setHours(0, 0, 0, 0)
              const d = new Date(date)
              d.setHours(0, 0, 0, 0)
              if (d < minStart) return true
            }

            // Disable days after maxDate
            if (maxDate) {
              const maxEnd = new Date(maxDate)
              maxEnd.setHours(23, 59, 59, 999)
              if (date > maxEnd) return true
            }

            // Custom matcher callback if needed
            if (disabledDays && disabledDays(date)) {
              return true
            }

            return false
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
