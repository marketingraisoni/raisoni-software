import { Router } from "express";
import * as inventoryController from "../controllers/inventoryController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/permissionMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { stockAdjustmentSchema } from "../validators/inventoryValidator.js";
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
} from "../constants/permissions.js";

const router = Router();

router.use(authenticate);

router.get(
  "/overview",
  permit(PERMISSION_MODULE.INVENTORY),
  inventoryController.getStockOverview,
);
router.get(
  "/low-stock",
  permit(PERMISSION_MODULE.INVENTORY),
  inventoryController.getLowStockProducts,
);
router.get(
  "/movements",
  permit(PERMISSION_MODULE.INVENTORY),
  inventoryController.getMovements,
);
router.post(
  "/adjust",
  permit(PERMISSION_MODULE.INVENTORY, PERMISSION_ACTION.UPDATE),
  validate(stockAdjustmentSchema),
  inventoryController.adjustStock,
);

export default router;
