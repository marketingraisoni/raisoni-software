import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';
import { broadcastEvent } from '../sockets/socketManager.js';

export async function logAudit({ action, entityType, entityId, user, req, details }) {
  try {
    const log = await AuditLog.create({
      action,
      entityType,
      entityId,
      user: user?._id,
      username: user?.username || 'System',
      role: user?.userType ? String(user.userType) : 'system',
      ipAddress: req?.ip || req?.socket?.remoteAddress || '127.0.0.1',
      details
    });

    broadcastEvent('audit:new', {
      action,
      entityType,
      username: user?.username || 'System',
      timestamp: log.createdAt
    });

    return log;
  } catch (err) {
    logger.warn(`Failed to write audit log: ${err.message}`);
  }
}
