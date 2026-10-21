import { z } from 'zod';
import { USER_STATUSES, USER_STATUS } from '../constants/user.js';
import { VALIDATION_MESSAGES } from '../constants/validationMessages.js';

export const customerSchema = z.object({
  name: z.string().min(2, VALIDATION_MESSAGES.minLength('Name', 2)).max(100, VALIDATION_MESSAGES.maxLength('Name', 100)).trim(),
  company: z.string().max(100).trim().optional().default(''),
  email: z.string().email(VALIDATION_MESSAGES.invalidEmail).trim().toLowerCase(),
  phone: z.string().min(7, VALIDATION_MESSAGES.minLength('Phone', 7)).max(25, VALIDATION_MESSAGES.maxLength('Phone', 25)).trim(),
  address: z.object({
    street: z.string().optional().default(''),
    city: z.string().optional().default(''),
    state: z.string().optional().default(''),
    postalCode: z.string().optional().default(''),
    country: z.string().optional().default('India')
  }).optional().default({}),
  status: z.enum(USER_STATUSES).optional().default(USER_STATUS.ACTIVE),
  notes: z.string().max(500, VALIDATION_MESSAGES.maxLength('Notes', 500)).optional().default('')
});

export const updateCustomerSchema = customerSchema.partial();
