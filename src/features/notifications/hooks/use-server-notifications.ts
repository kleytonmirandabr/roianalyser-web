import {
  useInfiniteQuery, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query'

import { notificationsApi } from '../api'
import type { NotificationPrefs, SnoozeRequest } from '../api-types'

export function useServerNotifications() {
  return useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn: ({ pageParam }) => notificationsApi.list({ cursor: pageParam ?? undefined, limit: 30 }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'list'] }),
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'list'] }),
  })
}

export function useSnoozeNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SnoozeRequest }) =>
      notificationsApi.snooze(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'list'] }),
  })
}

export function useUnsnoozeNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.unsnooze(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'list'] }),
  })
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notifications', 'prefs'],
    queryFn: () => notificationsApi.getPrefs(),
  })
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) => notificationsApi.updatePrefs(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'prefs'] }),
  })
}
