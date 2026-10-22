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
  activePlanningImport: z.any().nullable().optional(),
  planningImportedAt: z.coerce.date().nullable().optional(),
  plannedPacketCount: z.number().int().optional().default(0),
  plannedPolishedPieces: z.number().int().optional().default(0),
  planningRoughCarat: z.number().nullable().optional(),
  plannedPolishedCarat: z.number().nullable().optional(),
  plannedYieldPercentage: z.number().nullable().optional(),
  returnedPacketCount: z.number().int().optional().default(0),
  returnedPolishedPieceCount: z.number().int().optional().default(0),
  returnedPieces: z.number().int().nullable().optional(),
  returnedCarat: z.number().nullable().optional(),
  processLossCarat: z.number().nullable().optional(),
  processLossPercentage: z.number().nullable().optional(),
  returnDate: z.coerce.date().nullable().optional(),
  notes: z.string().optional().default(''),
  returnNotes: z.string().optional().default(''),
  issuedBy: z.any().optional(),
  receivedBy: z.any().optional(),
  finalizedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SemiPolishProcess = z.infer<typeof semiPolishProcessSchema>;

export type PlanningDifference = {
  type: string
  packetNumber?: number | null
  expected?: unknown
  actual?: unknown
  message: string
}

export type PlannedPiece = {
  _id?: string
  id?: string
  pieceNumber: number
  sourceRow: number
  planningSerial?: number | null
  polishedCarat: number
  shape: string
  cut: string
  color: string
  clarity: string
  ls: string
}

export type SemiPolishPacketPlan = {
  _id?: string
  id?: string
  planningImport: string
  matchedPacket?: string | null
  matchStatus: 'matched' | 'weight_mismatch' | 'unmatched'
  packetNumber: number
  rawPacketLabel: string
  planningGrade: string
  planningLotNo: string
  roughCarat: number
  issuedRoughCarat?: number | null
  roughCaratDifference?: number | null
  checkerId: string
  sourceSerial?: number | null
  plannedPieceCount: number
  plannedPolishedCarat: number
  yieldPercentage: number
  sourceStartRow: number
  pieces: PlannedPiece[]
}

export type SemiPolishPlanningImport = {
  _id?: string
  id?: string
  version: number
  status: 'needs_confirmation' | 'active' | 'superseded' | 'failed'
  source: 'planning_excel'
  originalFileName: string
  fileSize: number
  checksumSha256: string
  packetCount: number
  plannedPieceCount: number
  planningRoughCarat: number
  plannedPolishedCarat: number
  plannedYieldPercentage: number
  matchedPacketCount: number
  differences: PlanningDifference[]
  confirmationReason?: string
  uploadedBy?: unknown
  confirmedBy?: unknown
  confirmedAt?: Date | string | null
  createdAt: Date | string
}

export type SemiPolishPacketReturn = {
  _id?: string
  id?: string
  planningImport: string
  packetPlan: string
  packet: string
  packetNumber: number
  status: 'verified' | 'issue'
  source: 'manual' | 'barcode'
  plannedPieceCount: number
  verifiedPieceCount: number
  plannedPolishedCarat: number
  pieces: PlannedPiece[]
  issue?: {
    reported?: boolean
    type?: string
    details?: string
    observedPieceCount?: number | null
    resolved?: boolean
    resolutionNote?: string
    resolvedAt?: Date | string | null
    resolvedBy?: unknown
  }
  notes?: string
  receivedAt: Date | string
  receivedBy?: unknown
}

export type SemiPolishPlanningData = {
  planningImport: SemiPolishPlanningImport | null
  pendingPlanningImport?: SemiPolishPlanningImport | null
  packetPlans: SemiPolishPacketPlan[]
  packetReturns: SemiPolishPacketReturn[]
  progress: {
    expectedPackets: number
    receivedPackets: number
    verifiedPackets: number
    issuePackets: number
    pendingPackets: number
    verifiedPieces: number
    plannedPieces: number
    lastReceivedAt?: Date | string | null
    lastPacketNumber?: number | null
  }
}

export type EligibleLot = {
  _id: string;
  id?: string;
  kapanNo: string;
  totalCarat: number;
  totalPcs: number;
  entryDate: string | Date;
};
