import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppState, usePatchAppState } from '@/features/admin/hooks/use-app-state'
import type { AccessPlan } from '@/features/admin/types'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { stripDraftIds } from '@/shared/lib/strip-draft-id'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
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

import { CsvExportButton } from '@/shared/ui/csv-export-button'
export function AdminPlansPage() {
  const { t } = useTranslation()
  const appState = useAppState()
  const patch = usePatchAppState()
  const [editing, setEditing] = useState<AccessPlan | null>(null)

  const plans = appState.data?.accessPlans ?? []
  const functionalities = appState.data?.functionalities ?? []

  const planColumns = useMemo<DataTableColumn<AccessPlan>[]>(
    () => [
      { key: 'name', label: t('admin.plans.th.name') },
      {
        key: 'code',
        label: t('admin.plans.th.code'),
        getValue: (p) => p.code ?? '',
      },
      {
        key: 'functionalitiesCount',
        label: t('admin.plans.th.functionalities'),
        getValue: (p) => p.functionalityIds?.length ?? 0,
        filterable: false,
      },
    ],
    [t],
  )
  const dt = useDataTable(plans, planColumns)

  async function save(p: AccessPlan) {
    const exists = plans.some((x) => x.id === p.id)
    const next = exists ? plans.map((x) => (x.id === p.id ? p : x)) : [...plans, p]
    setEditing(null)
    try {
      await patch.mutateAsync({ accessPlans: stripDraftIds(next) })
      toastSaved(t('admin.plans.saved'))
    } catch (err) {
      toastError(err)
    }
  }

  async function remove(p: AccessPlan) {
    const ok = await confirm({
      title: t('admin.plans.deleteTitle'),
      description: t('admin.plans.deleteDesc', { name: p.name }),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      await patch.mutateAsync({ accessPlans: stripDraftIds(plans.filter((x) => x.id !== p.id)) })
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
          {t('admin.plans.subtitle', { count: plans.length })}
        </p>
        <CsvExportButton
            filename="planos"
            rows={(plans as any[])}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => (r as any).id },
              { key: 'name', label: 'Nome', getValue: (r) => (r as any).name },
              { key: 'description', label: 'Descrição', getValue: (r) => (r as any).description ?? '' },
              { key: 'createdAt', label: 'Criado em', getValue: (r) => (r as any).createdAt },
              { key: 'updatedAt', label: 'Atualizado em', getValue: (r) => (r as any).updatedAt },
            ]}
          />
          <Button onClick={() => setEditing({ id: `plan_${Date.now()}`, name: '', functionalityIds: [] })}>
          <Plus className="h-4 w-4" />
          <span>{t('admin.plans.new')}</span>
        </Button>
      </div>

      <DataTableActiveFilters
        state={dt as never}
        columns={planColumns as never}
      />

      <Card className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              {planColumns.map((col) => (
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
                <TableCell className="text-muted-foreground">{p.code ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {p.functionalityIds?.length ?? 0}
                </TableCell>
                <TableCell className="text-center">
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
            <PlanForm
              plan={editing}
              functionalities={functionalities}
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

function PlanForm({
  plan,
  functionalities,
  onCancel,
  onSave,
  saving,
}: {
  plan: AccessPlan
  functionalities: { id: string; name: string; category?: string }[]
  onCancel: () => void
  onSave: (p: AccessPlan) => void | Promise<void>
  saving: boolean
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<AccessPlan>(plan)
  const selected = new Set(draft.functionalityIds ?? [])

  function toggle(id: string) {
    const ids = new Set(selected)
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
    setDraft({ ...draft, functionalityIds: [...ids] })
  }

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
          {plan.name ? t('admin.plans.editTitle') : t('admin.plans.newTitle')}
        </SheetTitle>
      </SheetHeader>
      <SheetBody>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('admin.plans.field.name')}*</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t('admin.plans.field.code')}</Label>
              <Input
                value={draft.code ?? ''}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="basic, pro, enterprise"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t('admin.plans.field.description')}</Label>
              <Input
                value={draft.description ?? ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('admin.plans.field.functionalities')}</Label>
            <div className="grid max-h-96 gap-1.5 overflow-y-auto rounded-md border border-border p-3 md:grid-cols-2">
              {functionalities.map((f) => (
                <label key={f.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                    className="mt-0.5"
                  />
                  <span>
                    {f.name}
                    {f.category && (
                      <span className="ml-1 text-xs text-muted-foreground">· {f.category}</span>
                    )}
                  </span>
                </label>
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
