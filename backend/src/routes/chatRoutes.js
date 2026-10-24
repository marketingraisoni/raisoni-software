import express, { Router } from 'express';
import * as chatController from '../controllers/chatController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/permissionMiddleware.js';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../constants/permissions.js';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

router.get(
  '/users',
  permit(PERMISSION_MODULE.CHAT, PERMISSION_ACTION.READ),
  chatController.getChatUsers
);
router.get(
  '/online-users',
  permit(PERMISSION_MODULE.CHAT, PERMISSION_ACTION.READ),
  chatController.getOnlineUsers
);
router.get(
  '/unread-count',
  permit(PERMISSION_MODULE.CHAT, PERMISSION_ACTION.READ),
  chatController.getUnreadCount
);
router.get(
  '/messages/:userId',
  permit(PERMISSION_MODULE.CHAT, PERMISSION_ACTION.READ),
  chatController.getChatMessages
);
router.post(
  '/upload',
  permit(PERMISSION_MODULE.CHAT, PERMISSION_ACTION.CREATE),
  express.raw({ type: '*/*', limit: '25mb' }),
  chatController.uploadAttachment
);
router.post(
  '/messages',
  permit(PERMISSION_MODULE.CHAT, PERMISSION_ACTION.CREATE),
  chatController.sendMessage
);
router.put(
  '/messages/:userId/read',
  permit(PERMISSION_MODULE.CHAT, PERMISSION_ACTION.READ),
  chatController.markMessagesRead
);

export default router;
