import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../constants/validationMessages.js';

export const orderItemInputSchema = z.object({
  product: z.string().min(1, VALIDATION_MESSAGES.required('Product ID')),
  quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1')
});

export const createOrderSchema = z.object({
  customer: z.string().min(1, VALIDATION_MESSAGES.required('Customer ID')),
  items: z.array(orderItemInputSchema).min(1, 'Order must contain at least one product item'),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  taxPercent: z.number().min(0).max(100).optional().default(0),
  paymentMethod: z.enum(['Cash', 'Bank Transfer', 'Cheque', 'Credit Card', 'UPI']).default('Cash'),
  notes: z.string().max(500).optional().default(''),
  idempotencyKey: z.string().optional()
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['Pending', 'Processing', 'Completed', 'Cancelled']),
  cancelledReason: z.string().max(300).optional()
});
