import axios from 'axios'
import { apiClient } from '@/lib/api-client'
import {
  type SemiPolishProcess,
  type Vendor,
  type EligibleLot,
  type PlanningDifference,
  type SemiPolishPlanningData,
  type SemiPolishPlanningImport,
  type SemiPolishPacketLookup,
} from '@/features/semi-polish/data/schema'

export const semiPolishQueryKeys = {
  all: ['semi-polish'] as const,
  list: (params: {
    page?: number
    limit?: number
    status?: SemiPolishProcess['status']
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }) => ['semi-polish', 'list', params] as const,
  eligibleLots: (params?: { sortBy?: string; sortOrder?: 'asc' | 'desc' }) =>
    ['semi-polish', 'eligible-lots', params] as const,
  vendors: ['semi-polish', 'vendors'] as const,
  detail: (id: string) => ['semi-polish', 'detail', id] as const,
  planning: (id: string) => ['semi-polish', 'planning', id] as const,
  packetLookup: (code: string) =>
    ['semi-polish', 'packet-lookup', code] as const,
}

export type SemiPolishListResponse = {
  processes: SemiPolishProcess[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  metrics: {
    activeCount: number
    completedCount: number
    totalLossCarat: number
  }
}

export async function fetchSemiPolishList(params: {
  page?: number
  limit?: number
  status?: SemiPolishProcess['status']
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}): Promise<SemiPolishListResponse> {
  const response = await apiClient.get('/semi-polish', { params })
  return response.data.data
}

export async function fetchEligibleLots(params?: {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}): Promise<EligibleLot[]> {
  const response = await apiClient.get('/semi-polish/eligible-lots', { params })
  return response.data.data.lots
}

export async function fetchVendors(): Promise<Vendor[]> {
  const response = await apiClient.get('/semi-polish/vendors')
  return response.data.data.vendors
}

export async function createVendor(data: {
  name: string
  mobile?: string
  address?: string
  gstin?: string
}): Promise<Vendor> {
  const response = await apiClient.post('/semi-polish/vendors', data)
  return response.data.data.vendor
}

export async function issueToSemiPolish(data: {
  lotId: string
  vendorId: string
  issueDate?: string
  expectedReturnDate?: string
  notes?: string
}): Promise<SemiPolishProcess> {
  const response = await apiClient.post('/semi-polish/issue', data)
  return response.data.data.process
}

export async function receiveFromSemiPolish(
  id: string,
  data: {
    returnedPieces: number
    returnedCarat: number
    returnDate?: string
    returnNotes?: string
  }
): Promise<SemiPolishProcess> {
  const response = await apiClient.post(`/semi-polish/${id}/return`, data)
  return response.data.data.process
}

export async function cancelSemiPolish(id: string): Promise<void> {
  await apiClient.post(`/semi-polish/${id}/cancel`)
}

export async function fetchSemiPolishById(
  id: string
): Promise<SemiPolishProcess> {
  const response = await apiClient.get(`/semi-polish/${id}`)
  return response.data.data.process
}

export async function downloadSemiPolishExcel(
  id: string,
  issueNo: string
): Promise<void> {
  try {
    const response = await apiClient.get<Blob>(`/semi-polish/${id}/export`, {
      responseType: 'blob',
    })
    const disposition = String(response.headers['content-disposition'] || '')
    const matchedFileName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    const fallbackFileName = `${issueNo.replace(/[^a-z0-9_-]/gi, '-')}-process-record.xlsx`
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
        message || 'Unable to download the process Excel file.'
      )
      ;(downloadError as Error & { cause?: unknown }).cause = error
      throw downloadError
    }
    throw error
  }
}

export async function fetchSemiPolishPlanning(
  id: string
): Promise<SemiPolishPlanningData> {
  const response = await apiClient.get(`/semi-polish/${id}/planning`)
  return response.data.data
}

export async function lookupSemiPolishPacket(
  packetNumberOrPayload: string | number | { packetNumber: string | number }
): Promise<SemiPolishPacketLookup> {
  const packetNumber =
    typeof packetNumberOrPayload === 'object' && packetNumberOrPayload !== null
      ? packetNumberOrPayload.packetNumber
      : packetNumberOrPayload
  const response = await apiClient.post('/semi-polish/packet-lookup', {
    packetNumber,
  })
  return response.data.data
}

export async function importSemiPolishPlanning(
  id: string,
  file: File
): Promise<{
  planningImport: SemiPolishPlanningImport
  differences: PlanningDifference[]
  requiresConfirmation: boolean
}> {
  const response = await apiClient.post(
    `/semi-polish/${id}/planning/import`,
    file,
    {
      params: { fileName: file.name },
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    }
  )
  return response.data.data
}

export async function confirmSemiPolishPlanning(
  processId: string,
  importId: string,
  reason: string
): Promise<SemiPolishPlanningImport> {
  const response = await apiClient.post(
    `/semi-polish/${processId}/planning/${importId}/confirm`,
    { reason }
  )
  return response.data.data.planningImport
}

export async function downloadPlanningWorkbook(
  id: string,
  fileName: string
): Promise<void> {
  const response = await apiClient.get<Blob>(
    `/semi-polish/${id}/planning/file`,
    {
      responseType: 'blob',
    }
  )
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function receiveSemiPolishPacket(
  processId: string,
  packetNumber: number,
  data: {
    hasDifference?: boolean
    issueType?: string
    issueDetails?: string
    receivedPieces: Array<{
      pieceNumber: number
      hphtCarat?: number
      fourPCarat?: number
      shape?: string
      barcode?: string
    }>
    notes?: string
    source?: 'manual' | 'barcode'
  }
) {
  const response = await apiClient.post(
    `/semi-polish/${processId}/packets/${packetNumber}/receive`,
    data
  )
  return response.data.data
}

export async function resolveSemiPolishPacketIssue(
  processId: string,
  packetNumber: number,
  data: { resolutionNote: string; verifiedPieceCount: number }
) {
  const response = await apiClient.post(
    `/semi-polish/${processId}/packets/${packetNumber}/resolve`,
    data
  )
  return response.data.data
}

export async function finalizeSemiPolishReturn(
  processId: string,
  returnNotes = ''
): Promise<SemiPolishProcess> {
  const response = await apiClient.post(
    `/semi-polish/${processId}/finalize-return`,
    {
      returnNotes,
    }
  )
  return response.data.data.process
}
