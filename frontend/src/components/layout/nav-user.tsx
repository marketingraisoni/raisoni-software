import { Link } from '@tanstack/react-router'
import {
  ChevronsUpDown,
  Laptop,
  LogOut,
  Moon,
  Settings,
  Sun,
} from 'lucide-react'
import { useTheme } from '@/context/theme-provider'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SignOutDialog } from '@/components/sign-out-dialog'

type NavUserProps = {
  user: {
    name: string
    email: string
    avatar: string
    userTypeLabel?: string
  }
}

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useDialogState()
  const initials = getInitials(user.name)

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size='lg'
                className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
              >
                <Avatar className='h-8 w-8 rounded-lg'>
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className='rounded-lg'>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-start text-sm leading-tight'>
                  <span className='truncate font-semibold'>{user.name}</span>
                  <span className='truncate text-xs'>{user.email}</span>
                </div>
                <ChevronsUpDown className='ms-auto size-4' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
              side={isMobile ? 'bottom' : 'right'}
              align='end'
              sideOffset={4}
            >
              <DropdownMenuLabel className='p-0 font-normal'>
                <div className='flex items-center gap-2 px-1 py-1.5 text-start text-sm'>
                  <Avatar className='h-8 w-8 rounded-lg'>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className='rounded-lg'>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className='grid flex-1 text-start text-sm leading-tight'>
                    <span className='truncate font-semibold'>{user.name}</span>
                    <span className='truncate text-xs'>{user.email}</span>
                    {user.userTypeLabel && (
                      <span className='truncate text-xs text-muted-foreground'>
                        {user.userTypeLabel}
                      </span>
                    )}
                  </div>
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
              <DropdownMenuItem
                variant='destructive'
                onClick={() => setOpen(true)}
              >
                <LogOut className='size-4' />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

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
