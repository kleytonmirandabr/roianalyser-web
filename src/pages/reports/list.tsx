import { Calendar, FileText, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useDeleteReport, useReports } from '@/features/reports/hooks/use-reports'
import { toastDeleted, toastError } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { confirm } from '@/shared/ui/confirm-dialog'
import { IconTooltip } from '@/shared/ui/icon-tooltip'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

function formatDate(value?: string) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function ReportsListPage() {
  const { t } = useTranslation()
  const reports = useReports()
  const remove = useDeleteReport()

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: t('reports.deleteTitle'),
      description: t('reports.deleteDesc', { name }),
      confirmLabel: t('reports.delete'),
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(id)
      toastDeleted(t('reports.deleted'))
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('reports.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('reports.subtitle')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/reports/scheduled">
            <Calendar className="h-4 w-4" />
            <span>{t('reports.schedules')}</span>
          </Link>
        </Button>
      </div>

      {reports.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('reports.loadError')}
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('reports.th.name')}</TableHead>
              <TableHead>{t('reports.th.owner')}</TableHead>
              <TableHead className="w-44">{t('reports.th.updatedAt')}</TableHead>
              <TableHead className="w-20 text-right">{t('reports.th.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            {reports.isSuccess && reports.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-3">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">
                      {t('reports.empty')}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {reports.data?.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-medium">
                  <Link
                    to={`/reports/${report.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {report.name}
                  </Link>
                  {report.description && (
                    <p className="text-xs text-muted-foreground">
                      {report.description}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {report.ownerName ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(report.updatedAt ?? report.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <IconTooltip label={t('reports.delete')}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(report.id, report.name)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </IconTooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
