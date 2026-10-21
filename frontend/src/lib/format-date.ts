import { format } from 'date-fns'

export const APP_DATE_FORMAT = 'dd/MM/yyyy'

export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return ''
  const parsedDate = date instanceof Date ? date : new Date(date)
  if (isNaN(parsedDate.getTime())) return ''
  return format(parsedDate, APP_DATE_FORMAT)
}
