import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../constants/permissions.js';

const router = Router();

router.get('/', authenticate, permit(PERMISSION_MODULE.DASHBOARD, PERMISSION_ACTION.READ), dashboardController.getDashboardMetrics);

export default router;
