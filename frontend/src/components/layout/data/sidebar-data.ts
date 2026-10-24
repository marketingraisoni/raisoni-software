import {
  LayoutDashboard,
  Monitor,
  HelpCircle,
  Bell,
  Palette,
  Settings,
  Wrench,
  UserCog,
  Users,
  UserRoundKey,
  Gem,
  Layers3,
  AppWindow,
  Clock,
  BarChart3,
  ScanLine,
  FileCheck,
  ClipboardClock,
  MessagesSquare,
} from 'lucide-react'
import { PERMISSION_ACTION, PERMISSION_MODULE } from '@/constants/permissions'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
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

    // {
    //   title: 'Pages',
    //   items: [
    //     {
    //       title: 'Errors',
    //       icon: Bug,
    //       items: [
    //         {
    //           title: 'Unauthorized',
    //           url: '/errors/unauthorized',
    //           icon: Lock,
    //         },
    //         {
    //           title: 'Forbidden',
    //           url: '/errors/forbidden',
    //           icon: UserX,
    //         },
    //         {
    //           title: 'Not Found',
    //           url: '/errors/not-found',
    //           icon: FileX,
    //         },
    //         {
    //           title: 'Internal Server Error',
    //           url: '/errors/internal-server-error',
    //           icon: ServerOff,
    //         },
    //         {
    //           title: 'Maintenance Error',
    //           url: '/errors/maintenance-error',
    //           icon: Construction,
    //         },
    //       ],
    //     },
    //   ],
    // },
    {
      title: 'Lot Management',
      items: [
        {
          title: 'All Lots',
          url: '/lots',
          icon: Gem,
          permission: { module: PERMISSION_MODULE.LOTS },
        },
      ],
    },
    {
      title: 'Assortment',
      items: [
        {
          title: 'Packet Creation',
          url: '/packets',
          icon: Layers3,
          permission: { module: PERMISSION_MODULE.ASSORTMENT },
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
              title: 'Ready for Issue',
              url: '/semi-polish/ready-for-issue',
              icon: FileCheck,
              permission: {
                module: PERMISSION_MODULE.SEMI_POLISH,
                action: PERMISSION_ACTION.CREATE,
              },
            },
            {
              title: 'Returned History',
              url: '/semi-polish/history',
              icon: ClipboardClock,
              permission: { module: PERMISSION_MODULE.SEMI_POLISH },
            },
            {
              title: 'Process Report',
              url: '/semi-polish/report',
              icon: BarChart3,
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
        // {
        //   title: 'Help Center',
        //   url: '/help-center',
        //   icon: HelpCircle,
        // },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          items: [
            {
              title: 'Profile',
              url: '/settings',
              icon: UserCog,
              permission: { module: PERMISSION_MODULE.SETTINGS },
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: Wrench,
              permission: { module: PERMISSION_MODULE.SETTINGS },
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
              permission: { module: PERMISSION_MODULE.SETTINGS },
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
              permission: { module: PERMISSION_MODULE.SETTINGS },
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: Monitor,
              permission: { module: PERMISSION_MODULE.SETTINGS },
            },
          ],
        },
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
