import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/auth-store'
import { fetchTotalUnreadChatCount } from '@/services/chat-service'
import { type ChatMessage } from '@/features/chats/data/chat-types'

interface SocketContextValue {
  socket: Socket | null
  isConnected: boolean
  onlineUserIds: Set<string>
  isUserOnline: (userId: string) => boolean
  refreshOnlineUsers: () => void
  unreadChatCount: number
  setUnreadChatCount: Dispatch<SetStateAction<number>>
  refreshUnreadChatCount: () => Promise<void>
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  onlineUserIds: new Set(),
  isUserOnline: () => false,
  refreshOnlineUsers: () => {},
  unreadChatCount: 0,
  setUnreadChatCount: () => {},
  refreshUnreadChatCount: async () => {},
})

export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.auth.accessToken)
  const currentUser = useAuthStore((state) => state.auth.user)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const socketRef = useRef<Socket | null>(null)

  const refreshUnreadChatCount = useCallback(async () => {
    if (!token) return
    const count = await fetchTotalUnreadChatCount()
    setUnreadChatCount(count)
  }, [token])

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocket(null)
        setIsConnected(false)
        setOnlineUserIds(new Set())
        setUnreadChatCount(0)
      }
      return
    }

    // Initial fetch of unread chat messages count
    refreshUnreadChatCount()

    // Connect to server origin with auth token
    const socketBaseUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
        : '/')
    const s = io(socketBaseUrl, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = s
    setSocket(s)

    s.on('connect', () => {
      setIsConnected(true)
      s.emit('users:get_online')
      refreshUnreadChatCount()
    })

    s.on('disconnect', () => {
      setIsConnected(false)
    })

    s.on('users:online', (ids: string[]) => {
      if (Array.isArray(ids)) {
        setOnlineUserIds(new Set(ids.map(String)))
      }
    })

    s.on(
      'user:status',
      ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
        if (!userId) return
        setOnlineUserIds((prev) => {
          const next = new Set(prev)
          if (status === 'online') {
            next.add(String(userId))
          } else {
            next.delete(String(userId))
          }
          return next
        })
      }
    )

    // Listen globally for incoming messages to update sidebar unread badge
    s.on('chat:message', (newMsg: ChatMessage) => {
      if (currentUser?.id && newMsg.recipient.id === currentUser.id) {
        setUnreadChatCount((prev) => prev + 1)
      }
    })

    // Listen for read notifications
    s.on('chat:read', () => {
      refreshUnreadChatCount()
    })

    return () => {
      s.disconnect()
      socketRef.current = null
      setSocket(null)
      setIsConnected(false)
    }
  }, [token, currentUser?.id, refreshUnreadChatCount])

  const isUserOnline = useCallback(
    (userId: string) => {
      if (!userId) return false
      return onlineUserIds.has(String(userId))
    },
    [onlineUserIds]
  )

  const refreshOnlineUsers = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('users:get_online')
    }
  }, [])

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUserIds,
        isUserOnline,
        refreshOnlineUsers,
        unreadChatCount,
        setUnreadChatCount,
        refreshUnreadChatCount,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
