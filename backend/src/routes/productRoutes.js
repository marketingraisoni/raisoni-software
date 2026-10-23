import { Router } from "express";
import * as productController from "../controllers/productController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/permissionMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  productSchema,
  updateProductSchema,
} from "../validators/productValidator.js";
import { PERMISSION_MODULE } from "../constants/permissions.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  permit(PERMISSION_MODULE.PRODUCTS),
  productController.getProducts,
);
router.get(
  "/categories",
  permit(PERMISSION_MODULE.PRODUCTS),
  productController.getCategories,
);
router.get(
  "/:id",
  permit(PERMISSION_MODULE.PRODUCTS),
  productController.getProductById,
);
router.post(
  "/",
  permit(PERMISSION_MODULE.PRODUCTS),
  validate(productSchema),
  productController.createProduct,
);
router.put(
  "/:id",
  permit(PERMISSION_MODULE.PRODUCTS),
  validate(updateProductSchema),
  productController.updateProduct,
);
router.delete(
  "/:id",
  permit(PERMISSION_MODULE.PRODUCTS),
  productController.deleteProduct,
);

export default router;
