/** Admin → Itens do Catálogo (master only) — 25+ campos do motor financeiro. */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
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
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  DataTableActiveFilters, DataTableHeaderCell, DataTablePagination,
  useDataTable, type DataTableColumn,
} from '@/shared/ui/data-table'
import { slugify } from '@/shared/lib/slugify'
import { AuditInfoFooter } from '@/shared/ui/audit-info-footer'
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { CsvExportButton } from '@/shared/ui/csv-export-button'
interface Draft {
  id?: string; key: string; name: string
  code: string; description: string; unit: string
  categoryId: string; billingUnitId: string
  comportamento: 'INCOME_ONE_TIME' | 'INCOME_MONTHLY' | 'INCOME_INSTALLMENT' | 'EXPENSE_ONE_TIME' | 'EXPENSE_MONTHLY' | 'EXPENSE_INSTALLMENT'
  defaultValue: string
  defaultInstallments: string
  allowsQuantity: boolean; allowsDiscountPct: boolean
  displayOrder: number; active: boolean
}
const EMPTY: Draft = {
  key: '', name: '', code: '', description: '', unit: '',
  categoryId: '', billingUnitId: '',
  comportamento: 'EXPENSE_ONE_TIME',
  defaultValue: '',
  defaultInstallments: '',
  allowsQuantity: false, allowsDiscountPct: false,
  displayOrder: 0, active: true,
}
function asStr(v: unknown): string { return v == null ? '' : String(v) }

export function AdminCatalogItemsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useCatalogItems()
  const { data: categories = [] } = useItemCategories()
  const { data: billingUnits = [] } = useBillingUnits()
  const create = useCreateCatalogItem()
  const update = useUpdateCatalogItem(draft.id)
  const del = useDeleteCatalogItem()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />

  const items = (data ?? []) as CatalogItem[]
  const columns = useMemo<DataTableColumn<CatalogItem>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
    { key: 'code', label: 'Código', getValue: (r: any) => r.code ?? "" },
    { key: 'categoryId', label: 'Categoria', getValue: (r: any) => r.categoryId ? (categoryById.get(String(r.categoryId)) ?? "") : "" },
    { key: 'unit', label: 'Unidade', getValue: (r: any) => r.unit ?? "" },
  ], [])
  const dt = useDataTable(items, columns)
  const categoryById = new Map(categories.map(c => [String(c.id), c.name]))

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
    const payload = {
      key: (draft.key.trim() || slugify(draft.name)),
      name: draft.name.trim(),
      code: draft.code.trim() || null,
      description: draft.description.trim() || null,
      unit: draft.unit.trim() || null,
      categoryId: draft.categoryId || null,
      billingUnitId: draft.billingUnitId || null,
      comportamento: draft.comportamento,
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

  const catOptions = [{ value: '', label: '— sem categoria —' }, ...categories.filter(c => c.active).map(c => ({ value: c.id, label: c.name }))]
  const buOptions = [{ value: '', label: '— sem unidade —' }, ...billingUnits.filter(c => c.active).map(c => ({ value: c.id, label: c.name }))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.adminCatalogItems')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.catalogItems.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvExportButton
            filename="itens-catalogo"
            rows={(dt.rows as any[])}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => (r as any).id },
              { key: 'name', label: 'Nome', getValue: (r) => (r as any).name },
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
        ) : (
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
                  return (
                    <TableRow key={String(o.id)}>
                      <TableCell className="font-medium">{String(o.name)}</TableCell>
                      <TableCell className="text-xs"><code className="text-xs bg-muted/50 px-1 rounded">{asStr(o.code) || '—'}</code></TableCell>
                      <TableCell className="text-xs">{o.categoryId ? (categoryById.get(String(o.categoryId)) || '—') : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">{asStr(o.unit) || <span className="text-muted-foreground">—</span>}</TableCell>
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
              <div className="space-y-1"><Label>{t('common.fields.unit')}</Label>
                <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="unid, mês, hora" />
              </div>
              <div className="space-y-1 col-span-2"><Label>{t('common.fields.description')}</Label>
                <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.category')}</Label>
                <Combobox options={catOptions} value={draft.categoryId} onChange={(v) => setDraft({ ...draft, categoryId: v })} />
              </div>
              <div className="space-y-1"><Label>Unidade de Cobrança</Label>
                <Combobox options={buOptions} value={draft.billingUnitId} onChange={(v) => setDraft({ ...draft, billingUnitId: v })} />
              </div>
              <div className="space-y-1 col-span-2"><Label>Comportamento *</Label>
                <Combobox
                  options={[
                    { value: 'INCOME_ONE_TIME',     label: 'Receita Pontual' },
                    { value: 'INCOME_MONTHLY',      label: 'Receita Mensal Recorrente' },
                    { value: 'INCOME_INSTALLMENT',  label: 'Receita Parcelada' },
                    { value: 'EXPENSE_ONE_TIME',    label: 'Custo Pontual' },
                    { value: 'EXPENSE_MONTHLY',     label: 'Custo Mensal Recorrente' },
                    { value: 'EXPENSE_INSTALLMENT', label: 'Custo Parcelado' },
                  ]}
                  value={draft.comportamento}
                  onChange={(v) => setDraft({ ...draft, comportamento: (v as Draft['comportamento']) || 'EXPENSE_ONE_TIME' })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Receita = soma no fluxo (verde); Custo = subtrai (vermelho).
                  Pontual = mês único; Mensal = todo mês até fim do contrato; Parcelado = N parcelas iguais.
                </p>
              </div>
              <div className="space-y-1"><Label>{t('common.fields.defaultValue')}</Label>
                <Input type="number" step="0.01" value={draft.defaultValue} onChange={(e) => setDraft({ ...draft, defaultValue: e.target.value })} />
              </div>
              {draft.comportamento.endsWith('_INSTALLMENT') && (
              <div className="space-y-1"><Label>{t('common.fields.defaultInstallments')}</Label>
                <Input type="number" value={draft.defaultInstallments} onChange={(e) => setDraft({ ...draft, defaultInstallments: e.target.value })} />
              </div>)}
              <div className="col-span-2 grid grid-cols-3 gap-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Checkbox checked={draft.allowsQuantity} onCheckedChange={(c) => setDraft({ ...draft, allowsQuantity: c === true })} />
                  <Label>Permite qtd.</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={draft.allowsDiscountPct} onCheckedChange={(c) => setDraft({ ...draft, allowsDiscountPct: c === true })} />
                  <Label>Permite desconto %</Label>
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
