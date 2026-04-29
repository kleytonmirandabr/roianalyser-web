import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppState, usePatchAppState } from '@/features/admin/hooks/use-app-state'
import type { GlobalFunctionality } from '@/features/admin/types'
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
export function AdminFunctionalitiesPage() {
  const { t } = useTranslation()
  const appState = useAppState()
  const patch = usePatchAppState()
  const [editing, setEditing] = useState<GlobalFunctionality | null>(null)

  const functionalities = appState.data?.functionalities ?? []

  const funcColumns = useMemo<DataTableColumn<GlobalFunctionality>[]>(
    () => [
      { key: 'name', label: t('admin.functionalities.th.name') },
      {
        key: 'category',
        label: t('admin.functionalities.th.category'),
        getValue: (f) => f.category ?? '',
      },
      {
        key: 'plan',
        label: t('admin.functionalities.th.plan'),
        getValue: (f) => f.plan ?? '',
      },
    ],
    [t],
  )
  const dt = useDataTable(functionalities, funcColumns)

  async function save(f: GlobalFunctionality) {
    const exists = functionalities.some((x) => x.id === f.id)
    const next = exists
      ? functionalities.map((x) => (x.id === f.id ? f : x))
      : [...functionalities, f]
    setEditing(null)
    try {
      await patch.mutateAsync({ functionalities: stripDraftIds(next) })
      toastSaved(t('admin.functionalities.saved'))
    } catch (err) {
      toastError(err)
    }
  }

  async function remove(f: GlobalFunctionality) {
    const ok = await confirm({
      title: t('admin.functionalities.deleteTitle'),
      description: t('admin.functionalities.deleteDesc', { name: f.name }),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      await patch.mutateAsync({
        functionalities: functionalities.filter((x) => x.id !== f.id),
      })
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
          {t('admin.functionalities.subtitle', { count: functionalities.length })}
        </p>
<CsvExportButton
            filename="funcionalidades"
            rows={(functionalities as any[])}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => (r as any).id },
              { key: 'name', label: 'Nome', getValue: (r) => (r as any).name },
              { key: 'key', label: 'Chave', getValue: (r) => (r as any).key ?? '' },
              { key: 'category', label: 'Categoria', getValue: (r) => (r as any).category ?? '' },
            ]}
          />
                <Button
          onClick={() =>
            setEditing({ id: `func_${Date.now()}`, name: '', category: '' })
          }
        >
          <Plus className="h-4 w-4" />
          <span>{t('admin.functionalities.new')}</span>
        </Button>
      </div>

      <DataTableActiveFilters
        state={dt as never}
        columns={funcColumns as never}
      />

      <Card className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              {funcColumns.map((col) => (
                <DataTableHeaderCell key={col.key} column={col} state={dt} />
              ))}
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {dt.paginatedRows.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">
                  {f.name}
                  {f.description && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {f.description}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {f.category ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{f.plan ?? '—'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <IconTooltip label={t('catalogs.detail.edit')}>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                    <IconTooltip label={t('catalogs.detail.delete')}>
                      <Button variant="ghost" size="icon" onClick={() => remove(f)}>
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
            <FunctionalityForm
              item={editing}
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

function FunctionalityForm({
  item,
  onCancel,
  onSave,
  saving,
}: {
  item: GlobalFunctionality
  onCancel: () => void
  onSave: (f: GlobalFunctionality) => void | Promise<void>
  saving: boolean
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<GlobalFunctionality>(item)
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
          {item.name ? t('admin.functionalities.editTitle') : t('admin.functionalities.newTitle')}
        </SheetTitle>
      </SheetHeader>
      <SheetBody>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('admin.functionalities.field.name')}*</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin.functionalities.field.category')}</Label>
            <Input
              value={draft.category ?? ''}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="dashboard, analysis, export…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin.functionalities.field.plan')}</Label>
            <Input
              value={draft.plan ?? ''}
              onChange={(e) => setDraft({ ...draft, plan: e.target.value })}
              placeholder="core, premium…"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('admin.functionalities.field.description')}</Label>
            <Input
              value={draft.description ?? ''}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
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
