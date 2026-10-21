import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
} from '../validators/userValidator.js';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', permit(PERMISSION_MODULE.USERS, PERMISSION_ACTION.READ), validate(userListQuerySchema, 'query'), userController.getUsers);
router.post('/', permit(PERMISSION_MODULE.USERS, PERMISSION_ACTION.CREATE), validate(createUserSchema), userController.createUser);
router.put('/:id', permit(PERMISSION_MODULE.USERS, PERMISSION_ACTION.UPDATE), validate(updateUserSchema), userController.updateUser);
router.delete('/:id', permit(PERMISSION_MODULE.USERS, PERMISSION_ACTION.DELETE), userController.deleteUser);

export default router;
