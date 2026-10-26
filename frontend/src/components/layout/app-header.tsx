import type { ReactNode } from 'react'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Header } from './header'

type AppHeaderProps = {
  fixed?: boolean
  leading?: ReactNode
  children?: ReactNode
}

export function AppHeader({ fixed, leading, children }: AppHeaderProps) {
  return (
    <Header fixed={fixed}>
      {leading ?? <Search className='me-auto' />}
      {children}
      <ThemeSwitch />
      <ProfileDropdown />
    </Header>
  )
}
