import express, { Router } from 'express';
import * as chatController from '../controllers/chatController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

router.get('/users', chatController.getChatUsers);
router.get('/online-users', chatController.getOnlineUsers);
router.get('/unread-count', chatController.getUnreadCount);
router.get('/messages/:userId', chatController.getChatMessages);
router.post(
  '/upload',
  express.raw({ type: '*/*', limit: '25mb' }),
  chatController.uploadAttachment
);
router.post('/messages', chatController.sendMessage);
router.put('/messages/:userId/read', chatController.markMessagesRead);

export default router;
