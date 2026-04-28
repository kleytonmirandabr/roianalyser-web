/**
 * Dashboard de Projetos — saúde operacional, atrasos, progresso.
 * Spec: PLAN_split-domain-entities.md, seção 4.8.
 */

import { AlertTriangle, CheckCircle2, Rocket, Timer } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { useProjects2 } from '@/features/projects2/hooks/use-projects'
import {
  PROJECT_STATUS_LABELS, type ProjectStatus,
} from '@/features/projects2/types'
import { formatCurrencyShort, formatPercent } from '@/shared/lib/format'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

const STATUS_BAR_COLOR: Record<ProjectStatus, string> = {
  planning:  'bg-slate-400',
  execution: 'bg-blue-500',
  paused:    'bg-amber-500',
  done:      'bg-emerald-500',
  cancelled: 'bg-rose-500',
}

function daysLate(plannedEnd: string | null, status: ProjectStatus): number {
  if (!plannedEnd || status === 'done' || status === 'cancelled') return 0
  const target = new Date(plannedEnd).getTime()
  const today = new Date().getTime()
  const days = Math.floor((today - target) / 86400000)
  return Math.max(0, days)
}

function daysSinceLastUpdate(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
}

export function Projects2DashboardPage() {
  const { data: items = [], isLoading, error } = useProjects2()

  const stats = useMemo(() => {
    if (items.length === 0) return null

    const currency = items[0]?.currency || 'BRL'
    const inExecution = items.filter(p => p.status === 'execution')
    const done = items.filter(p => p.status === 'done')
    const planning = items.filter(p => p.status === 'planning')
    const paused = items.filter(p => p.status === 'paused')

    // Atrasados: execution com plannedEnd no passado
    const late = items.filter(p => daysLate(p.plannedEnd, p.status) > 0)
    const onTrack = inExecution.filter(p => daysLate(p.plannedEnd, p.status) === 0)

    // Saúde: % no prazo
    const totalActive = inExecution.length + paused.length + planning.length
    const healthPct = totalActive > 0 ? (onTrack.length / totalActive) * 100 : 0

    // Progresso médio dos ativos (execution)
    const avgProgress = inExecution.length > 0
      ? inExecution.reduce((s, p) => s + p.progressPct, 0) / inExecution.length
      : 0

    // Budget total
    const totalBudget = items.reduce((s, p) => s + (p.budget || 0), 0)
    const activeBudget = inExecution.reduce((s, p) => s + (p.budget || 0), 0)

    // Distribuição por status
    const byStatus = new Map<ProjectStatus, { count: number }>()
    for (const p of items) {
      const e = byStatus.get(p.status) || { count: 0 }
      e.count += 1
      byStatus.set(p.status, e)
    }

    // Stuck — projetos ativos sem update há +14 dias
    const stuck = [...inExecution, ...paused].filter(p => daysSinceLastUpdate(p.updatedAt) >= 14)

    // Top atrasados (worst)
    const topLate = [...late]
      .sort((a, b) => daysLate(b.plannedEnd, b.status) - daysLate(a.plannedEnd, a.status))
      .slice(0, 5)

    return {
      currency,
      total: items.length,
      inExecutionCount: inExecution.length,
      doneCount: done.length,
      planningCount: planning.length,
      pausedCount: paused.length,
      lateCount: late.length,
      onTrackCount: onTrack.length,
      healthPct,
      avgProgress,
      totalBudget,
      activeBudget,
      byStatus,
      stuck,
      topLate,
    }
  }, [items])

  if (error) {
    return <div className="p-6"><Alert variant="destructive"><AlertDescription>Erro: {(error as Error).message}</AlertDescription></Alert></div>
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

  const statusOrder: ProjectStatus[] = ['planning', 'execution', 'paused', 'done', 'cancelled']
  const statusData = statusOrder
    .map(s => ({ status: s, count: stats.byStatus.get(s)?.count || 0 }))
    .filter(d => d.count > 0)
  const maxStatusCount = Math.max(...statusData.map(d => d.count), 1)

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Rocket className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-semibold">Dashboard — Projetos</h1>
            <p className="text-sm text-muted-foreground">
              Execução operacional · {stats.total} {stats.total === 1 ? 'projeto' : 'projetos'}
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/projects-v2">Ver lista</Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Saúde geral</span>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className={`text-2xl font-semibold tabular-nums mt-1 ${stats.healthPct >= 70 ? 'text-emerald-700' : stats.healthPct >= 40 ? 'text-amber-700' : 'text-rose-700'}`}>
            {formatPercent(stats.healthPct, 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.onTrackCount} no prazo / {stats.lateCount} atrasados
          </div>
        </Card>

        <Link to="/projects-v2?status=execution" className="block group">
          <Card className="p-4 group-hover:border-indigo-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase">Em execução</span>
              <Rocket className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1 text-blue-700">
              {stats.inExecutionCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatCurrencyShort(stats.activeBudget, stats.currency)}
            </div>
          </Card>
        </Link>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Progresso médio</span>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {formatPercent(stats.avgProgress, 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">dos ativos</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Orçamento total</span>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {formatCurrencyShort(stats.totalBudget, stats.currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.doneCount} {stats.doneCount === 1 ? 'concluído' : 'concluídos'}
          </div>
        </Card>
      </div>

      {/* Alertas */}
      {(stats.lateCount > 0 || stats.stuck.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.lateCount > 0 && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>{stats.lateCount}</strong> {stats.lateCount === 1 ? 'projeto atrasado' : 'projetos atrasados'} (passou do plannedEnd sem concluir).
                </span>
              </AlertDescription>
            </Alert>
          )}
          {stats.stuck.length > 0 && (
            <Alert>
              <AlertDescription className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-700" />
                <span>
                  <strong>{stats.stuck.length}</strong> {stats.stuck.length === 1 ? 'projeto sem atualização' : 'projetos sem atualização'} há 14+ dias.
                </span>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Top atrasados */}
      {stats.topLate.length > 0 && (
        <Card className="p-6 space-y-3">
          <div>
            <h2 className="font-semibold">Top atrasos</h2>
            <p className="text-xs text-muted-foreground">Projetos que mais ultrapassaram o prazo</p>
          </div>
          <ul className="space-y-2">
            {stats.topLate.map(p => {
              const days = daysLate(p.plannedEnd, p.status)
              return (
                <li key={p.id}>
                  <Link to={`/projects-v2/${p.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-muted/30">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{p.projectCode}</span>
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="tabular-nums text-muted-foreground">{p.progressPct.toFixed(0)}%</span>
                      <span className="font-medium tabular-nums text-rose-700">⚠ {days}d atraso</span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* Top 5 por orçamento */}
      <Card className="p-6 space-y-3">
        <div>
          <h2 className="font-semibold">Top projetos por orçamento</h2>
          <p className="text-xs text-muted-foreground">Maiores compromissos financeiros</p>
        </div>
        {(() => {
          const top = items
            .filter(p => p.budget != null && Number(p.budget) > 0)
            .sort((a, b) => Number(b.budget) - Number(a.budget))
            .slice(0, 5)
          if (top.length === 0) {
            return <p className="text-sm text-muted-foreground">Sem orçamentos definidos.</p>
          }
          const max = Math.max(1, ...top.map(p => Number(p.budget)))
          return (
            <div className="space-y-2">
              {top.map(p => (
                <Link key={p.id} to={`/projects-v2/${p.id}`} className="block group">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium truncate max-w-[60%]">{p.name}</span>
                    <span className="text-xs tabular-nums">{formatCurrencyShort(Number(p.budget), p.currency)}</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary/70 transition-all group-hover:opacity-80"
                      style={{ width: `${(Number(p.budget) / max) * 100}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          )
        })()}
      </Card>

      {/* Por responsável */}
      <Card className="p-6 space-y-3">
        <div>
          <h2 className="font-semibold">Carga por gestor</h2>
          <p className="text-xs text-muted-foreground">Projetos por gestor</p>
        </div>
        {(() => {
          const byResp = new Map<string, number>()
          for (const p of items) {
            if (!p.managerId) continue
            byResp.set(p.managerId, (byResp.get(p.managerId) ?? 0) + 1)
          }
          const arr = Array.from(byResp.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
          if (arr.length === 0) {
            return <p className="text-sm text-muted-foreground">Sem responsáveis atribuídos.</p>
          }
          const max = Math.max(1, ...arr.map(([_, c]) => c))
          return (
            <div className="space-y-2">
              {arr.map(([rid, c]) => (
                <div key={rid}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">Gestor #{rid}</span>
                    <span className="text-xs tabular-nums font-semibold">{c}</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500/70" style={{ width: `${(c / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </Card>

      {/* Distribuição por status */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Distribuição por status</h2>
          <p className="text-xs text-muted-foreground">Clique pra filtrar a lista</p>
        </div>
        <div className="space-y-3">
          {statusData.map(d => (
            <Link key={d.status} to={`/projects-v2?status=${d.status}`} className="block group">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{PROJECT_STATUS_LABELS[d.status]}</span>
                <span className="font-medium tabular-nums">{d.count}</span>
              </div>
              <div className="h-3 rounded bg-muted overflow-hidden">
                <div
                  className={`h-full ${STATUS_BAR_COLOR[d.status]} transition-all group-hover:opacity-80`}
                  style={{ width: `${(d.count / maxStatusCount) * 100}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
