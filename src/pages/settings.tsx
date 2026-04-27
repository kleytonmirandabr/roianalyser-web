import { ShieldCheck, ShieldOff, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { authApi } from '@/features/auth/api'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useForgotPassword } from '@/features/auth/hooks/use-forgot-password'
import { useUpdateProfile } from '@/features/auth/hooks/use-update-profile'
import { useMutation } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/client'
import { toast, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { confirm } from '@/shared/ui/confirm-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Separator } from '@/shared/ui/separator'

type ProfileForm = {
  name: string
  email: string
  phone: string
  role: string
  defaultLanguage: string
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const updateProfile = useUpdateProfile()
  const forgot = useForgotPassword()

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: '',
    email: '',
    phone: '',
    role: '',
    defaultLanguage: 'pt',
  })
  const [profileDirty, setProfileDirty] = useState(false)

  useEffect(() => {
    if (!user) return
    setProfileForm({
      name: typeof user.name === 'string' ? user.name : '',
      email: typeof user.email === 'string' ? user.email : '',
      phone: typeof user.phone === 'string' ? user.phone : '',
      role: typeof user.role === 'string' ? user.role : '',
      defaultLanguage:
        typeof user.defaultLanguage === 'string' ? user.defaultLanguage : 'pt',
    })
    setProfileDirty(false)
  }, [user])

  function patch<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfileForm((prev) => ({ ...prev, [key]: value }))
    setProfileDirty(true)
  }

  async function handleSaveProfile() {
    await updateProfile.mutateAsync({
      name: profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone || null,
      role: profileForm.role || null,
      defaultLanguage: profileForm.defaultLanguage,
    })
    setProfileDirty(false)
  }

  async function handleSendResetLink() {
    if (!user?.email) {
      toast.error('Sem e-mail cadastrado.')
      return
    }
    const ok = await confirm({
      title: 'Enviar link de redefinição?',
      description: `Você receberá um link de redefinição de senha em ${user.email}.`,
      confirmLabel: 'Enviar',
    })
    if (!ok) return
    try {
      await forgot.mutateAsync(user.email)
      toastSaved(t('settings.password.sent'))
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('settings.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.profile.title')}</CardTitle>
          <CardDescription>{t('settings.profile.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {updateProfile.isSuccess && !profileDirty && (
            <Alert>
              <AlertDescription>{t('settings.profile.saved')}</AlertDescription>
            </Alert>
          )}
          {updateProfile.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                Não foi possível atualizar. Tente novamente.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prof-name">{t('settings.profile.name')}</Label>
              <Input
                id="prof-name"
                value={profileForm.name}
                onChange={(e) => patch('name', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-email">{t('settings.profile.email')}</Label>
              <Input
                id="prof-email"
                type="email"
                value={profileForm.email}
                onChange={(e) => patch('email', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-phone">{t('settings.profile.phone')}</Label>
              <Input
                id="prof-phone"
                value={profileForm.phone}
                onChange={(e) => patch('phone', e.target.value)}
                placeholder="(11) 99999-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-role">{t('settings.profile.role')}</Label>
              <Input
                id="prof-role"
                value={profileForm.role}
                onChange={(e) => patch('role', e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="prof-lang">{t('settings.profile.language')}</Label>
              <select
                id="prof-lang"
                value={profileForm.defaultLanguage}
                onChange={(e) => patch('defaultLanguage', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="pt">Português</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            {profileDirty && (
              <span className="text-xs text-muted-foreground">
                {t('settings.profile.unsaved')}
              </span>
            )}
            <Button
              onClick={handleSaveProfile}
              disabled={!profileDirty || updateProfile.isPending}
            >
              {updateProfile.isPending
                ? t('settings.profile.saving')
                : t('settings.profile.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.password.title')}</CardTitle>
          <CardDescription>{t('settings.password.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {forgot.isSuccess && (
            <Alert>
              <AlertDescription>
                {t('settings.password.sent')}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSendResetLink}
              disabled={forgot.isPending || !user?.email}
            >
              <Mail className="h-4 w-4" />
              <span>
                {forgot.isPending
                  ? t('settings.password.sending')
                  : t('settings.password.send')}
              </span>
            </Button>
            {user?.email && (
              <span className="text-xs text-muted-foreground">
                {t('settings.password.for')} <strong>{user.email}</strong>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <MfaSection />
    </div>
  )
}

/**
 * Setup / disable de 2FA. Estados:
 *   - idle: mostra status atual + botão (Configurar ou Desabilitar)
 *   - setup: mostra QR code + input para confirmar TOTP
 *   - disable: input para confirmar TOTP atual + botão Desabilitar
 *   - success: mostra recovery codes (uma vez só, ao concluir setup)
 */
function MfaSection() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const enabled = user?.mfaEnabled === true

  const [mode, setMode] = useState<'idle' | 'setup' | 'disable' | 'success'>(
    'idle',
  )
  const [qrUri, setQrUri] = useState<string | null>(null)
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const setup = useMutation({
    mutationFn: () => authApi.mfaSetup(),
    onSuccess: (data) => {
      setQrUri(data.qrCodeDataUrl)
      setOtpauthUri(data.otpauthUri)
      setMode('setup')
      setError(null)
    },
    onError: () => setError(t('settings.mfa.errSetup')),
  })

  const verify = useMutation({
    mutationFn: (totp: string) => authApi.mfaVerify(totp),
    onSuccess: (data) => {
      if ('recoveryCodes' in data) {
        setRecoveryCodes(data.recoveryCodes)
      }
      setMode('success')
      setCode('')
      setError(null)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        setError(t('settings.mfa.errInvalid'))
      } else {
        setError(t('settings.mfa.errVerify'))
      }
    },
  })

  const disable = useMutation({
    mutationFn: (totp: string) => authApi.mfaDisable(totp),
    onSuccess: () => {
      setMode('idle')
      setCode('')
      setError(null)
      toastSaved(t('settings.mfa.disabled2faAlert'))
    },
    onError: () => setError(t('settings.mfa.errDisable')),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          {t('settings.mfa.title')}
        </CardTitle>
        <CardDescription>
          {enabled ? t('settings.mfa.enabled') : t('settings.mfa.disabled')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {mode === 'idle' && !enabled && (
          <Button onClick={() => setup.mutate()} disabled={setup.isPending}>
            {setup.isPending ? t('settings.mfa.generating') : t('settings.mfa.setup')}
          </Button>
        )}

        {mode === 'idle' && enabled && (
          <Button variant="destructive" onClick={() => setMode('disable')}>
            {t('settings.mfa.disable')}
          </Button>
        )}

        {mode === 'setup' && qrUri && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <p className="mb-2 text-sm">
                {t('settings.mfa.step1')}
              </p>
              <img
                src={qrUri}
                alt="QR code para 2FA"
                className="mx-auto h-48 w-48"
              />
              {otpauthUri && (
                <p className="mt-2 break-all text-center text-[11px] text-muted-foreground">
                  {t('settings.mfa.scanFallback')} <code>{otpauthUri}</code>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totp-confirm">{t('settings.mfa.step2')}</Label>
              <Input
                id="totp-confirm"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => verify.mutate(code)}
                disabled={verify.isPending || code.length < 6}
              >
                {verify.isPending ? t('settings.mfa.verifying') : t('settings.mfa.confirm')}
              </Button>
              <Button variant="outline" onClick={() => setMode('idle')}>
                {t('settings.mfa.cancel')}
              </Button>
            </div>
          </div>
        )}

        {mode === 'disable' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('settings.mfa.disablePrompt')}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="totp-disable">{t('settings.mfa.code')}</Label>
              <Input
                id="totp-disable"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => disable.mutate(code)}
                disabled={disable.isPending || code.length < 6}
              >
                {disable.isPending ? t('settings.mfa.disabling') : t('settings.mfa.disable')}
              </Button>
              <Button variant="outline" onClick={() => setMode('idle')}>
                {t('settings.mfa.cancel')}
              </Button>
            </div>
          </div>
        )}

        {mode === 'success' && (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                <strong>{t('settings.mfa.successTitle')}</strong>{' '}
                {t('settings.mfa.successMsg')}
              </AlertDescription>
            </Alert>
            {recoveryCodes.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <h3 className="mb-2 text-sm font-medium">
                  {t('settings.mfa.recoveryCodes')}
                </h3>
                <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {recoveryCodes.map((rc) => (
                    <li key={rc} className="rounded bg-background px-2 py-1">
                      {rc}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={() => setMode('idle')}>
              {t('settings.mfa.ack')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
