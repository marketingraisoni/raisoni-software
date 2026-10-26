import { Router } from "express";
import * as lotController from "../controllers/lotController.js";
import * as assortmentPacketController from "../controllers/assortmentPacketController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/permissionMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { lotSchema, updateLotSchema } from "../validators/lotValidator.js";
import {
  assortmentPacketSchema,
  updateAssortmentPacketSchema,
} from "../validators/assortmentPacketValidator.js";
import { PERMISSION_MODULE } from "../constants/permissions.js";
import { assortmentWriteRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = Router();

router.use(authenticate);

router.get("/", permit(PERMISSION_MODULE.LOTS), lotController.getLots);
router.get(
  "/:lotId/packets/export",
  permit(PERMISSION_MODULE.ASSORTMENT),
  assortmentPacketController.exportAssortmentPackets,
);
router.get(
  "/:lotId/packets",
  permit(PERMISSION_MODULE.ASSORTMENT),
  assortmentPacketController.getAssortmentPackets,
);
// Multi-grade routes are intentionally disabled. Assortment now uses built-in Grade A only.
// The controller logic is retained so the former workflow can be restored if requirements change.
router.put(
  "/:lotId/packets/:packetId",
  permit(PERMISSION_MODULE.ASSORTMENT),
  assortmentWriteRateLimiter,
  validate(updateAssortmentPacketSchema),
  assortmentPacketController.updateAssortmentPacket,
);
router.post(
  "/:lotId/packets",
  permit(PERMISSION_MODULE.ASSORTMENT),
  assortmentWriteRateLimiter,
  validate(assortmentPacketSchema),
  assortmentPacketController.createAssortmentPacket,
);
router.get("/:id", permit(PERMISSION_MODULE.LOTS), lotController.getLotById);
router.post(
  "/",
  permit(PERMISSION_MODULE.LOTS),
  validate(lotSchema),
  lotController.createLot,
);
router.put(
  "/:id",
  permit(PERMISSION_MODULE.LOTS),
  validate(updateLotSchema),
  lotController.updateLot,
);
router.delete("/:id", permit(PERMISSION_MODULE.LOTS), lotController.deleteLot);

export default router;
