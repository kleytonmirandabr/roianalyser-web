/**
 * Modal de gerenciamento de Colunas Customizadas (Phase 2 P.4 → Sprint 3.8).
 * Sprint 3.8: color picker por opção de select/status.
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

interface DraftOption { label: string; color: string }

function makeKey(label: string): string {
  return label.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || `col_${Date.now().toString(36)}`
}

const DEFAULT_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444',
  '#3b82f6', '#a855f7', '#14b8a6', '#f97316',
]

export function ColumnsManager({ open, onClose, projectId, canManage }: Props) {
  const list = useProjectTaskColumns(projectId)
  const create = useCreateColumn(projectId)
  const update = useUpdateColumn(projectId)
  const remove = useDeleteColumn(projectId)
  const cols = list.data || []

  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<ColumnType>('text')
  // Sprint 3.8: opções estruturadas com cor
  const [draftOpts, setDraftOpts] = useState<DraftOption[]>([])
  const [optInput, setOptInput] = useState('')

  // Coluna em edição de opções (para colunas já existentes)
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [editingOpts, setEditingOpts] = useState<DraftOption[]>([])

  if (!open) return null

  const typeOptions = SUPPORTED_COLUMN_TYPES.map(t => ({
    value: t,
    label: COLUMN_TYPE_LABELS[t] || t,
  }))

  function addDraftOpt() {
    const labels = optInput.split(',').map(s => s.trim()).filter(Boolean)
    const next = [...draftOpts]
    labels.forEach((lbl, i) => {
      next.push({ label: lbl, color: DEFAULT_COLORS[(next.length + i) % DEFAULT_COLORS.length] })
    })
    setDraftOpts(next)
    setOptInput('')
  }

  async function handleCreate() {
    if (!newLabel.trim()) return
    const opts = (newType === 'select' || newType === 'status') && draftOpts.length
      ? {
          values: draftOpts.map(o => ({
            value: makeKey(o.label),
            label: o.label,
            color: o.color,
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
      setAdding(false); setNewLabel(''); setNewType('text'); setDraftOpts([]); setOptInput('')
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

  async function handleSaveEditingOpts(c: ProjectTaskColumn) {
    try {
      await update.mutateAsync({
        id: c.id,
        patch: {
          options: {
            values: editingOpts.map(o => ({
              value: makeKey(o.label),
              label: o.label,
              color: o.color,
            })),
          },
        },
      })
      toastSaved('Opções salvas')
      setEditingColId(null)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl border w-full max-w-2xl max-h-[85vh] overflow-auto"
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
            <ul className="space-y-3">
              {cols.map(c => (
                <li key={c.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      defaultValue={c.label}
                      onBlur={(e) => canManage && handleRename(c, e.target.value)}
                      disabled={!canManage}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-28 shrink-0">
                      {COLUMN_TYPE_LABELS[c.type] || c.type}
                    </span>
                    {canManage && (c.type === 'select' || c.type === 'status') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (editingColId === c.id) {
                            setEditingColId(null)
                          } else {
                            setEditingColId(c.id)
                            setEditingOpts(
                              (c.options?.values || []).map(v => ({
                                label: v.label,
                                color: v.color || DEFAULT_COLORS[0],
                              })),
                            )
                          }
                        }}
                      >
                        Opções
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    )}
                  </div>

                  {/* Editor de opções inline com color picker */}
                  {editingColId === c.id && canManage && (
                    <div className="rounded bg-muted/40 p-3 space-y-2 border border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opções e cores</p>
                      <ul className="space-y-1.5">
                        {editingOpts.map((o, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <input
                              type="color"
                              value={o.color}
                              onChange={(e) => {
                                const next = [...editingOpts]
                                next[idx] = { ...next[idx], color: e.target.value }
                                setEditingOpts(next)
                              }}
                              className="h-7 w-7 cursor-pointer rounded border border-input bg-transparent p-0.5"
                              title="Cor da opção"
                            />
                            <Input
                              value={o.label}
                              onChange={(e) => {
                                const next = [...editingOpts]
                                next[idx] = { ...next[idx], label: e.target.value }
                                setEditingOpts(next)
                              }}
                              className="flex-1 h-7 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingOpts(editingOpts.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingOpts([...editingOpts, { label: '', color: DEFAULT_COLORS[editingOpts.length % DEFAULT_COLORS.length] }])}
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar opção
                      </Button>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setEditingColId(null)}>Cancelar</Button>
                        <Button size="sm" onClick={() => handleSaveEditingOpts(c)}>Salvar opções</Button>
                      </div>
                    </div>
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
                  <Combobox options={typeOptions} value={newType} onChange={(v) => { setNewType(v as ColumnType); setDraftOpts([]) }} />
                </div>
              </div>

              {(newType === 'select' || newType === 'status') && (
                <div className="space-y-2">
                  <Label>Opções</Label>
                  {draftOpts.length > 0 && (
                    <ul className="space-y-1">
                      {draftOpts.map((o, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <input
                            type="color"
                            value={o.color}
                            onChange={(e) => {
                              const next = [...draftOpts]
                              next[idx] = { ...next[idx], color: e.target.value }
                              setDraftOpts(next)
                            }}
                            className="h-7 w-7 cursor-pointer rounded border border-input bg-transparent p-0.5"
                          />
                          <span className="flex-1 text-sm">{o.label}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDraftOpts(draftOpts.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={optInput}
                      onChange={(e) => setOptInput(e.target.value)}
                      placeholder="Ex.: Alta, Media, Baixa"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDraftOpt())}
                    />
                    <Button variant="outline" size="sm" type="button" onClick={addDraftOpt}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Separe por vírgula ou adicione uma por vez. Clique na cor para alterar.</p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => { setAdding(false); setNewLabel(''); setNewType('text'); setDraftOpts([]); setOptInput('') }}>
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
