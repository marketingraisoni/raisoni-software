import { createFileRoute } from '@tanstack/react-router'
import { PasswordSettingsPage } from '@/features/settings/password'

export const Route = createFileRoute('/_authenticated/settings/password')({
  component: PasswordSettingsPage,
})
