import { type ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Logo({
  className,
  alt = 'Raisoni Software',
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src='/images/logo.png'
      alt={alt}
      width={32}
      height={32}
      className={cn('size-8 rounded-sm object-contain', className)}
      {...props}
    />
  )
}
