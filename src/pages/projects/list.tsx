import { Briefcase, Download, Plus, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import {
  AdvancedFilters,
  useAdvancedFilters,
} from '@/features/projects/components/advanced-filters'
import {
  ColumnSelector,
  useColumnSelector,
} from '@/features/projects/components/column-selector'
import { useProjects } from '@/features/projects/hooks/use-projects'
import {
  applyFilters,
  PROJECT_FIELDS_BY_KEY,
  type ProjectField,
} from '@/features/projects/lib/project-fields'
import { isUserInProject } from '@/features/projects/lib/scope-filter'
import {
  isInScope,
  statusInCategory,
  type FunnelScope,
  type ProjectStatus,
} from '@/features/projects/lib/status-categories'
import type { Project } from '@/features/projects/types'
import { cn } from '@/shared/lib/cn'
import { exportToCsv } from '@/shared/lib/export'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import {
  DataTableActiveFilters,
  DataTableHeaderCell,
  DataTablePagination,
  useDataTable,
  type DataTableColumn,
} from '@/shared/ui/data-table'
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

function formatDate(value?: string) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

/**
 * Renderiza o valor de um campo numa célula, aplicando formatador
 * apropriado pelo tipo (data → toLocaleDateString, boolean → Sim/Não).
 */
function renderCell(field: ProjectField, project: Project): string {
  if (field.render) return field.render(project)
  const v = field.getValue(project)
  if (v == null || v === '') return '—'
  if (field.type === 'date') return formatDate(String(v))
  if (field.type === 'boolean') return v ? 'Sim' : 'Não'
  return String(v)
}

export function ProjectsListPage({ scope = 'projects' }: { scope?: FunnelScope }) {
  const { t } = useTranslation()
  const projects = useProjects()
  const statuses = useCatalog('projectStatuses')
  const { user } = useAuth()
  const [onlyMine, setOnlyMine] = useState(false)
  const [includeLost, setIncludeLost] = useState(false)

  // #4 Colunas configuráveis (persiste em localStorage).
  const columnSelector = useColumnSelector()
  // #5 Filtros avançados (state local, não persiste — sessão a sessão).
  const advancedFilters = useAdvancedFilters()

  // Sprint H.5 — drill-down do mapa: query string ?state=UF aplica
  // filtro por estado da empresa cliente.
  const [searchParams, setSearchParams] = useSearchParams()
  const stateFilter = (searchParams.get('state') ?? '').toUpperCase()
  const companies = useCatalog('companies')

  // Set de nomes de status que pertencem à categoria 'lost'.
  const lostStatusNames = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    const list = (statuses.data ?? []) as unknown as ProjectStatus[]
    for (const s of list) {
      if (typeof s.name !== 'string') continue
      if (statusInCategory(s, 'lost')) set.add(s.name)
    }
    const seen = new Set<string>()
    for (const p of projects.data ?? []) {
      if (!p.status || seen.has(p.status)) continue
      seen.add(p.status)
      if (statusInCategory({ id: '', name: p.status }, 'lost')) set.add(p.status)
    }
    return set
  }, [statuses.data, projects.data])

  /**
   * Pipeline de filtros aplicado na ordem:
   *   1. Esconde perdidas (toggle "Incluir perdidas")
   *   2. Apenas meus (toggle)
   *   3. Drill-down de UF (?state=)
   *   4. Filtros avançados (chips empilháveis)
   */
  const filteredProjects = useMemo(() => {
    let all = projects.data ?? []
    // Filtro de escopo: oportunidades vs projetos. Aplicado primeiro
    // pra reduzir o universo antes dos demais filtros.
    const allStatusList = (statuses.data ?? []) as unknown as ProjectStatus[]
    all = all.filter((p) => isInScope(p.status, scope, allStatusList))
    if (!includeLost) {
      all = all.filter((p) => !p.status || !lostStatusNames.has(p.status))
    }
    if (onlyMine) {
      all = all.filter((p) => isUserInProject(p, user?.id))
    }
    if (stateFilter) {
      const companyByName = new Map<string, string>()
      for (const raw of companies.data ?? []) {
        const name = typeof raw?.name === 'string' ? raw.name : null
        const state = typeof raw?.state === 'string' ? raw.state : null
        if (name && state) {
          companyByName.set(name.toLowerCase().trim(), state.toUpperCase())
        }
      }
      all = all.filter((p) => {
        const payload = (p.payload ?? {}) as Record<string, unknown>
        const explicit =
          typeof payload.clientState === 'string' ? payload.clientState : null
        if (explicit) return explicit.toUpperCase() === stateFilter
        const clientName =
          typeof p.clientName === 'string'
            ? p.clientName
            : typeof payload.clientName === 'string'
              ? (payload.clientName as string)
              : ''
        if (!clientName) return false
        const st = companyByName.get(clientName.toLowerCase().trim())
        return st === stateFilter
      })
    }
    all = applyFilters(all, advancedFilters.filters)
    return all
  }, [
    projects.data,
    onlyMine,
    includeLost,
    lostStatusNames,
    user?.id,
    stateFilter,
    companies.data,
    advancedFilters.filters,
    scope,
    statuses.data,
  ])

  function clearStateFilter() {
    const next = new URLSearchParams(searchParams)
    next.delete('state')
    setSearchParams(next, { replace: true })
  }

  /**
   * Colunas do DataTable derivadas das colunas visíveis escolhidas pelo
   * user. `getValue` vem do registry do projeto. `formatValue` no filtro
   * dropdown reusa o mesmo render de célula pra consistência.
   */
  const columns = useMemo<DataTableColumn<Project>[]>(
    () =>
      columnSelector.visibleFields.map((field) => ({
        key: field.key,
        label: field.label,
        getValue: (p) => {
          const v = field.getValue(p)
          // DataTable type aceita string|number|boolean|null|undefined
          return v as string | number | boolean | null | undefined
        },
        formatValue: (v) =>
          v == null || v === '' ? '—' : String(v),
        // Filtro dropdown de data não é útil — desabilita.
        filterable: field.type !== 'date',
      })),
    [columnSelector.visibleFields],
  )

  const dt = useDataTable(filteredProjects, columns)

  function handleExport() {
    const rows = (filteredProjects ?? []).map((p) => ({
      id: p.id,
      nome: p.name,
      status: p.status ?? '',
      moeda: p.currency ?? '',
      ativo: p.active === false ? 'Não' : 'Sim',
      atualizadoEm: p.updatedAt ?? '',
      criadoEm: p.createdAt ?? '',
    }))
    exportToCsv(rows, `projetos-${new Date().toISOString().slice(0, 10)}`, [
      { key: 'id', label: 'ID' },
      { key: 'nome', label: 'Nome' },
      { key: 'status', label: 'Status' },
      { key: 'moeda', label: 'Moeda' },
      { key: 'ativo', label: 'Ativo' },
      { key: 'atualizadoEm', label: 'Atualizado em' },
      { key: 'criadoEm', label: 'Criado em' },
    ])
  }

  const colCount = columns.length + 1 // +1 = coluna de ações

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {scope === 'opportunities' ? t('nav.opportunities') : t('nav.projects')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {scope === 'opportunities'
              ? t('projects.opportunitiesSubtitle', {
                  defaultValue:
                    'Funil pré-Win: leads, avaliações de ROI e contratos em formação.',
                })
              : t('projects.projectsSubtitle', {
                  defaultValue:
                    'Projetos pós-ganho: execução, faturamento e garantia.',
                })}
          </p>
        </div>
        <div className="flex gap-2">
          <ColumnSelector state={columnSelector} />
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!projects.isSuccess || projects.data.length === 0}
          >
            <Download className="h-4 w-4" />
            <span>{t('projects.exportCsv')}</span>
          </Button>
          <Button asChild>
            <Link to="/projects/new">
              <Plus className="h-4 w-4" />
              <span>{t('projects.new')}</span>
            </Link>
          </Button>
        </div>
      </div>

      <ProjectsTabs />

      {/* Sprint H.5 — chip do filtro por estado vindo do drill-down. */}
      {stateFilter && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-foreground">
            {t('projects.filterByState', {
              defaultValue: 'Filtrado por estado:',
            })}
          </span>
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            {stateFilter}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            ({filteredProjects.length}{' '}
            {filteredProjects.length === 1 ? 'projeto' : 'projetos'})
          </span>
          <button
            type="button"
            onClick={clearStateFilter}
            className="ml-auto text-xs text-primary underline-offset-2 hover:underline"
          >
            {t('projects.clearStateFilter', {
              defaultValue: 'limpar',
            })}
          </button>
        </div>
      )}

      {/* Filtros avançados — chips empilháveis. */}
      <AdvancedFilters state={advancedFilters} />

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setIncludeLost((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
            includeLost
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background hover:bg-accent',
          )}
          title={t('projects.includeLost', {
            defaultValue: 'Incluir oportunidades perdidas na lista',
          })}
        >
          {includeLost
            ? t('projects.includeLostOn', { defaultValue: 'Incluindo perdidas' })
            : t('projects.includeLostOff', { defaultValue: 'Incluir perdidas' })}
        </button>
        <button
          type="button"
          onClick={() => setOnlyMine((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
            onlyMine
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background hover:bg-accent',
          )}
          title={t('projects.onlyMine')}
        >
          <User className="h-3 w-3" />
          {onlyMine ? t('projects.onlyMineOn') : t('projects.onlyMineOff')}
        </button>
      </div>

      {projects.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.loadError')}</AlertDescription>
        </Alert>
      )}

      <DataTableActiveFilters
        state={dt as never}
        columns={columns as never}
      />

      <Card className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <DataTableHeaderCell
                  key={col.key}
                  column={col}
                  state={dt}
                />
              ))}
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Skeleton className="h-8 w-16" />
                  </TableCell>
                </TableRow>
              ))}
            {projects.isSuccess && dt.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="py-12">
                  {(() => {
                    const hasFilters =
                      dt.hasActiveFilters || advancedFilters.filters.length > 0
                    /**
                     * Heurística: estamos no scope=projects mas o tenant
                     * tem projetos (apenas nenhum está em pós-Win) E
                     * nenhum status do catálogo tem categoria pós-Win.
                     * Sugere categorizar — esse é o caso mais comum
                     * pós-migração.
                     */
                    const tenantHasProjects =
                      (projects.data ?? []).length > 0
                    const anyProjectScopedStatus = (
                      (statuses.data ?? []) as unknown as ProjectStatus[]
                    ).some(
                      (s) =>
                        s.category &&
                        ['won', 'execution', 'invoicing', 'done', 'warranty'].includes(
                          s.category,
                        ),
                    )
                    const showCategorizeHint =
                      scope === 'projects' &&
                      !hasFilters &&
                      tenantHasProjects &&
                      !anyProjectScopedStatus
                    return (
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="rounded-full bg-muted p-3">
                          <Briefcase className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="max-w-md">
                          <p className="font-medium text-foreground">
                            {hasFilters
                              ? t('projects.emptyFiltered')
                              : showCategorizeHint
                                ? 'Nenhum projeto pós-ganho ainda'
                                : t('projects.empty')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {hasFilters
                              ? t('projects.emptyFilteredHint')
                              : showCategorizeHint
                                ? `Você tem ${projects.data?.length ?? 0} oportunidade${(projects.data?.length ?? 0) === 1 ? '' : 's'}, mas nenhum status está marcado como "Ganho (Win)". Categorize seu status de fechamento pra ver os projetos aqui.`
                                : t('projects.emptyHint')}
                          </p>
                        </div>
                        {showCategorizeHint ? (
                          <Button asChild size="sm">
                            <Link to="/catalogs/project-statuses">
                              Configurar status
                            </Link>
                          </Button>
                        ) : (
                          !hasFilters && (
                            <Button asChild size="sm">
                              <Link to="/projects/new">
                                <Plus className="h-4 w-4" />
                                <span>{t('projects.new')}</span>
                              </Link>
                            </Button>
                          )
                        )}
                      </div>
                    )
                  })()}
                </TableCell>
              </TableRow>
            )}
            {dt.paginatedRows.map((project) => (
              <TableRow key={project.id}>
                {columnSelector.visibleFields.map((field) => {
                  const cellText = renderCell(field, project)
                  // Coluna do nome é a única clicável (link pro detalhe).
                  if (field.key === 'name') {
                    return (
                      <TableCell key={field.key} className="font-medium">
                        <Link
                          to={`/projects/${project.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {cellText}
                        </Link>
                      </TableCell>
                    )
                  }
                  if (field.key === 'status') {
                    return (
                      <TableCell key={field.key}>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {cellText}
                        </span>
                      </TableCell>
                    )
                  }
                  return (
                    <TableCell
                      key={field.key}
                      className="text-muted-foreground"
                    >
                      {cellText}
                    </TableCell>
                  )
                })}
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/projects/${project.id}`}>
                      {t('projects.open')}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <DataTablePagination state={dt} />
    </div>
  )
}

// Re-uso de PROJECT_FIELDS_BY_KEY pra silenciar warning de import não-usado
// quando a tabela renderiza só via `columnSelector.visibleFields`.
void PROJECT_FIELDS_BY_KEY
