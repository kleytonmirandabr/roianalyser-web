/**
 * Testes unitários do módulo payload-rows.
 *
 * Cobre construção de rows, totalização (rowTotal, entriesTotal), leitura
 * tolerante a payloads antigos (readEntryRows) e serialização sem __key
 * interno (serializeEntryRows).
 */

import { describe, expect, it } from 'vitest'

import {
  entriesTotal,
  makeEntryRow,
  readEntryRows,
  rowTotal,
  serializeEntryRows,
} from '../payload-rows'

describe('makeEntryRow', () => {
  it('cria row com defaults quando nada é passado', () => {
    const r = makeEntryRow()
    expect(r.item).toBe('')
    expect(r.qtd).toBe(0)
    expect(r.val).toBe(0)
    expect(r.desc).toBe(0)
    expect(r.inicio).toBeUndefined()
    expect(r.duracao).toBeUndefined()
    expect(r.__key).toMatch(/^row_/)
  })

  it('aceita parciais e preserva __key único entre rows', () => {
    const r1 = makeEntryRow({ item: 'A', qtd: 2 })
    const r2 = makeEntryRow({ item: 'B', qtd: 3 })
    expect(r1.item).toBe('A')
    expect(r1.qtd).toBe(2)
    expect(r2.item).toBe('B')
    expect(r1.__key).not.toBe(r2.__key)
  })

  it('clampa desc no range 0..100', () => {
    expect(makeEntryRow({ desc: -5 }).desc).toBe(0)
    expect(makeEntryRow({ desc: 150 }).desc).toBe(100)
    expect(makeEntryRow({ desc: 25 }).desc).toBe(25)
  })

  it('preserva inicio e duracao quando explícitos', () => {
    const r = makeEntryRow({ inicio: 5, duracao: 3 })
    expect(r.inicio).toBe(5)
    expect(r.duracao).toBe(3)
  })

  it('NÃO seta inicio/duracao quando undefined explícito', () => {
    const r = makeEntryRow({ inicio: undefined, duracao: undefined })
    expect(r).not.toHaveProperty('inicio')
    expect(r).not.toHaveProperty('duracao')
  })
})

describe('rowTotal', () => {
  it('calcula qty × val × (1 - desc/100)', () => {
    expect(rowTotal(makeEntryRow({ qtd: 1, val: 1000 }))).toBe(1000)
    expect(rowTotal(makeEntryRow({ qtd: 2, val: 500 }))).toBe(1000)
    expect(rowTotal(makeEntryRow({ qtd: 1, val: 1000, desc: 25 }))).toBe(750)
    expect(rowTotal(makeEntryRow({ qtd: 4, val: 250, desc: 10 }))).toBe(900)
  })

  it('retorna 0 quando qtd ou val são 0', () => {
    expect(rowTotal(makeEntryRow({ qtd: 0, val: 1000 }))).toBe(0)
    expect(rowTotal(makeEntryRow({ qtd: 5, val: 0 }))).toBe(0)
  })

  it('lida com desc=100 (zera o total)', () => {
    expect(rowTotal(makeEntryRow({ qtd: 1, val: 1000, desc: 100 }))).toBe(0)
  })

  it('lida com valores não-finitos (NaN, Infinity) tratando como 0', () => {
    const r1 = { __key: 'k1', item: 'x', qtd: NaN, val: 100, desc: 0 }
    const r2 = { __key: 'k2', item: 'x', qtd: 1, val: Infinity, desc: 0 }
    expect(rowTotal(r1)).toBe(0)
    expect(rowTotal(r2)).toBe(0)
  })
})

describe('entriesTotal', () => {
  it('soma rowTotal de várias linhas', () => {
    const rows = [
      makeEntryRow({ qtd: 1, val: 1000 }),
      makeEntryRow({ qtd: 2, val: 500 }),
      makeEntryRow({ qtd: 1, val: 200, desc: 50 }),
    ]
    expect(entriesTotal(rows)).toBe(1000 + 1000 + 100)
  })

  it('retorna 0 para array vazio', () => {
    expect(entriesTotal([])).toBe(0)
  })
})

describe('readEntryRows — tolerância a payloads antigos', () => {
  it('retorna [] quando payload é null/undefined ou key não existe', () => {
    expect(readEntryRows(null, 'cogs')).toEqual([])
    expect(readEntryRows(undefined, 'cogs')).toEqual([])
    expect(readEntryRows({}, 'cogs')).toEqual([])
    expect(readEntryRows({ outraKey: [] }, 'cogs')).toEqual([])
  })

  it('retorna [] quando o valor não é array', () => {
    expect(readEntryRows({ cogs: 'not-array' }, 'cogs')).toEqual([])
    expect(readEntryRows({ cogs: 42 }, 'cogs')).toEqual([])
  })

  it('lê rows mantendo item/qtd/val/desc', () => {
    const rows = readEntryRows(
      { cogs: [{ item: 'A', qtd: 2, val: 100, desc: 5 }] },
      'cogs',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ item: 'A', qtd: 2, val: 100, desc: 5 })
  })

  it('preserva inicio e duracao quando presentes', () => {
    const rows = readEntryRows(
      { cogs: [{ qtd: 1, val: 100, inicio: 3, duracao: 6 }] },
      'cogs',
    )
    expect(rows[0].inicio).toBe(3)
    expect(rows[0].duracao).toBe(6)
  })

  it('aceita strings numéricas', () => {
    const rows = readEntryRows(
      { cogs: [{ qtd: '2', val: '500', desc: '10' }] },
      'cogs',
    )
    expect(rows[0]).toMatchObject({ qtd: 2, val: 500, desc: 10 })
  })

  it('coerce campos faltantes para defaults seguros', () => {
    const rows = readEntryRows({ cogs: [{}] }, 'cogs')
    expect(rows[0].item).toBe('')
    expect(rows[0].qtd).toBe(0)
    expect(rows[0].val).toBe(0)
    expect(rows[0].desc).toBe(0)
  })
})

describe('serializeEntryRows — formato de persistência', () => {
  it('remove __key (interno do React) ao serializar', () => {
    const rows = [makeEntryRow({ item: 'A', qtd: 1, val: 100 })]
    const serialized = serializeEntryRows(rows)
    expect(serialized[0]).not.toHaveProperty('__key')
    expect(serialized[0]).toMatchObject({ item: 'A', qtd: 1, val: 100, desc: 0 })
  })

  it('inclui inicio/duracao apenas quando setados', () => {
    const rows = [
      makeEntryRow({ item: 'A', qtd: 1, val: 100 }),
      makeEntryRow({ item: 'B', qtd: 1, val: 100, inicio: 5, duracao: 3 }),
    ]
    const serialized = serializeEntryRows(rows)
    expect(serialized[0]).not.toHaveProperty('inicio')
    expect(serialized[0]).not.toHaveProperty('duracao')
    expect(serialized[1]).toMatchObject({ inicio: 5, duracao: 3 })
  })

  it('round-trip: makeEntryRow → serialize → readEntryRows preserva tudo', () => {
    const original = [
      makeEntryRow({ item: 'A', qtd: 2, val: 1000, desc: 10, inicio: 3, duracao: 6 }),
      makeEntryRow({ item: 'B', qtd: 1, val: 500 }),
    ]
    const serialized = serializeEntryRows(original)
    const reread = readEntryRows({ cogs: serialized }, 'cogs')
    expect(reread).toHaveLength(2)
    expect(reread[0]).toMatchObject({
      item: 'A',
      qtd: 2,
      val: 1000,
      desc: 10,
      inicio: 3,
      duracao: 6,
    })
    expect(reread[1]).toMatchObject({ item: 'B', qtd: 1, val: 500, desc: 0 })
    expect(reread[1].inicio).toBeUndefined()
    expect(reread[1].duracao).toBeUndefined()
  })
})
