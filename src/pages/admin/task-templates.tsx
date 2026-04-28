/** Admin → Modelos de Tarefas (master only). */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
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
    { key: 'key', label: 'Chave', getValue: (r: any) => r.key },
    { key: 'category', label: 'Categoria', getValue: (r: any) => r.category ?? '' },
    { key: 'defaultDurationDays', label: 'Duração (dias)', getValue: (r: any) => r.defaultDurationDays ?? 0 },
    { key: 'displayOrder', label: 'Ordem', getValue: (r: any) => r.displayOrder ?? 0 },
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
    const ok = await confirm({ title: `Excluir modelo "${t.name}"?`, destructive: true })
    if (!ok) return
    try { await del.mutateAsync(t.id); toastDeleted('Modelo removido') } catch (e) { toastError(e) }
  }

  async function handleSave() {
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
    if (!draft.id && !draft.key.trim()) return toastError(new Error('Informe a chave'))
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
      toastSaved('Modelo salvo'); setOpen(false)
    } catch (e) { toastError(e) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modelos de Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Tarefas pré-cadastradas (ligação, e-mail, reunião, etc) que podem ser instanciadas em projetos.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo modelo</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum modelo configurado.</div>
        ) : (
          <>
            <DataTableActiveFilters state={dt} columns={columns} />
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <DataTableHeaderCell key={col.key} column={col} state={dt} />
                  ))}
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dt.rows.map((row) => {
                  const t = row as TaskTemplate
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell><code className="text-xs bg-muted/50 px-1 rounded">{t.key}</code></TableCell>
                      <TableCell className="text-xs">{t.category || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {t.defaultDurationDays != null ? t.defaultDurationDays : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">{t.displayOrder}</TableCell>
                      <TableCell className="text-right space-x-1">
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
          <SheetHeader><SheetTitle>{draft.id ? 'Editar modelo' : 'Novo modelo'}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1"><Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: Reunião de alinhamento" />
            </div>
            <div className="space-y-1"><Label>Descrição</Label>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Duração (dias)</Label>
                <Input type="number" value={draft.defaultDurationDays}
                  onChange={(e) => setDraft({ ...draft, defaultDurationDays: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1"><Label>Categoria</Label>
                <Input value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="discovery, kickoff..." />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={draft.active} onCheckedChange={(c) => setDraft({ ...draft, active: c === true })} />
              <Label>Ativo</Label>
            </div>
            {draft.id && (
              <AuditInfoFooter
                createdAt={(draft as any).createdAt}
                updatedAt={(draft as any).updatedAt}
              />
            )}
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
