import { z } from 'zod';

export const assortmentGradeSchema = z.object({
  grade: z
    .string()
    .trim()
    .toUpperCase()
    .length(1, 'Grade must be exactly one letter')
    .regex(/^[A-Z]$/, 'Grade must be one letter from A to Z'),
  targetPcs: z
    .number({
      required_error: 'Grade pieces are required',
      invalid_type_error: 'Grade pieces must be a number',
    })
    .int('Grade pieces must be a whole number')
    .positive('Grade pieces must be at least 1'),
});

export const updateAssortmentGradeSchema = assortmentGradeSchema.pick({
  targetPcs: true,
});
