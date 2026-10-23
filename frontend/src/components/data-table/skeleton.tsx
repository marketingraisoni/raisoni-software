import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

interface DataTableSkeletonProps {
  columnCount: number
  rowCount?: number
  className?: string
  cellClassName?: string
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 12,
  className,
  cellClassName,
}: DataTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <TableRow key={`skeleton-row-${rowIndex}`} className={className}>
          {Array.from({ length: columnCount }).map((_, colIndex) => (
            <TableCell
              key={`skeleton-col-${rowIndex}-${colIndex}`}
              className={cellClassName}
            >
              <Skeleton className='h-7.5 w-full' />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
