/**
 * Admin /admin/branding — Master only.
 *
 * Configura a identidade visual do sistema:
 *   - systemName: nome exibido no header da sidebar e na tela de login
 *   - logoDataUrl: logo principal (sidebar header + email transactional)
 *   - faviconDataUrl: ícone do navegador (aplicado dinâmicamente)
 *
 * Persistência: usePatchAppState({ branding: { ... } }). Após salvar,
 * invalida a query de branding pra forçar reload em todos os contextos
 * que dependem dela (sidebar, login, e-mail).
 */

import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'

import { useAppState, usePatchAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useBranding } from '@/features/auth/hooks/use-branding'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { ImageUploadField } from '@/shared/ui/image-upload-field'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { AdminTabs } from './components/admin-tabs'

type BrandingDraft = {
  systemName: string
  logoDataUrl: string | null
  faviconDataUrl: string | null
}

export function AdminBrandingPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const appState = useAppState()
  const branding = useBranding()
  const patch = usePatchAppState()

  // Master only
  if (user && !user.isMaster) {
    return <Navigate to="/admin" replace />
  }

  const [draft, setDraft] = useState<BrandingDraft>({
    systemName: '',
    logoDataUrl: null,
    faviconDataUrl: null,
  })
  const [dirty, setDirty] = useState(false)

  /**
   * Quando o appState carrega, popula o draft. Reusamos o appState (não o
   * /api/auth/branding) pra ter acesso ao branding.faviconDataUrl que pode
   * não estar no endpoint público.
   */
  useEffect(() => {
    const b = (appState.data?.branding ?? {}) as Record<string, unknown>
    setDraft({
      systemName:
        typeof b.systemName === 'string' && b.systemName ? b.systemName : 'Planflow',
      logoDataUrl: typeof b.logoDataUrl === 'string' ? b.logoDataUrl : null,
      faviconDataUrl:
        typeof b.faviconDataUrl === 'string' ? b.faviconDataUrl : null,
    })
    setDirty(false)
  }, [appState.data?.branding])

  function patchDraft<K extends keyof BrandingDraft>(key: K, value: BrandingDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function handleSave() {
    try {
      const currentBranding =
        (appState.data?.branding ?? {}) as Record<string, unknown>
      await patch.mutateAsync({
        branding: {
          ...currentBranding,
          systemName: draft.systemName.trim() || 'Planflow',
          logoDataUrl: draft.logoDataUrl,
          faviconDataUrl: draft.faviconDataUrl,
        },
      })
      // Força reload do branding pra atualizar sidebar/login imediatamente.
      branding.refetch()
      toastSaved(t('admin.branding.saved'))
      setDirty(false)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('admin.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
      </div>

      <AdminTabs />

      {appState.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('admin.loadError')}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">{t('admin.branding.subtitle')}</p>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-1.5">
            <Label>{t('admin.branding.field.systemName')}*</Label>
            <Input
              value={draft.systemName}
              onChange={(e) => patchDraft('systemName', e.target.value)}
              placeholder="Planflow"
              maxLength={64}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              {t('admin.branding.field.systemNameHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('admin.branding.field.logo')}</Label>
            <ImageUploadField
              value={draft.logoDataUrl}
              onChange={(v) => patchDraft('logoDataUrl', v)}
              maxSizeKb={250}
              previewWidth={220}
              previewHeight={96}
            />
            <p className="text-[11px] text-muted-foreground">
              {t('admin.branding.field.logoHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('admin.branding.field.favicon')}</Label>
            <ImageUploadField
              value={draft.faviconDataUrl}
              onChange={(v) => patchDraft('faviconDataUrl', v)}
              maxSizeKb={50}
              previewSize={80}
              accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
            />
            <p className="text-[11px] text-muted-foreground">
              {t('admin.branding.field.faviconHint')}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            {dirty && (
              <span className="text-xs text-muted-foreground">
                {t('admin.branding.unsaved')}
              </span>
            )}
            <Button onClick={handleSave} disabled={!dirty || patch.isPending}>
              <Save className="h-4 w-4" />
              {patch.isPending ? t('app.loading') : t('admin.branding.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
