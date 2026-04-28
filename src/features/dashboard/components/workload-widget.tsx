import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { UserAvatar } from '@/features/admin/components/user-select'
import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  effectiveStatus,
  readMilestones,
} from '@/features/projects/lib/milestones'
import {
  readTasks,
  scheduleStatus,
} from '@/features/projects/lib/tasks'
import type { Project } from '@/features/projects/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

type Workload = {
  userId: string
  name: string
  openTasks: number
  overdueTasks: number
  openMilestones: number
  lateMilestones: number
  projectsAsTeam: number
}

/**
 * Widget mostrando carga de trabalho por user — útil pra detectar
 * sobrecargas e descobrir quem está com folga.
 */
export function WorkloadWidget({ projects }: { projects: Project[] }) {
  const { t } = useTranslation()
  const appState = useAppState()
  const { user: currentUser } = useAuth()
  // Tenant isolation: o widget mostra carga de trabalho do tenant ativo.
  // Master vê tudo; admin/user não-master só vê users do tenant onde
  // está logado agora.
  const isMasterUser = currentUser?.isMaster === true
  const activeTenantId =
    currentUser?.activeClientId ?? currentUser?.clientId ?? ''
  const allUsers = appState.data?.users ?? []
  const users = isMasterUser
    ? allUsers
    : allUsers.filter((u) => !u.isMaster && u.clientId === activeTenantId)

  const workload = useMemo<Workload[]>(() => {
    const map = new Map<string, Workload>()
    for (const u of users.filter((u) => u.active !== false)) {
      map.set(u.id, {
        userId: u.id,
        name: u.name || u.email || u.id,
        openTasks: 0,
        overdueTasks: 0,
        openMilestones: 0,
        lateMilestones: 0,
        projectsAsTeam: 0,
      })
    }
    for (const p of projects) {
      const payload = (p.payload ?? {}) as Record<string, unknown>
      const teamIds = Array.isArray(payload.teamIds)
        ? (payload.teamIds as string[])
        : []
      for (const uid of teamIds) {
        const w = map.get(uid)
        if (w) w.projectsAsTeam++
      }
      const tasks = readTasks(payload)
      for (const task of tasks) {
        const sched = scheduleStatus(task)
        if (sched === 'completed') continue
        for (const uid of task.responsibleIds ?? []) {
          const w = map.get(uid)
          if (!w) continue
          w.openTasks++
          if (sched === 'overdue') w.overdueTasks++
        }
      }
      const milestones = readMilestones(payload)
      for (const ms of milestones) {
        if (ms.status === 'done' || !ms.responsibleId) continue
        const w = map.get(ms.responsibleId)
        if (!w) continue
        w.openMilestones++
        if (effectiveStatus(ms) === 'late') w.lateMilestones++
      }
    }
    return [...map.values()]
      .filter((w) => w.openTasks + w.openMilestones + w.projectsAsTeam > 0)
      .sort(
        (a, b) =>
          b.overdueTasks + b.lateMilestones - (a.overdueTasks + a.lateMilestones) ||
          b.openTasks + b.openMilestones - (a.openTasks + a.openMilestones),
      )
      .slice(0, 8)
  }, [users, projects])

  if (workload.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.workloadTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.workloadDesc')}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {workload.map((w) => {
          const overloaded = w.overdueTasks + w.lateMilestones > 0
          return (
            <div
              key={w.userId}
              className="flex items-center gap-3 rounded-md border border-border p-2"
            >
              <UserAvatar name={w.name} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{w.name}</div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{t('dashboard.workload.tasks', { n: w.openTasks })}</span>
                  <span>·</span>
                  <span>
                    {t('dashboard.workload.milestones', { n: w.openMilestones })}
                  </span>
                  <span>·</span>
                  <span>
                    {t('dashboard.workload.projects', { n: w.projectsAsTeam })}
                  </span>
                </div>
              </div>
              {overloaded && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  {t('dashboard.workload.overdue', {
                    n: w.overdueTasks + w.lateMilestones,
                  })}
                </span>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
