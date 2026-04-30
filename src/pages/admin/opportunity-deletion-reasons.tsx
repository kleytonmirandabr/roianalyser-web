/** Admin → Motivos de exclusão de Oportunidades (master only). Sprint #198. */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCreateOpportunityDeletionReason,
  useDeleteOpportunityDeletionReason,
  useOpportunityDeletionReasons,
  useUpdateOpportunityDeletionReason,
} from '@/features/opportunity-deletion-reasons/hooks/use-opportunity-deletion-reasons'
import type { OpportunityDeletionReason } from '@/features/opportunity-deletion-reasons/types'
import { confirm } from '@/shared/ui/confirm-dialog'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { AuditInfoFooter } from '@/shared/ui/audit-info-footer'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  DataTableActiveFilters, DataTableHeaderCell, DataTablePagination,
  useDataTable, type DataTableColumn,
} from '@/shared/ui/data-table'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { CsvExportButton } from '@/shared/ui/csv-export-button'
interface Draft {
  id?: string
  name: string
  active: boolean
  createdAt?: string | null
  updatedAt?: string | null
}
const EMPTY: Draft = { name: '', active: true }

export function AdminOpportunityDeletionReasonsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useOpportunityDeletionReasons()
  const create = useCreateOpportunityDeletionReason()
  const update = useUpdateOpportunityDeletionReason()
  const del = useDeleteOpportunityDeletionReason()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />

  const items = (data ?? []) as OpportunityDeletionReason[]
  const columns = useMemo<DataTableColumn<OpportunityDeletionReason>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
    { key: 'active', label: 'Status', getValue: (r: any) => r.active ? 'Ativo' : 'Inativo' },
  ], [])
  const dt = useDataTable(items, columns)

  function openCreate() { setDraft(EMPTY); setOpen(true) }
  function openEdit(item: OpportunityDeletionReason) {
    setDraft({
      id: String(item.id),
      name: item.name,
      active: item.active !== false,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
    setOpen(true)
  }
  async function handleDelete(item: OpportunityDeletionReason) {
    const ok = await confirm({ title: `Excluir "${item.name}"?`, destructive: true })
    if (!ok) return
    try { await del.mutateAsync(String(item.id)); toastDeleted('Removido') } catch (e) { toastError(e) }
  }
  async function handleSave() {
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
    try {
      if (draft.id) {
        await update.mutateAsync({ id: draft.id, input: { name: draft.name.trim(), active: draft.active } })
      } else {
        await create.mutateAsync({ name: draft.name.trim(), active: draft.active })
      }
      toastSaved('Salvo')
      setOpen(false)
    } catch (e) { toastError(e) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.adminOpportunityDeletionReasons')}</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo configurável usado quando o usuário exclui uma oportunidade.
            Toda exclusão grava o motivo em auditoria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CsvExportButton
            filename="motivos-exclusao"
            rows={(dt.rows as any[])}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => (r as any).id },
              { key: 'name', label: 'Nome', getValue: (r) => (r as any).name },
              { key: 'active', label: 'Ativo', getValue: (r) => (r as any).active !== false },
              { key: 'createdAt', label: 'Criado em', getValue: (r) => (r as any).createdAt },
              { key: 'updatedAt', label: 'Atualizado em', getValue: (r) => (r as any).updatedAt },
            ]}
          />
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> {t('admin.opportunityDeletionReasons.newButton')}</Button>
        </div>
      </div>
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t('common.empty.reason')}</div>
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
                {dt.paginatedRows.map((t) => (
                  <TableRow key={String(t.id)}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {t.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(t)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataTablePagination state={dt} />
          </>
        )}
      </Card>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader><SheetTitle>{draft.id ? t('admin.opportunityDeletionReasons.titleEdit') : t('admin.opportunityDeletionReasons.titleNew')}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1">
              <Label>{t('common.fields.name')}</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="ex: Cliente desistiu"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={draft.active} onCheckedChange={(c) => setDraft({ ...draft, active: c === true })} />
              <Label>Ativo (disponível no diálogo de exclusão)</Label>
            </div>
            {draft.id && (
              <AuditInfoFooter
                createdAt={draft.createdAt}
                updatedAt={draft.updatedAt}
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
