import { ChevronLeft, Send, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useReports } from '@/features/reports/hooks/use-reports'
import {
  useDeleteScheduledReport,
  useScheduledReports,
  useSendScheduledReportNow,
  useUpdateScheduledReport,
} from '@/features/reports/hooks/use-scheduled-reports'
import type { ScheduledReport } from '@/features/reports/scheduled-types'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { confirm } from '@/shared/ui/confirm-dialog'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function useFormatSchedule() {
  const { t } = useTranslation()
  return function formatSchedule(item: ScheduledReport): string {
    const hour = String(item.hour).padStart(2, '0')
    if (item.frequency === 'daily')
      return t('reports.scheduled.freq.daily', { hour })
    if (item.frequency === 'weekly') {
      const dayKey = DAY_KEYS[item.dayOfWeek] ?? 'sun'
      return t('reports.scheduled.freq.weekly', {
        day: t(`reports.scheduled.days.${dayKey}`),
        hour,
      })
    }
    if (item.frequency === 'monthly')
      return t('reports.scheduled.freq.monthly', {
        day: item.dayOfMonth,
        hour,
      })
    return item.frequency
  }
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function ScheduledReportsPage() {
  const { t } = useTranslation()
  const formatSchedule = useFormatSchedule()
  const list = useScheduledReports()
  const reports = useReports()
  const update = useUpdateScheduledReport()
  const remove = useDeleteScheduledReport()
  const sendNow = useSendScheduledReportNow()

  const reportNameById = new Map(
    (reports.data ?? []).map((r) => [r.id, r.name]),
  )

  async function toggleEnabled(item: ScheduledReport) {
    await update.mutateAsync({
      id: item.id,
      input: { enabled: !item.enabled },
    })
  }

  async function handleDelete(item: ScheduledReport) {
    const ok = await confirm({
      title: t('reports.scheduled.deleteTitle'),
      description: t('reports.scheduled.deleteDesc', { name: item.name }),
      confirmLabel: t('reports.scheduled.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(item.id)
      toastDeleted(t('reports.scheduled.deleted'))
    } catch (err) {
      toastError(err)
    }
  }

  async function handleSendNow(item: ScheduledReport) {
    const ok = await confirm({
      title: t('reports.scheduled.sendTitle'),
      description: t('reports.scheduled.sendDesc', {
        name: item.name,
        to: item.recipients,
      }),
      confirmLabel: t('reports.scheduled.sendConfirm'),
    })
    if (!ok) return
    try {
      await sendNow.mutateAsync(item.id)
      toastSaved(t('reports.scheduled.sendDispatched'))
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <Link
        to="/reports"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('reports.scheduled.back')}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('reports.scheduled.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('reports.scheduled.subtitle')}
        </p>
      </div>

      {list.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('reports.scheduled.loadError')}
          </AlertDescription>
        </Alert>
      )}
      {sendNow.isSuccess && (
        <Alert>
          <AlertDescription>{t('reports.scheduled.sendOk')}</AlertDescription>
        </Alert>
      )}
      {sendNow.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('reports.scheduled.sendErr')}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">{t('reports.scheduled.th.active')}</TableHead>
              <TableHead>{t('reports.scheduled.th.name')}</TableHead>
              <TableHead>{t('reports.scheduled.th.report')}</TableHead>
              <TableHead>{t('reports.scheduled.th.frequency')}</TableHead>
              <TableHead>{t('reports.scheduled.th.recipients')}</TableHead>
              <TableHead className="w-44">{t('reports.scheduled.th.lastSent')}</TableHead>
              <TableHead className="w-24 text-right">{t('reports.scheduled.th.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t('app.loading')}
                </TableCell>
              </TableRow>
            )}
            {list.isSuccess && list.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t('reports.scheduled.empty')}
                </TableCell>
              </TableRow>
            )}
            {list.data?.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox
                    checked={item.enabled}
                    onCheckedChange={() => toggleEnabled(item)}
                    disabled={update.isPending}
                  />
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {reportNameById.get(item.reportId) ?? item.reportId}
                </TableCell>
                <TableCell>{formatSchedule(item)}</TableCell>
                <TableCell className="max-w-[16rem] truncate text-muted-foreground" title={item.recipients}>
                  {item.recipients}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(item.lastSentAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <IconTooltip
                      label={
                        item.enabled
                          ? t('reports.scheduled.send')
                          : t('reports.scheduled.sendDisabled')
                      }
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSendNow(item)}
                        disabled={sendNow.isPending || !item.enabled}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                    <IconTooltip label={t('reports.scheduled.delete')}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item)}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </IconTooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
