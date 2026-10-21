import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../constants/validationMessages.js';

export const productSchema = z.object({
  sku: z.string().min(2, VALIDATION_MESSAGES.minLength('SKU', 2)).max(50, VALIDATION_MESSAGES.maxLength('SKU', 50)).trim().toUpperCase(),
  name: z.string().min(2, VALIDATION_MESSAGES.minLength('Product name', 2)).max(150, VALIDATION_MESSAGES.maxLength('Product name', 150)).trim(),
  category: z.string().min(2, VALIDATION_MESSAGES.required('Category')).max(60, VALIDATION_MESSAGES.maxLength('Category', 60)).trim(),
  description: z.string().max(1000).optional().default(''),
  costPrice: z.number({ invalid_type_error: VALIDATION_MESSAGES.invalidType('Cost price', 'a number') }).min(0, 'Cost price cannot be negative'),
  sellingPrice: z.number({ invalid_type_error: VALIDATION_MESSAGES.invalidType('Selling price', 'a number') }).min(0, 'Selling price cannot be negative'),
  stockQuantity: z.number().int('Stock must be an integer').min(0, 'Stock cannot be negative').default(0),
  minStockThreshold: z.number().int().min(0).default(10),
  status: z.enum(['active', 'discontinued']).default('active')
});

export const updateProductSchema = productSchema.partial();
