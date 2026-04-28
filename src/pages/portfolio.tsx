/**
 * Portfolio — vista executiva consolidada do tenant.
 *
 * Diferente do Dashboard (que mostra atividade operacional do dia-a-dia),
 * o Portfolio é a "vista de cima" focada em:
 *   - KPIs financeiros agregados (receita, custo, margem média)
 *   - Distribuição por status (won/em-andamento/perdidos)
 *   - Top clientes por valor
 *   - Distribuição geográfica (mapa Brasil)
 *   - Top projetos por valor (tabela)
 *
 * Reusa `financialSummaries`/`aggregateTenantTotals` do dashboard pra
 * rodar o motor financeiro em todos os projetos e somar.
 */

import {
  Briefcase,
  DollarSign,
  Percent,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { GeoDistribution } from '@/features/dashboard/components/geo-distribution'
import { KpiCard } from '@/features/dashboard/components/kpi-card'
import {
  aggregateTenantTotals,
  breakdownByStatus,
  financialSummaries,
} from '@/features/dashboard/lib/aggregations'
import { useOpportunitiesAsProjects } from '@/features/opportunities/hooks/use-opportunities-as-projects'
import { formatCurrency } from '@/features/projects/lib/money'
import type { Project } from '@/features/projects/types'
import { cn } from '@/shared/lib/cn'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'

/**
 * Lê `clientName` do projeto. Mora no payload (e às vezes no top-level
 * via index signature). Coerciona pra string ou retorna null.
 */
function getClientName(project: Project): string | null {
  const top = (project as Record<string, unknown>).clientName
  if (typeof top === 'string' && top.trim()) return top
  const payloadName =
    project.payload && typeof project.payload === 'object'
      ? (project.payload as Record<string, unknown>).clientName
      : null
  if (typeof payloadName === 'string' && payloadName.trim()) return payloadName
  return null
}

/** Heurística simples pra identificar status "won/lost/active". */
function classifyStatus(status: string): 'won' | 'lost' | 'active' {
  const s = (status || '').toLowerCase()
  if (s.includes('ganh') || s.includes('won') || s.includes('fech')) {
    return 'won'
  }
  if (s.includes('perd') || s.includes('lost') || s.includes('cancel')) {
    return 'lost'
  }
  return 'active'
}

export function PortfolioPage() {
  const { t, i18n } = useTranslation()
  const projects = useOpportunitiesAsProjects()
  const companies = useCatalog('companies')
  const projectStatuses = useCatalog('projectStatuses')
  const navigate = useNavigate()

  const [filterStatus, setFilterStatus] = useState('')
  const [filterClient, setFilterClient] = useState('')

  const allProjects = projects.data ?? []
  const tenantCurrency = allProjects[0]?.currency ?? 'BRL'

  // Filtros aplicados.
  const filtered = useMemo(() => {
    return allProjects.filter((p) => {
      if (filterStatus && (p.status || '') !== filterStatus) return false
      if (filterClient && (getClientName(p) || '') !== filterClient) return false
      return true
    })
  }, [allProjects, filterStatus, filterClient])

  // Resumos financeiros por projeto (motor rodando em cada um).
  const summaries = useMemo(() => financialSummaries(filtered), [filtered])
  const totals = useMemo(() => aggregateTenantTotals(summaries), [summaries])

  // Contagens por categoria de status.
  const statusCounts = useMemo(() => {
    let won = 0
    let lost = 0
    let active = 0
    for (const p of filtered) {
      const k = classifyStatus(p.status || '')
      if (k === 'won') won++
      else if (k === 'lost') lost++
      else active++
    }
    return { won, lost, active, total: filtered.length }
  }, [filtered])

  // Distribuição por status (todos status do tenant).
  const statusDistribution = useMemo(
    () => breakdownByStatus(filtered),
    [filtered],
  )

  // Top clientes por valor (soma de receita prevista de seus projetos).
  const topClients = useMemo(() => {
    const map = new Map<
      string,
      { name: string; revenue: number; projectCount: number }
    >()
    for (const s of summaries) {
      const name = getClientName(s.project) || '—'
      const cur = map.get(name) ?? { name, revenue: 0, projectCount: 0 }
      cur.revenue += s.totalRevenue
      cur.projectCount++
      map.set(name, cur)
    }
    return [...map.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }, [summaries])

  // Top 10 projetos por valor.
  const topProjects = useMemo(() => {
    return [...summaries]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
  }, [summaries])

  // Opções dos filtros.
  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of allProjects) if (p.status) set.add(p.status)
    return [...set].map((s) => ({ value: s, label: s }))
  }, [allProjects])

  const clientOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of allProjects) if (getClientName(p)) set.add(getClientName(p))
    return [...set].sort().map((c) => ({ value: c, label: c }))
  }, [allProjects])

  // Reaproveita projectStatuses pra colorir bars (se cadastrado com cor).
  const statusColorByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const raw of projectStatuses.data ?? []) {
      const name = typeof raw?.name === 'string' ? raw.name : null
      if (name) {
        const color = typeof raw?.color === 'string' ? raw.color : '#6366f1'
        map.set(name.toLowerCase(), color)
      }
    }
    return map
  }, [projectStatuses.data])

  // Suprime warning de unused (companies fica disponível pra extensão futura).
  void companies
  void i18n

  if (projects.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <Skeleton />
      </div>
    )
  }

  if (projects.isError) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Alert variant="destructive">
          <AlertDescription>
            {t('portfolio.loadError', {
              defaultValue: 'Não foi possível carregar os projetos.',
            })}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const filtersActive = !!filterStatus || !!filterClient

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t('portfolio.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('portfolio.subtitle')}
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Combobox
              options={statusOptions}
              value={filterStatus}
              onChange={setFilterStatus}
              noneLabel={t('portfolio.allStatuses')}
              placeholder={t('portfolio.filterStatus')}
            />
            <Combobox
              options={clientOptions}
              value={filterClient}
              onChange={setFilterClient}
              noneLabel={t('portfolio.allClients')}
              placeholder={t('portfolio.filterClient')}
            />
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('')
                  setFilterClient('')
                }}
                className="self-start text-sm text-primary hover:underline"
              >
                {t('portfolio.clearFilters')}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label={t('portfolio.kpi.totalProjects')}
          value={statusCounts.total}
          icon={Briefcase}
          hint={t('portfolio.kpi.totalProjectsHint', {
            count: totals.projectsWithFinancials,
          })}
        />
        <KpiCard
          label={t('portfolio.kpi.totalRevenue')}
          value={formatCurrency(totals.totalRevenue, tenantCurrency)}
          icon={DollarSign}
          tone="good"
        />
        <KpiCard
          label={t('portfolio.kpi.totalCost')}
          value={formatCurrency(totals.totalCost, tenantCurrency)}
          icon={TrendingDown}
        />
        <KpiCard
          label={t('portfolio.kpi.margin')}
          value={`${totals.margin.toFixed(1)}%`}
          icon={Percent}
          tone={
            totals.margin > 25 ? 'good' : totals.margin < 10 ? 'bad' : 'warn'
          }
          hint={t('portfolio.kpi.marginHint')}
        />
      </div>

      {/* KPIs de pipeline */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label={t('portfolio.kpi.won')}
          value={statusCounts.won}
          icon={TrendingUp}
          tone="good"
        />
        <KpiCard
          label={t('portfolio.kpi.active')}
          value={statusCounts.active}
          icon={Target}
        />
        <KpiCard
          label={t('portfolio.kpi.lost')}
          value={statusCounts.lost}
          icon={TrendingDown}
          tone="bad"
        />
        <KpiCard
          label={t('portfolio.kpi.winRate')}
          value={
            statusCounts.won + statusCounts.lost > 0
              ? `${(
                  (statusCounts.won /
                    (statusCounts.won + statusCounts.lost)) *
                  100
                ).toFixed(0)}%`
              : '—'
          }
          hint={t('portfolio.kpi.winRateHint')}
        />
      </div>

      {/* Distribuição por status — barras horizontais */}
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.statusDistribution')}</CardTitle>
          <CardDescription>
            {t('portfolio.statusDistributionDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('portfolio.empty')}
            </p>
          ) : (
            <div className="space-y-2">
              {statusDistribution.map((row) => {
                const pct =
                  filtered.length > 0
                    ? (row.count / filtered.length) * 100
                    : 0
                const color = statusColorByName.get(row.status) ?? '#6366f1'
                return (
                  <div
                    key={row.status}
                    className="grid grid-cols-[10rem_1fr_4rem] items-center gap-3"
                  >
                    <span className="truncate text-sm font-medium capitalize text-foreground">
                      {row.status}
                    </span>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="text-right text-sm tabular-nums text-muted-foreground">
                      {row.count} · {pct.toFixed(0)}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top clientes */}
      {topClients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.topClients')}</CardTitle>
            <CardDescription>{t('portfolio.topClientsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topClients.map((c, i) => {
                const maxRev = topClients[0]?.revenue || 1
                const pct = (c.revenue / maxRev) * 100
                return (
                  <div
                    key={c.name}
                    className="grid grid-cols-[2rem_1fr_8rem_5rem] items-center gap-3"
                  >
                    <span className="text-xs tabular-nums text-muted-foreground">
                      #{i + 1}
                    </span>
                    <div className="space-y-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {c.name}
                      </span>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-right text-sm tabular-nums text-foreground">
                      {formatCurrency(c.revenue, tenantCurrency)}
                    </span>
                    <span className="text-right text-xs tabular-nums text-muted-foreground">
                      {t('portfolio.projectCount', {
                        count: c.projectCount,
                      })}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top projetos por valor */}
      {topProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.topProjects')}</CardTitle>
            <CardDescription>{t('portfolio.topProjectsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topProjects.map((s, i) => (
                <Link
                  key={s.project.id}
                  to={`/projects/${s.project.id}`}
                  className="grid grid-cols-[2rem_1fr_6rem_6rem] items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                >
                  <span className="text-xs tabular-nums text-muted-foreground">
                    #{i + 1}
                  </span>
                  <div>
                    <p className="truncate text-sm font-medium text-foreground">
                      {s.project.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getClientName(s.project) ?? '—'} · {s.project.status ?? '—'}
                    </p>
                  </div>
                  <span className="text-right text-sm tabular-nums text-foreground">
                    {formatCurrency(s.totalRevenue, tenantCurrency)}
                  </span>
                  <span
                    className={cn(
                      'text-right text-sm tabular-nums',
                      s.margin > 25
                        ? 'text-emerald-600'
                        : s.margin < 10
                          ? 'text-destructive'
                          : 'text-amber-600',
                    )}
                  >
                    {s.margin.toFixed(1)}%
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribuição geográfica (reaproveita componente do dashboard).
          Drill-down: clicar num estado leva pra lista filtrada. */}
      <GeoDistribution
        projects={filtered}
        onStateClick={(uf) =>
          navigate(`/projects?state=${encodeURIComponent(uf)}`)
        }
      />
    </div>
  )
}

/** Skeleton simples enquanto useProjects está carregando. */
function Skeleton() {
  return (
    <>
      <div className="h-10 w-1/3 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-border bg-muted/40"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-border bg-muted/40" />
    </>
  )
}

export type { Project }
