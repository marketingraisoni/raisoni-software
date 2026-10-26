import type { ColumnFiltersState, SortingState } from '@tanstack/react-table'

const SORT_ORDER = {
  ASCENDING: 'asc',
  DESCENDING: 'desc',
} as const

type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER]

function getFilterValue(filters: ColumnFiltersState, columnId: string) {
  return filters.find((filter) => filter.id === columnId)?.value
}

export function getStringFilterValue(
  filters: ColumnFiltersState,
  columnId: string
) {
  const value = getFilterValue(filters, columnId)
  if (typeof value !== 'string') return undefined

  const normalizedValue = value.trim()
  return normalizedValue || undefined
}

export function getArrayFilterValue<T>(
  filters: ColumnFiltersState,
  columnId: string
) {
  const value = getFilterValue(filters, columnId)
  return Array.isArray(value) && value.length > 0 ? (value as T[]) : undefined
}

export function getNumberArrayFilterValue(
  filters: ColumnFiltersState,
  columnId: string
) {
  return getArrayFilterValue<string | number>(filters, columnId)?.map(Number)
}

export function getSortQuery<TSortBy extends string = string>(
  sorting: SortingState
): { sortBy?: TSortBy; sortOrder?: SortOrder } {
  const sort = sorting[0]
  if (!sort) return {}

  return {
    sortBy: sort.id as TSortBy,
    sortOrder: sort.desc ? SORT_ORDER.DESCENDING : SORT_ORDER.ASCENDING,
  }
}
