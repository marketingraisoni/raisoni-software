export interface ChatAttachment {
  url: string
  filename: string
  originalName: string
  mimeType: string
  size: number
}

export interface ChatUser {
  id: string
  name: string
  username: string
  email: string
  userType: number
  userTypeLabel: string
  isOnline: boolean
  lastLogin: string | null
  unreadCount: number
  lastMessage: {
    id: string
    message: string
    hasAttachments?: boolean
    senderId: string
    recipientId: string
    read: boolean
    createdAt: string
  } | null
}

export interface ChatMessage {
  id: string
  sender: {
    id: string
    name: string
    username: string
    userType?: number
  }
  recipient: {
    id: string
    name: string
    username: string
    userType?: number
  }
  message: string
  attachments?: ChatAttachment[]
  delivered?: boolean
  deliveredAt?: string | null
  read: boolean
  readAt?: string | null
  createdAt: string
}

export interface ChatMessagesResponse {
  user: ChatUser
  messages: ChatMessage[]
  hasMore?: boolean
  nextCursor?: string | null
  firstUnreadId?: string | null
}

