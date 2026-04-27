/**
 * Golden tests dos dois projetos sintéticos de paridade preservados em
 * produção (TESTE_PARIDADE_DELETE e TESTE_PARIDADE_DELETE_2).
 *
 * Cada teste reproduz o payload exato do backend (já migrado para
 * entryGroups) e verifica os números observados no /v2/Resumo. Se algum
 * dia esse arquivo quebrar, é regressão real — abrir o projeto correspondente
 * em produção e comparar visualmente.
 *
 * IDs de produção:
 *   - TESTE_PARIDADE_DELETE   → ctr_e31dd8cda92c469f8d69df05ad96d2e2
 *   - TESTE_PARIDADE_DELETE_2 → ctr_1959230726404fc98e90c81912442ae8
 */

import { describe, expect, it } from 'vitest'

import { buildCashFlow, computeMetrics } from '../financials'

describe('Golden test 1 — TESTE_PARIDADE_DELETE (cenário simples, prazo 12)', () => {
  const payload = {
    prazo: 12,
    finCom: 5,
    finImp: 10,
    entryGroups: [
      {
        id: 'a',
        title: 'Licenças HW (legado)',
        accent: '#2563eb',
        isRevenue: true,
        rows: [{ item: 'Receita Mensal A', qtd: 1, val: 10000, desc: 0, inicio: 1 }],
      },
      {
        id: 'b',
        title: 'CAPEX (legado)',
        accent: '#7c3aed',
        isRevenue: false,
        rows: [{ item: 'Investimento', qtd: 1, val: 5000, desc: 0, inicio: 1, duracao: 12 }],
      },
      {
        id: 'c',
        title: 'COGS (legado)',
        accent: '#dc2626',
        isRevenue: false,
        rows: [{ item: 'Custo Operacional', qtd: 1, val: 2000, desc: 0, inicio: 2 }],
      },
    ],
  }
  const flow = buildCashFlow(payload, { prazo: 12, comissaoPct: 5, impostosPct: 10 })
  const m = computeMetrics(flow)

  it('totais batem com o /v2/Resumo de produção', () => {
    expect(m.totalRecurringRevenue).toBe(120000)
    expect(m.totalOneTimeRevenue).toBe(0)
    expect(m.totalFinancial).toBeCloseTo(18000, 6)
    expect(m.totalRevenue).toBeCloseTo(102000, 6)
    expect(m.totalCost).toBe(82000)
    expect(m.totalResult).toBeCloseTo(20000, 6)
    expect(m.margin).toBeCloseTo(19.6078, 3)
  })

  it('payback no mês 1 (custo do mês 1 = 5000, revenue líq = 8500)', () => {
    expect(m.paybackMonth).toBe(1)
    expect(m.troughAccum).toBe(0) // nunca fica negativo
    expect(m.peakAccum).toBe(20000) // accum final
  })

  it('cash flow mês a mês — janela do COGS respeitada (inicio=2)', () => {
    // Mês 1: só CAPEX (5000)
    expect(flow[0].recurringCost + flow[0].oneTimeCost).toBe(5000)
    expect(flow[0].result).toBeCloseTo(3500, 6)
    // Mês 2..12: CAPEX + COGS = 7000
    for (let i = 1; i < 12; i++) {
      expect(flow[i].recurringCost + flow[i].oneTimeCost).toBe(7000)
      expect(flow[i].result).toBeCloseTo(1500, 6)
    }
  })
})

describe('Golden test 2 — TESTE_PARIDADE_DELETE_2 (cenário complexo, prazo 24)', () => {
  // Payload pós-migração equivalente ao que está em produção.
  // mob com mobParcelas=1 vira duracao=1 (one-time). srvRev é one-time mês 1.
  const payload = {
    prazo: 24,
    finCom: 3,
    finImp: 12,
    entryGroups: [
      {
        id: 'a',
        title: 'Licenças HW (legado)',
        accent: '#2563eb',
        isRevenue: true,
        rows: [{ item: 'Plano com desconto', qtd: 1, val: 8000, desc: 20, inicio: 1 }],
      },
      {
        id: 'b',
        title: 'Mobilização (legado)',
        accent: '#f59e0b',
        isRevenue: false,
        rows: [{ item: 'Setup imediato', qtd: 1, val: 30000, desc: 0, inicio: 1, duracao: 1 }],
      },
      {
        id: 'c',
        title: 'CAPEX (legado)',
        accent: '#7c3aed',
        isRevenue: false,
        rows: [{ item: 'Investimento', qtd: 1, val: 2000, desc: 0, inicio: 1, duracao: 12 }],
      },
      {
        id: 'd',
        title: 'COGS (legado)',
        accent: '#dc2626',
        isRevenue: false,
        rows: [{ item: 'Operação tardia', qtd: 1, val: 1500, desc: 0, inicio: 4 }],
      },
      {
        id: 'e',
        title: 'Receita de Serviços (legado)',
        accent: '#16a34a',
        isRevenue: true,
        rows: [{ item: 'Implantação', qtd: 1, val: 15000, desc: 0, inicio: 1, duracao: 1 }],
      },
    ],
  }
  const flow = buildCashFlow(payload, { prazo: 24, comissaoPct: 3, impostosPct: 12 })
  const m = computeMetrics(flow)

  it('totais batem com o /v2/Resumo de produção', () => {
    // Receita: 6400/mês × 24 recorrente + 15000 one-time mês 1 = 153600 + 15000 = 168600 bruto
    expect(m.totalRecurringRevenue).toBe(6400 * 24)
    expect(m.totalOneTimeRevenue).toBe(15000)
    expect(m.totalFinancial).toBeCloseTo(25290, 6) // 15% × 168600
    expect(m.totalRevenue).toBeCloseTo(143310, 6)
    // Custo: mob 30000 + capex 24000 + cogs 31500 = 85500
    expect(m.totalOneTimeCost).toBe(30000)
    expect(m.totalRecurringCost).toBe(24000 + 31500)
    expect(m.totalCost).toBe(85500)
    expect(m.totalResult).toBeCloseTo(57810, 6)
    expect(m.margin).toBeCloseTo(40.339, 2)
  })

  it('payback realista: mês 7 (acumulado fica positivo após zona vermelha)', () => {
    expect(m.paybackMonth).toBe(7)
    expect(m.troughAccum).toBeCloseTo(-13810, 6)
    expect(m.peakAccum).toBeCloseTo(57810, 6)
  })

  it('mês 1: receita one-time + recorrente, custo one-time + capex', () => {
    const m1 = flow[0]
    expect(m1.recurringRevenue).toBe(6400)
    expect(m1.oneTimeRevenue).toBe(15000)
    expect(m1.financial).toBeCloseTo(3210, 6) // 15% × 21400
    expect(m1.revenue).toBeCloseTo(18190, 6)
    expect(m1.oneTimeCost).toBe(30000)
    expect(m1.recurringCost).toBe(2000) // só CAPEX
    expect(m1.result).toBeCloseTo(-13810, 6)
    expect(m1.accum).toBeCloseTo(-13810, 6)
  })

  it('mês 2-3: capex apenas (cogs ainda não começou)', () => {
    for (const mes of [flow[1], flow[2]]) {
      expect(mes.recurringRevenue).toBe(6400)
      expect(mes.oneTimeRevenue).toBe(0)
      expect(mes.recurringCost).toBe(2000)
      expect(mes.oneTimeCost).toBe(0)
      expect(mes.result).toBeCloseTo(3440, 6) // 5440 - 2000
    }
  })

  it('mês 4-12: capex + cogs (cogs ativa do mês 4)', () => {
    for (let i = 3; i < 12; i++) {
      expect(flow[i].recurringCost).toBe(3500) // 2000 + 1500
      expect(flow[i].result).toBeCloseTo(1940, 6) // 5440 - 3500
    }
  })

  it('mês 13-24: só cogs (capex acabou após mês 12)', () => {
    for (let i = 12; i < 24; i++) {
      expect(flow[i].recurringCost).toBe(1500)
      expect(flow[i].result).toBeCloseTo(3940, 6) // 5440 - 1500
    }
  })
})
