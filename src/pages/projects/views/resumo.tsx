import { Download, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { CashFlowChart } from '@/features/projects/components/cash-flow-chart'
import { useProject } from '@/features/projects/hooks/use-project'
import {
  buildCashFlow,
  computeMetrics,
  readFinancialInputs,
} from '@/features/projects/lib/financials'
import { formatCurrency } from '@/features/projects/lib/money'
import { exportToCsv, printPage } from '@/shared/lib/export'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { cn } from '@/shared/lib/cn'

type KpiCellProps = {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'bad' | 'neutral'
}

function KpiCell({ label, value, hint, tone = 'neutral' }: KpiCellProps) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-xl font-semibold tabular-nums',
          tone === 'good' && 'text-emerald-600',
          tone === 'bad' && 'text-destructive',
          tone === 'neutral' && 'text-foreground',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function pct(n: number): string {
  return `${n.toFixed(1).replace('.', ',')}%`
}

/**
 * Resumo & Gráfico — visão consolidada read-only do projeto.
 * Calcula fluxo de caixa mensal a partir de todas as entradas das outras
 * views e renderiza KPIs + tabela mensal + gráfico de payback acumulado.
 */
export function ProjectResumoView() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)

  const payload = (project.data?.payload ?? null) as
    | Record<string, unknown>
    | null
  const inputs = useMemo(() => readFinancialInputs(payload), [payload])
  const cashFlow = useMemo(
    () => (payload ? buildCashFlow(payload, inputs) : []),
    [payload, inputs],
  )
  const metrics = useMemo(() => computeMetrics(cashFlow), [cashFlow])
  const currency = project.data?.currency ?? 'BRL'

  function handleExportCsv() {
    exportToCsv(
      cashFlow.map((m) => ({
        mes: m.month,
        receitaBruta: m.recurringRevenue + m.oneTimeRevenue,
        financeiro: m.financial,
        receitaLiquida: m.revenue,
        custos: m.recurringCost + m.oneTimeCost,
        investimento: m.investment,
        resultado: m.result,
        acumulado: m.accum,
      })),
      `resumo-projeto-${new Date().toISOString().slice(0, 10)}`,
      [
        { key: 'mes', label: t('projects.detail.resumo.csvCols.month') },
        { key: 'receitaBruta', label: t('projects.detail.resumo.csvCols.grossRevenue') },
        { key: 'financeiro', label: t('projects.detail.resumo.csvCols.financial') },
        { key: 'receitaLiquida', label: t('projects.detail.resumo.csvCols.netRevenue') },
        { key: 'custos', label: t('projects.detail.resumo.csvCols.costs') },
        { key: 'investimento', label: t('projects.detail.resumo.csvCols.investment') },
        { key: 'resultado', label: t('projects.detail.resumo.csvCols.result') },
        { key: 'acumulado', label: t('projects.detail.resumo.csvCols.accum') },
      ],
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t('projects.detail.resumo.title')}</CardTitle>
              <CardDescription>
                {t('projects.detail.resumo.description', {
                  prazo: inputs.prazo,
                })}
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={cashFlow.length === 0}
              >
                <Download className="h-4 w-4" />
                <span>{t('projects.detail.resumo.csv')}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={printPage}>
                <Printer className="h-4 w-4" />
                <span>{t('projects.detail.resumo.print')}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {t('projects.detail.resumo.loadError')}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCell
              label={t('projects.detail.resumo.kpi.totalRevenue')}
              value={formatCurrency(metrics.totalRevenue, currency)}
              hint={t('projects.detail.resumo.kpi.totalRevenueHint', {
                gross: formatCurrency(
                  metrics.totalRecurringRevenue + metrics.totalOneTimeRevenue,
                  currency,
                ),
              })}
            />
            <KpiCell
              label={t('projects.detail.resumo.kpi.totalCost')}
              value={formatCurrency(metrics.totalCost, currency)}
              hint={t('projects.detail.resumo.kpi.totalCostHint', {
                inv: formatCurrency(metrics.totalInvestment, currency),
              })}
            />
            <KpiCell
              label={t('projects.detail.resumo.kpi.result')}
              value={formatCurrency(metrics.totalResult, currency)}
              hint={t('projects.detail.resumo.kpi.resultHint', {
                margin: pct(metrics.margin),
              })}
              tone={metrics.totalResult >= 0 ? 'good' : 'bad'}
            />
            <KpiCell
              label={t('projects.detail.resumo.kpi.payback')}
              value={
                metrics.paybackMonth != null
                  ? metrics.paybackMonth > 1
                    ? t('projects.detail.resumo.kpi.paybackMany', {
                        n: metrics.paybackMonth,
                      })
                    : t('projects.detail.resumo.kpi.paybackOne', {
                        n: metrics.paybackMonth,
                      })
                  : t('projects.detail.resumo.kpi.paybackNone')
              }
              hint={t('projects.detail.resumo.kpi.paybackHint', {
                accum: formatCurrency(
                  cashFlow[cashFlow.length - 1]?.accum ?? 0,
                  currency,
                ),
              })}
              tone={metrics.paybackMonth != null ? 'good' : 'bad'}
            />
          </div>

          <CashFlowChart cashFlow={cashFlow} currency={currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('projects.detail.resumo.monthlyTitle')}</CardTitle>
          <CardDescription>
            {t('projects.detail.resumo.monthlyDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t('projects.detail.resumo.th.month')}</TableHead>
                <TableHead className="text-right">{t('projects.detail.resumo.th.revenue')}</TableHead>
                <TableHead className="text-right">{t('projects.detail.resumo.th.investment')}</TableHead>
                <TableHead className="text-right">{t('projects.detail.resumo.th.costs')}</TableHead>
                <TableHead className="text-right">{t('projects.detail.resumo.th.financial')}</TableHead>
                <TableHead className="text-right">{t('projects.detail.resumo.th.result')}</TableHead>
                <TableHead className="text-right">{t('projects.detail.resumo.th.accum')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashFlow.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium">{m.month}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(m.revenue, currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(m.investment, currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(m.recurringCost + m.oneTimeCost, currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(m.financial, currency)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      m.result >= 0 ? 'text-emerald-600' : 'text-destructive',
                    )}
                  >
                    {formatCurrency(m.result, currency)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-medium tabular-nums',
                      m.accum >= 0 ? 'text-emerald-600' : 'text-destructive',
                    )}
                  >
                    {formatCurrency(m.accum, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
