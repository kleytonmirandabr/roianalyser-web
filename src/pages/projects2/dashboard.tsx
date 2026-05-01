/**
 * Dashboard cross-project (Phase 3 Sprint 2 / P.10).
 *
 * Visao agregada de todos os projetos visiveis ao usuario:
 * KPIs, tasks atrasadas, tarefas desta semana, tabela de projetos.
 */
import {
  AlertTriangle, Briefcase, Calendar, CheckCircle2, Clock, ExternalLink, TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useProjectDashboard } from '@/features/projects2/hooks/use-project-dashboard'
import {
  PROJECT_STATUS_LABELS, type ProjectStatus,
} from '@/features/projects2/types'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'
import { formatCurrency } from '@/shared/lib/format'

function fmtShortDate(iso: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch { return iso }
}

const PROJECT_STATUS_TONE: Record<ProjectStatus, string> = {
  planning: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  execution: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
}

interface KpiProps { label: string; value: string; hint?: string; tone?: 'pos' | 'neg' | 'warn' | 'neutral'; icon?: any }
function Kpi({ label, value, hint, tone = 'neutral', icon: Icon }: KpiProps) {
  const toneCls = tone === 'pos' ? 'text-emerald-700 dark:text-emerald-400'
    : tone === 'neg' ? 'text-rose-700 dark:text-rose-400'
    : tone === 'warn' ? 'text-amber-700 dark:text-amber-400'
    : 'text-foreground'
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  )
}

export function ProjectsDashboardPage() {
  const { data, isLoading, error } = useProjectDashboard()

  if (isLoading) return <div className="p-6 max-w-7xl mx-auto"><Skeleton className="h-64" /></div>
  if (error) return (
    <div className="p-6 max-w-7xl mx-auto">
      <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>
    </div>
  )
  if (!data) return null

  const { projects, kpis, overdueTasks, upcomingTasks } = data
  const completedRatio = kpis.total > 0 ? Math.round((kpis.completedCount / kpis.total) * 100) : 0
  const consumedRatio = kpis.budgetTotal > 0
    ? Math.round((kpis.executedTotal / kpis.budgetTotal) * 100)
    : 0

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard de Projetos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visao geral de todos os projetos visiveis a voce. Atualizado em tempo real.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Projetos" value={String(kpis.total)} icon={Briefcase}
          hint={`${kpis.byStatus.execution || 0} em execucao`} />
        <Kpi label="Concluidos" value={String(kpis.completedCount)} tone="pos" icon={CheckCircle2}
          hint={`${completedRatio}% do total`} />
        <Kpi label="Atrasados" value={String(kpis.overdueCount)} tone={kpis.overdueCount > 0 ? 'neg' : 'pos'}
          icon={AlertTriangle} hint="Prazo passou" />
        <Kpi label="Tarefas atrasadas" value={String(kpis.overdueTasksCount)}
          tone={kpis.overdueTasksCount > 0 ? 'warn' : 'pos'} icon={Clock}
          hint={`${kpis.upcomingTasksCount} nesta semana`} />
        <Kpi label="Custo executado" value={formatCurrency(kpis.executedTotal, 'BRL')}
          tone="neutral" icon={TrendingUp}
          hint={`${consumedRatio}% de ${formatCurrency(kpis.budgetTotal, 'BRL')}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tarefas atrasadas */}
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" /> Tarefas atrasadas
              <span className="text-xs text-muted-foreground font-normal">({overdueTasks.length})</span>
            </h2>
          </div>
          {overdueTasks.length === 0 ? (
            <div className="px-5 py-8 text-sm text-muted-foreground italic text-center">
              Nenhuma tarefa atrasada. 🎉
            </div>
          ) : (
            <ul className="divide-y max-h-80 overflow-auto">
              {overdueTasks.slice(0, 12).map((t) => (
                <li key={t.taskId}>
                  <Link to={`/projects/${t.projectId}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.projectCode} · {t.projectName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
                        {t.daysLate}d atrasada
                      </div>
                      <div className="text-[10px] text-muted-foreground">{fmtShortDate(t.plannedDate)}</div>
                    </div>
                  </Link>
                </li>
              ))}
              {overdueTasks.length > 12 && (
                <li className="px-5 py-2 text-xs text-muted-foreground italic text-center">
                  +{overdueTasks.length - 12} mais
                </li>
              )}
            </ul>
          )}
        </Card>

        {/* Tarefas desta semana */}
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" /> Proximos 7 dias
              <span className="text-xs text-muted-foreground font-normal">({upcomingTasks.length})</span>
            </h2>
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="px-5 py-8 text-sm text-muted-foreground italic text-center">
              Nada planejado para esta semana.
            </div>
          ) : (
            <ul className="divide-y max-h-80 overflow-auto">
              {upcomingTasks.slice(0, 12).map((t) => (
                <li key={t.taskId}>
                  <Link to={`/projects/${t.projectId}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.projectCode} · {t.projectName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold tabular-nums">
                        {t.dueIn === 0 ? 'hoje' : t.dueIn === 1 ? 'amanha' : `em ${t.dueIn}d`}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{fmtShortDate(t.plannedDate)}</div>
                    </div>
                  </Link>
                </li>
              ))}
              {upcomingTasks.length > 12 && (
                <li className="px-5 py-2 text-xs text-muted-foreground italic text-center">
                  +{upcomingTasks.length - 12} mais
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>

      {/* Tabela de projetos */}
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold">Todos os projetos ({projects.length})</h2>
          <Link to="/projects" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            Lista completa <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        {projects.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground italic text-center">
            Nenhum projeto visivel pra voce ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2 font-semibold">Projeto</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-left px-3 py-2 font-semibold">Prazo</th>
                  <th className="text-left px-3 py-2 font-semibold w-48">Progresso</th>
                  <th className="text-right px-5 py-2 font-semibold">Orcamento</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-5 py-2.5">
                      <Link to={`/projects/${p.id}`} className="hover:underline">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{p.projectCode}</div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 ${PROJECT_STATUS_TONE[p.status]}`}>
                        {PROJECT_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {fmtShortDate(p.plannedEnd)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-32 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.status === 'done' ? 'bg-emerald-500' : 'bg-primary'}`}
                            style={{ width: `${p.progressPct || 0}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-9 text-right">{p.progressPct || 0}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs tabular-nums">
                      {p.budget != null ? formatCurrency(p.budget, p.currency || 'BRL') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

export { ProjectsDashboardPage as Projects2DashboardPage }
