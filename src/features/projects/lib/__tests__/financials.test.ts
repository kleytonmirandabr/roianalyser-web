/**
 * Testes do motor financeiro. Cobre os cenários críticos de paridade com
 * o app vanilla — qualquer divergência aqui significa que números mostrados
 * pro usuário no /v2/ vão diferir do app antigo.
 *
 * Sempre que ajustar `buildCashFlow` ou `computeMetrics`, rodar
 * `npm test` antes do deploy.
 */

import { describe, expect, it } from 'vitest'

import {
  buildCashFlow,
  computeMetrics,
  readFinancialInputs,
  writeFinancialInputs,
} from '../financials'

/** Helper: monta um payload mínimo com entryGroups. */
function payloadWith(groups: unknown[], extras: Record<string, unknown> = {}) {
  return { entryGroups: groups, ...extras }
}

/** Helper: row com inicio/duracao explícitos (default = 1, recorrente até o fim). */
function row(opts: {
  qtd: number
  val: number
  desc?: number
  inicio?: number
  duracao?: number
}) {
  return {
    item: 'x',
    qtd: opts.qtd,
    val: opts.val,
    desc: opts.desc ?? 0,
    inicio: opts.inicio,
    duracao: opts.duracao,
  }
}

describe('readFinancialInputs', () => {
  it('aplica defaults sensatos quando o payload está vazio', () => {
    const inputs = readFinancialInputs(null)
    expect(inputs.prazo).toBe(36)
    expect(inputs.comissaoPct).toBe(0)
    expect(inputs.impostosPct).toBe(0)
    expect(inputs.margemMeta).toBe(0)
  })

  it('lê chaves vanilla (prazo/finCom/finImp/finMeta) do payload', () => {
    const inputs = readFinancialInputs({
      prazo: 24,
      finCom: 5,
      finImp: 10.5,
      finMeta: 30,
    })
    expect(inputs).toEqual({
      prazo: 24,
      comissaoPct: 5,
      impostosPct: 10.5,
      margemMeta: 30,
    })
  })

  it('clampa percentuais inválidos para 0..100', () => {
    expect(readFinancialInputs({ finCom: -5, finImp: 200 })).toMatchObject({
      comissaoPct: 0,
      impostosPct: 100,
    })
  })

  it('garante prazo ≥ 1 mesmo com lixo', () => {
    expect(readFinancialInputs({ prazo: 0 }).prazo).toBe(1)
    expect(readFinancialInputs({ prazo: 'abc' }).prazo).toBe(36) // fallback
  })
})

describe('writeFinancialInputs', () => {
  it('preserva campos não-financeiros do payload', () => {
    const out = writeFinancialInputs(
      { description: 'foo', entryGroups: [] },
      {
        prazo: 12,
        comissaoPct: 4,
        impostosPct: 6,
        margemMeta: 25,
      },
    )
    expect(out.description).toBe('foo')
    expect(out.entryGroups).toEqual([])
    expect(out.prazo).toBe(12)
    expect(out.finCom).toBe(4)
    expect(out.finImp).toBe(6)
    expect(out.finMeta).toBe(25)
  })

  it('grava 0 quando margemMeta é omitida', () => {
    const out = writeFinancialInputs(
      {},
      { prazo: 1, comissaoPct: 0, impostosPct: 0 },
    )
    expect(out.finMeta).toBe(0)
  })
})

describe('buildCashFlow — caso vazio', () => {
  it('retorna array do tamanho do prazo com zeros quando não há entradas', () => {
    const flow = buildCashFlow(null, {
      prazo: 6,
      comissaoPct: 0,
      impostosPct: 0,
    })
    expect(flow).toHaveLength(6)
    expect(flow[0]).toMatchObject({
      month: 1,
      recurringRevenue: 0,
      oneTimeRevenue: 0,
      recurringCost: 0,
      oneTimeCost: 0,
      financial: 0,
      revenue: 0,
      result: 0,
      accum: 0,
    })
  })
})

describe('buildCashFlow — receita recorrente', () => {
  it('soma receita recorrente em todos os meses do prazo', () => {
    // Receita de 1000/mês recorrente até o fim, prazo 12, sem comissão/imposto.
    const payload = payloadWith([
      {
        id: 'g1',
        title: 'Mensalidades',
        accent: '#000',
        isRevenue: true,
        rows: [row({ qtd: 1, val: 1000, inicio: 1 })],
      },
    ])
    const flow = buildCashFlow(payload, {
      prazo: 12,
      comissaoPct: 0,
      impostosPct: 0,
    })
    expect(flow).toHaveLength(12)
    flow.forEach((m) => {
      expect(m.recurringRevenue).toBe(1000)
      expect(m.oneTimeRevenue).toBe(0)
      expect(m.financial).toBe(0)
      expect(m.revenue).toBe(1000)
      expect(m.result).toBe(1000)
    })
    expect(flow[11].accum).toBe(12000)
  })
})

describe('buildCashFlow — receita one-time (duracao=1)', () => {
  it('lança valor apenas no mês de inicio quando duracao=1', () => {
    const payload = payloadWith([
      {
        id: 'g1',
        title: 'Setup',
        accent: '#000',
        isRevenue: true,
        rows: [row({ qtd: 1, val: 5000, inicio: 3, duracao: 1 })],
      },
    ])
    const flow = buildCashFlow(payload, {
      prazo: 6,
      comissaoPct: 0,
      impostosPct: 0,
    })
    expect(flow[0].oneTimeRevenue).toBe(0) // mês 1
    expect(flow[1].oneTimeRevenue).toBe(0) // mês 2
    expect(flow[2].oneTimeRevenue).toBe(5000) // mês 3 = inicio
    expect(flow[3].oneTimeRevenue).toBe(0)
    expect(flow[2].recurringRevenue).toBe(0) // não conta como recorrente
  })
})

describe('buildCashFlow — comissão + impostos', () => {
  it('aplica (com+imp)% sobre receita bruta total', () => {
    const payload = payloadWith([
      {
        id: 'g1',
        title: 'Receita',
        accent: '#000',
        isRevenue: true,
        rows: [row({ qtd: 1, val: 1000, inicio: 1 })],
      },
    ])
    const flow = buildCashFlow(payload, {
      prazo: 1,
      comissaoPct: 5, // 5% comissão
      impostosPct: 10, // 10% imposto
    })
    expect(flow[0].recurringRevenue).toBe(1000)
    expect(flow[0].financial).toBeCloseTo(150, 6) // 15% × 1000
    expect(flow[0].revenue).toBeCloseTo(850, 6) // 1000 − 150
    expect(flow[0].result).toBeCloseTo(850, 6)
  })

  it('financial=0 quando não há receita (custos não tributam)', () => {
    const payload = payloadWith([
      {
        id: 'g1',
        title: 'Custo',
        accent: '#000',
        isRevenue: false,
        rows: [row({ qtd: 1, val: 500, inicio: 1 })],
      },
    ])
    const flow = buildCashFlow(payload, {
      prazo: 1,
      comissaoPct: 50,
      impostosPct: 50,
    })
    expect(flow[0].financial).toBe(0)
    expect(flow[0].recurringCost).toBe(500)
    expect(flow[0].result).toBe(-500)
  })
})

describe('buildCashFlow — duração com janela', () => {
  it('ativa apenas em [inicio, inicio+duracao)', () => {
    const payload = payloadWith([
      {
        id: 'g1',
        title: 'Aluguel',
        accent: '#000',
        isRevenue: false,
        rows: [row({ qtd: 1, val: 100, inicio: 2, duracao: 3 })],
      },
    ])
    const flow = buildCashFlow(payload, {
      prazo: 6,
      comissaoPct: 0,
      impostosPct: 0,
    })
    expect(flow[0].recurringCost).toBe(0) // mês 1
    expect(flow[1].recurringCost).toBe(100) // mês 2 (inicio)
    expect(flow[2].recurringCost).toBe(100) // mês 3
    expect(flow[3].recurringCost).toBe(100) // mês 4 (último: 2+3-1=4)
    expect(flow[4].recurringCost).toBe(0) // mês 5
  })
})

describe('buildCashFlow — desconto na linha', () => {
  it('aplica desc% por linha: total = qtd × val × (1 − desc/100)', () => {
    const payload = payloadWith([
      {
        id: 'g1',
        title: 'Receita c/ desconto',
        accent: '#000',
        isRevenue: true,
        rows: [row({ qtd: 2, val: 1000, desc: 25, inicio: 1 })],
      },
    ])
    const flow = buildCashFlow(payload, {
      prazo: 1,
      comissaoPct: 0,
      impostosPct: 0,
    })
    // 2 × 1000 × 0.75 = 1500
    expect(flow[0].recurringRevenue).toBe(1500)
  })
})

describe('computeMetrics — payback e acumulado', () => {
  it('detecta payback no primeiro mês em que accum ≥ 0', () => {
    // Investimento de -1000 no mês 1, receita de +600/mês a partir do mês 2.
    // accum: -1000, -400, +200 → payback no mês 3.
    const payload = payloadWith([
      {
        id: 'inv',
        title: 'Investimento',
        accent: '#000',
        isRevenue: false,
        rows: [row({ qtd: 1, val: 1000, inicio: 1, duracao: 1 })],
      },
      {
        id: 'rec',
        title: 'Mensalidades',
        accent: '#000',
        isRevenue: true,
        rows: [row({ qtd: 1, val: 600, inicio: 2 })],
      },
    ])
    const flow = buildCashFlow(payload, {
      prazo: 5,
      comissaoPct: 0,
      impostosPct: 0,
    })
    const metrics = computeMetrics(flow)
    expect(flow.map((m) => m.accum)).toEqual([-1000, -400, 200, 800, 1400])
    expect(metrics.paybackMonth).toBe(3)
    expect(metrics.peakAccum).toBe(1400)
    expect(metrics.troughAccum).toBe(-1000)
  })

  it('paybackMonth = null quando o acumulado nunca fica positivo', () => {
    const payload = payloadWith([
      {
        id: 'c',
        title: 'Custo permanente',
        accent: '#000',
        isRevenue: false,
        rows: [row({ qtd: 1, val: 100, inicio: 1 })],
      },
    ])
    const flow = buildCashFlow(payload, {
      prazo: 6,
      comissaoPct: 0,
      impostosPct: 0,
    })
    const metrics = computeMetrics(flow)
    expect(metrics.paybackMonth).toBeNull()
    expect(metrics.troughAccum).toBe(-600)
    expect(metrics.peakAccum).toBe(0)
  })
})

describe('computeMetrics — totais agregados', () => {
  it('soma totalRevenue como bruta − financial e calcula margem corretamente', () => {
    const payload = payloadWith([
      {
        id: 'r',
        title: 'Receita',
        accent: '#000',
        isRevenue: true,
        rows: [row({ qtd: 1, val: 1000, inicio: 1 })],
      },
      {
        id: 'c',
        title: 'Custo',
        accent: '#000',
        isRevenue: false,
        rows: [row({ qtd: 1, val: 300, inicio: 1 })],
      },
    ])
    const flow = buildCashFlow(payload, {
      prazo: 12,
      comissaoPct: 10,
      impostosPct: 0,
    })
    const m = computeMetrics(flow)
    // Bruto: 12 × 1000 = 12000. Financial 10% = 1200. Líquida = 10800.
    expect(m.totalRecurringRevenue).toBe(12000)
    expect(m.totalFinancial).toBeCloseTo(1200, 6)
    expect(m.totalRevenue).toBeCloseTo(10800, 6)
    // Custo: 12 × 300 = 3600.
    expect(m.totalCost).toBe(3600)
    // Resultado: 10800 - 3600 = 7200. Margem: 7200/10800 ≈ 66.67%.
    expect(m.totalResult).toBeCloseTo(7200, 6)
    expect(m.margin).toBeCloseTo(66.6667, 3)
  })

  it('margin = 0 quando totalRevenue ≤ 0 (evita divisão por zero)', () => {
    const flow = buildCashFlow(null, {
      prazo: 3,
      comissaoPct: 0,
      impostosPct: 0,
    })
    const m = computeMetrics(flow)
    expect(m.totalRevenue).toBe(0)
    expect(m.margin).toBe(0)
  })
})
