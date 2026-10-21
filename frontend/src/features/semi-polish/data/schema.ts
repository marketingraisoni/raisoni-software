import { z } from 'zod';

export const vendorSchema = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().min(1, 'Vendor name is required'),
  mobile: z.string().optional(),
  address: z.string().optional(),
  gstin: z.string().optional(),
  processType: z.string().default('4P'),
  status: z.enum(['active', 'inactive']).default('active'),
  createdAt: z.coerce.date().optional(),
});

export type Vendor = z.infer<typeof vendorSchema>;

export const packetSnapshotSchema = z.object({
  packetId: z.string(),
  srNo: z.number().int(),
  name: z.string(),
  grade: z.string(),
  carat: z.number(),
});

export type PacketSnapshot = z.infer<typeof packetSnapshotSchema>;

export const semiPolishProcessSchema = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  lot: z.any(),
  kapanNo: z.string(),
  issueNo: z.string(),
  vendor: z.any(),
  vendorName: z.string(),
  status: z.enum(['in_process', 'returned', 'cancelled']),
  issueDate: z.coerce.date(),
  expectedReturnDate: z.coerce.date().nullable().optional(),
  issuedPieces: z.number().int(),
  issuedCarat: z.number(),
  packets: z.array(packetSnapshotSchema).default([]),
  returnedPieces: z.number().int().nullable().optional(),
  returnedCarat: z.number().nullable().optional(),
  processLossCarat: z.number().nullable().optional(),
  processLossPercentage: z.number().nullable().optional(),
  returnDate: z.coerce.date().nullable().optional(),
  notes: z.string().optional().default(''),
  returnNotes: z.string().optional().default(''),
  issuedBy: z.any().optional(),
  receivedBy: z.any().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SemiPolishProcess = z.infer<typeof semiPolishProcessSchema>;

export type EligibleLot = {
  _id: string;
  id?: string;
  kapanNo: string;
  totalCarat: number;
  totalPcs: number;
  entryDate: string | Date;
};
