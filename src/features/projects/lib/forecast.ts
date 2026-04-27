/**
 * Forecast mensal por projeto.
 *
 * Cada linha = 1 mês do horizonte do projeto.
 *  - expectedRevenue: vem do motor financeiro (buildCashFlow.revenue do mês)
 *  - actualRevenue:   preenchido manualmente pelo financeiro
 *  - paidStatus:      'pending' | 'paid' | 'overdue' | 'disputed'
 *  - note:            comentário livre por linha
 *
 * Persistido em payload.forecast (JSONB do projeto).
 */

import type { CashFlowMonth } from './financials'

export type PaidStatus = 'pending' | 'paid' | 'overdue' | 'disputed'

export type ForecastLine = {
  /** Mês 1-N do horizonte do projeto. */
  month: number
  /** Valor esperado calculado pelo motor (snapshot — pode ser recalculado). */
  expectedRevenue: number
  /** Valor de fato faturado/recebido naquele mês. */
  actualRevenue: number | null
  /** Status do pagamento. Só relevante quando actualRevenue != null. */
  paidStatus: PaidStatus
  /** Comentário livre. */
  note?: string
  /** Quem editou pela última vez essa linha. */
  updatedBy?: string
  updatedAt?: string
}

/**
 * Lê o forecast persistido do payload, mantendo apenas linhas dentro do
 * horizonte (`prazo`). Se faltar mês, gera linha vazia. Se sobrar mês
 * (prazo encolheu), mantém histórico das linhas com actual já preenchido
 * pra não perder dado, mas sinaliza no `month`.
 */
export function readForecast(
  payload: Record<string, unknown> | null | undefined,
  prazo: number,
): ForecastLine[] {
  const raw = (payload?.forecast as unknown[]) ?? []
  const existing = new Map<number, ForecastLine>()
  for (const r of raw) {
    const obj = r as Partial<ForecastLine>
    if (!Number.isFinite(obj.month)) continue
    existing.set(Number(obj.month), {
      month: Number(obj.month),
      expectedRevenue: Number(obj.expectedRevenue) || 0,
      actualRevenue:
        obj.actualRevenue == null || !Number.isFinite(Number(obj.actualRevenue))
          ? null
          : Number(obj.actualRevenue),
      paidStatus: (['pending', 'paid', 'overdue', 'disputed'] as PaidStatus[]).includes(
        obj.paidStatus as PaidStatus,
      )
        ? (obj.paidStatus as PaidStatus)
        : 'pending',
      note: typeof obj.note === 'string' ? obj.note : undefined,
      updatedBy: typeof obj.updatedBy === 'string' ? obj.updatedBy : undefined,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined,
    })
  }
  // Garante 1..prazo (se prazo encolheu, ainda guarda mês > prazo se tinha actual)
  const out: ForecastLine[] = []
  for (let m = 1; m <= prazo; m++) {
    out.push(
      existing.get(m) ?? {
        month: m,
        expectedRevenue: 0,
        actualRevenue: null,
        paidStatus: 'pending',
      },
    )
  }
  // Linhas extras (mês > prazo) que tem actualRevenue não-zero ficam preservadas.
  for (const [m, line] of existing) {
    if (m > prazo && line.actualRevenue) out.push(line)
  }
  return out.sort((a, b) => a.month - b.month)
}

/**
 * Recalcula `expectedRevenue` a partir do cash flow atual do motor
 * financeiro. Mantém actualRevenue e paidStatus existentes.
 */
export function syncExpectedFromCashFlow(
  current: ForecastLine[],
  cashFlow: CashFlowMonth[],
): ForecastLine[] {
  const map = new Map(current.map((l) => [l.month, l]))
  const out: ForecastLine[] = cashFlow.map((m) => {
    const existing = map.get(m.month)
    return {
      month: m.month,
      expectedRevenue: m.revenue,
      actualRevenue: existing?.actualRevenue ?? null,
      paidStatus: existing?.paidStatus ?? 'pending',
      note: existing?.note,
      updatedBy: existing?.updatedBy,
      updatedAt: existing?.updatedAt,
    }
  })
  // Preserva linhas extras (meses fora do horizonte) com actual preenchido
  for (const line of current) {
    if (!cashFlow.some((m) => m.month === line.month) && line.actualRevenue) {
      out.push(line)
    }
  }
  return out.sort((a, b) => a.month - b.month)
}

/** Sumário do forecast para KPIs. */
export type ForecastSummary = {
  totalExpected: number
  totalActual: number
  variance: number
  variancePct: number
  monthsClosed: number
  monthsPending: number
  monthsOverdue: number
  totalOverdue: number
}

export function summarizeForecast(lines: ForecastLine[]): ForecastSummary {
  let totalExpected = 0
  let totalActual = 0
  let monthsClosed = 0
  let monthsPending = 0
  let monthsOverdue = 0
  let totalOverdue = 0
  for (const l of lines) {
    totalExpected += l.expectedRevenue
    if (l.actualRevenue != null) {
      totalActual += l.actualRevenue
      if (l.paidStatus === 'paid') monthsClosed++
      if (l.paidStatus === 'pending' || l.paidStatus === 'disputed') monthsPending++
      if (l.paidStatus === 'overdue') {
        monthsOverdue++
        totalOverdue += l.actualRevenue
      }
    }
  }
  const variance = totalActual - totalExpected
  const variancePct = totalExpected > 0 ? (variance / totalExpected) * 100 : 0
  return {
    totalExpected,
    totalActual,
    variance,
    variancePct,
    monthsClosed,
    monthsPending,
    monthsOverdue,
    totalOverdue,
  }
}

export function serializeForecast(lines: ForecastLine[]) {
  return lines.map((l) => ({
    month: l.month,
    expectedRevenue: l.expectedRevenue,
    actualRevenue: l.actualRevenue,
    paidStatus: l.paidStatus,
    note: l.note,
    updatedBy: l.updatedBy,
    updatedAt: l.updatedAt,
  }))
}
