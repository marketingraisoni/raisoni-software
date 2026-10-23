import { Router } from "express";
import * as permissionController from "../controllers/permissionController.js";
import * as userController from "../controllers/userController.js";
import { PERMISSION_MODULE } from "../constants/permissions.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/permissionMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  updatePermissionsSchema,
  userListQuerySchema,
} from "../validators/userValidator.js";

const router = Router();
router.use(authenticate);

router.get(
  "/modules",
  permit(PERMISSION_MODULE.PERMISSIONS),
  permissionController.getPermissionCatalog,
);
router.get(
  "/users",
  permit(PERMISSION_MODULE.PERMISSIONS),
  validate(userListQuerySchema, "query"),
  userController.getUsers,
);
router.get(
  "/users/:userId",
  permit(PERMISSION_MODULE.PERMISSIONS),
  permissionController.getUserPermissions,
);
router.put(
  "/users/:userId",
  permit(PERMISSION_MODULE.PERMISSIONS),
  validate(updatePermissionsSchema),
  permissionController.updateUserPermissions,
);

export default router;
