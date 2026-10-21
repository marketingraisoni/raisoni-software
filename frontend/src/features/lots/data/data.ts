import { type LotStatus } from './schema'

export const lotStatusStyles = new Map<LotStatus, string>([
  ['active', 'border-teal-200 bg-teal-100/30 text-teal-900 dark:text-teal-200'],
  ['closed', 'border-neutral-300 bg-neutral-300/40'],
])

export const lotStatuses = [
  { label: 'Active', value: 'active' },
  { label: 'Closed', value: 'closed' },
] as const
