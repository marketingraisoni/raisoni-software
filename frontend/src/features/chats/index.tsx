import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Fragment } from 'react/jsx-runtime'
import { format, isToday, isYesterday } from 'date-fns'
import {
  ArrowLeft,
  Search as SearchIcon,
  Send,
  MessagesSquare,
  Check,
  CheckCheck,
  Loader2,
  UserPlus,
  RefreshCw,
  Paperclip,
  Image as ImageIcon,
  FileText,
  FileArchive,
  FileCode,
  File as FileIcon,
  Download,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, getDisplayNameInitials } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { useAuthStore } from '@/stores/auth-store'
import { useSocket } from '@/context/socket-context'
import {
  fetchChatUsers,
  fetchChatMessages,
  sendChatMessage,
  markChatMessagesAsRead,
  uploadChatAttachment,
} from '@/services/chat-service'
import { NewChat } from './components/new-chat'
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
  hasPermission,
} from '@/constants/permissions'
import {
  type ChatUser,
  type ChatMessage,
  type ChatAttachment,
} from './data/chat-types'

function getMessageDateGroup(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d, yyyy')
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function getFileIcon(mimeType: string, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (mimeType.startsWith('image/')) return <ImageIcon className='size-5 text-blue-500' />
  if (mimeType.includes('pdf') || ext === 'pdf')
    return <FileText className='size-5 text-rose-500' />
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('rar') ||
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  ) {
    return <FileArchive className='size-5 text-amber-500' />
  }
  if (
    ['js', 'ts', 'tsx', 'jsx', 'html', 'css', 'json', 'py', 'java', 'sql'].includes(ext)
  ) {
    return <FileCode className='size-5 text-emerald-500' />
  }
  return <FileIcon className='size-5 text-muted-foreground' />
}

export function Chats() {
  const currentUser = useAuthStore((state) => state.auth.user)
  const { socket, isUserOnline, refreshUnreadChatCount } = useSocket()
  const canSendMessages = hasPermission(
    currentUser,
    PERMISSION_MODULE.CHAT,
    PERMISSION_ACTION.CREATE
  )

  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<ChatUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  const [mobileSelectedUser, setMobileSelectedUser] = useState<ChatUser | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [partnerIsTyping, setPartnerIsTyping] = useState(false)
  const [createConversationDialogOpened, setCreateConversationDialog] = useState(false)

  // Attachments state (Supports multiple up to 10 in Claude-style 1:1 boxes)
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<
    { id: string; name: string; isImage: boolean; percent: number }[]
  >([])
  const isUploading = uploadingFiles.length > 0

  // Image viewer & gallery state
  const [previewGallery, setPreviewGallery] = useState<{
    images: { url: string; originalName: string }[]
    index: number
  } | null>(null)

  // Pagination & scroll-to-bottom states
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null)

  const chatContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const partnerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isScrolledUpRef = useRef(false)
  const activeThumbnailRef = useRef<HTMLButtonElement | null>(null)

  // Always keep focus in the input reliably across browser ticks & React state cycles
  const focusInput = useCallback(() => {
    inputRef.current?.focus()
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
    setTimeout(() => {
      inputRef.current?.focus()
    }, 30)
  }, [])

  // Auto-focus whenever active chat changes or messages finish loading
  useEffect(() => {
    if (selectedUser && !loadingMessages) {
      focusInput()
    }
  }, [selectedUser, loadingMessages, focusInput])

  // Re-focus when window regains focus (e.g. after returning from OS file dialog)
  useEffect(() => {
    const handleWindowFocus = () => {
      if (selectedUser) {
        focusInput()
      }
    }
    window.addEventListener('focus', handleWindowFocus)
    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [selectedUser, focusInput])

  // Attach cancel listeners to hidden file inputs
  useEffect(() => {
    const fileEl = fileInputRef.current
    const imgEl = imageInputRef.current
    fileEl?.addEventListener('cancel', focusInput)
    imgEl?.addEventListener('cancel', focusInput)
    return () => {
      fileEl?.removeEventListener('cancel', focusInput)
      imgEl?.removeEventListener('cancel', focusInput)
    }
  }, [focusInput])

  // Global typing redirect: if chat is open, direct keystrokes to input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!selectedUser) return
      if (createConversationDialogOpened || Boolean(previewGallery)) return

      const activeEl = document.activeElement
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('contenteditable') === 'true'
      ) {
        return
      }

      if (
        e.key === 'Escape' ||
        (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
      ) {
        focusInput()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [selectedUser, createConversationDialogOpened, previewGallery, focusInput])

  // Keyboard navigation for image gallery modal
  useEffect(() => {
    if (!previewGallery || previewGallery.images.length <= 1) return

    const handleGalleryKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setPreviewGallery((prev) =>
          prev && prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev
        )
      } else if (e.key === 'ArrowRight') {
        setPreviewGallery((prev) =>
          prev && prev.index < prev.images.length - 1
            ? { ...prev, index: prev.index + 1 }
            : prev
        )
      }
    }

    window.addEventListener('keydown', handleGalleryKey)
    return () => {
      window.removeEventListener('keydown', handleGalleryKey)
    }
  }, [previewGallery])

  // Scroll active thumbnail into view when gallery index changes
  useEffect(() => {
    if (activeThumbnailRef.current) {
      activeThumbnailRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }
  }, [previewGallery?.index])

  // Scroll smoothly or instantly to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      })
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      })
    }
  }, [])

  // Load chat user list
  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchChatUsers()
      setUsers(data)
    } catch {
      // handled
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Auto-load older 50 messages when scrolled up near top
  const loadOlderMessages = useCallback(async () => {
    if (!selectedUser || !hasMore || isLoadingMore || loadingMessages || !nextCursor) {
      return
    }

    const container = chatContainerRef.current
    if (!container) return

    setIsLoadingMore(true)
    const prevScrollHeight = container.scrollHeight
    const prevScrollTop = container.scrollTop

    try {
      const res = await fetchChatMessages(selectedUser.id, {
        limit: 50,
        before: nextCursor,
      })

      setHasMore(Boolean(res.hasMore))
      setNextCursor(res.nextCursor || null)

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const olderUnique = res.messages.filter((m) => !existingIds.has(m.id))
        if (olderUnique.length === 0) return prev
        return [...olderUnique, ...prev]
      })

      // Maintain scroll position seamlessly when older messages prepend
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          const newScrollHeight = chatContainerRef.current.scrollHeight
          chatContainerRef.current.scrollTop =
            newScrollHeight - prevScrollHeight + prevScrollTop
        }
      })
    } catch {
      // handled
    } finally {
      setIsLoadingMore(false)
    }
  }, [selectedUser, hasMore, isLoadingMore, loadingMessages, nextCursor])

  // Scroll listener for container: manages scroll-to-bottom visibility & infinite scroll
  const handleChatScroll = useCallback(() => {
    const container = chatContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    // Show floating button when user scrolls up (> 150px)
    const isScrolledUp = distanceFromBottom > 150
    setShowScrollToBottom(isScrolledUp)
    isScrolledUpRef.current = isScrolledUp

    // Auto-load 50 older messages when near top
    if (scrollTop <= 60 && hasMore && !isLoadingMore && !loadingMessages) {
      loadOlderMessages()
    }
  }, [hasMore, isLoadingMore, loadingMessages, loadOlderMessages])

  // Load messages when selecting a user
  const loadMessages = useCallback(
    async (targetUser: ChatUser) => {
      setLoadingMessages(true)
      setHasMore(false)
      setNextCursor(null)
      setShowScrollToBottom(false)
      isScrolledUpRef.current = false
      setFirstUnreadMessageId(null)

      try {
        const res = await fetchChatMessages(targetUser.id, { limit: 50 })
        setMessages(res.messages)
        setHasMore(Boolean(res.hasMore))
        setNextCursor(res.nextCursor || null)
        setFirstUnreadMessageId(res.firstUnreadId || null)

        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, unreadCount: 0 } : u))
        )
        refreshUnreadChatCount()

        // Wait for messages to render into DOM, then scroll to unread or bottom
        requestAnimationFrame(() => {
          setTimeout(() => {
            let scrolledToUnread = false
            if (res.firstUnreadId) {
              const unreadEl = document.getElementById(`msg-${res.firstUnreadId}`)
              if (unreadEl) {
                unreadEl.scrollIntoView({ behavior: 'auto', block: 'center' })
                scrolledToUnread = true
              }
            }
            if (!scrolledToUnread) {
              if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
              }
              scrollToBottom(false)
            }
            focusInput()
          }, 50)
        })
      } catch {
        // handled
      } finally {
        setLoadingMessages(false)
      }
    },
    [scrollToBottom, focusInput, refreshUnreadChatCount]
  )

  const handleSelectUser = (user: ChatUser) => {
    setSelectedUser(user)
    setMobileSelectedUser(user)
    setPendingAttachments([])
    loadMessages(user)
    focusInput()
  }

  // Socket event listeners for real-time messages, typing, and read receipts
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = (newMsg: ChatMessage) => {
      const currentSelectedId = selectedUser?.id
      const isFromCurrentConversation =
        (newMsg.sender.id === currentSelectedId &&
          newMsg.recipient.id === currentUser?.id) ||
        (newMsg.sender.id === currentUser?.id &&
          newMsg.recipient.id === currentSelectedId)

      if (isFromCurrentConversation) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })

        // If user is near bottom, scroll down automatically
        if (!isScrolledUpRef.current) {
          setTimeout(() => scrollToBottom(true), 50)
        }

        if (newMsg.sender.id === currentSelectedId && currentSelectedId) {
          markChatMessagesAsRead(currentSelectedId)
            .then(() => refreshUnreadChatCount())
            .catch(() => {})
        }
      }

      // Update contacts list preview
      setUsers((prev) => {
        const partnerId =
          newMsg.sender.id === currentUser?.id
            ? newMsg.recipient.id
            : newMsg.sender.id

        return prev.map((u) => {
          if (u.id === partnerId) {
            const isPartnerSelected = currentSelectedId === partnerId
            return {
              ...u,
              lastMessage: {
                id: newMsg.id,
                message:
                  newMsg.message ||
                  (newMsg.attachments?.length
                    ? newMsg.attachments[0].mimeType?.startsWith('image/')
                      ? '📷 Photo'
                      : '📎 Attachment'
                    : ''),
                hasAttachments: Boolean(newMsg.attachments?.length),
                senderId: newMsg.sender.id,
                recipientId: newMsg.recipient.id,
                read: newMsg.read,
                createdAt: newMsg.createdAt,
              },
              unreadCount:
                !isPartnerSelected && newMsg.sender.id === partnerId
                  ? u.unreadCount + 1
                  : 0,
            }
          }
          return u
        })
      })
    }

    const handleMessagesRead = ({ readerId }: { readerId: string }) => {
      if (selectedUser?.id === readerId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender.id === currentUser?.id
              ? { ...m, read: true, delivered: true }
              : m
          )
        )
      }
    }

    const handleMessagesDelivered = ({ deliveredTo }: { deliveredTo: string }) => {
      if (selectedUser?.id === deliveredTo) {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender.id === currentUser?.id ? { ...m, delivered: true } : m
          )
        )
      }
    }

    const handleTyping = ({
      senderId,
      isTyping,
    }: {
      senderId: string
      isTyping: boolean
    }) => {
      if (selectedUser?.id === senderId) {
        setPartnerIsTyping(isTyping)
        if (partnerTypingTimerRef.current) {
          clearTimeout(partnerTypingTimerRef.current)
        }
        if (isTyping) {
          partnerTypingTimerRef.current = setTimeout(() => {
            setPartnerIsTyping(false)
          }, 3500)
        }
      }
    }

    socket.on('chat:message', handleNewMessage)
    socket.on('chat:delivered', handleMessagesDelivered)
    socket.on('chat:read', handleMessagesRead)
    socket.on('chat:typing', handleTyping)

    return () => {
      socket.off('chat:message', handleNewMessage)
      socket.off('chat:delivered', handleMessagesDelivered)
      socket.off('chat:read', handleMessagesRead)
      socket.off('chat:typing', handleTyping)
      if (partnerTypingTimerRef.current) {
        clearTimeout(partnerTypingTimerRef.current)
      }
    }
  }, [socket, selectedUser?.id, currentUser?.id, scrollToBottom])

  // Handle typing indicator
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value)

    if (socket && selectedUser) {
      socket.emit('chat:typing', {
        recipientId: selectedUser.id,
        isTyping: true,
      })

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('chat:typing', {
          recipientId: selectedUser.id,
          isTyping: false,
        })
      }, 1500)
    }
  }

  // Handle Multiple File Uploads (Max 20MB per file, Max 10 total attachments)
  const handleFilesUpload = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList)
    if (rawFiles.length === 0) return

    const MAX_ATTACHMENTS = 10
    const currentCount = pendingAttachments.length + uploadingFiles.length
    const availableSlots = MAX_ATTACHMENTS - currentCount

    if (availableSlots <= 0) {
      toast.error('Maximum 10 attachments allowed per message.')
      focusInput()
      return
    }

    const filesToProcess = rawFiles.slice(0, availableSlots)
    if (rawFiles.length > availableSlots) {
      toast.info(
        `Maximum 10 attachments allowed. Only first ${availableSlots} files added.`
      )
    }

    const maxBytes = 20 * 1024 * 1024 // 20 MB

    for (const file of filesToProcess) {
      if (file.size > maxBytes) {
        toast.error(`"${file.name}" exceeds the 20 MB limit.`)
        focusInput()
        continue
      }

      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const isImg = file.type.startsWith('image/')

      setUploadingFiles((prev) => [
        ...prev,
        { id: tempId, name: file.name, isImage: isImg, percent: 0 },
      ])

      uploadChatAttachment(file, (percent) => {
        setUploadingFiles((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, percent } : item))
        )
      })
        .then((uploaded) => {
          // NO TOAST NOTIFICATION per user request!
          setPendingAttachments((prev) => {
            if (prev.length >= MAX_ATTACHMENTS) return prev
            return [...prev, uploaded]
          })
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Upload failed'
          toast.error(`Upload failed for ${file.name}: ${message}`)
        })
        .finally(() => {
          setUploadingFiles((prev) => prev.filter((item) => item.id !== tempId))
          focusInput()
        })
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFilesUpload(files)
    }
    // reset input so the same file can be selected again
    e.target.value = ''
    focusInput()
  }

  const handleRemoveAttachment = (indexToRemove: number) => {
    setPendingAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove))
    focusInput()
  }

  // Send message with optional text & attachments (up to 10)
  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = inputText.trim()
    if (
      (!trimmed && pendingAttachments.length === 0) ||
      !selectedUser ||
      isSending ||
      isUploading
    ) {
      focusInput()
      return
    }

    setIsSending(true)
    const attachmentToSend = [...pendingAttachments]
    const messageToSend = trimmed

    // Optimistically clear input and pending attachments
    setInputText('')
    setPendingAttachments([])
    focusInput()

    if (socket) {
      socket.emit('chat:typing', {
        recipientId: selectedUser.id,
        isTyping: false,
      })
    }

    try {
      const sentMsg = await sendChatMessage(
        selectedUser.id,
        messageToSend,
        attachmentToSend
      )

      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev
        return [...prev, sentMsg]
      })

      setTimeout(() => scrollToBottom(true), 30)

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                lastMessage: {
                  id: sentMsg.id,
                  message:
                    sentMsg.message ||
                    (sentMsg.attachments?.length
                      ? sentMsg.attachments[0].mimeType?.startsWith('image/')
                        ? '📷 Photo'
                        : '📎 Attachment'
                      : ''),
                  hasAttachments: Boolean(sentMsg.attachments?.length),
                  senderId: sentMsg.sender.id,
                  recipientId: sentMsg.recipient.id,
                  read: false,
                  createdAt: sentMsg.createdAt,
                },
              }
            : u
        )
      )
    } catch {
      // restore text on failure
      setInputText(messageToSend)
      if (attachmentToSend.length > 0) {
        setPendingAttachments(attachmentToSend)
      }
      toast.error('Failed to send message.')
    } finally {
      setIsSending(false)
      focusInput()
    }
  }

  // Filtered contacts list
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.userTypeLabel.toLowerCase().includes(q)
    )
  }, [users, search])

  // Group messages by date
  const groupedMessages = useMemo(() => {
    return messages.reduce((acc: Record<string, ChatMessage[]>, msg) => {
      const key = getMessageDateGroup(msg.createdAt)
      if (!acc[key]) acc[key] = []
      acc[key].push(msg)
      return acc
    }, {})
  }, [messages])

  const selectedIsOnline = selectedUser ? isUserOnline(selectedUser.id) : false

  return (
    <>
      <AppHeader />

      {/* Full-width fluid container for wide messenger experience */}
      <Main fixed fluid className='h-[calc(100svh-4rem)] w-full p-2 md:p-3'>
        <section className='flex size-full gap-2 lg:gap-3 overflow-hidden rounded-xl border bg-card shadow-sm'>
          {/* ================= LEFT SIDE: CONTACTS LIST ================= */}
          <div className='flex h-full w-full flex-col border-r bg-card sm:w-72 lg:w-84 xl:w-96 flex-shrink-0'>
            <div className='flex flex-col gap-2 p-3 border-b bg-card/60 backdrop-blur-xs'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <h1 className='text-lg font-bold tracking-tight lg:text-xl'>
                    Chat
                  </h1>
                  <MessagesSquare className='size-5 text-primary' />
                </div>

                <div className='flex items-center gap-1'>
                  <Button
                    size='icon'
                    variant='ghost'
                    onClick={loadUsers}
                    title='Refresh contacts'
                    className='size-8 rounded-lg'
                  >
                    <RefreshCw className='size-4 text-muted-foreground' />
                  </Button>
                  {canSendMessages && (
                    <Button
                      size='icon'
                      variant='outline'
                      onClick={() => setCreateConversationDialog(true)}
                      title='New conversation'
                      className='size-8 rounded-lg'
                    >
                      <UserPlus className='size-4 text-primary' />
                    </Button>
                  )}
                </div>
              </div>

              {/* Search Box */}
              <div className='relative'>
                <SearchIcon className='absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  type='text'
                  className='pl-8 h-9 text-xs sm:text-sm'
                  placeholder='Search...'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Users List */}
            <ScrollArea className='flex-1 p-2'>
              {loadingUsers ? (
                <div className='flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground'>
                  <Loader2 className='size-5 animate-spin' />
                  <span className='text-xs'>Loading users...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className='flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground'>
                  <MessagesSquare className='size-8 stroke-1 text-muted-foreground/60' />
                  <p className='text-xs'>No users found</p>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isOnline = isUserOnline(user.id)
                  const isSelected = selectedUser?.id === user.id
                  const lastMsg = user.lastMessage
                  const isSentByMe = lastMsg?.senderId === currentUser?.id

                  return (
                    <Fragment key={user.id}>
                      <button
                        type='button'
                        className={cn(
                          'group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-start text-sm transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          isSelected && 'bg-accent text-accent-foreground font-medium shadow-2xs'
                        )}
                        onClick={() => handleSelectUser(user)}
                      >
                        {/* Avatar with Live Status Indicator */}
                        <div className='relative flex-shrink-0'>
                          <Avatar className='size-10'>
                            <AvatarFallback>
                              {getDisplayNameInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              'absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-background transition-colors',
                              isOnline
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                                : 'bg-slate-300 dark:bg-slate-600'
                            )}
                            title={isOnline ? 'Online' : 'Offline'}
                          />
                        </div>

                        {/* User Details & Last Message Preview */}
                        <div className='flex min-w-0 flex-1 flex-col'>
                          <div className='flex items-center justify-between gap-1'>
                            <span className='truncate font-medium text-foreground'>
                              {user.name}
                            </span>
                            {lastMsg?.createdAt && (
                              <span className='text-xs text-muted-foreground whitespace-nowrap'>
                                {format(new Date(lastMsg.createdAt), 'h:mm a')}
                              </span>
                            )}
                          </div>

                          <div className='flex items-center justify-between gap-1 text-sm'>
                            <span className='truncate text-muted-foreground'>
                              {lastMsg ? (
                                <>
                                  {isSentByMe && <span className='font-normal'>You: </span>}
                                  {lastMsg.message || (lastMsg.hasAttachments ? '📎 Attachment' : '')}
                                </>
                              ) : (
                                  <></>
                                // <span className='text-muted-foreground/70'>
                                //   @{user.username} • {user.userTypeLabel}
                                // </span>
                              )}
                            </span>

                            {user.unreadCount > 0 && (
                              <Badge
                                variant='default'
                                className='h-4 min-w-4 rounded-full px-1.5 py-0 text-[10px] font-semibold'
                              >
                                {user.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                      <Separator className='my-1 opacity-40' />
                    </Fragment>
                  )
                })
              )}
            </ScrollArea>
          </div>

          {/* ================= RIGHT SIDE: WIDE CHAT AREA ================= */}
          {selectedUser ? (
            <div
              className={cn(
                'absolute inset-0 start-full z-50 hidden size-full flex-1 flex-col bg-background sm:static sm:z-auto sm:flex',
                mobileSelectedUser && 'inset-s-0 flex'
              )}
              onClick={focusInput}
            >
              {/* Conversation Top Header */}
              <div className='flex flex-none items-center justify-between border-b bg-card/90 px-4 py-2.5 backdrop-blur-xs'>
                <div className='flex items-center gap-3'>
                  <Button
                    size='icon'
                    variant='ghost'
                    className='-ms-1 size-8 sm:hidden'
                    onClick={() => setMobileSelectedUser(null)}
                  >
                    <ArrowLeft className='size-4' />
                  </Button>

                  <div className='relative'>
                    <Avatar className='size-10'>
                      <AvatarFallback>
                        {getDisplayNameInitials(selectedUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        'absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-background',
                        selectedIsOnline
                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                          : 'bg-slate-300 dark:bg-slate-600'
                      )}
                    />
                  </div>

                  <div className='flex flex-col'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-semibold sm:text-base'>
                        {selectedUser.name}
                      </span>
                      <Badge variant='outline' className='text-[10px] uppercase'>
                        {selectedUser.userTypeLabel}
                      </Badge>
                    </div>

                    <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                      <span
                        className={cn(
                          'inline-block size-1.5 rounded-full',
                          selectedIsOnline ? 'bg-emerald-500' : 'bg-slate-400'
                        )}
                      />
                      <span>
                        {selectedIsOnline ? 'Online' : 'Offline'}
                      </span>
                      <span>•</span>
                      <span>@{selectedUser.username}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message List Area */}
              <div className='relative flex flex-1 min-h-0 flex-col'>
                <div
                  ref={chatContainerRef}
                  onScroll={handleChatScroll}
                  className='flex flex-1 flex-col overflow-y-auto p-4 cursor-default'
                  onClick={focusInput}
                >
                  {/* Top auto-load older 50 messages spinner */}
                  {isLoadingMore && (
                    <div className='flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground'>
                      <Loader2 className='size-3.5 animate-spin text-primary' />
                      <span>Loading older messages...</span>
                    </div>
                  )}

                  {!isLoadingMore && !hasMore && messages.length >= 50 && (
                    <div className='flex items-center justify-center py-2'>
                      <span className='rounded-full bg-muted/60 px-3 py-0.5 text-[11px] font-medium text-muted-foreground/80'>
                        Beginning of conversation
                      </span>
                    </div>
                  )}

                  {loadingMessages ? (
                    <div className='flex flex-1 items-center justify-center gap-2 text-muted-foreground'>
                      <Loader2 className='size-5 animate-spin' />
                      <span className='text-xs'>Loading conversation...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className='flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground'>
                      <div className='flex size-18 items-center justify-center rounded-full border border-dashed border-border bg-muted/40'>
                        <MessagesSquare className='size-10 text-primary/70' />
                      </div>
                      <div>
                        <p className='font-medium text-foreground'>
                          No messages yet
                        </p>

                      </div>
                    </div>
                  ) : (
                    <div className='flex flex-col gap-3'>
                      {Object.keys(groupedMessages).map((dateKey) => (
                        <Fragment key={dateKey}>
                          {/* Date Divider */}
                          <div className='relative flex items-center justify-center my-2'>
                            <span className='rounded-full border bg-card px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-2xs'>
                              {dateKey}
                            </span>
                          </div>

                          {/* Messages */}
                          {groupedMessages[dateKey].map((msg, msgIndex, msgArray) => {
                            const nextMsg = msgArray[msgIndex + 1]
                            const isMe = msg.sender.id === currentUser?.id
                            const hasAttachments =
                              Array.isArray(msg.attachments) && msg.attachments.length > 0

                            // Check if next message is from the SAME sender in the SAME minute
                            const isNextInSameMinute = Boolean(
                              nextMsg &&
                                nextMsg.sender.id === msg.sender.id &&
                                (() => {
                                  const t1 = new Date(msg.createdAt)
                                  const t2 = new Date(nextMsg.createdAt)
                                  return (
                                    t1.getFullYear() === t2.getFullYear() &&
                                    t1.getMonth() === t2.getMonth() &&
                                    t1.getDate() === t2.getDate() &&
                                    t1.getHours() === t2.getHours() &&
                                    t1.getMinutes() === t2.getMinutes()
                                  )
                                })()
                            )

                            // WhatsApp style: show timestamp ONLY if this is the last message in that minute for this sender
                            const showTimestamp = !isNextInSameMinute

                            return (
                              <Fragment key={msg.id}>
                                {msg.id === firstUnreadMessageId && (
                                  <div className='relative flex items-center justify-center my-3 w-full'>
                                    <div className='absolute inset-0 flex items-center'>
                                      <div className='w-full border-t border-primary/30' />
                                    </div>
                                    <span className='relative rounded-full border border-primary/40 bg-card px-3 py-0.5 text-[11px] font-semibold text-primary shadow-2xs'>
                                      Unread Messages
                                    </span>
                                  </div>
                                )}
                                <div
                                  id={`msg-${msg.id}`}
                                  className={cn(
                                    'flex flex-col max-w-[85%] sm:max-w-[70%]',
                                    isMe ? 'self-end items-end' : 'self-start items-start',
                                    showTimestamp ? 'mb-2.5' : 'mb-0.5'
                                  )}
                                >
                              <div
                                className={cn(
                                  'rounded-2xl p-2 text-sm shadow-xs wrap-break-word',
                                  isMe
                                    ? 'bg-primary text-primary-foreground rounded-br-xs'
                                    : 'bg-muted/80 text-foreground border border-border/50 rounded-bl-xs'
                                )}
                              >
                                {/* File / Image Attachments */}
                                {hasAttachments && (() => {
                                  const imageAttachments =
                                    msg.attachments?.filter((att) =>
                                      att.mimeType?.startsWith('image/')
                                    ) || []
                                  const fileAttachments =
                                    msg.attachments?.filter(
                                      (att) => !att.mimeType?.startsWith('image/')
                                    ) || []

                                  return (
                                    <div className='flex flex-col gap-1.5 mb-1.5'>
                                      {/* WhatsApp-Style Photo Grid (1, 2, 3, or 2x2 with +N on 4th) */}
                                      {imageAttachments.length > 0 && (
                                        <div
                                          className={cn(
                                            'overflow-hidden rounded-2xl max-w-sm',
                                            imageAttachments.length === 1 &&
                                              'max-w-xs sm:max-w-sm',
                                            imageAttachments.length >= 2 &&
                                              'grid grid-cols-2 gap-1.5 p-1 bg-black/10 dark:bg-black/25'
                                          )}
                                        >
                                          {/* Single Photo */}
                                          {imageAttachments.length === 1 && (
                                            <div
                                              className='group relative overflow-hidden cursor-pointer'
                                              onClick={() =>
                                                setPreviewGallery({
                                                  images: imageAttachments,
                                                  index: 0,
                                                })
                                              }
                                            >
                                              <img
                                                src={imageAttachments[0].url}
                                                alt={imageAttachments[0].originalName}
                                                className='max-h-72 w-full rounded-xl object-cover hover:opacity-95 transition-opacity'
                                              />
                                              <div className='absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-xs'>
                                                <span>
                                                  {formatBytes(imageAttachments[0].size)}
                                                </span>
                                                <a
                                                  href={imageAttachments[0].url}
                                                  download={imageAttachments[0].originalName}
                                                  target='_blank'
                                                  rel='noopener noreferrer'
                                                  className='hover:text-primary transition-colors'
                                                  title='Download image'
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <Download className='size-3' />
                                                </a>
                                              </div>
                                            </div>
                                          )}

                                          {/* 2 Photos */}
                                          {imageAttachments.length === 2 &&
                                            imageAttachments.map((att, imgIdx) => (
                                              <div
                                                key={`${att.url}-${imgIdx}`}
                                                className='relative aspect-square overflow-hidden rounded-xl cursor-pointer group bg-black/10'
                                                onClick={() =>
                                                  setPreviewGallery({
                                                    images: imageAttachments,
                                                    index: imgIdx,
                                                  })
                                                }
                                              >
                                                <img
                                                  src={att.url}
                                                  alt={att.originalName}
                                                  className='size-full object-cover'
                                                />
                                              </div>
                                            ))}

                                          {/* 3 Photos (1 Top Wide, 2 Bottom Square) */}
                                          {imageAttachments.length === 3 && (
                                            <>
                                              <div
                                                className='relative col-span-2 aspect-[2/1] overflow-hidden rounded-xl cursor-pointer group bg-black/10'
                                                onClick={() =>
                                                  setPreviewGallery({
                                                    images: imageAttachments,
                                                    index: 0,
                                                  })
                                                }
                                              >
                                                <img
                                                  src={imageAttachments[0].url}
                                                  alt={imageAttachments[0].originalName}
                                                  className='size-full object-cover'
                                                />
                                              </div>
                                              {imageAttachments.slice(1, 3).map((att, imgIdx) => (
                                                <div
                                                  key={`${att.url}-${imgIdx + 1}`}
                                                  className='relative aspect-square overflow-hidden rounded-xl cursor-pointer group bg-black/10'
                                                  onClick={() =>
                                                    setPreviewGallery({
                                                      images: imageAttachments,
                                                      index: imgIdx + 1,
                                                    })
                                                  }
                                                >
                                                  <img
                                                    src={att.url}
                                                    alt={att.originalName}
                                                    className='size-full object-cover'
                                                  />
                                                </div>
                                              ))}
                                            </>
                                          )}

                                          {/* 4+ Photos: WhatsApp 2x2 Grid with +N overlay on 4th */}
                                          {imageAttachments.length >= 4 &&
                                            imageAttachments.slice(0, 4).map((att, imgIdx) => {
                                              const isFourth = imgIdx === 3
                                              const hasExtra = imageAttachments.length > 4
                                              const extraCount = imageAttachments.length - 4

                                              return (
                                                <div
                                                  key={`${att.url}-${imgIdx}`}
                                                  className='relative aspect-square overflow-hidden rounded-xl cursor-pointer group bg-black/10'
                                                  onClick={() =>
                                                    setPreviewGallery({
                                                      images: imageAttachments,
                                                      index: imgIdx,
                                                    })
                                                  }
                                                >
                                                  <img
                                                    src={att.url}
                                                    alt={att.originalName}
                                                    className='size-full object-cover'
                                                  />

                                                  {/* WhatsApp-style +N overlay on 4th slot */}
                                                  {isFourth && hasExtra && (
                                                    <div className='absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-2xs transition-colors group-hover:bg-black/50'>
                                                      <span className='text-3xl sm:text-4xl font-bold text-white tracking-wide select-none drop-shadow-md'>
                                                        +{extraCount}
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            })}
                                        </div>
                                      )}

                                      {/* Document / Generic File Attachments */}
                                      {fileAttachments.length > 0 &&
                                        fileAttachments.map((att, fIdx) => (
                                          <div
                                            key={`${att.url}-${fIdx}`}
                                            className={cn(
                                              'flex items-center gap-3 rounded-xl p-2.5 transition-colors border',
                                              isMe
                                                ? 'bg-black/10 border-white/10 text-primary-foreground'
                                                : 'bg-background/80 border-border/60 text-foreground'
                                            )}
                                          >
                                            <div className='flex size-10 items-center justify-center rounded-lg bg-card shadow-2xs flex-shrink-0'>
                                              {getFileIcon(att.mimeType, att.originalName)}
                                            </div>

                                            <div className='flex flex-col min-w-0 flex-1 text-start'>
                                              <span className='truncate text-xs font-semibold'>
                                                {att.originalName}
                                              </span>
                                              <span className='text-[10px] opacity-75'>
                                                {formatBytes(att.size)}
                                              </span>
                                            </div>

                                            <a
                                              href={att.url}
                                              download={att.originalName}
                                              target='_blank'
                                              rel='noopener noreferrer'
                                              className={cn(
                                                'flex size-8 items-center justify-center rounded-lg transition-colors flex-shrink-0',
                                                isMe
                                                  ? 'bg-white/20 hover:bg-white/30 text-white'
                                                  : 'bg-muted hover:bg-accent text-foreground'
                                              )}
                                              title='Download file'
                                            >
                                              <Download className='size-4' />
                                            </a>
                                          </div>
                                        ))}
                                    </div>
                                  )
                                })()}

                                {/* Message text if present */}
                                {msg.message && (
                                  <p className='whitespace-pre-wrap leading-relaxed'>
                                    {msg.message}
                                  </p>
                                )}
                              </div>

                              {/* Time & Read Status - WhatsApp style: only shows on last message in the same minute */}
                              {showTimestamp && (
                                <div
                                  className={cn(
                                    'mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground px-1',
                                    isMe && 'justify-end'
                                  )}
                                >
                                  <span>{format(new Date(msg.createdAt), 'h:mm a')}</span>
                                  {isMe && (
                                    <span
                                      className='inline-flex items-center'
                                      title={
                                        msg.read
                                          ? 'Read'
                                          : msg.delivered
                                            ? 'Delivered'
                                            : 'Sent'
                                      }
                                    >
                                      {msg.read ? (
                                        <CheckCheck className='size-3.5 text-emerald-500 dark:text-emerald-400 stroke-[2.5]' />
                                      ) : msg.delivered ? (
                                        <CheckCheck className='size-3.5 text-muted-foreground/80' />
                                      ) : (
                                        <Check className='size-3.5 text-muted-foreground/80' />
                                      )}
                                    </span>
                                  )}
                                </div>
                              )}
                                </div>
                              </Fragment>
                            )
                          })}
                        </Fragment>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Floating Scroll to Bottom Button */}
                {showScrollToBottom && (
                  <Button
                    type='button'
                    size='icon'
                    variant='outline'
                    className='absolute bottom-4 right-6 z-30 size-10 rounded-full border border-border/80 bg-background/95 shadow-lg backdrop-blur-xs transition-all hover:bg-card active:scale-95'
                    onClick={() => {
                      scrollToBottom(true)
                      focusInput()
                    }}
                    title='Scroll to bottom'
                  >
                    <ChevronDown className='size-5 text-foreground' />
                  </Button>
                )}
              </div>

              {/* Typing Indicator */}
              {partnerIsTyping && (
                <div className='flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground animate-pulse'>
                  <span className='size-1.5 rounded-full bg-primary animate-ping' />
                  <span>{selectedUser.name} is typing...</span>
                </div>
              )}

              {/* Claude-style 1:1 Attachments Preview Strip (Up to 10 files) */}
              {(pendingAttachments.length > 0 || uploadingFiles.length > 0) && (
                <div className='flex items-center gap-2 overflow-x-auto border-t bg-card/60 px-3 py-2 scrollbar-thin backdrop-blur-xs'>
                  {pendingAttachments.map((att, idx) => {
                    const isImg = att.mimeType?.startsWith('image/')
                    const ext = att.originalName.split('.').pop()?.toUpperCase() || 'FILE'

                    return (
                      <div
                        key={att.filename || idx}
                        className='group relative flex size-16 sm:size-18 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-background/80 shadow-2xs transition-all hover:border-primary/60'
                        title={att.originalName}
                      >
                        {isImg ? (
                          <img
                            src={att.url}
                            alt={att.originalName}
                            className='size-full object-cover cursor-pointer'
                            onClick={() =>
                              setPreviewGallery({
                                images: [{ url: att.url, originalName: att.originalName }],
                                index: 0,
                              })
                            }
                          />
                        ) : (
                          <div className='flex size-full flex-col items-center justify-between p-1.5'>
                            <div className='mt-0.5 flex items-center justify-center'>
                              {getFileIcon(att.mimeType, att.originalName)}
                            </div>
                            <span className='rounded bg-muted px-1 py-0.2 text-[8px] font-bold tracking-wider text-muted-foreground uppercase'>
                              {ext.slice(0, 4)}
                            </span>
                            <span className='w-full truncate text-center text-[9px] font-medium text-foreground/80 leading-tight'>
                              {att.originalName}
                            </span>
                          </div>
                        )}

                        {/* Claude-style remove button in top-right */}
                        <button
                          type='button'
                          className='absolute top-1 right-1 flex size-4.5 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition-all hover:bg-destructive active:scale-95'
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveAttachment(idx)
                          }}
                          title='Remove attachment'
                        >
                          <X className='size-2.5 stroke-[2.5]' />
                        </button>
                      </div>
                    )
                  })}

                  {/* Uploading placeholders in 1:1 box format */}
                  {uploadingFiles.map((up) => (
                    <div
                      key={up.id}
                      className='relative flex size-16 sm:size-18 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-primary/60 bg-primary/5 p-1 text-center animate-pulse'
                      title={`Uploading ${up.name}`}
                    >
                      <Loader2 className='size-4.5 animate-spin text-primary' />
                      <span className='mt-1 text-[9px] font-bold text-primary'>
                        {up.percent > 0 ? `${up.percent}%` : '...'}
                      </span>
                      <span className='w-full truncate text-[8px] text-muted-foreground'>
                        {up.name}
                      </span>
                    </div>
                  ))}

                  {/* Counter indicator */}
                  <div className='ml-auto shrink-0 pr-1'>
                    <span className='rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground'>
                      {pendingAttachments.length}/10
                    </span>
                  </div>
                </div>
              )}

              {/* Hidden File Inputs (Max 20MB, multiple up to 10) */}
              <input
                type='file'
                multiple
                ref={fileInputRef}
                onChange={handleFileInputChange}
                className='hidden'
              />
              <input
                type='file'
                multiple
                accept='image/*'
                ref={imageInputRef}
                onChange={handleFileInputChange}
                className='hidden'
              />

              {/* Message Input Footer with Shadcn elements */}
              {canSendMessages ? (
                <form
                  onSubmit={handleSendMessage}
                  className='flex flex-none items-center gap-2 border-t bg-card p-3'
                >
                  <TooltipProvider>
                    {/* Image attachment button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type='button'
                          size='icon'
                          variant='ghost'
                          className='size-9 rounded-lg text-muted-foreground hover:text-foreground'
                          onClick={() => imageInputRef.current?.click()}
                          disabled={isUploading || pendingAttachments.length >= 10}
                        >
                          <ImageIcon className='size-4' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side='top'>
                        <span>Attach images (up to 10)</span>
                      </TooltipContent>
                    </Tooltip>

                    {/* General file attachment button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type='button'
                          size='icon'
                          variant='ghost'
                          className='size-9 rounded-lg text-muted-foreground hover:text-foreground'
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading || pendingAttachments.length >= 10}
                        >
                          <Paperclip className='size-4' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side='top'>
                        <span>Attach files (up to 10, max 20 MB each)</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Always-focused message Input */}
                  <div className='relative flex-1'>
                    <Input
                      ref={inputRef}
                      type='text'
                      placeholder='Type a message'
                      value={inputText}
                      onChange={handleInputChange}
                      className='h-10 text-sm'
                      autoFocus
                    />
                  </div>

                  <Button
                    type='submit'
                    size='icon'
                    disabled={
                      (!inputText.trim() && pendingAttachments.length === 0) ||
                      isSending ||
                      isUploading
                    }
                    className='size-10 shrink-0'
                  >
                    {isSending ? (
                      <Loader2 className='size-4 animate-spin' />
                    ) : (
                      <Send className='size-4' />
                    )}
                  </Button>
                </form>
              ) : (
                <div className='flex items-center justify-center border-t bg-muted/30 p-3 text-xs text-muted-foreground'>
                  You have read-only access to this conversation.
                </div>
              )}
            </div>
          ) : (
            /* ================= EMPTY STATE ================= */
            <div className='hidden flex-1 flex-col items-center justify-center bg-card p-8 text-center sm:flex'>
              <div className='flex size-16 items-center justify-center rounded-full border-2 border-border bg-muted/30'>
                <MessagesSquare className='size-8 text-primary/70' />
              </div>
              <h2 className='mt-4 text-lg font-semibold text-foreground'>
                Select a user to start chatting
              </h2>
              {canSendMessages && (
                <Button
                  onClick={() => setCreateConversationDialog(true)}
                  className='mt-5'
                >
                  <UserPlus className='mr-2 size-4' />
                  New conversation
                </Button>
              )}
            </div>
          )}
        </section>

        {/* New Chat Dialog */}
        <NewChat
          users={users}
          open={createConversationDialogOpened}
          onOpenChange={setCreateConversationDialog}
          onSelectUser={handleSelectUser}
        />

        {/* Full Image Preview / Gallery Lightbox with WhatsApp-style Bottom Thumbnail Carousel */}
        <Dialog
          open={Boolean(previewGallery)}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewGallery(null)
              focusInput()
            }
          }}
        >
          <DialogContent
            className='w-[95vw] sm:max-w-none h-[92vh] max-h-[95vh] p-0 bg-[#0c1317] border border-neutral-800 text-white flex flex-col overflow-hidden rounded-2xl shadow-2xl backdrop-blur-md gap-0'
            showCloseButton={false}
          >
            {previewGallery && (() => {
              const currentImg = previewGallery.images[previewGallery.index]
              const totalImages = previewGallery.images.length
              const hasMultiple = totalImages > 1

              return (
                <div className='flex flex-col h-full w-full select-none'>
                  <DialogHeader className='sr-only'>
                    <DialogTitle>{currentImg?.originalName || 'Image Preview'}</DialogTitle>
                  </DialogHeader>

                  {/* Top Bar: Title & Icon-only Buttons */}
                  <div className='flex items-center justify-between px-4 sm:px-6 py-3 bg-[#111b21] border-b border-white/10 shrink-0 z-20'>
                    <div className='flex items-center gap-3 min-w-0 pr-4'>
                      <span className='truncate text-sm font-medium text-neutral-200'>
                        {currentImg?.originalName || 'Image Preview'}
                      </span>
                    </div>

                    <div className='flex items-center gap-1.5 shrink-0'>
                      {currentImg && (
                        <a
                          href={currentImg.url}
                          download={currentImg.originalName}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='flex size-9 items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors'
                          title='Download image'
                        >
                          <Download className='size-5' />
                        </a>
                      )}

                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        className='size-9 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors'
                        onClick={() => {
                          setPreviewGallery(null)
                          focusInput()
                        }}
                        title='Close (Esc)'
                      >
                        <X className='size-5' />
                      </Button>
                    </div>
                  </div>

                  {/* Main Stage: Centered Large Image with Left/Right Navigation Chevrons */}
                  <div className='relative flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden bg-black/60 min-h-0'>
                    {currentImg && (
                      <img
                        src={currentImg.url}
                        alt={currentImg.originalName}
                        className='max-h-full max-w-full w-auto h-auto object-contain rounded-md shadow-2xl transition-all'
                        draggable={false}
                      />
                    )}

                    {/* Previous Button (Left Chevron Circle) */}
                    {hasMultiple && (
                      <button
                        type='button'
                        className={cn(
                          'absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 flex size-10 sm:size-11 items-center justify-center rounded-full bg-black/70 text-white border border-white/10 shadow-lg backdrop-blur-xs transition-all hover:bg-black/90 active:scale-95 cursor-pointer',
                          previewGallery.index === 0 && 'opacity-25 cursor-not-allowed hover:bg-black/70'
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (previewGallery.index > 0) {
                            setPreviewGallery((prev) =>
                              prev ? { ...prev, index: prev.index - 1 } : null
                            )
                          }
                        }}
                        disabled={previewGallery.index === 0}
                        title='Previous image (←)'
                      >
                        <ChevronLeft className='size-5 sm:size-6' />
                      </button>
                    )}

                    {/* Next Button (Right Chevron Circle) */}
                    {hasMultiple && (
                      <button
                        type='button'
                        className={cn(
                          'absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 flex size-10 sm:size-11 items-center justify-center rounded-full bg-black/70 text-white border border-white/10 shadow-lg backdrop-blur-xs transition-all hover:bg-black/90 active:scale-95 cursor-pointer',
                          previewGallery.index === totalImages - 1 &&
                            'opacity-25 cursor-not-allowed hover:bg-black/70'
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (previewGallery.index < totalImages - 1) {
                            setPreviewGallery((prev) =>
                              prev ? { ...prev, index: prev.index + 1 } : null
                            )
                          }
                        }}
                        disabled={previewGallery.index === totalImages - 1}
                        title='Next image (→)'
                      >
                        <ChevronRight className='size-5 sm:size-6' />
                      </button>
                    )}
                  </div>

                  {/* Centered Counter: e.g. "1 of 5" */}
                  {hasMultiple && (
                    <div className='py-1.5 text-center bg-[#0c1317] border-t border-white/5 shrink-0'>
                      <span className='text-xs font-medium text-neutral-400 tracking-wide'>
                        {previewGallery.index + 1} of {totalImages}
                      </span>
                    </div>
                  )}

                  {/* Bottom Thumbnail Strip (WhatsApp Style) */}
                  {hasMultiple && (
                    <div className='flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111b21] border-t border-white/10 overflow-x-auto scrollbar-thin shrink-0'>
                      {previewGallery.images.map((img, tIdx) => {
                        const isActive = tIdx === previewGallery.index
                        return (
                          <button
                            key={`${img.url}-${tIdx}`}
                            ref={isActive ? activeThumbnailRef : undefined}
                            type='button'
                            onClick={() =>
                              setPreviewGallery((prev) =>
                                prev ? { ...prev, index: tIdx } : null
                              )
                            }
                            className={cn(
                              'relative size-12 sm:size-14 rounded-md overflow-hidden shrink-0 transition-all duration-150 focus:outline-hidden cursor-pointer',
                              isActive
                                ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/30 opacity-100 shadow-md scale-105'
                                : 'opacity-40 hover:opacity-80 border border-white/15'
                            )}
                            title={`${img.originalName} (${tIdx + 1}/${totalImages})`}
                          >
                            <img
                              src={img.url}
                              alt={img.originalName}
                              className='size-full object-cover'
                              draggable={false}
                            />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
