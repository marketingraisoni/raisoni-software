import { Crown, ShieldCheck, UserCog, Users } from 'lucide-react'
import { USER_TYPE } from '@/constants/user-types'
import { USER_STATUS, type UserStatus } from './schema'

export const USER_TABLE_COLUMN = {
  USERNAME: 'username',
  STATUS: 'status',
  USER_TYPE: 'userType',
} as const

export const callTypes = new Map<UserStatus, string>([
  [
    USER_STATUS.ACTIVE,
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:border-emerald-500/20',
  ],
  [
    USER_STATUS.INACTIVE,
    'border-muted-foreground/30 bg-muted/60 text-muted-foreground dark:border-muted-foreground/20',
  ],
])

export const userTypes = [
  {
    label: 'Super Admin',
    value: USER_TYPE.SUPER_ADMIN,
    icon: Crown,
  },
  {
    label: 'Administrator',
    value: USER_TYPE.ADMIN,
    icon: ShieldCheck,
  },
  {
    label: 'Manager',
    value: USER_TYPE.MANAGER,
    icon: UserCog,
  },
  {
    label: 'Staff',
    value: USER_TYPE.STAFF,
    icon: Users,
  },
] as const
