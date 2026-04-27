import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'

import { useProject } from '@/features/projects/hooks/use-project'
import { cn } from '@/shared/lib/cn'
import { Alert, AlertDescription } from '@/shared/ui/alert'

type SubNavItem = {
  to: string
  /** Chave i18n em projects.detail.tabs.* */
  labelKey: string
}

const SUB_NAV: SubNavItem[] = [
  { to: 'info', labelKey: 'projects.detail.tabs.info' },
  { to: 'resumo', labelKey: 'projects.detail.tabs.resumo' },
  { to: 'entradas', labelKey: 'projects.detail.tabs.entradas' },
  { to: 'financeiro', labelKey: 'projects.detail.tabs.financeiro' },
  { to: 'forecast', labelKey: 'projects.detail.tabs.forecast' },
  { to: 'schedule', labelKey: 'projects.detail.tabs.schedule' },
  { to: 'attachments', labelKey: 'projects.detail.tabs.attachments' },
  { to: 'tasks', labelKey: 'projects.detail.tabs.tasks' },
  { to: 'comments', labelKey: 'projects.detail.tabs.comments' },
  { to: 'history', labelKey: 'projects.detail.tabs.history' },
]

export function ProjectDetailPage() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('projects.detail.back')}
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
            {project.data.status || t('projects.detail.noStatus')} ·{' '}
            {project.data.currency || t('projects.detail.noCurrency')}
          </p>
        )}
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {SUB_NAV.map((item) => (
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
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div>
        <Outlet />
      </div>
    </div>
  )
}
