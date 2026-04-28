/** Admin → Tipo Financeiro (master only). */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCreateFinancialType, useDeleteFinancialType,
  useFinancialTypes, useUpdateFinancialType,
} from '@/features/financial-types/hooks/use-financial-types'
import type { FinancialType } from '@/features/financial-types/types'
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
  id?: string; key: string; name: string;
  displayOrder: number; active: boolean;
}
const EMPTY: Draft = { key: '', name: '', displayOrder: 0, active: true }

export function AdminFinancialTypesPage() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useFinancialTypes()
  const create = useCreateFinancialType()
  const update = useUpdateFinancialType(draft.id)
  const del = useDeleteFinancialType()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />
  const items = (data ?? []) as FinancialType[]
  const columns = useMemo<DataTableColumn<FinancialType>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
  ], [])
  const dt = useDataTable(items, columns)

  function openCreate() { setDraft(EMPTY); setOpen(true) }
  function openEdit(item: FinancialType) {
    const it = item as unknown as Record<string, unknown>
    setDraft({
      id: String(it.id), key: String(it.key), name: String(it.name),
      displayOrder: Number(it.displayOrder ?? 0), active: it.active !== false,
    createdAt: (it.createdAt as string) || null,
    updatedAt: (it.updatedAt as string) || null,
    } as any)
    setOpen(true)
  }
  async function handleDelete(item: FinancialType) {
    const it = item as unknown as Record<string, unknown>
    const ok = await confirm({ title: `Excluir "${String(it.name)}"?`, destructive: true })
    if (!ok) return
    try { await del.mutateAsync(String(it.id)); toastDeleted('Removido') } catch (e) { toastError(e) }
  }
  async function handleSave() {
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
    if (!draft.id && !draft.key.trim()) return toastError(new Error('Informe a chave'))
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
          <h1 className="text-2xl font-bold">Tipo Financeiro</h1>
          <p className="text-sm text-muted-foreground">Catálogo configurável.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo</Button>
      </div>
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum item.</div>
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
                {dt.rows.map((t) => {
                  const it = t as unknown as Record<string, unknown>
                  return (
                    <TableRow key={String(it.id)}>
                      <TableCell className="font-medium">{String(it.name)}</TableCell>
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
          <SheetHeader><SheetTitle>{draft.id ? 'Editar' : 'Novo'}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1"><Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            {!draft.id && (
              <div className="space-y-1"><Label>Chave (snake_case)</Label>
                <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} />
              </div>
            )}
            <div className="space-y-1"><Label>Ordem</Label>
              <Input type="number" value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: Number(e.target.value) || 0 })} />
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
