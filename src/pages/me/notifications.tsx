/**
 * Página /me/notifications — lista completa de notificações do user logado.
 *
 * Sprint #220 (sucessor da Sprint #219 que adicionou paginação cursor-based
 * e snooze). O sino mostra os 30 mais recentes; aqui o user vê o histórico
 * completo, filtra por tipo/status, e reativa as adiadas.
 */
import { useEffect, useRef } from 'react'
import { Bell, BellOff, ChevronRight, Clock, RefreshCcw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import {
  useMarkNotificationRead,
  useUnsnoozeNotification,
} from '@/features/notifications/hooks/use-server-notifications'
import { notificationsApi } from '@/features/notifications/api'
import type { ServerNotification } from '@/features/notifications/api-types'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

type Filter = 'all' | 'unread' | 'snoozed'

const KIND_LABEL: Record<string, string> = {
  task_created: 'Tarefa criada',
  task_updated: 'Tarefa atualizada',
  task_cancelled: 'Tarefa cancelada',
  task_completed: 'Tarefa concluída',
  task_overdue: 'Tarefa atrasada',
  task_reminder: 'Lembrete',
  digest_morning: 'Resumo diário',
}

const KIND_TONE: Record<string, string> = {
  task_created: 'bg-blue-500',
  task_updated: 'bg-indigo-500',
  task_cancelled: 'bg-zinc-400',
  task_completed: 'bg-emerald-600',
  task_overdue: 'bg-red-500',
  task_reminder: 'bg-amber-500',
  digest_morning: 'bg-emerald-500',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s atrás`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d} dia${d > 1 ? 's' : ''} atrás`
}

export function NotificationsListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [kindFilter, setKindFilter] = useState<string>('')
  const markRead = useMarkNotificationRead()
  const unsnooze = useUnsnoozeNotification()
  const sentinelRef = useRef<HTMLDivElement>(null)

  /**
   * useInfiniteQuery próprio aqui (em vez do useServerNotifications do sino),
   * pra essa página puxar com `includeSnoozed=1` e mostrar TUDO.
   */
  const query = useInfiniteQuery({
    queryKey: ['notifications', 'me-list', filter, kindFilter],
    queryFn: ({ pageParam }) =>
      notificationsApi.list({
        cursor: (pageParam as string | undefined) ?? undefined,
        limit: 50,
        onlyUnread: filter === 'unread',
        includeSnoozed: filter !== 'unread',
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 15_000,
  })

  const allItems: ServerNotification[] = (query.data?.pages ?? []).flatMap(
    (p) => p.items,
  )

  /** Filtros client-side por kind e por snoozed-only (server já faz unread). */
  const items = allItems.filter((n) => {
    if (filter === 'snoozed') {
      const isSnoozed = !!(n.snoozedUntil && new Date(n.snoozedUntil).getTime() > Date.now())
      if (!isSnoozed) return false
    }
    if (kindFilter && n.kind !== kindFilter) return false
    return true
  })

  /** Auto-fetch da próxima página quando o sentinel entra em viewport. */
  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage()
      }
    }, { rootMargin: '120px' })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [query.hasNextPage, query.isFetchingNextPage, query])

  function handleClick(n: ServerNotification) {
    if (!n.readAt) markRead.mutate(n.id)
    if (n.link) {
      navigate(n.link.startsWith('http') ? '/' : n.link)
    }
  }

  function handleUnsnooze(id: string) {
    unsnooze.mutate(id, {
      onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    })
  }

  /** Set de kinds disponíveis nas notificações já carregadas (pra dropdown). */
  const availableKinds = Array.from(new Set(allItems.map((n) => n.kind)))

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Bell className="h-5 w-5" /> Notificações
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico completo. As mais novas primeiro.
          </p>
        </div>
        <Link
          to="/me/notifications-prefs"
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Configurar preferências
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        {(['all', 'unread', 'snoozed'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1.5 text-sm transition ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'unread' ? 'Não lidas' : 'Adiadas'}
          </button>
        ))}
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="ml-auto rounded border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Todos os tipos</option>
          {availableKinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k] || k}
            </option>
          ))}
        </select>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
          <BellOff className="h-8 w-8 opacity-30" />
          {filter === 'unread'
            ? 'Tudo limpo — nenhuma notificação não lida.'
            : filter === 'snoozed'
            ? 'Nenhuma notificação adiada no momento.'
            : 'Sem notificações por aqui ainda.'}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((n) => {
            const isUnread = !n.readAt
            const isSnoozed =
              !!(n.snoozedUntil && new Date(n.snoozedUntil).getTime() > Date.now())
            return (
              <li
                key={n.id}
                className={`group relative flex items-start gap-3 p-3 transition ${
                  isUnread ? 'bg-blue-50/40 dark:bg-blue-950/10' : 'bg-background'
                }`}
              >
                <span
                  className={`mt-2 inline-block h-2 w-2 shrink-0 rounded-full ${
                    KIND_TONE[n.kind] || 'bg-zinc-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left hover:text-foreground"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className={`text-sm ${
                          isUnread ? 'font-semibold' : 'font-normal'
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatRelative(n.createdAt)}
                      </span>
                    </div>
                    {n.body && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {n.body}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5">
                        {KIND_LABEL[n.kind] || n.kind}
                      </span>
                      <span className="tabular-nums">
                        {formatDateTime(n.createdAt)}
                      </span>
                      {isSnoozed && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                          <Clock className="h-3 w-3" /> Adiada até{' '}
                          {formatDateTime(n.snoozedUntil!)}
                        </span>
                      )}
                    </div>
                  </div>
                  {n.link && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
                {isSnoozed && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnsnooze(n.id)}
                    disabled={unsnooze.isPending}
                    className="shrink-0"
                  >
                    <RefreshCcw className="mr-1 h-3 w-3" /> Reativar
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div ref={sentinelRef} className="h-1" />

      {query.isFetchingNextPage && (
        <div className="py-4 text-center text-xs text-muted-foreground">
          Carregando mais...
        </div>
      )}
      {!query.hasNextPage && items.length > 0 && (
        <div className="py-4 text-center text-xs text-muted-foreground">
          Fim do histórico.
        </div>
      )}
    </div>
  )
}
