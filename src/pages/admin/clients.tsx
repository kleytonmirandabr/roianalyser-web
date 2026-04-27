import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppState, usePatchAppState } from '@/features/admin/hooks/use-app-state'
import type { GlobalClient } from '@/features/admin/types'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { timezoneOptions } from '@/shared/lib/timezones'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import {
  DataTableActiveFilters,
  DataTableHeaderCell,
  useDataTable,
  type DataTableColumn,
} from '@/shared/ui/data-table'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { ImageUploadField } from '@/shared/ui/image-upload-field'
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

export function AdminClientsPage() {
  const { t } = useTranslation()
  const appState = useAppState()
  const patch = usePatchAppState()
  const [editing, setEditing] = useState<GlobalClient | null>(null)

  const clients = appState.data?.clients ?? []
  const plans = appState.data?.accessPlans ?? []

  const clientColumns = useMemo<DataTableColumn<GlobalClient>[]>(
    () => [
      { key: 'name', label: t('admin.clients.th.name') },
      {
        key: 'accessPlanId',
        label: t('admin.clients.th.plan'),
        getValue: (c) => c.accessPlanId ?? c.plan ?? '',
        formatValue: (v) =>
          typeof v === 'string' && v
            ? plans.find((p) => p.id === v)?.name ?? String(v)
            : '—',
      },
      {
        key: 'contactEmail',
        label: t('admin.clients.th.contact'),
        getValue: (c) => c.contactEmail ?? '',
      },
    ],
    [t, plans],
  )
  const dt = useDataTable(clients, clientColumns)

  async function save(c: GlobalClient) {
    const exists = clients.some((x) => x.id === c.id)
    const next = exists ? clients.map((x) => (x.id === c.id ? c : x)) : [...clients, c]
    setEditing(null)
    try {
      await patch.mutateAsync({ clients: next })
      toastSaved(t('admin.clients.saved'))
    } catch (err) {
      toastError(err)
    }
  }

  async function remove(c: GlobalClient) {
    const ok = await confirm({
      title: t('admin.clients.deleteTitle'),
      description: t('admin.clients.deleteDesc', { name: c.name }),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      await patch.mutateAsync({ clients: clients.filter((x) => x.id !== c.id) })
      toastDeleted()
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

      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t('admin.clients.subtitle', { count: clients.length })}
        </p>
        <Button onClick={() => setEditing({ id: `client_${Date.now()}`, name: '' })}>
          <Plus className="h-4 w-4" />
          <span>{t('admin.clients.new')}</span>
        </Button>
      </div>

      <DataTableActiveFilters
        state={dt as never}
        columns={clientColumns as never}
      />

      <Card className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              {clientColumns.map((col) => (
                <DataTableHeaderCell key={col.key} column={col} state={dt} />
              ))}
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {dt.rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {plans.find((p) => p.id === c.accessPlanId)?.name ?? c.plan ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.contactEmail ?? '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <IconTooltip label={t('catalogs.detail.edit')}>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                    <IconTooltip label={t('catalogs.detail.delete')}>
                      <Button variant="ghost" size="icon" onClick={() => remove(c)}>
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

      <Sheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <SheetContent className="sm:max-w-xl md:max-w-2xl">
          {editing && (
            <ClientForm
              client={editing}
              plans={plans}
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

function ClientForm({
  client,
  plans,
  onCancel,
  onSave,
  saving,
}: {
  client: GlobalClient
  plans: { id: string; name: string }[]
  onCancel: () => void
  onSave: (c: GlobalClient) => void | Promise<void>
  saving: boolean
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<GlobalClient>(client)
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
          {client.name ? t('admin.clients.editTitle') : t('admin.clients.newTitle')}
        </SheetTitle>
      </SheetHeader>
      <SheetBody>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('admin.clients.field.name')}*</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin.clients.field.plan')}</Label>
            <Combobox
              options={plans.map((p) => ({ value: p.id, label: p.name }))}
              value={draft.accessPlanId ?? ''}
              onChange={(v) => setDraft({ ...draft, accessPlanId: v || undefined })}
              noneLabel="—"
              placeholder={t('admin.clients.field.plan')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin.clients.field.contact')}</Label>
            <Input
              type="email"
              value={draft.contactEmail ?? ''}
              onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin.clients.field.fiscalYearStart')}</Label>
            <Input
              type="text"
              value={draft.fiscalYearStart ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, fiscalYearStart: e.target.value })
              }
              placeholder="01-01"
              pattern="\d{2}-\d{2}"
            />
            <p className="text-[11px] text-muted-foreground">
              {t('admin.clients.field.fiscalYearStartHint')}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin.clients.field.forecastHorizon')}</Label>
            <Input
              type="number"
              min={1}
              max={36}
              value={draft.forecastHorizonMonths ?? 18}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  forecastHorizonMonths: Number(e.target.value) || 18,
                })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('admin.clients.field.timezone')}</Label>
            <Combobox
              options={timezoneOptions()}
              value={draft.timezone ?? ''}
              onChange={(v) => setDraft({ ...draft, timezone: v || null })}
              noneLabel={t('admin.clients.field.timezoneAuto')}
              placeholder={t('admin.clients.field.timezone')}
            />
            <p className="text-[11px] text-muted-foreground">
              {t('admin.clients.field.timezoneHint')}
            </p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('admin.clients.field.logo')}</Label>
            <ImageUploadField
              value={draft.logoDataUrl ?? null}
              onChange={(dataUrl) => setDraft({ ...draft, logoDataUrl: dataUrl })}
              maxSizeKb={150}
              previewSize={200}
            />
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
