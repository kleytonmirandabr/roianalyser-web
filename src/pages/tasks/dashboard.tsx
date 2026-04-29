/**
 * Dashboard de Tarefas — refino #5 (Sprint #223).
 *
 * Adicionado em cima do baseline:
 *   - ETA pra zerar backlog (footer do Cumulative Flow)
 *   - Higiene: cards "Sem prazo" / "Sem responsável" (clique abre lista filtrada)
 *   - Cycle time mediana + média + p90 (substitui "Tempo médio")
 *   - Date range customizado (inputs date além dos pills)
 *   - Heatmap responsável × prioridade × atrasadas
 */
import { Fragment, useMemo, useState } from 'react'
import {
  BarChart3, Filter, X, AlertTriangle, CheckCircle2,
  Clock, Hourglass, Users, Flame, Briefcase, TrendingUp,
  ArrowUp, ArrowDown, Minus, PartyPopper, Activity,
  CalendarRange, Target, AlertCircle, UserX,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import { useTasks } from '@/features/tasks/hooks/use-tasks'
import type { Task } from '@/features/tasks/types'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all',  label: 'Sempre' },
  { value: '7d',   label: '7 dias' },
  { value: '30d',  label: '30 dias' },
  { value: '90d',  label: '90 dias' },
  { value: '1y',   label: '1 ano' },
  { value: 'custom', label: 'Custom' },
]

interface Window { start: Date | null; end: Date | null }

function periodWindow(p: string, customStart: string, customEnd: string): Window {
  if (p === 'custom') {
    return {
      start: customStart ? new Date(customStart + 'T00:00:00') : null,
      end: customEnd ? new Date(customEnd + 'T23:59:59') : null,
    }
  }
  const now = Date.now()
  switch (p) {
    case '7d':  return { start: new Date(now - 7 * 86400000), end: null }
    case '30d': return { start: new Date(now - 30 * 86400000), end: null }
    case '90d': return { start: new Date(now - 90 * 86400000), end: null }
    case '1y':  return { start: new Date(now - 365 * 86400000), end: null }
    default:    return { start: null, end: null }
  }
}

function previousPeriodWindow(p: string, w: Window): Window | null {
  if (p === 'all') return null
  if (!w.start) return null
  const end = w.end ?? new Date()
  const len = end.getTime() - w.start.getTime()
  return {
    start: new Date(w.start.getTime() - len),
    end: new Date(w.start.getTime()),
  }
}

function periodDays(p: string, w: Window): number {
  if (w.start && w.end) {
    return Math.max(1, Math.ceil((w.end.getTime() - w.start.getTime()) / 86400000))
  }
  if (w.start) {
    return Math.ceil((Date.now() - w.start.getTime()) / 86400000)
  }
  switch (p) {
    case '7d':  return 7
    case '30d': return 30
    case '90d': return 90
    case '1y':  return 365
    default: return 30
  }
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
}
const PRIORITY_COLOR: Record<string, string> = {
  low: '#94a3b8', medium: '#3b82f6', high: '#f97316', urgent: '#ef4444',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#3b82f6', in_progress: '#a855f7', todo: '#3b82f6',
  completed: '#10b981', cancelled: '#94a3b8',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', todo: 'A fazer', in_progress: 'Em andamento',
  completed: 'Concluída', cancelled: 'Cancelada',
}

function dayKey(iso: string): string { return new Date(iso).toISOString().slice(0, 10) }
function dayKeyFromDate(d: Date): string { return d.toISOString().slice(0, 10) }
function daysBetween(a: Date, b: Date): number { return Math.floor((b.getTime() - a.getTime()) / 86400000) }

function formatDuration(days: number): string {
  if (days < 1) return 'menos de 1 dia'
  if (days < 30) return `${Math.round(days)} dia${days >= 2 ? 's' : ''}`
  if (days < 365) return `${(days / 30).toFixed(1)} meses`
  return `${(days / 365).toFixed(1)} anos`
}

function dayRange(days: number, end: Date = new Date()): string[] {
  const out: string[] = []
  const last = new Date(end)
  last.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(last)
    d.setDate(last.getDate() - i)
    out.push(dayKeyFromDate(d))
  }
  return out
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

function percentile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null
  const s = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil(p * s.length) - 1
  return s[Math.max(0, Math.min(s.length - 1, idx))]
}

function computeKpis(items: Task[]) {
  const total = items.length
  const completed = items.filter(t => t.status === 'completed')
  const open = items.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const now = new Date()
  const overdueOpen = open.filter(t => t.dueAt && new Date(t.dueAt) < now)
  const completedWithDue = completed.filter(t => t.dueAt && t.completedAt)
  const onTime = completedWithDue.filter(t => new Date(t.completedAt!) <= new Date(t.dueAt!))
  const onTimeRate = completedWithDue.length === 0 ? null : onTime.length / completedWithDue.length

  const completionDurations = completed
    .filter(t => t.completedAt && t.createdAt)
    .map(t => (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / 86400000)
  const avgDays = completionDurations.length === 0 ? null : completionDurations.reduce((a, b) => a + b, 0) / completionDurations.length
  const medianDays = median(completionDurations)
  const p90Days = percentile(completionDurations, 0.9)

  const noDueOpen = open.filter(t => !t.dueAt).length
  const noResp = items.filter(t => !((t.responsibleIds || []).length)).length

  return {
    total, completedCount: completed.length, openCount: open.length,
    overdueOpenCount: overdueOpen.length, onTimeRate,
    avgCompletionDays: avgDays, medianCompletionDays: medianDays, p90CompletionDays: p90Days,
    noDueOpen, noResp,
  }
}

export function TasksDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const appState = useAppState()
  const tenantUsers = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>
  const { data: opps = [] } = useOpportunities()
  const isMaster = user?.isMaster === true

  const [period, setPeriod] = useState<string>('30d')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [responsibleIds, setResponsibleIds] = useState<string[]>(
    isMaster ? [] : (user?.id ? [String(user.id)] : []),
  )
  const [oppIds, setOppIds] = useState<string[]>([])

  const { data: items = [], isLoading } = useTasks()

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

  const win = useMemo(() => periodWindow(period, customStart, customEnd), [period, customStart, customEnd])

  function inWindow(t: Task, w: Window): boolean {
    const c = new Date(t.createdAt)
    if (w.start && c < w.start) return false
    if (w.end && c > w.end) return false
    return true
  }
  function passesUserOpp(t: Task): boolean {
    /* Multi-escolha: se nada selecionado, passa todos. Se há seleção, a task
       precisa ter ao menos um responsável/opp casando. */
    if (responsibleIds.length > 0) {
      const taskResp = t.responsibleIds || []
      if (!taskResp.some(id => responsibleIds.includes(String(id)))) return false
    }
    if (oppIds.length > 0) {
      if (t.entityType !== 'opportunity' || !oppIds.includes(String(t.entityId))) return false
    }
    return true
  }

  const filtered: Task[] = useMemo(
    () => items.filter(t => inWindow(t, win) && passesUserOpp(t)),
    [items, win, responsibleIds, oppIds],
  )

  const previous: Task[] | null = useMemo(() => {
    const prev = previousPeriodWindow(period, win)
    if (!prev) return null
    return items.filter(t => inWindow(t, prev) && passesUserOpp(t))
  }, [items, period, win, responsibleIds, oppIds])

  const kpis = useMemo(() => computeKpis(filtered), [filtered])
  const kpisPrev = useMemo(() => previous ? computeKpis(previous) : null, [previous])

  /* Sparklines: 14 dias atrás. */
  const sparkSeries = useMemo(() => {
    const days = dayRange(14)
    const created = new Map(days.map(d => [d, 0]))
    const done = new Map(days.map(d => [d, 0]))
    const overdueDay = new Map(days.map(d => [d, 0]))
    for (const t of filtered) {
      const c = dayKey(t.createdAt)
      if (created.has(c)) created.set(c, created.get(c)! + 1)
      if (t.completedAt) {
        const dk = dayKey(t.completedAt)
        if (done.has(dk)) done.set(dk, done.get(dk)! + 1)
      }
    }
    for (const t of filtered) {
      if (!t.dueAt) continue
      const dk = dayKey(t.dueAt)
      if (!overdueDay.has(dk)) continue
      const completedBeforeDay = t.completedAt && new Date(t.completedAt).toISOString().slice(0, 10) <= dk
      if (!completedBeforeDay) overdueDay.set(dk, overdueDay.get(dk)! + 1)
    }
    return {
      created: days.map(d => created.get(d)!),
      done: days.map(d => done.get(d)!),
      overdue: days.map(d => overdueDay.get(d)!),
    }
  }, [filtered])

  /* ETA pra zerar backlog: throughput médio dos últimos 7 dias × backlog atual. */
  const eta = useMemo(() => {
    const last7Done = sparkSeries.done.slice(-7)
    const sum = last7Done.reduce((a, b) => a + b, 0)
    if (sum === 0) return null
    const ratePerDay = sum / 7
    /* Backlog: tasks abertas no momento (ignorando filtro de período pra ser realista — backlog é estado, não fluxo). */
    const backlogNow = items.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && passesUserOpp(t)).length
    if (backlogNow === 0) return { ratePerDay, backlogNow, etaDays: 0 }
    return { ratePerDay, backlogNow, etaDays: backlogNow / ratePerDay }
  }, [sparkSeries.done, items, responsibleIds, oppIds])

  /* Throughput diário (visualização principal). */
  const throughput = useMemo(() => {
    const days = Math.min(periodDays(period, win), 60)
    const endDate = win.end ?? new Date()
    const keys = dayRange(days, endDate)
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
  }, [filtered, period, win])

  const throughputMax = Math.max(1, ...throughput.flatMap(r => [r.created, r.done]))

  /* Cumulative Flow / Burndown. */
  const flow = useMemo(() => {
    const days = Math.min(periodDays(period, win), 60)
    const endDate = win.end ?? new Date()
    const keys = dayRange(days, endDate)
    return keys.map(k => {
      const endOfDay = new Date(k + 'T23:59:59Z').getTime()
      let open = 0
      let createdCum = 0
      let doneCum = 0
      for (const t of filtered) {
        const c = new Date(t.createdAt).getTime()
        if (c > endOfDay) continue
        createdCum++
        const completed = t.completedAt ? new Date(t.completedAt).getTime() : null
        if (t.status === 'cancelled') continue
        if (completed !== null && completed <= endOfDay) doneCum++
        else open++
      }
      return { key: k, open, createdCum, doneCum }
    })
  }, [filtered, period, win])

  const flowMax = Math.max(1, ...flow.map(f => Math.max(f.createdCum, f.open)))

  /* Status. */
  const byStatus = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of filtered) m.set(t.status, (m.get(t.status) || 0) + 1)
    return Array.from(m.entries())
      .map(([status, count]) => ({ status, count, label: STATUS_LABEL[status] || status, color: STATUS_COLOR[status] || '#6b7280' }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  /* Aging. */
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

  /* Atrasadas. */
  const overdueByLateness = useMemo(() => {
    const now = new Date()
    const buckets = [
      { key: '<1',    label: 'Menos de 1 dia',  min: 0,   max: 0,   color: '#fde68a' },
      { key: '1-3',   label: '1–3 dias',        min: 1,   max: 3,   color: '#fbbf24' },
      { key: '4-7',   label: '4–7 dias',        min: 4,   max: 7,   color: '#fb923c' },
      { key: '8-30',  label: '8–30 dias',       min: 8,   max: 30,  color: '#f97316' },
      { key: '30+',   label: '30+ dias',        min: 31,  max: 1e9, color: '#dc2626' },
    ]
    const counts = new Map(buckets.map(b => [b.key, 0]))
    for (const t of filtered) {
      if (t.status === 'completed' || t.status === 'cancelled') continue
      if (!t.dueAt) continue
      const dueMs = new Date(t.dueAt).getTime()
      if (dueMs >= now.getTime()) continue
      const d = Math.floor((now.getTime() - dueMs) / 86400000)
      const b = buckets.find(x => d >= x.min && d <= x.max)!
      counts.set(b.key, (counts.get(b.key) || 0) + 1)
    }
    return buckets.map(b => ({ ...b, count: counts.get(b.key) || 0 }))
  }, [filtered])
  const overdueMax = Math.max(1, ...overdueByLateness.map(a => a.count))
  const totalOverdue = overdueByLateness.reduce((a, b) => a + b.count, 0)

  /* Top responsáveis. */
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

  /* Heatmap responsável × prioridade × atrasadas. */
  const heatmap = useMemo(() => {
    const now = new Date()
    const respIds = byResponsible.slice(0, 8).map(r => r.id)
    if (respIds.length === 0) return null
    const matrix: number[][] = respIds.map(() => PRIORITIES.map(() => 0))
    for (const t of filtered) {
      if (t.status === 'completed' || t.status === 'cancelled') continue
      if (!t.dueAt || new Date(t.dueAt) >= now) continue
      const id = (t.responsibleIds || [])[0]
      if (!id) continue
      const r = respIds.indexOf(id)
      if (r < 0) continue
      const p = PRIORITIES.indexOf((t.priority || 'medium') as typeof PRIORITIES[number])
      if (p < 0) continue
      matrix[r][p]++
    }
    const max = Math.max(1, ...matrix.flat())
    const respMeta = respIds.map(id => ({
      id, name: userById.get(String(id)) || '—',
      total: matrix[respIds.indexOf(id)].reduce((a, b) => a + b, 0),
    }))
    return { respIds, respMeta, matrix, max }
  }, [filtered, byResponsible, userById])

  /* Prioridade. */
  const byPriority = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of filtered) m.set(t.priority || 'medium', (m.get(t.priority || 'medium') || 0) + 1)
    return PRIORITIES.map(p => ({ priority: p, label: PRIORITY_LABEL[p], color: PRIORITY_COLOR[p], count: m.get(p) || 0 }))
  }, [filtered])
  const priorityMax = Math.max(1, ...byPriority.map(p => p.count))

  /* Top oportunidades. */
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

  function goToTasks(qs: Record<string, string>) {
    const p = new URLSearchParams({ view: 'list', ...qs })
    navigate(`/tasks?${p.toString()}`)
  }

  const hasActiveFilter = responsibleIds.length > 0 || oppIds.length > 0 || period !== 'all'

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
        <Link to="/tasks" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
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
          {period === 'custom' && (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarRange className="h-3 w-3" />
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="rounded border border-input bg-background px-1.5 py-0.5 text-xs"
              />
              <span>até</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="rounded border border-input bg-background px-1.5 py-0.5 text-xs"
              />
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <MultiPickChips
            label="Responsáveis"
            placeholder="Todos"
            options={tenantUsers.filter(u => u.id).map(u => ({ value: String(u.id), label: u.name || u.email || String(u.id) }))}
            values={responsibleIds}
            onChange={setResponsibleIds}
          />
          <MultiPickChips
            label="Oportunidades"
            placeholder="Todas"
            options={(opps as any[]).map(o => ({ value: String(o.id), label: o.name }))}
            values={oppIds}
            onChange={setOppIds}
          />
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => { setResponsibleIds([]); setOppIds([]); setPeriod('all'); setCustomStart(''); setCustomEnd('') }}
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
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            icon={<Briefcase className="h-4 w-4" />}
            label="Total no período"
            value={String(kpis.total)}
            sub={`${kpis.openCount} em aberto · ${kpis.completedCount} concluídas`}
            tone="indigo"
            spark={sparkSeries.created}
            prev={kpisPrev?.total}
            current={kpis.total}
            higherIsBetter
            onClick={() => goToTasks({})}
          />
          <KpiCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="No prazo"
            value={kpis.onTimeRate === null ? 'n/d' : `${Math.round(kpis.onTimeRate * 100)}%`}
            sub={kpis.onTimeRate === null ? 'sem concluídas com prazo' : 'das concluídas com prazo'}
            tone="emerald"
            prev={kpisPrev?.onTimeRate ?? null}
            current={kpis.onTimeRate}
            higherIsBetter
            asPercent
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Atrasadas em aberto"
            value={String(kpis.overdueOpenCount)}
            sub={kpis.openCount > 0 ? `${Math.round((kpis.overdueOpenCount / kpis.openCount) * 100)}% do backlog` : 'sem backlog'}
            tone="red"
            spark={sparkSeries.overdue}
            prev={kpisPrev?.overdueOpenCount}
            current={kpis.overdueOpenCount}
            higherIsBetter={false}
            onClick={() => goToTasks({ status: 'open', overdue: '1' })}
          />
          <KpiCard
            icon={<Hourglass className="h-4 w-4" />}
            label="Mediana até concluir"
            value={kpis.medianCompletionDays === null ? 'n/d' : formatDuration(kpis.medianCompletionDays)}
            sub={
              kpis.medianCompletionDays === null
                ? 'sem concluídas'
                : `média ${kpis.avgCompletionDays != null ? formatDuration(kpis.avgCompletionDays) : 'n/d'} · p90 ${kpis.p90CompletionDays != null ? formatDuration(kpis.p90CompletionDays) : 'n/d'}`
            }
            tone="amber"
            prev={kpisPrev?.medianCompletionDays ?? null}
            current={kpis.medianCompletionDays}
            higherIsBetter={false}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Throughput"
            value={String(kpis.completedCount)}
            sub="concluídas no período"
            tone="blue"
            spark={sparkSeries.done}
            prev={kpisPrev?.completedCount}
            current={kpis.completedCount}
            higherIsBetter
          />
        </div>
      )}

      {/* Higiene */}
      {!isLoading && (kpis.noDueOpen > 0 || kpis.noResp > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kpis.noDueOpen > 0 && (
            <button
              type="button"
              onClick={() => goToTasks({ noDue: '1', status: 'open' })}
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/60 bg-amber-50 px-4 py-2.5 text-left transition hover:bg-amber-100/60 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
            >
              <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">{kpis.noDueOpen} tarefa{kpis.noDueOpen === 1 ? '' : 's'} sem prazo</div>
                  <div className="text-xs opacity-80">Sem dueAt — não entra em SLA nem aging.</div>
                </div>
              </div>
              <span className="text-xs text-amber-700 dark:text-amber-400">Ver lista →</span>
            </button>
          )}
          {kpis.noResp > 0 && (
            <button
              type="button"
              onClick={() => goToTasks({ noResp: '1' })}
              className="flex items-center justify-between gap-3 rounded-lg border border-rose-200/60 bg-rose-50 px-4 py-2.5 text-left transition hover:bg-rose-100/60 dark:border-rose-900/50 dark:bg-rose-950/30 dark:hover:bg-rose-950/50"
            >
              <div className="flex items-center gap-2.5 text-rose-800 dark:text-rose-300">
                <UserX className="h-4 w-4 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">{kpis.noResp} tarefa{kpis.noResp === 1 ? '' : 's'} sem responsável</div>
                  <div className="text-xs opacity-80">Não há quem atender — atribua antes de seguir.</div>
                </div>
              </div>
              <span className="text-xs text-rose-700 dark:text-rose-400">Ver lista →</span>
            </button>
          )}
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
                <Tooltip key={d.key}>
                  <TooltipTrigger asChild>
                    <div className="flex-1 flex items-end gap-px h-full cursor-default">
                      <div className="flex-1 rounded-t-sm bg-blue-500/80 hover:bg-blue-500 transition-all" style={{ height: `${(d.created / throughputMax) * 100}%` }} />
                      <div className="flex-1 rounded-t-sm bg-emerald-500/80 hover:bg-emerald-500 transition-all" style={{ height: `${(d.done / throughputMax) * 100}%` }} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="space-y-0.5 text-xs">
                      <div className="font-semibold">
                        {new Date(d.key + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-500" /> {d.created} criada{d.created === 1 ? '' : 's'}</div>
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> {d.done} concluída{d.done === 1 ? '' : 's'}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
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
                  <Tooltip key={s.status}>
                    <TooltipTrigger asChild>
                      <button type="button" onClick={() => goToTasks({ status: s.status })} className="w-full text-left group">
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
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {s.label}: <span className="font-semibold">{s.count}</span> ({pct.toFixed(1)}%) · clique para filtrar
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Linha 3 — Cumulative Flow + ETA */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Backlog ao longo do tempo</h3>
            <p className="text-xs text-muted-foreground">
              Tarefas em aberto no fim de cada dia (cumulative flow). Linha azul subindo = backlog crescendo,
              linha caindo = equipe drenando.
            </p>
          </div>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </div>
        {isLoading ? <Skeleton className="h-48" /> : (
          <CumulativeFlowChart flow={flow} max={flowMax} />
        )}
        {/* ETA */}
        {!isLoading && eta && (
          <div className="flex items-center gap-2 rounded-md border border-blue-200/60 bg-blue-50/60 px-3 py-2 text-xs dark:border-blue-900/50 dark:bg-blue-950/20">
            <Target className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
            {eta.backlogNow === 0 ? (
              <span><strong>Backlog zerado.</strong> Sem tarefas em aberto pra esses filtros.</span>
            ) : (
              <span>
                Ao ritmo de <strong>{eta.ratePerDay.toFixed(1)} tarefa{eta.ratePerDay >= 2 ? 's' : ''}/dia</strong> (média dos últimos 7 dias),
                o backlog atual de <strong>{eta.backlogNow}</strong> zera em <strong>{formatDuration(eta.etaDays)}</strong>.
              </span>
            )}
          </div>
        )}
        {!isLoading && !eta && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/20">
            <Target className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>Throughput zero nos últimos 7 dias — backlog não está sendo drenado.</span>
          </div>
        )}
      </Card>

      {/* Linha 4 — Aging + Atraso */}
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
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {aging.find(b => b.key === '90+')!.count > 0 ? (
              <>
                <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                <span className="text-red-600 dark:text-red-400 font-medium">
                  Há tarefas em aberto há mais de 90 dias — considere fechar ou repactuar.
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span>Backlog saudável (nada com mais de 90 dias).</span>
              </>
            )}
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
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {totalOverdue === 0 ? (
              <>
                <PartyPopper className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span>Nenhuma atrasada.</span>
              </>
            ) : (
              <span>Total {totalOverdue} atrasada(s) em aberto.</span>
            )}
          </p>
        </Card>
      </div>

      {/* Linha 5 — Heatmap responsável × prioridade × atrasadas */}
      {heatmap && totalOverdue > 0 && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Atrasadas por responsável e prioridade</h3>
              <p className="text-xs text-muted-foreground">
                Onde investir atenção primeiro. Intensidade = volume; números à direita são totais.
              </p>
            </div>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </div>
          <Heatmap
            respMeta={heatmap.respMeta}
            priorities={[...PRIORITIES] as string[]}
            matrix={heatmap.matrix}
            max={heatmap.max}
            onClickCell={(respId, _priority) => goToTasks({ status: 'open', overdue: '1', responsibleId: respId })}
          />
        </Card>
      )}

      {/* Linha 6 — Responsáveis + Prioridade */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Top responsáveis</h3>
              <p className="text-xs text-muted-foreground">Carga distribuída — splitando aberto / atrasado / concluído</p>
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
                  <Tooltip key={r.id}>
                    <TooltipTrigger asChild>
                      <button type="button" onClick={() => goToTasks({ responsibleId: r.id })} className="group w-full text-left">
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium group-hover:text-foreground">{r.name}</span>
                          <span className="inline-flex items-center gap-2 tabular-nums text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{r.total}</span>
                            {r.overdue > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
                                <AlertTriangle className="h-3 w-3" /> {r.overdue}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex h-2.5 w-full overflow-hidden rounded bg-muted/30">
                          <div className="h-full bg-blue-500/80" style={{ width: `${openPct}%` }} />
                          <div className="h-full bg-red-500/80" style={{ width: `${overduePct}%` }} />
                          <div className="h-full bg-emerald-500/80" style={{ width: `${donePct}%` }} />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <div className="space-y-0.5 text-xs">
                        <div className="font-semibold">{r.name}</div>
                        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-500" /> {r.open - r.overdue} em aberto</div>
                        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-500" /> {r.overdue} atrasada{r.overdue === 1 ? '' : 's'}</div>
                        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> {r.done} concluída{r.done === 1 ? '' : 's'}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
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
                <Tooltip key={p.priority}>
                  <TooltipTrigger asChild>
                    <div>
                      <div className="mb-0.5 flex items-center justify-between text-sm">
                        <span style={{ color: p.color }} className="font-medium">{p.label}</span>
                        <span className="tabular-nums text-xs text-muted-foreground">{p.count}</span>
                      </div>
                      <div className="h-2 w-full rounded bg-muted/30">
                        <div className="h-2 rounded transition-all" style={{ width: `${(p.count / priorityMax) * 100}%`, backgroundColor: p.color }} />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <span className="font-semibold">{p.label}</span>: {p.count} tarefa{p.count === 1 ? '' : 's'}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Linha 7 — Top oportunidades */}
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
              <Tooltip key={o.id}>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => navigate(`/opportunities/${o.id}`)} className="w-full text-left group">
                    <div className="mb-0.5 flex items-center justify-between text-sm">
                      <span className="line-clamp-1 font-medium group-hover:text-foreground">{o.name}</span>
                      <span className="tabular-nums text-xs text-muted-foreground">{o.count}</span>
                    </div>
                    <div className="h-2 w-full rounded bg-muted/30">
                      <div className="h-2 rounded bg-indigo-500/80 transition-all group-hover:bg-indigo-500" style={{ width: `${(o.count / oppMax) * 100}%` }} />
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <div className="space-y-0.5 text-xs">
                    <div className="font-semibold">{o.name}</div>
                    <div>{o.count} tarefa{o.count === 1 ? '' : 's'} · clique para abrir</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ── Subcomponentes ───────────────────────────────────────────────── */

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone: 'emerald' | 'red' | 'amber' | 'blue' | 'indigo'
  spark?: number[]
  prev?: number | null
  current?: number | null
  higherIsBetter?: boolean
  asPercent?: boolean
  onClick?: () => void
}

function KpiCard(props: KpiCardProps) {
  const tones: Record<string, string> = {
    emerald: 'from-emerald-50 to-emerald-100/40 dark:from-emerald-950/40 dark:to-emerald-900/20 border-emerald-200/50 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400',
    red:     'from-red-50 to-red-100/40 dark:from-red-950/40 dark:to-red-900/20 border-red-200/50 dark:border-red-900/50 text-red-700 dark:text-red-400',
    amber:   'from-amber-50 to-amber-100/40 dark:from-amber-950/40 dark:to-amber-900/20 border-amber-200/50 dark:border-amber-900/50 text-amber-700 dark:text-amber-400',
    blue:    'from-blue-50 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-900/50 text-blue-700 dark:text-blue-400',
    indigo:  'from-indigo-50 to-indigo-100/40 dark:from-indigo-950/40 dark:to-indigo-900/20 border-indigo-200/50 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400',
  }
  const cls = `relative flex flex-col gap-1 rounded-lg border bg-gradient-to-br p-3 ${tones[props.tone]} ${props.onClick ? 'cursor-pointer hover:shadow-md transition' : ''}`

  const delta = useMemo(() => {
    if (props.prev == null || props.current == null) return null
    if (props.prev === 0 && props.current === 0) return null
    if (props.prev === 0) return { dir: 'up' as const, label: 'novo' }
    const diff = props.current - props.prev
    if (Math.abs(diff) < 1e-6) return { dir: 'flat' as const, label: '0%' }
    const dir = diff > 0 ? 'up' : 'down'
    if (props.asPercent) {
      const pp = (props.current - props.prev) * 100
      return { dir, label: `${pp >= 0 ? '+' : ''}${pp.toFixed(0)}pp` }
    }
    const pct = (diff / Math.abs(props.prev)) * 100
    return { dir, label: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` }
  }, [props.prev, props.current, props.asPercent])

  const deltaTone =
    delta == null ? 'text-muted-foreground'
    : delta.dir === 'flat' ? 'text-muted-foreground'
    : (delta.dir === 'up') === (props.higherIsBetter ?? true)
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400'

  return (
    <div className={cls} onClick={props.onClick} role={props.onClick ? 'button' : undefined}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium opacity-80">{props.label}</span>
        <span className="opacity-60">{props.icon}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums">{props.value}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          {props.sub && <div className="text-[11px] opacity-70">{props.sub}</div>}
          {delta && (
            <div className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${deltaTone}`}>
              {delta.dir === 'up' ? <ArrowUp className="h-3 w-3" /> : delta.dir === 'down' ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {delta.label} <span className="opacity-60 font-normal">vs anterior</span>
            </div>
          )}
        </div>
        {props.spark && props.spark.length > 0 && <Sparkline data={props.spark} tone={props.tone} />}
      </div>
    </div>
  )
}

function Sparkline({ data, tone }: { data: number[]; tone: KpiCardProps['tone'] }) {
  const max = Math.max(1, ...data)
  const w = 60
  const h = 18
  const step = data.length > 1 ? w / (data.length - 1) : 0
  const points = data.map((v, i) => `${(i * step).toFixed(2)},${(h - (v / max) * h).toFixed(2)}`).join(' ')
  const stroke: Record<string, string> = {
    emerald: '#10b981', red: '#ef4444', amber: '#f59e0b', blue: '#3b82f6', indigo: '#6366f1',
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-5 w-16 shrink-0 opacity-80" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={stroke[tone]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CumulativeFlowChart({ flow, max }: { flow: Array<{ key: string; open: number; createdCum: number; doneCum: number }>; max: number }) {
  if (flow.length === 0) return <div className="h-48 text-center text-sm text-muted-foreground py-12">Sem dados.</div>
  const w = 800
  const h = 180
  const step = flow.length > 1 ? w / (flow.length - 1) : 0
  const yScale = (v: number) => h - (v / max) * h

  const path = (key: 'open' | 'createdCum' | 'doneCum') =>
    flow.map((d, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${yScale(d[key]).toFixed(2)}`).join(' ')

  const area = [
    flow.map((d, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${yScale(d.createdCum).toFixed(2)}`).join(' '),
    flow.slice().reverse().map((d, i) => `L${((flow.length - 1 - i) * step).toFixed(2)},${yScale(d.doneCum).toFixed(2)}`).join(' '),
    'Z',
  ].join(' ')

  const labels = [flow[0], flow[Math.floor(flow.length / 2)], flow[flow.length - 1]]

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${w} ${h + 16}`} className="w-full h-48">
        {[0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1={0} x2={w} y1={h * (1 - p)} y2={h * (1 - p)} stroke="currentColor" className="text-muted-foreground/10" strokeWidth={1} />
        ))}
        <path d={area} fill="#3b82f6" fillOpacity={0.12} />
        <path d={path('createdCum')} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeLinecap="round" />
        <path d={path('doneCum')} fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinecap="round" />
        <path d={path('open')} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" />
        {flow.map((d, i) => (
          <g key={d.key}>
            <circle cx={i * step} cy={yScale(d.open)} r={3} fill="#3b82f6" className="opacity-0 hover:opacity-100" />
            <title>{`${new Date(d.key + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}: ${d.open} em aberto · ${d.createdCum} criadas acumulado · ${d.doneCum} concluídas acumulado`}</title>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={(i * w) / 2} y={h + 12} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="fill-muted-foreground text-[10px]">
            {new Date(l.key + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-blue-500" /> Em aberto (backlog)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-indigo-500" /> Criadas (acumulado)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-emerald-500" /> Concluídas (acumulado)</span>
      </div>
    </div>
  )
}

function BarBuckets(props: { buckets: Array<{ key: string; label: string; count: number; color: string }>; max: number }) {
  return (
    <div className="space-y-2">
      {props.buckets.map(b => (
        <Tooltip key={b.key}>
          <TooltipTrigger asChild>
            <div>
              <div className="mb-0.5 flex items-center justify-between text-sm">
                <span className="font-medium">{b.label}</span>
                <span className="tabular-nums text-xs text-muted-foreground">{b.count}</span>
              </div>
              <div className="h-2 w-full rounded bg-muted/30">
                <div className="h-2 rounded transition-all" style={{ width: `${(b.count / props.max) * 100}%`, backgroundColor: b.color }} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            <span className="font-semibold">{b.label}</span>: {b.count}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

interface HeatmapProps {
  respMeta: Array<{ id: string; name: string; total: number }>
  priorities: string[]
  matrix: number[][]
  max: number
  onClickCell?: (respId: string, priority: string) => void
}

function Heatmap({ respMeta, priorities, matrix, max, onClickCell }: HeatmapProps) {
  return (
    <div
      className="grid gap-1 text-xs"
      style={{ gridTemplateColumns: `minmax(140px, auto) repeat(${priorities.length}, minmax(56px, 1fr)) auto` }}
    >
      <div />
      {priorities.map(p => (
        <div key={p} className="px-2 py-1 text-center font-medium uppercase tracking-wide text-[10px] text-muted-foreground">
          {PRIORITY_LABEL[p] || p}
        </div>
      ))}
      <div className="px-2 py-1 text-right text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
      {respMeta.map((r, i) => (
        <Fragment key={r.id}>
          <div className="truncate px-2 py-1.5 font-medium text-foreground">{r.name}</div>
          {priorities.map((p, j) => {
            const v = matrix[i][j]
            const intensity = v / max
            return (
              <Tooltip key={p}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => v > 0 && onClickCell?.(r.id, p)}
                    disabled={v === 0}
                    className="rounded-sm px-2 py-1.5 text-center font-semibold tabular-nums transition hover:scale-105 disabled:cursor-default"
                    style={{
                      background: v === 0 ? 'transparent' : `rgba(220, 38, 38, ${0.15 + intensity * 0.65})`,
                      color: intensity > 0.55 ? 'white' : undefined,
                    }}
                  >
                    {v || '·'}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="space-y-0.5 text-xs">
                    <div className="font-semibold">{r.name}</div>
                    <div>{PRIORITY_LABEL[p]}: {v} atrasada{v === 1 ? '' : 's'}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
          <div className="px-2 py-1.5 text-right tabular-nums font-semibold text-muted-foreground">{r.total}</div>
        </Fragment>
      ))}
    </div>
  )
}

/* ── MultiPickChips: filtro multi-escolha (chips + dropdown pra adicionar) ──
   Inline pra não criar dependência shared antes de validar UX. */
interface MultiPickProps {
  label: string
  placeholder: string
  options: Array<{ value: string; label: string }>
  values: string[]
  onChange: (next: string[]) => void
}

function MultiPickChips({ label, placeholder, options, values, onChange }: MultiPickProps) {
  const labelByValue = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of options) m.set(o.value, o.label)
    return m
  }, [options])
  const available = useMemo(() => options.filter(o => !values.includes(o.value)), [options, values])

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {values.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">{placeholder}</span>
      ) : (
        values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {labelByValue.get(v) ?? v}
            <button
              type="button"
              onClick={() => onChange(values.filter(x => x !== v))}
              className="hover:text-primary/70"
              aria-label={`Remover ${labelByValue.get(v) ?? v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))
      )}
      {available.length > 0 && (
        <select
          value=""
          onChange={e => {
            const v = e.target.value
            if (v) onChange([...values, v])
          }}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground"
        >
          <option value="">+ adicionar</option>
          {available.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}
