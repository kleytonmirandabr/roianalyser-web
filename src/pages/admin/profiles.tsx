import { Pencil, Plus, Trash2, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppState, usePatchAppState } from '@/features/admin/hooks/use-app-state'
import type { GlobalProfile } from '@/features/admin/types'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { stripDraftIds } from '@/shared/lib/strip-draft-id'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import {
  DataTableActiveFilters,
  DataTableHeaderCell,
  DataTablePagination,
  useDataTable,
  type DataTableColumn,
} from '@/shared/ui/data-table'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

import { AdminTabs } from './components/admin-tabs'

export function AdminProfilesPage() {
  const { t } = useTranslation()
  const appState = useAppState()
  const patch = usePatchAppState()
  const { user: currentUser } = useAuth()
  const isMasterUser = currentUser?.isMaster === true
  const [editing, setEditing] = useState<GlobalProfile | null>(null)

  const allProfiles = appState.data?.profiles ?? []
  const functionalities = appState.data?.functionalities ?? []
  const clients = appState.data?.clients ?? []

  // Tenant isolation: admin não-master vê só perfis globais (clientId
  // vazio = compartilhado entre todos tenants) + perfis do tenant ativo.
  // Master vê tudo cross-tenant.
  //
  // Defesa em profundidade: mesmo que o backend filtre por X-Active-Tenant,
  // refiltrar aqui evita vazamento se o cache do React Query ainda tiver
  // dados do tenant anterior durante uma troca rápida no switcher.
  const activeTenantId =
    currentUser?.activeClientId ?? currentUser?.clientId ?? ''
  const profiles = isMasterUser
    ? allProfiles
    : allProfiles.filter((p) => !p.clientId || p.clientId === activeTenantId)

  // DataTable Excel-style — sort + filtro multi-select por coluna.
  const profileColumns = useMemo<DataTableColumn<GlobalProfile>[]>(
    () => [
      { key: 'name', label: t('admin.profiles.th.name') },
      {
        key: 'clientId',
        label: t('admin.profiles.th.client'),
        getValue: (p) => p.clientId ?? '',
        formatValue: (v) =>
          typeof v === 'string' && v
            ? clients.find((c) => c.id === v)?.name ?? v
            : t('admin.profiles.global'),
      },
      {
        key: 'functionalitiesCount',
        label: t('admin.profiles.th.functionalities'),
        getValue: (p) => p.functionalityIds?.length ?? 0,
        // Filtro por count exato não é útil — desabilita.
        filterable: false,
      },
    ],
    [t, clients],
  )
  const dt = useDataTable(profiles, profileColumns)

  async function save(p: GlobalProfile) {
    const exists = profiles.some((x) => x.id === p.id)
    const next = exists ? profiles.map((x) => (x.id === p.id ? p : x)) : [...profiles, p]
    setEditing(null)
    try {
      await patch.mutateAsync({ profiles: stripDraftIds(next) })
      toastSaved(t('admin.profiles.saved'))
    } catch (err) {
      toastError(err)
    }
  }

  async function remove(p: GlobalProfile) {
    const ok = await confirm({
      title: t('admin.profiles.deleteTitle'),
      description: t('admin.profiles.deleteDesc', { name: p.name }),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      await patch.mutateAsync({ profiles: stripDraftIds(profiles.filter((x) => x.id !== p.id)) })
      toastDeleted()
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="w-full space-y-4">
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

      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t('admin.profiles.subtitle', { count: profiles.length })}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const ok = await confirm({
                title: t('admin.profiles.applyDefaultsTitle'),
                description: t('admin.profiles.applyDefaultsDesc'),
                confirmLabel: t('admin.profiles.applyDefaultsConfirm'),
              })
              if (!ok) return
              const existing = new Set(profiles.map((p) => p.name.toLowerCase()))
              const defaults = [
                {
                  id: `prof_admin_${Date.now()}`,
                  name: 'Admin',
                  functionalityIds: functionalities.map((f) => f.id),
                },
                {
                  id: `prof_comercial_${Date.now() + 1}`,
                  name: 'Comercial',
                  functionalityIds: functionalities
                    .filter((f) => /negotiation|contracts|commercial/i.test(f.name + (f.category ?? '')))
                    .map((f) => f.id),
                },
                {
                  id: `prof_delivery_${Date.now() + 2}`,
                  name: 'Delivery',
                  functionalityIds: functionalities
                    .filter((f) => /delivery|execution|schedule|task/i.test(f.name + (f.category ?? '')))
                    .map((f) => f.id),
                },
                {
                  id: `prof_financeiro_${Date.now() + 3}`,
                  name: 'Financeiro',
                  functionalityIds: functionalities
                    .filter((f) => /billing|invoic|financ|forecast/i.test(f.name + (f.category ?? '')))
                    .map((f) => f.id),
                },
              ].filter((p) => !existing.has(p.name.toLowerCase()))
              if (defaults.length === 0) {
                toastSaved(t('admin.profiles.applyDefaultsAlready'))
                return
              }
              try {
                await patch.mutateAsync({ profiles: stripDraftIds([...profiles, ...defaults]) })
                toastSaved(
                  t('admin.profiles.applyDefaultsDone', { count: defaults.length }),
                )
              } catch (err) {
                toastError(err)
              }
            }}
            disabled={patch.isPending}
          >
            <Wand2 className="h-4 w-4" />
            <span>{t('admin.profiles.applyDefaults')}</span>
          </Button>
          <Button onClick={() => setEditing({ id: `prof_${Date.now()}`, name: '', functionalityIds: [] })}>
            <Plus className="h-4 w-4" />
            <span>{t('admin.profiles.new')}</span>
          </Button>
        </div>
      </div>

      <DataTableActiveFilters
        state={dt as never}
        columns={profileColumns as never}
      />

      <Card className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              {profileColumns.map((col) => (
                <DataTableHeaderCell
                  key={col.key}
                  column={col}
                  state={dt}
                  className={col.key === 'functionalitiesCount' ? 'w-32' : undefined}
                />
              ))}
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {dt.paginatedRows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.clientId
                    ? clients.find((c) => c.id === p.clientId)?.name ?? p.clientId
                    : t('admin.profiles.global')}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {p.functionalityIds?.length ?? 0}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <IconTooltip label={t('catalogs.detail.edit')}>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                    <IconTooltip label={t('catalogs.detail.delete')}>
                      <Button variant="ghost" size="icon" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <DataTablePagination state={dt} />

      <Sheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <SheetContent className="sm:max-w-xl md:max-w-2xl">
          {editing && (
            <ProfileForm
              profile={editing}
              functionalities={functionalities}
              clients={clients}
              onCancel={() => setEditing(null)}
              onSave={save}
              saving={patch.isPending}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ProfileForm({
  profile,
  functionalities,
  clients,
  onCancel,
  onSave,
  saving,
}: {
  profile: GlobalProfile
  functionalities: { id: string; name: string; category?: string }[]
  clients: { id: string; name: string }[]
  onCancel: () => void
  onSave: (p: GlobalProfile) => void | Promise<void>
  saving: boolean
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<GlobalProfile>(profile)
  const selected = new Set(draft.functionalityIds ?? [])

  function toggle(funcId: string) {
    const ids = new Set(selected)
    if (ids.has(funcId)) ids.delete(funcId)
    else ids.add(funcId)
    setDraft({ ...draft, functionalityIds: [...ids] })
  }
  // Agrupa funcionalidades por categoria pra UI mais legível.
  const byCategory = functionalities.reduce<Record<string, typeof functionalities>>(
    (acc, f) => {
      const cat = f.category || '—'
      ;(acc[cat] ??= []).push(f)
      return acc
    },
    {},
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
      }}
      className="flex h-full flex-col"
    >
      <SheetHeader>
        <SheetTitle>
          {profile.name ? t('admin.profiles.editTitle') : t('admin.profiles.newTitle')}
        </SheetTitle>
      </SheetHeader>
      <SheetBody>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('admin.profiles.field.name')}*</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('admin.profiles.field.client')}</Label>
              <Combobox
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                value={draft.clientId ?? ''}
                onChange={(v) =>
                  setDraft({ ...draft, clientId: v || undefined })
                }
                noneLabel={t('admin.profiles.global')}
                placeholder={t('admin.profiles.field.client')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('admin.profiles.field.functionalities')}</Label>
            <div className="grid max-h-96 gap-3 overflow-y-auto rounded-md border border-border p-3 md:grid-cols-2">
              {Object.entries(byCategory).map(([cat, funcs]) => (
                <div key={cat} className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    {cat}
                  </div>
                  {funcs.map((f) => (
                    <label key={f.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.has(f.id)}
                        onChange={() => toggle(f.id)}
                        className="mt-0.5"
                      />
                      <span>{f.name}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t('app.loading') : t('common.submit')}
        </Button>
      </SheetFooter>
    </form>
  )
}
