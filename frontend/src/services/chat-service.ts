import { apiClient } from '@/lib/api-client'
import { type ApiResponse } from '@/types/api'
import {
  type ChatUser,
  type ChatMessage,
  type ChatAttachment,
  type ChatMessagesResponse,
} from '@/features/chats/data/chat-types'

export const chatQueryKeys = {
  users: ['chat', 'users'] as const,
  messages: (userId: string) => ['chat', 'messages', userId] as const,
}

export async function fetchChatUsers(): Promise<ChatUser[]> {
  const response = await apiClient.get<ApiResponse<{ users: ChatUser[] }>>('/chats/users')
  return response.data?.data?.users || []
}

export async function fetchChatMessages(
  userId: string,
  params?: { limit?: number; before?: string }
): Promise<ChatMessagesResponse> {
  const queryParams = new URLSearchParams()
  if (params?.limit) queryParams.set('limit', String(params.limit))
  if (params?.before) queryParams.set('before', params.before)

  const queryString = queryParams.toString()
  const url = `/chats/messages/${userId}${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<ApiResponse<ChatMessagesResponse>>(url)
  return (
    response.data?.data || {
      user: {
        id: userId,
        name: '',
        username: '',
        email: '',
        userType: 4,
        userTypeLabel: 'Staff',
        isOnline: false,
        lastLogin: null,
        unreadCount: 0,
        lastMessage: null,
      },
      messages: [],
      hasMore: false,
      nextCursor: null,
      firstUnreadId: null,
    }
  )
}

export async function uploadChatAttachment(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ChatAttachment> {
  const maxBytes = 20 * 1024 * 1024
  if (file.size > maxBytes) {
    throw new Error('File size exceeds the 20 MB limit.')
  }

  const response = await apiClient.post<
    ApiResponse<{ attachment: ChatAttachment }>
  >('/chats/upload', file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
        onProgress(percent)
      }
    },
  })

  if (!response.data?.data?.attachment) {
    throw new Error('Failed to upload file.')
  }
  return response.data.data.attachment
}

export async function sendChatMessage(
  recipientId: string,
  message: string,
  attachments: ChatAttachment[] = []
): Promise<ChatMessage> {
  const response = await apiClient.post<ApiResponse<{ message: ChatMessage }>>(
    '/chats/messages',
    { recipientId, message, attachments }
  )
  if (!response.data?.data?.message) {
    throw new Error('Failed to send message')
  }
  return response.data.data.message
}

export async function markChatMessagesAsRead(userId: string): Promise<void> {
  await apiClient.put(`/chats/messages/${userId}/read`)
}

export async function fetchOnlineUserIds(): Promise<string[]> {
  const response = await apiClient.get<
    ApiResponse<{ onlineUserIds: string[] }>
  >('/chats/online-users')
  return response.data?.data?.onlineUserIds || []
}

export async function fetchTotalUnreadChatCount(): Promise<number> {
  try {
    const res = await apiClient.get<ApiResponse<{ unreadCount: number }>>(
      '/chats/unread-count'
    )
    return res.data?.data?.unreadCount || 0
  } catch {
    return 0
  }
}
