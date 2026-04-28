/**
 * <CustomFieldsCard /> — bloco reutilizável que renderiza os custom fields
 * de uma entity (Op/ROI/Contrato/Projeto) e permite editar inline.
 *
 * Uso:
 *   <CustomFieldsCard
 *     scope="opportunity"
 *     entityType="opportunity"
 *     entityId={opportunityId}
 *   />
 *
 * Comportamento:
 *   - Se o tenant não tem nenhuma definição em `scope`, esconde o card.
 *   - Modo leitura: lista label + valor formatado.
 *   - Modo edição: inputs por tipo, salva via PUT /api/form-field-values/...
 *
 * Spec: PLAN_split-domain-entities.md, seção 2.3.
 */

import { Pencil, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import { formatDate } from '@/shared/lib/format'
import { toastError, toastSaved } from '@/shared/lib/toasts'

import { useFormFieldValues, usePutFormFieldValues } from '../hooks/use-form-fields'
import {
  SCOPE_TO_ENTITY_TYPE,
  type FormField,
  type FormFieldEntityType,
  type FormFieldScope,
} from '../types'

interface Props {
  scope: FormFieldScope
  /** Override opcional do entityType pra cobrir scope→entity_type custom. */
  entityType?: FormFieldEntityType
  entityId: string | null | undefined
  className?: string
}

/** Converte o `value` (que vem unknown do backend) em string editável. */
function toEditableString(field: FormField, value: unknown): string {
  if (value == null) return ''
  if (field.fieldType === 'multiselect' && Array.isArray(value)) {
    return value.map((v) => String(v)).join(',')
  }
  if (field.fieldType === 'date') {
    // backend retorna ISO; mantém só YYYY-MM-DD pra <input type=date>
    const s = String(value)
    return s.length >= 10 ? s.slice(0, 10) : s
  }
  if (field.fieldType === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

/** Converte o draft string → valor canônico pro backend. */
function fromDraft(field: FormField, draft: string): unknown {
  if (draft === '' || draft == null) return null
  switch (field.fieldType) {
    case 'number':
      return Number(draft)
    case 'boolean':
      return draft === 'true'
    case 'multiselect':
      return draft
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    case 'date':
      return draft // YYYY-MM-DD
    default:
      return draft
  }
}

/** Renderiza valor pro modo leitura, formatado humano-amigável. */
function renderValue(field: FormField, value: unknown): string {
  if (value == null || value === '') return '—'
  switch (field.fieldType) {
    case 'boolean':
      return value ? 'Sim' : 'Não'
    case 'date':
      return formatDate(String(value))
    case 'multiselect': {
      if (!Array.isArray(value)) return String(value)
      const labels = (value as string[]).map((v) => {
        const opt = field.options?.find((o) => o.value === v)
        return opt ? opt.label : v
      })
      return labels.join(', ')
    }
    case 'select': {
      const opt = field.options?.find((o) => o.value === value)
      return opt ? opt.label : String(value)
    }
    case 'number':
      return Number(value).toLocaleString('pt-BR')
    default:
      return String(value)
  }
}

export function CustomFieldsCard({ scope, entityType, entityId, className }: Props) {
  const resolvedEntityType: FormFieldEntityType = entityType ?? SCOPE_TO_ENTITY_TYPE[scope]
  const { data: values, isLoading } = useFormFieldValues(resolvedEntityType, entityId ?? null)
  const putValues = usePutFormFieldValues(resolvedEntityType, entityId ?? null)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const fields: FormField[] = useMemo(
    () => (values ?? []).map((v) => v.field),
    [values],
  )

  // Quando entra em modo edição, popula draft com valores atuais
  useEffect(() => {
    if (!editing) return
    const next: Record<string, string> = {}
    for (const v of values ?? []) {
      next[v.field.id] = toEditableString(v.field, v.value)
    }
    setDraft(next)
  }, [editing, values])

  // Esconde card se tenant não tem definições nesse scope
  if (!entityId) return null
  if (isLoading) {
    return (
      <Card className={`p-6 space-y-3 ${className ?? ''}`}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
      </Card>
    )
  }
  if (!fields.length) return null

  function handleCancel() {
    setEditing(false)
    setDraft({})
  }

  async function handleSave() {
    // Validação client-side: required
    const missing = fields.filter((f) => f.required && (draft[f.id] ?? '').trim() === '')
    if (missing.length) {
      toastError(
        new Error(
          `Preencha o(s) campo(s) obrigatório(s): ${missing.map((m) => m.label).join(', ')}`,
        ),
      )
      return
    }
    const payload = fields.map((f) => ({
      fieldId: f.id,
      value: fromDraft(f, draft[f.id] ?? ''),
    }))
    try {
      await putValues.mutateAsync(payload)
      toastSaved('Campos personalizados salvos')
      setEditing(false)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Card className={`p-6 space-y-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Campos personalizados</h3>
        {editing ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={putValues.isPending}
            >
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={putValues.isPending}>
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Editar
          </Button>
        )}
      </div>

      {editing && putValues.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao salvar: {String((putValues.error as Error).message ?? putValues.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(values ?? []).map(({ field, value }) => (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {field.label}
              {field.required ? <span className="text-red-500 ml-1">*</span> : null}
            </Label>

            {!editing ? (
              <div className="text-sm">{renderValue(field, value)}</div>
            ) : field.fieldType === 'textarea' ? (
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm min-h-[64px]"
                value={draft[field.id] ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [field.id]: e.target.value }))
                }
              />
            ) : field.fieldType === 'boolean' ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={(draft[field.id] ?? '') === 'true'}
                  onCheckedChange={(checked) =>
                    setDraft((d) => ({
                      ...d,
                      [field.id]: checked ? 'true' : 'false',
                    }))
                  }
                />
                <span className="text-sm">
                  {(draft[field.id] ?? '') === 'true' ? 'Sim' : 'Não'}
                </span>
              </div>
            ) : field.fieldType === 'select' ? (
              <Combobox
                options={(field.options ?? []).map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                value={draft[field.id] ?? ''}
                onChange={(v) => setDraft((d) => ({ ...d, [field.id]: v }))}
                placeholder="Selecione…"
              />
            ) : field.fieldType === 'multiselect' ? (
              <div className="flex flex-wrap gap-2">
                {(field.options ?? []).map((opt) => {
                  const current = (draft[field.id] ?? '')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                  const checked = current.includes(opt.value)
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 rounded-md border px-3 py-1 text-sm cursor-pointer ${
                        checked ? 'bg-primary/10 border-primary' : ''
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          const set = new Set(current)
                          if (c) set.add(opt.value)
                          else set.delete(opt.value)
                          setDraft((d) => ({
                            ...d,
                            [field.id]: Array.from(set).join(','),
                          }))
                        }}
                      />
                      {opt.label}
                    </label>
                  )
                })}
              </div>
            ) : (
              <Input
                type={
                  field.fieldType === 'number'
                    ? 'number'
                    : field.fieldType === 'date'
                      ? 'date'
                      : 'text'
                }
                value={draft[field.id] ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [field.id]: e.target.value }))
                }
                placeholder={field.helpText ?? ''}
              />
            )}

            {field.helpText && !editing ? (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  )
}
