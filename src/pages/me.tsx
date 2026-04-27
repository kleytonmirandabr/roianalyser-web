import {
  AlarmClock,
  Briefcase,
  CheckCircle2,
  Clock,
  Flag,
  Inbox,
  TrendingDown,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { MyPendingApprovals } from '@/features/projects/components/my-pending-approvals'
import { useProjects } from '@/features/projects/hooks/use-projects'
import {
  effectiveStatus,
  readMilestones,
  type Milestone,
} from '@/features/projects/lib/milestones'
import { isUserInProject } from '@/features/projects/lib/scope-filter'
import {
  readTasks,
  scheduleStatus,
  type Task,
} from '@/features/projects/lib/tasks'
import type { Project } from '@/features/projects/types'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

type TaskWithProject = Task & {
  projectId: string
  projectName: string
}
type MilestoneWithProject = Milestone & {
  projectId: string
  projectName: string
}

export function MyAgendaPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const projects = useProjects()

  const myProjects = useMemo<Project[]>(
    () => (projects.data ?? []).filter((p) => isUserInProject(p, user?.id)),
    [projects.data, user?.id],
  )

  const myTasks = useMemo<TaskWithProject[]>(() => {
    const out: TaskWithProject[] = []
    for (const p of myProjects) {
      const tasks = readTasks(p.payload as Record<string, unknown> | null)
      for (const tt of tasks) {
        if (
          tt.status === 'pending' &&
          (tt.responsibleIds ?? []).includes(user?.id ?? '__none__')
        ) {
          out.push({ ...tt, projectId: p.id, projectName: p.name })
        }
      }
    }
    return out
  }, [myProjects, user?.id])

  const myMilestones = useMemo<MilestoneWithProject[]>(() => {
    const out: MilestoneWithProject[] = []
    for (const p of myProjects) {
      const ms = readMilestones(p.payload as Record<string, unknown> | null)
      for (const m of ms) {
        if (m.responsibleId === user?.id && m.status !== 'done') {
          out.push({ ...m, projectId: p.id, projectName: p.name })
        }
      }
    }
    return out
  }, [myProjects, user?.id])

  // Buckets: hoje, atrasadas, próximos 7 dias
  const today = new Date().toISOString().slice(0, 10)
  const in7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const overdueTasks = myTasks.filter(
    (t) => scheduleStatus(t) === 'overdue',
  )
  const todayTasks = myTasks.filter(
    (t) => t.scheduledDate === today && scheduleStatus(t) === 'pending',
  )
  const upcomingTasks = myTasks.filter(
    (t) =>
      t.scheduledDate &&
      t.scheduledDate > today &&
      t.scheduledDate <= in7d,
  )

  const overdueMilestones = myMilestones.filter(
    (m) => effectiveStatus(m) === 'late',
  )
  const upcomingMilestones = myMilestones.filter((m) => {
    if (!m.plannedDate) return false
    return m.plannedDate >= today && m.plannedDate <= in7d
  })

  const stalledProjects = useMemo<Project[]>(() => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
    return myProjects.filter((p) => {
      if (!p.updatedAt) return false
      return new Date(p.updatedAt).getTime() < cutoff
    })
  }, [myProjects])

  const greetingName = user?.name?.split(' ')[0] ?? user?.email ?? 'usuário'

  const allEmpty =
    overdueTasks.length === 0 &&
    todayTasks.length === 0 &&
    upcomingTasks.length === 0 &&
    overdueMilestones.length === 0 &&
    upcomingMilestones.length === 0 &&
    stalledProjects.length === 0

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('me.title', { name: greetingName })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('me.subtitle')}</p>
      </div>

      {projects.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('projects.loadError')}</AlertDescription>
        </Alert>
      )}

      {/* Aprovações pendentes — só aparece se houver alguma. */}
      <MyPendingApprovals />

      {allEmpty && (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-base font-medium">{t('me.allClearTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('me.allClearSubtitle')}
            </p>
          </CardContent>
        </Card>
      )}

      {overdueTasks.length > 0 && (
        <SectionCard
          title={t('me.sections.overdueTasks')}
          icon={TrendingDown}
          tone="bad"
          count={overdueTasks.length}
        >
          {overdueTasks.map((task) => (
            <RowItem
              key={task.id}
              to={`/projects/${task.projectId}/tasks`}
              left={task.subject || '—'}
              right={`${task.scheduledDate ?? ''} ${task.scheduledTime ?? ''}`}
              hint={task.projectName}
              tone="bad"
            />
          ))}
        </SectionCard>
      )}

      {todayTasks.length > 0 && (
        <SectionCard
          title={t('me.sections.todayTasks')}
          icon={AlarmClock}
          tone="warn"
          count={todayTasks.length}
        >
          {todayTasks.map((task) => (
            <RowItem
              key={task.id}
              to={`/projects/${task.projectId}/tasks`}
              left={task.subject || '—'}
              right={task.scheduledTime ?? ''}
              hint={task.projectName}
              tone="warn"
            />
          ))}
        </SectionCard>
      )}

      {overdueMilestones.length > 0 && (
        <SectionCard
          title={t('me.sections.overdueMilestones')}
          icon={Flag}
          tone="bad"
          count={overdueMilestones.length}
        >
          {overdueMilestones.map((m) => (
            <RowItem
              key={m.id}
              to={`/projects/${m.projectId}/schedule`}
              left={m.title || '—'}
              right={m.plannedDate}
              hint={m.projectName}
              tone="bad"
            />
          ))}
        </SectionCard>
      )}

      {upcomingMilestones.length > 0 && (
        <SectionCard
          title={t('me.sections.upcomingMilestones')}
          icon={Flag}
          tone="info"
          count={upcomingMilestones.length}
        >
          {upcomingMilestones.map((m) => (
            <RowItem
              key={m.id}
              to={`/projects/${m.projectId}/schedule`}
              left={m.title || '—'}
              right={m.plannedDate}
              hint={m.projectName}
            />
          ))}
        </SectionCard>
      )}

      {upcomingTasks.length > 0 && (
        <SectionCard
          title={t('me.sections.upcomingTasks')}
          icon={Clock}
          count={upcomingTasks.length}
        >
          {upcomingTasks.map((task) => (
            <RowItem
              key={task.id}
              to={`/projects/${task.projectId}/tasks`}
              left={task.subject || '—'}
              right={task.scheduledDate ?? ''}
              hint={task.projectName}
            />
          ))}
        </SectionCard>
      )}

      {stalledProjects.length > 0 && (
        <SectionCard
          title={t('me.sections.stalledProjects')}
          icon={Briefcase}
          tone="warn"
          count={stalledProjects.length}
        >
          {stalledProjects.map((p) => (
            <RowItem
              key={p.id}
              to={`/projects/${p.id}`}
              left={p.name}
              right={
                p.updatedAt
                  ? new Date(p.updatedAt).toLocaleDateString()
                  : '—'
              }
              hint={p.status ?? ''}
              tone="warn"
            />
          ))}
        </SectionCard>
      )}

      {!allEmpty && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Inbox className="h-4 w-4" />
              {t('me.summaryLine', {
                projects: myProjects.length,
                tasks: myTasks.length,
                milestones: myMilestones.length,
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  count,
  tone,
  children,
}: {
  title: string
  icon: typeof Inbox
  count: number
  tone?: 'bad' | 'warn' | 'info'
  children: React.ReactNode
}) {
  const toneClass =
    tone === 'bad'
      ? 'text-destructive'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'info'
          ? 'text-blue-600'
          : 'text-muted-foreground'
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 text-base ${toneClass}`}>
          <Icon className="h-4 w-4" />
          {title}
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-foreground">
            {count}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">{children}</CardContent>
    </Card>
  )
}

function RowItem({
  to,
  left,
  right,
  hint,
  tone,
}: {
  to: string
  left: string
  right?: string
  hint?: string
  tone?: 'bad' | 'warn'
}) {
  const rightClass =
    tone === 'bad'
      ? 'text-destructive'
      : tone === 'warn'
        ? 'text-amber-600'
        : 'text-muted-foreground'
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground">{left}</div>
        {hint && (
          <div className="truncate text-xs text-muted-foreground">{hint}</div>
        )}
      </div>
      {right && (
        <span className={`text-xs tabular-nums ${rightClass}`}>{right}</span>
      )}
    </Link>
  )
}
