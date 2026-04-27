import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { financialSummaries } from '@/features/dashboard/lib/aggregations'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { formatCurrency } from '@/features/projects/lib/money'
import {
  statusInCategory,
  type ProjectStatus,
} from '@/features/projects/lib/status-categories'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

import { ProjectsTabs } from './components/projects-tabs'

/**
 * Tela "Perdidas" — filtra projetos cujo status tem categoria 'lost'
 * (ou nome contém keywords legadas se categoria ainda não foi setada).
 */
export function ProjectsLostPage() {
  const { t } = useTranslation()
  const projects = useProjects()
  const statuses = useCatalog('projectStatuses')

  // Detecta status "perda" combinando duas fontes:
  // 1. Catálogo projectStatuses (preferido — usa categoria explícita)
  // 2. Fallback: nomes únicos dos status dos próprios projetos, testados pela
  //    função de keyword. Importante quando o user não tem acesso ao catálogo
  //    (não-master) ou quando o status veio do app legado sem cadastro.
  const lostStatusNames = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    const list = (statuses.data ?? []) as unknown as ProjectStatus[]
    for (const s of list) {
      if (typeof s.name !== 'string') continue
      if (statusInCategory(s, 'lost')) set.add(s.name)
    }
    // Fallback: olha nomes dos projetos
    const seen = new Set<string>()
    for (const p of projects.data ?? []) {
      if (!p.status || seen.has(p.status)) continue
      seen.add(p.status)
      const fakeStatus: ProjectStatus = { id: '', name: p.status }
      if (statusInCategory(fakeStatus, 'lost')) set.add(p.status)
    }
    return set
  }, [statuses.data, projects.data])

  const lostProjects = useMemo(() => {
    const list = projects.data ?? []
    return list
      .filter((p) => p.status && lostStatusNames.has(p.status))
      .sort(
        (a, b) =>
          new Date(b.updatedAt ?? 0).getTime() -
          new Date(a.updatedAt ?? 0).getTime(),
      )
  }, [projects.data, lostStatusNames])

  const lostSummaries = useMemo(
    () => financialSummaries(lostProjects),
    [lostProjects],
  )
  const lostRevenueValue = lostSummaries.reduce(
    (acc, s) => acc + s.totalRevenue,
    0,
  )
  const aggregateCurrency =
    lostSummaries.find((s) => s.project.currency)?.project.currency ?? 'BRL'

  // Analytics adicionais
  const allProjects = projects.data ?? []
  const wonStatusNames = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    const list = (statuses.data ?? []) as unknown as ProjectStatus[]
    for (const s of list) {
      if (typeof s.name === 'string' && statusInCategory(s, 'won')) set.add(s.name)
    }
    // Fallback (mesmo motivo do lostStatusNames)
    const seen = new Set<string>()
    for (const p of projects.data ?? []) {
      if (!p.status || seen.has(p.status)) continue
      seen.add(p.status)
      const fakeStatus: ProjectStatus = { id: '', name: p.status }
      if (statusInCategory(fakeStatus, 'won')) set.add(p.status)
    }
    return set
  }, [statuses.data, projects.data])
  const wonCount = allProjects.filter(
    (p) => p.status && wonStatusNames.has(p.status),
  ).length
  const winRate =
    wonCount + lostProjects.length > 0
      ? (wonCount / (wonCount + lostProjects.length)) * 100
      : 0

  const avgDaysToLose = useMemo(() => {
    const days = lostProjects
      .map((p) => {
        if (!p.createdAt || !p.updatedAt) return null
        const created = new Date(p.createdAt).getTime()
        const updated = new Date(p.updatedAt).getTime()
        if (!Number.isFinite(created) || !Number.isFinite(updated)) return null
        return Math.round((updated - created) / (1000 * 60 * 60 * 24))
      })
      .filter((d): d is number => d != null && d >= 0)
    if (days.length === 0) return null
    return Math.round(days.reduce((a, b) => a + b, 0) / days.length)
  }, [lostProjects])

  // Por estado (puxa do payload.clientName via lookup em companies, ou direto do payload se houver)
  const byState = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of lostProjects) {
      const payload = (p.payload ?? {}) as Record<string, unknown>
      const state =
        typeof payload.clientState === 'string'
          ? payload.clientState
          : typeof payload.state === 'string'
            ? payload.state
            : '—'
      counts.set(state, (counts.get(state) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [lostProjects])

  const byClient = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of lostProjects) {
      const name =
        typeof p.clientName === 'string'
          ? p.clientName
          : ((p.payload ?? {}) as Record<string, unknown>).clientName
      const k = typeof name === 'string' && name ? name : '—'
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [lostProjects])

  return (
    <div className="mx-auto max-w-screen-2xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('nav.projects')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('projects.lost.subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="h-4 w-4" />
            <span>{t('projects.new')}</span>
          </Link>
        </Button>
      </div>

      <ProjectsTabs />

      {projects.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.loadError')}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('projects.lost.kpiCount')}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {lostProjects.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('projects.lost.kpiValue')}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
              {formatCurrency(lostRevenueValue, aggregateCurrency)}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t('projects.lost.kpiValueHint')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('projects.lost.kpiWinRate')}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {winRate.toFixed(1)}%
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t('projects.lost.kpiWinRateHint', {
                won: wonCount,
                total: wonCount + lostProjects.length,
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('projects.lost.kpiAvgDays')}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {avgDaysToLose != null ? `${avgDaysToLose}d` : '—'}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t('projects.lost.kpiAvgDaysHint')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por estado e cliente — 2 colunas */}
      {(byState.length > 0 || byClient.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {byState.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('projects.lost.byState')}
                </div>
                <div className="space-y-1">
                  {byState.map(([s, c]) => (
                    <div key={s} className="flex items-center justify-between text-sm">
                      <span>{s}</span>
                      <span className="tabular-nums font-medium">{c}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {byClient.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('projects.lost.byClient')}
                </div>
                <div className="space-y-1">
                  {byClient.map(([s, c]) => (
                    <div key={s} className="flex items-center justify-between text-sm">
                      <span className="truncate">{s}</span>
                      <span className="tabular-nums font-medium">{c}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('projects.th.name')}</TableHead>
              <TableHead>{t('projects.th.status')}</TableHead>
              <TableHead className="text-right">{t('dashboard.colRevenue')}</TableHead>
              <TableHead className="w-32">{t('projects.th.updatedAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.isLoading || statuses.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : lostProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                  {t('projects.lost.empty')}
                </TableCell>
              </TableRow>
            ) : (
              lostProjects.map((p) => {
                const summary = lostSummaries.find((s) => s.project.id === p.id)
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/projects/${p.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        {p.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {summary
                        ? formatCurrency(summary.totalRevenue, p.currency ?? aggregateCurrency)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
