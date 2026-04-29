/** Admin → Unidade de Cobrança (master only). */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCreateBillingUnit, useDeleteBillingUnit,
  useBillingUnits, useUpdateBillingUnit,
} from '@/features/billing-units/hooks/use-billing-units'
import type { BillingUnit } from '@/features/billing-units/types'
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
  id?: string; key: string; name: string;
  displayOrder: number; active: boolean;
}
const EMPTY: Draft = { key: '', name: '', displayOrder: 0, active: true }

export function AdminBillingUnitsPage() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useBillingUnits()
  const create = useCreateBillingUnit()
  const update = useUpdateBillingUnit(draft.id)
  const del = useDeleteBillingUnit()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />
  const items = (data ?? []) as BillingUnit[]
  const columns = useMemo<DataTableColumn<BillingUnit>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
  ], [])
  const dt = useDataTable(items, columns)

  function openCreate() { setDraft(EMPTY); setOpen(true) }
  function openEdit(item: BillingUnit) {
    const it = item as unknown as Record<string, unknown>
    setDraft({
      id: String(it.id), key: String(it.key), name: String(it.name),
      displayOrder: Number(it.displayOrder ?? 0), active: it.active !== false,
    createdAt: (it.createdAt as string) || null,
    updatedAt: (it.updatedAt as string) || null,
    } as any)
    setOpen(true)
  }
  async function handleDelete(item: BillingUnit) {
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
          <h1 className="text-2xl font-bold">Unidade de Cobrança</h1>
          <p className="text-sm text-muted-foreground">Catálogo configurável.</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvExportButton
            filename="unidades-de-cobranca"
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
                  <TableHead className="w-32 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dt.paginatedRows.map((t) => {
                  const it = t as unknown as Record<string, unknown>
                  return (
                    <TableRow key={String(it.id)}>
                      <TableCell className="font-medium">{String(it.name)}</TableCell>
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
          <SheetHeader><SheetTitle>{draft.id ? 'Editar' : 'Novo'}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1"><Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
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
