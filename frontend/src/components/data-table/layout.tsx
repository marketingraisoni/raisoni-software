import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DataTableLayoutProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  toolbar?: ReactNode
  pagination?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function DataTableLayout({
  title,
  description,
  actions,
  toolbar,
  pagination,
  children,
  className,
  contentClassName,
}: DataTableLayoutProps) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-background',
        className
      )}
    >
      <div className='flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
        <div className='min-w-0'>
          <h2 className='truncate text-xl font-bold tracking-tight'>{title}</h2>
          {description ? (
            <p className='text-muted-foreground'>{description}</p>
          ) : null}
        </div>
        {actions ? <div className='flex items-center gap-2'>{actions}</div> : null}
      </div>

      {toolbar ? <div className='border-b p-3'>{toolbar}</div> : null}

      <div className={cn('min-h-0 flex-1 overflow-auto', contentClassName)}>
        {children}
      </div>

      {pagination ? (
        <div className='mt-auto border-t p-3'>{pagination}</div>
      ) : null}
    </section>
  )
}
