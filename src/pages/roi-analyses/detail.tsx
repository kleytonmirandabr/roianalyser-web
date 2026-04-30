/**
 * Detalhe de ROI Analysis (Sprint #237 — UI de entrada modelada).
 *
 * Modelo: usuário lança item-a-item escolhendo Categoria → Item do catálogo.
 * Item carrega o comportamento (INCOME/EXPENSE/INVESTMENT × ONE_TIME/MONTHLY/INSTALLMENT).
 * Quantidade × Valor unitário × (1 - desconto%) define o fluxo. Mês de início
 * e parcelas (se INSTALLMENT) controlam a expansão temporal — feita no backend.
 *
 * O ROI herda durationMonths e currency da Oportunidade pai (não duplica).
 */

import { ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, Wallet, BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  useAddRoiEntry, useDeleteRoiEntry,
} from '@/features/roi-analyses/hooks/use-roi-entries'
import { useRoiAnalysis } from '@/features/roi-analyses/hooks/use-roi-analysis'
import { useUpdateRoiAnalysis } from '@/features/roi-analyses/hooks/use-update-roi'
import {
  COMPORTAMENTOS, ROI_STATUSES, ROI_STATUS_LABELS,
  familyOf, suffixOf,
  type Comportamento, type RoiStatus, type RoiEntry,
} from '@/features/roi-analyses/types'
import { useItemCategories } from '@/features/item-categories/hooks/use-item-categories'
import { useCatalogItems } from '@/features/catalog-items/hooks/use-catalog-items'
import { formatCurrency, formatPercent } from '@/shared/lib/format'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { CustomFieldsCard } from '@/features/form-fields/components/custom-fields-card'

type Draft = {
  categoryId: string
  catalogItemId: string
  comportamento: Comportamento
  quantity: string
  unitValue: string
  discountPct: string
  startMonth: string
  installments: string
  description: string
}

const EMPTY_DRAFT: Draft = {
  categoryId: '',
  catalogItemId: '',
  comportamento: 'EXPENSE_ONE_TIME',
  quantity: '1',
  unitValue: '',
  discountPct: '0',
  startMonth: '1',
  installments: '12',
  description: '',
}

export function RoiAnalysisDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useRoiAnalysis(id)
  const update = useUpdateRoiAnalysis(id)
  const addEntry = useAddRoiEntry(id)
  const deleteEntry = useDeleteRoiEntry(id)

  // Catálogos do tenant — usados nos comboboxes do form
  const categoriesQ = useItemCategories()
  const itemsQ = useCatalogItems()

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)

  const roi = data?.item
  const entries: RoiEntry[] = data?.entries || []
  const metrics = data?.metrics
  const isFrozen = roi?.status === 'approved' || roi?.status === 'archived'

  const categories = (categoriesQ.data || []).filter((c: any) => !c.deletedAt && c.active !== false)
  const items = (itemsQ.data || []).filter((c: any) => !c.deletedAt)

  const itemsForCategory = useMemo(() => {
    if (!draft.categoryId) return [] as any[]
    return items.filter((i: any) => String(i.categoryId) === String(draft.categoryId))
  }, [items, draft.categoryId])

  const selectedItem = useMemo(
    () => items.find((i: any) => String(i.id) === String(draft.catalogItemId)),
    [items, draft.catalogItemId],
  )

  const categoryOptions = categories.map((c: any) => ({ value: String(c.id), label: String(c.name) }))
  const itemOptions = itemsForCategory.map((i: any) => ({ value: String(i.id), label: `${i.code ? i.code + ' · ' : ''}${i.name}` }))
  const comportamentoOptions = COMPORTAMENTOS.map(c => ({
    value: c,
    label: t(`admin.catalogItems.behavior.${c}`),
  }))
  const statusOptions = ROI_STATUSES.map(s => ({ value: s, label: ROI_STATUS_LABELS[s] }))

  /* ──────────────────────────── Handlers ──────────────────────────── */

  function handleCategoryChange(catId: string) {
    setDraft(d => ({ ...d, categoryId: catId, catalogItemId: '' }))
  }

  function handleItemChange(itemId: string) {
    const it: any = items.find((x: any) => String(x.id) === String(itemId))
    setDraft(d => ({
      ...d,
      catalogItemId: itemId,
      // Auto-preenche comportamento + valor unitário do item se disponíveis
      comportamento: (it?.comportamento as Comportamento) || d.comportamento,
      unitValue: it?.unitPrice != null ? String(it.unitPrice) : d.unitValue,
      description: it?.name ? String(it.name) : d.description,
    }))
  }

  async function handleStatusChange(newStatus: RoiStatus) {
    if (!roi) return
    try {
      await update.mutateAsync({ status: newStatus })
      toastSaved(newStatus === 'approved'
        ? t('roiAnalyses.toast.approved', 'ROI aprovado — destrava criação de contrato')
        : `Status: ${ROI_STATUS_LABELS[newStatus]}`)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleAddEntry() {
    if (!roi) return
    if (!draft.catalogItemId) return toastError(t('roiAnalyses.entry.itemRequired', 'Selecione um item do catálogo'))
    const qty = Number(draft.quantity)
    const unit = Number(draft.unitValue)
    if (!Number.isFinite(qty) || qty <= 0) return toastError(t('roiAnalyses.entry.qtyInvalid', 'Quantidade precisa ser positiva'))
    if (!Number.isFinite(unit) || unit <= 0) return toastError(t('roiAnalyses.entry.unitInvalid', 'Valor unitário precisa ser positivo'))
    const isInstallment = suffixOf(draft.comportamento) === 'INSTALLMENT'
    const installments = isInstallment ? Number(draft.installments) : null
    if (isInstallment && (!Number.isInteger(installments) || (installments as number) < 1)) {
      return toastError(t('roiAnalyses.entry.installmentsInvalid', 'Parcelas precisa ser inteiro >= 1'))
    }
    try {
      await addEntry.mutateAsync({
        catalogItemId: draft.catalogItemId,
        categoryId: draft.categoryId || null,
        comportamento: draft.comportamento,
        quantity: qty,
        unitValue: unit,
        discountPct: Number(draft.discountPct) || 0,
        startMonth: Number(draft.startMonth) || 1,
        installments,
        description: draft.description || null,
      })
      // Reseta mantendo categoria/comportamento pra acelerar lançamentos seguidos
      setDraft(d => ({
        ...EMPTY_DRAFT,
        categoryId: d.categoryId,
        comportamento: d.comportamento,
        startMonth: d.startMonth,
      }))
      toastSaved(t('roiAnalyses.entry.added', 'Item adicionado'))
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleDeleteEntry(entryId: string) {
    try {
      await deleteEntry.mutateAsync(entryId)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  /* ──────────────────────────── Live preview ──────────────────────────── */

  const previewLine = useMemo(() => {
    const qty = Number(draft.quantity) || 0
    const unit = Number(draft.unitValue) || 0
    const disc = Number(draft.discountPct) || 0
    const gross = qty * unit
    const net = gross * (1 - disc / 100)
    const fam = familyOf(draft.comportamento)
    const suf = suffixOf(draft.comportamento)
    const dur = Number(roi?.durationMonths) || 12
    let totalImpact = net
    let occurrences = 1
    if (suf === 'MONTHLY') {
      const start = Math.max(1, Number(draft.startMonth) || 1)
      occurrences = Math.max(0, dur - start + 1)
      totalImpact = net * occurrences
    } else if (suf === 'INSTALLMENT') {
      occurrences = Math.max(1, Number(draft.installments) || 1)
      // total NÃO multiplica — net é o total que vai ser dividido em N parcelas
      totalImpact = net
    }
    return { gross, net, totalImpact, occurrences, fam, suf }
  }, [draft, roi?.durationMonths])

  /* ──────────────────────────── Loading/error ──────────────────────────── */

  if (isLoading) return <div className="space-y-4 p-6"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-64 w-full" /></div>
  if (error) return <div className="p-6"><Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert></div>
  if (!roi) return <div className="p-6"><Alert><AlertDescription>{t('roiAnalyses.notFound', 'ROI Analysis não encontrado.')}</AlertDescription></Alert></div>

  const cur = roi.currency || 'BRL'
  const totalRevenue = metrics?.totalRevenue ?? roi.totalRevenue ?? 0
  const totalCost = metrics?.totalCost ?? roi.totalCost ?? 0
  const totalInvestment = metrics?.totalInvestment ?? 0
  const netValue = metrics?.netValue ?? roi.netValue ?? 0
  const npv = metrics?.npv ?? roi.npv ?? 0
  const irr = metrics?.irr ?? roi.irr ?? null
  const paybackMonths = metrics?.paybackMonths ?? roi.paybackMonths ?? null

  // Agrupa entries por categoria pra renderizar a lista
  const groups = new Map<string, { name: string; entries: RoiEntry[]; total: number }>()
  for (const e of entries) {
    const catId = e.categoryId || 'none'
    const catName = e.categoryId
      ? (categories.find((c: any) => String(c.id) === String(e.categoryId))?.name || `Categoria #${e.categoryId}`)
      : (e.categoryKey || t('common.uncategorized', 'Sem categoria'))
    const g = groups.get(String(catId)) || { name: String(catName), entries: [], total: 0 }
    g.entries.push(e)
    const qty = Number(e.quantity) || 0
    const unit = Number(e.unitValue) || 0
    const disc = Number(e.discountPct) || 0
    const net = qty * unit * (1 - disc / 100)
    const suf = suffixOf(e.comportamento)
    const dur = Number(roi.durationMonths) || 12
    const start = Math.max(1, Number(e.startMonth) || 1)
    let total = net
    if (suf === 'MONTHLY') total = net * Math.max(0, dur - start + 1)
    g.total += total
    groups.set(String(catId), g)
  }
  const groupList = Array.from(groups.entries())
    .map(([catId, g]) => ({ catId, ...g }))
    .sort((a, b) => b.total - a.total)

  /* ──────────────────────────── Render ──────────────────────────── */

  return (
    <div className="space-y-6 p-6 max-w-6xl">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/opportunities/${roi.opportunityId}`}>
            <ArrowLeft className="h-4 w-4" />{t('common.entity.opportunity')}
          </Link>
        </Button>
      </header>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            <span className="font-mono text-base text-muted-foreground mr-2">v{roi.version}</span>
            {roi.name}
            {roi.isBaseline && <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">baseline</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('common.fields.createdAt', 'Criado')} {new Date(roi.createdAt).toLocaleDateString('pt-BR')}
            {roi.approvedAt && ` · ${t('roiAnalyses.status.approved', 'Aprovado')} ${new Date(roi.approvedAt).toLocaleDateString('pt-BR')}`}
            {roi.durationMonths != null && ` · ${roi.durationMonths} ${t('common.fields.months', 'meses')}`}
            {' · ' + cur}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <div className="w-44">
            <Combobox value={roi.status} onChange={v => handleStatusChange(v as RoiStatus)} options={statusOptions} />
          </div>
        </div>
      </div>

      {isFrozen && (
        <Alert>
          <AlertDescription>
            {roi.status === 'approved'
              ? t('roiAnalyses.frozen.approved', 'ROI aprovado — entries imutáveis. Contrato pode ser criado a partir desta análise.')
              : t('roiAnalyses.frozen.archived', 'ROI arquivado — entries imutáveis.')}
          </AlertDescription>
        </Alert>
      )}

      {/* ─────────── 5 KPIs ─────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} label={t('common.fields.totalRevenue')} value={formatCurrency(totalRevenue, cur)} tone="emerald" />
        <KpiCard icon={<TrendingDown className="h-4 w-4 text-rose-600" />} label={t('common.fields.totalCost')} value={formatCurrency(totalCost, cur)} tone="rose" />
        <KpiCard icon={<Wallet className="h-4 w-4 text-blue-600" />} label={t('roiAnalyses.kpi.investment', 'Investimento')} value={formatCurrency(totalInvestment, cur)} tone="blue" />
        <KpiCard icon={<BarChart3 className="h-4 w-4" />} label={t('common.fields.netValue')} value={formatCurrency(netValue, cur)} tone={netValue >= 0 ? 'emerald' : 'rose'} />
        <Card className="p-4">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">NPV</span><span className="tabular-nums font-medium">{formatCurrency(npv, cur)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TIR a.a.</span><span className="tabular-nums font-medium">{irr != null ? formatPercent(irr * 100, 2) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('common.fields.payback')}</span><span className="tabular-nums font-medium">{paybackMonths != null ? `${paybackMonths} ${t('common.fields.months', 'meses')}` : '—'}</span></div>
          </div>
        </Card>
      </div>

      {/* ─────────── Discount stats + ticket médio ─────────── */}
      {metrics && (metrics.discountStats.discountAmount > 0 || metrics.recurringRevenueAvg > 0) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {metrics.discountStats.discountAmount > 0 && (
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t('roiAnalyses.discount.title', 'Receita: bruto vs. líquido')}</div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">{t('roiAnalyses.discount.gross', 'Bruto')}</div>
                  <div className="tabular-nums font-medium">{formatCurrency(metrics.discountStats.grossRevenue, cur)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('roiAnalyses.discount.net', 'Líquido')}</div>
                  <div className="tabular-nums font-medium">{formatCurrency(metrics.discountStats.netRevenue, cur)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('roiAnalyses.discount.given', 'Desconto concedido')}</div>
                  <div className="tabular-nums font-medium text-rose-700">−{formatCurrency(metrics.discountStats.discountAmount, cur)}</div>
                </div>
              </div>
            </Card>
          )}
          {metrics.recurringRevenueAvg > 0 && (
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t('roiAnalyses.ticket.title', 'Ticket médio recorrente')}</div>
              <div className="text-2xl font-semibold tabular-nums text-emerald-700">{formatCurrency(metrics.recurringRevenueAvg, cur)}<span className="text-sm font-normal text-muted-foreground"> /{t('common.fields.month', 'mês')}</span></div>
              <div className="text-xs text-muted-foreground mt-1">{t('roiAnalyses.ticket.hint', 'Média por linha de receita mensal lançada.')}</div>
            </Card>
          )}
        </div>
      )}

      {/* ─────────── Form: Adicionar item ─────────── */}
      {!isFrozen && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t('roiAnalyses.entry.add', 'Adicionar item')}</h2>
            <span className="text-xs text-muted-foreground">{t('roiAnalyses.entry.hint', 'Selecione categoria e item — o comportamento vem do catálogo')}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            {/* Categoria */}
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">{t('common.fields.category')}</label>
              <Combobox
                value={draft.categoryId}
                onChange={handleCategoryChange}
                options={categoryOptions}
                placeholder={t('common.actions.select', 'Selecionar...')}
              />
            </div>
            {/* Item */}
            <div className="md:col-span-4">
              <label className="text-xs text-muted-foreground">{t('common.entity.item', 'Item')}</label>
              <Combobox
                value={draft.catalogItemId}
                onChange={handleItemChange}
                options={itemOptions}
                placeholder={draft.categoryId ? t('common.actions.select', 'Selecionar...') : t('roiAnalyses.entry.pickCategoryFirst', 'Escolha uma categoria primeiro')}
              />
              {selectedItem && (
                <div className="text-[11px] text-muted-foreground mt-1 truncate">
                  {String((selectedItem as any).description || '')}
                </div>
              )}
            </div>
            {/* Comportamento */}
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">{t('admin.catalogItems.fields.comportamento', 'Comportamento')}</label>
              <Combobox
                value={draft.comportamento}
                onChange={(v) => setDraft({ ...draft, comportamento: v as Comportamento })}
                options={comportamentoOptions}
              />
            </div>
            {/* Mês de início */}
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">{t('roiAnalyses.entry.startMonth', 'Mês de início')}</label>
              <Input type="number" min="1" max={String(roi.durationMonths || 999)} value={draft.startMonth}
                onChange={e => setDraft({ ...draft, startMonth: e.target.value })} />
            </div>

            {/* Quantidade */}
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">{t('common.fields.quantity', 'Quantidade')}</label>
              <Input type="number" step="0.01" min="0" value={draft.quantity}
                onChange={e => setDraft({ ...draft, quantity: e.target.value })} />
            </div>
            {/* Valor unitário */}
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">{t('roiAnalyses.entry.unitValue', 'Valor unitário')} ({cur})</label>
              <Input type="number" step="0.01" min="0" value={draft.unitValue}
                onChange={e => setDraft({ ...draft, unitValue: e.target.value })} />
            </div>
            {/* Desconto */}
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">{t('roiAnalyses.entry.discountPct', 'Desconto %')}</label>
              <Input type="number" step="0.01" min="0" max="100" value={draft.discountPct}
                onChange={e => setDraft({ ...draft, discountPct: e.target.value })} />
            </div>
            {/* Parcelas (só se INSTALLMENT) */}
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">{t('roiAnalyses.entry.installments', 'Parcelas')}</label>
              <Input type="number" min="1" value={draft.installments}
                disabled={suffixOf(draft.comportamento) !== 'INSTALLMENT'}
                onChange={e => setDraft({ ...draft, installments: e.target.value })} />
            </div>
            {/* Descrição opcional */}
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">{t('common.fields.description')}</label>
              <Input value={draft.description}
                onChange={e => setDraft({ ...draft, description: e.target.value })}
                placeholder={t('roiAnalyses.entry.descriptionPlaceholder', 'opcional')} />
            </div>
            {/* Botão */}
            <div className="md:col-span-1 flex items-end">
              <Button onClick={handleAddEntry} disabled={addEntry.isPending || !draft.catalogItemId} className="w-full">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Live preview */}
          <div className="mt-4 rounded-md bg-muted/40 p-3 text-xs">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Pv label={t('roiAnalyses.preview.gross', 'Bruto')} value={formatCurrency(previewLine.gross, cur)} />
              {previewLine.gross !== previewLine.net && (
                <Pv label={t('roiAnalyses.preview.net', 'Líquido (após desc.)')} value={formatCurrency(previewLine.net, cur)} />
              )}
              <Pv label={t('roiAnalyses.preview.occurrences', 'Ocorrências')} value={String(previewLine.occurrences)} />
              <Pv label={t('roiAnalyses.preview.totalImpact', 'Impacto no contrato')} value={formatCurrency(previewLine.totalImpact, cur)}
                tone={previewLine.fam === 'INCOME' ? 'emerald' : previewLine.fam === 'INVESTMENT' ? 'blue' : 'rose'} />
              <Pv label={t('roiAnalyses.preview.behavior', 'Padrão')} value={t(`admin.catalogItems.behavior.${draft.comportamento}`)} />
            </div>
          </div>
        </Card>
      )}

      {/* ─────────── Lista de entries agrupada por categoria ─────────── */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">{t('roiAnalyses.entries.title', 'Itens lançados')} ({entries.length})</h2>
        </div>

        {entries.length === 0 && (
          <div className="px-3 py-8 text-center text-muted-foreground text-sm">
            {t('roiAnalyses.entries.empty', 'Nenhum item lançado ainda. Use o formulário acima pra começar.')}
          </div>
        )}

        {groupList.map(g => (
          <div key={g.catId} className="border-t first:border-t-0">
            <div className="flex items-center justify-between bg-muted/30 px-4 py-2 text-sm">
              <div className="font-medium">{g.name}</div>
              <div className="tabular-nums text-muted-foreground">{formatCurrency(g.total, cur)} · {g.entries.length} {t('common.fields.items', 'itens')}</div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/10 text-xs">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">{t('common.entity.item', 'Item')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin.catalogItems.fields.comportamento', 'Comportamento')}</th>
                  <th className="px-3 py-2 font-medium text-right">{t('common.fields.quantity', 'Qtd')}</th>
                  <th className="px-3 py-2 font-medium text-right">{t('roiAnalyses.entry.unitValue', 'Val. unit.')}</th>
                  <th className="px-3 py-2 font-medium text-right">{t('roiAnalyses.entry.discountPct', 'Desc.')}</th>
                  <th className="px-3 py-2 font-medium text-center">{t('roiAnalyses.entry.startMonth', 'Início')}</th>
                  <th className="px-3 py-2 font-medium text-right">{t('roiAnalyses.entries.totalImpact', 'Impacto')}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {g.entries.map(e => {
                  const it = items.find((x: any) => String(x.id) === String(e.catalogItemId)) as any
                  const fam = familyOf(e.comportamento)
                  const suf = suffixOf(e.comportamento)
                  const qty = Number(e.quantity) || 0
                  const unit = Number(e.unitValue) || 0
                  const disc = Number(e.discountPct) || 0
                  const net = qty * unit * (1 - disc / 100)
                  const dur = Number(roi.durationMonths) || 12
                  const start = Math.max(1, Number(e.startMonth) || 1)
                  let impact = net
                  if (suf === 'MONTHLY') impact = net * Math.max(0, dur - start + 1)
                  const sign = fam === 'INCOME' ? '+' : '−'
                  const toneCls = fam === 'INCOME' ? 'text-emerald-700' : fam === 'INVESTMENT' ? 'text-blue-700' : 'text-rose-700'
                  return (
                    <tr key={e.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{it?.name || e.description || '—'}</div>
                        {it?.code && <div className="text-[11px] text-muted-foreground">{it.code}</div>}
                      </td>
                      <td className="px-3 py-2"><BehaviorBadge c={e.comportamento} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{qty.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(unit, cur)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{disc > 0 ? `${disc.toFixed(2)}%` : '—'}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-xs">
                        m{start}
                        {suf === 'INSTALLMENT' && e.installments ? `/${e.installments}` : suf === 'MONTHLY' ? `–m${dur}` : ''}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${toneCls}`}>{sign}{formatCurrency(impact, cur)}</td>
                      <td className="px-3 py-2 text-right">
                        {!isFrozen && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteEntry(e.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </Card>

      {/* ─────────── Resumo por comportamento (compactado) ─────────── */}
      {metrics && metrics.summary.byComportamento.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t('roiAnalyses.summary.byBehavior', 'Resumo por comportamento')}</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {metrics.summary.byComportamento.map(b => {
              const fam = familyOf(b.comportamento)
              const tone = fam === 'INCOME' ? 'text-emerald-700' : fam === 'INVESTMENT' ? 'text-blue-700' : 'text-rose-700'
              return (
                <div key={b.comportamento} className="rounded-md border p-2">
                  <div className="text-[11px] text-muted-foreground">{t(`admin.catalogItems.behavior.${b.comportamento}`)}</div>
                  <div className={`text-sm font-semibold tabular-nums ${tone}`}>{formatCurrency(b.total, cur)}</div>
                  <div className="text-[10px] text-muted-foreground">{b.count} {t('common.fields.items', 'itens')}</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <CustomFieldsCard scope="roi" entityType="roi_analysis" entityId={id} />
    </div>
  )
}

/* ──────────────────────────── Subcomponentes ──────────────────────────── */

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'emerald' | 'rose' | 'blue' | 'neutral' }) {
  const toneClass: Record<string, string> = {
    emerald: 'text-emerald-700',
    rose:    'text-rose-700',
    blue:    'text-blue-700',
    neutral: '',
  }
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}<span className="uppercase tracking-wide">{label}</span>
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${toneClass[tone]}`}>{value}</div>
    </Card>
  )
}

function Pv({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'rose' | 'blue' }) {
  const toneClass: Record<string, string> = {
    emerald: 'text-emerald-700',
    rose:    'text-rose-700',
    blue:    'text-blue-700',
  }
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={`tabular-nums font-medium ${tone ? toneClass[tone] : ''}`}>{value}</div>
    </div>
  )
}

function BehaviorBadge({ c }: { c: string | null }) {
  const { t } = useTranslation()
  if (!c) return <span className="text-muted-foreground">—</span>
  const fam = familyOf(c)
  const cls = fam === 'INCOME'
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
    : fam === 'INVESTMENT'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${cls}`}>{t(`admin.catalogItems.behavior.${c}`, c)}</span>
}

