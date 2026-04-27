/**
 * Notificações in-app — geração derivada de dados existentes.
 *
 * Versão "fase 1" sem persistir notificações no backend: a cada render,
 * o frontend deriva eventos relevantes pro user atual (tarefas atrasadas,
 * marcos próximos, projetos parados sob sua responsabilidade) e mostra
 * no sino. "Lidas" são guardadas em localStorage por user.
 *
 * Quando backend tiver tabela `notifications` (Sprint D), trocamos pra
 * fonte real com push em tempo real.
 */

import { effectiveStatus, readMilestones } from '@/features/projects/lib/milestones'
import { isUserInProject } from '@/features/projects/lib/scope-filter'
import { readTasks, scheduleStatus } from '@/features/projects/lib/tasks'
import type { Project } from '@/features/projects/types'

export type NotificationKind =
  | 'task_overdue'
  | 'task_today'
  | 'milestone_late'
  | 'milestone_due_soon'
  | 'project_stalled'
  | 'project_no_team'

export type Notification = {
  id: string
  kind: NotificationKind
  message: string
  link?: string
  /** ISO. */
  at: string
  /** Severidade visual. */
  tone: 'warn' | 'bad' | 'info'
}

const READ_KEY_PREFIX = 'roi.notifications.read.'

export function generateNotifications(
  projects: Project[],
  userId: string | undefined,
): Notification[] {
  if (!userId) return []
  const out: Notification[] = []
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000

  for (const p of projects) {
    if (!isUserInProject(p, userId)) continue
    const payload = (p.payload ?? {}) as Record<string, unknown>

    // Tasks atrasadas/hoje
    const tasks = readTasks(payload)
    for (const task of tasks) {
      if (!(task.responsibleIds ?? []).includes(userId)) continue
      if (task.status === 'completed') continue
      const sched = scheduleStatus(task)
      if (sched === 'overdue') {
        out.push({
          id: `task_overdue_${p.id}_${task.id}`,
          kind: 'task_overdue',
          message: `Tarefa atrasada: "${task.subject || '—'}" em ${p.name}`,
          link: `/projects/${p.id}/tasks`,
          at: task.scheduledDate ?? new Date().toISOString(),
          tone: 'bad',
        })
      } else if (task.scheduledDate === today) {
        out.push({
          id: `task_today_${p.id}_${task.id}`,
          kind: 'task_today',
          message: `Tarefa pra hoje: "${task.subject || '—'}" em ${p.name}`,
          link: `/projects/${p.id}/tasks`,
          at: new Date().toISOString(),
          tone: 'warn',
        })
      }
    }

    // Marcos
    const ms = readMilestones(payload)
    for (const milestone of ms) {
      if (milestone.responsibleId !== userId) continue
      if (milestone.status === 'done') continue
      if (effectiveStatus(milestone) === 'late') {
        out.push({
          id: `ms_late_${p.id}_${milestone.id}`,
          kind: 'milestone_late',
          message: `Marco atrasado: "${milestone.title || '—'}" em ${p.name}`,
          link: `/projects/${p.id}/schedule`,
          at: milestone.plannedDate || new Date().toISOString(),
          tone: 'bad',
        })
      } else if (milestone.plannedDate) {
        const planned = new Date(milestone.plannedDate).getTime()
        if (planned >= now && planned - now <= SEVEN_DAYS) {
          out.push({
            id: `ms_soon_${p.id}_${milestone.id}`,
            kind: 'milestone_due_soon',
            message: `Marco próximo: "${milestone.title || '—'}" em ${p.name}`,
            link: `/projects/${p.id}/schedule`,
            at: milestone.plannedDate,
            tone: 'info',
          })
        }
      }
    }

    // Projeto parado (só se eu for responsável direto, não só time)
    if (
      p.updatedAt &&
      now - new Date(p.updatedAt).getTime() > FOURTEEN_DAYS
    ) {
      const teamIds = Array.isArray(payload.teamIds)
        ? (payload.teamIds as string[])
        : []
      if (teamIds.includes(userId)) {
        out.push({
          id: `proj_stalled_${p.id}`,
          kind: 'project_stalled',
          message: `Projeto sem atividade há 14+ dias: ${p.name}`,
          link: `/projects/${p.id}`,
          at: p.updatedAt,
          tone: 'warn',
        })
      }
    }
  }

  // Mais recente primeiro
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

export function readReadIds(userId: string | undefined): Set<string> {
  if (!userId) return new Set()
  try {
    const raw = localStorage.getItem(READ_KEY_PREFIX + userId)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr)
  } catch {
    return new Set()
  }
}

export function markRead(userId: string | undefined, ids: string[]) {
  if (!userId) return
  const set = readReadIds(userId)
  for (const id of ids) set.add(id)
  // Limita a 500 ids armazenados
  const arr = [...set].slice(-500)
  try {
    localStorage.setItem(READ_KEY_PREFIX + userId, JSON.stringify(arr))
  } catch {
    // ignore
  }
}

export function markAllRead(userId: string | undefined, notifications: Notification[]) {
  markRead(userId, notifications.map((n) => n.id))
}
