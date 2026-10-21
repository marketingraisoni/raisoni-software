import { z } from 'zod'

export const lotStatusSchema = z.enum(['active', 'closed'])
export type LotStatus = z.infer<typeof lotStatusSchema>

export const lotSchema = z.object({
  id: z.string(),
  kapanNo: z.string(),
  totalCarat: z.number(),
  totalPcs: z.number().int(),
  entryDate: z.coerce.date(),
  status: lotStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Lot = z.infer<typeof lotSchema>

export const assortmentPacketSchema = z.object({
  id: z.string(),
  lot: z.string(),
  srNo: z.number().int(),
  grade: z.string(),
  carat: z.number(),
  createdAt: z.coerce.date(),
})

export type AssortmentPacket = z.infer<typeof assortmentPacketSchema>

export type AssortmentSummary = {
  gradeCounts: Array<{ grade: string; count: number }>
  grades: Array<{
    id: string
    grade: string
    targetPcs: number
    createdPackets: number
    remainingPackets: number
    complete: boolean
  }>
  plannedPackets: number
  unplannedPackets: number
  totalPackets: number
  totalCarat: number
  targetPackets: number
  targetCarat: number
  remainingPackets: number
  remainingCarat: number
  complete: boolean
}
