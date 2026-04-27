import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { useProject } from '@/features/projects/hooks/use-project'
import { useUpdateProject } from '@/features/projects/hooks/use-update-project'
import {
  buildCashFlow,
  readFinancialInputs,
} from '@/features/projects/lib/financials'
import {
  readForecast,
  serializeForecast,
  summarizeForecast,
  syncExpectedFromCashFlow,
  type ForecastLine,
  type PaidStatus,
} from '@/features/projects/lib/forecast'
import { formatCurrency } from '@/features/projects/lib/money'
import type { ProjectPayload } from '@/features/projects/types'
import { cn } from '@/shared/lib/cn'
import { toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

const PAID_STATUS_OPTIONS: PaidStatus[] = [
  'pending',
  'paid',
  'overdue',
  'disputed',
]

const PAID_STATUS_TONE: Record<PaidStatus, string> = {
  pending: 'text-amber-600',
  paid: 'text-emerald-600',
  overdue: 'text-destructive',
  disputed: 'text-purple-600',
}

export function ProjectForecastView() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)
  const update = useUpdateProject(params.id ?? '')

  const [lines, setLines] = useState<ForecastLine[]>([])
  const [dirty, setDirty] = useState(false)

  // Inicializa quando o projeto carrega: lê forecast persistido + sincroniza
  // expectedRevenue com o motor financeiro atual.
  useEffect(() => {
    if (!project.data) return
    const payload = (project.data.payload ?? {}) as Record<string, unknown>
    const inputs = readFinancialInputs(payload)
    const cashFlow = buildCashFlow(payload, inputs)
    const persisted = readForecast(payload, inputs.prazo)
    const synced = syncExpectedFromCashFlow(persisted, cashFlow)
    setLines(synced)
    setDirty(false)
  }, [project.data])

  const summary = useMemo(() => summarizeForecast(lines), [lines])
  const currency = project.data?.currency ?? 'BRL'

  function patchLine(month: number, patch: Partial<ForecastLine>) {
    setLines((prev) =>
      prev.map((l) =>
        l.month === month
          ? { ...l, ...patch, updatedAt: new Date().toISOString() }
          : l,
      ),
    )
    setDirty(true)
  }

  async function handleSave() {
    if (!project.data) return
    const base = (project.data.payload ?? {}) as Record<string, unknown>
    const payload: ProjectPayload = {
      ...base,
      forecast: serializeForecast(lines),
    }
    try {
      await update.mutateAsync({ payload })
      toastSaved(t('projects.detail.forecast.saved'))
      setDirty(false)
    } catch (err) {
      toastError(err)
    }
  }

  if (!params.id) return null

  return (
    <div className="space-y-4">
      {project.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.detail.loadError')}</AlertDescription>
        </Alert>
      )}

      {/* KPIs do forecast */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('projects.detail.forecast.kpi.expected')}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {formatCurrency(summary.totalExpected, currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('projects.detail.forecast.kpi.actual')}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {formatCurrency(summary.totalActual, currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('projects.detail.forecast.kpi.variance')}
            </div>
            <div
              className={cn(
                'mt-1 text-xl font-semibold tabular-nums',
                summary.variance >= 0 ? 'text-emerald-600' : 'text-destructive',
              )}
            >
              {formatCurrency(summary.variance, currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {summary.variancePct.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('projects.detail.forecast.kpi.overdue')}
            </div>
            <div
              className={cn(
                'mt-1 text-xl font-semibold tabular-nums',
                summary.monthsOverdue > 0 ? 'text-destructive' : 'text-foreground',
              )}
            >
              {formatCurrency(summary.totalOverdue, currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('projects.detail.forecast.kpi.overdueCount', {
                count: summary.monthsOverdue,
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{t('projects.detail.forecast.tableTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('projects.detail.forecast.tableDesc')}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t('projects.detail.forecast.th.month')}</TableHead>
                <TableHead className="text-right">{t('projects.detail.forecast.th.expected')}</TableHead>
                <TableHead className="text-right">{t('projects.detail.forecast.th.actual')}</TableHead>
                <TableHead className="text-right">{t('projects.detail.forecast.th.variance')}</TableHead>
                <TableHead className="w-32">{t('projects.detail.forecast.th.paidStatus')}</TableHead>
                <TableHead>{t('projects.detail.forecast.th.note')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const variance =
                  line.actualRevenue != null
                    ? line.actualRevenue - line.expectedRevenue
                    : null
                const variancePct =
                  variance != null && line.expectedRevenue > 0
                    ? (variance / line.expectedRevenue) * 100
                    : null
                return (
                  <TableRow key={line.month}>
                    <TableCell className="font-medium tabular-nums">
                      {line.month}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(line.expectedRevenue, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.actualRevenue ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          patchLine(line.month, {
                            actualRevenue: v === '' ? null : Number(v),
                          })
                        }}
                        className="h-8 text-right tabular-nums"
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums text-xs',
                        variance == null
                          ? 'text-muted-foreground'
                          : variance >= 0
                            ? 'text-emerald-600'
                            : 'text-destructive',
                      )}
                    >
                      {variance == null
                        ? '—'
                        : `${variancePct?.toFixed(1)}%`}
                    </TableCell>
                    <TableCell>
                      <select
                        value={line.paidStatus}
                        onChange={(e) =>
                          patchLine(line.month, {
                            paidStatus: e.target.value as PaidStatus,
                          })
                        }
                        className={cn(
                          'h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium',
                          PAID_STATUS_TONE[line.paidStatus],
                        )}
                      >
                        {PAID_STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {t(`projects.detail.forecast.paid.${s}`)}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.note ?? ''}
                        onChange={(e) =>
                          patchLine(line.month, { note: e.target.value })
                        }
                        className="h-8"
                        placeholder=""
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {dirty && (
          <span className="text-xs text-muted-foreground">
            {t('projects.detail.forecast.unsaved')}
          </span>
        )}
        <Button onClick={handleSave} disabled={!dirty || update.isPending}>
          {update.isPending
            ? t('projects.detail.forecast.saving')
            : t('projects.detail.forecast.save')}
        </Button>
      </div>
    </div>
  )
}
