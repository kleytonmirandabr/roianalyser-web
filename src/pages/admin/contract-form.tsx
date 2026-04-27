/**
 * Admin → Formulário da Oportunidade (master-only).
 *
 * Tela única que substitui dois lugares antes separados:
 *   - Catálogo `contractFormFields` (visível/obrigatório dos padrões)
 *   - Catálogo `customFields` (cadastro dos campos extras)
 *
 * UX:
 *   - Tabela única lista os 17 campos PADRÃO + N customizados misturados.
 *   - Padrão: ícone 🔒, só checkbox visível + obrigatório (4 LOCKED nem isso).
 *   - Customizado: badge CUSTOM + tipo, botões Editar / Excluir.
 *   - Botão "+ Adicionar campo customizado" abre Sheet com nome/chave/tipo/opções.
 *   - Salvar: persiste manifesto (contractFormFields) + customFields em paralelo.
 *
 * Drag-reorder fica pra próxima iteração — backend per-item não tem
 * endpoint de PATCH em batch e implementar via N requests é lento + risco
 * de inconsistência.
 */

import { ChevronLeft, Lock, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'

import {
  CUSTOM_FIELD_TYPES,
  STANDARD_FIELDS_BY_ID,
  mergeFields,
  newCustomField,
  splitForBackend,
  type ManifestItem,
  type CustomFieldItem,
  type UnifiedField,
} from '@/features/admin/lib/contract-form-fields'
import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCatalog,
  useCreateCatalogItem,
  useDeleteCatalogItem,
  useUpdateCatalogItem,
} from '@/features/catalogs/hooks/use-catalog'
import type { CustomFieldType } from '@/features/catalogs/components/custom-field-renderer'
import { confirm } from '@/shared/ui/confirm-dialog'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

export function AdminContractFormPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  // Master only — admin/user comum cai pra index dos Catálogos.
  if (user && !user.isMaster) {
    return <Navigate to="/catalogs" replace />
  }

  const manifest = useCatalog('contractFormFields')
  const customs = useCatalog('customFields')

  const createManifestItem = useCreateCatalogItem('contractFormFields')
  const updateManifestItem = useUpdateCatalogItem('contractFormFields')
  const deleteManifestItem = useDeleteCatalogItem('contractFormFields')
  const createCustomItem = useCreateCatalogItem('customFields')
  const updateCustomItem = useUpdateCatalogItem('customFields')
  const deleteCustomItem = useDeleteCatalogItem('customFields')

  /**
   * Estado local em forma "draft" — alterações ficam pendentes até clicar
   * Salvar. Hidrata do servidor ao carregar.
   */
  const [draft, setDraft] = useState<UnifiedField[]>([])
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState<
    Extract<UnifiedField, { kind: 'custom' }> | null
  >(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!manifest.isSuccess || !customs.isSuccess) return
    const merged = mergeFields(
      (manifest.data ?? []) as unknown as ManifestItem[],
      (customs.data ?? []) as unknown as CustomFieldItem[],
    )
    setDraft(merged)
    setDirty(false)
  }, [manifest.data, customs.data, manifest.isSuccess, customs.isSuccess])

  function patchField(id: string, patch: Partial<UnifiedField>) {
    setDraft((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        // Type-narrowing aceito porque kind nunca muda via patch.
        return { ...f, ...patch } as UnifiedField
      }),
    )
    setDirty(true)
  }

  function addCustom() {
    const cf = newCustomField()
    setEditing(cf)
  }

  function saveCustomDraft(updated: Extract<UnifiedField, { kind: 'custom' }>) {
    setDraft((prev) => {
      const idx = prev.findIndex((f) => f.id === updated.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [...prev, updated]
    })
    setDirty(true)
    setEditing(null)
  }

  async function removeCustom(id: string) {
    const ok = await confirm({
      title: 'Excluir campo customizado',
      description:
        'Esta ação remove o campo da tela e dos dados de todos os projetos novos. Confirma?',
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    setDraft((prev) => prev.filter((f) => f.id !== id))
    setDirty(true)
  }

  /**
   * Salvar: aplica diff entre `draft` e o que tá no servidor:
   *   - Custom novo (não estava antes) → POST /customFields
   *   - Custom editado (estava antes) → PUT /customFields/:id
   *   - Custom removido do draft → DELETE /customFields/:id
   *   - Manifest: cada item com id existente → PUT, novo → POST,
   *     e os que sumiram → DELETE
   *
   * Ordem das operações: customs primeiro (manifest pode referenciar id
   * recém-criado), depois manifest.
   */
  async function handleSave() {
    if (!manifest.isSuccess || !customs.isSuccess) return
    setSaving(true)
    try {
      const { manifest: nextManifest, customs: nextCustoms } = splitForBackend(draft)
      const prevManifest = (manifest.data ?? []) as unknown as ManifestItem[]
      const prevCustoms = (customs.data ?? []) as unknown as CustomFieldItem[]

      const prevManifestIds = new Set(prevManifest.map((m) => m.id))
      const prevCustomIds = new Set(prevCustoms.map((c) => c.id))
      const nextManifestIds = new Set(nextManifest.map((m) => m.id))
      const nextCustomIds = new Set(nextCustoms.map((c) => c.id))

      // 1. Customs — create / update / delete.
      for (const cf of nextCustoms) {
        if (prevCustomIds.has(cf.id)) {
          await updateCustomItem.mutateAsync({ id: cf.id, input: cf })
        } else {
          await createCustomItem.mutateAsync(cf)
        }
      }
      for (const cf of prevCustoms) {
        if (!nextCustomIds.has(cf.id)) {
          await deleteCustomItem.mutateAsync(cf.id)
        }
      }

      // 2. Manifest — create / update / delete.
      for (const m of nextManifest) {
        if (prevManifestIds.has(m.id)) {
          await updateManifestItem.mutateAsync({ id: m.id, input: m })
        } else {
          await createManifestItem.mutateAsync(m)
        }
      }
      for (const m of prevManifest) {
        if (!nextManifestIds.has(m.id)) {
          await deleteManifestItem.mutateAsync(m.id)
        }
      }

      toastSaved('Configuração salva.')
      setDirty(false)
    } catch (err) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  const loading = manifest.isLoading || customs.isLoading
  const error = manifest.isError || customs.isError

  const customCount = useMemo(
    () => draft.filter((f) => f.kind === 'custom').length,
    [draft],
  )

  return (
    <div className="w-full space-y-4">
      <Link
        to="/catalogs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('catalogs.title', { defaultValue: 'Catálogos' })}
      </Link>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t('admin.loadError')}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Formulário da Oportunidade
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure quais campos aparecem no cadastro de novos projetos —
            campos padrão do sistema e campos customizados criados por você.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={addCustom} variant="outline">
            <Plus className="h-4 w-4" />
            <span>Adicionar campo customizado</span>
          </Button>
          <Button onClick={handleSave} disabled={!dirty || saving || loading}>
            <Save className="h-4 w-4" />
            <span>{saving ? 'Salvando...' : 'Salvar'}</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead className="w-32">Tipo</TableHead>
                <TableHead className="w-24 text-center">Visível</TableHead>
                <TableHead className="w-28 text-center">Obrigatório</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                draft.map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    onToggleVisible={(v) =>
                      patchField(field.id, { visible: v } as Partial<UnifiedField>)
                    }
                    onToggleRequired={(v) =>
                      patchField(field.id, { required: v } as Partial<UnifiedField>)
                    }
                    onEdit={() =>
                      field.kind === 'custom' ? setEditing(field) : undefined
                    }
                    onDelete={() =>
                      field.kind === 'custom' ? removeCustom(field.id) : undefined
                    }
                  />
                ))}
              {!loading && draft.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    Nenhum campo configurado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {customCount} campo{customCount === 1 ? '' : 's'} customizado{customCount === 1 ? '' : 's'} •{' '}
        Padrão (🔒 não removível) · padrão configurável · customizado.
      </p>

      {/* Sheet de edição/criação de custom field. */}
      <Sheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <SheetContent className="sm:max-w-xl">
          {editing && (
            <CustomFieldForm
              field={editing}
              onCancel={() => setEditing(null)}
              onSave={saveCustomDraft}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function FieldRow({
  field,
  onToggleVisible,
  onToggleRequired,
  onEdit,
  onDelete,
}: {
  field: UnifiedField
  onToggleVisible: (v: boolean) => void
  onToggleRequired: (v: boolean) => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const isCustom = field.kind === 'custom'
  const std = field.kind === 'standard' ? STANDARD_FIELDS_BY_ID[field.id] : null
  const locked = field.kind === 'standard' && field.locked

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {locked ? (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          ) : isCustom ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
              CUSTOM
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              PADRÃO
            </span>
          )}
          <span className="font-medium">{field.label}</span>
          {isCustom && (
            <span className="font-mono text-[11px] text-muted-foreground">
              ({field.fieldKey})
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {isCustom
          ? CUSTOM_FIELD_TYPES.find((t) => t.value === field.fieldType)?.label ??
            field.fieldType
          : std
            ? '—'
            : '—'}
      </TableCell>
      <TableCell className="text-center">
        <input
          type="checkbox"
          checked={field.visible}
          disabled={locked}
          onChange={(e) => onToggleVisible(e.target.checked)}
          className="cursor-pointer"
        />
      </TableCell>
      <TableCell className="text-center">
        <input
          type="checkbox"
          checked={field.required}
          disabled={locked}
          onChange={(e) => onToggleRequired(e.target.checked)}
          className="cursor-pointer"
        />
      </TableCell>
      <TableCell className="text-right">
        {isCustom && (
          <div className="flex justify-end gap-1">
            <IconTooltip label="Editar">
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
            </IconTooltip>
            <IconTooltip label="Excluir">
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </IconTooltip>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

function CustomFieldForm({
  field,
  onCancel,
  onSave,
}: {
  field: Extract<UnifiedField, { kind: 'custom' }>
  onCancel: () => void
  onSave: (next: Extract<UnifiedField, { kind: 'custom' }>) => void
}) {
  const [draft, setDraft] = useState(field)
  const isNew = !field.label || field.label === 'Novo campo'
  const needsOptions =
    draft.fieldType === 'select' || draft.fieldType === 'multi-select'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.label.trim()) return
    if (!draft.fieldKey.trim()) return
    onSave({
      ...draft,
      label: draft.label.trim(),
      fieldKey: draft.fieldKey.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          {isNew ? 'Novo campo customizado' : 'Editar campo customizado'}
        </SheetTitle>
      </SheetHeader>
      <SheetBody>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do campo*</Label>
            <Input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Ex: Prioridade do projeto"
              autoFocus
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Rótulo exibido no formulário de novo projeto.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Chave técnica*</Label>
            <Input
              value={draft.fieldKey}
              onChange={(e) =>
                setDraft({ ...draft, fieldKey: e.target.value.replace(/\s+/g, '_') })
              }
              placeholder="prioridade"
              required
              pattern="[a-zA-Z_][a-zA-Z0-9_]*"
            />
            <p className="text-[11px] text-muted-foreground">
              Identificador no banco de dados — use snake_case sem espaços. Não
              altere depois de cadastrar (quebra os dados existentes).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Combobox
              options={CUSTOM_FIELD_TYPES.map((t) => ({
                value: t.value,
                label: t.label,
              }))}
              value={draft.fieldType}
              onChange={(v) =>
                setDraft({ ...draft, fieldType: (v as CustomFieldType) || 'text' })
              }
              placeholder="Tipo"
              noneLabel="—"
            />
          </div>

          {needsOptions && (
            <div className="space-y-1.5">
              <Label>Opções</Label>
              <Input
                value={draft.options}
                onChange={(e) => setDraft({ ...draft, options: e.target.value })}
                placeholder="Alta | Média | Baixa"
              />
              <p className="text-[11px] text-muted-foreground">
                Separe as opções com <code>|</code> (barra vertical).
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.visible}
                onChange={(e) => setDraft({ ...draft, visible: e.target.checked })}
              />
              Visível no formulário
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.required}
                onChange={(e) =>
                  setDraft({ ...draft, required: e.target.checked })
                }
              />
              Obrigatório
            </label>
          </div>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!draft.label.trim() || !draft.fieldKey.trim()}>
          {isNew ? 'Adicionar' : 'Salvar'}
        </Button>
      </SheetFooter>
    </form>
  )
}
