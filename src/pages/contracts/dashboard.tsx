/**
 * Dashboard de Contratos — carteira, vencimentos, distribuição.
 * Spec: PLAN_split-domain-entities.md, seção 4.8.
 */

import { AlertTriangle, Calendar, FileText, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { useContracts } from '@/features/contracts2/hooks/use-contracts'
import {
  CONTRACT_STATUS_LABELS, type ContractStatus,
} from '@/features/contracts2/types'
import { formatCurrency, formatCurrencyShort } from '@/shared/lib/format'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

const ACTIVE_STATUSES: ContractStatus[] = ['active', 'ending_soon']

const STATUS_BAR_COLOR: Record<ContractStatus, string> = {
  drafting:          'bg-slate-400',
  pending_signature: 'bg-amber-500',
  active:            'bg-emerald-500',
  ending_soon:       'bg-orange-500',
  ended:             'bg-slate-500',
  terminated:        'bg-rose-500',
  renewed:           'bg-blue-500',
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr).getTime()
  const today = new Date().getTime()
  return Math.floor((target - today) / 86400000)
}

export function ContractsDashboardPage() {
  const { data: items = [], isLoading, error } = useContracts()

  const stats = useMemo(() => {
    if (items.length === 0) return null

    const currency = items[0]?.currency || 'BRL'
    const active = items.filter(c => ACTIVE_STATUSES.includes(c.status))

    // Carteira ativa (TCV — Total Contract Value)
    const tcv = active.reduce((s, c) => s + (c.totalValue || 0), 0)

    // Vencimentos próximos (active com endDate em 30/60/90 dias)
    const expiring30: typeof items = []
    const expiring60: typeof items = []
    const expiring90: typeof items = []
    for (const c of active) {
      const days = daysUntil(c.endDate)
      if (days == null || days < 0) continue
      if (days <= 30) expiring30.push(c)
      else if (days <= 60) expiring60.push(c)
      else if (days <= 90) expiring90.push(c)
    }

    // Distribuição por status (count + value) pra barra
    const byStatus = new Map<ContractStatus, { count: number; value: number }>()
    for (const c of items) {
      const e = byStatus.get(c.status) || { count: 0, value: 0 }
      e.count += 1
      e.value += c.totalValue || 0
      byStatus.set(c.status, e)
    }

    // Distribuição por tipo (contractTypeKey)
    const byType = new Map<string, { count: number; value: number }>()
    for (const c of items) {
      const key = c.contractTypeKey || 'Não classificado'
      const e = byType.get(key) || { count: 0, value: 0 }
      e.count += 1
      e.value += c.totalValue || 0
      byType.set(key, e)
    }
    const topTypes = [...byType.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 5)

    // Top clientes por valor (clientId → soma)
    const byClient = new Map<string, { count: number; value: number }>()
    for (const c of active) {
      const key = c.clientId
      const e = byClient.get(key) || { count: 0, value: 0 }
      e.count += 1
      e.value += c.totalValue || 0
      byClient.set(key, e)
    }
    const topClients = [...byClient.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 5)

    // Renovações vencendo: active com renewalType=auto e endDate próximo
    const autoRenewExpiring = active.filter(c =>
      c.renewalType === 'auto' && daysUntil(c.endDate) != null && daysUntil(c.endDate)! <= 60,
    )

    return {
      currency,
      total: items.length,
      activeCount: active.length,
      tcv,
      expiring30, expiring60, expiring90,
      byStatus,
      topTypes,
      topClients,
      autoRenewExpiringCount: autoRenewExpiring.length,
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

  const statusOrder: ContractStatus[] = [
    'drafting', 'pending_signature', 'active', 'ending_soon', 'ended', 'terminated', 'renewed',
  ]
  const statusData = statusOrder
    .map(s => ({ status: s, ...(stats.byStatus.get(s) || { count: 0, value: 0 }) }))
    .filter(d => d.count > 0)
  const maxStatusCount = Math.max(...statusData.map(d => d.count), 1)
  const maxClientValue = Math.max(...stats.topClients.map(([_, v]) => v.value), 1)

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-semibold">Dashboard — Contratos</h1>
            <p className="text-sm text-muted-foreground">
              Gestão jurídica · {stats.total} {stats.total === 1 ? 'contrato' : 'contratos'} no total
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/contracts">Ver lista</Link>
        </Button>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/contracts?status=active" className="block group">
          <Card className="p-4 group-hover:border-indigo-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase">Carteira ativa</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1">
              {formatCurrencyShort(stats.tcv, stats.currency)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.activeCount} {stats.activeCount === 1 ? 'contrato vigente' : 'contratos vigentes'}
            </div>
          </Card>
        </Link>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Vencendo 30d</span>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1 text-rose-700">
            {stats.expiring30.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatCurrencyShort(stats.expiring30.reduce((s, c) => s + (c.totalValue || 0), 0), stats.currency)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Vencendo 60d</span>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1 text-amber-700">
            {stats.expiring60.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            entre 31-60 dias
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Vencendo 90d</span>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1 text-orange-700">
            {stats.expiring90.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            entre 61-90 dias
          </div>
        </Card>
      </div>

      {stats.autoRenewExpiringCount > 0 && (
        <Alert>
          <AlertDescription className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <span>
              <strong>{stats.autoRenewExpiringCount}</strong> {stats.autoRenewExpiringCount === 1 ? 'contrato com renovação automática' : 'contratos com renovação automática'} vencendo em até 60 dias.
              Verificar se a renovação está confirmada com o cliente.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Vencimentos próximos — lista timeline */}
      {(stats.expiring30.length + stats.expiring60.length + stats.expiring90.length) > 0 && (
        <Card className="p-6 space-y-3">
          <div>
            <h2 className="font-semibold">Próximos vencimentos</h2>
            <p className="text-xs text-muted-foreground">
              Contratos vigentes ordenados por data de fim
            </p>
          </div>
          <ul className="space-y-2">
            {[...stats.expiring30, ...stats.expiring60, ...stats.expiring90]
              .sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''))
              .slice(0, 10)
              .map(c => {
                const days = daysUntil(c.endDate)!
                const color = days <= 30 ? 'text-rose-700' : days <= 60 ? 'text-amber-700' : 'text-orange-700'
                return (
                  <li key={c.id}>
                    <Link
                      to={`/contracts/${c.id}`}
                      className="flex items-center justify-between rounded border p-3 hover:bg-muted/30"
                    >
                      <div>
                        <span className="font-mono text-xs text-muted-foreground mr-2">{c.contractNumber}</span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="tabular-nums text-muted-foreground">
                          {formatCurrencyShort(c.totalValue, c.currency)}
                        </span>
                        <span className={`font-medium tabular-nums ${color}`}>
                          {days === 0 ? 'hoje' : `${days}d`}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
          </ul>
        </Card>
      )}

      {/* Distribuição por status */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Distribuição por status</h2>
          <p className="text-xs text-muted-foreground">Clique pra filtrar a lista</p>
        </div>
        <div className="space-y-3">
          {statusData.map(d => (
            <Link key={d.status} to={`/contracts?status=${d.status}`} className="block group">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{CONTRACT_STATUS_LABELS[d.status]}</span>
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
                  style={{ width: `${(d.count / maxStatusCount) * 100}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {/* Top clientes por valor da carteira ativa */}
      {stats.topClients.length > 0 && (
        <Card className="p-6 space-y-3">
          <div>
            <h2 className="font-semibold">Top clientes (carteira ativa)</h2>
            <p className="text-xs text-muted-foreground">Maior valor contratado</p>
          </div>
          <ul className="space-y-2">
            {stats.topClients.map(([clientId, data]) => {
              const pct = maxClientValue > 0 ? (data.value / maxClientValue) * 100 : 0
              return (
                <li key={clientId} className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span>Cliente #{clientId}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground tabular-nums">
                        {data.count} {data.count === 1 ? 'contrato' : 'contratos'}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatCurrencyShort(data.value, stats.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* Distribuição por tipo de contrato */}
      {stats.topTypes.length > 0 && (
        <Card className="p-6 space-y-3">
          <div>
            <h2 className="font-semibold">Tipos de contrato</h2>
            <p className="text-xs text-muted-foreground">Distribuição por valor</p>
          </div>
          <ul className="space-y-2">
            {stats.topTypes.map(([typeKey, data]) => {
              const pct = stats.tcv > 0 ? (data.value / stats.tcv) * 100 : 0
              return (
                <li key={typeKey} className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span>{typeKey}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground tabular-nums">
                        {data.count} · {pct.toFixed(0)}%
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatCurrencyShort(data.value, stats.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
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
