/**
 * Admin > Logs de Email — visibilidade dos disparos de notificação por email.
 *
 * Sprint #219 (parte do #216 fase 1.5 — observabilidade).
 *
 * Visível pra Master (vê todo tenant, com filtro opcional) e Admin (vê só do próprio).
 * User comum é redirecionado pra /admin (RequireRole=admin).
 */
import { useMemo, useState } from 'react'
import { CheckCircle2, XCircle, Mail, RefreshCw, Filter, AlertTriangle } from 'lucide-react'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { useEmailLog } from '@/features/email-log/hooks/use-email-log'
import type { EmailLogItem, EmailLogFilters } from '@/features/email-log/types'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'
import { Combobox } from '@/shared/ui/combobox'
import { formatDateTime } from '@/shared/lib/format'
import { useUserTimezone } from '@/shared/lib/use-user-timezone'

const KIND_LABELS: Record<string, string> = {
  created: 'Criação',
  overdue: 'Atrasada',
  reminder_15m: 'Lembrete 15min',
  reminder_1h: 'Lembrete 1h',
  reminder_1d: 'Lembrete 1 dia',
  digest: 'Digest matinal',
  completed_by_other: 'Conclusão',
}

function statusPill(status: string) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Entregue
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/30 px-2 py-0.5 text-xs font-medium text-red-800 dark:text-red-300">
        <XCircle className="h-3 w-3" /> Falhou
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
      {status}
    </span>
  )
}

export function AdminEmailLogPage() {
  const { user } = useAuth()
  const tz = useUserTimezone()

  void user; // permissao via <RequireRole level="admin"> no router

  const [kind, setKind] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filters: EmailLogFilters = useMemo(() => ({
    kind: kind || undefined,
    status: status || undefined,
    limit: 200,
  }), [kind, status])

  const query = useEmailLog(filters)
  const items: EmailLogItem[] = query.data?.items ?? []
  const stats = query.data?.stats

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Mail className="h-6 w-6" /> Logs de Email
          </h1>
          <p className="text-sm text-muted-foreground">
            Disparos de notificação por email (criação de tarefa, atraso, lembretes, digest matinal). Atualiza a cada 30s.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${query.isFetching ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Últimas 24h</div>
              <div className="text-2xl font-semibold tabular-nums">{stats.total24h}</div>
              <div className="text-xs text-muted-foreground">disparos no total</div>
            </CardContent>
          </Card>
          <Card className={stats.failed1h > 0 ? 'border-red-300' : ''}>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                {stats.failed1h > 0 && <AlertTriangle className="h-3 w-3 text-red-600" />}
                Falhas — última hora
              </div>
              <div className={`text-2xl font-semibold tabular-nums ${stats.failed1h > 0 ? 'text-red-600' : ''}`}>{stats.failed1h}</div>
              <div className="text-xs text-muted-foreground">{stats.failed1h > 0 ? 'verifique SMTP/credenciais' : 'tudo certo'}</div>
            </CardContent>
          </Card>
          <Card className={stats.failed24h > 0 ? 'border-amber-300' : ''}>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Falhas — últimas 24h</div>
              <div className={`text-2xl font-semibold tabular-nums ${stats.failed24h > 0 ? 'text-amber-600' : ''}`}>{stats.failed24h}</div>
              <div className="text-xs text-muted-foreground">acumulado</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tipo:</span>
            <div className="w-48">
              <Combobox
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'created', label: 'Criação' },
                  { value: 'overdue', label: 'Atrasada' },
                  { value: 'reminder_15m', label: 'Lembrete 15min' },
                  { value: 'reminder_1h', label: 'Lembrete 1h' },
                  { value: 'reminder_1d', label: 'Lembrete 1 dia' },
                  { value: 'digest', label: 'Digest matinal' },
                ]}
                value={kind}
                onChange={setKind}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <div className="w-40">
              <Combobox
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'sent', label: 'Entregue' },
                  { value: 'failed', label: 'Falhou' },
                ]}
                value={status}
                onChange={setStatus}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum disparo encontrado. Crie uma tarefa pra ver o primeiro email aparecendo aqui.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div
              key={it.id}
              className={`rounded-md border bg-card p-3 transition-colors ${it.status === 'failed' ? 'border-red-300' : ''}`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusPill(it.status)}
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">{KIND_LABELS[it.kind] || it.kind}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(it.sentAt, tz)}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium">{it.taskTitle || `Tarefa #${it.taskId}`}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>👤 {it.userName || '—'}</span>
                    {it.userEmail && (
                      <span className="font-mono">📧 {it.userEmail}</span>
                    )}
                    {it.tenantName && <span>🏢 {it.tenantName}</span>}
                    <span>📡 {it.channel}</span>
                  </div>
                  {it.status === 'failed' && it.error && (
                    <button
                      type="button"
                      className="mt-2 block w-full rounded bg-red-50 dark:bg-red-950/20 p-2 text-left text-xs font-mono text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/40"
                      onClick={() => setExpandedId(expandedId === it.id ? null : it.id)}
                    >
                      {expandedId === it.id ? it.error : (it.error.length > 120 ? it.error.slice(0, 120) + '…' : it.error)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
