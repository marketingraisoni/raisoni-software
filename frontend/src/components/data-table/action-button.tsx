import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Props = Omit<React.ComponentProps<typeof Button>, 'size' | 'variant'> & {
  tooltip: React.ReactNode
}

export function DataTableActionButton({
  tooltip,
  className,
  asChild = false,
  ...props
}: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...(!asChild ? { type: 'button' as const } : {})}
          {...props}
          asChild={asChild}
          size='icon'
          className={cn('size-8 cursor-pointer', className)}
        />
      </TooltipTrigger>
      <TooltipContent side='top' sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
