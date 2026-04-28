/** Admin → Tipo de Oportunidade (master only). */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCreateOpportunityType, useDeleteOpportunityType,
  useOpportunityTypes, useUpdateOpportunityType,
} from '@/features/opportunity-types/hooks/use-opportunity-types'
import type { OpportunityType } from '@/features/opportunity-types/types'
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
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

interface Draft {
  id?: string; key: string; name: string; description: string;
  displayOrder: number; active: boolean;
}
const EMPTY: Draft = { key: '', name: '', description: '', displayOrder: 0, active: true }

export function AdminOpportunityTypesPage() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useOpportunityTypes()
  const create = useCreateOpportunityType()
  const update = useUpdateOpportunityType(draft.id)
  const del = useDeleteOpportunityType()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />
  const items = (data ?? []) as OpportunityType[]
  const columns = useMemo<DataTableColumn<OpportunityType>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
    { key: 'key', label: 'Chave', getValue: (r: any) => r.key },
    { key: 'description', label: 'Descrição', getValue: (r: any) => r.description ?? '' },
    { key: 'displayOrder', label: 'Ordem', getValue: (r: any) => r.displayOrder ?? 0 },
  ], [])
  const dt = useDataTable(items, columns)

  function openCreate() { setDraft(EMPTY); setOpen(true) }
  function openEdit(t: OpportunityType) {
    setDraft({ id: t.id, key: t.key, name: t.name, description: t.description ?? '',
               displayOrder: t.displayOrder, active: t.active })
    setOpen(true)
  }

  async function handleDelete(t: OpportunityType) {
    const ok = await confirm({ title: `Excluir tipo "${t.name}"?`, destructive: true })
    if (!ok) return
    try { await del.mutateAsync(t.id); toastDeleted('Tipo removido') } catch (e) { toastError(e) }
  }

  async function handleSave() {
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
    if (!draft.id && !draft.key.trim()) return toastError(new Error('Informe a chave'))
    try {
      if (draft.id) {
        await update.mutateAsync({
          name: draft.name.trim(), description: draft.description.trim() || null,
          displayOrder: draft.displayOrder, active: draft.active,
        })
      } else {
        await create.mutateAsync({
          key: draft.key.trim(), name: draft.name.trim(),
          description: draft.description.trim() || null,
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
          <h1 className="text-2xl font-bold">Tipo de Oportunidade</h1>
          <p className="text-sm text-muted-foreground">
            Classifica a Op no momento da criação (Novo negócio, Renovação, Upsell, etc).
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo tipo</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum tipo configurado.</div>
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
                  const t = row as OpportunityType
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell><code className="text-xs bg-muted/50 px-1 rounded">{t.key}</code></TableCell>
                      <TableCell className="text-xs">{t.description || <span className="text-muted-foreground">—</span>}</TableCell>
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
          <SheetHeader><SheetTitle>{draft.id ? 'Editar tipo' : 'Novo tipo'}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1"><Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: Renovação" />
            </div>
            {!draft.id && (
              <div className="space-y-1"><Label>Chave (snake_case)</Label>
                <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="renovacao" />
              </div>
            )}
            <div className="space-y-1"><Label>Descrição</Label>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="space-y-1"><Label>Ordem</Label>
              <Input type="number" value={draft.displayOrder}
                onChange={(e) => setDraft({ ...draft, displayOrder: Number(e.target.value) || 0 })} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={draft.active} onCheckedChange={(c) => setDraft({ ...draft, active: c === true })} />
              <Label>Ativo</Label>
            </div>
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
