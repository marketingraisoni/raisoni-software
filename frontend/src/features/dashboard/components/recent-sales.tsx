import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { type RecentSaleItem } from '@/services/dashboard-service'

const defaultItems: RecentSaleItem[] = [
  {
    name: 'Kapan AA',
    detail: '150 Pkt • Active Lot',
    amount: '+45.20 Cts',
    initials: 'AA',
    avatar: '/avatars/01.png',
  },
  {
    name: 'Kapan BB',
    detail: '320 Pkt • Active Lot',
    amount: '+88.50 Cts',
    initials: 'BB',
    avatar: '/avatars/02.png',
  },
  {
    name: 'Kapan CC',
    detail: '210 Pkt • Active Lot',
    amount: '+62.10 Cts',
    initials: 'CC',
    avatar: '/avatars/03.png',
  },
  {
    name: 'Kapan DD',
    detail: '180 Pkt • Active Lot',
    amount: '+54.00 Cts',
    initials: 'DD',
    avatar: '/avatars/04.png',
  },
  {
    name: 'Kapan EE',
    detail: '95 Pkt • Active Lot',
    amount: '+31.40 Cts',
    initials: 'EE',
    avatar: '/avatars/05.png',
  },
]

export function RecentSales({ items }: { items?: RecentSaleItem[] }) {
  const displayItems = items && items.length > 0 ? items : defaultItems

  return (
    <div className='space-y-8'>
      {displayItems.map((item, index) => (
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
