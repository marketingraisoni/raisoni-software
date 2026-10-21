import { Router } from 'express';
import * as productController from '../controllers/productController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { productSchema, updateProductSchema } from '../validators/productValidator.js';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', permit(PERMISSION_MODULE.PRODUCTS, PERMISSION_ACTION.READ), productController.getProducts);
router.get('/categories', permit(PERMISSION_MODULE.PRODUCTS, PERMISSION_ACTION.READ), productController.getCategories);
router.get('/:id', permit(PERMISSION_MODULE.PRODUCTS, PERMISSION_ACTION.READ), productController.getProductById);
router.post('/', permit(PERMISSION_MODULE.PRODUCTS, PERMISSION_ACTION.CREATE), validate(productSchema), productController.createProduct);
router.put('/:id', permit(PERMISSION_MODULE.PRODUCTS, PERMISSION_ACTION.UPDATE), validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', permit(PERMISSION_MODULE.PRODUCTS, PERMISSION_ACTION.DELETE), productController.deleteProduct);

export default router;
