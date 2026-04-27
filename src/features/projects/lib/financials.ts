/**
 * Motor de cálculo financeiro do projeto (Sprint F.1 — flat entries).
 *
 * Constrói fluxo de caixa mês a mês a partir de `dynamicEntries[]` (lista
 * flat de entries com referência ao catálogo). Cada entry traz seus
 * próprios flags `affectsRevenue/Cost/Investment` herdados do catalog item.
 *
 * Fórmulas:
 *   - amount(entry)    = quantity × unitValue × (1 - discountPct/100)
 *   - active(entry, m) = m ≥ startMonth AND m < startMonth + durationMonths
 *   - financial        = grossRevenue × (comissao + impostos) / 100
 *   - revenue          = grossRevenue − financial
 *   - result           = revenue − recCost − oneTimeCost − investment
 */

import {
  entryNet,
  readDynamicEntries,
  resolveEntryFlags,
  type DynamicEntry,
  type DynamicEntryCatalogItem,
  type DynamicEntryFinancialType,
} from './dynamic-entries'

/**
 * Lookups opcionais que o motor usa pra resolver flags via Sprint F.2:
 * `financialType` é fonte da verdade dos flags receita/custo/investimento.
 * Se omitidos, cai pros flags da própria entry (compat com chamadas antigas).
 */
export type CashFlowLookups = {
  financialTypes?: Map<string, DynamicEntryFinancialType>
  catalogItems?: Map<string, DynamicEntryCatalogItem>
}

export type ProjectFinancialInputs = {
  prazo: number
  comissaoPct: number
  impostosPct: number
  margemMeta?: number
}

export type CashFlowMonth = {
  month: number
  recurringRevenue: number
  oneTimeRevenue: number
  investment: number
  recurringCost: number
  oneTimeCost: number
  financial: number
  revenue: number
  result: number
  accum: number
}

export type ProjectMetrics = {
  totalRecurringRevenue: number
  totalOneTimeRevenue: number
  totalRevenue: number
  totalInvestment: number
  totalRecurringCost: number
  totalOneTimeCost: number
  totalCost: number
  totalFinancial: number
  totalResult: number
  margin: number
  paybackMonth: number | null
  peakAccum: number
  troughAccum: number
}

type RawPayload = Record<string, unknown> | null | undefined

function readNumber(payload: RawPayload, key: string, fallback = 0): number {
  if (!payload) return fallback
  const raw = payload[key]
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/** Mês `m` está dentro da janela `[startMonth, startMonth + durationMonths)`. */
function entryActiveInMonth(entry: DynamicEntry, month: number): boolean {
  const start = Math.max(1, entry.startMonth)
  const end = start + Math.max(1, entry.durationMonths)
  return month >= start && month < end
}

/** Entry é one-time quando duração = 1 mês. */
function entryIsOneTime(entry: DynamicEntry): boolean {
  return entry.durationMonths === 1
}

export function buildCashFlow(
  payload: RawPayload,
  inputs: ProjectFinancialInputs,
  lookups?: CashFlowLookups,
): CashFlowMonth[] {
  const prazo = Math.max(1, Math.floor(inputs.prazo))
  const finRate = Math.max(0, (inputs.comissaoPct + inputs.impostosPct) / 100)
  const entries = readDynamicEntries(payload)

  const months: CashFlowMonth[] = []
  let accum = 0

  for (let month = 1; month <= prazo; month += 1) {
    let recurringRevenue = 0
    let oneTimeRevenue = 0
    let recurringCost = 0
    let oneTimeCost = 0
    let investment = 0

    for (const entry of entries) {
      if (!entryActiveInMonth(entry, month)) continue
      const amount = entryNet(entry)
      const oneTime = entryIsOneTime(entry)

      // Sprint F.2: flags vêm do `financialType` quando o tenant cadastrou
      // os flags lá. Senão, cai pra catalogItem, depois pra entry (legado).
      const financialType =
        lookups?.financialTypes?.get(entry.financialTypeId) ?? null
      const catalogItem =
        lookups?.catalogItems?.get(entry.itemId) ?? null
      const flags = resolveEntryFlags(entry, financialType, catalogItem)

      if (flags.affectsRevenue) {
        if (oneTime) oneTimeRevenue += amount
        else recurringRevenue += amount
      }
      if (flags.affectsCost) {
        if (oneTime) oneTimeCost += amount
        else recurringCost += amount
      }
      if (flags.affectsInvestment) {
        investment += amount
      }
    }

    const grossRevenue = recurringRevenue + oneTimeRevenue
    const financial = grossRevenue * finRate
    const revenue = grossRevenue - financial
    const result = revenue - recurringCost - oneTimeCost - investment
    accum += result

    months.push({
      month,
      recurringRevenue,
      oneTimeRevenue,
      investment,
      recurringCost,
      oneTimeCost,
      financial,
      revenue,
      result,
      accum,
    })
  }

  return months
}

export function computeMetrics(cashFlow: CashFlowMonth[]): ProjectMetrics {
  let totalRecurringRevenue = 0
  let totalOneTimeRevenue = 0
  let totalInvestment = 0
  let totalRecurringCost = 0
  let totalOneTimeCost = 0
  let totalFinancial = 0
  let totalResult = 0
  let paybackMonth: number | null = null
  let peakAccum = 0
  let troughAccum = 0

  for (const m of cashFlow) {
    totalRecurringRevenue += m.recurringRevenue
    totalOneTimeRevenue += m.oneTimeRevenue
    totalInvestment += m.investment
    totalRecurringCost += m.recurringCost
    totalOneTimeCost += m.oneTimeCost
    totalFinancial += m.financial
    totalResult += m.result
    if (paybackMonth == null && m.accum >= 0 && m.month >= 1) {
      paybackMonth = m.month
    }
    if (m.accum > peakAccum) peakAccum = m.accum
    if (m.accum < troughAccum) troughAccum = m.accum
  }

  const totalRevenue =
    totalRecurringRevenue + totalOneTimeRevenue - totalFinancial
  const totalCost = totalInvestment + totalRecurringCost + totalOneTimeCost
  const margin = totalRevenue > 0 ? (totalResult / totalRevenue) * 100 : 0

  return {
    totalRecurringRevenue,
    totalOneTimeRevenue,
    totalRevenue,
    totalInvestment,
    totalRecurringCost,
    totalOneTimeCost,
    totalCost,
    totalFinancial,
    totalResult,
    margin,
    paybackMonth,
    peakAccum,
    troughAccum,
  }
}

export function readFinancialInputs(
  payload: RawPayload,
): ProjectFinancialInputs {
  return {
    prazo: Math.max(1, Math.floor(readNumber(payload, 'prazo', 36))),
    comissaoPct: Math.max(0, Math.min(100, readNumber(payload, 'finCom', 0))),
    impostosPct: Math.max(0, Math.min(100, readNumber(payload, 'finImp', 0))),
    margemMeta: readNumber(payload, 'finMeta', 0),
  }
}

export function writeFinancialInputs(
  payload: Record<string, unknown>,
  inputs: ProjectFinancialInputs,
): Record<string, unknown> {
  return {
    ...payload,
    prazo: inputs.prazo,
    finCom: inputs.comissaoPct,
    finImp: inputs.impostosPct,
    finMeta: inputs.margemMeta ?? 0,
  }
}
