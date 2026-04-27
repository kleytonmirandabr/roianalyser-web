import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { MfaChallengeForm } from '@/features/auth/components/mfa-challenge-form'
import { PublicPageShell } from '@/features/auth/components/public-page-shell'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'

type LocationState = {
  mode?: 'challenge' | 'setup'
  mfaToken?: string
  mfaMethod?: string
  remember?: boolean
  from?: string
}

/**
 * Página de MFA. Recebe contexto via location.state vindo da página de login.
 * Sem state válido (acesso direto ou refresh), redireciona para /login.
 */
export function MfaPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const state = (location.state as LocationState | null) ?? null

  if (!state || !state.mfaToken) {
    return <Navigate to="/login" replace />
  }

  const isSetup = state.mode === 'setup'

  return (
    <PublicPageShell>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle>
            {isSetup ? t('auth.mfaSetup.title') : t('auth.twoFactor.title')}
          </CardTitle>
          {!isSetup && (
            <CardDescription>{t('app.name')}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isSetup ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                {t('auth.mfaSetup.message')}
              </p>
              <Link
                to="/login"
                className="block text-center text-primary underline-offset-4 hover:underline"
              >
                {t('auth.mfaSetup.backToLogin')}
              </Link>
            </div>
          ) : (
            <MfaChallengeForm
              mfaToken={state.mfaToken}
              mfaMethod={state.mfaMethod}
              remember={state.remember ?? false}
              from={state.from}
            />
          )}
        </CardContent>
      </Card>
    </PublicPageShell>
  )
}
