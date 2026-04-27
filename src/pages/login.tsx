import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { LoginForm } from '@/features/auth/components/login-form'
import { PublicPageShell } from '@/features/auth/components/public-page-shell'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useBranding } from '@/features/auth/hooks/use-branding'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'

export function LoginPage() {
  const { t } = useTranslation()
  const branding = useBranding()
  const { status } = useAuth()
  const navigate = useNavigate()

  // Se já está autenticado, redireciona para o dashboard.
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/dashboard', { replace: true })
    }
  }, [status, navigate])

  return (
    <PublicPageShell>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          {branding.data?.logoDataUrl ? (
            <img
              src={branding.data.logoDataUrl}
              alt={branding.data.systemName}
              className="mb-2 h-12 w-auto"
            />
          ) : null}
          <CardTitle>{t('auth.login.title')}</CardTitle>
          <CardDescription>
            {branding.data?.systemName ?? t('app.name')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </PublicPageShell>
  )
}
