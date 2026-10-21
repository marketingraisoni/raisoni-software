import { config } from '../config/env.js';
import { getDatabaseHealth } from '../config/db.js';
import { API_MESSAGES } from '../constants/messages.js';
import { USER_TYPE, USER_STATUS } from '../constants/user.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { serializeUser } from '../serializers/userSerializer.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getLocalIpAddresses, getPrimaryLanIp } from '../utils/network.js';

export const getDashboardMetrics = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    adminCount,
    managerCount,
    staffCount,
    recentUsers,
    recentActivity,
    database,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: USER_STATUS.ACTIVE }),
    User.countDocuments({ status: USER_STATUS.INACTIVE }),
    User.countDocuments({ userType: USER_TYPE.ADMIN }),
    User.countDocuments({ userType: USER_TYPE.MANAGER }),
    User.countDocuments({ userType: USER_TYPE.STAFF }),
    User.find().sort({ createdAt: -1 }).limit(5).lean(),
    AuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
    getDatabaseHealth(),
  ]);

  const primaryLanIp = getPrimaryLanIp();

  return sendSuccess(res, {
    message: API_MESSAGES.DASHBOARD.RETRIEVED,
    data: {
      metrics: { totalUsers, activeUsers, inactiveUsers, adminCount, managerCount, staffCount },
      recentUsers: recentUsers.map(serializeUser),
      recentActivity,
      serverInfo: {
        appName: config.appName,
        version: config.appVersion,
        port: config.port,
        primaryLanIp,
        lanAddresses: getLocalIpAddresses(),
        clientIp: req.ip || req.socket.remoteAddress,
        apiUrl: `http://${primaryLanIp}:${config.port}/api`,
      },
      database,
    },
  });
});
