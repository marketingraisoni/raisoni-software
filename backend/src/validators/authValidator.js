import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../constants/validationMessages.js';

export const loginSchema = z.object({
  username: z.string().min(1, VALIDATION_MESSAGES.required('Username or email')).trim(),
  password: z.string().min(1, VALIDATION_MESSAGES.required('Password'))
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, VALIDATION_MESSAGES.required('Current password')),
  newPassword: z.string().min(6, VALIDATION_MESSAGES.minLength('New password', 6))
});
