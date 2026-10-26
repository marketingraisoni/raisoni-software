import { z } from 'zod';

export const assortmentPacketSchema = z.object({
  carat: z
    .number({
      required_error: 'Packet carat is required',
      invalid_type_error: 'Packet carat must be a number',
    })
    .positive('Packet carat must be greater than 0')
    .multipleOf(0.001, 'Packet carat supports up to 3 decimal places'),
  requestId: z
    .string({ required_error: 'Packet request ID is required' })
    .trim()
    .min(8, 'Packet request ID is invalid')
    .max(100, 'Packet request ID is invalid'),
});

export const updateAssortmentPacketSchema = assortmentPacketSchema.pick({
  carat: true,
});
