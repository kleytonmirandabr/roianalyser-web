import {
  ChevronLeft,
  Download,
  GripVertical,
  Inbox,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'

import {
  useCatalog,
  useCreateCatalogItem,
  useDeleteCatalogItem,
  useUpdateCatalogItem,
} from '@/features/catalogs/hooks/use-catalog'
import {
  STATUS_CATEGORY_DEFAULT_COLORS,
  type StatusCategory,
} from '@/features/projects/lib/status-categories'
import { CatalogSelect } from '@/features/catalogs/components/catalog-select'
import {
  findCatalogBySlug,
  type CatalogFieldDef,
} from '@/features/catalogs/registry'
import type { CatalogItem, CatalogType } from '@/features/catalogs/types'
import { cn } from '@/shared/lib/cn'
import { exportToCsv } from '@/shared/lib/export'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { fetchViaCep, normalizeCep } from '@/shared/lib/viacep'
import { confirm } from '@/shared/ui/confirm-dialog'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Combobox } from '@/shared/ui/combobox'
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
  DataTableActiveFilters,
  DataTableHeaderCell,
  DataTablePagination,
  useDataTable,
  type DataTableColumn,
} from '@/shared/ui/data-table'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

type DraftValue = string | boolean
type Draft = Record<string, DraftValue>

type FormMode =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; item: CatalogItem }

function defaultDraftFor(fields: CatalogFieldDef[]): Draft {
  const draft: Draft = {}
  for (const field of fields) {
    if (field.kind === 'boolean') {
      draft[field.key] =
        typeof field.defaultValue === 'boolean' ? field.defaultValue : false
    } else {
      draft[field.key] =
        field.defaultValue != null ? String(field.defaultValue) : ''
    }
  }
  return draft
}

function draftFromItem(fields: CatalogFieldDef[], item: CatalogItem): Draft {
  const draft: Draft = {}
  for (const field of fields) {
    const raw = item[field.key]
    if (field.kind === 'boolean') {
      draft[field.key] = !!raw
    } else if (raw == null) {
      draft[field.key] = ''
    } else {
      draft[field.key] = String(raw)
    }
  }
  return draft
}

function serializeDraft(
  fields: CatalogFieldDef[],
  draft: Draft,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of fields) {
    const raw = draft[field.key]
    if (field.kind === 'number') {
      const trimmed = typeof raw === 'string' ? raw.trim() : String(raw)
      if (trimmed === '') continue
      const num = Number(trimmed)
      out[field.key] = Number.isFinite(num) ? num : trimmed
    } else if (field.kind === 'boolean') {
      out[field.key] = !!raw
    } else {
      out[field.key] = typeof raw === 'string' ? raw.trim() : raw
    }
  }
  return out
}

export function CatalogDetailPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const catalog = findCatalogBySlug(slug ?? '')
  const list = useCatalog(catalog?.type ?? 'leadSources')
  const create = useCreateCatalogItem(catalog?.type ?? 'leadSources')
  const update = useUpdateCatalogItem(catalog?.type ?? 'leadSources')
  const remove = useDeleteCatalogItem(catalog?.type ?? 'leadSources')

  const [form, setForm] = useState<FormMode>({ mode: 'closed' })
  const [draft, setDraft] = useState<Draft>({})
  /**
   * DnD: id do item sendo arrastado. Usado pelo handler de drop pra calcular
   * a nova ordem. null quando ninguém está arrastando.
   */
  const [draggedId, setDraggedId] = useState<string | null>(null)

  if (!catalog) return <Navigate to="/catalogs" replace />
  if (!catalog.ready) return <Navigate to="/catalogs" replace />

  /**
   * Catálogos com campo `order` ganham reordenação via drag-and-drop.
   * Esconde a coluna `order` da tabela (controlada pelo drag) e prepende
   * uma coluna com o handle de arrastar.
   */
  const hasOrderField = catalog.fields.some((f) => f.key === 'order')
  const tableColumns = catalog.fields
    .filter((f) => f.showInTable)
    .filter((f) => !(hasOrderField && f.key === 'order'))

  /** Items ordenados pela ordem persistida (estável). */
  const orderedItems = useMemo(() => {
    if (!list.data) return []
    if (!hasOrderField) return list.data
    return [...list.data].sort((a, b) => {
      const oa = typeof a.order === 'number' ? a.order : 9999
      const ob = typeof b.order === 'number' ? b.order : 9999
      return oa - ob
    })
  }, [list.data, hasOrderField])

  /**
   * Sprint H.4 — sort + filtro multi-select por coluna em CIMA do
   * `orderedItems`. Quando o user ativa sort por outra coluna ou filtra,
   * o drag-and-drop é desligado (não faz sentido reordenar uma view
   * filtrada/ordenada por outro critério). Quando volta pro estado
   * original (sem sort, sem filtro), DnD reativa.
   */
  const dataTableColumns = useMemo<DataTableColumn<CatalogItem>[]>(() => {
    return tableColumns.map((field) => {
      const col: DataTableColumn<CatalogItem> = {
        key: field.key,
        label: field.label,
        getValue: (row) => {
          const v = row[field.key]
          if (v == null) return ''
          if (typeof v === 'boolean') return v ? '1' : '0'
          if (typeof v === 'number') return v
          return String(v)
        },
      }
      if (field.kind === 'boolean') {
        col.formatValue = (v) =>
          v === '1' || v === true || v === 1
            ? t('catalogs.detail.yes')
            : v === '0' || v === false || v === 0 || v === '' || v == null
              ? t('catalogs.detail.no')
              : String(v)
      } else if (field.kind === 'catalogRef') {
        col.formatValue = (v) =>
          typeof v === 'string' && v ? v : t('catalogs.detail.empty')
      }
      return col
    })
  }, [tableColumns, t])

  const dt = useDataTable(orderedItems, dataTableColumns)
  const dndActive =
    hasOrderField &&
    dt.columnState.sortBy === null &&
    Object.keys(dt.columnState.filters).length === 0
  // Quando dnd está ativo, mostra TUDO sem paginar (drag entre páginas
  // seria confuso). Caso contrário pagina normalmente.
  const visibleItems = dndActive ? dt.rows : dt.paginatedRows

  /**
   * Reordena: pega o item arrastado, retira da lista, insere no índice
   * destino, e atualiza `order` (1-based) de TODOS via mutações paralelas.
   * Não é ótimo (N requests), mas catálogos têm dezenas de items no máximo —
   * e mantém a API simples. Quando virar gargalo, criar endpoint batch.
   */
  async function handleReorder(targetIndex: number) {
    if (!draggedId || !hasOrderField) return
    const fromIndex = orderedItems.findIndex((i) => i.id === draggedId)
    if (fromIndex < 0 || fromIndex === targetIndex) {
      setDraggedId(null)
      return
    }
    const next = [...orderedItems]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(targetIndex, 0, moved)
    setDraggedId(null)
    try {
      await Promise.all(
        next.map((item, i) =>
          // Só atualiza items cuja order mudou — evita request inútil
          item.order === i + 1
            ? Promise.resolve()
            : update.mutateAsync({ id: item.id, input: { order: i + 1 } }),
        ),
      )
      toastSaved(t('catalogs.detail.reordered'))
    } catch (err) {
      toastError(err)
    }
  }

  function openCreate() {
    if (!catalog) return
    setDraft(defaultDraftFor(catalog.fields))
    setForm({ mode: 'create' })
  }

  function openEdit(item: CatalogItem) {
    if (!catalog) return
    setDraft(draftFromItem(catalog.fields, item))
    setForm({ mode: 'edit', item })
  }

  async function handleSave() {
    if (!catalog) return
    // Validação client-side: bloqueia submit se algum campo obrigatório
    // estiver vazio (text/number/textarea). Booleans/checkboxes nunca
    // são "vazios". O backend também valida — mas pegar antes evita
    // criar items órfãos com nome vazio quando o user submete sem digitar.
    const missing: string[] = []
    for (const field of catalog.fields) {
      if (!field.required) continue
      const value = draft[field.key]
      const isEmpty =
        value == null ||
        (typeof value === 'string' && value.trim() === '') ||
        (typeof value === 'number' && Number.isNaN(value))
      if (isEmpty) missing.push(field.label)
    }
    if (missing.length > 0) {
      toastError(
        new Error(
          t('catalogs.detail.requiredMissing', {
            fields: missing.join(', '),
            defaultValue: `Campos obrigatórios em branco: ${missing.join(', ')}`,
          }),
        ),
      )
      return
    }
    const payload = serializeDraft(catalog.fields, draft)
    try {
      if (form.mode === 'create') {
        await create.mutateAsync(payload)
        toastSaved(t('catalogs.detail.createdToast'))
      } else if (form.mode === 'edit') {
        await update.mutateAsync({ id: form.item.id, input: payload })
        toastSaved(t('catalogs.detail.updatedToast'))
      }
      setForm({ mode: 'closed' })
      setDraft({})
    } catch (err) {
      toastError(err)
    }
  }

  async function handleDelete(item: CatalogItem) {
    const ok = await confirm({
      title: t('catalogs.detail.deleteTitle'),
      description: t('catalogs.detail.deleteDesc', {
        name: item.name ?? item.id,
      }),
      confirmLabel: t('catalogs.detail.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(item.id)
      toastDeleted()
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        to="/catalogs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('catalogs.detail.back')}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {catalog.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            {catalog.description}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!catalog) return
              const exportableFields = catalog.fields
              const rows = (list.data ?? []).map((item) => {
                const row: Record<string, string | number | boolean | null> = {
                  id: item.id,
                }
                for (const f of exportableFields) {
                  const v = item[f.key]
                  row[f.key] =
                    typeof v === 'string' ||
                    typeof v === 'number' ||
                    typeof v === 'boolean'
                      ? v
                      : v == null
                        ? null
                        : JSON.stringify(v)
                }
                return row
              })
              exportToCsv(
                rows,
                `${catalog.slug}-${new Date().toISOString().slice(0, 10)}`,
                [
                  { key: 'id', label: 'ID' },
                  ...exportableFields.map((f) => ({
                    key: f.key as keyof typeof rows[number],
                    label: f.label,
                  })),
                ],
              )
            }}
            disabled={!list.isSuccess || (list.data?.length ?? 0) === 0}
          >
            <Download className="h-4 w-4" />
            <span>{t('catalogs.detail.export')}</span>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span>{t('catalogs.detail.new')}</span>
          </Button>
        </div>
      </div>

      {list.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('catalogs.detail.loadError')}
          </AlertDescription>
        </Alert>
      )}

      {/* Active filters chip bar — aparece quando há filtros aplicados. */}
      <DataTableActiveFilters columns={dataTableColumns} state={dt} />

      {/* `overflow-visible` em vez de `hidden` pra deixar o popover do
          filtro multi-select (DataTableHeaderCell) escapar dos limites
          do Card. Antes ficava cortado e parecia que estava sendo
          empurrado pra dentro da célula. */}
      <Card className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Coluna do drag handle — só aparece em catálogos com `order`,
                  e só "ativa" (com cursor) quando não há sort/filtro
                  aplicado. Senão, a ordem visual do user é diferente da
                  ordem persistida e DnD seria confuso. */}
              {hasOrderField && <TableHead className="w-8" />}
              {dataTableColumns.map((col) => {
                const w = tableColumns.find((f) => f.key === col.key)?.width
                // Largura via Tailwind arbitrary value pra preservar o
                // `width` do registry. `w` chega tipo "8rem" ou "6rem".
                return (
                  <DataTableHeaderCell
                    key={col.key}
                    column={col}
                    state={dt}
                    className={w ? `w-[${w}]` : undefined}
                  />
                )
              })}
              <TableHead className="w-32 text-right">{t('catalogs.detail.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {hasOrderField && <TableCell />}
                  {tableColumns.map((field) => (
                    <TableCell key={field.key}>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Skeleton className="h-8 w-16" />
                  </TableCell>
                </TableRow>
              ))}
            {list.isSuccess && visibleItems.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={tableColumns.length + 1 + (hasOrderField ? 1 : 0)}
                  className="py-12"
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-3">
                      <Inbox className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {orderedItems.length === 0
                          ? t('catalogs.detail.empty')
                          : t('catalogs.detail.emptyFiltered', {
                              defaultValue: 'Nenhum item bate com os filtros.',
                            })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {orderedItems.length === 0
                          ? t('catalogs.detail.emptyHint')
                          : t('catalogs.detail.emptyFilteredHint', {
                              defaultValue: 'Limpe ou ajuste os filtros pra ver tudo.',
                            })}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {visibleItems.map((item, index) => {
              const isDragging = draggedId === item.id
              return (
                <TableRow
                  key={item.id}
                  draggable={dndActive}
                  onDragStart={(e) => {
                    if (!dndActive) return
                    setDraggedId(item.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    if (dndActive && draggedId && draggedId !== item.id) {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }
                  }}
                  onDrop={(e) => {
                    if (!dndActive) return
                    e.preventDefault()
                    handleReorder(index)
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  className={isDragging ? 'opacity-40' : undefined}
                >
                  {hasOrderField && (
                    <TableCell
                      className={cn(
                        'w-8',
                        dndActive
                          ? 'cursor-grab active:cursor-grabbing'
                          : 'cursor-default opacity-30',
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  )}
                  {tableColumns.map((field) => (
                    <TableCell key={field.key}>
                      <CellRenderer field={field} value={item[field.key]} />
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <IconTooltip label={t('catalogs.detail.edit')}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </IconTooltip>
                      <IconTooltip label={t('catalogs.detail.delete')}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item)}
                          disabled={remove.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </IconTooltip>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {!dndActive && <DataTablePagination state={dt} />}

      <Sheet
        open={form.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setForm({ mode: 'closed' })
        }}
      >
        <SheetContent className="sm:max-w-xl md:max-w-2xl">
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>
                {form.mode === 'create'
                  ? t('catalogs.detail.newItem')
                  : t('catalogs.detail.editItem')}
              </SheetTitle>
            </SheetHeader>
            <SheetBody>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Esconde o campo `order` do form quando o catálogo usa DnD —
                    a ordem agora vem do drag-and-drop, não da edição manual. */}
                {catalog.fields
                  .filter((f) => !(hasOrderField && f.key === 'order'))
                  .map((field) => (
                  <FieldEditor
                    key={field.key}
                    field={field}
                    value={draft[field.key]}
                    onChange={(v) => {
                      setDraft((d) => {
                        const next = { ...d, [field.key]: v }
                        // Auto-preenche a cor sugerida quando o admin
                        // escolhe a categoria do status — só se a cor
                        // ainda estiver vazia ou no valor default cinza
                        // pra não sobrescrever escolhas manuais.
                        if (
                          catalog.type === 'projectStatuses' &&
                          field.key === 'category' &&
                          typeof v === 'string' &&
                          v in STATUS_CATEGORY_DEFAULT_COLORS
                        ) {
                          const currentColor =
                            typeof d.color === 'string' ? d.color : ''
                          if (!currentColor || currentColor === '#6b7280') {
                            next.color =
                              STATUS_CATEGORY_DEFAULT_COLORS[
                                v as StatusCategory
                              ]
                          }
                        }
                        return next
                      })
                    }}
                    onCepLookup={async (cep) => {
                      const data = await fetchViaCep(cep)
                      if (!data) return
                      setDraft((d) => ({
                        ...d,
                        street: d.street || data.logradouro,
                        district: d.district || data.bairro,
                        city: d.city || data.localidade,
                        state: d.state || data.uf,
                        country: d.country || 'Brasil',
                      }))
                    }}
                  />
                ))}
              </div>
            </SheetBody>
            <SheetFooter>
              <Button
                variant="outline"
                onClick={() => setForm({ mode: 'closed' })}
              >
                {t('catalogs.detail.cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={create.isPending || update.isPending}
              >
                {create.isPending || update.isPending
                  ? t('catalogs.detail.saving')
                  : t('catalogs.detail.save')}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CellRenderer({
  field,
  value,
}: {
  field: CatalogFieldDef
  value: unknown
}) {
  const { t } = useTranslation()
  if (value == null || value === '') return <span>—</span>

  if (field.kind === 'color') {
    const color = String(value)
    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-4 w-4 rounded-full border border-border"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="font-mono text-xs">{color}</span>
      </div>
    )
  }

  if (field.kind === 'boolean') {
    return (
      <span>{value ? t('catalogs.detail.yes') : t('catalogs.detail.no')}</span>
    )
  }

  if (field.kind === 'catalogRef' && field.refCatalog) {
    return (
      <CatalogRefLabel refCatalog={field.refCatalog} value={String(value)} />
    )
  }

  if (field.kind === 'enum') {
    const opt = field.enumOptions?.find((o) => o.value === String(value ?? ''))
    if (opt) return <span>{opt.label}</span>
    if (!value) return <span className="text-muted-foreground">—</span>
    // Valor antigo que não está mais nas opções (ex: status migrado).
    return (
      <span className="text-muted-foreground" title="Valor não reconhecido">
        {String(value)}
      </span>
    )
  }

  return <span>{String(value)}</span>
}

/**
 * Renderiza o `name` do item referenciado em vez do `id` cru. Usado nas
 * colunas de tabela quando o campo é catalogRef.
 */
function CatalogRefLabel({
  refCatalog,
  value,
}: {
  refCatalog: CatalogType
  value: string
}) {
  const list = useCatalog(refCatalog)
  const item = (list.data ?? []).find((x) => x.id === value || x.name === value)
  if (!value) return <span>—</span>
  if (list.isLoading) return <span className="text-muted-foreground">…</span>
  if (!item) {
    // Valor obsoleto que não bate com nenhum item do catálogo.
    return (
      <span className="text-muted-foreground" title="ID não encontrado">
        {value}
      </span>
    )
  }
  return <span>{typeof item.name === 'string' ? item.name : item.id}</span>
}

function FieldEditor({
  field,
  value,
  onChange,
  onCepLookup,
}: {
  field: CatalogFieldDef
  value: DraftValue | undefined
  onChange: (value: DraftValue) => void
  onCepLookup?: (cep: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const id = `field-${field.key}`
  const stringValue =
    typeof value === 'string' ? value : value == null ? '' : String(value)
  const [cepLoading, setCepLoading] = useState(false)

  if (field.kind === 'boolean') {
    return (
      <div className="flex items-center gap-2 md:col-span-2">
        <Checkbox
          id={id}
          checked={!!value}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
          {field.label}
        </Label>
      </div>
    )
  }

  if (field.kind === 'color') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="color"
            value={stringValue || '#6b7280'}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
          />
          <Input
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="font-mono"
          />
        </div>
      </div>
    )
  }

  if (field.kind === 'catalogRef' && field.refCatalog) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <CatalogSelect
          id={id}
          refCatalog={field.refCatalog}
          value={stringValue}
          storeField={field.refStoreField}
          onChange={(v) => onChange(v)}
        />
      </div>
    )
  }

  if (field.kind === 'enum') {
    const options = field.enumOptions ?? []
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <Combobox
          id={id}
          options={options.map((o) => ({ value: o.value, label: o.label }))}
          value={stringValue}
          onChange={(v) => onChange(v)}
          noneLabel="—"
        />
        {field.placeholder && (
          <p className="text-[11px] text-muted-foreground">{field.placeholder}</p>
        )}
      </div>
    )
  }

  if (field.kind === 'cep') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            onBlur={async () => {
              const cep = normalizeCep(stringValue)
              if (!cep || !onCepLookup) return
              setCepLoading(true)
              try {
                await onCepLookup(cep)
              } finally {
                setCepLoading(false)
              }
            }}
            placeholder={field.placeholder ?? '00000-000'}
            inputMode="numeric"
            maxLength={9}
          />
          <span
            className="flex items-center gap-1 text-xs text-muted-foreground"
            title={t('catalogs.detail.cepHint')}
          >
            <MapPin className="h-3 w-3" />
            {cepLoading
              ? t('catalogs.detail.cepSearching')
              : t('catalogs.detail.cepAuto')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        type={field.kind === 'number' ? 'number' : 'text'}
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </div>
  )
}
