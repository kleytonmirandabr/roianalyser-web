import { Briefcase, Download, Plus, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { isUserInProject } from '@/features/projects/lib/scope-filter'
import type { Project } from '@/features/projects/types'
import { cn } from '@/shared/lib/cn'
import { ProjectsTabs } from './components/projects-tabs'
import { exportToCsv } from '@/shared/lib/export'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import {
  DataTableActiveFilters,
  DataTableHeaderCell,
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

function formatDate(value?: string) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

export function ProjectsListPage() {
  const { t } = useTranslation()
  const projects = useProjects()
  const { user } = useAuth()
  const [onlyMine, setOnlyMine] = useState(false)

  // Sprint H.5 — drill-down do mapa: query string ?state=UF aplica
  // filtro por estado da empresa cliente. Resolve via catálogo
  // companies (mesma lógica do GeoDistribution) — preferência pra
  // campo `clientState` no payload do projeto, fallback pro state da
  // empresa pelo nome.
  const [searchParams, setSearchParams] = useSearchParams()
  const stateFilter = (searchParams.get('state') ?? '').toUpperCase()
  const companies = useCatalog('companies')

  const filteredProjects = useMemo(() => {
    let all = projects.data ?? []
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
    return all
  }, [projects.data, onlyMine, user?.id, stateFilter, companies.data])

  function clearStateFilter() {
    const next = new URLSearchParams(searchParams)
    next.delete('state')
    setSearchParams(next, { replace: true })
  }

  // Colunas do DataTable — sort + filtro por valor único Excel-style.
  // `getValue` define o que serve pra ordenar/filtrar (não é o que aparece
  // na célula). Isso permite filtrar por status e ordenar por updatedAt
  // mesmo que o display seja formatado.
  const columns = useMemo<DataTableColumn<Project>[]>(
    () => [
      {
        key: 'name',
        label: t('projects.th.name'),
      },
      {
        key: 'status',
        label: t('projects.th.status'),
        getValue: (p) => p.status ?? '',
        formatValue: (v) => (v == null || v === '' ? '—' : String(v)),
      },
      {
        key: 'currency',
        label: t('projects.th.currency'),
        getValue: (p) => p.currency ?? '',
      },
      {
        key: 'updatedAt',
        label: t('projects.th.updatedAt'),
        getValue: (p) => p.updatedAt ?? '',
        // Filtrar por data não é tão útil — desabilita só esse caso.
        filterable: false,
      },
    ],
    [t],
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

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('nav.projects')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('projects.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Sprint H.5 — chip do filtro por estado vindo do drill-down do
          mapa. Click no X limpa e remove `?state=` da URL. */}
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

      <div className="flex items-center justify-end">
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
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-16" />
                  </TableCell>
                </TableRow>
              ))}
            {projects.isSuccess && dt.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-3">
                      <Briefcase className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {dt.hasActiveFilters
                          ? t('projects.emptyFiltered')
                          : t('projects.empty')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {dt.hasActiveFilters
                          ? t('projects.emptyFilteredHint')
                          : t('projects.emptyHint')}
                      </p>
                    </div>
                    {!dt.hasActiveFilters && (
                      <Button asChild size="sm">
                        <Link to="/projects/new">
                          <Plus className="h-4 w-4" />
                          <span>{t('projects.new')}</span>
                        </Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {dt.rows.map((project) => (
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
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {project.status || '—'}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.currency || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(project.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/projects/${project.id}`}>{t('projects.open')}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
