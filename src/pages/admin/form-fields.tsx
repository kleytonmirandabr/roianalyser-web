/**
 * Admin → Custom Fields (master only).
 *
 * Configura campos personalizados por escopo (Oportunidade / ROI /
 * Contrato / Projeto). Os valores são preenchidos pelos usuários no
 * detalhe de cada entity via <CustomFieldsCard />.
 *
 * UX:
 *   - Tabs por scope.
 *   - Botão "+ Novo campo" abre Sheet com nome/chave/tipo/required/opções.
 *   - Editar abre o mesmo Sheet pré-populado.
 *   - Excluir = soft delete (pede confirmação).
 *
 * Spec: PLAN_split-domain-entities.md, seção 2.3.
 */

import { Pencil, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCreateFormField,
  useDeleteFormField,
  useFormFields,
  useUpdateFormField,
} from '@/features/form-fields/hooks/use-form-fields'
import {
  FORM_FIELD_SCOPES,
  FORM_FIELD_TYPES,
  SCOPE_LABELS,
  TYPE_LABELS,
  type FormField,
  type FormFieldScope,
  type FormFieldType,
} from '@/features/form-fields/types'
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
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'

interface DraftField {
  id?: string
  scope: FormFieldScope
  fieldKey: string
  label: string
  fieldType: FormFieldType
  required: boolean
  helpText: string
  optionsRaw: string  // "value:label\nvalue2:label2"
  displayOrder: number
}

const EMPTY: DraftField = {
  scope: 'opportunity',
  fieldKey: '',
  label: '',
  fieldType: 'text',
  required: false,
  helpText: '',
  optionsRaw: '',
  displayOrder: 0,
}

function parseOptions(raw: string): { value: string; label: string }[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [v, ...rest] = line.split(':')
      const label = rest.join(':').trim() || v.trim()
      return { value: v.trim(), label }
    })
}

function serializeOptions(options: { value: string; label: string }[] | null): string {
  if (!options) return ''
  return options.map((o) => `${o.value}:${o.label}`).join('\n')
}

function fromField(f: FormField): DraftField {
  return {
    id: f.id,
    scope: f.scope,
    fieldKey: f.fieldKey,
    label: f.label,
    fieldType: f.fieldType,
    required: f.required,
    helpText: f.helpText ?? '',
    optionsRaw: serializeOptions(f.options),
    displayOrder: f.displayOrder,
  }
}

export function AdminFormFieldsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [activeScope, setActiveScope] = useState<FormFieldScope>('opportunity')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState<DraftField>(EMPTY)

  const { data: allFields, isLoading } = useFormFields()
  const fieldsByScope: Record<FormFieldScope, FormField[]> = useMemo(() => {
    const map: Record<FormFieldScope, FormField[]> = {
      opportunity: [],
      roi: [],
      contract: [],
      project: [],
    }
    for (const f of allFields ?? []) {
      if (map[f.scope]) map[f.scope].push(f)
    }
    for (const s of FORM_FIELD_SCOPES) {
      map[s].sort((a, b) => a.displayOrder - b.displayOrder)
    }
    return map
  }, [allFields])

  const createField = useCreateFormField()
  const updateField = useUpdateFormField(draft.id)
  const deleteField = useDeleteFormField()

  if (user && !user.isMaster) {
    return <Navigate to="/admin" replace />
  }

  function openCreate() {
    setDraft({ ...EMPTY, scope: activeScope })
    setSheetOpen(true)
  }

  function openEdit(field: FormField) {
    setDraft(fromField(field))
    setSheetOpen(true)
  }

  async function handleDelete(field: FormField) {
    const ok = await confirm({
      title: `Excluir campo "${field.label}"?`,
      description:
        'O campo será removido do scope. Valores já preenchidos ficam no histórico mas não aparecem mais nas telas.',
      destructive: true,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    try {
      await deleteField.mutateAsync(field.id)
      toastDeleted('Campo removido')
    } catch (e) {
      toastError(e)
    }
  }

  async function handleSave() {
    if (!draft.label.trim()) {
      toastError(new Error('Informe o nome do campo (Label)'))
      return
    }
    if (!draft.id && !draft.fieldKey.trim()) {
      toastError(new Error('Informe a chave do campo (snake_case)'))
      return
    }
    if (
      (draft.fieldType === 'select' || draft.fieldType === 'multiselect') &&
      parseOptions(draft.optionsRaw).length === 0
    ) {
      toastError(new Error('Informe ao menos uma opção (formato: chave:rótulo por linha)'))
      return
    }
    try {
      if (draft.id) {
        await updateField.mutateAsync({
          label: draft.label.trim(),
          helpText: draft.helpText.trim() || null,
          required: draft.required,
          displayOrder: draft.displayOrder,
          options: parseOptions(draft.optionsRaw),
        })
      } else {
        await createField.mutateAsync({
          scope: draft.scope,
          fieldKey: draft.fieldKey.trim(),
          label: draft.label.trim(),
          fieldType: draft.fieldType,
          required: draft.required,
          helpText: draft.helpText.trim() || null,
          displayOrder: draft.displayOrder,
          options: parseOptions(draft.optionsRaw),
        })
      }
      toastSaved('Campo salvo')
      setSheetOpen(false)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('common.fields.customFields')}</h1>
          <p className="text-sm text-muted-foreground">
            Configure campos extras que aparecem no detalhe de cada entidade.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo campo
        </Button>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Apenas usuários master podem configurar custom fields. Cada campo pertence a UM
          escopo — campos de Oportunidade não aparecem em Projeto, e vice-versa.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        {FORM_FIELD_SCOPES.map((s) => (
          <Button
            key={s}
            variant={activeScope === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveScope(s)}
          >
            {SCOPE_LABELS[s]}
            <span className="ml-2 text-xs opacity-70">
              ({fieldsByScope[s]?.length ?? 0})
            </span>
          </Button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        ) : (fieldsByScope[activeScope] ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum campo configurado em {SCOPE_LABELS[activeScope]}. Use "Novo campo" para
            começar.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="px-4 py-2">{t('common.fields.label')}</th>
                <th className="px-4 py-2">{t('common.fields.key')}</th>
                <th className="px-4 py-2">{t('common.fields.type')}</th>
                <th className="px-4 py-2">{t('common.fields.required')}</th>
                <th className="px-4 py-2 w-32 text-center">{t('common.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {fieldsByScope[activeScope].map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{f.label}</td>
                  <td className="px-4 py-2">
                    <code className="text-xs bg-muted/50 px-1 py-0.5 rounded">
                      {f.fieldKey}
                    </code>
                  </td>
                  <td className="px-4 py-2">{TYPE_LABELS[f.fieldType]}</td>
                  <td className="px-4 py-2">{f.required ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2 text-center space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(f)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{draft.id ? 'Editar campo' : 'Novo campo personalizado'}</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-4">
            {!draft.id && (
              <div className="space-y-1">
                <Label>{t('common.fields.scope')}</Label>
                <Combobox
                  options={FORM_FIELD_SCOPES.map((s) => ({
                    value: s,
                    label: SCOPE_LABELS[s],
                  }))}
                  value={draft.scope}
                  onChange={(v) => setDraft({ ...draft, scope: v as FormFieldScope })}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label>Nome (label visível)</Label>
              <Input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Ex: Setor de atuação"
              />
            </div>

            {!draft.id && (
              <div className="space-y-1">
                <Label>Chave técnica (snake_case)</Label>
                <Input
                  value={draft.fieldKey}
                  onChange={(e) => setDraft({ ...draft, fieldKey: e.target.value })}
                  placeholder="setor_atuacao"
                />
                <p className="text-xs text-muted-foreground">
                  Usada internamente. Não pode ser alterada após criação.
                </p>
              </div>
            )}

            {!draft.id && (
              <div className="space-y-1">
                <Label>{t('common.fields.type')}</Label>
                <Combobox
                  options={FORM_FIELD_TYPES.map((t) => ({
                    value: t,
                    label: TYPE_LABELS[t],
                  }))}
                  value={draft.fieldType}
                  onChange={(v) => setDraft({ ...draft, fieldType: v as FormFieldType })}
                />
              </div>
            )}

            {(draft.fieldType === 'select' || draft.fieldType === 'multiselect') && (
              <div className="space-y-1">
                <Label>{t('common.fields.options')}</Label>
                <textarea
                  className="w-full rounded-md border px-3 py-2 text-sm font-mono min-h-[120px]"
                  value={draft.optionsRaw}
                  onChange={(e) => setDraft({ ...draft, optionsRaw: e.target.value })}
                  placeholder="varejo:Varejo&#10;industria:Indústria&#10;servicos:Serviços"
                />
                <p className="text-xs text-muted-foreground">
                  Uma opção por linha no formato <code>chave:rótulo</code>.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                checked={draft.required}
                onCheckedChange={(c) => setDraft({ ...draft, required: c === true })}
              />
              <Label>{t('common.fields.required')}</Label>
            </div>

            <div className="space-y-1">
              <Label>Texto de ajuda (opcional)</Label>
              <Input
                value={draft.helpText}
                onChange={(e) => setDraft({ ...draft, helpText: e.target.value })}
                placeholder="Aparece como dica abaixo do campo"
              />
            </div>

            <div className="space-y-1">
              <Label>{t('common.fields.order')}</Label>
              <Input
                type="number"
                value={draft.displayOrder}
                onChange={(e) =>
                  setDraft({ ...draft, displayOrder: Number(e.target.value) || 0 })
                }
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createField.isPending || updateField.isPending}
            >
              <Save className="h-4 w-4 mr-2" /> {t('common.actions.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
