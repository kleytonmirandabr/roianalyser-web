/**
 * Modal de gerenciamento de Colunas Customizadas (Phase 2 P.4).
 * Lista colunas existentes + form pra criar/editar/remover.
 */
import { Plus, Settings2, Trash2 } from 'lucide-react'
import { useState } from 'react'

import {
  COLUMN_TYPE_LABELS, SUPPORTED_COLUMN_TYPES,
  type ColumnType, type ProjectTaskColumn,
} from '@/features/projects2/task-columns-types'
import {
  useCreateColumn, useDeleteColumn, useProjectTaskColumns, useUpdateColumn,
} from '@/features/projects2/hooks/use-project-task-columns'
import { Button } from '@/shared/ui/button'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string | undefined
  canManage: boolean
}

function makeKey(label: string): string {
  return label.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || `col_${Date.now().toString(36)}`
}

export function ColumnsManager({ open, onClose, projectId, canManage }: Props) {
  const list = useProjectTaskColumns(projectId)
  const create = useCreateColumn(projectId)
  const update = useUpdateColumn(projectId)
  const remove = useDeleteColumn(projectId)
  const cols = list.data || []

  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<ColumnType>('text')
  const [newSelectOpts, setNewSelectOpts] = useState('')

  if (!open) return null

  const typeOptions = SUPPORTED_COLUMN_TYPES.map(t => ({
    value: t,
    label: COLUMN_TYPE_LABELS[t] || t,
  }))

  async function handleCreate() {
    if (!newLabel.trim()) return
    const opts = (newType === 'select' || newType === 'status') && newSelectOpts.trim()
      ? {
          values: newSelectOpts.split(',').map(s => s.trim()).filter(Boolean).map(s => ({
            value: makeKey(s),
            label: s,
          })),
        }
      : null
    try {
      await create.mutateAsync({
        columnKey: makeKey(newLabel),
        label: newLabel.trim(),
        type: newType,
        options: opts,
        displayOrder: cols.length,
      })
      toastSaved('Coluna criada')
      setAdding(false); setNewLabel(''); setNewType('text'); setNewSelectOpts('')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleDelete(c: ProjectTaskColumn) {
    const ok = await confirm({
      title: 'Remover coluna',
      description: `Remover "${c.label}"? Os valores das tarefas nesta coluna serao apagados.`,
      confirmLabel: 'Remover',
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(c.id)
      toastDeleted('Coluna removida')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleRename(c: ProjectTaskColumn, label: string) {
    if (!label.trim() || label === c.label) return
    try {
      await update.mutateAsync({ id: c.id, patch: { label: label.trim() } })
      toastSaved('Coluna renomeada')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl border w-full max-w-2xl max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
              Colunas customizadas
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crie campos extras (Monday-style) para suas tarefas.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>

        <div className="p-5 space-y-3">
          {cols.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhuma coluna customizada ainda.</p>
          ) : (
            <ul className="space-y-2">
              {cols.map(c => (
                <li key={c.id} className="flex items-center gap-2 rounded border p-2">
                  <Input
                    defaultValue={c.label}
                    onBlur={(e) => canManage && handleRename(c, e.target.value)}
                    disabled={!canManage}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-32">
                    {COLUMN_TYPE_LABELS[c.type] || c.type}
                  </span>
                  {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && !adding && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Nova coluna
            </Button>
          )}

          {canManage && adding && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome da coluna</Label>
                  <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ex.: Prioridade" autoFocus />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Combobox options={typeOptions} value={newType} onChange={(v) => setNewType(v as ColumnType)} />
                </div>
              </div>
              {(newType === 'select' || newType === 'status') && (
                <div>
                  <Label>Opcoes (separadas por virgula)</Label>
                  <Input
                    value={newSelectOpts}
                    onChange={(e) => setNewSelectOpts(e.target.value)}
                    placeholder="Ex.: Alta, Media, Baixa"
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => { setAdding(false); setNewLabel(''); setNewType('text'); setNewSelectOpts('') }}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={!newLabel.trim() || create.isPending}>
                  {create.isPending ? 'Criando...' : 'Criar coluna'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
