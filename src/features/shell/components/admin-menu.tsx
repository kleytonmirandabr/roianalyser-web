/**
 * AdminMenu — Sprint #224.
 *
 * Botão de engrenagem (Settings) na toolbar superior que abre dropdown
 * com a seção "Administração" do sistema. Cadastros CRM / ROI continuam
 * na sidebar — só Administração foi pra cá.
 */
import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useAppState } from '@/features/admin/hooks/use-app-state'
import { getRoleLevel } from '@/features/auth/lib/permissions'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

interface AdminItem {
  i18nKey: string
  to: string
  requiresLevel: 'master' | 'admin' | 'user'
}

const ADMIN_ITEMS: AdminItem[] = [
  { i18nKey: 'adminUsers',           to: '/admin',                 requiresLevel: 'admin'  },
  { i18nKey: 'adminProfiles',        to: '/admin/profiles',        requiresLevel: 'admin'  },
  { i18nKey: 'adminUserGroups',      to: '/admin/user-groups',     requiresLevel: 'master' },
  { i18nKey: 'adminPlans',           to: '/admin/plans',           requiresLevel: 'master' },
  { i18nKey: 'adminFunctionalities', to: '/admin/functionalities', requiresLevel: 'master' },
  { i18nKey: 'adminClients',         to: '/admin/clients',         requiresLevel: 'master' },
  { i18nKey: 'adminWorkflow',        to: '/admin/workflow-rules',  requiresLevel: 'master' },
  { i18nKey: 'adminBranding',        to: '/admin/branding',        requiresLevel: 'master' },
  { i18nKey: 'adminEmailLog',        to: '/admin/email-log',       requiresLevel: 'admin'  },
  { i18nKey: 'audit',                to: '/audit',                 requiresLevel: 'admin'  },
]

function canSee(required: AdminItem['requiresLevel'], role: 'master' | 'admin' | 'user'): boolean {
  if (required === 'master') return role === 'master'
  if (required === 'admin')  return role === 'master' || role === 'admin'
  return true
}

export function AdminMenu() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const appState = useAppState()
  const role = getRoleLevel(user, appState.data?.profiles ?? [])

  const visibleItems = ADMIN_ITEMS.filter(it => canSee(it.requiresLevel, role))
  if (visibleItems.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={t('nav.admin', 'Administração')}
          aria-label={t('nav.admin', 'Administração')}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('nav.admin', 'Administração')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visibleItems.map(it => (
          <DropdownMenuItem key={it.to} asChild>
            <Link to={it.to} className="cursor-pointer">
              {t(`nav.${it.i18nKey}`, it.i18nKey)}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
