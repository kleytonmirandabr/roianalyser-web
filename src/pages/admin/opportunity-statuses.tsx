/**
 * Admin → Status de Oportunidade (master only).
 *
 * Substitui a tela legacy /catalogs/project-statuses (que lia de jsonb).
 * Agora consume /api/opportunity-statuses (tabela própria).
 *
 * Categoria do status (gain/loss/in_progress/etc) drives automações de funil.
 */

import { Pencil, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCreateOpportunityStatus, useDeleteOpportunityStatus,
  useOpportunityStatuses, useUpdateOpportunityStatus,
} from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import {
  CATEGORIES, CATEGORY_LABELS,
  type OpportunityStatus, type OpportunityStatusCategory,
} from '@/features/opportunity-statuses/types'
import { confirm } from '@/shared/ui/confirm-dialog'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
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
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

interface Draft {
  id?: string
  key: string
  name: string
  color: string
  category: OpportunityStatusCategory | ''
  displayOrder: number
  active: boolean
}

const EMPTY: Draft = { key: '', name: '', color: '', category: '', displayOrder: 0, active: true }

function fromRow(s: OpportunityStatus): Draft {
  return {
    id: s.id, key: s.key, name: s.name,
    color: s.color || '', category: (s.category as OpportunityStatusCategory) || '',
    displayOrder: s.displayOrder, active: s.active,
  }
}

export function AdminOpportunityStatusesPage() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useOpportunityStatuses()
  const create = useCreateOpportunityStatus()
  const update = useUpdateOpportunityStatus(draft.id)
  const del = useDeleteOpportunityStatus()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />

  const items = (data ?? []) as OpportunityStatus[]
  const columns = useMemo<DataTableColumn<OpportunityStatus>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
    { key: 'key', label: 'Chave', getValue: (r: any) => r.key },
    { key: 'category', label: 'Categoria', getValue: (r: any) => r.category ?? '' },
    { key: 'color', label: 'Cor', getValue: (r: any) => r.color ?? '' },
    { key: 'displayOrder', label: 'Ordem', getValue: (r: any) => r.displayOrder ?? 0 },
  ], [])
  const dt = useDataTable(items, columns)

  function openCreate() { setDraft(EMPTY); setOpen(true) }
  function openEdit(s: OpportunityStatus) { setDraft(fromRow(s)); setOpen(true) }

  async function handleDelete(s: OpportunityStatus) {
    const ok = await confirm({
      title: `Excluir status "${s.name}"?`,
      description: 'Status removidos não aparecem nos funis. Oportunidades já atribuídas mantêm o vínculo até serem editadas.',
      destructive: true,
    })
    if (!ok) return
    try { await del.mutateAsync(s.id); toastDeleted('Status removido') }
    catch (e) { toastError(e) }
  }

  async function handleSave() {
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
    if (!draft.id && !draft.key.trim()) return toastError(new Error('Informe a chave (snake_case)'))
    try {
      if (draft.id) {
        await update.mutateAsync({
          name: draft.name.trim(),
          color: draft.color.trim() || null,
          category: (draft.category || null) as OpportunityStatusCategory | null,
          displayOrder: draft.displayOrder,
          active: draft.active,
        })
      } else {
        await create.mutateAsync({
          key: draft.key.trim(),
          name: draft.name.trim(),
          color: draft.color.trim() || null,
          category: (draft.category || null) as OpportunityStatusCategory | null,
          displayOrder: draft.displayOrder,
          active: draft.active,
        })
      }
      toastSaved('Status salvo')
      setOpen(false)
    } catch (e) { toastError(e) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Status de Oportunidade</h1>
          <p className="text-sm text-muted-foreground">
            Workflow de status do funil. Categoria liga o status a automações (ganho/perda/etc).
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo status</Button>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>Configuração master-only. Status com categoria <code>gain</code> dispara fluxo "Ganha" (carimba wonAt) e libera contrato.</AlertDescription>
      </Alert>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-5 w-2/3" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum status configurado.</div>
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
                  const r = row as OpportunityStatus
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell><code className="text-xs bg-muted/50 px-1 rounded">{r.key}</code></TableCell>
                      <TableCell className="text-xs">
                        {r.category ? CATEGORY_LABELS[r.category] : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {r.color ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: r.color }} />
                            <code className="text-xs">{r.color}</code>
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">{r.displayOrder}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(r)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
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
          <SheetHeader><SheetTitle>{draft.id ? 'Editar status' : 'Novo status'}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: Negociação" />
            </div>
            {!draft.id && (
              <div className="space-y-1">
                <Label>Chave (snake_case)</Label>
                <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="negociacao" />
                <p className="text-xs text-muted-foreground">Imutável após criação.</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Combobox
                options={[{ value: '', label: '— sem categoria —' }, ...CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] }))]}
                value={draft.category || ''}
                onChange={(v) => setDraft({ ...draft, category: v as OpportunityStatusCategory | '' })}
              />
              <p className="text-xs text-muted-foreground">Drives automação. <code>gain</code> = ganho, <code>loss</code> = perda.</p>
            </div>
            <div className="space-y-1">
              <Label>Cor (hex)</Label>
              <Input value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} placeholder="#059669" />
            </div>
            <div className="space-y-1">
              <Label>Ordem</Label>
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
