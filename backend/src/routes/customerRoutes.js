import { Router } from 'express';
import * as customerController from '../controllers/customerController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { customerSchema, updateCustomerSchema } from '../validators/customerValidator.js';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', permit(PERMISSION_MODULE.CUSTOMERS, PERMISSION_ACTION.READ), customerController.getCustomers);
router.get('/:id', permit(PERMISSION_MODULE.CUSTOMERS, PERMISSION_ACTION.READ), customerController.getCustomerById);
router.post('/', permit(PERMISSION_MODULE.CUSTOMERS, PERMISSION_ACTION.CREATE), validate(customerSchema), customerController.createCustomer);
router.put('/:id', permit(PERMISSION_MODULE.CUSTOMERS, PERMISSION_ACTION.UPDATE), validate(updateCustomerSchema), customerController.updateCustomer);
router.delete('/:id', permit(PERMISSION_MODULE.CUSTOMERS, PERMISSION_ACTION.DELETE), customerController.deleteCustomer);

export default router;
