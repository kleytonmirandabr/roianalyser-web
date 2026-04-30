/** Admin → Meta de Vendas (master only). */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCreateSalesGoal, useDeleteSalesGoal,
  useSalesGoals, useUpdateSalesGoal,
} from '@/features/sales-goals/hooks/use-sales-goals'
import type { SalesGoal } from '@/features/sales-goals/types'
import { confirm } from '@/shared/ui/confirm-dialog'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  DataTableActiveFilters, DataTableHeaderCell, DataTablePagination,
  useDataTable, type DataTableColumn,
} from '@/shared/ui/data-table'
import { slugify } from '@/shared/lib/slugify'
import { AuditInfoFooter } from '@/shared/ui/audit-info-footer'
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { CsvExportButton } from '@/shared/ui/csv-export-button'
interface Draft {
  id?: string; key: string; name: string;
  description: string;
  target: string;  // numeric input as string for empty-state UX
  responsibleUserId: string;
  periodStart: string;
  periodEnd: string;
  displayOrder: number; active: boolean;
}
const EMPTY: Draft = {
  key: '', name: '', description: '', target: '',
  responsibleUserId: '', periodStart: '', periodEnd: '',
  displayOrder: 0, active: true,
}

export function AdminSalesGoalsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const appState = useAppState()
  const users = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>
  const userOptions = [{ value: '', label: '— sem responsável —' }, ...users.filter(u => u.id).map(u => ({ value: String(u.id), label: u.name || u.email || '?' }))]
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useSalesGoals()
  const create = useCreateSalesGoal()
  const update = useUpdateSalesGoal(draft.id)
  const del = useDeleteSalesGoal()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />
  const items = (data ?? []) as SalesGoal[]
  const columns = useMemo<DataTableColumn<SalesGoal>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
    { key: 'target', label: 'Meta (R$)', getValue: (r: any) => r.target ?? 0 },
    { key: 'periodStart', label: 'Início', getValue: (r: any) => r.periodStart ?? '' },
    { key: 'periodEnd', label: 'Fim', getValue: (r: any) => r.periodEnd ?? '' },
  ], [])
  const dt = useDataTable(items, columns)

  function openCreate() { setDraft(EMPTY); setOpen(true) }
  function openEdit(item: SalesGoal) {
    const it = item as unknown as Record<string, unknown>
    setDraft({
      id: String(it.id), key: String(it.key), name: String(it.name),
      description: String(it.description ?? ''),
      target: it.target != null ? String(it.target) : '',
      responsibleUserId: it.responsibleUserId != null ? String(it.responsibleUserId) : '',
      periodStart: String(it.periodStart ?? ''),
      periodEnd: String(it.periodEnd ?? ''),
      displayOrder: Number(it.displayOrder ?? 0), active: it.active !== false,
      createdAt: (it.createdAt as string) || null,
      updatedAt: (it.updatedAt as string) || null,
    } as any)
    setOpen(true)
  }
  async function handleDelete(item: SalesGoal) {
    const it = item as unknown as Record<string, unknown>
    const ok = await confirm({ title: `Excluir "${String(it.name)}"?`, destructive: true })
    if (!ok) return
    try { await del.mutateAsync(String(it.id)); toastDeleted('Removido') } catch (e) { toastError(e) }
  }
  async function handleSave() {
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
    try {
      if (draft.id) {
        await update.mutateAsync({ name: draft.name.trim(), displayOrder: draft.displayOrder, active: draft.active })
      } else {
        await create.mutateAsync({ key: (draft.key.trim() || slugify(draft.name)), name: draft.name.trim(), displayOrder: draft.displayOrder, active: draft.active })
      }
      toastSaved('Salvo'); setOpen(false)
    } catch (e) { toastError(e) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.adminSalesGoals')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.shared.configurable')}</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvExportButton
            filename="metas-de-vendas"
            rows={(dt.rows as any[])}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => (r as any).id },
              { key: 'name', label: 'Nome', getValue: (r) => (r as any).name },
              { key: 'active', label: 'Ativo', getValue: (r) => (r as any).active !== false },
              { key: 'createdAt', label: 'Criado em', getValue: (r) => (r as any).createdAt },
              { key: 'updatedAt', label: 'Atualizado em', getValue: (r) => (r as any).updatedAt },
            ]}
          />
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo</Button>
        </div>
      </div>
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t('common.empty.items')}</div>
        ) : (
          <>
            <DataTableActiveFilters state={dt} columns={columns} />
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <DataTableHeaderCell key={col.key} column={col} state={dt} />
                  ))}
                  <TableHead className="w-32 text-center">{t('common.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dt.paginatedRows.map((t) => {
                  const it = t as unknown as Record<string, unknown>
                  return (
                    <TableRow key={String(it.id)}>
                      <TableCell className="font-medium">{String(it.name)}</TableCell>
                      <TableCell className="tabular-nums">{it.target != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(it.target)) : '—'}</TableCell>
                      <TableCell className="text-xs">{it.periodStart ? new Date(String(it.periodStart)).toLocaleDateString('pt-BR') : '—'}</TableCell>
                      <TableCell className="text-xs">{it.periodEnd ? new Date(String(it.periodEnd)).toLocaleDateString('pt-BR') : '—'}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(t)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <DataTablePagination state={dt} />
          </>
        )}
      </Card>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader><SheetTitle>{draft.id ? t('admin.salesGoals.titleEdit') : t('admin.salesGoals.titleNew')}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1"><Label><span>{t('common.fields.name')} *</span></Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: Meta Q1 2026 - SP" autoFocus />
            </div>
            <div className="space-y-1"><Label>{t('common.fields.description')}</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Detalhes da meta (opcional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Meta (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.target}
                  onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                  placeholder="100000"
                />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.responsible')}</Label>
                <Combobox
                  options={userOptions}
                  value={draft.responsibleUserId}
                  onChange={(v) => setDraft({ ...draft, responsibleUserId: v })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t('common.fields.periodStart')}</Label>
                <Input type="date" value={draft.periodStart} onChange={(e) => setDraft({ ...draft, periodStart: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.periodEnd')}</Label>
                <Input type="date" value={draft.periodEnd} onChange={(e) => setDraft({ ...draft, periodEnd: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={draft.active} onCheckedChange={(c) => setDraft({ ...draft, active: c === true })} />
              <Label>{t('common.fields.active')}</Label>
            </div>
            {draft.id && (
              <AuditInfoFooter
                createdAt={(draft as any).createdAt}
                updatedAt={(draft as any).updatedAt}
              />
            )}
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.actions.cancel')}</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              <Save className="h-4 w-4 mr-2" /> {t('common.actions.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
