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
  assortmentComplete: z.boolean(),
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
