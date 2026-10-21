import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../constants/validationMessages.js';

export const lotSchema = z.object({
  kapanNo: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, 'Kapan No must contain exactly 2 letters')
    .regex(/^[A-Z]{2}$/, 'Kapan No must contain only letters from A to Z'),
  totalCarat: z
    .number({
      required_error: VALIDATION_MESSAGES.required('Total Carat'),
      invalid_type_error: VALIDATION_MESSAGES.invalidType('Total Carat', 'a number'),
    })
    .positive('Total Carat must be greater than 0')
    .multipleOf(0.001, 'Total Carat supports up to 3 decimal places'),
  totalPcs: z
    .number({
      required_error: VALIDATION_MESSAGES.required('Total PCs'),
      invalid_type_error: VALIDATION_MESSAGES.invalidType('Total PCs', 'a number'),
    })
    .int('Total PCs must be a whole number')
    .positive('Total PCs must be at least 1'),
  entryDate: z.coerce.date({
    required_error: VALIDATION_MESSAGES.required('Entry Date'),
    invalid_type_error: VALIDATION_MESSAGES.invalidType('Entry Date', 'a valid date'),
  }),
});

export const updateLotSchema = z.object({
  status: z.enum(['active', 'closed']),
});
