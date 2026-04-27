import {
  BarChart3,
  Briefcase,
  Clock,
  DollarSign,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { GeoDistribution } from '@/features/dashboard/components/geo-distribution'
import { InsightsBanner } from '@/features/dashboard/components/insights-banner'
import { KpiCard } from '@/features/dashboard/components/kpi-card'
import { WorkloadWidget } from '@/features/dashboard/components/workload-widget'
import {
  aggregateTenantTotals,
  breakdownByStatus,
  countActive,
  countUpdatedRecently,
  financialSummaries,
  projectsByMonth,
  topRecent,
} from '@/features/dashboard/lib/aggregations'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { formatCurrency } from '@/features/projects/lib/money'
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

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const projects = useProjects()

  const data = projects.data ?? []
  const total = data.length
  const active = countActive(data)
  const recent = countUpdatedRecently(data)
  const byStatus = breakdownByStatus(data)
  const topProjects = topRecent(data, 5)

  const summaries = useMemo(() => financialSummaries(data), [data])
  const totals = useMemo(() => aggregateTenantTotals(summaries), [summaries])
  const monthly = useMemo(() => projectsByMonth(data), [data])
  const topByMargin = useMemo(
    () =>
      [...summaries]
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 5),
    [summaries],
  )

  const displayName =
    user?.name ?? user?.username ?? user?.email ?? 'usuário'

  // Currency exibida no rótulo dos KPIs financeiros — usa a moeda do
  // primeiro projeto com financials. Fallback BRL.
  const aggregateCurrency =
    summaries.find((s) => s.project.currency)?.project.currency ?? 'BRL'
  const maxMonthly = monthly.reduce((m, b) => Math.max(m, b.count), 0)

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('nav.dashboard')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.welcome', { name: displayName })}
          </p>
        </div>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="h-4 w-4" />
            <span>{t('dashboard.newProject')}</span>
          </Link>
        </Button>
      </div>

      {/* Insights heurísticos no topo */}
      <InsightsBanner projects={data} />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label={t('dashboard.kpi.totalProjects')}
          value={total}
          hint={
            total !== active
              ? t('dashboard.kpi.totalProjectsHintSplit', {
                  active,
                  archived: total - active,
                })
              : t('dashboard.kpi.totalProjectsHintAll')
          }
          icon={Briefcase}
          loading={projects.isLoading}
        />
        <KpiCard
          label={t('dashboard.kpi.updated7d')}
          value={recent}
          hint={t('dashboard.kpi.updated7dHint')}
          icon={Clock}
          loading={projects.isLoading}
        />
        <KpiCard
          label={t('dashboard.kpi.byStatus')}
          value={byStatus.length}
          hint={
            byStatus.length > 0
              ? t('dashboard.kpi.byStatusHintMost', {
                  status: byStatus[0].status,
                  count: byStatus[0].count,
                })
              : t('dashboard.kpi.byStatusHintEmpty')
          }
          icon={BarChart3}
          loading={projects.isLoading}
        />
      </div>

      {/* KPIs financeiros consolidados — só renderiza se houver pelo menos um
          projeto com Entradas Dinâmicas preenchidas. Caso contrário, esconde
          pra não poluir o dashboard com zeros. */}
      {summaries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            label={t('dashboard.kpi.tenantRevenue')}
            value={formatCurrency(totals.totalRevenue, aggregateCurrency)}
            hint={t('dashboard.kpi.tenantRevenueHint', {
              count: totals.projectsWithFinancials,
            })}
            icon={DollarSign}
          />
          <KpiCard
            label={t('dashboard.kpi.tenantResult')}
            value={formatCurrency(totals.totalResult, aggregateCurrency)}
            hint={t('dashboard.kpi.tenantResultHint', {
              cost: formatCurrency(totals.totalCost, aggregateCurrency),
            })}
            icon={TrendingUp}
            tone={totals.totalResult >= 0 ? 'good' : 'bad'}
          />
          <KpiCard
            label={t('dashboard.kpi.tenantMargin')}
            value={`${totals.margin.toFixed(1)}%`}
            hint={t('dashboard.kpi.tenantMarginHint')}
            icon={TrendingUp}
            tone={totals.margin >= 0 ? 'good' : 'bad'}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('dashboard.recentTitle')}</CardTitle>
            <CardDescription>
              {t('dashboard.recentDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('projects.th.name')}</TableHead>
                  <TableHead>{t('projects.th.status')}</TableHead>
                  <TableHead className="w-32">{t('projects.th.updatedAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.isLoading && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {t('app.loading')}
                    </TableCell>
                  </TableRow>
                )}
                {projects.isSuccess && topProjects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {t('dashboard.tableEmpty')}
                    </TableCell>
                  </TableRow>
                )}
                {topProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {project.status || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(project.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.statusDistTitle')}</CardTitle>
            <CardDescription>
              {t('dashboard.statusDistDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {projects.isLoading && (
              <p className="text-sm text-muted-foreground">{t('app.loading')}</p>
            )}
            {projects.isSuccess && byStatus.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('dashboard.statusDistEmpty')}
              </p>
            )}
            {byStatus.map((row) => {
              const max = byStatus[0]?.count ?? 1
              const pct = Math.round((row.count / max) * 100)
              return (
                <div key={row.status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{row.status}</span>
                    <span className="font-medium tabular-nums">
                      {row.count}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Top por margem — só renderiza se houver projetos com financials. */}
      {topByMargin.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.topMarginTitle')}</CardTitle>
            <CardDescription>{t('dashboard.topMarginDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('projects.th.name')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.colRevenue')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.colCost')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.colResult')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.colMargin')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topByMargin.map((s) => (
                  <TableRow key={s.project.id}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/projects/${s.project.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {s.project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(s.totalRevenue, s.project.currency ?? aggregateCurrency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(s.totalCost, s.project.currency ?? aggregateCurrency)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${s.totalResult >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
                    >
                      {formatCurrency(s.totalResult, s.project.currency ?? aggregateCurrency)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${s.margin >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
                    >
                      {s.margin.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.monthlyTitle')}</CardTitle>
          <CardDescription>{t('dashboard.monthlyDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {maxMonthly === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.monthlyEmpty')}
            </p>
          ) : (
            <div className="flex items-end gap-1.5 overflow-x-auto pb-2">
              {monthly.map((b) => {
                const pct = maxMonthly > 0 ? (b.count / maxMonthly) * 100 : 0
                return (
                  <div
                    key={b.key}
                    className="flex shrink-0 flex-col items-center gap-1"
                    style={{ width: 48 }}
                  >
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {b.count > 0 ? b.count : ''}
                    </span>
                    <div className="flex h-32 w-full items-end justify-center">
                      <div
                        className="w-full rounded-t-sm bg-primary"
                        style={{ height: `${Math.max(pct, b.count > 0 ? 4 : 0)}%` }}
                        title={`${b.label}: ${b.count}`}
                      />
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {b.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribuição geográfica */}
      <GeoDistribution
        projects={data}
        onStateClick={(uf) => {
          // Sprint H.5 — drill-down: navega pra lista filtrada por
          // estado. /projects lê ?state= e aplica filtro client-side.
          navigate(`/projects?state=${encodeURIComponent(uf)}`)
        }}
      />

      {/* Carga de trabalho por user */}
      <WorkloadWidget projects={data} />
    </div>
  )
}
