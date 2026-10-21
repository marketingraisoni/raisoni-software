import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RotateCcw, Save, Search as SearchIcon, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { USER_TYPE, USER_TYPE_LABEL } from '@/constants/user-types'
import {
  PERMISSION_CATALOG,
  getDefaultPermissions,
  hasPermission,
  type PermissionAction,
  type PermissionGrant,
  type PermissionModule,
} from '@/constants/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { getApiErrorMessage } from '@/services/auth-service'
import {
  getPermissionCatalog,
  getUserPermissions,
  permissionCatalogQueryKey,
  updateUserPermissions,
  userPermissionsQueryKey,
} from '@/services/permissions-service'
import { getUsers, usersQueryKey } from '@/services/users-service'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

export function Permissions() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.auth.user)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [search, setSearch] = useState('')
  const [permissions, setPermissions] = useState<PermissionGrant[]>([])

  const usersQuery = useQuery({
    queryKey: [...usersQueryKey, 'permission-management'],
    queryFn: () =>
      getUsers({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
  })
  const catalogQuery = useQuery({
    queryKey: permissionCatalogQueryKey,
    queryFn: getPermissionCatalog,
  })

  const manageableUsers = useMemo(() => {
    const users = usersQuery.data?.users ?? []
    const visibleUsers =
      currentUser?.userType === USER_TYPE.SUPER_ADMIN
        ? users
        : users.filter((user) => user.userType !== USER_TYPE.SUPER_ADMIN)
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return visibleUsers
    return visibleUsers.filter((user) =>
      [user.name, user.username, user.email].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    )
  }, [currentUser?.userType, search, usersQuery.data?.users])

  useEffect(() => {
    if (!selectedUserId && manageableUsers.length > 0) {
      setSelectedUserId(manageableUsers[0].id)
    }
  }, [manageableUsers, selectedUserId])

  const userPermissionsQuery = useQuery({
    queryKey: userPermissionsQueryKey(selectedUserId),
    queryFn: () => getUserPermissions(selectedUserId),
    enabled: Boolean(selectedUserId),
  })

  useEffect(() => {
    if (userPermissionsQuery.data) {
      setPermissions(userPermissionsQuery.data.permissions)
    }
  }, [userPermissionsQuery.data])

  const selectedUser = userPermissionsQuery.data
  const canUpdate = hasPermission(currentUser, 'users', 'update')
  const isSuperAdmin = selectedUser?.userType === USER_TYPE.SUPER_ADMIN
  const catalog = catalogQuery.data || PERMISSION_CATALOG

  const updateMutation = useMutation({
    mutationFn: () => updateUserPermissions(selectedUserId, permissions),
    onSuccess: async (response) => {
      setPermissions(response.user.permissions)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKey }),
        queryClient.invalidateQueries({
          queryKey: userPermissionsQueryKey(selectedUserId),
        }),
      ])
      toast.success(response.message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const togglePermission = (
    module: PermissionModule,
    action: PermissionAction,
    checked: boolean
  ) => {
    setPermissions((current) => {
      const next = current.map((permission) => ({
        ...permission,
        actions: [...permission.actions],
      }))
      const moduleIndex = next.findIndex((permission) => permission.module === module)

      if (moduleIndex === -1) {
        if (checked) next.push({ module, actions: [action] })
        return next
      }

      const actions = new Set(next[moduleIndex].actions)
      if (checked) actions.add(action)
      else actions.delete(action)

      if (actions.size === 0) next.splice(moduleIndex, 1)
      else next[moduleIndex].actions = [...actions]
      return next
    })
  }

  return (
    <>
      <AppHeader fixed />
      <Main fixed fluid className='flex flex-1 flex-col gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Permissions</h1>
          <p className='text-muted-foreground'>
            Manage module access for each user account.
          </p>
        </div>

        <Card className='min-h-0 flex-1 gap-0 overflow-hidden py-0'>
          <div className='grid h-full min-h-0 md:grid-cols-[300px_1fr]'>
            <aside className='flex min-h-0 flex-col border-b md:border-e md:border-b-0'>
              <div className='border-b p-4'>
                <div className='relative'>
                  <SearchIcon className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder='Search users...'
                    className='ps-9'
                  />
                </div>
              </div>
              <div className='min-h-0 flex-1 overflow-y-auto p-2'>
                {usersQuery.isLoading ? (
                  <div className='flex h-32 items-center justify-center text-sm text-muted-foreground'>
                    <Loader2 className='me-2 size-4 animate-spin' /> Loading users...
                  </div>
                ) : manageableUsers.length === 0 ? (
                  <div className='flex h-32 items-center justify-center text-sm text-muted-foreground'>
                    No users found.
                  </div>
                ) : (
                  manageableUsers.map((user) => (
                    <button
                      key={user.id}
                      type='button'
                      onClick={() => setSelectedUserId(user.id)}
                      className={`mb-1 w-full rounded-md px-3 py-2 text-start transition-colors ${
                        selectedUserId === user.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span className='block truncate text-sm font-medium'>{user.name}</span>
                      <span className='block truncate text-xs opacity-75'>
                        {user.username} · {user.userTypeLabel || USER_TYPE_LABEL[user.userType]}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <section className='flex min-h-0 flex-col'>
              {!selectedUserId ? (
                <div className='flex flex-1 items-center justify-center text-muted-foreground'>
                  Select a user to manage permissions.
                </div>
              ) : userPermissionsQuery.isLoading ? (
                <div className='flex flex-1 items-center justify-center text-muted-foreground'>
                  <Loader2 className='me-2 size-5 animate-spin' /> Loading permissions...
                </div>
              ) : userPermissionsQuery.isError || !selectedUser ? (
                <div className='flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground'>
                  <p>{getApiErrorMessage(userPermissionsQuery.error)}</p>
                  <Button variant='outline' onClick={() => void userPermissionsQuery.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : (
                <>
                  <div className='flex items-center justify-between border-b px-6 py-4'>
                    <div className='flex items-center gap-3'>
                      <div className='rounded-md bg-primary/10 p-2 text-primary'>
                        <ShieldCheck className='size-5' />
                      </div>
                      <div>
                        <h2 className='font-semibold'>{selectedUser.name}</h2>
                        <p className='text-sm text-muted-foreground'>
                          {selectedUser.email} · {selectedUser.userTypeLabel || USER_TYPE_LABEL[selectedUser.userType]}
                        </p>
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <span className='rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary'>
                        Full access
                      </span>
                    )}
                  </div>

                  <div className='min-h-0 flex-1 overflow-auto p-6'>
                    <div className='min-w-[620px] overflow-hidden rounded-md border'>
                      <div className='grid grid-cols-[1fr_repeat(4,90px)] gap-2 border-b bg-muted/50 px-4 py-3 text-sm font-medium'>
                        <span>Module</span>
                        <span className='text-center'>Read</span>
                        <span className='text-center'>Create</span>
                        <span className='text-center'>Update</span>
                        <span className='text-center'>Delete</span>
                      </div>
                      {catalog.map((permission) => (
                        <div
                          key={permission.module}
                          className='grid grid-cols-[1fr_repeat(4,90px)] items-center gap-2 border-b px-4 py-3 last:border-b-0'
                        >
                          <span className='font-medium'>{permission.label}</span>
                          {(['read', 'create', 'update', 'delete'] as const).map((action) => {
                            const supported = permission.actions.includes(action)
                            const checked = Boolean(
                              permissions
                                .find((item) => item.module === permission.module)
                                ?.actions.includes(action)
                            )
                            const canGrant = hasPermission(
                              currentUser,
                              permission.module,
                              action
                            )
                            return (
                              <div key={action} className='flex justify-center'>
                                {supported ? (
                                  <Checkbox
                                    checked={isSuperAdmin || checked}
                                    disabled={isSuperAdmin || !canUpdate || !canGrant}
                                    aria-label={`${permission.label} ${action}`}
                                    onCheckedChange={(value) =>
                                      togglePermission(
                                        permission.module,
                                        action,
                                        value === true
                                      )
                                    }
                                  />
                                ) : (
                                  <span className='text-muted-foreground'>-</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {canUpdate && !isSuperAdmin && (
                    <div className='flex justify-end gap-2 border-t px-6 py-4'>
                      <Button
                        variant='outline'
                        onClick={() =>
                          setPermissions(getDefaultPermissions(selectedUser.userType))
                        }
                        disabled={updateMutation.isPending}
                      >
                        <RotateCcw /> Restore defaults
                      </Button>
                      <Button
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className='animate-spin' />
                        ) : (
                          <Save />
                        )}
                        Save permissions
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </Card>
      </Main>
    </>
  )
}
