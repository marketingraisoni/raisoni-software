import { Link } from '@tanstack/react-router'
import { Logo } from '@/assets/logo'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

export function AppTitle() {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          tooltip='Raisoni ERP'
          className='gap-2 py-0 border-0 border-transparent hover:border-transparent hover:bg-transparent active:bg-transparent focus:ring-0 focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0'
          asChild
        >
          <Link
            to='/'
            onClick={() => setOpenMobile(false)}
            className='flex items-center gap-2 border-0 border-transparent hover:border-transparent outline-none ring-0'
          >
            <div className='flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white shadow-xs'>
              <Logo className='size-6.5 object-contain' />
            </div>
            <div className='grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden'>
              <span className='truncate font-bold'>Raisoni ERP</span>
              {/* <span className='truncate text-xs text-muted-foreground'>Admin Panel</span> */}
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
