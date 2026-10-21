import { Router } from 'express';
import * as lotController from '../controllers/lotController.js';
import * as assortmentPacketController from '../controllers/assortmentPacketController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { lotSchema, updateLotSchema } from '../validators/lotValidator.js';
import { assortmentPacketSchema, updateAssortmentPacketSchema } from '../validators/assortmentPacketValidator.js';
import { assortmentGradeSchema, updateAssortmentGradeSchema } from '../validators/assortmentGradeValidator.js';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ), lotController.getLots);
router.get('/:lotId/packets', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ), assortmentPacketController.getAssortmentPackets);
router.post('/:lotId/grades', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.CREATE), validate(assortmentGradeSchema), assortmentPacketController.createAssortmentGrade);
router.put('/:lotId/grades/:gradeId', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.UPDATE), validate(updateAssortmentGradeSchema), assortmentPacketController.updateAssortmentGrade);
router.delete('/:lotId/grades/:gradeId', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.DELETE), assortmentPacketController.deleteAssortmentGrade);
router.put('/:lotId/packets/:packetId', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.UPDATE), validate(updateAssortmentPacketSchema), assortmentPacketController.updateAssortmentPacket);
router.post('/:lotId/packets', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.CREATE), validate(assortmentPacketSchema), assortmentPacketController.createAssortmentPacket);
router.get('/:id', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ), lotController.getLotById);
router.post('/', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.CREATE), validate(lotSchema), lotController.createLot);
router.put('/:id', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.UPDATE), validate(updateLotSchema), lotController.updateLot);
router.delete('/:id', permit(PERMISSION_MODULE.LOTS, PERMISSION_ACTION.DELETE), lotController.deleteLot);

export default router;
