import { Plus, Search, TrendingDown, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { financialSummaries } from '@/features/dashboard/lib/aggregations'
import {
  AdvancedFilters,
  useAdvancedFilters,
} from '@/features/projects/components/advanced-filters'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { formatCurrency } from '@/features/projects/lib/money'
import { applyFilters } from '@/features/projects/lib/project-fields'
import { statusInCategory } from '@/features/projects/lib/status-categories'
import type { ProjectStatus } from '@/features/projects/lib/status-categories'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'

import { ProjectsTabs } from './components/projects-tabs'

type FunnelStage = {
  name: string
  label: string
  color?: string
  order: number
  count: number
  /** Soma de receita estimada dos projetos nesse estágio. */
  totalRevenue: number
  /** Ticket médio (receita / count). 0 quando count=0. */
  avgTicket: number
  /**
   * Taxa de conversão pra esse estágio = count / count_estágio_anterior * 100.
   * `null` no primeiro estágio (não tem anterior).
   */
  conversionFromPrev: number | null
}

/**
 * Funil de vendas — visualiza quantos projetos estão em cada estágio +
 * valor consolidado, ticket médio e taxa de conversão entre etapas.
 *
 * Filtros: busca por texto, filtro por responsável.
 *
 * Cálculo de conversão: `count_etapa / count_etapa_anterior * 100`. Útil
 * pra ver onde leads "vazam" do funil. Estágios "lost"/"won" no fim do
 * funil são tratados como saídas — taxa de conversão se calcula sobre o
 * fluxo de negociação ativo (categoria 'negotiation').
 */
export function ProjectsFunnelPage() {
  const { t } = useTranslation()
  const projects = useProjects()
  const statuses = useCatalog('projectStatuses')

  const [search, setSearch] = useState('')
  const [responsibleFilter, setResponsibleFilter] = useState('')
  const advancedFilters = useAdvancedFilters()

  // Enriquece projetos com dados financeiros + responsável (idêntico ao board).
  const enriched = useMemo(() => {
    const summaries = financialSummaries(projects.data ?? [])
    const byId = new Map(summaries.map((s) => [s.project.id, s]))
    return (projects.data ?? []).map((p) => {
      const payload = (p.payload ?? {}) as Record<string, unknown>
      const responsible =
        typeof payload.responsible === 'string' ? payload.responsible : ''
      const clientLabel =
        typeof p.clientName === 'string'
          ? p.clientName
          : typeof payload.clientName === 'string'
            ? payload.clientName
            : ''
      return {
        project: p,
        responsible,
        clientLabel,
        revenue: byId.get(p.id)?.totalRevenue ?? 0,
      }
    })
  }, [projects.data])

  const responsibleOptions = useMemo(() => {
    const set = new Set<string>()
    for (const e of enriched) if (e.responsible) set.add(e.responsible)
    return [...set].sort().map((name) => ({ value: name, label: name }))
  }, [enriched])

  // Aplica filtros (texto, responsável, avançados) antes de agrupar por estágio.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let pre = enriched.filter((e) => {
      if (responsibleFilter && e.responsible !== responsibleFilter) return false
      if (q) {
        const hay = `${e.project.name} ${e.clientLabel} ${e.responsible}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (advancedFilters.filters.length > 0) {
      // applyFilters trabalha em Project[]; reduzimos pra um Set de ids
      // pra preservar os campos enriched (revenue, responsible, etc).
      const allowedIds = new Set(
        applyFilters(
          pre.map((e) => e.project),
          advancedFilters.filters,
        ).map((p) => p.id),
      )
      pre = pre.filter((e) => allowedIds.has(e.project.id))
    }
    return pre
  }, [enriched, search, responsibleFilter, advancedFilters.filters])

  const stages = useMemo<FunnelStage[]>(() => {
    const cats = (statuses.data ?? []) as unknown as ProjectStatus[]
    const all = cats
      .filter((c) => c.active !== false && typeof c.name === 'string')
      .map<FunnelStage>((c) => {
        const inStage = filtered.filter((e) => e.project.status === c.name)
        const count = inStage.length
        const totalRevenue = inStage.reduce((s, e) => s + e.revenue, 0)
        return {
          name: c.name,
          label: c.name,
          color: typeof c.color === 'string' ? c.color : undefined,
          order: typeof c.order === 'number' ? c.order : 999,
          count,
          totalRevenue,
          avgTicket: count > 0 ? totalRevenue / count : 0,
          conversionFromPrev: null, // calcula abaixo
        }
      })
    all.sort((a, b) => a.order - b.order)

    // Calcula conversão de cada estágio em relação ao anterior. Estágios
    // de saída (lost, cancelled) ainda mostram valor mas não distorcem o
    // cálculo do próximo (não tem próximo).
    for (let i = 1; i < all.length; i++) {
      const prev = all[i - 1].count
      all[i].conversionFromPrev =
        prev > 0 ? Math.round((all[i].count / prev) * 100) : null
    }
    return all
  }, [filtered, statuses.data])

  // Categorias canônicas pra colorir estágios "lost"/"cancelled" diferentes.
  const lostStageNames = useMemo(() => {
    const set = new Set<string>()
    const cats = (statuses.data ?? []) as unknown as ProjectStatus[]
    for (const c of cats) {
      if (typeof c.name !== 'string') continue
      if (statusInCategory(c, 'lost') || statusInCategory(c, 'cancelled')) {
        set.add(c.name)
      }
    }
    return set
  }, [statuses.data])

  const total = filtered.length
  const totalRevenue = filtered.reduce((s, e) => s + e.revenue, 0)
  const maxCount = stages.reduce((m, s) => Math.max(m, s.count), 0)
  const tenantCurrency = enriched[0]?.project.currency ?? 'BRL'

  const filtersActive = !!search || !!responsibleFilter

  return (
    <div className="w-full space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('nav.projects')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('projects.funnel.subtitle')}
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

      <AdvancedFilters state={advancedFilters} />

      {projects.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.loadError')}</AlertDescription>
        </Alert>
      )}

      {/* Filtros + resumo */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('projects.board.filterSearch')}
                className="pl-9"
              />
            </div>
            <Combobox
              options={responsibleOptions}
              value={responsibleFilter}
              onChange={setResponsibleFilter}
              noneLabel={t('projects.board.allResponsibles')}
              placeholder={t('projects.board.filterResponsible')}
            />
          </div>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setResponsibleFilter('')
              }}
            >
              <X className="h-4 w-4" />
              {t('projects.board.clearFilters')}
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-2 text-sm">
          <span>
            <span className="text-muted-foreground">
              {t('projects.funnel.totalCount')}:
            </span>{' '}
            <span className="tabular-nums font-semibold text-foreground">
              {total}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">
              {t('projects.funnel.totalValue')}:
            </span>{' '}
            <span className="tabular-nums font-semibold text-foreground">
              {formatCurrency(totalRevenue, tenantCurrency)}
            </span>
          </span>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('projects.funnel.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('projects.funnel.totalLabel', { count: total })}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.isLoading || statuses.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))
          ) : stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('projects.funnel.empty')}
            </p>
          ) : (
            stages.map((s) => {
              const pct = maxCount > 0 ? Math.round((s.count / maxCount) * 100) : 0
              const isLost = lostStageNames.has(s.name)
              return (
                <div key={s.name} className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <div className="flex items-center gap-3 text-xs">
                      {s.conversionFromPrev != null && (
                        <span
                          className={
                            s.conversionFromPrev < 50
                              ? 'inline-flex items-center gap-0.5 text-amber-600'
                              : 'inline-flex items-center gap-0.5 text-emerald-600'
                          }
                          title={t('projects.funnel.conversionTooltip')}
                        >
                          <TrendingDown className="h-3 w-3" />
                          {s.conversionFromPrev}%
                        </span>
                      )}
                      {s.avgTicket > 0 && (
                        <span className="text-muted-foreground">
                          {t('projects.funnel.avgTicket')}:{' '}
                          <span className="tabular-nums text-foreground">
                            {formatCurrency(s.avgTicket, tenantCurrency)}
                          </span>
                        </span>
                      )}
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrency(s.totalRevenue, tenantCurrency)}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums font-medium text-foreground">
                        {s.count}
                      </span>
                    </div>
                  </div>
                  <div className="h-7 w-full overflow-hidden rounded-md bg-muted">
                    <div
                      className="h-full rounded-md transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          s.color ??
                          (isLost
                            ? 'hsl(var(--destructive))'
                            : 'hsl(var(--primary))'),
                        opacity: isLost ? 0.7 : 1,
                      }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
