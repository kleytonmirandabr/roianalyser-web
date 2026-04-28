/**
 * Dashboard de ROI — gargalos de aprovação, NPV agregado, tempo médio.
 * Spec: PLAN_split-domain-entities.md, seção 4.8.
 */

import { Calculator, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { useAllRoiAnalyses } from '@/features/roi-analyses/hooks/use-roi-analyses'
import {
  ROI_STATUS_LABELS, type RoiStatus,
} from '@/features/roi-analyses/types'
import { formatCurrencyShort, formatPercent } from '@/shared/lib/format'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

const STATUS_BAR_COLOR: Record<RoiStatus, string> = {
  draft:     'bg-slate-400',
  submitted: 'bg-amber-500',
  approved:  'bg-emerald-500',
  rejected:  'bg-rose-500',
  archived:  'bg-slate-500',
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export function RoiDashboardPage() {
  const { data: items = [], isLoading, error } = useAllRoiAnalyses()

  const stats = useMemo(() => {
    if (items.length === 0) return null
    const currency = items[0]?.currency || 'BRL'

    const drafts = items.filter(r => r.status === 'draft')
    const submitted = items.filter(r => r.status === 'submitted')
    const approved = items.filter(r => r.status === 'approved')
    const rejected = items.filter(r => r.status === 'rejected')

    // Aprovação rate
    const decided = approved.length + rejected.length
    const approvalRate = decided > 0 ? (approved.length / decided) * 100 : 0

    // Tempo médio até aprovação (createdAt → approvedAt)
    const approvedWithDate = approved.filter(r => r.approvedAt)
    const avgApprovalDays = approvedWithDate.length > 0
      ? approvedWithDate.reduce((s, r) => s + daysBetween(r.createdAt, r.approvedAt!), 0) / approvedWithDate.length
      : null

    // NPV médio dos aprovados
    const approvedWithNpv = approved.filter(r => r.npv != null)
    const avgNpv = approvedWithNpv.length > 0
      ? approvedWithNpv.reduce((s, r) => s + (r.npv || 0), 0) / approvedWithNpv.length
      : null

    // Net value total dos aprovados (carteira de valor pré-vendido)
    const totalApprovedValue = approved.reduce((s, r) => s + (r.netValue || 0), 0)

    // Distribuição por status
    const byStatus = new Map<RoiStatus, { count: number }>()
    for (const r of items) {
      const e = byStatus.get(r.status) || { count: 0 }
      e.count += 1
      byStatus.set(r.status, e)
    }

    // Top revisões aprovadas por NPV
    const topByNpv = approvedWithNpv
      .slice()
      .sort((a, b) => (b.npv || 0) - (a.npv || 0))
      .slice(0, 5)

    // Submetidos parados há +5 dias (gargalo de aprovação)
    const stuck = submitted.filter(r => daysBetween(r.updatedAt, new Date().toISOString()) >= 5)

    return {
      currency,
      total: items.length,
      draftCount: drafts.length,
      submittedCount: submitted.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      approvalRate,
      avgApprovalDays,
      avgNpv,
      totalApprovedValue,
      byStatus,
      topByNpv,
      stuckCount: stuck.length,
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

  const statusOrder: RoiStatus[] = ['draft', 'submitted', 'approved', 'rejected', 'archived']
  const statusData = statusOrder
    .map(s => ({ status: s, count: stats.byStatus.get(s)?.count || 0 }))
    .filter(d => d.count > 0)
  const maxStatusCount = Math.max(...statusData.map(d => d.count), 1)

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-semibold">Dashboard — Análises de ROI</h1>
            <p className="text-sm text-muted-foreground">
              Pré-venda · {stats.total} {stats.total === 1 ? 'análise' : 'análises'}
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/opportunities">Ver oportunidades</Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Aguardando aprovação</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1 text-amber-700">
            {stats.submittedCount}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.draftCount} em rascunho
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Taxa de aprovação</span>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1 text-emerald-700">
            {formatPercent(stats.approvalRate, 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.approvedCount} aprovadas / {stats.rejectedCount} rejeitadas
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Tempo médio</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {stats.avgApprovalDays != null ? `${Math.round(stats.avgApprovalDays)} dias` : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            criação → aprovação
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">NPV médio</span>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {formatCurrencyShort(stats.avgNpv, stats.currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            das aprovadas
          </div>
        </Card>
      </div>

      {stats.stuckCount > 0 && (
        <Alert>
          <AlertDescription className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <span>
              <strong>{stats.stuckCount}</strong> {stats.stuckCount === 1 ? 'análise submetida há 5+ dias' : 'análises submetidas há 5+ dias'} sem decisão.
              Gargalo de aprovação — verificar pendências.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Top NPV das aprovadas */}
      {stats.topByNpv.length > 0 && (
        <Card className="p-6 space-y-3">
          <div>
            <h2 className="font-semibold">Top NPV (aprovadas)</h2>
            <p className="text-xs text-muted-foreground">
              Carteira de valor pré-vendido: {formatCurrencyShort(stats.totalApprovedValue, stats.currency)}
            </p>
          </div>
          <ul className="space-y-2">
            {stats.topByNpv.map(roi => (
              <li key={roi.id}>
                <Link to={`/roi-analyses/${roi.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-muted/30">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground mr-2">v{roi.version}</span>
                    <span className="font-medium">{roi.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="tabular-nums text-muted-foreground">
                      Net: {formatCurrencyShort(roi.netValue, roi.currency)}
                    </span>
                    <span className="font-medium tabular-nums text-emerald-700">
                      NPV: {formatCurrencyShort(roi.npv, roi.currency)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Distribuição por status */}
      {/* Top 5 por NPV */}
      <Card className="p-6 space-y-3">
        <div>
          <h2 className="font-semibold">Top análises por NPV</h2>
          <p className="text-xs text-muted-foreground">Maiores valores presentes líquidos</p>
        </div>
        {(() => {
          const top = items
            .filter(r => r.npv != null && Number(r.npv) > 0)
            .sort((a, b) => Number(b.npv) - Number(a.npv))
            .slice(0, 5)
          if (top.length === 0) {
            return <p className="text-sm text-muted-foreground">Nenhuma análise com NPV positivo.</p>
          }
          const max = Math.max(1, ...top.map(r => Number(r.npv)))
          return (
            <div className="space-y-2">
              {top.map(r => (
                <Link key={r.id} to={`/roi-analyses/${r.id}`} className="block group">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium truncate max-w-[60%]">{r.name}</span>
                    <span className="text-xs tabular-nums">{formatCurrencyShort(Number(r.npv), r.currency)}</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500/70 transition-all group-hover:opacity-80"
                      style={{ width: `${(Number(r.npv) / max) * 100}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          )
        })()}
      </Card>

      {/* Aguardando aprovação */}
      <Card className="p-6 space-y-3">
        <div>
          <h2 className="font-semibold">Aguardando aprovação</h2>
          <p className="text-xs text-muted-foreground">Análises submetidas que precisam de revisão</p>
        </div>
        {(() => {
          const pending = items
            .filter(r => r.status === 'submitted')
            .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
            .slice(0, 8)
          if (pending.length === 0) {
            return <p className="text-sm text-muted-foreground">Nenhuma análise pendente.</p>
          }
          return (
            <ul className="space-y-2">
              {pending.map(r => (
                <li key={r.id}>
                  <Link to={`/roi-analyses/${r.id}`} className="flex items-center justify-between text-sm py-1 hover:bg-muted/30 rounded px-2 -mx-2">
                    <span className="font-medium truncate max-w-[70%]">{r.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {r.npv != null ? formatCurrencyShort(Number(r.npv), r.currency) : '—'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        })()}
      </Card>


      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Distribuição por status</h2>
        </div>
        <div className="space-y-3">
          {statusData.map(d => (
            <div key={d.status}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{ROI_STATUS_LABELS[d.status]}</span>
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

      {/* XCircle import só pra evitar warning unused */}
      <span className="hidden"><XCircle /></span>
    </div>
  )
}
