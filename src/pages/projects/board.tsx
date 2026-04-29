import { Plus, Search, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { UserAvatar } from '@/features/admin/components/user-select'
import { financialSummaries } from '@/features/dashboard/lib/aggregations'
import {
  AdvancedFilters,
  useAdvancedFilters,
} from '@/features/projects/components/advanced-filters'
import { useMoveProject } from '@/features/projects/hooks/use-move-project'
import { useMoveOpportunity } from '@/features/opportunities/hooks/use-move-opportunity'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import { useOpportunitiesAsProjects } from '@/features/opportunities/hooks/use-opportunities-as-projects'
import { formatCurrency } from '@/features/projects/lib/money'
import { applyFilters } from '@/features/projects/lib/project-fields'
import {
  isInScope,
  statusInCategory,
  type FunnelScope,
  type ProjectStatus,
} from '@/features/projects/lib/status-categories'
import type { Project } from '@/features/projects/types'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { cn } from '@/shared/lib/cn'

import { ProjectsTabs } from './components/projects-tabs'

import { OpportunityViewSheet } from '@/features/opportunities/components/opportunity-view-sheet'
import { OpportunityFormSheet } from '@/features/opportunities/components/opportunity-form-sheet'
import { TaskFormSheet } from '@/features/tasks/components/task-form-sheet'
import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
type StatusColumn = {
  /** Nome do status (chave de agrupamento). Vazio = "Sem status". */
  name: string
  label: string
  color?: string
  order: number
  projects: Project[]
}

type EnrichedProject = Project & {
  /** Receita total (cache calculado uma vez). */
  __revenue: number
  /** Responsável (nome) extraído do payload. */
  __responsibleName: string
  /** Cliente (nome) extraído do payload. */
  __clientLabel: string
}

/**
 * Kanban de oportunidades agrupadas por status. Cada coluna mostra
 * resumo (count + total) e cards ricos (cliente, valor, responsável).
 *
 * Filtros: busca por texto livre, filtro por responsável, valor mínimo.
 * Tudo client-side — projects.data já vem com todos os projetos do tenant
 * e re-renderizar é barato.
 */
export function ProjectsBoardPage({
  scope = 'opportunities',
}: {
  scope?: FunnelScope
}) {
  const { t, i18n } = useTranslation()
  const projects = useOpportunitiesAsProjects()
  const oppsRaw = useOpportunities()
  const [viewingOpp, setViewingOpp] = useState<any>(null)
  const [editingOpp, setEditingOpp] = useState<any>(null)
  const [taskForOppId, setTaskForOppId] = useState<string | null>(null)
  const oppStatuses = useOpportunityStatuses()
  const statuses = { data: oppStatuses.data, isLoading: oppStatuses.isLoading, isError: oppStatuses.isError, isSuccess: oppStatuses.isSuccess }

  // Filtros
  const [search, setSearch] = useState('')
  const [responsibleFilter, setResponsibleFilter] = useState('')
  const [minValueText, setMinValueText] = useState('')
  const [includeLost, setIncludeLost] = useState(false)
  const minValue = Number(minValueText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0
  // Filtros avançados (chips empilháveis — mesmo componente da Lista).
  const advancedFilters = useAdvancedFilters()

  // Set de nomes de status considerados 'lost' (catálogo + fallback por
  // keyword no nome). Usado pra: (a) filtrar projetos perdidos do board
  // por padrão e (b) esconder a coluna do status correspondente.
  const lostStatusNames = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    const list = (statuses.data ?? []) as unknown as ProjectStatus[]
    for (const s of list) {
      if (typeof s.name !== 'string') continue
      if (statusInCategory(s, 'lost')) set.add(s.name)
    }
    return set
  }, [statuses.data])

  // Enriquece projetos uma vez — evita recalcular dentro do render do board.
  const enrichedAll = useMemo<EnrichedProject[]>(() => {
    const summaries = financialSummaries(projects.data ?? [])
    const summaryByProject = new Map(summaries.map((s) => [s.project.id, s]))
    return (projects.data ?? []).map((p) => {
      const payload = (p.payload ?? {}) as Record<string, unknown>
      const responsibleName =
        typeof payload.responsible === 'string' && payload.responsible
          ? payload.responsible
          : ''
      const clientLabel =
        typeof p.clientName === 'string' && p.clientName
          ? p.clientName
          : typeof payload.clientName === 'string'
            ? (payload.clientName as string)
            : ''
      return {
        ...p,
        __revenue: Number(summaryByProject.get(p.id)?.totalRevenue || p.estimatedValue || 0),
        __responsibleName: responsibleName,
        __clientLabel: clientLabel,
      }
    })
  }, [projects.data])

  // Lista única de responsáveis pra popular o filtro.
  const responsibleOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of enrichedAll) {
      if (p.__responsibleName) set.add(p.__responsibleName)
    }
    return [...set].sort().map((name) => ({ value: name, label: name }))
  }, [enrichedAll])

  // Aplica filtros (escopo, texto, responsável, valor mínimo, perdidas,
  // avançados). Mantém referência estável quando filtros não mudam.
  const filtered = useMemo<EnrichedProject[]>(() => {
    const q = search.trim().toLowerCase()
    const allStatusList = (statuses.data ?? []) as unknown as ProjectStatus[]
    let pre = enrichedAll.filter((p) => {
      if (!isInScope(p.status, scope, allStatusList)) return false
      if (!includeLost && p.status && lostStatusNames.has(p.status)) return false
      if (responsibleFilter && p.__responsibleName !== responsibleFilter) return false
      if (minValue > 0 && p.__revenue < minValue) return false
      if (q) {
        const hay = `${p.name} ${p.__clientLabel} ${p.__responsibleName}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (advancedFilters.filters.length > 0) {
      // applyFilters trabalha sobre Project[]; tipo enriquecido herda Project.
      pre = applyFilters(pre, advancedFilters.filters) as EnrichedProject[]
    }
    return pre
  }, [
    enrichedAll,
    search,
    responsibleFilter,
    minValue,
    includeLost,
    lostStatusNames,
    advancedFilters.filters,
    scope,
    statuses.data,
  ])

  const columns = useMemo<StatusColumn[]>(() => {
    const cats = (scope === 'opportunities' ? (oppStatuses.data ?? []) : (statuses.data ?? []))
    const cols: StatusColumn[] = cats
      .filter((c) => c.active !== false && typeof c.name === 'string')
      // Esconde colunas de status 'lost' quando o toggle está desligado.
      .filter((c) => includeLost || !lostStatusNames.has(c.name as string))
      .map((c) => ({
        name: c.name as string,
        label: c.name as string,
        color: typeof c.color === 'string' ? c.color : undefined,
        order: typeof (c as any).order === 'number' ? (c as any).order : (typeof (c as any).displayOrder === 'number' ? (c as any).displayOrder : 999),
        projects: filtered.filter((p) => p.status === c.name),
      }))
    cols.sort((a, b) => a.order - b.order)

    // Coluna pseudo-status pra projetos órfãos (sem status ou status removido).
    const known = new Set(cats.map((c) => c.name))
    const orphaned = filtered.filter((p) => !p.status || !known.has(p.status))
    if (orphaned.length > 0) {
      cols.unshift({
        name: '',
        label: t('projects.detail.noStatus'),
        order: -1,
        projects: orphaned,
      })
    }
    return cols
  }, [filtered, statuses.data, t, includeLost, lostStatusNames])

  // Resumo geral em cima — total filtrado e valor consolidado.
  const tenantCurrency = (() => {
    const counts = new Map<string, number>()
    for (const p of enrichedAll) {
      const c = p.currency || 'BRL'
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    let best = 'BRL', bestN = 0
    for (const [c, n] of counts) if (n > bestN) { best = c; bestN = n }
    return best
  })()
  const totalCount = filtered.length
  const totalRevenue = filtered.reduce((s, p) => s + p.__revenue, 0)

  const filtersActive = !!search || !!responsibleFilter || minValue > 0

  return (
    <div className="w-full space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {scope === 'opportunities' ? t('nav.opportunities') : t('nav.projects')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {scope === 'opportunities' ? 'Arraste cards entre colunas para mudar o status da oportunidade.' : t('projects.board.subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link to={scope === 'opportunities' ? "/opportunities/new" : "/projects/new"}>
            <Plus className="h-4 w-4" />
            <span>{scope === 'opportunities' ? 'Nova oportunidade' : t('projects.new')}</span>
          </Link>
        </Button>
      </div>

      <ProjectsTabs />

      {projects.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.loadError')}</AlertDescription>
        </Alert>
      )}

      {/* Filtros avançados (chips empilháveis). */}
      <AdvancedFilters state={advancedFilters} />

      {/* Filtros + resumo geral */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-3">
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
            <Input
              type="text"
              inputMode="decimal"
              value={minValueText}
              onChange={(e) => setMinValueText(e.target.value)}
              placeholder={t('projects.board.filterMinValue')}
            />
          </div>
          <button
            type="button"
            onClick={() => setIncludeLost((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              includeLost
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-accent'
            }`}
            title={t('projects.includeLost', {
              defaultValue: 'Incluir oportunidades perdidas no Kanban',
            })}
          >
            {includeLost
              ? t('projects.includeLostOn', { defaultValue: 'Incluindo perdidas' })
              : t('projects.includeLostOff', { defaultValue: 'Incluir perdidas' })}
          </button>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setResponsibleFilter('')
                setMinValueText('')
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
              {t('projects.board.summaryCount')}:
            </span>{' '}
            <span className="tabular-nums font-semibold text-foreground">
              {totalCount}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">
              {t('projects.board.summaryTotal')}:
            </span>{' '}
            <span className="tabular-nums font-semibold text-foreground">
              {formatCurrency(totalRevenue, tenantCurrency)}
            </span>
          </span>
        </div>
      </Card>

      {statuses.isSuccess && columns.filter((c) => c.name).length === 0 && (
        <Alert>
          <AlertDescription>{t('projects.board.noStatuses')}</AlertDescription>
        </Alert>
      )}

      {projects.isLoading || statuses.isLoading ? (
        <BoardSkeleton />
      ) : (
        <Board columns={columns} currency={tenantCurrency} locale={i18n.language} scope={scope} onCardOpenView={(id) => { const o = (oppsRaw.data ?? []).find(x => String(x.id) === String(id)); if (o) setViewingOpp(o) }} onCardCreateTask={(id) => setTaskForOppId(String(id))} />
      )}
      <OpportunityViewSheet
        open={!!viewingOpp}
        opportunity={viewingOpp}
        onClose={() => setViewingOpp(null)}
        onEdit={(opp) => { setViewingOpp(null); setEditingOpp(opp) }}
      />
      <OpportunityFormSheet
        open={!!editingOpp}
        initial={editingOpp}
        onClose={() => setEditingOpp(null)}
      />
      <TaskFormSheet
        open={!!taskForOppId}
        entityType="opportunity"
        entityId={taskForOppId ?? undefined}
        lockEntity
        onClose={() => setTaskForOppId(null)}
      />
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex w-80 shrink-0 flex-col gap-2">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  )
}

function Board({
  columns,
  currency,
  locale,
  scope,
  onCardOpenView,
  onCardCreateTask,
}: {
  columns: StatusColumn[]
  currency: string
  locale: string
  scope?: 'opportunities' | 'projects'
  onCardOpenView?: (id: string) => void
  onCardCreateTask?: (id: string) => void
}) {
  const { t } = useTranslation()
  const moveProject = useMoveProject()
  const moveOpp = useMoveOpportunity()
  const move = scope === 'opportunities' ? null : moveProject
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverCol, setHoverCol] = useState<string | null>(null)

  async function handleDrop(targetStatus: string) {
    const id = draggingId
    setDraggingId(null)
    setHoverCol(null)
    if (!id) return
    const project = columns
      .flatMap((c) => c.projects)
      .find((p) => p.id === id)
    if (!project || project.status === targetStatus) return
    try {
      if (scope === 'opportunities') {
        await moveOpp.mutateAsync({ id, statusName: targetStatus || null })
      } else if (move) {
        await move.mutateAsync({ id, status: targetStatus || null })
      }
      toastSaved(t('projects.board.moved'))
    } catch (err) {
      toastError(err, t('projects.board.moveError'))
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const colTotal = (col.projects as EnrichedProject[]).reduce(
          (s, p) => s + (p.__revenue ?? 0),
          0,
        )
        return (
          <div
            key={col.name || '__none__'}
            className={cn(
              // Coluna tem altura fixa relativa à viewport pra não crescer
              // indefinidamente — o conteúdo (lista de cards) rola DENTRO.
              // O ajuste ~280px subtrai header da app + topo da página
              // (título, tabs, filtros) deixando o restante pra coluna.
              'flex h-[calc(100vh-280px)] w-80 shrink-0 flex-col rounded-md border border-border bg-card transition-colors',
              hoverCol === col.name && 'border-primary bg-accent/30',
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setHoverCol(col.name)
            }}
            onDragLeave={() => setHoverCol((h) => (h === col.name ? null : h))}
            onDrop={() => handleDrop(col.name)}
          >
            {/* Header da coluna fixo no topo (não rola junto). */}
            <div
              className="shrink-0 border-b-2 px-3 pb-2 pt-3"
              style={{ borderColor: col.color ?? 'transparent' }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {col.projects.length}
                </span>
              </div>
              {colTotal > 0 && (
                <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                  {formatCurrency(colTotal, currency)}
                </div>
              )}
            </div>

            {/* Área rolável dos cards. `min-h-0` é essencial pra
                overflow-y-auto funcionar dentro de flex-col. */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
              {col.projects.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  —
                </p>
              )}

              {(col.projects as EnrichedProject[]).map((p) => (
                <BoardCard
                  key={p.id}
                  project={p}
                  currency={currency}
                  locale={locale}
                  isDragging={draggingId === p.id}
                  onDragStart={() => setDraggingId(p.id)}
                  onDragEnd={() => setDraggingId(null)}
                  scope={scope}
                  onOpenView={onCardOpenView}
                  onCreateTask={onCardCreateTask}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BoardCard({
  project,
  currency,
  locale,
  isDragging,
  onDragStart,
  onDragEnd,
  scope,
  onOpenView,
  onCreateTask,
}: {
  project: EnrichedProject
  currency: string
  locale: string
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  scope?: 'opportunities' | 'projects'
  onOpenView?: (id: string) => void
  onCreateTask?: (id: string) => void
}) {
  const payload = (project.payload ?? {}) as Record<string, unknown>
  const endDate = typeof payload.endDate === 'string' ? payload.endDate : null
  const teamIds = Array.isArray(payload.teamIds)
    ? (payload.teamIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'cursor-grab p-3 transition-opacity active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      {/* Sprint H.3 — atalho "+ tarefa" alinhado à direita do título.
          Vai pra aba Tarefas com `?new=1` que dispara o sheet de criar. */}
      <div className="flex items-start justify-between gap-2">
        {scope === 'opportunities' && onOpenView ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenView(project.id) }}
            onDragStart={(e) => e.preventDefault()}
            draggable={false}
            className="block text-left text-sm font-medium text-foreground hover:underline"
          >
            {project.name}
          </button>
        ) : (
          <Link
            to={scope === 'opportunities' ? `/opportunities/${project.id}` : `/projects/${project.id}`}
            className="block text-sm font-medium text-foreground hover:underline"
          >
            {project.name}
          </Link>
        )}
        {onCreateTask && scope === 'opportunities' ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCreateTask(project.id) }}
            onDragStart={(e) => e.preventDefault()}
            draggable={false}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Criar tarefa nesta oportunidade"
            title="Criar tarefa nesta oportunidade"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Link
            to={`/projects/${project.id}/tasks?new=1`}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
            draggable={false}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Criar tarefa neste projeto"
            title="Criar tarefa neste projeto"
          >
            <Plus className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {project.__responsibleName && (
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" />
          {project.__responsibleName}
        </p>
      )}
      {project.__clientLabel && (
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {project.__clientLabel}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {/* Valor (revenue) à esquerda */}
        {project.__revenue > 0 ? (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(project.__revenue, project.currency || currency)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}

        {/* Responsável + time à direita (avatares pequenos) */}
        <div className="flex items-center gap-1">
          {project.__responsibleName && (
            <UserAvatar name={project.__responsibleName} size={20} />
          )}
          {teamIds.length > 0 && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" />
              {teamIds.length}
            </span>
          )}
        </div>
      </div>

      {endDate && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {new Date(endDate).toLocaleDateString(locale)}
        </p>
      )}
    </Card>
  )
}
