import { Outlet } from '@tanstack/react-router'
import { KeyRound, UserRound } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { SettingsNav } from './settings-nav'

const settingsItems = [
  { title: 'Profile', href: '/settings', icon: UserRound },
  { title: 'Change Password', href: '/settings/password', icon: KeyRound },
] as const

export function SettingsLayout() {
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
            <SettingsNav items={settingsItems} />
          </aside>
          <div className='min-w-0 flex-1 overflow-y-auto pe-1 pb-8'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
