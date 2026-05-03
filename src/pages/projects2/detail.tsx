/**
 * Detalhe de Projeto NOVO — DOSSIÊ (Sprint A.1).
 *
 * Layout consistente com o detail de Contrato:
 *   1) Hero: código + nome + datas + timeline de status + KPIs
 *   2) Origem: Contrato vinculado + Cliente + Manager
 *   3) Documentos: ProjectAttachmentsCard
 *   4) Forecasts (preserva o que existia)
 *   5) Editar dados — accordion no fim
 */

import {
  AlertTriangle, ArrowLeft, BarChart3, Calendar, CalendarDays, ChevronDown, ChevronUp, Clock,
  ExternalLink, FileText, GanttChart, Heart, LayoutDashboard, LayoutGrid, ListTodo, Paperclip,
  Plus, Trash2, Users2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useCreateForecast } from '@/features/forecasts/hooks/use-create-forecast'
import { useForecastsByProject } from '@/features/forecasts/hooks/use-forecasts'
import { FORECAST_STATUS_LABELS } from '@/features/forecasts/types'
import { useDeleteProject2 } from '@/features/projects2/hooks/use-delete-project'
import { useProject2 } from '@/features/projects2/hooks/use-project'
import { useUpdateProject2 } from '@/features/projects2/hooks/use-update-project'
import {
  PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus,
} from '@/features/projects2/types'
import { useContract } from '@/features/contracts2/hooks/use-contract'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useAppState } from '@/features/admin/hooks/use-app-state'
import { ProjectAttachmentsCard } from '@/features/projects2/components/ProjectAttachmentsCard'
import { ProjectTasksCard } from '@/features/projects2/components/ProjectTasksCard'
import { MembersCard } from '@/features/projects2/components/MembersCard'
import { GanttView } from '@/features/projects2/components/GanttView'
import { useProjectMilestones } from '@/features/projects2/hooks/use-project-milestones'
import { useProjectRole } from '@/features/projects2/hooks/use-project-role'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Combobox } from '@/shared/ui/combobox'
import { confirm } from '@/shared/ui/confirm-dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import { CustomFieldsCard } from '@/features/form-fields/components/custom-fields-card'
import { formatCurrency } from '@/shared/lib/format'

// Status terminais cancelled fica off-path; paused também; planning→execution→done é o caminho feliz
const TIMELINE_STATUSES: ProjectStatus[] = ['planning', 'execution', 'done']

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const d1 = new Date(a).getTime()
  const d2 = new Date(b).getTime()
  if (Number.isNaN(d1) || Number.isNaN(d2)) return null
  return Math.round((d2 - d1) / (24 * 3600 * 1000))
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function StatusTimeline({ current }: { current: ProjectStatus }) {
  const isOffPath = current === 'paused' || current === 'cancelled'
  const idx = TIMELINE_STATUSES.indexOf(current)
  return (
    <div className="space-y-2">
      {isOffPath && (
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
          current === 'cancelled' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
        }`}>
          {PROJECT_STATUS_LABELS[current]}
        </div>
      )}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TIMELINE_STATUSES.map((s, i) => {
          const isPast = !isOffPath && i < idx
          const isCurrent = !isOffPath && i === idx
          const tone = isPast ? 'bg-emerald-500 text-white'
            : isCurrent ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
            : 'bg-muted text-muted-foreground'
          return (
            <div key={s} className="flex items-center gap-1.5 flex-shrink-0">
              <div className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${tone}`}>
                <span className="text-[10px] font-mono opacity-70">{i + 1}</span>
                <span>{PROJECT_STATUS_LABELS[s]}</span>
              </div>
              {i < TIMELINE_STATUSES.length - 1 && (
                <div className={`h-0.5 w-4 ${isPast ? 'bg-emerald-500' : 'bg-muted'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KpiTile({ label, value, hint, tone = 'neutral' }: {
  label: string; value: string; hint?: string; tone?: 'neutral' | 'pos' | 'neg' | 'warn'
}) {
  const toneCls = tone === 'pos' ? 'text-emerald-700 dark:text-emerald-400'
    : tone === 'neg' ? 'text-rose-700 dark:text-rose-400'
    : tone === 'warn' ? 'text-amber-700 dark:text-amber-400'
    : 'text-foreground'
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  )
}

/** Tab Gantt — componente próprio para poder usar hooks no topo. */
function GanttTab({ projectId }: { projectId: string }) {
  const milestones = useProjectMilestones(projectId)
  const ganttTasks = milestones.data || []
  return (
    <div className="rounded-lg border bg-card overflow-hidden mx-3 sm:mx-6 mt-4 mb-6">
      <div className="p-4 border-b flex items-center gap-2">
        <GanttChart className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Gantt — Linha do Tempo</h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {ganttTasks.filter(t => t.plannedDate).length} tarefas com data
        </span>
      </div>
      {milestones.isLoading ? (
        <div className="px-6 py-10 text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <GanttView tasks={ganttTasks} />
      )}
    </div>
  )
}

export function Project2DetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') || 'overview'
  // 'board' é alias legado → 'list'
  const tab = (rawTab === 'board' ? 'list' : rawTab) as
    'overview' | 'list' | 'kanban' | 'calendar' | 'gantt' | 'members' | 'docs' | 'forecasts'
  function setTab(next: string) {
    const sp = new URLSearchParams(searchParams)
    if (next === 'overview') sp.delete('tab')
    else sp.set('tab', next)
    setSearchParams(sp, { replace: true })
  }
  const { data: prj, isLoading, error } = useProject2(id)
  const { data: forecasts = [] } = useForecastsByProject(id)
  const update = useUpdateProject2(id)
  const remove = useDeleteProject2()
  const createForecast = useCreateForecast()
  const { canEdit, canManage } = useProjectRole(prj)

  const { data: contract } = useContract(prj?.contractId || undefined)
  const { data: companies = [] } = useCompanies()
  const appState = useAppState()
  const company = prj?.clientId
    ? (companies as any[]).find((c) => String(c.id) === String(prj.clientId))
    : null
  const manager = prj?.managerId
    ? (appState.data?.users || []).find((u: any) => String(u.id) === String(prj.managerId))
    : null

  const [name, setName] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')
  const [actualStart, setActualStart] = useState('')
  const [actualEnd, setActualEnd] = useState('')
  const [progressPct, setProgressPct] = useState('0')
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [description, setDescription] = useState('')
  const [dirty, setDirty] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    if (!prj) return
    setName(prj.name)
    setStatus(prj.status)
    setPlannedStart(prj.plannedStart || '')
    setPlannedEnd(prj.plannedEnd || '')
    setActualStart(prj.actualStart || '')
    setActualEnd(prj.actualEnd || '')
    setProgressPct(String(prj.progressPct ?? 0))
    setBudget(String(prj.budget ?? ''))
    setCurrency(prj.currency || 'BRL')
    setDescription(prj.description || '')
    setDirty(false)
  }, [prj])

  const kpis = useMemo(() => {
    if (!prj) return null
    const today = new Date().toISOString().slice(0, 10)
    const totalDays = daysBetween(prj.plannedStart, prj.plannedEnd)
    const elapsed = daysBetween(prj.plannedStart, today)
    const remaining = daysBetween(today, prj.plannedEnd)
    const elapsedPct = totalDays && totalDays > 0
      ? Math.max(0, Math.min(100, ((elapsed || 0) / totalDays) * 100))
      : null
    // Lag: % esperado - % executado. Positivo = atrasado.
    const lag = elapsedPct != null ? Math.round(elapsedPct - (prj.progressPct || 0)) : null
    return { remainingDays: remaining, elapsedPct, totalDays, lag }
  }, [prj])

  const { data: milestones = [] } = useProjectMilestones(id)
  const milestoneStats = useMemo(() => {
    const total = milestones.length
    const completed = milestones.filter((m) => m.status === 'done').length
    const todayIso = new Date().toISOString().slice(0, 10)
    const overdue = milestones.filter((m) => m.status !== 'done' && m.status !== 'cancelled' && m.plannedDate && m.plannedDate < todayIso).length
    return { total, completed, overdue }
  }, [milestones])

  // ─── ALERTAS ─────────────────────────────────────────────
  const alerts = useMemo(() => {
    if (!prj) return [] as Array<{ tone: 'amber' | 'rose' | 'blue'; icon: any; text: string }>
    const list: Array<{ tone: 'amber' | 'rose' | 'blue'; icon: any; text: string }> = []
    const isActive = prj.status === 'execution'
    if (isActive && kpis?.remainingDays != null && kpis.remainingDays >= 0 && kpis.remainingDays <= 14) {
      list.push({ tone: 'amber', icon: Clock, text: `Encerra em ${kpis.remainingDays} dias` })
    }
    if (isActive && kpis?.remainingDays != null && kpis.remainingDays < 0) {
      list.push({ tone: 'rose', icon: AlertTriangle, text: `Prazo passou há ${Math.abs(kpis.remainingDays)} dias — atualize o status ou estenda o prazo` })
    }
    if (isActive && kpis?.lag != null && kpis.lag > 15) {
      list.push({ tone: 'amber', icon: AlertTriangle, text: `Execução ${kpis.lag}p atrás do esperado` })
    }
    if (milestoneStats.overdue > 0) {
      list.push({ tone: 'amber', icon: Calendar, text: `${milestoneStats.overdue} marco${milestoneStats.overdue > 1 ? 's' : ''} atrasado${milestoneStats.overdue > 1 ? 's' : ''}` })
    }
    return list
  }, [prj, kpis, milestoneStats])

  // ─── HEALTH SCORE ────────────────────────────────────────
  const health = useMemo(() => {
    if (!prj) return { tone: 'gray' as const, label: '—', score: 0 }
    let score = 100
    if (kpis?.remainingDays != null) {
      if (kpis.remainingDays < 0 && prj.status !== 'done') score -= 40
      else if (kpis.remainingDays <= 14 && prj.status === 'execution') score -= 15
    }
    if (kpis?.lag != null) {
      if (kpis.lag > 25) score -= 30
      else if (kpis.lag > 15) score -= 15
      else if (kpis.lag > 5) score -= 5
    }
    if (milestoneStats.total > 0) {
      const lateRatio = milestoneStats.overdue / milestoneStats.total
      if (lateRatio > 0.3) score -= 20
      else if (lateRatio > 0.1) score -= 10
    }
    if (prj.status === 'paused') score = Math.min(score, 50)
    if (prj.status === 'cancelled') score = 0
    score = Math.max(0, Math.min(100, score))
    const tone: 'pos' | 'amber' | 'rose' = score >= 70 ? 'pos' : score >= 40 ? 'amber' : 'rose'
    const label = score >= 70 ? 'Saudável' : score >= 40 ? 'Atenção' : 'Crítico'
    return { tone, label, score }
  }, [prj, kpis, milestoneStats])

  // ─── PLANEJADO × REALIZADO ───────────────────────────────
  // Custo executado = budget * progressPct (proxy — não temos custo real ainda).
  const planVsReal = useMemo(() => {
    if (!prj) return null
    const budget = prj.budget || 0
    const executed = budget * ((prj.progressPct || 0) / 100)
    return { budget, executed }
  }, [prj])

  if (isLoading || !id) return <Skeleton className="h-64" />
  if (error) return <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>
  if (!prj) return <Alert variant="destructive"><AlertDescription>Projeto não encontrado.</AlertDescription></Alert>

  const statusOptions = PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))

  async function handleSave() {
    if (!prj) return
    try {
      await update.mutateAsync({
        name,
        status,
        plannedStart: plannedStart || null,
        plannedEnd: plannedEnd || null,
        actualStart: actualStart || null,
        actualEnd: actualEnd || null,
        progressPct: Number(progressPct) || 0,
        budget: budget ? Number(budget) : null,
        currency,
        description: description || null,
      })
      toastSaved(t('common.actions.savedSuccessfully'))
      setDirty(false)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Excluir projeto',
      description: 'Esta ação é irreversível. Confirma?',
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok || !prj) return
    try {
      await remove.mutateAsync(prj.id)
      toastDeleted('Projeto excluído')
      navigate('/projects')
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  async function handleCreateForecast() {
    if (!prj) return
    try {
      const created = await createForecast.mutateAsync({
        projectId: prj.id,
        name: `Revisão ${(forecasts.length || 0) + 1}`,
      })
      toastSaved('Revisão criada')
      navigate(`/forecasts/${created.id}`)
    } catch (err) { toastError(`Erro: ${(err as Error).message}`) }
  }

  const isWideTab = tab === 'list' || tab === 'kanban' || tab === 'calendar' || tab === 'gantt'

  return (
    <div className={`mx-auto space-y-0 ${isWideTab ? 'max-w-[1600px]' : 'max-w-7xl p-3 sm:p-6 space-y-4'}`}>
      <header className={`flex items-center justify-between gap-3 ${isWideTab ? 'px-3 sm:px-6 pt-3 sm:pt-4 pb-1' : ''}`}>
        <Button asChild variant="ghost" size="sm">
          <Link to="/projects">
            <ArrowLeft className="h-4 w-4" />Projetos
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={remove.isPending}>
          <Trash2 className="h-4 w-4 text-rose-600" /> Excluir
        </Button>
      </header>

      {/* TABS */}
      <nav className={`flex items-center gap-0.5 border-b overflow-x-auto sticky top-0 bg-background/95 backdrop-blur z-10 py-0 ${isWideTab ? 'px-3 sm:px-6' : '-mx-2 px-2'}`}>
        {[
          { key: 'overview',  label: 'Visão Geral',  icon: LayoutDashboard },
          { key: 'list',      label: 'Lista',        icon: ListTodo },
          { key: 'kanban',    label: 'Kanban',       icon: LayoutGrid },
          { key: 'calendar',  label: 'Calendário',   icon: CalendarDays },
          { key: 'gantt',     label: 'Gantt',        icon: GanttChart },
          { key: 'members',   label: 'Membros',      icon: Users2 },
          { key: 'docs',      label: 'Documentos',   icon: Paperclip },
          { key: 'forecasts', label: 'Forecasts',    icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>

      {tab === 'overview' && <>
      {/* HERO */}
      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-mono">{prj.projectCode}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide rounded-full px-2 py-0.5 ${
                health.tone === 'pos' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : health.tone === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
              }`}>
                <Heart className="h-3 w-3" /> {health.label} - {health.score}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{prj.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {fmtShortDate(prj.plannedStart)} {prj.plannedEnd ? `→ ${fmtShortDate(prj.plannedEnd)}` : ''}
              {prj.actualStart && <span> · Iniciado {fmtShortDate(prj.actualStart)}</span>}
              {prj.actualEnd && <span> · Concluído {fmtShortDate(prj.actualEnd)}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">Mudar status:</Label>
            <div className="w-full sm:w-48">
              <Combobox
                value={status}
                onChange={(v) => {
                  const ns = v as ProjectStatus
                  setStatus(ns)
                  if (prj && ns !== prj.status) {
                    update.mutateAsync({ status: ns })
                      .then(() => toastSaved('Status atualizado'))
                      .catch((err) => toastError(`Erro: ${(err as Error).message}`))
                  }
                }}
                options={statusOptions}
              />
            </div>
          </div>
        </div>

        <StatusTimeline current={prj.status} />

        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 pt-2 border-t">
          <KpiTile
            label="Orçamento"
            value={prj.budget != null ? formatCurrency(prj.budget, prj.currency) : '—'}
          />
          <KpiTile
            label="% executado"
            value={`${(prj.progressPct || 0).toFixed(0)}%`}
            hint={kpis?.lag != null ? (kpis.lag > 5 ? `${kpis.lag}p atrás do esperado` : kpis.lag < -5 ? `${Math.abs(kpis.lag)}p adiantado` : 'Em dia') : undefined}
            tone={kpis?.lag == null ? 'neutral' : kpis.lag > 15 ? 'neg' : kpis.lag > 5 ? 'warn' : 'pos'}
          />
          <KpiTile
            label={kpis?.remainingDays != null && kpis.remainingDays >= 0 ? 'Encerra em' : kpis?.remainingDays != null ? 'Encerrado há' : 'Prazo'}
            value={kpis?.remainingDays == null ? '—' : kpis.remainingDays >= 0 ? `${kpis.remainingDays} dias` : `${Math.abs(kpis.remainingDays)} dias`}
            hint={kpis?.totalDays ? `de ${kpis.totalDays} dias totais` : undefined}
            tone={kpis?.remainingDays == null ? 'neutral' : kpis.remainingDays < 0 ? 'neg' : kpis.remainingDays <= 14 ? 'warn' : 'pos'}
          />
          <KpiTile
            label="% prazo decorrido"
            value={kpis?.elapsedPct != null ? `${kpis.elapsedPct.toFixed(0)}%` : '—'}
            tone="neutral"
          />
        </div>
      </Card>

      {/* ORIGEM */}
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold">Origem</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Contrato</div>
            {prj.contractId && contract ? (
              <Link to={`/contracts/${contract.id}`} className="mt-1 inline-flex items-center gap-1 text-sm font-medium hover:underline">
                <FileText className="h-3 w-3" /> {contract.contractNumber} · {contract.name} <ExternalLink className="h-3 w-3" />
              </Link>
            ) : prj.contractId ? (
              <div className="mt-1 text-sm text-muted-foreground italic">Carregando...</div>
            ) : (
              <div className="mt-1 text-sm text-amber-700 dark:text-amber-400 italic">Sem contrato vinculado</div>
            )}
          </div>
          <div className="rounded-md border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Cliente</div>
            {company ? (
              <div className="mt-1 space-y-0.5">
                <div className="text-sm font-medium">{company.name}</div>
                {(company as any).cnpj && (
                  <div className="text-xs text-muted-foreground font-mono">{(company as any).cnpj}</div>
                )}
              </div>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground italic">—</div>
            )}
          </div>
          <div className="rounded-md border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Gerente</div>
            <div className="mt-1 text-sm font-medium">
              {(manager as any)?.name || (manager as any)?.email || '—'}
            </div>
          </div>
        </div>
      </Card>

      {/* ALERTAS */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const Icon = a.icon
            const cls = a.tone === 'rose'
              ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300'
              : a.tone === 'blue'
              ? 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300'
              : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
            return (
              <div key={i} className={`rounded-md border px-3 py-2 text-sm flex items-center gap-2 ${cls}`}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{a.text}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* PLANEJADO × REALIZADO */}
      {planVsReal && planVsReal.budget > 0 && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Planejado × Realizado</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparação entre orçamento e custo executado (proxy = orçamento × % executado).
            </p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Orçamento planejado', value: planVsReal.budget, tone: 'bg-blue-500' },
              { label: 'Executado (estimado)', value: planVsReal.executed, tone: 'bg-emerald-500' },
            ].map((row) => {
              const max = Math.max(planVsReal.budget, planVsReal.executed, 1)
              const pct = (row.value / max) * 100
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(row.value, prj.currency)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${row.tone} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Saldo do orçamento</div>
              <div className={`text-sm font-semibold tabular-nums ${
                (planVsReal.budget - planVsReal.executed) >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {formatCurrency(planVsReal.budget - planVsReal.executed, prj.currency)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">% consumido</div>
              <div className="text-sm font-semibold tabular-nums">
                {((planVsReal.executed / planVsReal.budget) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* CUSTOM FIELDS (parte do overview) */}
      <CustomFieldsCard scope="project" entityType="project" entityId={id} />
      </>}

      {(tab === 'list' || tab === 'kanban' || tab === 'calendar') && (
        <ProjectTasksCard projectId={id} canEdit={canEdit} view={tab} />
      )}

      {tab === 'gantt' && id && (
        <GanttTab projectId={id} />
      )}

      {tab === 'members' && (
        <MembersCard projectId={id} generalAccess={prj.generalAccess} canManage={canManage} />
      )}

      {tab === 'docs' && (
        <ProjectAttachmentsCard projectId={id} />
      )}

      {tab === 'forecasts' && (
      <>
      {/* FORECASTS */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Forecasts ({forecasts.length})</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Revisões de previsão associadas a este projeto.</p>
          </div>
          <Button size="sm" onClick={handleCreateForecast} disabled={createForecast.isPending}>
            <Plus className="h-4 w-4" />Nova revisão
          </Button>
        </div>
        {forecasts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhuma revisão criada.</p>
        ) : (
          <ul className="space-y-2">
            {forecasts.map((f: any) => (
              <li key={f.id}>
                <Link to={`/forecasts/${f.id}`} className="flex flex-wrap items-start justify-between gap-2 rounded border p-3 hover:bg-muted/30">
                  <div className="min-w-0">
                    <span className="font-medium">{f.name}</span>
                    {f.versionNumber && <span className="ml-2 text-xs text-muted-foreground">v{f.versionNumber}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{FORECAST_STATUS_LABELS[f.status as keyof typeof FORECAST_STATUS_LABELS] || f.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </>)}

      {tab === 'overview' && <>
      {/* EDITOR */}
      <Card className="p-0 overflow-hidden">
        <button
          type="button"
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
          onClick={() => setEditorOpen((v) => !v)}
        >
          <div>
            <h2 className="text-lg font-semibold">Editar dados do projeto</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Nome, prazos, % executado, orçamento, descrição.</p>
          </div>
          {editorOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>
        {editorOpen && (
          <div className="p-4 sm:p-6 pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} />
              </div>
              <div>
                <Label>% executado</Label>
                <Input type="number" min="0" max="100" value={progressPct} onChange={(e) => { setProgressPct(e.target.value); setDirty(true) }} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Orçamento</Label>
                <Input type="number" step="0.01" value={budget} onChange={(e) => { setBudget(e.target.value); setDirty(true) }} />
              </div>
              <div>
                <Label>{t('common.fields.currency')}</Label>
                <Input value={currency} onChange={(e) => { setCurrency(e.target.value.toUpperCase().slice(0, 3)); setDirty(true) }} maxLength={3} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Início planejado</Label>
                <Input type="date" value={plannedStart} onChange={(e) => { setPlannedStart(e.target.value); setDirty(true) }} />
              </div>
              <div>
                <Label>Fim planejado</Label>
                <Input type="date" value={plannedEnd} onChange={(e) => { setPlannedEnd(e.target.value); setDirty(true) }} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Início real</Label>
                <Input type="date" value={actualStart} onChange={(e) => { setActualStart(e.target.value); setDirty(true) }} />
              </div>
              <div>
                <Label>Fim real</Label>
                <Input type="date" value={actualEnd} onChange={(e) => { setActualEnd(e.target.value); setDirty(true) }} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setDirty(true) }}
                className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  if (!prj) return
                  setName(prj.name)
                  setStatus(prj.status)
                  setPlannedStart(prj.plannedStart || '')
                  setPlannedEnd(prj.plannedEnd || '')
                  setActualStart(prj.actualStart || '')
                  setActualEnd(prj.actualEnd || '')
                  setProgressPct(String(prj.progressPct ?? 0))
                  setBudget(String(prj.budget ?? ''))
                  setCurrency(prj.currency || 'BRL')
                  setDescription(prj.description || '')
                  setDirty(false)
                }}
                disabled={!dirty}
              >Descartar</Button>
              <Button onClick={handleSave} disabled={!dirty || update.isPending}>
                {update.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
      </Card>
      </>}
    </div>
  )
}
