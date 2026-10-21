import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { useNavigate } from '@tanstack/react-router'
import { type Row } from '@tanstack/react-table'
import { ArrowRight, Layers3, Trash2 } from 'lucide-react'
import { hasPermission } from '@/constants/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AssortmentExcelButton } from '@/features/assortment/components/assortment-excel-button'
import { type Lot } from '../data/schema'
import { useLots } from './lots-provider'

export function DataTableRowActions({ row }: { row: Row<Lot> }) {
  const { setOpen, setCurrentRow } = useLots()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const canRead = hasPermission(user, 'lots', 'read')
  const canDelete = hasPermission(user, 'lots', 'delete')

  if (!canRead && !canDelete) return null

  return (
    <div className='flex items-center justify-end gap-2'>
      {canRead && row.original.assortmentComplete && (
        <AssortmentExcelButton
          lotId={row.original.id}
          kapanNo={row.original.kapanNo}
          compact
        />
      )}
      {canRead && (
        <Button
          type='button'
          size='sm'
          variant={row.original.status === 'active' ? 'default' : 'outline'}
          onClick={() => void navigate({ to: '/packets/$lotId', params: { lotId: row.original.id } })}
        >
          <Layers3 /> {row.original.status === 'active' ? 'Assort' : 'View'} <ArrowRight />
        </Button>
      )}
      {canDelete && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='flex h-8 w-8 p-0'>
              <DotsHorizontalIcon className='h-4 w-4' />
              <span className='sr-only'>Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-40'>
            <DropdownMenuItem
              className='text-red-500!'
              onClick={() => { setCurrentRow(row.original); setOpen('delete') }}
            >
              Delete
              <DropdownMenuShortcut><Trash2 size={16} /></DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
