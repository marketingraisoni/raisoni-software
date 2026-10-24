import { z } from 'zod'

export const LOT_STATUS = {
  ACTIVE: 'active',
  CLOSED: 'closed',
} as const

export const lotStatusSchema = z.enum([
  LOT_STATUS.ACTIVE,
  LOT_STATUS.CLOSED,
])
export type LotStatus = z.infer<typeof lotStatusSchema>

export const ASSORTMENT_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const

export const assortmentStatusSchema = z.enum([
  ASSORTMENT_STATUS.PENDING,
  ASSORTMENT_STATUS.IN_PROGRESS,
  ASSORTMENT_STATUS.COMPLETED,
])
export type AssortmentStatus = z.infer<typeof assortmentStatusSchema>

export const FOUR_P_STATUS = {
  PENDING: 'pending',
  IN_PROCESS: 'in_process',
  COMPLETED: 'completed',
} as const

export const fourPStatusSchema = z.enum([
  FOUR_P_STATUS.PENDING,
  FOUR_P_STATUS.IN_PROCESS,
  FOUR_P_STATUS.COMPLETED,
])
export type FourPStatus = z.infer<typeof fourPStatusSchema>

export const lotSchema = z.object({
  id: z.string(),
  kapanNo: z.string(),
  totalCarat: z.number(),
  totalPcs: z.number().int(),
  entryDate: z.coerce.date(),
  status: lotStatusSchema,
  assortmentComplete: z.boolean(),
  assortmentStatus: assortmentStatusSchema,
  assortedPcs: z.number().int(),
  assortedCarat: z.number(),
  fourPStatus: fourPStatusSchema,
  fourPReady: z.boolean(),
  fourPProcessId: z.string().nullable(),
  fourPIssueNo: z.string(),
  fourPVendorName: z.string(),
  fourPExpectedPackets: z.number().int(),
  fourPReturnedPackets: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Lot = z.infer<typeof lotSchema>

export const assortmentPacketSchema = z.object({
  id: z.string(),
  srNo: z.number().int(),
  name: z.string(),
  carat: z.number(),
})

export type AssortmentPacket = z.infer<typeof assortmentPacketSchema>

export type AssortmentSummary = {
  totalPackets: number
  totalCarat: number
  remainingPackets: number
  remainingCarat: number
  complete: boolean
}
