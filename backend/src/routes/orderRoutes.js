import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createOrderSchema, updateOrderStatusSchema } from '../validators/orderValidator.js';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', permit(PERMISSION_MODULE.ORDERS, PERMISSION_ACTION.READ), orderController.getOrders);
router.get('/:id', permit(PERMISSION_MODULE.ORDERS, PERMISSION_ACTION.READ), orderController.getOrderById);
router.post('/', permit(PERMISSION_MODULE.ORDERS, PERMISSION_ACTION.CREATE), validate(createOrderSchema), orderController.createOrder);
router.patch('/:id/status', permit(PERMISSION_MODULE.ORDERS, PERMISSION_ACTION.UPDATE), validate(updateOrderStatusSchema), orderController.updateOrderStatus);

export default router;
