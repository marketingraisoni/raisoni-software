import { useEffect, useState } from 'react'
import { Cross2Icon } from '@radix-ui/react-icons'
import { type Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableFacetedFilter } from './faceted-filter'

type DataTableToolbarProps<TData> = {
  table: Table<TData>
  searchPlaceholder?: string
  searchKey?: string
  filters?: {
    columnId: string
    title: string
    options: {
      label: string
      value: string
      icon?: React.ComponentType<{ className?: string }>
    }[]
  }[]
  showFilterCounts?: boolean
  searchDebounceMs?: number
  actions?: React.ReactNode
  children?: React.ReactNode
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = 'Filter...',
  searchKey,
  filters = [],
  showFilterCounts = true,
  searchDebounceMs = 0,
  actions,
  children,
}: DataTableToolbarProps<TData>) {
  const appliedSearchValue = searchKey
    ? ((table.getColumn(searchKey)?.getFilterValue() as string) ?? '')
    : (table.getState().globalFilter ?? '')
  const [searchValue, setSearchValue] = useState(appliedSearchValue)

  useEffect(() => {
    setSearchValue(appliedSearchValue)
  }, [appliedSearchValue])

  useEffect(() => {
    if (searchDebounceMs <= 0 || searchValue === appliedSearchValue) return

    const timer = window.setTimeout(() => {
      if (searchKey) {
        table.getColumn(searchKey)?.setFilterValue(searchValue)
      } else {
        table.setGlobalFilter(searchValue)
      }
    }, searchDebounceMs)

    return () => window.clearTimeout(timer)
  }, [appliedSearchValue, searchDebounceMs, searchKey, searchValue, table])

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    if (searchDebounceMs > 0) return
    if (searchKey) table.getColumn(searchKey)?.setFilterValue(value)
    else table.setGlobalFilter(value)
  }

  const isFiltered =
    table.getState().columnFilters.length > 0 || table.getState().globalFilter

  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
        {searchKey ? (
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            className='h-8 w-37.5 lg:w-62.5'
          />
        ) : (
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            className='h-8 w-37.5 lg:w-62.5'
          />
        )}
        <div className='flex gap-x-2'>
          {filters.map((filter) => {
            const column = table.getColumn(filter.columnId)
            if (!column) return null
            return (
              <DataTableFacetedFilter
                key={filter.columnId}
                column={column}
                title={filter.title}
                options={filter.options}
                showCounts={showFilterCounts}
              />
            )
          })}
        </div>
        {isFiltered && (
          <Button
            variant='ghost'
            onClick={() => {
              table.resetColumnFilters()
              table.setGlobalFilter('')
            }}
            className='h-8 px-2 lg:px-3'
          >
            Reset
            <Cross2Icon className='ms-2 h-4 w-4' />
          </Button>
        )}
      </div>
      {(actions || children) && (
        <div className='flex items-center gap-2'>{actions || children}</div>
      )}
    </div>
  )
}
