/**
 * Dashboard de Tarefas (Sprint #221).
 *
 * Filtros globais (afetam tudo):
 *   - Período (createdAt)        — Sempre / 7d / 30d / 90d / 1 ano
 *   - Responsável                 — combobox
 *   - Oportunidade                — combobox
 *
 * KPIs (top): total, % no prazo, atrasadas em aberto, tempo médio de
 * conclusão, throughput (concluídas no período).
 *
 * Gráficos:
 *   1. Throughput diário (criadas vs concluídas) — last 14d / 30d
 *   2. Status (volume + %)
 *   3. Aging do backlog (idade das em aberto)
 *   4. Dias de atraso (overdue em aberto agrupados)
 *   5. Top responsáveis (split open/done/atrasada)
 *   6. Prioridade (distribuição)
 *   7. Top 10 oportunidades com mais tarefas
 *
 * Tudo click-through: clicar leva a /tasks com filtro relevante.
 */
import { useMemo, useState } from 'react'
import {
  BarChart3, Filter, X, AlertTriangle, CheckCircle2,
  Clock, Hourglass, Users, Flame, Briefcase, TrendingUp,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import { useTasks } from '@/features/tasks/hooks/use-tasks'
import type { Task } from '@/features/tasks/types'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all',  label: 'Sempre' },
  { value: '7d',   label: '7 dias' },
  { value: '30d',  label: '30 dias' },
  { value: '90d',  label: '90 dias' },
  { value: '1y',   label: '1 ano' },
]

function periodCutoff(p: string): Date | null {
  const now = Date.now()
  switch (p) {
    case '7d':  return new Date(now - 7 * 86400000)
    case '30d': return new Date(now - 30 * 86400000)
    case '90d': return new Date(now - 90 * 86400000)
    case '1y':  return new Date(now - 365 * 86400000)
    default: return null
  }
}

function periodDays(p: string): number {
  switch (p) {
    case '7d':  return 7
    case '30d': return 30
    case '90d': return 90
    case '1y':  return 365
    default: return 30 /* fallback pra plot diário */
  }
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
}
const PRIORITY_COLOR: Record<string, string> = {
  low: '#94a3b8', medium: '#3b82f6', high: '#f97316', urgent: '#ef4444',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#3b82f6',
  in_progress: '#a855f7',
  todo: '#3b82f6',
  completed: '#10b981',
  cancelled: '#94a3b8',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  todo: 'A fazer',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000)
}

function formatDuration(days: number): string {
  if (days < 1) return 'menos de 1 dia'
  if (days < 30) return `${Math.round(days)} dia${days >= 2 ? 's' : ''}`
  if (days < 365) return `${(days / 30).toFixed(1)} meses`
  return `${(days / 365).toFixed(1)} anos`
}

export function TasksDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const appState = useAppState()
  const tenantUsers = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>
  const { data: opps = [] } = useOpportunities()
  const isMaster = user?.isMaster === true

  const [period, setPeriod] = useState<string>('30d')
  const [responsibleId, setResponsibleId] = useState<string>(isMaster ? '' : String(user?.id || ''))
  const [oppId, setOppId] = useState<string>('')

  /* Carrega tudo do tenant; filtra client-side. Volume <10k tasks e
     queremos os recortes em memória pra nao ressincronizar a cada filtro. */
  const { data: items = [], isLoading } = useTasks()

  /* Lookups */
  const userById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of tenantUsers) {
      if (u.id) m.set(String(u.id), u.name || u.email || '?')
    }
    return m
  }, [tenantUsers])

  const oppById = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of opps as any[]) m.set(String(o.id), o.name)
    return m
  }, [opps])

  /* Aplica filtros globais */
  const filtered: Task[] = useMemo(() => {
    const cutoff = periodCutoff(period)
    return items.filter(t => {
      if (cutoff && new Date(t.createdAt) < cutoff) return false
      if (responsibleId && !(t.responsibleIds || []).includes(responsibleId)) return false
      if (oppId && !(t.entityType === 'opportunity' && String(t.entityId) === oppId)) return false
      return true
    })
  }, [items, period, responsibleId, oppId])

  /* ── KPIs ──────────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const total = filtered.length
    const completed = filtered.filter(t => t.status === 'completed')
    const open = filtered.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    const now = new Date()
    const overdueOpen = open.filter(t => t.dueAt && new Date(t.dueAt) < now)
    /* On-time = completedAt <= dueAt; ignora completadas sem dueAt */
    const completedWithDue = completed.filter(t => t.dueAt && t.completedAt)
    const onTime = completedWithDue.filter(t => new Date(t.completedAt!) <= new Date(t.dueAt!))
    const onTimeRate = completedWithDue.length === 0 ? null : onTime.length / completedWithDue.length
    /* avg completion days */
    const completionDurations = completed
      .filter(t => t.completedAt && t.createdAt)
      .map(t => (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / 86400000)
    const avgCompletionDays = completionDurations.length === 0
      ? null
      : completionDurations.reduce((a, b) => a + b, 0) / completionDurations.length
    return {
      total, completedCount: completed.length, openCount: open.length,
      overdueOpenCount: overdueOpen.length, onTimeRate, avgCompletionDays,
    }
  }, [filtered])

  /* ── Series: throughput diário (criadas vs concluídas) ─────────── */
  const throughput = useMemo(() => {
    const days = Math.min(periodDays(period), 60) /* cap visual em 60 buckets */
    const keys: string[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      keys.push(d.toISOString().slice(0, 10))
    }
    const created = new Map<string, number>(keys.map(k => [k, 0]))
    const done = new Map<string, number>(keys.map(k => [k, 0]))
    for (const t of filtered) {
      const c = dayKey(t.createdAt)
      if (created.has(c)) created.set(c, created.get(c)! + 1)
      if (t.completedAt) {
        const d = dayKey(t.completedAt)
        if (done.has(d)) done.set(d, done.get(d)! + 1)
      }
    }
    return keys.map(k => ({ key: k, created: created.get(k) || 0, done: done.get(k) || 0 }))
  }, [filtered, period])

  const throughputMax = Math.max(1, ...throughput.flatMap(r => [r.created, r.done]))

  /* ── Status (donut + lista) ─────────────────────────────────────── */
  const byStatus = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of filtered) m.set(t.status, (m.get(t.status) || 0) + 1)
    return Array.from(m.entries())
      .map(([status, count]) => ({ status, count, label: STATUS_LABEL[status] || status, color: STATUS_COLOR[status] || '#6b7280' }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  /* ── Aging do backlog ──────────────────────────────────────────── */
  const aging = useMemo(() => {
    const now = new Date()
    const buckets = [
      { key: '0-7',   label: '0–7 dias',     min: 0,   max: 7,   color: '#10b981' },
      { key: '8-30',  label: '8–30 dias',    min: 8,   max: 30,  color: '#3b82f6' },
      { key: '31-90', label: '31–90 dias',   min: 31,  max: 90,  color: '#f59e0b' },
      { key: '90+',   label: '90+ dias',     min: 91,  max: 1e9, color: '#ef4444' },
    ]
    const counts = new Map(buckets.map(b => [b.key, 0]))
    for (const t of filtered) {
      if (t.status === 'completed' || t.status === 'cancelled') continue
      const d = daysBetween(new Date(t.createdAt), now)
      const b = buckets.find(x => d >= x.min && d <= x.max)!
      counts.set(b.key, (counts.get(b.key) || 0) + 1)
    }
    return buckets.map(b => ({ ...b, count: counts.get(b.key) || 0 }))
  }, [filtered])

  const agingMax = Math.max(1, ...aging.map(a => a.count))

  /* ── Atrasadas por dias de atraso ──────────────────────────────── */
  const overdueByLateness = useMemo(() => {
    const now = new Date()
    const buckets = [
      { key: '1-3',   label: '1–3 dias',   min: 1,   max: 3,   color: '#fbbf24' },
      { key: '4-7',   label: '4–7 dias',   min: 4,   max: 7,   color: '#fb923c' },
      { key: '8-30',  label: '8–30 dias',  min: 8,   max: 30,  color: '#f97316' },
      { key: '30+',   label: '30+ dias',   min: 31,  max: 1e9, color: '#dc2626' },
    ]
    const counts = new Map(buckets.map(b => [b.key, 0]))
    for (const t of filtered) {
      if (t.status === 'completed' || t.status === 'cancelled') continue
      if (!t.dueAt) continue
      const d = daysBetween(new Date(t.dueAt), now)
      if (d < 1) continue
      const b = buckets.find(x => d >= x.min && d <= x.max)!
      counts.set(b.key, (counts.get(b.key) || 0) + 1)
    }
    return buckets.map(b => ({ ...b, count: counts.get(b.key) || 0 }))
  }, [filtered])

  const overdueMax = Math.max(1, ...overdueByLateness.map(a => a.count))

  /* ── Top responsáveis (split open/done/atrasada) ───────────────── */
  const byResponsible = useMemo(() => {
    const now = new Date()
    const m = new Map<string, { id: string; name: string; total: number; open: number; done: number; overdue: number }>()
    for (const t of filtered) {
      const id = (t.responsibleIds || [])[0]
      if (!id) continue
      const name = userById.get(String(id)) || '—'
      const cur = m.get(id) || { id, name, total: 0, open: 0, done: 0, overdue: 0 }
      cur.total++
      if (t.status === 'completed') cur.done++
      else if (t.status !== 'cancelled') {
        cur.open++
        if (t.dueAt && new Date(t.dueAt) < now) cur.overdue++
      }
      m.set(id, cur)
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [filtered, userById])

  const respMax = Math.max(1, ...byResponsible.map(r => r.total))

  /* ── Prioridade ────────────────────────────────────────────────── */
  const byPriority = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of filtered) m.set(t.priority || 'medium', (m.get(t.priority || 'medium') || 0) + 1)
    return ['low', 'medium', 'high', 'urgent']
      .map(p => ({ priority: p, label: PRIORITY_LABEL[p], color: PRIORITY_COLOR[p], count: m.get(p) || 0 }))
  }, [filtered])

  const priorityMax = Math.max(1, ...byPriority.map(p => p.count))

  /* ── Top oportunidades ─────────────────────────────────────────── */
  const byOpp = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of filtered) {
      if (t.entityType !== 'opportunity' || !t.entityId) continue
      const id = String(t.entityId)
      m.set(id, (m.get(id) || 0) + 1)
    }
    return Array.from(m.entries())
      .map(([id, count]) => ({ id, name: oppById.get(id) || `#${id}`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filtered, oppById])

  const oppMax = Math.max(1, ...byOpp.map(o => o.count))

  /* ── Helpers de navegação ─────────────────────────────────────── */
  function goToTasks(qs: Record<string, string>) {
    const p = new URLSearchParams(qs)
    navigate(`/tasks${p.toString() ? '?' + p.toString() : ''}`)
  }

  /* ────────────────────────────────────────────────────────────── */

  return (
    <div className="w-full space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BarChart3 className="h-5 w-5" /> Dashboard de Tarefas
          </h1>
          <p className="text-sm text-muted-foreground">
            Insights operacionais sobre criação, conclusão e backlog. Os filtros abaixo afetam todos os gráficos.
          </p>
        </div>
        <Link
          to="/tasks"
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Voltar pra lista
        </Link>
      </div>

      {/* Filtros */}
      <Card className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Filter className="h-3 w-3" /> Período
          </span>
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                period === p.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Responsável:</span>
            <select
              value={responsibleId}
              onChange={e => setResponsibleId(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="">Todos</option>
              {tenantUsers.map(u => (
                <option key={u.id} value={String(u.id)}>{u.name || u.email}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Oportunidade:</span>
            <select
              value={oppId}
              onChange={e => setOppId(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs max-w-[280px]"
            >
              <option value="">Todas</option>
              {(opps as any[]).map(o => (
                <option key={o.id} value={String(o.id)}>{o.name}</option>
              ))}
            </select>
          </div>
          {(responsibleId || oppId || period !== 'all') && (
            <button
              type="button"
              onClick={() => { setResponsibleId(''); setOppId(''); setPeriod('all') }}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Limpar filtros
            </button>
          )}
        </div>
      </Card>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            icon={<Briefcase className="h-4 w-4" />}
            label="Total no período"
            value={String(kpis.total)}
            sub={`${kpis.openCount} em aberto · ${kpis.completedCount} concluídas`}
            tone="indigo"
            onClick={() => goToTasks({})}
          />
          <KpiCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="No prazo"
            value={kpis.onTimeRate === null ? '—' : `${Math.round(kpis.onTimeRate * 100)}%`}
            sub="das concluídas com prazo"
            tone="emerald"
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Atrasadas em aberto"
            value={String(kpis.overdueOpenCount)}
            sub={kpis.openCount > 0 ? `${Math.round((kpis.overdueOpenCount / kpis.openCount) * 100)}% do backlog` : 'sem backlog'}
            tone="red"
            onClick={() => goToTasks({ status: 'open', overdue: '1' })}
          />
          <KpiCard
            icon={<Hourglass className="h-4 w-4" />}
            label="Tempo médio até concluir"
            value={kpis.avgCompletionDays === null ? '—' : formatDuration(kpis.avgCompletionDays)}
            sub="média histórica"
            tone="amber"
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Throughput"
            value={String(kpis.completedCount)}
            sub="concluídas no período"
            tone="blue"
          />
        </div>
      )}

      {/* Linha 2 — Throughput + Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <div>
            <h3 className="font-semibold">Throughput diário</h3>
            <p className="text-xs text-muted-foreground">Tarefas criadas vs concluídas</p>
          </div>
          {isLoading ? <Skeleton className="h-40" /> : (
            <div className="flex items-end gap-px h-40 border-b border-border pl-1">
              {throughput.map(d => (
                <div key={d.key} className="flex-1 flex items-end gap-px h-full" title={`${d.key}: ${d.created} criadas / ${d.done} concluídas`}>
                  <div
                    className="flex-1 rounded-t-sm bg-blue-500/80 hover:bg-blue-500 transition-all"
                    style={{ height: `${(d.created / throughputMax) * 100}%` }}
                  />
                  <div
                    className="flex-1 rounded-t-sm bg-emerald-500/80 hover:bg-emerald-500 transition-all"
                    style={{ height: `${(d.done / throughputMax) * 100}%` }}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-500/80" /> Criadas</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500/80" /> Concluídas</span>
            <span className="ml-auto tabular-nums">{throughput.length} dias</span>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <div>
            <h3 className="font-semibold">Distribuição por status</h3>
            <p className="text-xs text-muted-foreground">Volume e percentual por status</p>
          </div>
          {isLoading ? <Skeleton className="h-32" /> : byStatus.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem dados.</div>
          ) : (
            <div className="space-y-2.5">
              {byStatus.map(s => {
                const pct = (s.count / kpis.total) * 100
                return (
                  <button
                    key={s.status}
                    type="button"
                    onClick={() => goToTasks({ status: s.status })}
                    className="w-full text-left group"
                  >
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium group-hover:text-foreground">{s.label}</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{s.count}</span> · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-muted/30">
                      <div className="h-2 rounded transition-all group-hover:opacity-80" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Linha 3 — Aging + Atraso */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Aging do backlog</h3>
              <p className="text-xs text-muted-foreground">Idade das tarefas em aberto (criação)</p>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <BarBuckets buckets={aging} max={agingMax} />
          <p className="text-xs text-muted-foreground">
            {aging.find(b => b.key === '90+')!.count > 0
              ? <span className="text-red-600 dark:text-red-400 font-medium">⚠ Há tarefas em aberto há mais de 90 dias — considere fechar ou repactuar.</span>
              : 'Backlog saudável (nada com mais de 90 dias).'}
          </p>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Atrasadas por tempo</h3>
              <p className="text-xs text-muted-foreground">Em aberto + dueAt no passado</p>
            </div>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </div>
          <BarBuckets buckets={overdueByLateness} max={overdueMax} />
          <p className="text-xs text-muted-foreground">
            {overdueByLateness.reduce((a, b) => a + b.count, 0) === 0
              ? 'Nenhuma atrasada. 🎉'
              : `Total ${overdueByLateness.reduce((a, b) => a + b.count, 0)} atrasada(s) em aberto.`}
          </p>
        </Card>
      </div>

      {/* Linha 4 — Responsáveis + Prioridade */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Top responsáveis</h3>
              <p className="text-xs text-muted-foreground">Carga distribuída — splitando aberto / concluído / atrasado</p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          {isLoading ? <Skeleton className="h-40" /> : byResponsible.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem responsáveis com tarefas no período.</div>
          ) : (
            <div className="space-y-2">
              {byResponsible.map(r => {
                const openPct = (r.open - r.overdue) / respMax * 100
                const overduePct = r.overdue / respMax * 100
                const donePct = r.done / respMax * 100
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => goToTasks({ responsibleId: r.id })}
                    className="group w-full text-left"
                  >
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium group-hover:text-foreground">{r.name}</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{r.total}</span>
                        {r.overdue > 0 && <span className="ml-2 text-red-600 dark:text-red-400">⚠ {r.overdue}</span>}
                      </span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded bg-muted/30">
                      <div className="h-full bg-blue-500/80" style={{ width: `${openPct}%` }} title={`${r.open - r.overdue} em aberto`} />
                      <div className="h-full bg-red-500/80" style={{ width: `${overduePct}%` }} title={`${r.overdue} atrasadas`} />
                      <div className="h-full bg-emerald-500/80" style={{ width: `${donePct}%` }} title={`${r.done} concluídas`} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500/80" /> Em aberto</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500/80" /> Atrasadas</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/80" /> Concluídas</span>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <div>
            <h3 className="font-semibold">Prioridade</h3>
            <p className="text-xs text-muted-foreground">Distribuição no período</p>
          </div>
          {isLoading ? <Skeleton className="h-40" /> : (
            <div className="space-y-2">
              {byPriority.map(p => (
                <div key={p.priority}>
                  <div className="mb-0.5 flex items-center justify-between text-sm">
                    <span style={{ color: p.color }} className="font-medium">{p.label}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">{p.count}</span>
                  </div>
                  <div className="h-2 w-full rounded bg-muted/30">
                    <div className="h-2 rounded transition-all" style={{ width: `${(p.count / priorityMax) * 100}%`, backgroundColor: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Linha 5 — Top oportunidades */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Top oportunidades por tarefas</h3>
            <p className="text-xs text-muted-foreground">Onde a equipe está investindo mais esforço operacional</p>
          </div>
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </div>
        {isLoading ? <Skeleton className="h-32" /> : byOpp.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Sem tarefas vinculadas a oportunidades no período.</div>
        ) : (
          <div className="space-y-2">
            {byOpp.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => navigate(`/opportunities/${o.id}`)}
                className="w-full text-left group"
              >
                <div className="mb-0.5 flex items-center justify-between text-sm">
                  <span className="line-clamp-1 font-medium group-hover:text-foreground">{o.name}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">{o.count}</span>
                </div>
                <div className="h-2 w-full rounded bg-muted/30">
                  <div className="h-2 rounded bg-indigo-500/80 transition-all group-hover:bg-indigo-500" style={{ width: `${(o.count / oppMax) * 100}%` }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ── Subcomponentes ───────────────────────────────────────────────── */

function KpiCard(props: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone: 'emerald' | 'red' | 'amber' | 'blue' | 'indigo'
  onClick?: () => void
}) {
  const tones: Record<string, string> = {
    emerald: 'from-emerald-50 to-emerald-100/40 dark:from-emerald-950/40 dark:to-emerald-900/20 border-emerald-200/50 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400',
    red:     'from-red-50 to-red-100/40 dark:from-red-950/40 dark:to-red-900/20 border-red-200/50 dark:border-red-900/50 text-red-700 dark:text-red-400',
    amber:   'from-amber-50 to-amber-100/40 dark:from-amber-950/40 dark:to-amber-900/20 border-amber-200/50 dark:border-amber-900/50 text-amber-700 dark:text-amber-400',
    blue:    'from-blue-50 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-900/50 text-blue-700 dark:text-blue-400',
    indigo:  'from-indigo-50 to-indigo-100/40 dark:from-indigo-950/40 dark:to-indigo-900/20 border-indigo-200/50 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400',
  }
  const cls = `relative flex flex-col gap-1 rounded-lg border bg-gradient-to-br p-3 ${tones[props.tone]} ${props.onClick ? 'cursor-pointer hover:shadow-md transition' : ''}`
  return (
    <div className={cls} onClick={props.onClick} role={props.onClick ? 'button' : undefined}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium opacity-80">{props.label}</span>
        <span className="opacity-60">{props.icon}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums">{props.value}</div>
      {props.sub && <div className="text-[11px] opacity-70">{props.sub}</div>}
    </div>
  )
}

function BarBuckets(props: { buckets: Array<{ key: string; label: string; count: number; color: string }>; max: number }) {
  return (
    <div className="space-y-2">
      {props.buckets.map(b => (
        <div key={b.key}>
          <div className="mb-0.5 flex items-center justify-between text-sm">
            <span className="font-medium">{b.label}</span>
            <span className="tabular-nums text-xs text-muted-foreground">{b.count}</span>
          </div>
          <div className="h-2 w-full rounded bg-muted/30">
            <div className="h-2 rounded transition-all" style={{ width: `${(b.count / props.max) * 100}%`, backgroundColor: b.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}
