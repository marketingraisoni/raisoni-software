import { apiClient } from '@/lib/api-client'
import { type PermissionCatalogItem } from '@/constants/permissions'
import { type PermissionGrant } from '@/constants/permissions'
import { userSchema } from '@/features/users/data/schema'
import { type ApiResponse } from '@/types/api'

export const permissionCatalogQueryKey = ['permissions', 'modules'] as const
export const userPermissionsQueryKey = (userId: string) =>
  ['permissions', 'users', userId] as const

export async function getPermissionCatalog() {
  const { data: response } = await apiClient.get<
    ApiResponse<{ modules: PermissionCatalogItem[] }>
  >('/permissions/modules')
  return response.data.modules
}

export async function getUserPermissions(userId: string) {
  const { data: response } = await apiClient.get<ApiResponse<{ user: unknown }>>(
    `/permissions/users/${userId}`
  )
  return userSchema.parse(response.data.user)
}

export async function updateUserPermissions(
  userId: string,
  permissions: PermissionGrant[]
) {
  const { data: response } = await apiClient.put<ApiResponse<{ user: unknown }>>(
    `/permissions/users/${userId}`,
    { permissions }
  )
  return {
    message: response.message,
    user: userSchema.parse(response.data.user),
  }
}
