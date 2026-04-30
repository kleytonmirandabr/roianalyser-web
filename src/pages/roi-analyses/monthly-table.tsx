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

import { Download } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/button'
import { formatCurrency } from '@/shared/lib/format'
import {
  familyOf, suffixOf,
  type RoiEntry, type RoiMetrics,
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
  metrics,
  currency,
  durationMonths,
  categoryById,
}: {
  entries: RoiEntry[]
  metrics: RoiMetrics
  currency: string
  durationMonths: number
  categoryById: Map<string, string>  // id → nome
}) {
  const { t } = useTranslation()

  /* Constrói matrix mês × categoria */
  const { columns, totals } = useMemo(() => {
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

    return {
      columns,
      totals: { perMonth: totalsPerMonth, cumulative },
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

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 font-medium border-r">{t('common.fields.month', 'Mês')}</th>
              {columns.map(c => (
                <th key={c.categoryId} className="px-3 py-2 font-medium text-right whitespace-nowrap">
                  <span className={c.family === 'INCOME' ? 'text-emerald-700' : c.family === 'INVESTMENT' ? 'text-blue-700' : c.family === 'EXPENSE' ? 'text-rose-700' : ''}>
                    {c.categoryName}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-right border-l">{t('roiAnalyses.table.netMonth', 'Líquido do mês')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('roiAnalyses.table.cumulative', 'Acumulado')}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: durationMonths }, (_, i) => {
              const net = totals.perMonth[i]
              const acc = totals.cumulative[i]
              return (
                <tr key={i} className="border-t hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2 font-medium border-r">m{i + 1}</td>
                  {columns.map(c => (
                    <td key={c.categoryId} className="px-3 py-2 text-right tabular-nums">
                      {c.perMonth[i] === 0
                        ? <span className="text-muted-foreground/40">—</span>
                        : <span className={c.perMonth[i] > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {formatCurrency(Math.abs(c.perMonth[i]), currency)}
                          </span>
                      }
                    </td>
                  ))}
                  <td className={`px-3 py-2 text-right tabular-nums font-medium border-l ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {net === 0 ? '—' : formatCurrency(net, currency)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${acc >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatCurrency(acc, currency)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-muted/40">
            <tr className="border-t-2">
              <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2 font-semibold border-r">{t('common.fields.total', 'Total')}</td>
              {columns.map(c => (
                <td key={c.categoryId} className="px-3 py-2 text-right tabular-nums font-semibold">
                  <span className={c.total > 0 ? 'text-emerald-700' : c.total < 0 ? 'text-rose-700' : ''}>
                    {c.total === 0 ? '—' : formatCurrency(Math.abs(c.total), currency)}
                  </span>
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums font-semibold border-l">
                {formatCurrency(totals.perMonth.reduce((a, v) => a + v, 0), currency)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                {formatCurrency(totals.cumulative[totals.cumulative.length - 1] || 0, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Resumo lado a lado */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Resumo comparativo (Original × Com Desconto) — só se houver desconto */}
        {metrics.discountStats.discountAmount > 0 && (
          <div className="rounded-md border overflow-hidden">
            <div className="bg-slate-900 text-slate-100 px-3 py-2 text-sm font-semibold">
              {t('roiAnalyses.table.compareSummary', 'Resumo Comparativo')}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t('common.entity.item', 'Item')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('roiAnalyses.discount.gross', 'Original')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('roiAnalyses.discount.net', 'Com Desconto')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-3 py-2">{t('common.fields.totalRevenue', 'Receita')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(metrics.discountStats.grossRevenue, currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(metrics.discountStats.netRevenue, currency)}</td>
                </tr>
                <tr className="border-t bg-rose-50/50">
                  <td className="px-3 py-2 font-medium">{t('roiAnalyses.discount.given', 'Desconto')}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700" colSpan={2}>−{formatCurrency(metrics.discountStats.discountAmount, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Totais do Projeto */}
        <div className="rounded-md border overflow-hidden">
          <div className="bg-slate-900 text-slate-100 px-3 py-2 text-sm font-semibold">
            {t('roiAnalyses.table.projectTotals', 'Totais do Projeto')}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t('roiAnalyses.table.indicator', 'Indicador')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('common.fields.value', 'Valor')}</th>
              </tr>
            </thead>
            <tbody>
              <Row label={t('common.fields.totalRevenue', 'Receita Total')}     value={formatCurrency(metrics.totalRevenue, currency)} />
              <Row label={t('common.fields.totalCost', 'Custo Total')}          value={formatCurrency(metrics.totalCost, currency)} />
              <Row label={t('roiAnalyses.kpi.investment', 'Investimento Total')} value={formatCurrency(metrics.totalInvestment, currency)} />
              <tr className="border-t-2 bg-emerald-50/40">
                <td className="px-3 py-2 font-semibold">{t('common.fields.netValue', 'Resultado')}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${metrics.netValue >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(metrics.netValue, currency)}
                </td>
              </tr>
              {metrics.totalRevenue > 0 && (
                <tr className="border-t bg-emerald-50/40">
                  <td className="px-3 py-2 font-semibold">{t('roiAnalyses.table.margin', 'Margem')}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {((metrics.netValue / metrics.totalRevenue) * 100).toFixed(2)}%
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t">
      <td className="px-3 py-2">{label}</td>
      <td className="px-3 py-2 text-right tabular-nums">{value}</td>
    </tr>
  )
}
