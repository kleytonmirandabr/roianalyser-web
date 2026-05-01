/**
 * Cadastro de Templates de Projeto (Phase 2 P.5).
 * CRUD simples — apenas campos basicos. Estrutura/colunas vem do "Salvar como template".
 */
import { Edit2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import {
  useCreateTemplate, useDeleteTemplate, useProjectTemplates, useUpdateTemplate,
} from '@/features/projects2/hooks/use-project-templates'
import type { ProjectTemplate } from '@/features/projects2/templates-types'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { confirm } from '@/shared/ui/confirm-dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'

export function ProjectTemplatesPage() {
  const list = useProjectTemplates()
  const create = useCreateTemplate()
  const update = useUpdateTemplate()
  const remove = useDeleteTemplate()

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState<ProjectTemplate | null>(null)

  const items = list.data || []

  function reset() {
    setAdding(false); setEditing(null); setName(''); setDescription('')
  }

  async function handleCreate() {
    if (!name.trim()) return
    try {
      await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        structure: { groups: [] },
        defaultColumns: [],
      })
      toastSaved('Template criado')
      reset()
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleUpdate() {
    if (!editing || !name.trim()) return
    try {
      await update.mutateAsync({
        id: editing.id,
        patch: { name: name.trim(), description: description.trim() || null },
      })
      toastSaved('Template atualizado')
      reset()
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleDelete(t: ProjectTemplate) {
    const ok = await confirm({
      title: 'Remover template',
      description: `Remover "${t.name}"? Esta acao nao afeta projetos ja criados a partir dele.`,
      confirmLabel: 'Remover',
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(t.id)
      toastDeleted('Template removido')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  function startEdit(t: ProjectTemplate) {
    setAdding(false)
    setEditing(t)
    setName(t.name)
    setDescription(t.description || '')
  }

  return (
    <div className="space-y-4 p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates de Projeto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modelos reutilizaveis para iniciar novos projetos rapidamente. Inclui estrutura de tarefas
            e colunas customizadas se forem geradas via "Salvar como template" no projeto.
          </p>
        </div>
        {!adding && !editing && (
          <Button onClick={() => { setAdding(true); setName(''); setDescription('') }}>
            <Plus className="h-4 w-4" /> Novo template
          </Button>
        )}
      </header>

      {(adding || editing) && (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">{editing ? 'Editar template' : 'Novo template'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Implantacao SAP" autoFocus />
            </div>
            <div>
              <Label>Descricao (opcional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Para clientes corporate" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={reset}>Cancelar</Button>
            <Button onClick={editing ? handleUpdate : handleCreate} disabled={!name.trim() || create.isPending || update.isPending}>
              {(create.isPending || update.isPending) ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {list.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground italic">
            Nenhum template criado ainda. Use "Salvar como template" dentro de um projeto, ou crie aqui.
          </div>
        ) : (
          <ul className="divide-y">
            {items.map(t => {
              const groupCount = (t.structure?.groups || []).length
              const colCount = (t.defaultColumns || []).length
              return (
                <li key={t.id} className="p-4 flex items-start justify-between gap-3 hover:bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{t.name}</div>
                    {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {groupCount} grupo{groupCount !== 1 ? 's' : ''} · {colCount} coluna{colCount !== 1 ? 's' : ''} customizada{colCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(t)} title="Editar">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} title="Remover">
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
