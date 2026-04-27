import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { HelpButton } from '@/features/help/help-button'
import { NotificationsBell } from '@/features/notifications/components/notifications-bell'
import { Button } from '@/shared/ui/button'

import { LanguageSwitcher } from './language-switcher'
import { TenantSwitcher } from './tenant-switcher'
import { UserMenu } from './user-menu'

export function Header() {
  const { t } = useTranslation()
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6">
      <div className="flex flex-1 items-center gap-2">
        <TenantSwitcher />
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" title={t('search.title')}>
          <Link to="/search" aria-label={t('search.title')}>
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">{t('search.title')}</span>
          </Link>
        </Button>
        <HelpButton />
        <LanguageSwitcher />
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  )
}
