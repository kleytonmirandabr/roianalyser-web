import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { cn } from '@/shared/lib/cn'

/**
 * Sub-nav das views da seção Projetos: Lista, Kanban (board), Funil
 * (funnel). Mantém estado da view via URL — cada view é uma rota própria
 * com seu chunk lazy.
 */
export function ProjectsTabs() {
  const { t } = useTranslation()
  const items = [
    { to: '/projects', label: t('projects.tabs.list'), end: true },
    { to: '/projects/board', label: t('projects.tabs.board') },
    { to: '/projects/funnel', label: t('projects.tabs.funnel') },
    { to: '/projects/lost', label: t('projects.tabs.lost') },
  ]
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
