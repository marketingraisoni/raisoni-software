import { Router } from 'express';
import * as permissionController from '../controllers/permissionController.js';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../constants/permissions.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { updatePermissionsSchema } from '../validators/userValidator.js';

const router = Router();
router.use(authenticate);

router.get('/modules', permit(PERMISSION_MODULE.USERS, PERMISSION_ACTION.READ), permissionController.getPermissionCatalog);
router.get('/users/:userId', permit(PERMISSION_MODULE.USERS, PERMISSION_ACTION.READ), permissionController.getUserPermissions);
router.put('/users/:userId', permit(PERMISSION_MODULE.USERS, PERMISSION_ACTION.UPDATE), validate(updatePermissionsSchema), permissionController.updateUserPermissions);

export default router;
