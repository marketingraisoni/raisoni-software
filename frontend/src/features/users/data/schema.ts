import { z } from 'zod'
import { USER_TYPE } from '@/constants/user-types'
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from '@/constants/permissions'

export const userStatusSchema = z.enum(['active', 'inactive'])
export type UserStatus = z.infer<typeof userStatusSchema>

export const userTypeSchema = z.union([
  z.literal(USER_TYPE.SUPER_ADMIN),
  z.literal(USER_TYPE.ADMIN),
  z.literal(USER_TYPE.MANAGER),
  z.literal(USER_TYPE.STAFF),
])
export type UserType = z.infer<typeof userTypeSchema>

export const permissionGrantSchema = z.object({
  module: z.enum(PERMISSION_MODULES),
  actions: z.array(z.enum(PERMISSION_ACTIONS)),
})

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  email: z.string(),
  userType: userTypeSchema,
  userTypeLabel: z.string().optional(),
  status: userStatusSchema,
  permissions: z.array(permissionGrantSchema).optional(),
  notes: z.string().optional().default(''),
  lastLogin: z.preprocess(
    (value) => (value == null ? undefined : value),
    z.coerce.date().optional()
  ),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type User = z.infer<typeof userSchema>
