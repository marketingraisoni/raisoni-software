import express, { Router } from "express";
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
} from "../constants/permissions.js";
import * as semiPolishController from "../controllers/semiPolishController.js";
import * as planningController from "../controllers/semiPolishPlanningController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/permissionMiddleware.js";

const router = Router();

router.use(authenticate);

router.get(
  "/vendors",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  semiPolishController.getVendors,
);

router.post(
  "/vendors",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.CREATE),
  semiPolishController.createVendor,
);

router.get(
  "/eligible-lots",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  semiPolishController.getEligibleLots,
);

router.get(
  "/",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  semiPolishController.getSemiPolishList,
);

router.get(
  "/packet-lookup",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  planningController.lookupPlannedPacket,
);

router.post(
  "/packet-lookup",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  planningController.lookupPlannedPacket,
);

router.get(
  "/:id/export",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  semiPolishController.exportSemiPolishRecord,
);

router.get(
  "/:id",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  semiPolishController.getSemiPolishById,
);

router.post(
  "/issue",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.CREATE),
  semiPolishController.issueToSemiPolish,
);

router.post(
  "/:id/planning/import",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.UPDATE),
  express.raw({
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    limit: "20mb",
  }),
  planningController.importPlanningWorkbook,
);

router.post(
  "/:id/planning/:importId/confirm",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.UPDATE),
  planningController.confirmPlanningImport,
);

router.get(
  "/:id/planning",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  planningController.getPlanningDetails,
);

router.get(
  "/:id/planning/file",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ),
  planningController.downloadPlanningWorkbook,
);

router.post(
  "/:id/packets/:packetNumber/receive",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.UPDATE),
  planningController.receivePlannedPacket,
);

router.post(
  "/:id/packets/:packetNumber/resolve",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.UPDATE),
  planningController.resolvePacketIssue,
);

router.post(
  "/:id/finalize-return",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.UPDATE),
  planningController.finalizePlanningReturn,
);

router.post(
  "/:id/return",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.UPDATE),
  semiPolishController.receiveFromSemiPolish,
);

router.post(
  "/:id/cancel",
  permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.DELETE),
  semiPolishController.cancelSemiPolishIssue,
);

export default router;
