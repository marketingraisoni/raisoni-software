import express, { Router } from 'express';
import * as settingController from '../controllers/settingController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
} from '../constants/permissions.js';
import { updateSettingSchema } from '../validators/settingValidator.js';

const router = Router();

router.get('/public/branding', settingController.getPublicBranding);

router.use(authenticate);

router.get('/support', settingController.getSupportContacts);

router.post(
  '/branding/image',
  permit(PERMISSION_MODULE.SETTINGS, PERMISSION_ACTION.UPDATE),
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    limit: '9mb',
  }),
  settingController.uploadLoginImage,
);

router.get(
  '/',
  permit(PERMISSION_MODULE.SETTINGS),
  settingController.getSettings,
);
router.post(
  '/',
  permit(PERMISSION_MODULE.SETTINGS, PERMISSION_ACTION.UPDATE),
  validate(updateSettingSchema),
  settingController.updateSetting,
);

export default router;
