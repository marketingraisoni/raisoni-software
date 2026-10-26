import { type LinkProps } from '@tanstack/react-router'
import type {
  PermissionAction,
  PermissionModule,
} from '@/constants/permissions'

type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ElementType
  permission?: {
    module: PermissionModule
    action?: PermissionAction
  }
}

type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: LinkProps['to'] | (string & {}) })[]
  url?: never
  defaultOpen?: boolean
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  title: string
  items: NavItem[]
}

export type { NavGroup, NavItem, NavCollapsible, NavLink }
