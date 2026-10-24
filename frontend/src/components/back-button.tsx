import type { ComponentProps, ReactNode } from 'react'
import {
  type NavigateOptions,
  type RegisteredRouter,
  useCanGoBack,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BackButtonProps<TTo extends string> = Omit<
  ComponentProps<typeof Button>,
  'onClick'
> & {
  fallback: NavigateOptions<RegisteredRouter, string, TTo>
  label?: string
  children?: ReactNode
}

export function BackButton<const TTo extends string>({
  fallback,
  label = 'Go back',
  children,
  variant = 'outline',
  size = children ? 'default' : 'icon',
  type = 'button',
  ...props
}: BackButtonProps<TTo>) {
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  const router = useRouter()

  const handleBack = () => {
    if (canGoBack) {
      router.history.back()
      return
    }

    void navigate(fallback)
  }

  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      aria-label={label}
      onClick={handleBack}
      {...props}
    >
      <ArrowLeft />
      {children}
    </Button>
  )
}
