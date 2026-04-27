import { ChevronLeft, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { useReport, useRunReport } from '@/features/reports/hooks/use-reports'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'

export function ReportDetailPage() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const report = useReport(params.id)
  const run = useRunReport()

  function handleRun() {
    if (!params.id) return
    run.mutate(params.id)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        to="/reports"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('reports.detail.back')}
      </Link>

      {report.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('reports.detail.loadError')}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{report.data?.name ?? t('app.loading')}</CardTitle>
              {report.data?.description && (
                <CardDescription>{report.data.description}</CardDescription>
              )}
            </div>
            <Button onClick={handleRun} disabled={run.isPending || !params.id}>
              <Play className="h-4 w-4" />
              <span>
                {run.isPending
                  ? t('reports.detail.running')
                  : t('reports.detail.run')}
              </span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.data?.filters && (
            <div>
              <h3 className="mb-1 text-sm font-medium">{t('reports.detail.filtersTitle')}</h3>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(report.data.filters, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-sm font-medium">{t('reports.detail.lastResult')}</h3>
            {run.isError && (
              <Alert variant="destructive" className="mb-2">
                <AlertDescription>
                  {t('reports.detail.runError')}
                </AlertDescription>
              </Alert>
            )}
            {!run.data && !run.isPending && !run.isError && (
              <p className="text-sm text-muted-foreground">
                {t('reports.detail.runHint')}
              </p>
            )}
            {run.data && (
              <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(run.data, null, 2)}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
