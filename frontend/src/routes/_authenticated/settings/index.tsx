import { createFileRoute } from '@tanstack/react-router'
import { ProfileSettingsPage } from '@/features/settings/profile'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: ProfileSettingsPage,
})
