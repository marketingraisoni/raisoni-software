import { apiClient } from '@/lib/api-client'
import {
  type AssortmentPacket,
  type AssortmentSummary,
  type Lot,
  type LotStatus,
} from '@/features/lots/data/schema'
import { type ApiResponse } from '@/types/api'

export const lotsQueryKey = ['lots'] as const
export const lotQueryKey = (lotId: string) => ['lots', lotId] as const
export const lotPacketsQueryKey = (lotId: string) => ['lots', lotId, 'packets'] as const

export type CreateLotInput = {
  kapanNo: string
  totalCarat: number
  totalPcs: number
  entryDate: string
}

export type LotsQuery = {
  page: number
  pageSize: number
  search?: string
  status?: LotStatus[]
}

type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

type LotsData = {
  lots: unknown[]
  pagination: PaginationMeta
}

type LotData = { lot: unknown }

type PacketsData = {
  packets: unknown[]
  summary: AssortmentSummary
}

type PacketData = { packet: unknown }
type GradeData = { grade: unknown }

function parseLot(value: unknown): Lot {
  const record = value as Record<string, unknown>
  return {
    id: String(record.id || record._id || ''),
    kapanNo: String(record.kapanNo || ''),
    totalCarat: Number(record.totalCarat || 0),
    totalPcs: Number(record.totalPcs || 0),
    entryDate: new Date(String(record.entryDate)),
    status: record.status === 'closed' ? 'closed' : 'active',
    createdAt: new Date(String(record.createdAt)),
    updatedAt: new Date(String(record.updatedAt)),
  }
}

function parsePacket(value: unknown): AssortmentPacket {
  const record = value as Record<string, unknown>
  return {
    id: String(record.id || record._id || ''),
    lot: String(record.lot || ''),
    srNo: Number(record.srNo || 0),
    grade: String(record.grade || ''),
    carat: Number(record.carat || 0),
    createdAt: new Date(String(record.createdAt)),
  }
}

export async function getLots(query: LotsQuery, signal?: AbortSignal) {
  const { data: response } = await apiClient.get<ApiResponse<LotsData>>('/lots', {
    signal,
    params: {
      page: query.page,
      limit: query.pageSize,
      search: query.search || undefined,
      status: query.status?.length === 1 ? query.status[0] : undefined,
    },
  })

  return {
    lots: response.data.lots.map(parseLot),
    pagination: response.data.pagination,
  }
}

export async function getLot(id: string, signal?: AbortSignal) {
  const { data: response } = await apiClient.get<ApiResponse<LotData>>(`/lots/${id}`, { signal })
  return parseLot(response.data.lot)
}

export async function createLot(input: CreateLotInput) {
  const { data: response } = await apiClient.post<ApiResponse<LotData>>('/lots', input)
  return { ...response, data: { lot: parseLot(response.data.lot) } }
}

export async function updateLotStatus(id: string, status: LotStatus) {
  const { data: response } = await apiClient.put<ApiResponse<LotData>>(`/lots/${id}`, { status })
  return { ...response, data: { lot: parseLot(response.data.lot) } }
}

export async function deleteLot(id: string) {
  const { data } = await apiClient.delete<ApiResponse<{ id: string }>>(`/lots/${id}`)
  return data
}

export async function getLotPackets(lotId: string, signal?: AbortSignal) {
  const { data: response } = await apiClient.get<ApiResponse<PacketsData>>(
    `/lots/${lotId}/packets`,
    { signal }
  )

  return {
    packets: response.data.packets.map(parsePacket),
    summary: response.data.summary,
  }
}

export async function createLotPacket(
  lotId: string,
  input: { grade: string; carat: number }
) {
  const { data: response } = await apiClient.post<ApiResponse<PacketData>>(
    `/lots/${lotId}/packets`,
    input
  )
  return { ...response, data: { packet: parsePacket(response.data.packet) } }
}

export async function updateLotPacket(
  lotId: string,
  packetId: string,
  input: { carat: number }
) {
  const { data: response } = await apiClient.put<ApiResponse<PacketData>>(
    `/lots/${lotId}/packets/${packetId}`,
    input
  )
  return { ...response, data: { packet: parsePacket(response.data.packet) } }
}

export async function createLotGrade(
  lotId: string,
  input: { grade: string; targetPcs: number }
) {
  const { data: response } = await apiClient.post<ApiResponse<GradeData>>(
    `/lots/${lotId}/grades`,
    input
  )
  return response
}

export async function updateLotGrade(
  lotId: string,
  gradeId: string,
  input: { targetPcs: number }
) {
  const { data: response } = await apiClient.put<ApiResponse<GradeData>>(
    `/lots/${lotId}/grades/${gradeId}`,
    input
  )
  return response
}

export async function deleteLotGrade(lotId: string, gradeId: string) {
  const { data } = await apiClient.delete<ApiResponse<{
    id: string
    grade: string
    deletedPackets: number
  }>>(`/lots/${lotId}/grades/${gradeId}`)
  return data
}
