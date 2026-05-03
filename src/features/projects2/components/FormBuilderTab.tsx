/**
 * FormBuilderTab — Tab "Formulário" na detail page de projeto.
 *
 * Fase 2: criar/editar form builder (campos, layout, acesso, confirmação).
 * Fase 3: aba de Analytics mostrando submissões.
 */
import {
  CheckSquare, ChevronDown, ChevronUp, ClipboardList, Copy,
  ExternalLink, GripVertical, LayoutList, MonitorPlay, Plus,
  RefreshCw, Settings, Trash2, Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useProjectTaskColumns } from '../hooks/use-project-task-columns'
import {
  useCreateProjectForm, useDeleteProjectForm,
  useFormSubmissions, useProjectForms, useUpdateProjectForm,
} from '../hooks/use-project-forms'
import { MILESTONE_STATUS_LABELS } from '../milestones-types'
import { COLUMN_TYPE_LABELS } from '../task-columns-types'
import type { FormField, FormLayout, ProjectForm } from '../form-types'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { confirm } from '@/shared/ui/confirm-dialog'

// ── helpers ────────────────────────────────────────────────────────────────

const BUILT_IN_FIELDS: Omit<FormField, 'required'>[] = [
  { key: 'title',       label: 'Título',       type: 'text' },
  { key: 'description', label: 'Descrição',    type: 'long_text' },
  { key: 'plannedDate', label: 'Data prevista',type: 'date' },
  { key: 'status',      label: 'Status',       type: 'select' },
]

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
}

const APP_ORIGIN = window.location.origin

// ── sub-components ─────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
      <span className="text-sm">{label}</span>
    </label>
  )
}

function FieldRow({
  field, enabled, onToggle, onRequiredToggle, index, total, onMoveUp, onMoveDown,
}: {
  field: FormField & { enabled: boolean }
  enabled: boolean
  onToggle: () => void
  onRequiredToggle: () => void
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
      enabled ? 'bg-background' : 'bg-muted/30 opacity-60'
    }`}>
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button" onClick={onMoveUp} disabled={index === 0}
          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button" onClick={onMoveDown} disabled={index === total - 1}
          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      <input
        type="checkbox" checked={enabled} onChange={onToggle}
        className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
      />
      <span className="flex-1 font-medium truncate">{field.label}</span>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {COLUMN_TYPE_LABELS[field.type as any] ?? field.type}
      </span>
      {enabled && (
        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox" checked={field.required} onChange={onRequiredToggle}
            className="h-3 w-3 accent-primary"
          />
          obrigatório
        </label>
      )}
    </div>
  )
}

// ── FormEditor ─────────────────────────────────────────────────────────────

interface FormEditorProps {
  projectId: string
  form?: ProjectForm
  onSaved: () => void
  onCancel: () => void
}

function FormEditor({ projectId, form, onSaved, onCancel }: FormEditorProps) {
  const { data: columns = [] } = useProjectTaskColumns(projectId)
  const createForm = useCreateProjectForm(projectId)
  const updateForm = useUpdateProjectForm(projectId)

  const isEdit = !!form

  // Build available fields list: built-ins + custom columns
  const allFields = useMemo<FormField[]>(() => {
    const builtins = BUILT_IN_FIELDS.map(f => ({ ...f, required: f.key === 'title' }))
    const customs: FormField[] = columns.map(c => ({
      key: c.id,
      label: c.label,
      type: c.type,
      required: c.required,
      options: c.options?.values,
    }))
    return [...builtins, ...customs]
  }, [columns])

  // ── form state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState(form?.title ?? 'Formulário de entrada')
  const [description, setDescription] = useState(form?.description ?? '')
  const [isPublic, setIsPublic] = useState(form?.isPublic ?? true)
  const [layout, setLayout] = useState<FormLayout>(form?.layout ?? 'list')
  const [submitStatus, setSubmitStatus] = useState(form?.submitStatus ?? 'planning')
  const [confirmTitle, setConfirmTitle] = useState(form?.confirmationTitle ?? 'Enviado!')
  const [confirmMsg, setConfirmMsg] = useState(form?.confirmationMessage ?? 'Sua resposta foi registrada com sucesso.')
  const [isActive, setIsActive] = useState(form?.isActive ?? true)

  // Track which fields are enabled and their order
  const [fieldStates, setFieldStates] = useState<Array<FormField & { enabled: boolean }>>(() => {
    if (form?.fields?.length) {
      // Start from saved fields, then add any new columns not in the saved list
      const saved = form.fields.map(f => ({ ...f, enabled: true }))
      const savedKeys = new Set(saved.map(f => f.key))
      const extra = allFields
        .filter(f => !savedKeys.has(f.key))
        .map(f => ({ ...f, enabled: false }))
      return [...saved, ...extra]
    }
    return allFields.map(f => ({ ...f, enabled: f.key === 'title' }))
  })

  // Keep field states in sync if columns load after mount
  useEffect(() => {
    if (!form?.fields?.length) {
      setFieldStates(allFields.map(f => ({ ...f, enabled: f.key === 'title' })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFields.length])

  const toggleField = useCallback((idx: number) => {
    setFieldStates(prev =>
      prev.map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f)
    )
  }, [])

  const toggleRequired = useCallback((idx: number) => {
    setFieldStates(prev =>
      prev.map((f, i) => i === idx ? { ...f, required: !f.required } : f)
    )
  }, [])

  const moveField = useCallback((idx: number, dir: -1 | 1) => {
    setFieldStates(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }, [])

  async function handleSave() {
    const enabledFields = fieldStates.filter(f => f.enabled).map(({ enabled: _e, ...f }) => f)
    if (enabledFields.length === 0) {
      toastError('Selecione ao menos um campo')
      return
    }
    const payload = {
      title, description: description || null, isPublic, layout,
      fields: enabledFields, submitStatus,
      confirmationTitle: confirmTitle || null,
      confirmationMessage: confirmMsg || null,
      isActive,
    }
    try {
      if (isEdit && form) {
        await updateForm.mutateAsync({ id: form.id, patch: payload })
      } else {
        await createForm.mutateAsync(payload)
      }
      toastSaved('Formulário salvo')
      onSaved()
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  const saving = createForm.isPending || updateForm.isPending

  return (
    <div className="space-y-5">
      {/* Básico */}
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informações do formulário</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="form-title">Título</Label>
            <Input id="form-title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="form-desc">Descrição (opcional)</Label>
            <Input id="form-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Instrução para o preenchedor" />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={isActive} onChange={setIsActive} label="Formulário ativo" />
          <Toggle checked={isPublic} onChange={setIsPublic} label="Acesso público (sem login)" />
        </div>
      </Card>

      {/* Layout */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Layout de exibição</h3>
        <div className="flex gap-3">
          {(['list', 'carousel'] as FormLayout[]).map(l => (
            <button
              key={l} type="button"
              onClick={() => setLayout(l)}
              className={`flex-1 flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                layout === l ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/40'
              }`}
            >
              {l === 'list' ? <LayoutList className="h-6 w-6" /> : <MonitorPlay className="h-6 w-6" />}
              <span className="text-sm font-medium">{l === 'list' ? 'Lista' : 'Carrossel'}</span>
              <span className="text-xs text-muted-foreground text-center">
                {l === 'list' ? 'Todos os campos em sequência' : 'Um campo por vez'}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Campos */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Campos do formulário
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({fieldStates.filter(f => f.enabled).length} selecionados)
          </span>
        </h3>
        <p className="text-xs text-muted-foreground">A mesma ordem aparecerá no formulário público.</p>
        <div className="space-y-1.5">
          {fieldStates.map((f, idx) => (
            <FieldRow
              key={f.key}
              field={f}
              enabled={f.enabled}
              onToggle={() => toggleField(idx)}
              onRequiredToggle={() => toggleRequired(idx)}
              index={idx}
              total={fieldStates.length}
              onMoveUp={() => moveField(idx, -1)}
              onMoveDown={() => moveField(idx, 1)}
            />
          ))}
        </div>
      </Card>

      {/* Submissão */}
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Configuração de submissão</h3>
        <div>
          <Label>Status da tarefa criada ao enviar</Label>
          <select
            value={submitStatus}
            onChange={e => setSubmitStatus(e.target.value as any)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(MILESTONE_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="conf-title">Título da confirmação</Label>
            <Input id="conf-title" value={confirmTitle} onChange={e => setConfirmTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="conf-msg">Mensagem de confirmação</Label>
            <Input id="conf-msg" value={confirmMsg} onChange={e => setConfirmMsg(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar formulário'}
        </Button>
      </div>
    </div>
  )
}

// ── Analytics panel ────────────────────────────────────────────────────────

function SubmissionsPanel({ projectId, formId }: { projectId: string; formId: string }) {
  const { data: submissions = [], isLoading, refetch, isFetching } = useFormSubmissions(projectId, formId)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {submissions.length} submiss{submissions.length === 1 ? 'ão' : 'ões'}
        </span>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!isLoading && submissions.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Nenhuma submissão ainda.</p>
      )}

      {submissions.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Tarefa criada</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Enviado por</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-3 py-2 truncate max-w-[200px]">{s.taskTitle || `#${s.taskId}`}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.submittedBy || 'Anônimo'}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(s.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── FormCard ───────────────────────────────────────────────────────────────

function FormCard({
  form, projectId, canManage,
}: {
  form: ProjectForm
  projectId: string
  canManage: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const deleteForm = useDeleteProjectForm(projectId)
  const publicUrl = `${APP_ORIGIN}/f/${form.token}`

  async function handleDelete() {
    const ok = await confirm({
      title: 'Excluir formulário',
      description: 'Esta ação é irreversível. Confirma?',
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteForm.mutateAsync(form.id)
      toastSaved('Formulário excluído')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  if (editing) {
    return (
      <Card className="p-4">
        <FormEditor
          projectId={projectId}
          form={form}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </Card>
    )
  }

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{form.title}</h3>
            <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
              form.isActive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            }`}>
              {form.isActive ? 'Ativo' : 'Inativo'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
              {form.isPublic ? 'Público' : 'Login obrigatório'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
              {form.layout === 'carousel' ? 'Carrossel' : 'Lista'}
            </span>
          </div>
          {form.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{form.description}</p>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(true)}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-7 px-2 text-rose-500 hover:text-rose-600"
              onClick={handleDelete} disabled={deleteForm.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* URL */}
      <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
        <span className="text-xs font-mono text-muted-foreground truncate flex-1">{publicUrl}</span>
        <button
          type="button"
          onClick={() => { copyToClipboard(publicUrl); toastSaved('Link copiado') }}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Copiar link"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <a
          href={publicUrl} target="_blank" rel="noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Abrir formulário"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Fields summary */}
      <div className="flex flex-wrap gap-1.5">
        {form.fields.map(f => (
          <span key={f.key} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-0.5">
            {f.required && <CheckSquare className="h-3 w-3 text-primary" />}
            {f.label}
          </span>
        ))}
      </div>

      {/* Analytics toggle */}
      <div className="border-t pt-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowAnalytics(v => !v)}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          {showAnalytics ? 'Ocultar submissões' : 'Ver submissões'}
          {showAnalytics ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showAnalytics && (
          <div className="mt-3">
            <SubmissionsPanel projectId={projectId} formId={form.id} />
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

interface FormBuilderTabProps {
  projectId: string
  canManage: boolean
}

export function FormBuilderTab({ projectId, canManage }: FormBuilderTabProps) {
  const { data: forms = [], isLoading } = useProjectForms(projectId)
  const [creating, setCreating] = useState(false)

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-3">
        {[1, 2].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Formulários</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Crie formulários públicos que geram tarefas automaticamente ao serem preenchidos.
          </p>
        </div>
        {canManage && !creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo formulário
          </Button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Novo formulário</h3>
          <FormEditor
            projectId={projectId}
            onSaved={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      {/* Empty state */}
      {!creating && forms.length === 0 && (
        <Card className="p-8 flex flex-col items-center gap-3 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium">Nenhum formulário ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Formulários permitem que colaboradores externos enviem tarefas para este projeto.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar formulário
            </Button>
          )}
        </Card>
      )}

      {/* Forms list */}
      {forms.map(form => (
        <FormCard key={form.id} form={form} projectId={projectId} canManage={canManage} />
      ))}
    </div>
  )
}
