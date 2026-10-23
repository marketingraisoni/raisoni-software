import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { ChatMessage } from '../models/ChatMessage.js';

let ioInstance = null;

// Map of userId -> Set of socketId
const onlineUsers = new Map();

/**
 * Check if a specific user is currently online
 * @param {string} userId
 * @returns {boolean}
 */
export function isUserOnline(userId) {
  if (!userId) return false;
  const idStr = String(userId);
  const sockets = onlineUsers.get(idStr);
  return Boolean(sockets && sockets.size > 0);
}

/**
 * Return an array of all currently online user IDs
 * @returns {string[]}
 */
export function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

/**
 * Emit an event to a specific user (to all their connected sockets / devices)
 * @param {string} userId
 * @param {string} event
 * @param {any} data
 */
export function emitToUser(userId, event, data) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${String(userId)}`).emit(event, {
    ...data,
    timestamp: data?.timestamp || new Date().toISOString(),
  });
}

/**
 * Initialize Socket.IO instance and register connection lifecycle & chat event listeners
 */
export function initSocketIO(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Socket Authentication Middleware
  ioInstance.use((socket, next) => {
    try {
      let token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      if (token && typeof token === 'string' && token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, config.jwtSecret);
          socket.user = decoded;
        } catch (err) {
          logger.warn(`Socket connection with invalid token: ${err.message}`);
        }
      }
    } catch (e) {
      logger.warn(`Socket auth middleware error: ${e.message}`);
    }
    next();
  });

  ioInstance.on('connection', (socket) => {
    const userId = socket.user?.id ? String(socket.user.id) : null;
    const username = socket.user?.username || 'anonymous';

    logger.info(`Socket client connected: ${socket.id} (user: ${username}, id: ${userId || 'none'})`);

    if (userId) {
      // Join personal room for targeted private messaging and notifications
      socket.join(`user:${userId}`);

      // Track online socket session
      const existingSockets = onlineUsers.get(userId);
      const isFirstConnection = !existingSockets || existingSockets.size === 0;

      if (isFirstConnection) {
        onlineUsers.set(userId, new Set([socket.id]));
        // Broadcast user became online
        ioInstance.emit('user:status', {
          userId,
          status: 'online',
          timestamp: new Date().toISOString(),
        });
      } else {
        existingSockets.add(socket.id);
      }

      // Immediately send the current list of online users to the newly connected client
      socket.emit('users:online', getOnlineUserIds());

      // Mark any pending messages as delivered and notify senders
      ChatMessage.find({ recipient: userId, delivered: false })
        .select('sender')
        .lean()
        .then((undelivered) => {
          if (undelivered && undelivered.length > 0) {
            ChatMessage.updateMany(
              { recipient: userId, delivered: false },
              { $set: { delivered: true, deliveredAt: new Date() } }
            )
              .then(() => {
                const senders = [...new Set(undelivered.map((m) => String(m.sender)))];
                senders.forEach((senderId) => {
                  ioInstance.to(`user:${senderId}`).emit('chat:delivered', {
                    deliveredTo: userId,
                  });
                });
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }

    // Allow client to request fresh online users list at any time
    socket.on('users:get_online', () => {
      socket.emit('users:online', getOnlineUserIds());
    });

    // Real-time typing indicators
    socket.on('chat:typing', (payload) => {
      if (!userId || !payload?.recipientId) return;
      const recipientId = String(payload.recipientId);
      ioInstance.to(`user:${recipientId}`).emit('chat:typing', {
        senderId: userId,
        isTyping: Boolean(payload.isTyping),
      });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info(`Socket client disconnected: ${socket.id} (reason: ${reason})`);

      if (userId && onlineUsers.has(userId)) {
        const userSockets = onlineUsers.get(userId);
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast user is now offline
          ioInstance.emit('user:status', {
            userId,
            status: 'offline',
            lastSeen: new Date().toISOString(),
          });
        }
      }
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

export function broadcastEvent(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
