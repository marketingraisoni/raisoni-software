import { Gem } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  hasPermission,
} from '@/constants/permissions'
import { Button } from '@/components/ui/button'
import { useLots } from './lots-provider'

export function LotsPrimaryButtons() {
  const { setOpen } = useLots()
  const user = useAuthStore((state) => state.auth.user)

  if (!hasPermission(user, PERMISSION_MODULE.LOTS, PERMISSION_ACTION.CREATE))
    return null

  return (
    <Button className='space-x-1' onClick={() => setOpen('add')}>
      <span>Create Lot</span>
      <Gem size={18} />
    </Button>
  )
}
