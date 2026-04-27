import { Bell, CheckCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  generateNotifications,
  markAllRead,
  markRead,
  readReadIds,
  type Notification,
} from '@/features/notifications/lib/notifications'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

const TONE_DOT: Record<Notification['tone'], string> = {
  bad: 'bg-destructive',
  warn: 'bg-amber-500',
  info: 'bg-blue-500',
}

export function NotificationsBell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const projects = useProjects()
  const [, forceRender] = useState(0)

  const allNotifs = useMemo(
    () => generateNotifications(projects.data ?? [], user?.id),
    [projects.data, user?.id],
  )

  const readIds = readReadIds(user?.id)
  const unread = allNotifs.filter((n) => !readIds.has(n.id))

  function refresh() {
    forceRender((v) => v + 1)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread.length > 0 && (
            <span className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {unread.length > 99 ? '99+' : unread.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">
            {t('notifications.title')}
          </span>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                markAllRead(user?.id, allNotifs)
                refresh()
              }}
            >
              <CheckCheck className="h-3 w-3" />
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {allNotifs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t('notifications.empty')}
            </div>
          ) : (
            allNotifs.slice(0, 30).map((n) => {
              const isRead = readIds.has(n.id)
              return (
                <Link
                  key={n.id}
                  to={n.link ?? '#'}
                  onClick={() => {
                    markRead(user?.id, [n.id])
                    refresh()
                  }}
                  className={cn(
                    'block border-b border-border/50 px-3 py-2 text-sm hover:bg-accent',
                    isRead && 'opacity-60',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        'mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0',
                        isRead ? 'bg-muted-foreground/30' : TONE_DOT[n.tone],
                      )}
                    />
                    <div className="flex-1 leading-snug">{n.message}</div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
        {allNotifs.length > 30 && (
          <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
            {t('notifications.showingFirst', { n: 30 })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
