import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { type ColumnFiltersState, type PaginationState } from '@tanstack/react-table'
import { getLots, lotsQueryKey } from '@/services/lots-service'
import {
  getArrayFilterValue,
  getStringFilterValue,
} from '@/components/data-table'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { type LotStatus } from './data/schema'
import { LOT_TABLE_COLUMN } from './data/data'
import { LotsDialogs } from './components/lots-dialogs'
import { LotsProvider } from './components/lots-provider'
import { LotsTable } from './components/lots-table'

export function Lots() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const search = useMemo(() => {
    return getStringFilterValue(columnFilters, LOT_TABLE_COLUMN.KAPAN_NO)
  }, [columnFilters])

  const status = useMemo(() => {
    return getArrayFilterValue<LotStatus>(
      columnFilters,
      LOT_TABLE_COLUMN.STATUS
    )
  }, [columnFilters])

  const query = { page: pagination.pageIndex + 1, pageSize: pagination.pageSize, search, status }
  const lotsQuery = useQuery({
    queryKey: [...lotsQueryKey, query],
    queryFn: ({ signal }) => getLots(query, signal),
    placeholderData: keepPreviousData,
  })

  const handleFiltersChange = (updater: ColumnFiltersState | ((previous: ColumnFiltersState) => ColumnFiltersState)) => {
    setColumnFilters(updater)
    setPagination((previous) => ({ ...previous, pageIndex: 0 }))
  }

  const totalPages = lotsQuery.data?.pagination.totalPages ?? 1

  return (
    <LotsProvider>
      <AppHeader fixed />
      <Main fixed fluid className='flex flex-1 flex-col'>
        <LotsTable
          data={lotsQuery.data?.lots ?? []}
          pageCount={Math.max(totalPages, pagination.pageIndex + 1)}
          totalRows={lotsQuery.data?.pagination.total ?? 0}
          pagination={pagination}
          onPaginationChange={setPagination}
          columnFilters={columnFilters}
          onColumnFiltersChange={handleFiltersChange}
          asyncState={lotsQuery}
        />
      </Main>
      <LotsDialogs />
    </LotsProvider>
  )
}
