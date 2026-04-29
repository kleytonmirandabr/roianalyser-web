/**
 * Dashboard de Oportunidades — Sprint #198 enriquecido.
 *
 * Filtros globais (afetam TODOS os gráficos e KPIs):
 *   - Moeda  (separamos totais por moeda — não consolidamos)
 *   - Período (criação)
 *   - Responsável
 *   - Empresa
 *
 * Gráficos:
 *   1. KPI cards (count, win rate, ganhas, perdidas) — por moeda do filtro
 *   2. Pipeline ativo total POR moeda (cards lado a lado)
 *   3. Funil de status (barras horizontais com volume + valor)
 *   4. Tendência mensal de criação (últimos 6 meses)
 *   5. Top 10 maiores oportunidades (na moeda do filtro)
 *   6. Distribuição por probabilidade (buckets 0-30 / 31-69 / ≥70)
 *   7. Distribuição por responsável (top 10)
 *   8. Mix de empresas (top 10 por valor)
 */
import { ChevronLeft, BarChart3, Filter, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import type { Opportunity } from '@/features/opportunities/types'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Skeleton } from '@/shared/ui/skeleton'
import { formatCurrencyShort, formatNumberCompact } from '@/shared/lib/format'

const PERIOD_OPTIONS = [
  { value: 'all',    label: 'Sempre' },
  { value: '7d',     label: 'Últimos 7 dias' },
  { value: '30d',    label: 'Últimos 30 dias' },
  { value: '90d',    label: 'Últimos 90 dias' },
  { value: '1y',     label: 'Último ano' },
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

export function OpportunitiesDashboardPage() {
  const [, setParams] = useSearchParams()
  const { data: items = [], isLoading } = useOpportunities()
  const { data: statuses = [] } = useOpportunityStatuses()
  const { data: companies = [] } = useCompanies()
  const appState = useAppState()
  const tenantUsers = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>

  // Filtros globais
  const [currency, setCurrency] = useState<string>('')
  const [period, setPeriod] = useState<string>('all')
  const [responsibleId, setResponsibleId] = useState<string>('')
  const [companyId, setCompanyId] = useState<string>('')

  const statusById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null; category: string | null }>()
    for (const s of statuses) m.set(s.id, { name: s.name, color: s.color, category: s.category })
    return m
  }, [statuses])

  const companyById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of (companies as any[])) m.set(String(c.id), c.name)
    return m
  }, [companies])

  const userById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of tenantUsers) {
      if (u.id) m.set(String(u.id), u.name || u.email || '?')
    }
    return m
  }, [tenantUsers])

  // Aplica filtros — antes de qualquer cálculo
  const filtered: Opportunity[] = useMemo(() => {
    const cutoff = periodCutoff(period)
    return items.filter(o => {
      if (currency && o.currency !== currency) return false
      if (responsibleId && String(o.responsibleId) !== responsibleId) return false
      if (companyId && String(o.companyId ?? '') !== companyId) return false
      if (cutoff && new Date(o.createdAt) < cutoff) return false
      return true
    })
  }, [items, currency, period, responsibleId, companyId])

  // KPIs (afetados por todos os filtros)
  const totals = useMemo(() => {
    let count = 0, gain = 0, loss = 0, inProgress = 0
    for (const op of filtered) {
      count++
      const cat = op.statusId ? statusById.get(op.statusId)?.category : null
      if (cat === 'gain') gain++
      else if (cat === 'loss') loss++
      else if (cat === 'in_progress' || cat === 'qualified') inProgress++
    }
    const winRate = (gain + loss) > 0 ? (gain / (gain + loss)) * 100 : 0
    return { count, gain, loss, inProgress, winRate }
  }, [filtered, statusById])

  // Pipeline total POR moeda (mesmo se filtro de moeda não estiver ativo, mostra todos)
  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>()
    for (const op of filtered) {
      const cur = op.currency || 'BRL'
      const e = m.get(cur) || { count: 0, value: 0 }
      e.count++
      if (op.estimatedValue) e.value += Number(op.estimatedValue)
      m.set(cur, e)
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value)
  }, [filtered])

  // Funil por status
  const byStatus = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null; count: number; value: number }>()
    for (const op of filtered) {
      if (!op.statusId) continue
      const st = statusById.get(op.statusId)
      if (!st) continue
      const cur = map.get(op.statusId) || { id: op.statusId, name: st.name, color: st.color, count: 0, value: 0 }
      cur.count += 1
      if (op.estimatedValue) cur.value += Number(op.estimatedValue)
      map.set(op.statusId, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [filtered, statusById])

  // Tendência mensal últimos 6 meses
  const monthlyTrend = useMemo(() => {
    const m = new Map<string, number>()
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      m.set(key, 0)
    }
    for (const op of filtered) {
      const d = new Date(op.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (m.has(key)) m.set(key, (m.get(key) ?? 0) + 1)
    }
    return [...m.entries()]
  }, [filtered])

  // Top 10 maiores (precisa de moeda — senão pega a moeda majoritária)
  const top10 = useMemo(() => {
    const cur = currency || (totalsByCurrency[0]?.[0] ?? 'BRL')
    return filtered
      .filter(o => o.currency === cur && o.estimatedValue != null)
      .sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0))
      .slice(0, 10)
      .map(o => ({ id: o.id, name: o.name, value: o.estimatedValue ?? 0, currency: o.currency }))
  }, [filtered, currency, totalsByCurrency])

  // Buckets de probabilidade
  const probBuckets = useMemo(() => {
    const buckets = { low: 0, mid: 0, high: 0, na: 0 }
    for (const op of filtered) {
      if (op.probability == null) buckets.na++
      else if (op.probability >= 70) buckets.high++
      else if (op.probability >= 31) buckets.mid++
      else buckets.low++
    }
    return buckets
  }, [filtered])

  // Top 10 responsáveis
  const byResponsible = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>()
    for (const op of filtered) {
      const k = String(op.responsibleId)
      const e = m.get(k) || { count: 0, value: 0 }
      e.count++
      if (op.estimatedValue) e.value += Number(op.estimatedValue)
      m.set(k, e)
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, name: userById.get(id) ?? '—', ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filtered, userById])

  // Top 10 empresas (por valor — só quando moeda do filtro tem valor)
  const byCompany = useMemo(() => {
    const cur = currency || (totalsByCurrency[0]?.[0] ?? 'BRL')
    const m = new Map<string, { count: number; value: number }>()
    for (const op of filtered) {
      if (op.currency !== cur) continue
      if (!op.companyId) continue
      const k = String(op.companyId)
      const e = m.get(k) || { count: 0, value: 0 }
      e.count++
      if (op.estimatedValue) e.value += Number(op.estimatedValue)
      m.set(k, e)
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, name: companyById.get(id) ?? '—', ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map(x => ({ ...x, currency: cur }))
  }, [filtered, currency, companyById, totalsByCurrency])

  const maxFunnelCount = Math.max(1, ...byStatus.map(b => b.count))
  const maxTrend = Math.max(1, ...monthlyTrend.map(([, c]) => c))
  const maxRespCount = Math.max(1, ...byResponsible.map(r => r.count))
  const maxCompanyValue = Math.max(1, ...byCompany.map(c => c.value))

  const filterCurrency = currency || (totalsByCurrency[0]?.[0] ?? 'BRL')
  const hasFilter = currency || period !== 'all' || responsibleId || companyId

  function clearFilters() {
    setCurrency(''); setPeriod('all'); setResponsibleId(''); setCompanyId('')
  }

  const currencyOptions = [
    { value: '', label: 'Todas' },
    ...[...new Set(items.map(o => o.currency))].sort().map(c => ({ value: c, label: c })),
  ]
  const responsibleOptions = [{ value: '', label: 'Todos' }, ...tenantUsers.filter(u => u.id).map(u => ({ value: String(u.id), label: u.name || u.email || '?' }))]
  const companyOptions = [{ value: '', label: 'Todas' }, ...(companies as any[]).map((c: any) => ({ value: String(c.id), label: c.name }))]

  return (
    <div className="space-y-6">
      <Link to="/opportunities" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" /> Lista
      </Link>
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Dashboard — Oportunidades</h1>
          <p className="text-sm text-muted-foreground">Funil comercial · {filtered.length} de {items.length} oportunidades</p>
        </div>
      </div>

      {/* Filtros globais */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros globais</span>
          {hasFilter && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="ml-auto"><X className="h-3 w-3 mr-1" /> Limpar</Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Moeda</label>
            <Combobox options={currencyOptions} value={currency} onChange={setCurrency} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Período (criação)</label>
            <Combobox options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Responsável</label>
            <Combobox options={responsibleOptions} value={responsibleId} onChange={setResponsibleId} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Empresa</label>
            <Combobox options={companyOptions} value={companyId} onChange={setCompanyId} />
          </div>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{totals.count}</div>
          <div className="text-xs text-muted-foreground">{totals.inProgress} em negociação</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Win rate</div>
          <div className="text-2xl font-bold text-green-600">{totals.winRate.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground">{totals.gain} ganhas / {totals.loss} perdidas</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Ganhas</div>
          <div className="text-2xl font-bold text-green-600">{totals.gain}</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Perdidas</div>
          <div className="text-2xl font-bold text-red-600">{totals.loss}</div>
        </Card>
      </div>

      {/* Pipeline por moeda */}
      <Card className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold">Pipeline por moeda</h3>
          <p className="text-xs text-muted-foreground">Sem consolidação cambial — cada moeda tem seu total isolado.</p>
        </div>
        {totalsByCurrency.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">Sem dados para os filtros aplicados.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {totalsByCurrency.map(([cur, v]) => (
              <div key={cur} className="rounded-md border bg-muted/20 p-3 space-y-1">
                <div className="text-xs uppercase font-semibold text-muted-foreground">{cur}</div>
                <div className="text-lg font-bold tabular-nums">{formatCurrencyShort(v.value, cur)}</div>
                <div className="text-xs text-muted-foreground">{v.count} oportunidades</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil */}
        <Card className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold">Funil comercial</h3>
            <p className="text-xs text-muted-foreground">Volume e valor por status (clique para filtrar lista)</p>
          </div>
          {isLoading ? <Skeleton className="h-32 w-full" /> : byStatus.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Sem oportunidades com status.</div>
          ) : (
            <div className="space-y-2">
              {byStatus.map((b) => (
                <button key={b.id} className="w-full text-left"
                  onClick={() => { const p = new URLSearchParams(); p.set('statusId', b.id); setParams(p); window.location.href = `/opportunities?statusId=${b.id}` }}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrencyShort(b.value, filterCurrency)} · <span className="text-foreground font-semibold">{formatNumberCompact(b.count)}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-muted/30 rounded">
                    <div className="h-2 rounded transition-all"
                      style={{ width: `${(b.count / maxFunnelCount) * 100}%`, backgroundColor: b.color || '#6366f1' }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Tendência mensal */}
        <Card className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold">Tendência mensal de criação</h3>
            <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
          </div>
          <div className="flex items-end justify-between gap-2 h-32 px-2">
            {monthlyTrend.map(([key, c]) => (
              <div key={key} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs tabular-nums font-medium">{c}</div>
                <div className="w-full bg-primary/80 rounded-t transition-all"
                  style={{ height: `${(c / maxTrend) * 100}%`, minHeight: '2px' }} />
                <div className="text-[10px] text-muted-foreground">{key.slice(2)}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top 10 maiores */}
        <Card className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold">Top 10 maiores ({filterCurrency})</h3>
            <p className="text-xs text-muted-foreground">Ordenadas por valor estimado</p>
          </div>
          {top10.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Nenhuma oportunidade em {filterCurrency}.</div>
          ) : (
            <ol className="space-y-1.5">
              {top10.map((o, i) => (
                <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground tabular-nums w-5">{i + 1}.</span>
                    <Link to={`/opportunities/${o.id}`} className="text-primary hover:underline truncate">{o.name}</Link>
                  </span>
                  <span className="tabular-nums text-xs font-medium">{formatCurrencyShort(o.value, o.currency)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Buckets de probabilidade */}
        <Card className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold">Distribuição por probabilidade</h3>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-md border bg-red-50 dark:bg-red-950/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">≤30%</div>
              <div className="text-2xl font-bold text-red-600">{probBuckets.low}</div>
            </div>
            <div className="rounded-md border bg-amber-50 dark:bg-amber-950/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">31-69%</div>
              <div className="text-2xl font-bold text-amber-600">{probBuckets.mid}</div>
            </div>
            <div className="rounded-md border bg-green-50 dark:bg-green-950/20 p-3 text-center">
              <div className="text-xs text-muted-foreground">≥70%</div>
              <div className="text-2xl font-bold text-green-600">{probBuckets.high}</div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">Sem prob.</div>
              <div className="text-2xl font-bold text-muted-foreground">{probBuckets.na}</div>
            </div>
          </div>
        </Card>

        {/* Top 10 responsáveis */}
        <Card className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold">Distribuição por responsável</h3>
            <p className="text-xs text-muted-foreground">Top 10 (volume)</p>
          </div>
          {byResponsible.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Sem dados.</div>
          ) : (
            <div className="space-y-2">
              {byResponsible.map(r => (
                <div key={r.id} className="space-y-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[60%]">{r.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{r.count}</span>
                  </div>
                  <div className="h-2 bg-muted/30 rounded">
                    <div className="h-2 rounded bg-indigo-500 transition-all" style={{ width: `${(r.count / maxRespCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top 10 empresas por valor */}
        <Card className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold">Top 10 empresas ({filterCurrency})</h3>
            <p className="text-xs text-muted-foreground">Ordenadas por valor total estimado</p>
          </div>
          {byCompany.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Sem dados em {filterCurrency}.</div>
          ) : (
            <div className="space-y-2">
              {byCompany.map(c => (
                <div key={c.id} className="space-y-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[55%]">{c.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatCurrencyShort(c.value, c.currency)} · {c.count}</span>
                  </div>
                  <div className="h-2 bg-muted/30 rounded">
                    <div className="h-2 rounded bg-emerald-500 transition-all" style={{ width: `${(c.value / maxCompanyValue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
