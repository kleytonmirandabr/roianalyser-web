/** Admin → Itens do Catálogo (master only) — 25+ campos do motor financeiro. */
import { LayoutGrid, List, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCatalogItems, useCreateCatalogItem, useDeleteCatalogItem, useUpdateCatalogItem,
} from '@/features/catalog-items/hooks/use-catalog-items'
import type { CatalogItem } from '@/features/catalog-items/types'
import { useItemCategories } from '@/features/item-categories/hooks/use-item-categories'
import { useBillingUnits } from '@/features/billing-units/hooks/use-billing-units'
import { confirm } from '@/shared/ui/confirm-dialog'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Combobox } from '@/shared/ui/combobox'
import { CurrencyInput } from '@/shared/ui/currency-input'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  DataTableActiveFilters, DataTableHeaderCell, DataTablePagination,
  useDataTable, type DataTableColumn,
} from '@/shared/ui/data-table'
import { slugify } from '@/shared/lib/slugify'
import { formatCurrency } from '@/shared/lib/format'
import { AuditInfoFooter } from '@/shared/ui/audit-info-footer'
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { CsvExportButton } from '@/shared/ui/csv-export-button'

interface Draft {
  id?: string; key: string; name: string
  code: string; description: string; unit: string
  categoryId: string; billingUnitId: string
  comportamento: 'INCOME_ONE_TIME' | 'INCOME_MONTHLY' | 'INCOME_INSTALLMENT' | 'EXPENSE_ONE_TIME' | 'EXPENSE_MONTHLY' | 'EXPENSE_INSTALLMENT' | 'INVESTMENT_ONE_TIME' | 'INVESTMENT_INSTALLMENT'
  currency: string
  defaultValue: string
  defaultInstallments: string
  allowsQuantity: boolean; allowsDiscountPct: boolean
  displayOrder: number; active: boolean
}
const EMPTY: Draft = {
  key: '', name: '', code: '', description: '', unit: '',
  categoryId: '', billingUnitId: '',
  comportamento: 'EXPENSE_ONE_TIME',
  currency: 'BRL',
  defaultValue: '',
  defaultInstallments: '',
  allowsQuantity: false, allowsDiscountPct: false,
  displayOrder: 0, active: true,
}
function asStr(v: unknown): string { return v == null ? '' : String(v) }

const BEHAVIOR_KEYS = [
  'INCOME_ONE_TIME', 'INCOME_MONTHLY', 'INCOME_INSTALLMENT',
  'EXPENSE_ONE_TIME', 'EXPENSE_MONTHLY', 'EXPENSE_INSTALLMENT',
  'INVESTMENT_ONE_TIME', 'INVESTMENT_INSTALLMENT',
] as const

const CURRENCIES = [
  { value: 'BRL', label: 'BRL — Real Brasileiro (R$)' },
  { value: 'USD', label: 'USD — Dólar Americano ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'ARS', label: 'ARS — Peso Argentino' },
  { value: 'CLP', label: 'CLP — Peso Chileno' },
  { value: 'MXN', label: 'MXN — Peso Mexicano' },
  { value: 'GBP', label: 'GBP — Libra Esterlina (£)' },
]

type ViewMode = 'table' | 'cards'

export function AdminCatalogItemsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [view, setView] = useState<ViewMode>('table')
  const { data, isLoading } = useCatalogItems()
  const { data: categories = [] } = useItemCategories()
  const { data: billingUnits = [] } = useBillingUnits()
  const create = useCreateCatalogItem()
  const update = useUpdateCatalogItem(draft.id)
  const del = useDeleteCatalogItem()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />

  const items = (data ?? []) as CatalogItem[]
  const categoryById = useMemo(() => new Map(categories.map(c => [String(c.id), c.name])), [categories])
  const billingUnitById = useMemo(() => new Map(billingUnits.map(b => [String(b.id), b.name])), [billingUnits])

  const columns = useMemo<DataTableColumn<CatalogItem>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
    { key: 'code', label: 'Código', getValue: (r: any) => r.code ?? "" },
    { key: 'categoryId', label: 'Categoria', getValue: (r: any) => r.categoryId ? (categoryById.get(String(r.categoryId)) ?? "") : "" },
    { key: 'comportamento', label: 'Comportamento', getValue: (r: any) => t(`admin.catalogItems.behavior.${r.comportamento || 'EXPENSE_ONE_TIME'}`) },
    { key: 'billingUnitId', label: 'Unidade', getValue: (r: any) => r.billingUnitId ? (billingUnitById.get(String(r.billingUnitId)) ?? "") : "" },
    { key: 'currency', label: 'Moeda', getValue: (r: any) => String(r.currency || 'BRL') },
    { key: 'defaultValue', label: 'Valor', getValue: (r: any) => Number(r.defaultValue) || 0 },
  ], [categoryById, billingUnitById, t])
  const dt = useDataTable(items, columns)

  function openCreate() { setDraft(EMPTY); setOpen(true) }
  function openEdit(c: CatalogItem) {
    const o = c as unknown as Record<string, unknown>
    setDraft({
      id: String(o.id),
      key: asStr(o.key),
      name: asStr(o.name),
      code: asStr(o.code),
      description: asStr(o.description),
      unit: asStr(o.unit),
      categoryId: asStr(o.categoryId),
      billingUnitId: asStr(o.billingUnitId),
      comportamento: (asStr(o.comportamento) || 'EXPENSE_ONE_TIME') as Draft['comportamento'],
      currency: (asStr(o.currency) || 'BRL').toUpperCase(),
      defaultValue: asStr(o.defaultValue),
      defaultInstallments: asStr(o.defaultInstallments),
      allowsQuantity: !!o.allowsQuantity,
      allowsDiscountPct: !!o.allowsDiscountPct,
      displayOrder: Number(o.displayOrder ?? 0),
      active: o.active !== false,
      createdAt: (o.createdAt as string) || null,
      updatedAt: (o.updatedAt as string) || null,
    } as any)
    setOpen(true)
  }
  async function handleDelete(c: CatalogItem) {
    const ok = await confirm({ title: `Excluir "${c.name}"?`, destructive: true })
    if (!ok) return
    try { await del.mutateAsync(c.id); toastDeleted('Item removido') } catch (e) { toastError(e) }
  }
  async function handleSave() {
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
    if (!draft.categoryId) return toastError(new Error('Selecione a categoria'))
    if (!draft.billingUnitId) return toastError(new Error('Selecione a unidade de cobrança'))
    if (!draft.currency || draft.currency.length !== 3) return toastError(new Error('Selecione a moeda'))
    if (draft.defaultValue === '' || !Number.isFinite(Number(draft.defaultValue)) || Number(draft.defaultValue) < 0) {
      return toastError(new Error('Informe um valor padrão válido (>= 0)'))
    }
    const payload = {
      key: (draft.key.trim() || slugify(draft.name)),
      name: draft.name.trim(),
      code: draft.code.trim() || null,
      description: draft.description.trim() || null,
      unit: draft.unit.trim() || null,
      categoryId: draft.categoryId || null,
      billingUnitId: draft.billingUnitId || null,
      comportamento: draft.comportamento,
      currency: draft.currency,
      defaultValue: draft.defaultValue !== '' ? Number(draft.defaultValue) : null,
      defaultInstallments: draft.defaultInstallments !== '' ? Number(draft.defaultInstallments) : null,
      allowsQuantity: draft.allowsQuantity,
      allowsDiscountPct: draft.allowsDiscountPct,
      displayOrder: draft.displayOrder,
      active: draft.active,
    }
    try {
      if (draft.id) await update.mutateAsync({ name: draft.name.trim(), ...payload })
      else await create.mutateAsync({ key: (draft.key.trim() || slugify(draft.name)), name: draft.name.trim(), ...payload })
      toastSaved('Item salvo'); setOpen(false)
    } catch (e) { toastError(e) }
  }

  const catOptions = categories.filter(c => c.active).map(c => ({ value: c.id, label: c.name }))
  const buOptions = billingUnits.filter(c => c.active).map(c => ({ value: c.id, label: c.name }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.adminCatalogItems')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.catalogItems.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle view Tabela ↔ Cards */}
          <div className="inline-flex rounded-md border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${view === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
              title={t('admin.catalogItems.viewTable', 'Visualizar como tabela')}
            >
              <List className="h-3.5 w-3.5" />{t('admin.catalogItems.viewTableLabel', 'Tabela')}
            </button>
            <button
              type="button"
              onClick={() => setView('cards')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${view === 'cards' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
              title={t('admin.catalogItems.viewCards', 'Visualizar como cards')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />{t('admin.catalogItems.viewCardsLabel', 'Cards')}
            </button>
          </div>
          <CsvExportButton
            filename="itens-catalogo"
            rows={(dt.rows as any[])}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => (r as any).id },
              { key: 'name', label: 'Nome', getValue: (r) => (r as any).name },
              { key: 'currency', label: 'Moeda', getValue: (r) => (r as any).currency ?? 'BRL' },
              { key: 'defaultValue', label: 'Valor padrão', getValue: (r) => (r as any).defaultValue },
              { key: 'itemCategoryName', label: 'Categoria', getValue: (r) => (r as any).itemCategoryName ?? "" },
              { key: 'active', label: 'Ativo', getValue: (r) => (r as any).active !== false },
              { key: 'createdAt', label: 'Criado em', getValue: (r) => (r as any).createdAt },
              { key: 'updatedAt', label: 'Atualizado em', getValue: (r) => (r as any).updatedAt },
            ]}
          />
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> {t('admin.catalogItems.newButton')}</Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t('common.empty.item')}</div>
        ) : view === 'table' ? (
          <>
            <DataTableActiveFilters state={dt} columns={columns} />
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <DataTableHeaderCell key={col.key} column={col} state={dt} />
                  ))}
                  <TableHead className="w-32 text-center">{t('common.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dt.paginatedRows.map((i) => {
                  const o = i as unknown as Record<string, unknown>
                  const cur = String(o.currency || 'BRL').toUpperCase()
                  const dv = Number(o.defaultValue) || 0
                  return (
                    <TableRow key={String(o.id)}>
                      <TableCell className="font-medium">{String(o.name)}</TableCell>
                      <TableCell className="text-xs"><code className="text-xs bg-muted/50 px-1 rounded">{asStr(o.code) || '—'}</code></TableCell>
                      <TableCell className="text-xs">{o.categoryId ? (categoryById.get(String(o.categoryId)) || '—') : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs"><BehaviorBadge c={asStr(o.comportamento) || 'EXPENSE_ONE_TIME'} /></TableCell>
                      <TableCell className="text-xs">{o.billingUnitId ? (billingUnitById.get(String(o.billingUnitId)) || '—') : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs"><code className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded">{cur}</code></TableCell>
                      <TableCell className="text-xs text-right tabular-nums font-medium">{formatCurrency(dv, cur)}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(i)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <DataTablePagination state={dt} />
          </>
        ) : (
          /* ─────────── Cards View ─────────── */
          <div className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((i) => {
                const o = i as unknown as Record<string, unknown>
                const cur = String(o.currency || 'BRL').toUpperCase()
                const dv = Number(o.defaultValue) || 0
                const code = asStr(o.code)
                const catName = o.categoryId ? (categoryById.get(String(o.categoryId)) || '—') : null
                const buName = o.billingUnitId ? (billingUnitById.get(String(o.billingUnitId)) || '—') : null
                const comp = asStr(o.comportamento) || 'EXPENSE_ONE_TIME'
                const isInactive = o.active === false
                return (
                  <div key={String(o.id)} className={`rounded-lg border bg-card p-3 hover:shadow-sm transition ${isInactive ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{String(o.name)}</div>
                        {code && <code className="text-[10px] bg-muted/50 px-1 rounded inline-block mt-0.5">{code}</code>}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(i)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(i)}>
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {catName && <div className="text-[11px] text-muted-foreground">{catName}{buName ? ` · ${buName}` : ''}</div>}
                      <div><BehaviorBadge c={comp} /></div>
                    </div>
                    <div className="mt-3 pt-2 border-t flex items-baseline justify-between">
                      <span className="text-[10px] text-muted-foreground">{t('common.fields.defaultValue')}</span>
                      <span className="tabular-nums font-semibold">{formatCurrency(dv, cur)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-2xl">
          <SheetHeader><SheetTitle>{draft.id ? t('admin.catalogItems.titleEdit') : t('admin.catalogItems.titleNew')}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2"><Label><span>{t('common.fields.name')} *</span></Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.code')}</Label>
                <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
              </div>
              <div className="space-y-1 col-span-2"><Label>{t('common.fields.description')}</Label>
                <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.category')} <span className="text-destructive">*</span></Label>
                <Combobox options={catOptions} value={draft.categoryId} onChange={(v) => setDraft({ ...draft, categoryId: v })} />
              </div>
              <div className="space-y-1"><Label>{t('admin.catalogItems.billingUnit')} <span className="text-destructive">*</span></Label>
                <Combobox options={buOptions} value={draft.billingUnitId} onChange={(v) => setDraft({ ...draft, billingUnitId: v })} />
              </div>
              <div className="space-y-1 col-span-2"><Label>{t('admin.catalogItems.behaviorLabel')}</Label>
                <Combobox
                  options={BEHAVIOR_KEYS.map(b => ({ value: b, label: t(`admin.catalogItems.behavior.${b}`) }))}
                  value={draft.comportamento}
                  onChange={(v) => setDraft({ ...draft, comportamento: (v as Draft['comportamento']) || 'EXPENSE_ONE_TIME' })}
                />
                <p className="text-[11px] text-muted-foreground">{t('admin.catalogItems.behaviorHelp')}</p>
              </div>
              <div className="space-y-1"><Label>{t('common.fields.currency', 'Moeda')} <span className="text-destructive">*</span></Label>
                <Combobox
                  options={CURRENCIES}
                  value={draft.currency}
                  onChange={(v) => setDraft({ ...draft, currency: (v || 'BRL').toUpperCase() })}
                />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.defaultValue')} <span className="text-destructive">*</span></Label>
                <CurrencyInput
                  value={draft.defaultValue !== '' ? Number(draft.defaultValue) : null}
                  currency={draft.currency || 'BRL'}
                  onChange={(n) => setDraft({ ...draft, defaultValue: n != null ? String(n) : '' })}
                />
              </div>
              {draft.comportamento.endsWith('_INSTALLMENT') && (
              <div className="space-y-1 col-span-2"><Label>{t('common.fields.defaultInstallments')}</Label>
                <Input type="number" value={draft.defaultInstallments} onChange={(e) => setDraft({ ...draft, defaultInstallments: e.target.value })} />
              </div>)}
              <div className="col-span-2 grid grid-cols-3 gap-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Checkbox checked={draft.allowsQuantity} onCheckedChange={(c) => setDraft({ ...draft, allowsQuantity: c === true })} />
                  <Label>{t('admin.catalogItems.allowsQty')}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={draft.allowsDiscountPct} onCheckedChange={(c) => setDraft({ ...draft, allowsDiscountPct: c === true })} />
                  <Label>{t('admin.catalogItems.allowsDiscount')}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={draft.active} onCheckedChange={(c) => setDraft({ ...draft, active: c === true })} />
                  <Label>{t('common.fields.active')}</Label>
                </div>
              </div>
            </div>
            {draft.id && (
              <AuditInfoFooter
                createdAt={(draft as any).createdAt}
                updatedAt={(draft as any).updatedAt}
              />
            )}
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.actions.cancel')}</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              <Save className="h-4 w-4 mr-2" /> {t('common.actions.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function BehaviorBadge({ c }: { c: string }) {
  const { t } = useTranslation()
  const isIncome     = c.startsWith('INCOME_')
  const isInvestment = c.startsWith('INVESTMENT_')
  const tone = isIncome
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
    : isInvestment
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {t(`admin.catalogItems.behavior.${c}`)}
    </span>
  )
}
