import { z } from 'zod';
import {
  USER_TYPES,
  USER_TYPE,
  USER_SORT_FIELDS,
  USER_STATUSES,
  USER_STATUS,
} from '../constants/user.js';
import { VALIDATION_MESSAGES } from '../constants/validationMessages.js';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from '../constants/permissions.js';

const csvEnumArray = (values) => z.preprocess((value) => {
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return Array.isArray(value) ? value : [];
}, z.array(z.enum(values)).default([]));

const userTypeSchema = z.coerce.number().int().refine(
  (value) => USER_TYPES.includes(value),
  VALIDATION_MESSAGES.invalidOption('User type')
);

const csvUserTypes = z.preprocess((value) => {
  if (typeof value === 'string') {
    return value.split(',').map((item) => Number(item.trim())).filter(Number.isFinite);
  }
  return Array.isArray(value) ? value.map(Number) : [];
}, z.array(userTypeSchema).default([]));

export const permissionGrantSchema = z.object({
  module: z.enum(PERMISSION_MODULES),
  actions: z.array(z.enum(PERMISSION_ACTIONS)),
});

export const updatePermissionsSchema = z.object({
  permissions: z.array(permissionGrantSchema),
});

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional().default(''),
  status: csvEnumArray(USER_STATUSES),
  userType: csvUserTypes,
  sortBy: z.enum(USER_SORT_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createUserSchema = z.object({
  name: z.string().min(2, VALIDATION_MESSAGES.minLength('Name', 2)).max(100, VALIDATION_MESSAGES.maxLength('Name', 100)).trim(),
  username: z.string()
    .min(3, VALIDATION_MESSAGES.minLength('Username', 3))
    .max(30, VALIDATION_MESSAGES.maxLength('Username', 30))
    .trim()
    .toLowerCase()
    .refine((val) => !/\s/.test(val), 'Username cannot contain spaces.')
    .refine((val) => /[a-z]/.test(val) && /\d/.test(val), 'Username must contain both letters and numbers.')
    .refine((val) => /^[a-z0-9._-]+$/.test(val), 'Username can only contain lowercase letters, numbers, and ._-'),
  email: z.string().email(VALIDATION_MESSAGES.invalidEmail).trim().toLowerCase(),
  password: z.string().min(6, VALIDATION_MESSAGES.minLength('Password', 6)),
  userType: userTypeSchema.default(USER_TYPE.STAFF),
  status: z.enum(USER_STATUSES).default(USER_STATUS.ACTIVE),
  notes: z.string().max(500, VALIDATION_MESSAGES.maxLength('Notes', 500)).optional().default(''),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, VALIDATION_MESSAGES.minLength('Name', 2)).max(100, VALIDATION_MESSAGES.maxLength('Name', 100)).trim().optional(),
  email: z.string().email(VALIDATION_MESSAGES.invalidEmail).trim().toLowerCase().optional(),
  password: z.string().min(6, VALIDATION_MESSAGES.minLength('Password', 6)).optional(),
  userType: userTypeSchema.optional(),
  status: z.enum(USER_STATUSES).optional(),
  notes: z.string().max(500, VALIDATION_MESSAGES.maxLength('Notes', 500)).optional(),
});
