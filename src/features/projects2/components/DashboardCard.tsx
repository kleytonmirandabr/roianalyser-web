import { useState } from 'react'
import { Settings2, Trash2, RefreshCw } from 'lucide-react'
import type { AnalyticsReport, AnalyticsDataset } from '../analytics-types'
import { useAnalyticsQuery } from '../hooks/use-project-analytics'
import { ChartViz } from './ChartViz'
import { KpiViz } from './KpiViz'
import { TableViz } from './TableViz'

interface Props {
  report: AnalyticsReport
  projectId: string | number
  datasets: AnalyticsDataset[]
  onEdit: () => void
  onDelete: () => void
}

export function DashboardCard({ report, projectId, onEdit, onDelete }: Props) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const { config } = report
  const { data, isLoading, isError, refetch } = useAnalyticsQuery(
    projectId,
    config.query,
    true
  )

  return (
    <div className="bg-card border rounded-lg flex flex-col overflow-hidden">
      {/* card header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <span className="text-sm font-medium truncate">{report.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => refetch()}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={onEdit}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Configurar"
          >
            <Settings2 size={12} />
          </button>
          {showConfirmDelete ? (
            <div className="flex items-center gap-1 ml-1">
              <button onClick={onDelete} className="text-xs text-destructive hover:underline">confirmar</button>
              <button onClick={() => setShowConfirmDelete(false)} className="text-xs text-muted-foreground hover:underline">cancelar</button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-destructive transition-colors"
              title="Excluir"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* card body */}
      <div className="flex-1 p-3 min-h-[160px]">
        {isLoading && (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
        {isError && (
          <p className="text-xs text-destructive text-center py-6">Erro ao carregar dados</p>
        )}
        {data && config.chartType === 'table' && <TableViz result={data} />}
        {data && config.chartType === 'kpi' && (
          <KpiViz result={data} kpiLabel={config.kpiLabel} color={config.color} />
        )}
        {data && ['bar', 'line', 'pie'].includes(config.chartType) && (
          <ChartViz result={data} chartType={config.chartType} color={config.color} />
        )}
      </div>
    </div>
  )
}
