import { createFileRoute } from '@tanstack/react-router'
import { LoginBrandingSettingsPage } from '@/features/settings/login-branding'

export const Route = createFileRoute('/_authenticated/settings/branding')({
  component: LoginBrandingSettingsPage,
})
