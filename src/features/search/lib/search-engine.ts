/**
 * Search engine sobre os projetos do tenant. Sem IA — só filtros
 * estruturados combináveis. Suporta DSL simples:
 *
 *   "valor:>500k em:SP status:negociacao"
 *   "atrasado responsavel:eu"
 *   "sem-time"
 *
 * Tokens reconhecidos:
 *   valor:>X / valor:<X     — filtra por totalRevenue
 *   em:UF                   — filtra por estado (companies.state)
 *   status:NOME             — filtra status do projeto (case-insensitive)
 *   responsavel:eu / id     — filtra por teamIds ou responsibleIds
 *   atrasado                — projetos com tasks/marcos atrasados
 *   sem-time                — projetos sem teamIds
 *   parado                  — projetos com updatedAt > 14 dias
 *
 * Tudo o resto vira full-text contra name, status, clientName.
 */

import { effectiveStatus, readMilestones } from '@/features/projects/lib/milestones'
import { readTasks, scheduleStatus } from '@/features/projects/lib/tasks'
import {
  buildCashFlow,
  computeMetrics,
  readFinancialInputs,
} from '@/features/projects/lib/financials'
import type { Project } from '@/features/projects/types'

export type SearchFilter = {
  fullText: string[]
  minValue?: number
  maxValue?: number
  state?: string
  status?: string
  responsibleId?: string // 'me' vira o user atual
  hasOverdue?: boolean
  hasNoTeam?: boolean
  isStalled?: boolean
}

const VALUE_REGEX = /^valor:([<>])(\d+(?:[.,]\d+)?)([kKmM]?)$/
const STATE_REGEX = /^em:([a-zA-Z]{2,})$/
const STATUS_REGEX = /^status:(.+)$/i
const RESP_REGEX = /^responsavel:(.+)$/i

function parseValueWithSuffix(num: string, suffix: string): number {
  let v = parseFloat(num.replace(',', '.'))
  if (suffix.toLowerCase() === 'k') v *= 1000
  if (suffix.toLowerCase() === 'm') v *= 1_000_000
  return v
}

export function parseQuery(q: string): SearchFilter {
  const out: SearchFilter = { fullText: [] }
  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  for (const t of tokens) {
    if (t === 'atrasado' || t === 'atrasados') {
      out.hasOverdue = true
      continue
    }
    if (t === 'sem-time' || t === 'semtime') {
      out.hasNoTeam = true
      continue
    }
    if (t === 'parado' || t === 'parados') {
      out.isStalled = true
      continue
    }
    const m1 = VALUE_REGEX.exec(t)
    if (m1) {
      const v = parseValueWithSuffix(m1[2], m1[3])
      if (m1[1] === '>') out.minValue = v
      else out.maxValue = v
      continue
    }
    const m2 = STATE_REGEX.exec(t)
    if (m2) {
      out.state = m2[1].toUpperCase().slice(0, 2)
      continue
    }
    const m3 = STATUS_REGEX.exec(t)
    if (m3) {
      out.status = m3[1]
      continue
    }
    const m4 = RESP_REGEX.exec(t)
    if (m4) {
      out.responsibleId = m4[1]
      continue
    }
    out.fullText.push(t)
  }
  return out
}

export function matchesQuery(
  project: Project,
  filter: SearchFilter,
  context: { userId?: string; companies?: { name?: string; state?: string }[] },
): boolean {
  const payload = (project.payload ?? {}) as Record<string, unknown>
  const { userId, companies = [] } = context

  // Full text
  if (filter.fullText.length > 0) {
    const haystack = [
      project.name,
      project.status ?? '',
      typeof project.clientName === 'string' ? project.clientName : '',
      typeof payload.clientName === 'string' ? payload.clientName : '',
    ]
      .join(' ')
      .toLowerCase()
    for (const term of filter.fullText) {
      if (!haystack.includes(term)) return false
    }
  }

  // Status
  if (filter.status) {
    const status = (project.status ?? '').toLowerCase()
    if (!status.includes(filter.status)) return false
  }

  // Estado
  if (filter.state) {
    let projectState = ''
    if (typeof payload.clientState === 'string') projectState = payload.clientState
    else if (typeof payload.state === 'string') projectState = payload.state
    else {
      const clientName =
        typeof project.clientName === 'string'
          ? project.clientName
          : typeof payload.clientName === 'string'
            ? payload.clientName
            : ''
      const company = companies.find(
        (c) => typeof c.name === 'string' && c.name.toLowerCase() === clientName.toLowerCase(),
      )
      if (company && typeof company.state === 'string') projectState = company.state
    }
    if (projectState.toUpperCase().slice(0, 2) !== filter.state) return false
  }

  // Responsável (eu OU id específico)
  if (filter.responsibleId) {
    const target =
      filter.responsibleId === 'eu' || filter.responsibleId === 'me'
        ? userId
        : filter.responsibleId
    if (!target) return false
    const teamIds = Array.isArray(payload.teamIds)
      ? (payload.teamIds as string[])
      : []
    if (!teamIds.includes(target)) {
      // Tenta tasks/milestones
      const tasks = readTasks(payload)
      const inTask = tasks.some((tt) =>
        (tt.responsibleIds ?? []).includes(target),
      )
      const ms = readMilestones(payload)
      const inMs = ms.some((m) => m.responsibleId === target)
      if (!inTask && !inMs) return false
    }
  }

  // Valor (totalRevenue do motor)
  if (filter.minValue != null || filter.maxValue != null) {
    const inputs = readFinancialInputs(payload)
    const cashFlow = buildCashFlow(payload, inputs)
    const metrics = computeMetrics(cashFlow)
    if (filter.minValue != null && metrics.totalRevenue < filter.minValue)
      return false
    if (filter.maxValue != null && metrics.totalRevenue > filter.maxValue)
      return false
  }

  if (filter.hasOverdue) {
    const tasks = readTasks(payload)
    const milestones = readMilestones(payload)
    const taskOverdue = tasks.some((tt) => scheduleStatus(tt) === 'overdue')
    const msOverdue = milestones.some((m) => effectiveStatus(m) === 'late')
    if (!taskOverdue && !msOverdue) return false
  }

  if (filter.hasNoTeam) {
    const teamIds = Array.isArray(payload.teamIds)
      ? (payload.teamIds as string[])
      : []
    if (teamIds.length > 0) return false
  }

  if (filter.isStalled) {
    if (!project.updatedAt) return false
    const ms = Date.now() - new Date(project.updatedAt).getTime()
    if (ms < 14 * 24 * 60 * 60 * 1000) return false
  }

  return true
}

export type SearchPreset = {
  id: string
  labelKey: string
  query: string
}

export const SEARCH_PRESETS: SearchPreset[] = [
  { id: 'mine-overdue', labelKey: 'search.presets.mineOverdue', query: 'responsavel:eu atrasado' },
  { id: 'high-value', labelKey: 'search.presets.highValue', query: 'valor:>500k' },
  { id: 'no-team', labelKey: 'search.presets.noTeam', query: 'sem-time' },
  { id: 'stalled', labelKey: 'search.presets.stalled', query: 'parado' },
  { id: 'mine-all', labelKey: 'search.presets.mineAll', query: 'responsavel:eu' },
]
