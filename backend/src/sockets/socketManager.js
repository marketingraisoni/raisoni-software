import { Server } from 'socket.io';
import { logger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

let ioInstance = null;

export function initSocketIO(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Optional socket authentication
  ioInstance.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        socket.user = decoded;
      } catch (err) {
        logger.warn(`Socket connection with invalid token: ${err.message}`);
      }
    }
    next();
  });

  ioInstance.on('connection', (socket) => {
    logger.info(`Socket client connected: ${socket.id} (user: ${socket.user?.username || 'anonymous'})`);

    socket.on('disconnect', () => {
      logger.info(`Socket client disconnected: ${socket.id}`);
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
      timestamp: new Date().toISOString()
    });
  }
}
