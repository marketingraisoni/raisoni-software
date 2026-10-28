import { Outlet } from '@tanstack/react-router'
import { Image, KeyRound, UserRound } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { PERMISSION_ACTION, PERMISSION_MODULE } from '@/constants/permissions'
import { Separator } from '@/components/ui/separator'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { SettingsNav } from './settings-nav'

const settingsItems = [
  { title: 'Profile', href: '/settings', icon: UserRound },
  { title: 'Change Password', href: '/settings/password', icon: KeyRound },
] as const

const brandingItem = {
  title: 'Login Branding',
  href: '/settings/branding',
  icon: Image,
} as const

export function SettingsLayout() {
  const canManageBranding = useAuthStore((state) =>
    state.auth.canAccess(PERMISSION_MODULE.SETTINGS, PERMISSION_ACTION.UPDATE)
  )
  const visibleSettingsItems = canManageBranding
    ? [...settingsItems, brandingItem]
    : settingsItems

  return (
    <>
      <AppHeader />
      <Main fixed>
        <div>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            Settings
          </h1>
          <p className='text-muted-foreground'>Manage your account settings.</p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col gap-6 overflow-hidden lg:flex-row lg:gap-12'>
          <aside className='shrink-0 lg:w-52'>
            <SettingsNav items={visibleSettingsItems} />
          </aside>
          <div className='min-w-0 flex-1 overflow-y-auto pe-1 pb-8'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
