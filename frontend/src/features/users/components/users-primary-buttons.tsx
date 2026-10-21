import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUsers } from './users-provider'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/constants/permissions'

export function UsersPrimaryButtons() {
  const { setOpen } = useUsers()
  const user = useAuthStore((state) => state.auth.user)
  if (!hasPermission(user, 'users', 'create')) return null
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>Add User</span> <UserPlus size={18} />
      </Button>
    </div>
  )
}
