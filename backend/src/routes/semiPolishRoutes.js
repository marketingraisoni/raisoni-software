import { Router } from 'express';
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
} from '../constants/permissions.js';
import * as semiPolishController from '../controllers/semiPolishController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';

const router = Router();

router.use(authenticate);

router.get(
  '/vendors',
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  semiPolishController.getVendors
);

router.post(
  '/vendors',
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.CREATE),
  semiPolishController.createVendor
);

router.get(
  '/eligible-lots',
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  semiPolishController.getEligibleLots
);

router.get(
  '/',
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  semiPolishController.getSemiPolishList
);

router.get(
  '/:id/export',
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  semiPolishController.exportSemiPolishRecord
);

router.get(
  '/:id',
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  semiPolishController.getSemiPolishById
);

router.post(
  '/issue',
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.CREATE),
  semiPolishController.issueToSemiPolish
);

router.post(
  '/:id/return',
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.UPDATE),
  semiPolishController.receiveFromSemiPolish
);

router.post(
  '/:id/cancel',
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.DELETE),
  semiPolishController.cancelSemiPolishIssue
);

export default router;
