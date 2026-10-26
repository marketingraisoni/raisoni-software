import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { type RecentSaleItem } from '@/services/dashboard-service'

export function RecentSales({ items }: { items?: RecentSaleItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className='flex h-36 flex-col items-center justify-center text-center text-sm text-muted-foreground'>
        <p className='font-medium'>No recent lots available</p>
      </div>
    )
  }

  return (
    <div className='space-y-8'>
      {items.map((item, index) => (
        <div key={index} className='flex items-center gap-4'>
          <Avatar className='h-9 w-9'>
            <AvatarImage src={item.avatar || `/avatars/0${(index % 5) + 1}.png`} alt='Avatar' />
            <AvatarFallback>{item.initials}</AvatarFallback>
          </Avatar>
          <div className='flex flex-1 flex-wrap items-center justify-between'>
            <div className='space-y-1'>
              <p className='text-sm leading-none font-medium'>{item.name}</p>
              <p className='text-sm text-muted-foreground'>{item.detail}</p>
            </div>
            <div className='font-medium'>{item.amount}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
