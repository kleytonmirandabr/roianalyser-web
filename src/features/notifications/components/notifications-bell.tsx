import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  useServerNotifications, useMarkAllRead, useMarkNotificationRead,
} from '@/features/notifications/hooks/use-server-notifications'
import type { ServerNotification } from '@/features/notifications/api-types'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

const KIND_TONE: Record<string, string> = {
  task_created: 'bg-blue-500',
  task_overdue: 'bg-red-500',
  task_reminder: 'bg-amber-500',
  digest_morning: 'bg-emerald-500',
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

export function NotificationsBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const query = useServerNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()

  const items: ServerNotification[] = query.data?.items ?? []
  const unread = query.data?.unreadCount ?? 0

  function handleClick(n: ServerNotification) {
    if (!n.readAt) markRead.mutate(n.id)
    if (n.link) {
      setOpen(false)
      navigate(n.link.startsWith('http') ? '/' : n.link)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3 w-3" /> Marcar tudo lido
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {query.isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sem notificações por aqui. Vou avisar quando algo acontecer.
            </div>
          ) : (
            items.slice(0, 30).map(n => {
              const isUnread = !n.readAt
              return (
                <button
                  type="button"
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left hover:bg-muted/50 ${isUnread ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}
                >
                  <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${KIND_TONE[n.kind] || 'bg-zinc-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm ${isUnread ? 'font-semibold' : 'font-normal'}`}>{n.title}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </div>
                    {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                  </div>
                </button>
              )
            })
          )}
        </div>
        <div className="border-t border-border p-2">
          <Link
            to="/me/notifications-prefs"
            onClick={() => setOpen(false)}
            className="block w-full rounded px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            Configurar preferências de notificação
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
