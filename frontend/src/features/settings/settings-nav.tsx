import { Link, useLocation } from '@tanstack/react-router'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

type SettingsNavProps = {
  items: readonly {
    title: string
    href: '/settings' | '/settings/password'
    icon: LucideIcon
  }[]
}

export function SettingsNav({ items }: SettingsNavProps) {
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <nav className='flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible'>
      {items.map((item) => {
        const isActive = pathname.replace(/\/+$/, '') === item.href
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'justify-start',
              isActive && 'bg-muted hover:bg-muted'
            )}
          >
            <item.icon />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
