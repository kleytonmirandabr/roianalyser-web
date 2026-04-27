import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { getRoleLevel } from '@/features/auth/lib/permissions'
import { cn } from '@/shared/lib/cn'

type TabLevel = 'master' | 'admin'

/**
 * Sub-nav da página /admin/*. Cada tab tem um `level` mínimo:
 *   - 'admin' → admin OU master vê
 *   - 'master' → só master vê
 *
 * Antes da Sprint H.6, todas as 7 tabs apareciam pra qualquer admin —
 * mas as rotas master-only redirecionavam pra dashboard, gerando UX
 * confusa (clica e cai no dashboard sem aviso). Agora filtra inline.
 */
export function AdminTabs() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const appState = useAppState()
  const role = getRoleLevel(user, appState.data?.profiles ?? [])

  const items: Array<{
    to: string
    label: string
    end?: boolean
    level: TabLevel
  }> = [
    { to: '/admin', label: t('admin.tabs.users'), end: true, level: 'admin' },
    { to: '/admin/profiles', label: t('admin.tabs.profiles'), level: 'admin' },
    { to: '/admin/plans', label: t('admin.tabs.plans'), level: 'master' },
    {
      to: '/admin/functionalities',
      label: t('admin.tabs.functionalities'),
      level: 'master',
    },
    { to: '/admin/clients', label: t('admin.tabs.clients'), level: 'master' },
    {
      to: '/admin/workflow-rules',
      label: t('admin.tabs.workflow'),
      level: 'master',
    },
    { to: '/admin/branding', label: t('admin.tabs.branding'), level: 'master' },
  ]

  const visible = items.filter((it) =>
    it.level === 'master' ? role === 'master' : role === 'master' || role === 'admin',
  )

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border">
      {visible.map((it) => (
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
