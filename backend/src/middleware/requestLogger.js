import { logger } from '../utils/logger.js';

export function requestLogger(req, res, next) {
  if (req.originalUrl !== '/api/health') {
    logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip || req.socket.remoteAddress}`);
  }
  next();
}
