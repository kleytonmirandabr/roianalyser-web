import { Download, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuditLog } from '@/features/audit/hooks/use-audit-log'
import { exportToCsv } from '@/shared/lib/export'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

function formatTimestamp(value: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function AuditLogPage() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const [limit, setLimit] = useState(200)
  const audit = useAuditLog({ limit })

  const filtered = (audit.data ?? []).filter((event) => {
    if (!filter) return true
    const f = filter.toLowerCase()
    return (
      event.type.toLowerCase().includes(f) ||
      event.message.toLowerCase().includes(f) ||
      event.user.toLowerCase().includes(f) ||
      event.entityName.toLowerCase().includes(f)
    )
  })

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('audit.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
      </div>

      {audit.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('audit.loadError')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 space-y-1.5 min-w-[240px]">
          <Label htmlFor="audit-filter">{t('audit.filter')}</Label>
          <Input
            id="audit-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('audit.filterPlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-limit">{t('audit.limit')}</Label>
          <Input
            id="audit-limit"
            type="number"
            min={50}
            max={2000}
            step={50}
            value={limit}
            onChange={(e) =>
              setLimit(Math.max(50, Math.min(2000, Number(e.target.value) || 200)))
            }
            className="w-24"
          />
        </div>
        <Button variant="outline" onClick={() => audit.refetch()}>
          {t('audit.refresh')}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            exportToCsv(
              filtered.map((e) => ({
                quando: e.ts ?? '',
                tipo: e.type,
                mensagem: e.message,
                usuario: e.user,
                userId: e.userId,
                entidade: e.entityName,
                entityId: e.entityId,
                clientId: e.clientId,
              })),
              `auditoria-${new Date().toISOString().slice(0, 10)}`,
              [
                { key: 'quando', label: 'Quando' },
                { key: 'tipo', label: 'Tipo' },
                { key: 'mensagem', label: 'Mensagem' },
                { key: 'usuario', label: 'Usuário' },
                { key: 'userId', label: 'User ID' },
                { key: 'entidade', label: 'Entidade' },
                { key: 'entityId', label: 'Entity ID' },
                { key: 'clientId', label: 'Cliente ID' },
              ],
            )
          }
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4" />
          <span>CSV</span>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">{t('audit.th.when')}</TableHead>
              <TableHead className="w-40">{t('audit.th.type')}</TableHead>
              <TableHead>{t('audit.th.message')}</TableHead>
              <TableHead className="w-40">{t('audit.th.user')}</TableHead>
              <TableHead className="w-44">{t('audit.th.entity')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {audit.isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell>
                    <Skeleton className="h-3 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-full max-w-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                </TableRow>
              ))}
            {audit.isSuccess && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-3">
                      <ScrollText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">
                      {t('audit.empty')}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {formatTimestamp(event.ts)}
                </TableCell>
                <TableCell>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px]">
                    {event.type || '—'}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{event.message || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground" title={event.userId}>
                  {event.user || '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground" title={event.entityId}>
                  {event.entityName || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
