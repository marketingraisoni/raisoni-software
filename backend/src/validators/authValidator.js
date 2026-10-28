import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../constants/validationMessages.js';

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, VALIDATION_MESSAGES.required('Username or email'))
    .trim(),
  password: z.string().min(1, VALIDATION_MESSAGES.required('Password')),
  rememberMe: z.boolean().optional().default(false),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, VALIDATION_MESSAGES.required('Current password')),
  newPassword: z
    .string()
    .min(6, VALIDATION_MESSAGES.minLength('New password', 6)),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, VALIDATION_MESSAGES.minLength('Name', 2))
    .max(100, VALIDATION_MESSAGES.maxLength('Name', 100))
    .trim(),
  username: z
    .string()
    .min(3, VALIDATION_MESSAGES.minLength('Username', 3))
    .max(30, VALIDATION_MESSAGES.maxLength('Username', 30))
    .trim()
    .toLowerCase()
    .refine((value) => !/\s/.test(value), 'Username cannot contain spaces.')
    .refine(
      (value) => /^[a-z0-9._-]+$/.test(value),
      'Username can only contain lowercase letters, numbers, and ._-',
    ),
});
