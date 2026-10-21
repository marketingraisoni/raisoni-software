import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../constants/validationMessages.js';

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, VALIDATION_MESSAGES.required('Product ID')),
  changeQuantity: z.number().int('Adjustment must be an integer').refine(val => val !== 0, 'Change quantity cannot be zero'),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(200, 'Reason cannot exceed 200 characters')
});
