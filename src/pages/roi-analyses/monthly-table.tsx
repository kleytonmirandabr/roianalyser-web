/**
 * Tabela mês × categoria pra ROI detail (Sprint Tabs).
 *
 * Linhas: meses 1..durationMonths
 * Colunas: cada categoria que tem entry no projeto + Receita Total + Lucro + Acumulado
 * Footer:
 *   - Resumo Comparativo (Original × Com Desconto) — apenas pra INCOME com desconto
 *   - Totais do Projeto (Receita Total, Custo Total, Investimento Total, Resultado, Margem)
 *
 * Inspiração: planilha v1 que o usuário mostrou.
 */

import { Download, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/button'
import { formatCurrency } from '@/shared/lib/format'
import {
  familyOf, suffixOf,
  type RoiEntry,
} from '@/features/roi-analyses/types'

type CategoryMonthly = {
  categoryId: string
  categoryName: string
  perMonth: number[]            // valor signed por mês (negativo = saída)
  total: number                 // soma de perMonth (sinal preservado)
  family: 'INCOME' | 'EXPENSE' | 'INVESTMENT' | 'MIXED'
}

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
  const { columns, totals, paybackMonth, heatScale } = useMemo(() => {
    const dur = Math.max(1, durationMonths)
    const colMap = new Map<string, CategoryMonthly>()

    for (const e of entries) {
      const catId = e.categoryId || 'none'
      const catName = e.categoryId
        ? (categoryById.get(String(e.categoryId)) || `Categoria #${e.categoryId}`)
        : (e.categoryKey || t('common.uncategorized', 'Sem categoria'))
      const fam = familyOf(e.comportamento) || 'EXPENSE'
      const suf = suffixOf(e.comportamento)
      const qty = Number(e.quantity) || 0
      const unit = Number(e.unitValue) || 0
      const disc = Number(e.discountPct) || 0
      const net = qty * unit * (1 - disc / 100)
      const sign = fam === 'INCOME' ? 1 : -1
      const startIdx = Math.max(0, (Number(e.startMonth) || 1) - 1)

      const col = colMap.get(catId) || {
        categoryId: String(catId),
        categoryName: String(catName),
        perMonth: Array.from({ length: dur }, () => 0),
        total: 0,
        family: fam,
      }
      // Family policy: se tiver mais de 1 family na mesma categoria, marca MIXED
      if (col.family !== fam) col.family = 'MIXED'

      if (suf === 'ONE_TIME') {
        if (startIdx < dur) {
          col.perMonth[startIdx] += sign * net
        }
      } else if (suf === 'MONTHLY') {
        for (let m = startIdx; m < dur; m++) {
          col.perMonth[m] += sign * net
        }
      } else if (suf === 'INSTALLMENT') {
        const n = Math.max(1, Number(e.installments) || 1)
        const perInst = net / n
        for (let k = 0; k < n; k++) {
          const m = startIdx + k
          if (m < dur) col.perMonth[m] += sign * perInst
        }
      }
      col.total = col.perMonth.reduce((a, v) => a + v, 0)
      colMap.set(catId, col)
    }

    // Ordena: receitas primeiro, depois custos, depois investimentos
    const order: Record<string, number> = { INCOME: 0, MIXED: 1, EXPENSE: 2, INVESTMENT: 3 }
    const columns = Array.from(colMap.values()).sort((a, b) =>
      (order[a.family] - order[b.family]) || (b.total - a.total),
    )

    // Totais por mês (somando todas categorias)
    const totalsPerMonth = Array.from({ length: dur }, () => 0)
    columns.forEach(c => c.perMonth.forEach((v, i) => { totalsPerMonth[i] += v }))

    // Acumulado
    const cumulative: number[] = []
    let acc = 0
    for (const v of totalsPerMonth) {
      acc += v
      cumulative.push(acc)
    }

    // Payback: primeiro mês com acumulado >= 0 (e que houve algum custo/investimento)
    let paybackMonth: number | null = null
    let totalOut = 0
    for (let i = 0; i < dur; i++) {
      if (totalsPerMonth[i] < 0) totalOut += -totalsPerMonth[i]
      if (paybackMonth === null && cumulative[i] >= 0 && totalOut > 0) {
        paybackMonth = i + 1
      }
    }

    // Maior valor absoluto pra normalizar heatmap (ignora outliers > p95)
    const allValues = columns.flatMap(c => c.perMonth.map(v => Math.abs(v)))
    const sorted = allValues.filter(v => v > 0).sort((a, b) => a - b)
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 1
    const heatScale = p95 || 1

    return {
      columns,
      totals: { perMonth: totalsPerMonth, cumulative },
      paybackMonth,
      heatScale,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('roiAnalyses.table.title', 'Tabela mês a mês por categoria')}</h2>
          <p className="text-xs text-muted-foreground">{t('roiAnalyses.table.hint', 'Cada coluna é uma categoria. Receitas em verde, custos/investimentos em vermelho.')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="h-3 w-3" />{t('common.actions.exportCsv', 'Exportar CSV')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
            <tr className="text-left border-b">
              <th className="sticky left-0 z-30 bg-background px-3 py-2.5 font-semibold border-r text-xs uppercase tracking-wide text-muted-foreground">
                {t('common.fields.month', 'Mês')}
              </th>
              {columns.map(c => {
                const Icon = c.family === 'INCOME' ? TrendingUp : c.family === 'INVESTMENT' ? Wallet : c.family === 'EXPENSE' ? TrendingDown : null
                const tone = c.family === 'INCOME' ? 'text-emerald-700 dark:text-emerald-400'
                  : c.family === 'INVESTMENT' ? 'text-blue-700 dark:text-blue-400'
                  : c.family === 'EXPENSE' ? 'text-rose-700 dark:text-rose-400'
                  : ''
                return (
                  <th key={c.categoryId} className="px-3 py-2.5 font-semibold text-center whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 ${tone}`}>
                      {Icon && <Icon className="h-3 w-3" />}
                      {c.categoryName}
                    </span>
                  </th>
                )
              })}
              <th className="px-3 py-2.5 font-semibold text-center border-l text-xs uppercase tracking-wide text-muted-foreground">
                {t('roiAnalyses.table.netMonth', 'Líquido do mês')}
              </th>
              <th className="px-3 py-2.5 font-semibold text-center text-xs uppercase tracking-wide text-muted-foreground">
                {t('roiAnalyses.table.cumulative', 'Acumulado')}
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: durationMonths }, (_, i) => {
              const net = totals.perMonth[i]
              const acc = totals.cumulative[i]
              const isPaybackRow = paybackMonth === i + 1
              const rowCls = isPaybackRow
                ? 'border-t border-emerald-300 dark:border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30'
                : 'border-t hover:bg-muted/40'
              return (
                <tr key={i} className={rowCls}>
                  <td className={`sticky left-0 z-10 px-3 py-2 font-semibold border-r ${isPaybackRow ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : 'bg-background'}`}>
                    <span className="inline-flex items-center gap-1.5">
                      m{i + 1}
                      {isPaybackRow && (
                        <span className="text-[9px] uppercase font-bold tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1 py-0.5 rounded">
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
                    // Heatmap: intensidade do background proporcional a |v| / heatScale (cap 0..1)
                    const intensity = Math.min(1, Math.abs(v) / heatScale)
                    const bgOpacity = (0.05 + intensity * 0.20).toFixed(2)
                    const bgStyle = v > 0
                      ? { backgroundColor: `rgb(16 185 129 / ${bgOpacity})` }   // emerald
                      : { backgroundColor: `rgb(244 63 94 / ${bgOpacity})` }    // rose
                    const textCls = v > 0
                      ? 'text-emerald-800 dark:text-emerald-300 font-medium'
                      : 'text-rose-800 dark:text-rose-300 font-medium'
                    return (
                      <td key={c.categoryId} className={`px-3 py-2 text-center tabular-nums ${textCls}`} style={bgStyle}>
                        {formatCurrency(Math.abs(v), currency)}
                      </td>
                    )
                  })}
                  <td className={`px-3 py-2 text-center tabular-nums font-semibold border-l ${net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {net === 0 ? '—' : formatCurrency(net, currency)}
                  </td>
                  <td className={`px-3 py-2 text-center tabular-nums font-semibold ${acc >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {formatCurrency(acc, currency)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-20 bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60 shadow-[0_-1px_0_0_rgba(0,0,0,0.1)]">
            <tr className="border-t-2 border-foreground/20">
              <td className="sticky left-0 z-30 bg-muted/95 px-3 py-2.5 font-bold border-r text-xs uppercase tracking-wide">{t('common.fields.total', 'Total')}</td>
              {columns.map(c => (
                <td key={c.categoryId} className="px-3 py-2 text-center tabular-nums font-semibold">
                  <span className={c.total > 0 ? 'text-emerald-700' : c.total < 0 ? 'text-rose-700' : ''}>
                    {c.total === 0 ? '—' : formatCurrency(Math.abs(c.total), currency)}
                  </span>
                </td>
              ))}
              <td className="px-3 py-2 text-center tabular-nums font-semibold border-l">
                {formatCurrency(totals.perMonth.reduce((a, v) => a + v, 0), currency)}
              </td>
              <td className="px-3 py-2 text-center tabular-nums font-semibold">
                {formatCurrency(totals.cumulative[totals.cumulative.length - 1] || 0, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  )
}


