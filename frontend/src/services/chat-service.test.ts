import { describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import {
  fetchChatUsers,
  fetchChatMessages,
  sendChatMessage,
  markChatMessagesAsRead,
  fetchOnlineUserIds,
  uploadChatAttachment,
} from './chat-service'

describe('chat-service', () => {
  it('fetchChatUsers requests /chats/users and returns user list', async () => {
    const mockUsers = [
      {
        id: 'u1',
        name: 'John',
        username: 'john',
        email: 'john@example.com',
        userType: 4,
        userTypeLabel: 'Staff',
        isOnline: true,
        lastLogin: null,
        unreadCount: 0,
        lastMessage: null,
      },
    ]

    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: { success: true, data: { users: mockUsers } },
    } as never)

    const result = await fetchChatUsers()
    expect(result).toEqual(mockUsers)
    expect(apiClient.get).toHaveBeenCalledWith('/chats/users')
  })

  it('fetchChatMessages requests /chats/messages/:userId and returns conversation', async () => {
    const mockData = {
      user: {
        id: 'u2',
        name: 'Jane',
        username: 'jane',
        email: 'jane@example.com',
        userType: 4,
        userTypeLabel: 'Staff',
        isOnline: false,
        lastLogin: null,
        unreadCount: 0,
        lastMessage: null,
      },
      messages: [],
    }

    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: { success: true, data: mockData },
    } as never)

    const result = await fetchChatMessages('u2')
    expect(result).toEqual(mockData)
    expect(apiClient.get).toHaveBeenCalledWith('/chats/messages/u2')
  })

  it('uploadChatAttachment rejects files over 20 MB', async () => {
    const largeBlob = new Blob([new Uint8Array(21 * 1024 * 1024)])
    const largeFile = new File([largeBlob], 'too-large.pdf', {
      type: 'application/pdf',
    })

    await expect(uploadChatAttachment(largeFile)).rejects.toThrow(
      'File size exceeds the 20 MB limit.'
    )
  })

  it('uploadChatAttachment posts file to /chats/upload', async () => {
    const file = new File(['sample content'], 'test.txt', {
      type: 'text/plain',
    })
    const mockAttachment = {
      url: '/uploads/chat/123-test.txt',
      filename: '123-test.txt',
      originalName: 'test.txt',
      mimeType: 'text/plain',
      size: 14,
    }

    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: { success: true, data: { attachment: mockAttachment } },
    } as never)

    const result = await uploadChatAttachment(file)
    expect(result).toEqual(mockAttachment)
    expect(apiClient.post).toHaveBeenCalledWith(
      '/chats/upload',
      file,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'text/plain',
          'x-file-name': encodeURIComponent('test.txt'),
        }),
      })
    )
  })

  it('sendChatMessage posts to /chats/messages and returns created message', async () => {
    const mockMsg = {
      id: 'm1',
      sender: { id: 'u1', name: 'John', username: 'john' },
      recipient: { id: 'u2', name: 'Jane', username: 'jane' },
      message: 'Hello Jane',
      attachments: [],
      read: false,
      createdAt: new Date().toISOString(),
    }

    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: { success: true, data: { message: mockMsg } },
    } as never)

    const result = await sendChatMessage('u2', 'Hello Jane')
    expect(result).toEqual(mockMsg)
    expect(apiClient.post).toHaveBeenCalledWith('/chats/messages', {
      recipientId: 'u2',
      message: 'Hello Jane',
      attachments: [],
    })
  })

  it('markChatMessagesAsRead calls PUT /chats/messages/:userId/read', async () => {
    vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      data: { success: true },
    } as never)

    await markChatMessagesAsRead('u2')
    expect(apiClient.put).toHaveBeenCalledWith('/chats/messages/u2/read')
  })

  it('fetchOnlineUserIds calls GET /chats/online-users', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: { success: true, data: { onlineUserIds: ['u1', 'u2'] } },
    } as never)

    const result = await fetchOnlineUserIds()
    expect(result).toEqual(['u1', 'u2'])
  })
})
