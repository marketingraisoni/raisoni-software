import {
  LayoutDashboard,
  UserCog,
  Users,
  UserRoundKey,
  Boxes,
  Layers3,
  AppWindow,
  Clock,
  ScanLine,
  FileCheck,
  ClipboardClock,
  MessagesSquare,
  Settings,
  CircleHelp,
} from 'lucide-react'
import { PERMISSION_ACTION, PERMISSION_MODULE } from '@/constants/permissions'
import { type NavGroup } from '../types'

export const sidebarData: { navGroups: NavGroup[] } = {
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
          permission: { module: PERMISSION_MODULE.DASHBOARD },
        },
        {
          title: 'Chat',
          url: '/chats',
          icon: MessagesSquare,
          permission: { module: PERMISSION_MODULE.CHAT },
        },
      ],
    },

    {
      title: 'Lot Management',
      items: [
        {
          title: 'Lot Management',
          icon: Boxes,
          defaultOpen: true,
          items: [
            {
              title: 'All Lots',
              url: '/lots',
              icon: Boxes,
              permission: { module: PERMISSION_MODULE.LOTS },
            },
            {
              title: 'Packet Creation',
              url: '/packets',
              icon: Layers3,
              permission: { module: PERMISSION_MODULE.ASSORTMENT },
            },
          ],
        },
      ],
    },
    {
      title: '4P Process',
      items: [
        {
          title: '4P Semi-Polish',
          icon: AppWindow,
          defaultOpen: true,
          items: [
            {
              title: 'Ready for Issue',
              url: '/semi-polish/ready-for-issue',
              icon: FileCheck,
              permission: {
                module: PERMISSION_MODULE.SEMI_POLISH,
                action: PERMISSION_ACTION.CREATE,
              },
            },
            {
              title: 'Running 4P Process',
              url: '/semi-polish',
              icon: Clock,
              permission: { module: PERMISSION_MODULE.SEMI_POLISH },
            },
            {
              title: 'Packet Scanner',
              url: '/semi-polish/packet-scanner',
              icon: ScanLine,
              permission: {
                module: PERMISSION_MODULE.SEMI_POLISH,
                action: PERMISSION_ACTION.UPDATE,
              },
            },
            {
              title: 'Returned History',
              url: '/semi-polish/history',
              icon: ClipboardClock,
              permission: { module: PERMISSION_MODULE.SEMI_POLISH },
            },
          ],
        },
      ],
    },
    {
      title: 'Users',
      items: [
        {
          title: 'User Management',
          icon: Users,
          items: [
            {
              title: 'All Users',
              url: '/users',
              icon: UserCog,
              permission: { module: PERMISSION_MODULE.USERS },
            },
            {
              title: 'Permissions',
              url: '/permissions',
              icon: UserRoundKey,
              permission: { module: PERMISSION_MODULE.PERMISSIONS },
            },
          ],
        },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          url: '/settings',
          icon: Settings,
        },
        {
          title: 'Help Center',
          url: '/help-center',
          icon: CircleHelp,
        },
      ],
    },
  ],
}
