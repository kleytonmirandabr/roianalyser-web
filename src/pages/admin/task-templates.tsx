/** Admin → Tipos de Tarefa (master only). Usados pra classificar atividades em oportunidades/projetos. */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCreateTaskTemplate, useDeleteTaskTemplate,
  useTaskTemplates, useUpdateTaskTemplate,
} from '@/features/task-templates/hooks/use-task-templates'
import type { TaskTemplate } from '@/features/task-templates/types'
import { confirm } from '@/shared/ui/confirm-dialog'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
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
  id?: string; key: string; name: string; description: string;
  defaultDurationDays: string; category: string;
  displayOrder: number; active: boolean;
}
const EMPTY: Draft = {
  key: '', name: '', description: '', defaultDurationDays: '', category: '',
  displayOrder: 0, active: true,
}

export function AdminTaskTemplatesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useTaskTemplates()
  const create = useCreateTaskTemplate()
  const update = useUpdateTaskTemplate(draft.id)
  const del = useDeleteTaskTemplate()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />
  const items = (data ?? []) as TaskTemplate[]
  const columns = useMemo<DataTableColumn<TaskTemplate>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
    { key: 'description', label: 'Descrição', getValue: (r: any) => r.description ?? '' },
  ], [])
  const dt = useDataTable(items, columns)

  function openCreate() { setDraft(EMPTY); setOpen(true) }
  function openEdit(t: TaskTemplate) {
    setDraft({
      createdAt: (arguments[0] as any).createdAt,
      updatedAt: (arguments[0] as any).updatedAt,
      id: t.id, key: t.key, name: t.name, description: t.description ?? '',
      defaultDurationDays: t.defaultDurationDays != null ? String(t.defaultDurationDays) : '',
      category: t.category ?? '', displayOrder: t.displayOrder, active: t.active,
    } as any)
    setOpen(true)
  }

  async function handleDelete(t: TaskTemplate) {
    const ok = await confirm({ title: `Excluir tipo "${t.name}"?`, destructive: true })
    if (!ok) return
    try { await del.mutateAsync(t.id); toastDeleted('Tipo removido') } catch (e) { toastError(e) }
  }

  async function handleSave() {
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
    // Chave eh auto-gerada via slugify(name) se vazia (Sprint #190 dropou o campo Chave da UI)
    const dur = draft.defaultDurationDays ? Number(draft.defaultDurationDays) : null
    try {
      if (draft.id) {
        await update.mutateAsync({
          name: draft.name.trim(), description: draft.description.trim() || null,
          defaultDurationDays: dur, category: draft.category.trim() || null,
          displayOrder: draft.displayOrder, active: draft.active,
        })
      } else {
        await create.mutateAsync({
          key: (draft.key.trim() || slugify(draft.name)), name: draft.name.trim(),
          description: draft.description.trim() || null,
          defaultDurationDays: dur, category: draft.category.trim() || null,
          displayOrder: draft.displayOrder, active: draft.active,
        })
      }
      toastSaved('Tipo salvo'); setOpen(false)
    } catch (e) { toastError(e) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.adminTaskTemplates')}</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de tipos de tarefa (Ligar, Reunião, Visita Comercial, Envio de Email...) usados ao registrar atividades em oportunidades e projetos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CsvExportButton
            filename="tipos-de-tarefa"
            rows={(dt.rows as any[])}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => (r as any).id },
              { key: 'name', label: 'Nome', getValue: (r) => (r as any).name },
              { key: 'active', label: 'Ativo', getValue: (r) => (r as any).active !== false },
              { key: 'createdAt', label: 'Criado em', getValue: (r) => (r as any).createdAt },
              { key: 'updatedAt', label: 'Atualizado em', getValue: (r) => (r as any).updatedAt },
            ]}
          />
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> {t('admin.taskTemplates.titleNew')}</Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t('common.empty.taskType')}</div>
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
                {dt.paginatedRows.map((row) => {
                  const t = row as TaskTemplate
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.description ? <span className="line-clamp-1">{t.description}</span> : <span>—</span>}
                      </TableCell>
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
          <SheetHeader><SheetTitle>{draft.id ? t('admin.taskTemplates.titleEdit') : t('admin.taskTemplates.titleNew')}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1"><Label>{t('common.fields.name')}</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: Reunião de alinhamento" />
            </div>
            <div className="space-y-1"><Label>{t('common.fields.description')}</Label>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
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
