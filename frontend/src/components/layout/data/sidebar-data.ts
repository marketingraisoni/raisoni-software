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
  Sparkles,
  Clock,
  History,
  BarChart3,
  ScanLine,
} from 'lucide-react'
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
        },
        // {
        //   title: 'Tasks',
        //   url: '/tasks',
        //   icon: ListTodo,
        // },
        // {
        //   title: 'Apps',
        //   url: '/apps',
        //   icon: Package,
        // },
        // {
        //   title: 'Chats',
        //   url: '/chats',
        //   badge: '3',
        //   icon: MessagesSquare,
        // },
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
        },
      ],
    },
    {
      title: '4P Process',
      items: [
        {
          title: '4P Semi-Polish',
          icon: Sparkles,
          items: [
            {
              title: 'Active in 4P',
              url: '/semi-polish',
              icon: Clock,
            },
            {
              title: 'Packet Scanner',
              url: '/semi-polish/packet-scanner',
              icon: ScanLine,
            },
            {
              title: 'Ready for Issue',
              url: '/semi-polish/ready-for-issue',
              icon: Layers3,
            },
            {
              title: 'Returned History',
              url: '/semi-polish/history',
              icon: History,
            },
            {
              title: 'Process Report',
              url: '/semi-polish/report',
              icon: BarChart3,
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
            },
            {
              title: 'Permissions',
              url: '/permissions',
              icon: UserRoundKey,
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
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: Monitor,
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
