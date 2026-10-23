import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getDisplayNameInitials } from '@/lib/utils'
import { type ChatUser } from '../data/chat-types'

type NewChatProps = {
  users: ChatUser[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectUser: (user: ChatUser) => void
}

export function NewChat({
  users,
  onOpenChange,
  open,
  onSelectUser,
}: NewChatProps) {
  const [search, setSearch] = useState('')

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase()
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.userTypeLabel.toLowerCase().includes(q)
    )
  })

  const handleSelect = (user: ChatUser) => {
    onSelectUser(user)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-3'>
          <Command className='rounded-lg border' shouldFilter={false}>
            <CommandInput
              placeholder='Search by name...'
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className='max-h-80'>
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup heading='Users'>
                {filteredUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => handleSelect(user)}
                    className='flex cursor-pointer items-center justify-between gap-3 p-2 hover:bg-accent'
                  >
                    <div className='flex items-center gap-3'>
                      <div className='relative'>
                        <Avatar className='size-9'>
                          <AvatarFallback>
                            {getDisplayNameInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background ${
                            user.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                          }`}
                        />
                      </div>
                      <div className='flex flex-col text-start'>
                        <span className='text-sm font-medium leading-none'>
                          {user.name}
                        </span>
                        {/* <span className='mt-1 text-xs text-muted-foreground'>
                          @{user.username}
                        </span> */}
                      </div>
                    </div>

                    <div className='flex items-center gap-2'>
                      {/* <Badge variant='outline' className='text-[10px] uppercase'>
                        {user.userTypeLabel}
                      </Badge> */}
                      {user.isOnline && (
                        <span className='text-[11px] font-medium text-emerald-600 dark:text-emerald-400'>
                          Online
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </DialogContent>
    </Dialog>
  )
}
