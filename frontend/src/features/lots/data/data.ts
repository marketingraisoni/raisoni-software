import { LOT_STATUS, type LotStatus } from './schema'

export const LOT_TABLE_COLUMN = {
  KAPAN_NO: 'kapanNo',
  STATUS: 'status',
} as const

export const lotStatusStyles = new Map<LotStatus, string>([
  [
    LOT_STATUS.ACTIVE,
    'border-teal-200 bg-teal-100/30 text-teal-900 dark:text-teal-200',
  ],
  [LOT_STATUS.CLOSED, 'border-neutral-300 bg-neutral-300/40'],
])

export const lotStatuses = [
  { label: 'Active', value: LOT_STATUS.ACTIVE },
  { label: 'Closed', value: LOT_STATUS.CLOSED },
] as const
