import { UserPlus } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  hasPermission,
} from '@/constants/permissions'
import { Button } from '@/components/ui/button'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { setOpen } = useUsers()
  const user = useAuthStore((state) => state.auth.user)
  if (!hasPermission(user, PERMISSION_MODULE.USERS, PERMISSION_ACTION.CREATE))
    return null
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>Add User</span> <UserPlus size={18} />
      </Button>
    </div>
  )
}
