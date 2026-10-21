import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SummaryItem = {
  label: string
  value: ReactNode
  accent?: boolean
  title?: string
}

type ProcessSummaryProps = {
  title: string
  items: SummaryItem[]
  className?: string
}

export function ProcessSummary({
  title,
  items,
  className,
}: ProcessSummaryProps) {
  return (
    <Card className={cn('gap-0 bg-muted/25 py-0 shadow-none', className)}>
      <CardHeader className='grid-rows-1 gap-0 border-b px-4 pt-3 pb-3!'>
        <CardTitle className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className='grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-3'>
        {items.map((item) => (
          <div key={item.label} className='min-w-0'>
            <p className='text-xs text-muted-foreground'>{item.label}</p>
            <p
              className={cn(
                'truncate text-sm font-semibold text-foreground',
                item.accent && 'text-primary'
              )}
              title={item.title}
            >
              {item.value}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
