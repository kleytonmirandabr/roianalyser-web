/** Admin → Meta de Vendas (master only). */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'

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
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'

interface Draft {
  id?: string; key: string; name: string;
  displayOrder: number; active: boolean;
}
const EMPTY: Draft = { key: '', name: '', displayOrder: 0, active: true }

export function AdminSalesGoalsPage() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useSalesGoals()
  const create = useCreateSalesGoal()
  const update = useUpdateSalesGoal(draft.id)
  const del = useDeleteSalesGoal()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />
  const items = ((data ?? []) as SalesGoal[]).slice().sort((a, b) =>
    Number((a as unknown as Draft).displayOrder ?? 0) - Number((b as unknown as Draft).displayOrder ?? 0))

  function openCreate() { setDraft(EMPTY); setOpen(true) }
  function openEdit(item: SalesGoal) {
    const it = item as unknown as Record<string, unknown>
    setDraft({
      id: String(it.id), key: String(it.key), name: String(it.name),
      displayOrder: Number(it.displayOrder ?? 0), active: it.active !== false,
    })
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
    if (!draft.id && !draft.key.trim()) return toastError(new Error('Informe a chave'))
    try {
      if (draft.id) {
        await update.mutateAsync({ name: draft.name.trim(), displayOrder: draft.displayOrder, active: draft.active })
      } else {
        await create.mutateAsync({ key: draft.key.trim(), name: draft.name.trim(), displayOrder: draft.displayOrder, active: draft.active })
      }
      toastSaved('Salvo'); setOpen(false)
    } catch (e) { toastError(e) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meta de Vendas</h1>
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
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Chave</th>
                <th className="px-4 py-2">Ordem</th>
                <th className="px-4 py-2 w-32 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const it = t as unknown as Record<string, unknown>
                return (
                  <tr key={String(it.id)} className="border-t">
                    <td className="px-4 py-2 font-medium">{String(it.name)}</td>
                    <td className="px-4 py-2"><code className="text-xs bg-muted/50 px-1 rounded">{String(it.key)}</code></td>
                    <td className="px-4 py-2 tabular-nums text-xs">{String(it.displayOrder ?? 0)}</td>
                    <td className="px-4 py-2 text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(t)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
