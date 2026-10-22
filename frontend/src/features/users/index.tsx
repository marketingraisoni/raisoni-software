import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from '@tanstack/react-table'
import { getUsers, usersQueryKey, type UsersQuery } from '@/services/users-service'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { UsersDialogs } from './components/users-dialogs'
import { UsersProvider } from './components/users-provider'
import { UsersTable } from './components/users-table'

export function Users() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

  const searchUsername = useMemo(() => {
    const filter = columnFilters.find((f) => f.id === 'username')
    return typeof filter?.value === 'string' && filter.value.trim()
      ? filter.value.trim()
      : undefined
  }, [columnFilters])

  const statusFilter = useMemo(() => {
    const filter = columnFilters.find((f) => f.id === 'status')
    return Array.isArray(filter?.value) && filter.value.length
      ? (filter.value as ('active' | 'inactive')[])
      : undefined
  }, [columnFilters])

  const userTypeFilter = useMemo(() => {
    const filter = columnFilters.find((f) => f.id === 'userType')
    return Array.isArray(filter?.value) && filter.value.length
      ? (filter.value as (string | number)[]).map(Number)
      : undefined
  }, [columnFilters])

  const sort = sorting[0]
  const usersQueryParams: UsersQuery = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search: searchUsername,
    status: statusFilter,
    userType: userTypeFilter as UsersQuery['userType'],
    sortBy: sort?.id as UsersQuery['sortBy'],
    sortOrder: sort ? (sort.desc ? ('desc' as const) : ('asc' as const)) : undefined,
  }

  const usersQuery = useQuery({
    queryKey: [...usersQueryKey, usersQueryParams],
    queryFn: ({ signal }) => getUsers(usersQueryParams, signal),
    placeholderData: keepPreviousData,
  })

  const handleColumnFiltersChange = (
    updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)
  ) => {
    setColumnFilters(updater)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const handleSortingChange = (
    updater: SortingState | ((prev: SortingState) => SortingState)
  ) => {
    setSorting(updater)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const rawTotalPages = usersQuery.data?.pagination.totalPages ?? 1
  const pageCount = Math.max(rawTotalPages, pagination.pageIndex + 1)

  return (
    <UsersProvider>
      <AppHeader fixed />

      <Main fixed fluid className='flex flex-1 flex-col'>
        <UsersTable
          data={usersQuery.data?.users ?? []}
          pageCount={pageCount}
          totalRows={usersQuery.data?.pagination.total ?? 0}
          pagination={pagination}
          onPaginationChange={setPagination}
          columnFilters={columnFilters}
          onColumnFiltersChange={handleColumnFiltersChange}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          isLoading={usersQuery.isLoading}
          error={usersQuery.isError ? usersQuery.error : null}
          onRetry={() => void usersQuery.refetch()}
        />
      </Main>

      <UsersDialogs />
    </UsersProvider>
  )
}
