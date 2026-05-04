import { useState } from 'react'
import { Plus, LayoutDashboard } from 'lucide-react'
import {
  useAnalyticsDatasets,
  useAnalyticsReports,
  useCreateReport,
  useUpdateReport,
  useDeleteReport,
} from '../../features/projects2/hooks/use-project-analytics'
import { DashboardCard } from '../../features/projects2/components/DashboardCard'
import { ConfigDrawer } from '../../features/projects2/components/ConfigDrawer'
import type { AnalyticsReport, ReportConfig } from '../../features/projects2/analytics-types'

interface Props {
  projectId: string | number
}

export function DashboardPage({ projectId }: Props) {
  const { data: datasets = [], isLoading: loadingDs } = useAnalyticsDatasets(projectId)
  const { data: reports = [], isLoading: loadingReports } = useAnalyticsReports(projectId)
  const createReport = useCreateReport(projectId)
  const updateReport = useUpdateReport(projectId)
  const deleteReport = useDeleteReport(projectId)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AnalyticsReport | null>(null)

  function openCreate() {
    setEditTarget(null)
    setDrawerOpen(true)
  }

  function openEdit(report: AnalyticsReport) {
    setEditTarget(report)
    setDrawerOpen(true)
  }

  function handleSave(name: string, dataset: string, config: ReportConfig) {
    if (editTarget) {
      updateReport.mutate({ id: editTarget.id, name, dataset, config })
    } else {
      createReport.mutate({ name, dataset, config })
    }
    setDrawerOpen(false)
    setEditTarget(null)
  }

  function handleDelete(id: number) {
    deleteReport.mutate(id)
  }

  const loading = loadingDs || loadingReports

  return (
    <div className="flex-1 overflow-auto">
      {/* toolbar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 sm:px-6 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <LayoutDashboard size={15} className="text-muted-foreground" />
          Dashboard
        </div>
        <button
          onClick={openCreate}
          disabled={loading || datasets.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Plus size={13} />
          Novo card
        </button>
      </div>

      {/* content */}
      <div className="p-4 sm:p-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <LayoutDashboard size={28} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">Nenhum card ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Clique em "Novo card" para criar sua primeira visualização.</p>
            </div>
            <button
              onClick={openCreate}
              disabled={datasets.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={14} />
              Criar primeiro card
            </button>
          </div>
        )}

        {!loading && reports.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {reports.map(report => (
              <DashboardCard
                key={report.id}
                report={report}
                projectId={projectId}
                datasets={datasets}
                onEdit={() => openEdit(report)}
                onDelete={() => handleDelete(report.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* config drawer */}
      {drawerOpen && datasets.length > 0 && (
        <ConfigDrawer
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setEditTarget(null) }}
          datasets={datasets}
          initial={editTarget ? {
            name: editTarget.name,
            dataset: editTarget.dataset,
            ...editTarget.config,
          } : undefined}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
