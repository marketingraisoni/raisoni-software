import { Router } from "express";
import * as orderController from "../controllers/orderController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/permissionMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "../validators/orderValidator.js";
import { PERMISSION_MODULE } from "../constants/permissions.js";

const router = Router();

router.use(authenticate);

router.get("/", permit(PERMISSION_MODULE.ORDERS), orderController.getOrders);
router.get(
  "/:id",
  permit(PERMISSION_MODULE.ORDERS),
  orderController.getOrderById,
);
router.post(
  "/",
  permit(PERMISSION_MODULE.ORDERS),
  validate(createOrderSchema),
  orderController.createOrder,
);
router.patch(
  "/:id/status",
  permit(PERMISSION_MODULE.ORDERS),
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus,
);

export default router;
