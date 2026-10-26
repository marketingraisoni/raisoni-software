import { type ApiResponse } from '@/types/api'
import { apiClient } from '@/lib/api-client'

type SupportContacts = {
  administratorName: string
  administratorEmail: string
  administratorPhone: string
  softwareDepartmentName: string
  softwareDepartmentEmail: string
  softwareDepartmentPhone: string
}

export const supportContactsQueryKey = ['settings', 'support-contacts'] as const

export async function getSupportContacts() {
  const { data: response } =
    await apiClient.get<ApiResponse<{ contacts: SupportContacts }>>(
      '/settings/support'
    )
  return response.data.contacts
}
