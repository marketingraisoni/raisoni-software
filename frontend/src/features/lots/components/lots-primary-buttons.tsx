import { Gem } from 'lucide-react'
import { hasPermission } from '@/constants/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { useLots } from './lots-provider'

export function LotsPrimaryButtons() {
  const { setOpen } = useLots()
  const user = useAuthStore((state) => state.auth.user)

  if (!hasPermission(user, 'lots', 'create')) return null

  return (
    <Button className='space-x-1' onClick={() => setOpen('add')}>
      <span>Add Lot</span>
      <Gem size={18} />
    </Button>
  )
}
