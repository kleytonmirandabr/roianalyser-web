/**
 * Dashboard de Forecast — visão consolidada (rolling 12m, variância).
 *
 * Carrega TODOS os forecasts do tenant + suas entries (uma chamada por
 * baseline aprovado pra trazer entries). Em volume maior, mover essa
 * agregação pro backend `/api/forecasts/rolling`.
 *
 * Spec: PLAN_split-domain-entities.md, seção 4.8.
 */

import { LineChart, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'

import { forecastsApi } from '@/features/forecasts/api'
import { useAllForecasts } from '@/features/forecasts/hooks/use-forecasts'
import { FORECAST_STATUS_LABELS, type ForecastStatus } from '@/features/forecasts/types'
import { formatCurrencyShort, formatPercent } from '@/shared/lib/format'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

const STATUS_BAR_COLOR: Record<ForecastStatus, string> = {
  draft:     'bg-slate-400',
  submitted: 'bg-amber-500',
  approved:  'bg-emerald-500',
  rejected:  'bg-rose-500',
  archived:  'bg-slate-500',
}

/** Retorna últimos 12 meses como yyyy-mm. */
function last12Months(): string[] {
  const out: string[] = []
  const today = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function ForecastsDashboardPage() {
  const { data: forecasts = [], isLoading: loadingList, error } = useAllForecasts()

  // Pra rolling consolidado, busca entries de cada forecast aprovado/baseline.
  // useQueries roda em paralelo.
  const baselineForecasts = forecasts.filter(f => f.isBaseline || f.status === 'approved')
  const entriesQueries = useQueries({
    queries: baselineForecasts.map(f => ({
      queryKey: ['forecasts', 'detail', f.id],
      queryFn: () => forecastsApi.getById(f.id),
    })),
  })

  const entriesLoaded = entriesQueries.every(q => !q.isLoading)

  const stats = useMemo(() => {
    if (!entriesLoaded || forecasts.length === 0) return null

    const months = last12Months()

    // Agrega entries por mês
    const monthlyExpected = new Map<string, number>()
    const monthlyActual = new Map<string, number>()

    for (const q of entriesQueries) {
      if (!q.data) continue
      for (const e of q.data.entries) {
        const key = (e.period || '').slice(0, 7)  // yyyy-mm
        if (!months.includes(key)) continue
        monthlyExpected.set(key, (monthlyExpected.get(key) || 0) + e.expected)
        if (e.actual != null) {
          monthlyActual.set(key, (monthlyActual.get(key) || 0) + e.actual)
        }
      }
    }

    const totalExpected12m = [...monthlyExpected.values()].reduce((s, v) => s + v, 0)
    const totalActual12m = [...monthlyActual.values()].reduce((s, v) => s + v, 0)
    const variance = totalExpected12m > 0
      ? ((totalActual12m - totalExpected12m) / totalExpected12m) * 100
      : 0

    // Distribuição por status
    const byStatus = new Map<ForecastStatus, { count: number }>()
    for (const f of forecasts) {
      const e = byStatus.get(f.status) || { count: 0 }
      e.count += 1
      byStatus.set(f.status, e)
    }

    const submittedCount = forecasts.filter(f => f.status === 'submitted').length
    const baselineCount = forecasts.filter(f => f.isBaseline).length

    // Pegar dados pra "linha mensal" — combina expected/actual por período
    const monthly = months.map(m => ({
      month: m,
      expected: monthlyExpected.get(m) || 0,
      actual: monthlyActual.get(m) || 0,
    }))
    const maxMonth = Math.max(
      ...monthly.map(m => Math.max(m.expected, m.actual)),
      1,
    )

    return {
      currency: 'BRL',  // TODO: agregar por moeda quando houver multi-currency
      total: forecasts.length,
      baselineCount,
      submittedCount,
      totalExpected12m,
      totalActual12m,
      variance,
      monthly,
      maxMonth,
      byStatus,
    }
  }, [forecasts, entriesQueries, entriesLoaded])

  if (error) {
    return <div className="p-6"><Alert variant="destructive"><AlertDescription>Erro: {(error as Error).message}</AlertDescription></Alert></div>
  }
  if (loadingList || !stats) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const statusOrder: ForecastStatus[] = ['draft', 'submitted', 'approved', 'rejected', 'archived']
  const statusData = statusOrder
    .map(s => ({ status: s, count: stats.byStatus.get(s)?.count || 0 }))
    .filter(d => d.count > 0)
  const maxStatusCount = Math.max(...statusData.map(d => d.count), 1)

  const isPositive = stats.variance >= 0
  const VarianceIcon = isPositive ? TrendingUp : TrendingDown
  const varColor = isPositive ? 'text-emerald-700' : 'text-rose-700'

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LineChart className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-semibold">Dashboard — Forecast</h1>
            <p className="text-sm text-muted-foreground">
              Rolling 12m · {stats.total} {stats.total === 1 ? 'revisão' : 'revisões'} · {stats.baselineCount} baselines
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/projects">Ver projetos</Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Esperado 12m</span>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {formatCurrencyShort(stats.totalExpected12m, stats.currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            soma dos baselines
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Realizado 12m</span>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {formatCurrencyShort(stats.totalActual12m, stats.currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            já contabilizado
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Variação</span>
            <VarianceIcon className={`h-4 w-4 ${varColor}`} />
          </div>
          <div className={`text-2xl font-semibold tabular-nums mt-1 ${varColor}`}>
            {formatPercent(stats.variance, 1)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            realizado vs esperado
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Aguardando aprovação</span>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1 text-amber-700">
            {stats.submittedCount}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            revisões submetidas
          </div>
        </Card>
      </div>

      {/* Rolling 12m — barras por mês (esperado vs realizado lado a lado) */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Rolling 12 meses</h2>
          <p className="text-xs text-muted-foreground">
            Esperado (azul) vs realizado (verde) por mês
          </p>
        </div>
        <div className="space-y-3">
          {stats.monthly.map(m => {
            const expectedW = (m.expected / stats.maxMonth) * 100
            const actualW = m.actual > 0 ? (m.actual / stats.maxMonth) * 100 : 0
            return (
              <div key={m.month} className="text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs">{m.month}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="tabular-nums text-blue-700">
                      {formatCurrencyShort(m.expected, stats.currency)}
                    </span>
                    {m.actual > 0 && (
                      <span className="tabular-nums text-emerald-700">
                        {formatCurrencyShort(m.actual, stats.currency)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${expectedW}%` }} />
                  </div>
                  {m.actual > 0 && (
                    <div className="h-2 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${actualW}%` }} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Distribuição por status */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Distribuição por status</h2>
        </div>
        <div className="space-y-3">
          {statusData.map(d => (
            <div key={d.status}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{FORECAST_STATUS_LABELS[d.status]}</span>
                <span className="font-medium tabular-nums">{d.count}</span>
              </div>
              <div className="h-3 rounded bg-muted overflow-hidden">
                <div
                  className={`h-full ${STATUS_BAR_COLOR[d.status]}`}
                  style={{ width: `${(d.count / maxStatusCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
