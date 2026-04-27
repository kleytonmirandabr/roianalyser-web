/**
 * Filtro "meu" — pra usar nas listas. Considera o user "envolvido" no
 * projeto se:
 *   - É owner (createdBy ou ownerId)
 *   - Está em payload.teamIds
 *   - Tem alguma task com responsibleIds incluindo seu id
 *   - É responsável de algum milestone
 */

import type { Project } from '@/features/projects/types'

export function isUserInProject(
  project: Project,
  userId: string | undefined,
): boolean {
  if (!userId) return false
  // Owner
  if (project.createdBy === userId) return true
  if ((project as unknown as { ownerId?: string }).ownerId === userId)
    return true
  // teamIds
  const payload = (project.payload ?? {}) as Record<string, unknown>
  const teamIds = Array.isArray(payload.teamIds) ? (payload.teamIds as unknown[]) : []
  if (teamIds.includes(userId)) return true
  // Tasks
  const tasks = Array.isArray(payload.tasks) ? (payload.tasks as unknown[]) : []
  for (const t of tasks) {
    const task = t as Record<string, unknown>
    const ids = task.responsibleIds
    if (Array.isArray(ids) && (ids as unknown[]).includes(userId)) return true
  }
  // Milestones
  const milestones = Array.isArray(payload.milestones)
    ? (payload.milestones as unknown[])
    : []
  for (const m of milestones) {
    const ms = m as Record<string, unknown>
    if (ms.responsibleId === userId) return true
  }
  return false
}
