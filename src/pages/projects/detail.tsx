import { ChevronLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'

import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { useProject } from '@/features/projects/hooks/use-project'
import {
  getProjectCategory,
  isTabVisible,
} from '@/features/projects/lib/project-phase'
import {
  PROJECT_CATEGORIES,
  STATUS_CATEGORY_LABELS,
  type ProjectStatus,
} from '@/features/projects/lib/status-categories'
import { cn } from '@/shared/lib/cn'
import { Alert, AlertDescription } from '@/shared/ui/alert'

type SubNavItem = {
  to: string
  /** Chave usada no mapa TAB_VISIBILITY (também base da i18n key). */
  key: string
  /** Chave i18n em projects.detail.tabs.* */
  labelKey: string
}

/**
 * Lista canônica de abas. Ordem aqui = ordem de exibição.
 * `key` é usado pra consultar `isTabVisible(key, category)`.
 */
const SUB_NAV: SubNavItem[] = [
  { to: 'info', key: 'info', labelKey: 'projects.detail.tabs.info' },
  { to: 'resumo', key: 'resumo', labelKey: 'projects.detail.tabs.resumo' },
  { to: 'entradas', key: 'entradas', labelKey: 'projects.detail.tabs.entradas' },
  { to: 'financeiro', key: 'financeiro', labelKey: 'projects.detail.tabs.financeiro' },
  { to: 'contract', key: 'contract', labelKey: 'projects.detail.tabs.contract' },
  { to: 'forecast', key: 'forecast', labelKey: 'projects.detail.tabs.forecast' },
  { to: 'schedule', key: 'schedule', labelKey: 'projects.detail.tabs.schedule' },
  { to: 'attachments', key: 'attachments', labelKey: 'projects.detail.tabs.attachments' },
  { to: 'tasks', key: 'tasks', labelKey: 'projects.detail.tabs.tasks' },
  { to: 'comments', key: 'comments', labelKey: 'projects.detail.tabs.comments' },
  { to: 'history', key: 'history', labelKey: 'projects.detail.tabs.history' },
]

export function ProjectDetailPage() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)
  const statuses = useCatalog('projectStatuses')

  /**
   * Categoria atual do projeto. `null` = sem categoria detectável (status
   * não cadastrado no catálogo nem bate em keyword fallback). Filtro de
   * abas é permissivo nesse caso — mostra tudo, pra não quebrar tenants
   * ainda não migrados.
   */
  const category = useMemo(
    () =>
      getProjectCategory(
        project.data?.status,
        (statuses.data ?? []) as unknown as ProjectStatus[],
      ),
    [project.data?.status, statuses.data],
  )

  const visibleTabs = useMemo(
    () => SUB_NAV.filter((item) => isTabVisible(item.key, category)),
    [category],
  )

  /**
   * Volta pra Oportunidades ou Projetos conforme a categoria atual do
   * projeto. Se sem categoria detectável (status não migrado), default
   * pra Oportunidades — onde a maioria dos projetos não-migrados aparece.
   */
  const backHref =
    category && PROJECT_CATEGORIES.includes(category)
      ? '/projects'
      : '/opportunities'
  const backLabel =
    backHref === '/projects'
      ? t('nav.projects', { defaultValue: 'Projetos' })
      : t('nav.opportunities', { defaultValue: 'Oportunidades' })

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>

      {project.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('projects.detail.loadError')}
          </AlertDescription>
        </Alert>
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {project.data?.name ?? t('app.loading')}
        </h1>
        {project.data && (
          <p className="text-sm text-muted-foreground">
            {project.data.status || t('projects.detail.noStatus')}
            {category && (
              <>
                {' '}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                  {STATUS_CATEGORY_LABELS[category]}
                </span>
              </>
            )}
            {' · '}
            {project.data.currency || t('projects.detail.noCurrency')}
          </p>
        )}
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {visibleTabs.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {t(item.labelKey, {
              defaultValue: item.key === 'contract' ? 'Contrato' : item.key,
            })}
          </NavLink>
        ))}
      </nav>

      <div>
        <Outlet />
      </div>
    </div>
  )
}
