/**
 * Adapter — converte Opportunity[] em Project[] pra reuso direto nas
 * páginas /opportunities/board, /funnel, /lost que ainda esperam o shape
 * antigo de Project (vindo de /api/contracts).
 *
 * Mapeia FK status_id → string (status.name) via catálogo opportunity_statuses
 * e responsible_id → nome via appState.users.
 */
import { useMemo } from 'react'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import type { Project } from '@/features/projects/types'

import { useOpportunities } from './use-opportunities'

interface AdapterResult {
  data: Project[] | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
}

export function useOpportunitiesAsProjects(): AdapterResult {
  const ops = useOpportunities()
  const statuses = useOpportunityStatuses()
  const appState = useAppState()

  const data = useMemo<Project[] | undefined>(() => {
    if (!ops.data) return undefined
    const statusById = new Map(
      (statuses.data ?? []).map((s) => [String(s.id), s]),
    )
    const users = (appState.data?.users ?? []) as Array<{
      id?: string
      name?: string
      email?: string
    }>
    const userNameById = new Map(
      users.map((u) => [
        String(u.id ?? ''),
        u.name || u.email || '',
      ]),
    )
    return ops.data.map((op): Project => {
      const status = op.statusId ? statusById.get(String(op.statusId)) : undefined
      const responsibleName = op.responsibleId
        ? (userNameById.get(String(op.responsibleId)) ?? '')
        : ''
      return {
        id: String(op.id),
        name: op.name,
        tenantId: String(op.tenantId),
        status: status?.name ?? '',
        currency: op.currency ?? 'BRL',
        active: !op.deletedAt,
        createdAt: op.createdAt,
        updatedAt: op.updatedAt,
        deletedAt: op.deletedAt ?? null,
        deletedBy: op.deletedBy ?? null,
        payload: {
          responsible: responsibleName,
          clientId: op.clientId,
          startDate: op.expectedCloseDate ?? undefined,
          estimatedValue: op.estimatedValue ?? undefined,
        },
        clientName: '',
        estimatedValue: op.estimatedValue ?? null,
        responsibleId: op.responsibleId,
        statusId: op.statusId,
        opportunityTypeId: op.opportunityTypeId,
      }
    })
  }, [ops.data, statuses.data, appState.data])

  return {
    data,
    isLoading: ops.isLoading || statuses.isLoading || appState.isLoading,
    isError: ops.isError || statuses.isError || appState.isError,
    error: ops.error ?? statuses.error ?? appState.error,
  }
}
