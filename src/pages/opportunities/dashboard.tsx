/**
 * Dashboard de Oportunidades — KPIs + funil + insights de perda.
 *
 * Cálculo client-side em cima de useOpportunities() (já temos lista
 * carregada quando navega entre tabs). Pra volume maior, mover pro
 * backend `/api/opportunities/stats` em iteração futura.
 *
 * Spec: PLAN_split-domain-entities.md, seção 4.8 (5 dashboards exclusivos).
 */

import { Briefcase, Target, TrendingUp, XCircle } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import {
  OPPORTUNITY_STATUS_LABELS, type OpportunityStatus,
} from '@/features/opportunities/types'
import { formatCurrency, formatCurrencyShort, formatPercent } from '@/shared/lib/format'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

/**
 * Probabilidade weighted por status — usado pra calcular o "pipeline ponderado".
 * Heurística simples: avança proporcional à etapa do funil.
 */
const WIN_PROBABILITY: Record<OpportunityStatus, number> = {
  draft: 0.10,
  qualified: 0.25,
  proposal: 0.50,
  negotiation: 0.75,
  won: 1.0,
  lost: 0.0,
  cancelled: 0.0,
}

const ACTIVE_STATUSES: OpportunityStatus[] = ['draft', 'qualified', 'proposal', 'negotiation']

const STATUS_BAR_COLOR: Record<OpportunityStatus, string> = {
  draft:        'bg-slate-400',
  qualified:    'bg-sky-500',
  proposal:     'bg-violet-500',
  negotiation:  'bg-blue-500',
  won:          'bg-emerald-500',
  lost:         'bg-rose-500',
  cancelled:    'bg-slate-500',
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.floor((db - da) / 86400000)
}

export function OpportunitiesDashboardPage() {
  const { data: items = [], isLoading, error } = useOpportunities()

  const stats = useMemo(() => {
    if (items.length === 0) return null

    // Pipeline = somatório de oportunidades ativas (não-fechadas)
    const active = items.filter(o => ACTIVE_STATUSES.includes(o.status))
    const won = items.filter(o => o.status === 'won')
    const lost = items.filter(o => o.status === 'lost')
    const cancelled = items.filter(o => o.status === 'cancelled')

    // Currency dominante (assumindo a maioria — projeto usa 1 currency
    // por tenant na prática; se misto, mostra a primeira encontrada)
    const currency = items[0]?.currency || 'BRL'

    const pipelineTotal = active.reduce((s, o) => s + (o.estimatedValue || 0), 0)
    const pipelineWeighted = active.reduce(
      (s, o) => s + ((o.estimatedValue || 0) * (WIN_PROBABILITY[o.status] || 0)),
      0,
    )

    const wonTotal = won.reduce((s, o) => s + (o.estimatedValue || 0), 0)
    const lostTotal = lost.reduce((s, o) => s + (o.estimatedValue || 0), 0)

    // Win rate = won / (won + lost). Cancelled não conta (não foi disputa).
    const closedCount = won.length + lost.length
    const winRate = closedCount > 0 ? (won.length / closedCount) * 100 : 0

    // Velocidade: dias médios entre criação e fechamento (won OU lost)
    const closedWithDates = [...won, ...lost].filter(o => o.wonAt || o.lostAt)
    const avgCycleDays = closedWithDates.length > 0
      ? closedWithDates.reduce((s, o) => {
          const closedAt = o.wonAt || o.lostAt!
          return s + daysBetween(o.createdAt, closedAt)
        }, 0) / closedWithDates.length
      : null

    // Distribuição por status (volume + valor) — pra funil
    const byStatus = new Map<OpportunityStatus, { count: number; value: number }>()
    for (const o of items) {
      const e = byStatus.get(o.status) || { count: 0, value: 0 }
      e.count += 1
      e.value += o.estimatedValue || 0
      byStatus.set(o.status, e)
    }

    // Top motivos de perda (lostReasonKey é catálogo livre)
    const lossReasons = new Map<string, number>()
    for (const o of lost) {
      const key = o.lostReasonKey || 'Não informado'
      lossReasons.set(key, (lossReasons.get(key) || 0) + 1)
    }
    const topLossReasons = [...lossReasons.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // Aging — oportunidades ativas paradas há +30 dias sem update
    const today = Date.now()
    const stuck = active.filter(o => {
      const updated = new Date(o.updatedAt).getTime()
      return (today - updated) / 86400000 >= 30
    })

    return {
      currency,
      total: items.length,
      activeCount: active.length,
      wonCount: won.length,
      lostCount: lost.length,
      cancelledCount: cancelled.length,
      pipelineTotal,
      pipelineWeighted,
      wonTotal,
      lostTotal,
      winRate,
      avgCycleDays,
      byStatus,
      topLossReasons,
      stuckCount: stuck.length,
    }
  }, [items])

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Erro: {(error as Error).message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (isLoading || !stats) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  // Construir funil ordenado
  const funnelOrder: OpportunityStatus[] = [
    'draft', 'qualified', 'proposal', 'negotiation', 'won', 'lost',
  ]
  const funnelData = funnelOrder
    .map(s => ({ status: s, ...(stats.byStatus.get(s) || { count: 0, value: 0 }) }))
    .filter(d => d.count > 0)
  const maxCount = Math.max(...funnelData.map(d => d.count), 1)

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-semibold">Dashboard — Oportunidades</h1>
            <p className="text-sm text-muted-foreground">
              Funil comercial · {stats.total} {stats.total === 1 ? 'oportunidade' : 'oportunidades'} no total
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/opportunities">Ver lista</Link>
        </Button>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/opportunities"
          className="block group"
        >
          <Card className="p-4 group-hover:border-indigo-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase">Pipeline ativo</span>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1">
              {formatCurrencyShort(stats.pipelineTotal, stats.currency)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.activeCount} {stats.activeCount === 1 ? 'oportunidade' : 'oportunidades'}
            </div>
          </Card>
        </Link>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Pipeline ponderado</span>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {formatCurrencyShort(stats.pipelineWeighted, stats.currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            por probabilidade média de fechamento
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Win rate</span>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1 text-emerald-700">
            {formatPercent(stats.winRate, 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.wonCount} ganhas / {stats.lostCount} perdidas
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Ciclo médio</span>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {stats.avgCycleDays != null ? `${Math.round(stats.avgCycleDays)} dias` : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            criação → fechamento
          </div>
        </Card>
      </div>

      {/* Alertas operacionais */}
      {stats.stuckCount > 0 && (
        <Alert>
          <AlertDescription>
            <Link to="/opportunities" className="text-amber-700 font-medium hover:underline">
              ⚠ {stats.stuckCount} {stats.stuckCount === 1 ? 'oportunidade parada' : 'oportunidades paradas'} há 30+ dias sem atualização
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Funil — barras horizontais por status */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Funil comercial</h2>
          <p className="text-xs text-muted-foreground">
            Volume e valor por etapa do funil (status). Clique pra filtrar a lista.
          </p>
        </div>
        <div className="space-y-3">
          {funnelData.map(d => (
            <Link
              key={d.status}
              to={`/opportunities?status=${d.status}`}
              className="block group"
            >
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{OPPORTUNITY_STATUS_LABELS[d.status]}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {formatCurrency(d.value, stats.currency, { compact: true })}
                  </span>
                  <span className="font-medium tabular-nums">{d.count}</span>
                </div>
              </div>
              <div className="h-3 rounded bg-muted overflow-hidden">
                <div
                  className={`h-full ${STATUS_BAR_COLOR[d.status]} transition-all group-hover:opacity-80`}
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {/* Top motivos de perda */}
      {stats.topLossReasons.length > 0 && (
        <Card className="p-6 space-y-3">
          <div>
            <h2 className="font-semibold">Top motivos de perda</h2>
            <p className="text-xs text-muted-foreground">
              {stats.lostCount} oportunidades perdidas
            </p>
          </div>
          <ul className="space-y-2">
            {stats.topLossReasons.map(([reason, count]) => {
              const pct = stats.lostCount > 0 ? (count / stats.lostCount) * 100 : 0
              return (
                <li key={reason} className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span>{reason}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {count} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-rose-400" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
