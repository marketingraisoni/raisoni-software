import { Link } from '@tanstack/react-router'
import { Laptop, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useTheme } from '@/context/theme-provider'
import { USER_TYPE_LABEL } from '@/constants/user-types'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SignOutDialog } from '@/components/sign-out-dialog'

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const user = useAuthStore((state) => state.auth.user)
  const { theme, setTheme } = useTheme()
  const initials = getInitials(user?.name || 'Raisoni User')
  const roleLabel = user
    ? USER_TYPE_LABEL[user.userType] || user.userTypeLabel
    : undefined

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button aria-label='Open profile menu' variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src={user?.avatarUrl || ''} alt={user?.name || ''} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end'>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium'>
                {user?.name || 'Raisoni User'}
              </p>
              <p className='text-xs leading-none text-muted-foreground'>
                {user?.email || ''}
              </p>
              {roleLabel && (
                <p className='text-xs text-muted-foreground'>{roleLabel}</p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to='/settings'>
              <Settings className='size-4' />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className='px-1 py-1'>
            <Tabs
              value={theme}
              onValueChange={(val) =>
                setTheme(val as 'light' | 'dark' | 'system')
              }
              className='w-full'
            >
              <TabsList className='grid h-8 w-full grid-cols-3 p-0.5'>
                <TabsTrigger
                  value='light'
                  className='h-7'
                  title='Light theme'
                  aria-label='Light theme'
                  onClick={(e) => e.stopPropagation()}
                >
                  <Sun className='size-4' />
                </TabsTrigger>
                <TabsTrigger
                  value='dark'
                  className='h-7'
                  title='Dark theme'
                  aria-label='Dark theme'
                  onClick={(e) => e.stopPropagation()}
                >
                  <Moon className='size-4' />
                </TabsTrigger>
                <TabsTrigger
                  value='system'
                  className='h-7'
                  title='System theme'
                  aria-label='System theme'
                  onClick={(e) => e.stopPropagation()}
                >
                  <Laptop className='size-4' />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onSelect={() => setOpen(true)}>
            <LogOut className='size-4' />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}

function getInitials(name: string) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'RU'
  )
}
