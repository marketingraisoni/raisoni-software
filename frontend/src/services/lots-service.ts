import axios from 'axios'
import { type ApiResponse } from '@/types/api'
import { apiClient } from '@/lib/api-client'
import {
  ASSORTMENT_STATUS,
  FOUR_P_STATUS,
  type AssortmentPacket,
  type AssortmentSummary,
  type Lot,
  type LotStatus,
} from '@/features/lots/data/schema'

export const lotsQueryKey = ['lots'] as const
export const lotQueryKey = (lotId: string) => ['lots', lotId] as const
export const lotPacketsQueryKey = (lotId: string) =>
  ['lots', lotId, 'packets'] as const

// Packet entry is performed repeatedly over a LAN. Keep the normal 15-second
// API timeout for reads, but allow writes to wait through a short server queue.
const ASSORTMENT_WRITE_TIMEOUT_MS = 60_000

type CreateLotInput = {
  kapanNo: string
  totalCarat: number
  totalPcs: number
  entryDate: string
}

type LotsQuery = {
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

type PacketData = {
  packet: unknown
  summary: AssortmentSummary
}

function parseLot(value: unknown): Lot {
  const record = value as Record<string, unknown>
  const assortedPcs = Number(record.assortedPcs || 0)
  const assortedCarat = Number(record.assortedCarat || 0)
  const assortmentComplete = record.assortmentComplete === true
  const assortmentStatus = assortmentComplete
    ? ASSORTMENT_STATUS.COMPLETED
    : record.assortmentStatus === ASSORTMENT_STATUS.IN_PROGRESS ||
        assortedPcs > 0 ||
        assortedCarat > 0
      ? ASSORTMENT_STATUS.IN_PROGRESS
      : ASSORTMENT_STATUS.PENDING

  return {
    id: String(record.id || record._id || ''),
    kapanNo: String(record.kapanNo || ''),
    totalCarat: Number(record.totalCarat || 0),
    totalPcs: Number(record.totalPcs || 0),
    entryDate: new Date(String(record.entryDate)),
    status: record.status === 'closed' ? 'closed' : 'active',
    assortmentComplete,
    assortmentStatus,
    assortedPcs,
    assortedCarat,
    fourPStatus:
      record.fourPStatus === FOUR_P_STATUS.IN_PROCESS
        ? FOUR_P_STATUS.IN_PROCESS
        : record.fourPStatus === FOUR_P_STATUS.COMPLETED
          ? FOUR_P_STATUS.COMPLETED
          : FOUR_P_STATUS.PENDING,
    fourPReady: record.fourPReady === true,
    fourPProcessId: record.fourPProcessId
      ? String(record.fourPProcessId)
      : null,
    fourPIssueNo: String(record.fourPIssueNo || ''),
    fourPVendorName: String(record.fourPVendorName || ''),
    fourPExpectedPackets: Number(record.fourPExpectedPackets || 0),
    fourPReturnedPackets: Number(record.fourPReturnedPackets || 0),
    createdAt: new Date(String(record.createdAt)),
    updatedAt: new Date(String(record.updatedAt)),
  }
}

function parsePacket(value: unknown): AssortmentPacket {
  const record = value as Record<string, unknown>
  return {
    id: String(record.id || record._id || ''),
    srNo: Number(record.srNo || 0),
    name: String(record.name || ''),
    carat: Number(record.carat || 0),
  }
}

export async function getLots(query: LotsQuery, signal?: AbortSignal) {
  const { data: response } = await apiClient.get<ApiResponse<LotsData>>(
    '/lots',
    {
      signal,
      params: {
        page: query.page,
        limit: query.pageSize,
        search: query.search || undefined,
        status: query.status?.length === 1 ? query.status[0] : undefined,
      },
    }
  )

  return {
    lots: response.data.lots.map(parseLot),
    pagination: response.data.pagination,
  }
}

export async function getLot(id: string, signal?: AbortSignal) {
  const { data: response } = await apiClient.get<ApiResponse<LotData>>(
    `/lots/${id}`,
    { signal }
  )
  return parseLot(response.data.lot)
}

export async function createLot(input: CreateLotInput) {
  const { data: response } = await apiClient.post<ApiResponse<LotData>>(
    '/lots',
    input
  )
  return { ...response, data: { lot: parseLot(response.data.lot) } }
}

export async function updateLotStatus(id: string, status: LotStatus) {
  const { data: response } = await apiClient.put<ApiResponse<LotData>>(
    `/lots/${id}`,
    { status }
  )
  return { ...response, data: { lot: parseLot(response.data.lot) } }
}

export async function deleteLot(id: string) {
  const { data } = await apiClient.delete<ApiResponse<{ id: string }>>(
    `/lots/${id}`
  )
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
  input: { carat: number; requestId: string }
) {
  const { data: response } = await apiClient.post<ApiResponse<PacketData>>(
    `/lots/${lotId}/packets`,
    input,
    { timeout: ASSORTMENT_WRITE_TIMEOUT_MS }
  )
  return {
    ...response,
    data: {
      packet: parsePacket(response.data.packet),
      summary: response.data.summary,
    },
  }
}

export async function updateLotPacket(
  lotId: string,
  packetId: string,
  input: { carat: number }
) {
  const { data: response } = await apiClient.put<ApiResponse<PacketData>>(
    `/lots/${lotId}/packets/${packetId}`,
    input,
    { timeout: ASSORTMENT_WRITE_TIMEOUT_MS }
  )
  return {
    ...response,
    data: {
      packet: parsePacket(response.data.packet),
      summary: response.data.summary,
    },
  }
}

export async function downloadLotAssortmentExcel(
  lotId: string,
  kapanNo: string
) {
  try {
    const response = await apiClient.get<Blob>(
      `/lots/${lotId}/packets/export`,
      {
        responseType: 'blob',
      }
    )
    const disposition = String(response.headers['content-disposition'] || '')
    const matchedFileName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    const fallbackFileName = `${kapanNo.replace(/[^a-z0-9_-]/gi, '-')}-packet-assortment.xlsx`
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')

    link.href = url
    link.download = matchedFileName || fallbackFileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      let message = ''
      try {
        const payload = JSON.parse(await error.response.data.text()) as {
          message?: string
        }
        message = payload.message || ''
      } catch {
        // The server did not return a JSON error payload.
      }
      const downloadError = new Error(
        message || 'Unable to download the Excel file.'
      )
      ;(downloadError as Error & { cause?: unknown }).cause = error
      throw downloadError
    }
    throw error
  }
}
