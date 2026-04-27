/**
 * Insights heurísticos — sinais úteis no dashboard sem custo de IA.
 * Calculados localmente a partir de projetos/tasks/milestones/forecast.
 */

import type { Project } from '@/features/projects/types'
import { effectiveStatus, readMilestones } from '@/features/projects/lib/milestones'
import { readForecast, summarizeForecast } from '@/features/projects/lib/forecast'
import { readTasks, scheduleStatus } from '@/features/projects/lib/tasks'
import {
  buildCashFlow,
  readFinancialInputs,
} from '@/features/projects/lib/financials'

export type InsightTone = 'good' | 'warn' | 'bad' | 'info'

export type Insight = {
  id: string
  tone: InsightTone
  /** Texto curto pra exibir. */
  message: string
  /** URL pra clicar e ver detalhes. */
  link?: string
  /** Categoria pra agrupamento. */
  category: 'forecast' | 'schedule' | 'activity' | 'pipeline' | 'team'
}

/**
 * Gera insights tenant-wide.
 * Critérios escolhidos pra ser acionáveis (não óbvio nem ruidoso).
 */
export function generateInsights(projects: Project[]): Insight[] {
  const out: Insight[] = []
  const now = Date.now()
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

  // 1. Projetos parados há 14+ dias
  const stalled = projects.filter((p) => {
    if (!p.updatedAt) return false
    return now - new Date(p.updatedAt).getTime() > FOURTEEN_DAYS_MS
  })
  if (stalled.length > 0) {
    out.push({
      id: 'stalled-14d',
      tone: 'warn',
      message: `${stalled.length} projeto(s) sem atividade há mais de 14 dias.`,
      link: '/projects',
      category: 'activity',
    })
  }

  // 2. Marcos atrasados nos próximos 7 dias
  let lateMilestones = 0
  let upcomingMilestones = 0
  for (const p of projects) {
    const ms = readMilestones(p.payload as Record<string, unknown> | null)
    for (const m of ms) {
      if (effectiveStatus(m) === 'late') lateMilestones++
      if (m.status !== 'done' && m.plannedDate) {
        const planned = new Date(m.plannedDate).getTime()
        if (planned >= now && planned - now <= SEVEN_DAYS_MS) upcomingMilestones++
      }
    }
  }
  if (lateMilestones > 0) {
    out.push({
      id: 'late-milestones',
      tone: 'bad',
      message: `${lateMilestones} marco(s) atrasado(s) na execução de projetos.`,
      category: 'schedule',
    })
  }
  if (upcomingMilestones > 0) {
    out.push({
      id: 'upcoming-milestones',
      tone: 'info',
      message: `${upcomingMilestones} marco(s) com prazo nos próximos 7 dias.`,
      category: 'schedule',
    })
  }

  // 3. Faturamento em atraso (paidStatus = overdue)
  let overdueRevenue = 0
  let overdueCount = 0
  for (const p of projects) {
    const payload = (p.payload ?? {}) as Record<string, unknown>
    const inputs = readFinancialInputs(payload)
    const lines = readForecast(payload, inputs.prazo)
    const summary = summarizeForecast(lines)
    overdueRevenue += summary.totalOverdue
    overdueCount += summary.monthsOverdue
  }
  if (overdueCount > 0) {
    out.push({
      id: 'overdue-revenue',
      tone: 'bad',
      message: `${overdueCount} mês(es) de faturamento marcado(s) como atrasado(s).`,
      category: 'forecast',
    })
  }

  // 4. Variance grande (realizado < 80% do esperado YTD)
  let varianceTotal = 0
  let expectedTotal = 0
  for (const p of projects) {
    const payload = (p.payload ?? {}) as Record<string, unknown>
    const inputs = readFinancialInputs(payload)
    const cashFlow = buildCashFlow(payload, inputs)
    const lines = readForecast(payload, inputs.prazo)
    for (const line of lines) {
      if (line.actualRevenue == null) continue
      const expectedAt = cashFlow.find((c) => c.month === line.month)?.revenue ?? 0
      expectedTotal += expectedAt
      varianceTotal += line.actualRevenue - expectedAt
    }
  }
  if (expectedTotal > 0) {
    const variancePct = (varianceTotal / expectedTotal) * 100
    if (variancePct < -15) {
      out.push({
        id: 'large-negative-variance',
        tone: 'bad',
        message: `Realizado ${variancePct.toFixed(1)}% abaixo do previsto. Revisar causas.`,
        link: '/forecast',
        category: 'forecast',
      })
    }
  }

  // 5. Tarefas atrasadas (qualquer user)
  let overdueTasks = 0
  for (const p of projects) {
    const tasks = readTasks(p.payload as Record<string, unknown> | null)
    for (const task of tasks) {
      if (scheduleStatus(task) === 'overdue') overdueTasks++
    }
  }
  if (overdueTasks > 0) {
    out.push({
      id: 'overdue-tasks',
      tone: 'warn',
      message: `${overdueTasks} tarefa(s) atrasada(s) no time.`,
      category: 'team',
    })
  }

  // 6. Projeto sem time alocado
  const noTeam = projects.filter((p) => {
    const teamIds = ((p.payload ?? {}) as Record<string, unknown>).teamIds
    return !Array.isArray(teamIds) || teamIds.length === 0
  })
  if (noTeam.length > 0 && noTeam.length <= projects.length / 2) {
    out.push({
      id: 'no-team',
      tone: 'info',
      message: `${noTeam.length} projeto(s) sem time alocado. Atribua responsáveis.`,
      category: 'team',
    })
  }

  return out
}
