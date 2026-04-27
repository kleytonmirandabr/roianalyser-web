/**
 * Rolling Forecast — visão consolidada do tenant inteiro.
 *
 * Soma forecast (expected/actual) de TODOS os projetos por mês calendário,
 * dentro de uma janela rolante de N meses a partir do mês corrente. Suporta
 * cenários (Base, Otimista, Pessimista) com ajustes manuais (what-if).
 */

import { readForecast } from '@/features/projects/lib/forecast'
import {
  buildCashFlow,
  readFinancialInputs,
} from '@/features/projects/lib/financials'
import { statusInCategory } from '@/features/projects/lib/status-categories'
import type { Project } from '@/features/projects/types'
import type { ProjectStatus } from '@/features/projects/lib/status-categories'

export type ScenarioAdjustment = {
  id: string
  /** ID do projeto. */
  projectId: string
  /**
   * "YYYY-MM" do mês a aplicar. null = aplica em todos os meses dentro da
   * janela.
   */
  month: string | null
  /** Multiplicador % (ex: -1.0 = zera; 0.2 = +20%). Se setado, ignora value. */
  adjustmentPct?: number
  /** Valor absoluto que substitui o expected. Tem prioridade sobre pct. */
  adjustmentValue?: number
  /** Razão livre. */
  reason: string
  addedBy?: string
  addedAt?: string
}

export type ForecastScenario = {
  id: string
  name: string
  color?: string
  adjustments: ScenarioAdjustment[]
}

/** Cenários default no primeiro uso. */
export const DEFAULT_SCENARIOS: ForecastScenario[] = [
  { id: 'scenario_base', name: 'Base', color: '#4f46e5', adjustments: [] },
  { id: 'scenario_otimista', name: 'Otimista', color: '#16a34a', adjustments: [] },
  { id: 'scenario_pessimista', name: 'Pessimista', color: '#dc2626', adjustments: [] },
]

export type RollingMonthBucket = {
  /** "YYYY-MM" calendário. */
  key: string
  /** Label "Mai/26". */
  label: string
  /** Soma de receita esperada do cenário (com ajustes aplicados). */
  expected: number
  /** Soma de receita realizada (sempre real, ignora cenário). */
  actual: number
  /** Quantos projetos contribuem nesse mês. */
  projectsCount: number
}

export type RollingProjectRow = {
  project: Project
  /** Mapa "YYYY-MM" → valor expected (após ajustes do cenário). */
  byMonth: Map<string, number>
  /** Total no horizonte da janela. */
  totalExpected: number
  /** Total realizado no horizonte. */
  totalActual: number
}

export type RollingResult = {
  buckets: RollingMonthBucket[]
  rows: RollingProjectRow[]
  totalExpected: number
  totalActual: number
}

/** Helper: gera label "Mai/26" pra mês YYYY-MM. */
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  const d = new Date(y, m - 1, 1)
  const monthShort = d.toLocaleString(undefined, { month: 'short' })
  return `${monthShort}/${String(y).slice(-2)}`
}

/** Mapa "YYYY-MM" pra cada um dos próximos N meses, começando do passado para o futuro. */
function buildMonthKeys(
  horizonMonths: number,
  now: Date = new Date(),
): string[] {
  const out: string[] = []
  // Janela: 6 meses passados + (horizon - 6) futuros, ou simplesmente
  // do mês corrente em diante. Vou começar do mês corrente.
  for (let i = 0; i < horizonMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push(key)
  }
  return out
}

/**
 * Mapeia um mês relativo do projeto (1, 2, 3...) pra mês calendário YYYY-MM,
 * usando project.createdAt como mês 1. Se createdAt faltar, usa hoje.
 */
function projectMonthToCalendar(
  project: Project,
  relativeMonth: number,
): string {
  const start = project.createdAt ? new Date(project.createdAt) : new Date()
  const target = new Date(
    start.getFullYear(),
    start.getMonth() + (relativeMonth - 1),
    1,
  )
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Aplica ajustes de cenário sobre um valor base.
 * Retorna o valor ajustado.
 */
function applyAdjustments(
  baseValue: number,
  projectId: string,
  monthKey: string,
  adjustments: ScenarioAdjustment[],
): number {
  const relevant = adjustments.filter(
    (a) =>
      a.projectId === projectId &&
      (a.month === null || a.month === monthKey),
  )
  let value = baseValue
  for (const adj of relevant) {
    if (typeof adj.adjustmentValue === 'number') {
      value = adj.adjustmentValue
    } else if (typeof adj.adjustmentPct === 'number') {
      value = value * (1 + adj.adjustmentPct)
    }
  }
  return Math.max(0, value)
}

/**
 * Constrói o Rolling Forecast consolidado.
 *
 * @param projects   Lista de projetos do tenant
 * @param scenario   Cenário ativo (com seus ajustes)
 * @param horizon    Janela em meses (ex: 18)
 * @param statuses   Catálogo de status (pra excluir lost)
 * @param includeLost se true, inclui projetos lost (default false — eles
 *                    não contam pro forecast porque foram cancelados)
 */
export function buildRollingForecast(
  projects: Project[],
  scenario: ForecastScenario,
  horizon: number,
  statuses: ProjectStatus[],
  includeLost = false,
): RollingResult {
  const monthKeys = buildMonthKeys(horizon)
  const buckets = new Map<string, RollingMonthBucket>(
    monthKeys.map((key) => [
      key,
      { key, label: monthLabel(key), expected: 0, actual: 0, projectsCount: 0 },
    ]),
  )

  // Filtra projetos: exclui lost/cancelled por padrão.
  // Usa o catálogo se disponível; senão (user sem acesso, tenant antigo)
  // faz fallback de keyword direto pelo nome do status do projeto.
  const eligibleProjects = projects.filter((p) => {
    if (!p.status) return true
    if (includeLost) return true
    const status =
      statuses.find((s) => s.name === p.status) ||
      ({ id: '', name: p.status } as ProjectStatus)
    return !statusInCategory(status, 'lost') && !statusInCategory(status, 'cancelled')
  })

  const rows: RollingProjectRow[] = []
  for (const project of eligibleProjects) {
    const payload = (project.payload ?? {}) as Record<string, unknown>
    const inputs = readFinancialInputs(payload)
    const cashFlow = buildCashFlow(payload, inputs)
    const persisted = readForecast(payload, inputs.prazo)

    const byMonth = new Map<string, number>()
    let totalExpected = 0
    let totalActual = 0

    // Pra cada mês relativo do projeto, mapeia pra mês calendário e soma
    for (const cf of cashFlow) {
      const calKey = projectMonthToCalendar(project, cf.month)
      if (!buckets.has(calKey)) continue // fora da janela rolling
      const adjusted = applyAdjustments(
        cf.revenue,
        project.id,
        calKey,
        scenario.adjustments,
      )
      byMonth.set(calKey, (byMonth.get(calKey) ?? 0) + adjusted)
      totalExpected += adjusted
      const bucket = buckets.get(calKey)!
      bucket.expected += adjusted
      bucket.projectsCount++
    }

    // Realizado vem do persisted (não tem ajuste — é fato)
    for (const line of persisted) {
      if (line.actualRevenue == null) continue
      const calKey = projectMonthToCalendar(project, line.month)
      if (!buckets.has(calKey)) continue
      totalActual += line.actualRevenue
      const bucket = buckets.get(calKey)!
      bucket.actual += line.actualRevenue
    }

    if (totalExpected > 0 || totalActual > 0) {
      rows.push({ project, byMonth, totalExpected, totalActual })
    }
  }

  // Ordena projetos por totalExpected desc
  rows.sort((a, b) => b.totalExpected - a.totalExpected)

  const totalExpected = [...buckets.values()].reduce((s, b) => s + b.expected, 0)
  const totalActual = [...buckets.values()].reduce((s, b) => s + b.actual, 0)

  return {
    buckets: [...buckets.values()],
    rows,
    totalExpected,
    totalActual,
  }
}
