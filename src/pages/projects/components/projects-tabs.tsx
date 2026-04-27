import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'

import type { FunnelScope } from '@/features/projects/lib/status-categories'
import { cn } from '@/shared/lib/cn'

/**
 * Sub-nav que muda conforme estamos em /opportunities/* ou /projects/*.
 *
 * - Oportunidades: 4 views (Lista, Kanban, Funil, Perdidas) — pre-Win
 * - Projetos: 1 view (Lista) por enquanto — pós-Win
 *
 * O `scope` é detectado pelo prefixo do pathname pra evitar prop drill.
 */
export function ProjectsTabs() {
  const { t } = useTranslation()
  const location = useLocation()
  const scope: FunnelScope = location.pathname.startsWith('/opportunities')
    ? 'opportunities'
    : 'projects'

  const items =
    scope === 'opportunities'
      ? [
          { to: '/opportunities', label: t('projects.tabs.list'), end: true },
          { to: '/opportunities/board', label: t('projects.tabs.board') },
          { to: '/opportunities/funnel', label: t('projects.tabs.funnel') },
          { to: '/opportunities/lost', label: t('projects.tabs.lost') },
        ]
      : [{ to: '/projects', label: t('projects.tabs.list'), end: true }]

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )
          }
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}
