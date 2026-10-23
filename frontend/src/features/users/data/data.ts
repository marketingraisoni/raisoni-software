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
    'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200',
  ],
  [USER_STATUS.INACTIVE, 'bg-neutral-300/40 border-neutral-300'],
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
