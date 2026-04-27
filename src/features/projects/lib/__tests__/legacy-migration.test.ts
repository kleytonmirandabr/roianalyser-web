/**
 * Testes de migração de payload vanilla → entryGroups.
 *
 * Cada categoria do app antigo (licHw, mob, capex, cogs, tech, ana, srvRev,
 * srvCost) é convertida pra um EntryGroup equivalente. Esses testes
 * garantem que a conversão preserva a semântica financeira (recorrência,
 * inicio/duracao, qtd × val × desc).
 */

import { describe, expect, it } from 'vitest'

import { hasLegacyData, migrateLegacyPayload } from '../legacy-migration'

describe('hasLegacyData', () => {
  it('retorna false para payload vazio ou já migrado', () => {
    expect(hasLegacyData(null)).toBe(false)
    expect(hasLegacyData({})).toBe(false)
    expect(hasLegacyData({ _migratedAt: '2026-01-01' })).toBe(false)
    expect(hasLegacyData({ licHw: [] })).toBe(false) // array vazio = sem dados
  })

  it('retorna true quando ao menos uma categoria tem dados', () => {
    expect(hasLegacyData({ licHw: [{ qtd: 1 }] })).toBe(true)
    expect(hasLegacyData({ srvRev: [{ val: 100 }] })).toBe(true)
  })

  it('ignora dados quando _migratedAt estiver setado', () => {
    expect(
      hasLegacyData({ _migratedAt: '2026-01-01', licHw: [{ qtd: 1 }] }),
    ).toBe(false)
  })
})

describe('migrateLegacyPayload — idempotência', () => {
  it('não migra de novo quando _migratedAt já está setado', () => {
    const payload = {
      _migratedAt: '2026-01-01',
      licHw: [{ qtd: 1, val: 100 }],
    }
    const result = migrateLegacyPayload(payload)
    expect(result.alreadyMigrated).toBe(true)
    expect(result.groupsCreated).toBe(0)
    expect(result.payload).toBe(payload) // mesmo objeto, sem mexer
  })

  it('marca _migratedAt mesmo quando não há dados pra migrar', () => {
    const result = migrateLegacyPayload({ description: 'projeto vazio' })
    expect(result.alreadyMigrated).toBe(false)
    expect(result.groupsCreated).toBe(0)
    expect(result.payload._migratedAt).toBeTypeOf('string')
  })

  it('não apaga campos legados após migrar (vanilla continua funcionando)', () => {
    const result = migrateLegacyPayload({
      licHw: [{ item: 'A', qtd: 1, val: 100, desc: 0 }],
    })
    expect(result.payload.licHw).toEqual([
      { item: 'A', qtd: 1, val: 100, desc: 0 },
    ])
    expect(Array.isArray(result.payload.entryGroups)).toBe(true)
  })
})

describe('migrateLegacyPayload — categorias individuais', () => {
  it('licHw → receita recorrente desde mês 1', () => {
    const result = migrateLegacyPayload({
      licHw: [{ item: 'Plano Basic', qtd: 2, val: 500, desc: 10 }],
    })
    expect(result.detected).toContain('licHw')
    const groups = result.payload.entryGroups as Array<{
      title: string
      isRevenue: boolean
      rows: Array<{ qtd: number; val: number; desc: number; inicio?: number; duracao?: number }>
    }>
    const lic = groups.find((g) => g.title === 'Licenças HW (legado)')
    expect(lic).toBeDefined()
    expect(lic!.isRevenue).toBe(true)
    expect(lic!.rows[0]).toMatchObject({
      qtd: 2,
      val: 500,
      desc: 10,
      inicio: 1,
    })
    // duracao omitida = recorrente até o fim do prazo
    expect(lic!.rows[0].duracao).toBeUndefined()
  })

  it('mob → custo distribuído em mobParcelas a partir de mobMes', () => {
    const result = migrateLegacyPayload({
      mob: [{ item: 'Mob A', qtd: 2, val: 6000 }],
      mobMes: 3,
      mobParcelas: 4,
    })
    const groups = result.payload.entryGroups as Array<{
      title: string
      rows: Array<{ qtd: number; val: number; inicio?: number; duracao?: number }>
    }>
    const mob = groups.find((g) => g.title === 'Mobilização (legado)')
    expect(mob).toBeDefined()
    // 2 × 6000 = 12000 total, dividido em 4 parcelas = 3000 por parcela
    expect(mob!.rows[0].qtd).toBe(1)
    expect(mob!.rows[0].val).toBe(3000)
    expect(mob!.rows[0].inicio).toBe(3)
    expect(mob!.rows[0].duracao).toBe(4)
  })

  it('capex → custo amortizado em capexMeses', () => {
    const result = migrateLegacyPayload({
      capex: [{ item: 'Servidor', qtd: 1, val: 60000 }],
      capexMeses: 12,
    })
    const groups = result.payload.entryGroups as Array<{
      title: string
      rows: Array<{ qtd: number; val: number; inicio?: number; duracao?: number }>
    }>
    const cap = groups.find((g) => g.title === 'CAPEX (legado)')
    expect(cap).toBeDefined()
    // 60000 / 12 = 5000 por mês durante 12 meses, desde mês 1
    expect(cap!.rows[0]).toMatchObject({
      qtd: 1,
      val: 5000,
      inicio: 1,
      duracao: 12,
    })
  })

  it('capex usa default de capexMeses=12 quando ausente', () => {
    const result = migrateLegacyPayload({
      capex: [{ qtd: 1, val: 12000 }],
    })
    const groups = result.payload.entryGroups as Array<{
      title: string
      rows: Array<{ val: number; duracao?: number }>
    }>
    const cap = groups.find((g) => g.title === 'CAPEX (legado)')
    expect(cap!.rows[0].val).toBe(1000) // 12000 / 12
    expect(cap!.rows[0].duracao).toBe(12)
  })

  it('cogs → custo recorrente com inicio por linha', () => {
    const result = migrateLegacyPayload({
      cogs: [
        { item: 'Aluguel', qtd: 1, val: 2000, inicio: 2 },
        { item: 'Energia', qtd: 1, val: 500 }, // sem inicio = default 1
      ],
    })
    const groups = result.payload.entryGroups as Array<{
      title: string
      rows: Array<{ val: number; inicio?: number; duracao?: number }>
    }>
    const c = groups.find((g) => g.title === 'COGS (legado)')
    expect(c!.rows).toHaveLength(2)
    expect(c!.rows[0].inicio).toBe(2)
    expect(c!.rows[1].inicio).toBe(1)
    // Ambos recorrentes (sem duracao)
    expect(c!.rows[0].duracao).toBeUndefined()
    expect(c!.rows[1].duracao).toBeUndefined()
  })

  it('tech → custo recorrente em janela [opTechIni, opTechIni+opTechDur)', () => {
    const result = migrateLegacyPayload({
      tech: [{ item: 'Engenheiro', val: 8000 }],
      opTechQtd: 2,
      opTechIni: 4,
      opTechDur: 6,
    })
    const groups = result.payload.entryGroups as Array<{
      title: string
      rows: Array<{ qtd: number; val: number; inicio?: number; duracao?: number }>
    }>
    const t = groups.find((g) => g.title === 'Técnico (legado)')
    expect(t!.rows[0]).toMatchObject({
      qtd: 2,
      val: 8000,
      inicio: 4,
      duracao: 6,
    })
  })

  it('tech sem opTechDur=0 não é migrado (não há janela ativa)', () => {
    const result = migrateLegacyPayload({
      tech: [{ val: 1000 }],
      opTechDur: 0,
    })
    expect(result.detected).not.toContain('tech')
  })

  it('srvRev → receita por serviço com val × duracao a partir de inicio', () => {
    const result = migrateLegacyPayload({
      srvRev: [
        { item: 'Consultoria', val: 5000, inicio: 1, duracao: 6 },
        { item: 'Implantação', val: 10000, inicio: 7, duracao: 1 }, // one-time
      ],
    })
    const groups = result.payload.entryGroups as Array<{
      title: string
      isRevenue: boolean
      rows: Array<{ val: number; inicio?: number; duracao?: number }>
    }>
    const s = groups.find((g) => g.title === 'Receita de Serviços (legado)')
    expect(s!.isRevenue).toBe(true)
    expect(s!.rows[0]).toMatchObject({
      val: 5000,
      inicio: 1,
      duracao: 6,
    })
    expect(s!.rows[1]).toMatchObject({
      val: 10000,
      inicio: 7,
      duracao: 1,
    })
  })

  it('srvCost → custo por serviço (mesmo formato de srvRev)', () => {
    const result = migrateLegacyPayload({
      srvCost: [{ item: 'Suporte', val: 1500, inicio: 2, duracao: 10 }],
    })
    const groups = result.payload.entryGroups as Array<{
      title: string
      isRevenue: boolean
      rows: Array<{ val: number; inicio?: number; duracao?: number }>
    }>
    const s = groups.find((g) => g.title === 'Custos de Serviços (legado)')
    expect(s!.isRevenue).toBe(false)
    expect(s!.rows[0]).toMatchObject({
      val: 1500,
      inicio: 2,
      duracao: 10,
    })
  })
})

describe('migrateLegacyPayload — payload completo', () => {
  it('migra todos os 8 campos legados num único payload', () => {
    const result = migrateLegacyPayload({
      licHw: [{ item: 'Plano', qtd: 1, val: 100 }],
      mob: [{ item: 'Mob', qtd: 1, val: 200 }],
      mobMes: 1,
      mobParcelas: 2,
      capex: [{ item: 'CX', qtd: 1, val: 1200 }],
      capexMeses: 12,
      cogs: [{ item: 'C', qtd: 1, val: 50 }],
      tech: [{ val: 80 }],
      opTechDur: 12,
      ana: [{ val: 60 }],
      opAnaDur: 6,
      srvRev: [{ val: 500, inicio: 1, duracao: 3 }],
      srvCost: [{ val: 200, inicio: 1, duracao: 3 }],
    })
    expect(result.detected).toEqual([
      'licHw',
      'mob',
      'capex',
      'cogs',
      'tech',
      'ana',
      'srvRev',
      'srvCost',
    ])
    expect(result.groupsCreated).toBe(8)
    const groups = result.payload.entryGroups as unknown[]
    expect(groups).toHaveLength(8)
  })

  it('preserva entryGroups que já existirem (não duplica/sobrescreve)', () => {
    const existing = {
      id: 'eg_pre',
      title: 'Já existia',
      accent: '#000',
      isRevenue: true,
      rows: [{ item: 'x', qtd: 1, val: 10, desc: 0 }],
    }
    const result = migrateLegacyPayload({
      entryGroups: [existing],
      licHw: [{ qtd: 1, val: 100 }],
    })
    const groups = result.payload.entryGroups as Array<{ title: string }>
    expect(groups[0].title).toBe('Já existia')
    expect(groups.some((g) => g.title === 'Licenças HW (legado)')).toBe(true)
    expect(groups).toHaveLength(2)
  })
})
