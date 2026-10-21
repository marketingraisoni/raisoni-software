import { Router } from 'express';
import * as settingController from '../controllers/settingController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../constants/permissions.js';
import { updateSettingSchema } from '../validators/settingValidator.js';

const router = Router();

router.use(authenticate);

router.get('/', permit(PERMISSION_MODULE.SETTINGS, PERMISSION_ACTION.READ), settingController.getSettings);
router.post('/', permit(PERMISSION_MODULE.SETTINGS, PERMISSION_ACTION.UPDATE), validate(updateSettingSchema), settingController.updateSetting);

export default router;
