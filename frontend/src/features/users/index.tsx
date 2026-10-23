import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from '@tanstack/react-table'
import { getUsers, usersQueryKey, type UsersQuery } from '@/services/users-service'
import {
  getArrayFilterValue,
  getNumberArrayFilterValue,
  getSortQuery,
  getStringFilterValue,
} from '@/components/data-table'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { UsersDialogs } from './components/users-dialogs'
import { UsersProvider } from './components/users-provider'
import { UsersTable } from './components/users-table'
import { USER_TABLE_COLUMN } from './data/data'
import { type UserStatus } from './data/schema'

export function Users() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

  const searchUsername = useMemo(() => {
    return getStringFilterValue(columnFilters, USER_TABLE_COLUMN.USERNAME)
  }, [columnFilters])

  const statusFilter = useMemo(() => {
    return getArrayFilterValue<UserStatus>(
      columnFilters,
      USER_TABLE_COLUMN.STATUS
    )
  }, [columnFilters])

  const userTypeFilter = useMemo(() => {
    return getNumberArrayFilterValue(
      columnFilters,
      USER_TABLE_COLUMN.USER_TYPE
    )
  }, [columnFilters])

  const sortQuery = getSortQuery<NonNullable<UsersQuery['sortBy']>>(sorting)
  const usersQueryParams: UsersQuery = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search: searchUsername,
    status: statusFilter,
    userType: userTypeFilter as UsersQuery['userType'],
    ...sortQuery,
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
          asyncState={usersQuery}
        />
      </Main>

      <UsersDialogs />
    </UsersProvider>
  )
}
