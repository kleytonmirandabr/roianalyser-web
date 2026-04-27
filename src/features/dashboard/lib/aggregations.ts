import {
  buildCashFlow,
  computeMetrics,
  readFinancialInputs,
} from '@/features/projects/lib/financials'
import type { Project } from '@/features/projects/types'

export type StatusBreakdown = {
  status: string
  count: number
}

export type ProjectFinancialSummary = {
  project: Project
  totalRevenue: number
  totalCost: number
  totalResult: number
  margin: number
  paybackMonth: number | null
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Total de projetos ativos (não soft-deletados). */
export function countActive(projects: Project[]): number {
  return projects.filter((p) => p.active !== false).length
}

/** Conta quantos projetos foram atualizados na última semana. */
export function countUpdatedRecently(
  projects: Project[],
  windowMs = ONE_WEEK_MS,
): number {
  const cutoff = Date.now() - windowMs
  return projects.filter((p) => {
    if (!p.updatedAt) return false
    const ts = new Date(p.updatedAt).getTime()
    return Number.isFinite(ts) && ts >= cutoff
  }).length
}

/** Distribuição de projetos por status, ordenada do maior para o menor. */
export function breakdownByStatus(projects: Project[]): StatusBreakdown[] {
  const counts = new Map<string, number>()
  for (const project of projects) {
    const key = (project.status || 'sem status').toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}

/** Retorna os N projetos mais recentemente atualizados. */
export function topRecent(projects: Project[], n = 5): Project[] {
  return [...projects]
    .filter((p) => !!p.updatedAt)
    .sort(
      (a, b) =>
        new Date(b.updatedAt as string).getTime() -
        new Date(a.updatedAt as string).getTime(),
    )
    .slice(0, n)
}

/**
 * Resumos financeiros por projeto. Roda buildCashFlow + computeMetrics
 * em cada projeto que tenha `entryGroups` ou inputs financeiros. Útil
 * para os widgets do dashboard que listam top-N por margem/receita.
 */
export function financialSummaries(projects: Project[]): ProjectFinancialSummary[] {
  return projects
    .map((project) => {
      const payload = (project.payload ?? {}) as Record<string, unknown>
      const inputs = readFinancialInputs(payload)
      const cashFlow = buildCashFlow(payload, inputs)
      const m = computeMetrics(cashFlow)
      return {
        project,
        totalRevenue: m.totalRevenue,
        totalCost: m.totalCost,
        totalResult: m.totalResult,
        margin: m.margin,
        paybackMonth: m.paybackMonth,
      }
    })
    .filter((s) => s.totalRevenue > 0 || s.totalCost > 0)
}

/** Soma agregada do tenant inteiro. */
export type TenantFinancialTotals = {
  totalRevenue: number
  totalCost: number
  totalResult: number
  /** Margem média ponderada (totalResult/totalRevenue × 100). */
  margin: number
  /** Quantos projetos foram considerados (com pelo menos 1 número não-zero). */
  projectsWithFinancials: number
}

export function aggregateTenantTotals(
  summaries: ProjectFinancialSummary[],
): TenantFinancialTotals {
  let totalRevenue = 0
  let totalCost = 0
  let totalResult = 0
  for (const s of summaries) {
    totalRevenue += s.totalRevenue
    totalCost += s.totalCost
    totalResult += s.totalResult
  }
  return {
    totalRevenue,
    totalCost,
    totalResult,
    margin: totalRevenue > 0 ? (totalResult / totalRevenue) * 100 : 0,
    projectsWithFinancials: summaries.length,
  }
}

/**
 * Distribuição de projetos por mês de criação. Limitado aos últimos 12
 * meses (incluindo o mês corrente). Retorna sempre os 12 buckets, mesmo
 * que com count=0, pra facilitar render do gráfico.
 */
export type MonthlyBucket = {
  /** "YYYY-MM" do mês. */
  key: string
  /** Label "Mai/26" para exibição. */
  label: string
  count: number
}

export function projectsByMonth(
  projects: Project[],
  now: Date = new Date(),
): MonthlyBucket[] {
  const buckets = new Map<string, MonthlyBucket>()
  // Inicializa últimos 12 meses (mais antigo primeiro)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthShort = d.toLocaleString(undefined, { month: 'short' })
    const yy = String(d.getFullYear()).slice(-2)
    buckets.set(key, { key, label: `${monthShort}/${yy}`, count: 0 })
  }
  for (const p of projects) {
    if (!p.createdAt) continue
    const d = new Date(p.createdAt)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = buckets.get(key)
    if (b) b.count++
  }
  return [...buckets.values()]
}
