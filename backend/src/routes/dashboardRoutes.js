import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { PERMISSION_MODULE } from '../constants/permissions.js';
import { cacheResponse } from '../middleware/cacheMiddleware.js';

const router = Router();

// The dashboard runs ~30 MongoDB queries/aggregations, so it is shared across users for 30s.
// Any successful write under /api clears it (see invalidateDashboardOnWrite in server.js).
// Clients can force fresh data with ?nocache=1 or the X-No-Cache header.
router.get(
  '/',
  authenticate,
  permit(PERMISSION_MODULE.DASHBOARD),
  cacheResponse(30, {
    prefix: 'dashboard:metrics',
    // serverInfo.clientIp belongs to the requesting PC, not to whoever filled the cache.
    personalize: (body, req) => {
      if (!body?.data?.serverInfo) return body;
      return {
        ...body,
        data: {
          ...body.data,
          serverInfo: { ...body.data.serverInfo, clientIp: req.ip || req.socket?.remoteAddress },
        },
      };
    },
  }),
  dashboardController.getDashboardMetrics
);

export default router;
