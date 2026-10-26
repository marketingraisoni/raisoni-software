import { type ApiResponse } from '@/types/api'
import { apiClient } from '@/lib/api-client'
import { type PermissionGrant } from '@/constants/permissions'
import {
  USER_TYPE,
  USER_TYPE_LABEL,
  legacyRoleToUserType,
} from '@/constants/user-types'
import {
  type User,
  type UserStatus,
  type UserType,
} from '@/features/users/data/schema'

export const usersQueryKey = ['users'] as const

type UsersData = {
  users: unknown[]
  pagination: PaginationMeta
}

type UserData = {
  user: User
}

type LegacyUsersResponse = {
  success: boolean
  users: unknown[]
}

type LegacyUserResponse = {
  success: boolean
  message: string
  user: User
}

type CreateUserInput = {
  name: string
  username: string
  email: string
  password: string
  userType: UserType
  status: UserStatus
  notes?: string
}

type UpdateUserInput = Partial<
  Omit<CreateUserInput, 'username' | 'password'>
> & {
  password?: string
}

export type UsersQuery = {
  page: number
  pageSize: number
  search?: string
  status?: UserStatus[]
  userType?: UserType[]
  sortBy?: 'username' | 'name' | 'email' | 'status' | 'userType' | 'lastLogin'
  sortOrder?: 'asc' | 'desc'
}

type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

function parseUsers(users: unknown[]): User[] {
  if (!Array.isArray(users)) return []
  return users.map((user) => {
    const record = user as Record<string, unknown>
    const rawType =
      Number(record.userType) || legacyRoleToUserType(String(record.role || ''))
    const userType = (
      rawType >= 1 && rawType <= 4 ? rawType : USER_TYPE.STAFF
    ) as UserType
    const userTypeLabel =
      (record.userTypeLabel
        ? String(record.userTypeLabel)
        : USER_TYPE_LABEL[userType]) || 'Staff'
    const status: UserStatus =
      String(record.status || '').toLowerCase() === 'inactive'
        ? 'inactive'
        : 'active'

    const userObj: User = {
      id: String(record.id || record._id || ''),
      name: String(record.name || ''),
      username: String(record.username || ''),
      email: String(record.email || ''),
      userType,
      userTypeLabel,
      status,
      notes: record.notes != null ? String(record.notes) : '',
      lastLogin: record.lastLogin
        ? new Date(record.lastLogin as string)
        : undefined,
      createdAt: record.createdAt
        ? new Date(record.createdAt as string)
        : new Date(),
      updatedAt: record.updatedAt
        ? new Date(record.updatedAt as string)
        : new Date(),
    }
    if (Array.isArray(record.permissions)) {
      userObj.permissions = record.permissions as PermissionGrant[]
    }
    return userObj
  })
}

function paginateLegacyUsers(users: User[], query: UsersQuery) {
  const search = query.search?.trim().toLowerCase()
  const filtered = users.filter((user) => {
    const matchesSearch =
      !search ||
      [user.username, user.name, user.email].some((value) =>
        value.toLowerCase().includes(search)
      )
    const matchesStatus =
      !query.status?.length || query.status.includes(user.status)
    const matchesUserType =
      !query.userType?.length || query.userType.includes(user.userType)
    return matchesSearch && matchesStatus && matchesUserType
  })

  if (query.sortBy) {
    const direction = query.sortOrder === 'desc' ? -1 : 1
    filtered.sort((left, right) => {
      const leftValue = left[query.sortBy!]
      const rightValue = right[query.sortBy!]
      return (
        String(leftValue ?? '').localeCompare(String(rightValue ?? '')) *
        direction
      )
    })
  }

  const start = (query.page - 1) * query.pageSize
  return {
    users: filtered.slice(start, start + query.pageSize),
    pagination: {
      page: query.page,
      limit: query.pageSize,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / query.pageSize) || 1,
    },
  }
}

async function fetchUsers(
  endpoint: '/users' | '/permissions/users',
  query: UsersQuery,
  signal?: AbortSignal
) {
  const { data: response } = await apiClient.get<
    ApiResponse<UsersData> | LegacyUsersResponse
  >(endpoint, {
    signal,
    params: {
      page: query.page,
      limit: query.pageSize,
      search: query.search || undefined,
      status: query.status?.length ? query.status.join(',') : undefined,
      userType: query.userType?.length ? query.userType.join(',') : undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined,
    },
  })

  if ('data' in response) {
    return {
      users: parseUsers(response.data.users),
      pagination: response.data.pagination,
    }
  }

  return paginateLegacyUsers(parseUsers(response.users), query)
}

export function getUsers(query: UsersQuery, signal?: AbortSignal) {
  return fetchUsers('/users', query, signal)
}

export function getPermissionManagementUsers(
  query: UsersQuery,
  signal?: AbortSignal
) {
  return fetchUsers('/permissions/users', query, signal)
}

export async function createUser(input: CreateUserInput) {
  const { data: response } = await apiClient.post<
    ApiResponse<UserData> | LegacyUserResponse
  >('/users', input)
  const user = 'data' in response ? response.data.user : response.user
  return { success: response.success, message: response.message, user }
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const { data: response } = await apiClient.put<
    ApiResponse<UserData> | LegacyUserResponse
  >(`/users/${id}`, input)
  const user = 'data' in response ? response.data.user : response.user
  return { success: response.success, message: response.message, user }
}

export async function deleteUser(id: string) {
  const { data } = await apiClient.delete<ApiResponse<{ id: string }>>(
    `/users/${id}`
  )
  return data
}
