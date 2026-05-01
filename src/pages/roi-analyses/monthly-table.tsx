/**
 * Tabela mês × categoria (v2 — design refinado).
 *
 * Layout:
 *   1) KPI strip no topo: Receita Bruta · Custo · Investimento · Resultado · Payback
 *   2) Tabela com header agrupado por família (Receitas | Custos | Investimentos)
 *   3) Zebra rows + payback row destacada + heatmap nas células
 *   4) Footer com totais + sparkline horizontal do acumulado
 *
 * Inspiração: planilhas financeiras de pré-venda + dashboards SaaS modernos.
 */

import { Download, Sparkles, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { formatCurrency } from '@/shared/lib/format'
import {
  familyOf, suffixOf,
  type RoiEntry,
} from '@/features/roi-analyses/types'

type Family = 'INCOME' | 'EXPENSE' | 'INVESTMENT' | 'MIXED'

type CategoryMonthly = {
  categoryId: string
  categoryName: string
  perMonth: number[]            // valor signed por mês (negativo = saída)
  total: number                 // soma de perMonth (sinal preservado)
  family: Family
}

const FAM_ORDER: Record<Family, number> = { INCOME: 0, MIXED: 1, EXPENSE: 2, INVESTMENT: 3 }

export function MonthlyByCategoryTable({
  entries,
  currency,
  durationMonths,
  categoryById,
}: {
  entries: RoiEntry[]
  currency: string
  durationMonths: number
  categoryById: Map<string, string>  // id → nome
}) {
  const { t } = useTranslation()

  /* Constrói matrix mês × categoria */
  const { columns, totals, paybackMonth, heatScale, kpis, sparkPath } = useMemo(() => {
    const dur = Math.max(1, durationMonths)
    const colMap = new Map<string, CategoryMonthly>()

    for (const e of entries) {
      const catId = e.categoryId || 'none'
      const catName = e.categoryId
        ? (categoryById.get(String(e.categoryId)) || `Categoria #${e.categoryId}`)
        : (e.categoryKey || t('common.uncategorized', 'Sem categoria'))
      const fam = (familyOf(e.comportamento) || 'EXPENSE') as Family
      const suf = suffixOf(e.comportamento)
      const qty = Number(e.quantity) || 0
      const unit = Number(e.unitValue) || 0
      const disc = Number(e.discountPct) || 0
      const net = qty * unit * (1 - disc / 100)
      const sign = fam === 'INCOME' ? 1 : -1
      const startIdx = Math.max(0, (Number(e.startMonth) || 1) - 1)

      const col = colMap.get(String(catId)) || {
        categoryId: String(catId),
        categoryName: String(catName),
        perMonth: Array.from({ length: dur }, () => 0),
        total: 0,
        family: fam,
      }
      if (col.family !== fam) col.family = 'MIXED'

      if (suf === 'ONE_TIME') {
        if (startIdx < dur) col.perMonth[startIdx] += sign * net
      } else if (suf === 'MONTHLY') {
        for (let m = startIdx; m < dur; m++) col.perMonth[m] += sign * net
      } else if (suf === 'INSTALLMENT') {
        const n = Math.max(1, Number(e.installments) || 1)
        const perInst = net / n
        for (let k = 0; k < n; k++) {
          const m = startIdx + k
          if (m < dur) col.perMonth[m] += sign * perInst
        }
      }
      col.total = col.perMonth.reduce((a, v) => a + v, 0)
      colMap.set(String(catId), col)
    }

    const columns = Array.from(colMap.values()).sort((a, b) =>
      (FAM_ORDER[a.family] - FAM_ORDER[b.family]) || (b.total - a.total),
    )

    const totalsPerMonth = Array.from({ length: dur }, () => 0)
    columns.forEach(c => c.perMonth.forEach((v, i) => { totalsPerMonth[i] += v }))

    const cumulative: number[] = []
    let acc = 0
    for (const v of totalsPerMonth) { acc += v; cumulative.push(acc) }

    let paybackMonth: number | null = null
    let totalOut = 0
    for (let i = 0; i < dur; i++) {
      if (totalsPerMonth[i] < 0) totalOut += -totalsPerMonth[i]
      if (paybackMonth === null && cumulative[i] >= 0 && totalOut > 0) {
        paybackMonth = i + 1
      }
    }

    const allValues = columns.flatMap(c => c.perMonth.map(v => Math.abs(v)))
    const sorted = allValues.filter(v => v > 0).sort((a, b) => a - b)
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 1
    const heatScale = p95 || 1

    // KPIs agregados (positivos pra exibir, sinal só na cor)
    const incomeTotal = columns.filter(c => c.family === 'INCOME' || c.family === 'MIXED').reduce((s, c) => s + Math.max(0, c.total), 0)
    const expenseTotal = columns.filter(c => c.family === 'EXPENSE' || c.family === 'MIXED').reduce((s, c) => s + Math.max(0, -c.total), 0)
    const investmentTotal = columns.filter(c => c.family === 'INVESTMENT').reduce((s, c) => s + Math.max(0, -c.total), 0)
    const finalAcc = cumulative[cumulative.length - 1] || 0
    const kpis = { incomeTotal, expenseTotal, investmentTotal, finalAcc, paybackMonth }

    // Sparkline path do acumulado (viewBox 100×24)
    const allCum = cumulative
    const minC = Math.min(0, ...allCum)
    const maxC = Math.max(0, ...allCum)
    const range = maxC - minC || 1
    const w = 100, h = 24
    const xs = (i: number) => (i / Math.max(1, dur - 1)) * w
    const ys = (v: number) => h - ((v - minC) / range) * h
    const sparkPath = allCum.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ')
    const sparkBaseline = ys(0).toFixed(1)

    return {
      columns,
      totals: { perMonth: totalsPerMonth, cumulative, finalAcc },
      paybackMonth,
      heatScale,
      kpis,
      sparkPath: { d: sparkPath, baseline: sparkBaseline, w, h },
    }
  }, [entries, durationMonths, categoryById, t])

  /* Export CSV */
  function handleExportCsv() {
    const headers = ['Mês', ...columns.map(c => c.categoryName), t('roiAnalyses.table.netMonth', 'Líquido do mês'), t('roiAnalyses.table.cumulative', 'Acumulado')]
    const lines = [headers.join(';')]
    for (let i = 0; i < durationMonths; i++) {
      const row = [
        `m${i + 1}`,
        ...columns.map(c => c.perMonth[i].toFixed(2)),
        totals.perMonth[i].toFixed(2),
        totals.cumulative[i].toFixed(2),
      ]
      lines.push(row.join(';'))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roi-monthly-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (entries.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        {t('roiAnalyses.entries.empty', 'Nenhum item lançado ainda. Use a aba Lançamentos pra começar.')}
      </div>
    )
  }

  // Group columns by family pra header agrupado
  const grouped: { family: Family; cols: CategoryMonthly[] }[] = []
  for (const c of columns) {
    const last = grouped[grouped.length - 1]
    if (last && last.family === c.family) last.cols.push(c)
    else grouped.push({ family: c.family, cols: [c] })
  }

  const familyLabel = (f: Family) =>
    f === 'INCOME' ? t('roiAnalyses.family.income', 'Receitas')
    : f === 'EXPENSE' ? t('roiAnalyses.family.expense', 'Custos')
    : f === 'INVESTMENT' ? t('roiAnalyses.family.investment', 'Investimentos')
    : t('roiAnalyses.family.mixed', 'Misto')

  const familyTone = (f: Family) =>
    f === 'INCOME' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-900'
    : f === 'EXPENSE' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/70 dark:border-rose-900'
    : f === 'INVESTMENT' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200/70 dark:border-blue-900'
    : 'bg-muted text-muted-foreground border-muted-foreground/20'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{t('roiAnalyses.table.title', 'Tabela mês a mês por categoria')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('roiAnalyses.table.hint', 'Cada coluna é uma categoria. Receitas em verde, custos/investimentos em vermelho.')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="h-3 w-3" />{t('common.actions.exportCsv', 'Exportar CSV')}
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Card className="px-3 py-2.5 border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-semibold">
            <TrendingUp className="h-3 w-3" />{t('roiAnalyses.kpi.revenue', 'Receita')}
          </div>
          <div className="text-base font-semibold tabular-nums text-emerald-800 dark:text-emerald-300 mt-0.5">{formatCurrency(kpis.incomeTotal, currency)}</div>
        </Card>
        <Card className="px-3 py-2.5 border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-rose-700 dark:text-rose-400 font-semibold">
            <TrendingDown className="h-3 w-3" />{t('roiAnalyses.kpi.cost', 'Custo')}
          </div>
          <div className="text-base font-semibold tabular-nums text-rose-800 dark:text-rose-300 mt-0.5">{formatCurrency(kpis.expenseTotal, currency)}</div>
        </Card>
        <Card className="px-3 py-2.5 border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-blue-700 dark:text-blue-400 font-semibold">
            <Wallet className="h-3 w-3" />{t('roiAnalyses.kpi.investment', 'Investimento')}
          </div>
          <div className="text-base font-semibold tabular-nums text-blue-800 dark:text-blue-300 mt-0.5">{formatCurrency(kpis.investmentTotal, currency)}</div>
        </Card>
        <Card className={`px-3 py-2.5 ${kpis.finalAcc >= 0 ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30' : 'border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30'}`}>
          <div className={`flex items-center gap-2 text-[10px] uppercase tracking-wide font-semibold ${kpis.finalAcc >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
            <Sparkles className="h-3 w-3" />{t('roiAnalyses.kpi.result', 'Resultado')}
          </div>
          <div className={`text-base font-semibold tabular-nums mt-0.5 ${kpis.finalAcc >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>
            {formatCurrency(kpis.finalAcc, currency)}
          </div>
        </Card>
        <Card className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{t('common.fields.payback', 'Payback')}</div>
          <div className="text-base font-semibold tabular-nums text-foreground mt-0.5">
            {kpis.paybackMonth != null
              ? <>m{kpis.paybackMonth} <span className="text-xs font-normal text-muted-foreground">/ {durationMonths}</span></>
              : <span className="text-muted-foreground text-sm">{t('common.fields.notReached', 'Não atinge')}</span>}
          </div>
        </Card>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-md border max-h-[70vh] shadow-sm">
        <table className="w-full text-sm border-collapse">
          {/* Família group header */}
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/40 border-b">
              <th rowSpan={2} className="sticky left-0 z-30 bg-muted/40 px-3 py-2 font-bold border-r text-left text-xs uppercase tracking-wide text-muted-foreground align-bottom">
                {t('common.fields.month', 'Mês')}
              </th>
              {grouped.map((g, gi) => (
                <th
                  key={`g${gi}`}
                  colSpan={g.cols.length}
                  className={`px-3 py-1.5 text-[10px] uppercase font-bold tracking-wide text-center border-l border-r ${familyTone(g.family)}`}
                >
                  {familyLabel(g.family)}
                </th>
              ))}
              <th colSpan={2} rowSpan={2} className="px-3 py-2 font-bold border-l border-l-foreground/10 text-center text-xs uppercase tracking-wide text-muted-foreground bg-muted/40 align-bottom">
                {t('roiAnalyses.table.summary', 'Resumo')}
              </th>
            </tr>
            {/* Categoria header */}
            <tr className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b shadow-sm">
              {columns.map(c => {
                const Icon = c.family === 'INCOME' ? TrendingUp : c.family === 'INVESTMENT' ? Wallet : c.family === 'EXPENSE' ? TrendingDown : null
                const tone = c.family === 'INCOME' ? 'text-emerald-700 dark:text-emerald-400'
                  : c.family === 'INVESTMENT' ? 'text-blue-700 dark:text-blue-400'
                  : c.family === 'EXPENSE' ? 'text-rose-700 dark:text-rose-400'
                  : ''
                return (
                  <th key={c.categoryId} className="px-3 py-2 font-semibold text-center whitespace-nowrap text-[11px]">
                    <span className={`inline-flex items-center gap-1 ${tone}`}>
                      {Icon && <Icon className="h-3 w-3" />}
                      {c.categoryName}
                    </span>
                  </th>
                )
              })}
            </tr>
            {/* Sub-header com Líquido / Acumulado */}
            <tr className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
              <th className="sticky left-0 bg-background/95 px-3 py-1.5 border-r"></th>
              {columns.map(c => <th key={c.categoryId} className="px-3 py-1.5"></th>)}
              <th className="px-3 py-1.5 font-semibold text-[10px] text-center border-l border-l-foreground/10 uppercase tracking-wide text-muted-foreground">
                {t('roiAnalyses.table.netMonth', 'Líquido do mês')}
              </th>
              <th className="px-3 py-1.5 font-semibold text-[10px] text-center uppercase tracking-wide text-muted-foreground">
                {t('roiAnalyses.table.cumulative', 'Acumulado')}
              </th>
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: durationMonths }, (_, i) => {
              const net = totals.perMonth[i]
              const acc = totals.cumulative[i]
              const isPaybackRow = paybackMonth === i + 1
              const isZebra = i % 2 === 1
              const rowCls = isPaybackRow
                ? 'border-t-2 border-emerald-400 dark:border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40'
                : `border-t hover:bg-muted/30 ${isZebra ? 'bg-muted/10' : ''}`
              return (
                <tr key={i} className={rowCls}>
                  <td className={`sticky left-0 z-10 px-3 py-2 font-semibold border-r whitespace-nowrap ${
                    isPaybackRow ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : isZebra ? 'bg-muted/10' : 'bg-background'
                  }`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="tabular-nums">m{String(i + 1).padStart(2, '0')}</span>
                      {isPaybackRow && (
                        <span className="text-[9px] uppercase font-bold tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-200 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                          {t('roiAnalyses.table.paybackBadge', 'Payback')}
                        </span>
                      )}
                    </span>
                  </td>
                  {columns.map(c => {
                    const v = c.perMonth[i]
                    if (v === 0) {
                      return <td key={c.categoryId} className="px-3 py-2 text-center tabular-nums text-muted-foreground/30">—</td>
                    }
                    const intensity = Math.min(1, Math.abs(v) / heatScale)
                    const bgOpacity = (0.05 + intensity * 0.20).toFixed(2)
                    const bgStyle = v > 0
                      ? { backgroundColor: `rgb(16 185 129 / ${bgOpacity})` }
                      : { backgroundColor: `rgb(244 63 94 / ${bgOpacity})` }
                    const textCls = v > 0
                      ? 'text-emerald-800 dark:text-emerald-300 font-medium'
                      : 'text-rose-800 dark:text-rose-300 font-medium'
                    return (
                      <td key={c.categoryId} className={`px-3 py-2 text-center tabular-nums ${textCls}`} style={bgStyle}>
                        {formatCurrency(Math.abs(v), currency)}
                      </td>
                    )
                  })}
                  <td className={`px-3 py-2 text-center tabular-nums font-semibold border-l border-l-foreground/10 ${net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {net === 0 ? '—' : formatCurrency(net, currency)}
                  </td>
                  <td className={`px-3 py-2 text-center tabular-nums font-bold ${acc >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {formatCurrency(acc, currency)}
                  </td>
                </tr>
              )
            })}
          </tbody>

          <tfoot className="sticky bottom-0 z-20 bg-muted/90 backdrop-blur supports-[backdrop-filter]:bg-muted/70 shadow-[0_-1px_0_0_rgba(0,0,0,0.1)]">
            <tr className="border-t-2 border-foreground/30">
              <td className="sticky left-0 z-30 bg-muted/95 px-3 py-2.5 font-bold border-r text-xs uppercase tracking-wide">
                {t('common.fields.total', 'Total')}
              </td>
              {columns.map(c => (
                <td key={c.categoryId} className="px-3 py-2.5 text-center tabular-nums font-semibold">
                  <span className={c.total > 0 ? 'text-emerald-700 dark:text-emerald-400' : c.total < 0 ? 'text-rose-700 dark:text-rose-400' : ''}>
                    {c.total === 0 ? '—' : formatCurrency(Math.abs(c.total), currency)}
                  </span>
                </td>
              ))}
              <td className={`px-3 py-2.5 text-center tabular-nums font-bold border-l border-l-foreground/10 ${
                totals.perMonth.reduce((a, v) => a + v, 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
              }`}>
                {formatCurrency(totals.perMonth.reduce((a, v) => a + v, 0), currency)}
              </td>
              <td className={`px-3 py-2.5 text-center tabular-nums font-bold ${
                (totals.cumulative[totals.cumulative.length - 1] || 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
              }`}>
                {formatCurrency(totals.cumulative[totals.cumulative.length - 1] || 0, currency)}
              </td>
            </tr>
            {/* Sparkline footer row */}
            <tr className="border-t border-foreground/10 bg-muted/60">
              <td className="sticky left-0 z-30 bg-muted/95 px-3 py-1.5 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground border-r">
                {t('roiAnalyses.table.trajectory', 'Trajetória')}
              </td>
              <td colSpan={columns.length + 2} className="px-3 py-1.5">
                <svg viewBox={`0 0 ${sparkPath.w} ${sparkPath.h}`} preserveAspectRatio="none" className="w-full h-6 block" aria-hidden="true">
                  <line x1={0} y1={sparkPath.baseline} x2={sparkPath.w} y2={sparkPath.baseline} className="stroke-muted-foreground/30" strokeWidth={0.3} strokeDasharray="1 1" />
                  <path d={sparkPath.d} className={`fill-none ${kpis.finalAcc >= 0 ? 'stroke-emerald-600' : 'stroke-rose-600'}`} strokeWidth={1.2} />
                </svg>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
