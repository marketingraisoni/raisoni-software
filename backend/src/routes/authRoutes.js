import express, { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { loginRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../validators/authValidator.js';

const router = Router();

router.post(
  '/login',
  loginRateLimiter,
  validate(loginSchema),
  authController.login,
);
router.get('/me', authenticate, authController.getCurrentUser);
router.put(
  '/profile',
  authenticate,
  validate(updateProfileSchema),
  authController.updateProfile,
);
router.post(
  '/profile/photo',
  authenticate,
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    limit: '6mb',
  }),
  authController.uploadProfilePhoto,
);
router.delete(
  '/profile/photo',
  authenticate,
  authController.removeProfilePhoto,
);
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);
router.post('/logout', authenticate, authController.logout);

export default router;
