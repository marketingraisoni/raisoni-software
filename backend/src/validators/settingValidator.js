import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../constants/validationMessages.js';

export const updateSettingSchema = z.object({
  key: z.string().min(1, VALIDATION_MESSAGES.required('Setting key')).trim(),
  value: z.unknown(),
});
