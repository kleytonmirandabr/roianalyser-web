/**
 * Entradas Dinâmicas (Sprint F.1 — flat entries vinculadas ao catálogo).
 *
 * Cada entry referencia um item do catálogo (`catalogItems`); categoria,
 * tipo financeiro e flags receita/custo herdam do item ao selecionar.
 * O usuário não digita texto livre nem escolhe cor manualmente.
 *
 * Filtros no topo (categoria / tipo financeiro / busca) afetam só a
 * exibição. Quando o filtro de categoria está ativo, o select de Item
 * em cada linha filtra a lista pra essa categoria.
 *
 * Edição inline com policies do item: `allowsQuantity`, `allowsDiscountPct`,
 * `allowsStartMonth`, `allowsDurationMonths`, `allowsInstallments` controlam
 * quais campos ficam editáveis.
 */

import { Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { useProject } from '@/features/projects/hooks/use-project'
import { useUpdateProject } from '@/features/projects/hooks/use-update-project'
import {
  applyCatalogItemToEntry,
  entryFromCatalogItem,
  entryNet,
  getFieldPolicy,
  makeDynamicEntry,
  readDynamicEntries,
  resolveEntryFlags,
  serializeDynamicEntries,
  type DynamicEntry,
  type DynamicEntryCatalogItem,
  type DynamicEntryFinancialType,
} from '@/features/projects/lib/dynamic-entries'
import { formatCurrency } from '@/features/projects/lib/money'
import type { ProjectPayload } from '@/features/projects/types'
import { cn } from '@/shared/lib/cn'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { Input } from '@/shared/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

export function ProjectEntradasView() {
  const { t, i18n } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)
  const update = useUpdateProject(params.id ?? '')
  const catalogItems = useCatalog('catalogItems')
  const itemCategories = useCatalog('itemCategories')
  const financialTypes = useCatalog('financialTypes')

  const [entries, setEntries] = useState<DynamicEntry[]>([])
  const [dirty, setDirty] = useState(false)
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterFinancialTypeId, setFilterFinancialTypeId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Carrega entries do payload (faz auto-migração de entryGroups[] legado).
  useEffect(() => {
    if (!project.data) return
    setEntries(
      readDynamicEntries(project.data.payload as Record<string, unknown> | null),
    )
    setDirty(false)
  }, [project.data])

  // Index dos catálogos pra render rápido.
  const itemsById = useMemo(() => {
    const map = new Map<string, DynamicEntryCatalogItem>()
    for (const raw of catalogItems.data ?? []) {
      const item = raw as DynamicEntryCatalogItem
      if (item.id) map.set(item.id, item)
    }
    return map
  }, [catalogItems.data])

  const categoryById = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const raw of itemCategories.data ?? []) {
      if (raw && typeof raw.id === 'string') {
        const name = typeof raw.name === 'string' ? raw.name : raw.id
        map.set(raw.id, { id: raw.id, name })
      }
    }
    return map
  }, [itemCategories.data])

  const financialTypeById = useMemo(() => {
    const map = new Map<string, DynamicEntryFinancialType>()
    for (const raw of financialTypes.data ?? []) {
      if (raw && typeof raw.id === 'string') {
        map.set(raw.id, {
          id: raw.id,
          name: typeof raw.name === 'string' ? raw.name : raw.id,
          affectsRevenue: raw.affectsRevenue === true,
          affectsCost: raw.affectsCost === true,
          affectsInvestment: raw.affectsInvestment === true,
        })
      }
    }
    return map
  }, [financialTypes.data])

  // Filtros sobre as entries.
  const visibleEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return entries.filter((e) => {
      if (filterCategoryId && e.categoryId !== filterCategoryId) return false
      if (
        filterFinancialTypeId &&
        e.financialTypeId !== filterFinancialTypeId
      ) {
        return false
      }
      if (q) {
        const hay = `${e.itemName} ${categoryById.get(e.categoryId)?.name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [entries, filterCategoryId, filterFinancialTypeId, searchQuery, categoryById])

  // Totais (sempre sobre TODAS as entries, não só as filtradas — é o
  // resumo financeiro do projeto, não da view). Sprint F.2: flags
  // resolvem via financialType (fonte da verdade) com fallback pro item.
  const totals = useMemo(() => {
    let revenue = 0
    let cost = 0
    let investment = 0
    let netFiltered = 0
    for (const e of entries) {
      const amount = entryNet(e)
      const ft = financialTypeById.get(e.financialTypeId) ?? null
      const ci = itemsById.get(e.itemId) ?? null
      const flags = resolveEntryFlags(e, ft, ci)
      if (flags.affectsRevenue) revenue += amount
      if (flags.affectsCost) cost += amount
      if (flags.affectsInvestment) investment += amount
    }
    for (const e of visibleEntries) netFiltered += entryNet(e)
    return { revenue, cost, investment, netFiltered }
  }, [entries, visibleEntries, financialTypeById, itemsById])

  // Lista de items disponíveis no select de cada linha. Quando filtro de
  // categoria está ativo, só mostra itens dessa categoria.
  function availableItemsForRow(rowCategoryId: string): DynamicEntryCatalogItem[] {
    const targetCategoryId = filterCategoryId || rowCategoryId || ''
    const all = (catalogItems.data ?? []) as DynamicEntryCatalogItem[]
    return all.filter((item) => {
      if (item.active === false) return false
      if (!targetCategoryId) return true
      return item.categoryId === targetCategoryId
    })
  }

  /* ─── Mutations locais ─── */
  function patchEntry(id: string, patch: Partial<DynamicEntry>) {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    setDirty(true)
  }

  function changeEntryItem(id: string, newItemId: string) {
    setEntries((es) =>
      es.map((entry) => {
        if (entry.id !== id) return entry
        if (!newItemId) {
          return { ...entry, itemId: '', itemName: '' }
        }
        const item = itemsById.get(newItemId)
        if (!item) return entry
        const ft = financialTypeById.get(item.financialTypeId ?? '') ?? null
        return applyCatalogItemToEntry(entry, item, ft)
      }),
    )
    setDirty(true)
  }

  function addEntry() {
    // Se há filtro de categoria ativo, herda categoria + tenta primeiro item.
    if (filterCategoryId) {
      const items = (catalogItems.data ?? []) as DynamicEntryCatalogItem[]
      const first = items.find(
        (it) => it.active !== false && it.categoryId === filterCategoryId,
      )
      if (first) {
        const ft = financialTypeById.get(first.financialTypeId ?? '') ?? null
        setEntries((es) => [...es, entryFromCatalogItem(first, undefined, ft)])
        setDirty(true)
        return
      }
    }
    // Senão, entry vazio (user vai escolher item no select).
    setEntries((es) => [...es, makeDynamicEntry()])
    setDirty(true)
  }

  function removeEntry(id: string) {
    setEntries((es) => es.filter((e) => e.id !== id))
    setDirty(true)
  }

  function clearFilters() {
    setFilterCategoryId('')
    setFilterFinancialTypeId('')
    setSearchQuery('')
  }

  /* ─── Save ─── */
  async function save() {
    if (!project.data) return
    const payload: ProjectPayload = {
      ...((project.data.payload as ProjectPayload) ?? {}),
      dynamicEntries: serializeDynamicEntries(entries),
    } as ProjectPayload
    try {
      await update.mutateAsync({ payload })
      toastSaved()
      setDirty(false)
    } catch (err) {
      toastError(err)
    }
  }

  if (!params.id) return null

  const filtersActive =
    !!filterCategoryId || !!filterFinancialTypeId || !!searchQuery
  const tenantCurrency = project.data?.currency ?? 'BRL'

  /* ─── Render ─── */
  return (
    <div className="space-y-4">
      {project.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.detail.loadError')}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('projects.detail.entries.dynamic.title')}</CardTitle>
          <CardDescription>
            {t('projects.detail.entries.dynamic.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('projects.detail.entries.dynamic.filterSearch')}
                  className="pl-9"
                />
              </div>
              <Combobox
                options={[...categoryById.values()].map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                value={filterCategoryId}
                onChange={setFilterCategoryId}
                noneLabel={t(
                  'projects.detail.entries.dynamic.filterAllCategories',
                )}
                placeholder={t('projects.detail.entries.dynamic.filterCategory')}
              />
              <Combobox
                options={[...financialTypeById.values()].map((f) => ({
                  value: f.id,
                  label: f.name ?? f.id,
                }))}
                value={filterFinancialTypeId}
                onChange={setFilterFinancialTypeId}
                noneLabel={t(
                  'projects.detail.entries.dynamic.filterAllFinancialTypes',
                )}
                placeholder={t(
                  'projects.detail.entries.dynamic.filterFinancialType',
                )}
              />
            </div>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
                {t('projects.detail.entries.dynamic.clearFilters')}
              </Button>
            )}
          </div>

          {/* KPIs de impacto financeiro */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiTile
              label={t('projects.detail.entries.dynamic.kpiRevenue')}
              value={formatCurrency(totals.revenue, tenantCurrency)}
              tone="emerald"
              locale={i18n.language}
            />
            <KpiTile
              label={t('projects.detail.entries.dynamic.kpiCost')}
              value={formatCurrency(totals.cost, tenantCurrency)}
              tone="amber"
              locale={i18n.language}
            />
            <KpiTile
              label={t('projects.detail.entries.dynamic.kpiInvestment')}
              value={formatCurrency(totals.investment, tenantCurrency)}
              tone="purple"
              locale={i18n.language}
            />
            <KpiTile
              label={t('projects.detail.entries.dynamic.kpiNetFiltered')}
              value={formatCurrency(totals.netFiltered, tenantCurrency)}
              tone="primary"
              locale={i18n.language}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {t('projects.detail.entries.dynamic.tableTitle', {
                count: visibleEntries.length,
              })}
            </CardTitle>
          </div>
          <Button onClick={addEntry} size="sm">
            <Plus className="h-4 w-4" />
            <span>{t('projects.detail.entries.dynamic.addEntry')}</span>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {visibleEntries.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {filtersActive
                ? t('projects.detail.entries.dynamic.emptyFiltered')
                : t('projects.detail.entries.dynamic.empty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Sprint H.2 — Categoria antes do Item: fluxo cognitivo
                        é "qual categoria? Qual item dela?". O chip de
                        categoria fica antes do select de item. */}
                    <TableHead>
                      {t('projects.detail.entries.dynamic.th.category')}
                    </TableHead>
                    <TableHead className="min-w-[200px]">
                      {t('projects.detail.entries.dynamic.th.item')}
                    </TableHead>
                    <TableHead>
                      {t('projects.detail.entries.dynamic.th.financialType')}
                    </TableHead>
                    <TableHead className="w-20">
                      {t('projects.detail.entries.dynamic.th.qty')}
                    </TableHead>
                    <TableHead className="w-32">
                      {t('projects.detail.entries.dynamic.th.unitValue')}
                    </TableHead>
                    <TableHead className="w-24">
                      {t('projects.detail.entries.dynamic.th.discount')}
                    </TableHead>
                    <TableHead className="w-20">
                      {t('projects.detail.entries.dynamic.th.start')}
                    </TableHead>
                    <TableHead className="w-24">
                      {t('projects.detail.entries.dynamic.th.duration')}
                    </TableHead>
                    <TableHead className="w-20">
                      {t('projects.detail.entries.dynamic.th.installments')}
                    </TableHead>
                    <TableHead className="w-32">
                      {t('projects.detail.entries.dynamic.th.impact')}
                    </TableHead>
                    <TableHead className="w-32 text-right">
                      {t('projects.detail.entries.dynamic.th.total')}
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEntries.map((entry) => (
                    <EntryRowView
                      key={entry.id}
                      entry={entry}
                      catalogItem={itemsById.get(entry.itemId) ?? null}
                      availableItems={availableItemsForRow(entry.categoryId)}
                      categoryName={
                        categoryById.get(entry.categoryId)?.name ?? '—'
                      }
                      financialTypeName={
                        financialTypeById.get(entry.financialTypeId)?.name ??
                        '—'
                      }
                      resolveCategoryName={(catId) =>
                        categoryById.get(catId)?.name ?? '—'
                      }
                      currency={tenantCurrency}
                      onPatch={(patch) => patchEntry(entry.id, patch)}
                      onChangeItem={(newId) => changeEntryItem(entry.id, newId)}
                      onRemove={() => removeEntry(entry.id)}
                      tDelete={t('catalogs.detail.delete')}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <span className="text-sm text-amber-600">
            {t('projects.detail.entries.dynamic.unsaved')}
          </span>
        )}
        <Button onClick={save} disabled={!dirty || update.isPending}>
          {update.isPending
            ? t('projects.detail.entries.dynamic.saving')
            : t('projects.detail.entries.dynamic.save')}
        </Button>
      </div>
    </div>
  )
}

/* ─── Linha da tabela ─── */
function EntryRowView({
  entry,
  catalogItem,
  availableItems,
  categoryName,
  financialTypeName,
  resolveCategoryName,
  currency,
  onPatch,
  onChangeItem,
  onRemove,
  tDelete,
}: {
  entry: DynamicEntry
  catalogItem: DynamicEntryCatalogItem | null
  availableItems: DynamicEntryCatalogItem[]
  categoryName: string
  financialTypeName: string
  /** Lookup pra resolver nome da categoria a partir do `categoryId` de cada
      item no Combobox — usado pra agrupar opções por categoria. */
  resolveCategoryName: (categoryId: string) => string
  currency: string
  onPatch: (patch: Partial<DynamicEntry>) => void
  onChangeItem: (newId: string) => void
  onRemove: () => void
  tDelete: string
}) {
  const policy = getFieldPolicy(catalogItem)
  const total = entryNet(entry)

  // Estado local pra inputs numéricos com debounce-on-blur (evita re-render
  // a cada keystroke; salva quando perde foco).
  const [unitValue, setUnitValue] = useState(entry.unitValue)
  const [quantity, setQuantity] = useState(entry.quantity)
  const [discountPct, setDiscountPct] = useState(entry.discountPct)
  const [startMonth, setStartMonth] = useState(entry.startMonth)
  const [durationMonths, setDurationMonths] = useState(entry.durationMonths)
  useEffect(() => setUnitValue(entry.unitValue), [entry.unitValue])
  useEffect(() => setQuantity(entry.quantity), [entry.quantity])
  useEffect(() => setDiscountPct(entry.discountPct), [entry.discountPct])
  useEffect(() => setStartMonth(entry.startMonth), [entry.startMonth])
  useEffect(() => setDurationMonths(entry.durationMonths), [entry.durationMonths])

  // Sprint H.5 — agrupa items do select por categoria. Catalog items
  // sem `categoryId` viram "—". Se todos cair no mesmo grupo (filtro
  // de categoria ativo), o Combobox renderiza só um cabeçalho — visual
  // OK e ainda informativo.
  const itemOptions = useMemo(() => {
    return availableItems.map((it) => ({
      value: it.id,
      label: `${it.name ?? it.id}${it.code ? ` · ${it.code}` : ''}`,
      group: resolveCategoryName(it.categoryId ?? ''),
    }))
  }, [availableItems, resolveCategoryName])

  return (
    <TableRow>
      {/* Sprint H.2 — Categoria primeiro: o usuário pensa "qual categoria?"
          antes de "qual item dela?". Tipo Fin. fica DEPOIS do item porque
          é derivado do item. */}
      <TableCell>
        <ChipReadonly text={categoryName} />
      </TableCell>
      <TableCell className="align-top">
        <Combobox
          options={itemOptions}
          value={entry.itemId}
          onChange={onChangeItem}
          placeholder={entry.itemName || 'Selecione um item…'}
        />
      </TableCell>
      <TableCell>
        <ChipReadonly text={financialTypeName} />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step={1}
          value={quantity}
          readOnly={!policy.quantity}
          onChange={(e) => setQuantity(Number(e.target.value) || 0)}
          onBlur={() => {
            if (quantity !== entry.quantity) onPatch({ quantity })
          }}
          className={cn('h-8 w-full', !policy.quantity && 'bg-muted/50')}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={unitValue}
          onChange={(e) => setUnitValue(Number(e.target.value) || 0)}
          onBlur={() => {
            if (unitValue !== entry.unitValue) onPatch({ unitValue })
          }}
          className="h-8 w-full"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={discountPct}
          readOnly={!policy.discountPct}
          onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
          onBlur={() => {
            if (discountPct !== entry.discountPct) onPatch({ discountPct })
          }}
          className={cn('h-8 w-full', !policy.discountPct && 'bg-muted/50')}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          step={1}
          value={startMonth}
          readOnly={!policy.startMonth}
          onChange={(e) => setStartMonth(Number(e.target.value) || 1)}
          onBlur={() => {
            if (startMonth !== entry.startMonth) onPatch({ startMonth })
          }}
          className={cn('h-8 w-full', !policy.startMonth && 'bg-muted/50')}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          step={1}
          value={durationMonths}
          readOnly={!policy.durationMonths}
          onChange={(e) => setDurationMonths(Number(e.target.value) || 1)}
          onBlur={() => {
            if (durationMonths !== entry.durationMonths) {
              onPatch({ durationMonths })
            }
          }}
          className={cn('h-8 w-full', !policy.durationMonths && 'bg-muted/50')}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          step={1}
          value={entry.installments}
          readOnly={!policy.installments}
          onChange={(e) =>
            onPatch({ installments: Math.max(1, Number(e.target.value) || 1) })
          }
          className={cn('h-8 w-full', !policy.installments && 'bg-muted/50')}
        />
      </TableCell>
      <TableCell>
        {/* Sprint H.5 — chip de "Impacto" mostra Receita / Custo /
            Investimento conforme flags do tipo financeiro (resolvidos
            pelo motor). Soma os ícones quando o item afeta mais de uma
            dimensão (raro, mas suportado). */}
        <ImpactChip entry={entry} />
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatCurrency(total, currency)}
      </TableCell>
      <TableCell>
        <IconTooltip label={tDelete}>
          <Button variant="ghost" size="icon" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </IconTooltip>
      </TableCell>
    </TableRow>
  )
}

/* ─── Subcomponents ─── */

/**
 * Chip de impacto financeiro da entry. Mostra "Receita", "Custo" e/ou
 * "Investimento" baseado nos flags resolvidos. Usa cor por tipo (verde
 * pra receita, âmbar pra custo, roxo pra investimento). Quando nenhum
 * flag tá ligado (item ainda não selecionado, ou tipo financeiro sem
 * config), mostra "—".
 */
function ImpactChip({ entry }: { entry: DynamicEntry }) {
  const labels: Array<{ text: string; tone: string }> = []
  if (entry.affectsRevenue)
    labels.push({ text: 'Receita', tone: 'bg-emerald-100 text-emerald-700' })
  if (entry.affectsCost)
    labels.push({ text: 'Custo', tone: 'bg-amber-100 text-amber-700' })
  if (entry.affectsInvestment)
    labels.push({ text: 'Investimento', tone: 'bg-purple-100 text-purple-700' })
  if (labels.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((l) => (
        <span
          key={l.text}
          className={cn(
            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            l.tone,
          )}
        >
          {l.text}
        </span>
      ))}
    </div>
  )
}

function ChipReadonly({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-xs">
      {text}
    </span>
  )
}

function KpiTile({
  label,
  value,
  tone,
  locale: _locale,
}: {
  label: string
  value: string
  tone: 'emerald' | 'amber' | 'purple' | 'primary'
  locale: string
}) {
  const toneClass = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    amber: 'text-amber-700 dark:text-amber-400',
    purple: 'text-purple-700 dark:text-purple-400',
    primary: 'text-foreground',
  }[tone]
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-base font-semibold tabular-nums', toneClass)}>
        {value}
      </p>
    </div>
  )
}
