/**
 * Testes do round-trip serialize → readEntryGroups.
 *
 * REGRESSÃO: até a v1.5.x, `readEntryGroups` perdia `inicio` e `duracao`
 * ao ler do payload — o motor financeiro recebia rows como "recorrente do
 * mês 1 até o fim do prazo" mesmo quando o backend tinha `inicio: 5,
 * duracao: 3`. Resultado: cálculos divergiam silenciosamente. Bug
 * confirmado em produção via projeto TESTE_PARIDADE_DELETE.
 *
 * Esses testes garantem que isso nunca volte.
 */

import { describe, expect, it } from 'vitest'

import {
  makeEntryGroup,
  readEntryGroups,
  serializeEntryGroups,
  type EntryGroup,
} from '../dynamic-entries'
import { makeEntryRow } from '../payload-rows'

describe('readEntryGroups', () => {
  it('lê grupo vazio do payload sem erros', () => {
    expect(readEntryGroups(null)).toEqual([])
    expect(readEntryGroups(undefined)).toEqual([])
    expect(readEntryGroups({})).toEqual([])
    expect(readEntryGroups({ entryGroups: 'not-an-array' })).toEqual([])
  })

  it('preserva inicio e duracao quando presentes (regressão do bug v1.5.x)', () => {
    const payload = {
      entryGroups: [
        {
          id: 'g1',
          title: 'Mensalidades',
          accent: '#16a34a',
          isRevenue: true,
          rows: [
            { item: 'Plano A', qtd: 1, val: 1000, desc: 0, inicio: 5, duracao: 3 },
            { item: 'Plano B', qtd: 2, val: 500, desc: 10, inicio: 1 },
          ],
        },
      ],
    }
    const groups = readEntryGroups(payload)
    expect(groups).toHaveLength(1)
    expect(groups[0].rows[0].inicio).toBe(5)
    expect(groups[0].rows[0].duracao).toBe(3)
    expect(groups[0].rows[1].inicio).toBe(1)
    // Quando duracao é omitida no payload, deve ficar undefined (não zero).
    expect(groups[0].rows[1].duracao).toBeUndefined()
  })

  it('aceita inicio/duracao como string numérica e converte', () => {
    const payload = {
      entryGroups: [
        {
          rows: [{ item: 'x', qtd: 1, val: 100, desc: 0, inicio: '4', duracao: '6' }],
        },
      ],
    }
    const groups = readEntryGroups(payload)
    expect(groups[0].rows[0].inicio).toBe(4)
    expect(groups[0].rows[0].duracao).toBe(6)
  })

  it('descarta duracao = 0 (degenerado) — fallback recorrente', () => {
    const payload = {
      entryGroups: [
        {
          rows: [{ item: 'x', qtd: 1, val: 100, desc: 0, inicio: 1, duracao: 0 }],
        },
      ],
    }
    const groups = readEntryGroups(payload)
    expect(groups[0].rows[0].inicio).toBe(1)
    expect(groups[0].rows[0].duracao).toBeUndefined()
  })

  it('descarta inicio inválido (string não numérica)', () => {
    const payload = {
      entryGroups: [
        {
          rows: [{ item: 'x', qtd: 1, val: 100, desc: 0, inicio: 'abc' }],
        },
      ],
    }
    const groups = readEntryGroups(payload)
    expect(groups[0].rows[0].inicio).toBeUndefined()
  })

  it('preserva campos básicos do grupo', () => {
    const payload = {
      entryGroups: [
        {
          id: 'eg_xyz',
          title: 'Custo Operação',
          accent: '#dc2626',
          isRevenue: false,
          rows: [{ item: 'Aluguel', qtd: 1, val: 5000, desc: 0 }],
        },
      ],
    }
    const groups = readEntryGroups(payload)
    expect(groups[0].id).toBe('eg_xyz')
    expect(groups[0].title).toBe('Custo Operação')
    expect(groups[0].accent).toBe('#dc2626')
    expect(groups[0].isRevenue).toBe(false)
  })

  it('aplica defaults quando campos do grupo estão ausentes', () => {
    const payload = {
      entryGroups: [{ rows: [{ item: 'x', qtd: 1, val: 100 }] }],
    }
    const groups = readEntryGroups(payload)
    expect(groups[0].title).toBe('Categoria')
    expect(groups[0].accent).toBe('#7c3aed')
    expect(groups[0].isRevenue).toBe(false)
  })
})

describe('round-trip: serialize → read preserva tudo', () => {
  it('grupo completo com todos os campos', () => {
    const original: EntryGroup = makeEntryGroup({
      id: 'eg_test',
      title: 'Teste',
      accent: '#ff00aa',
      isRevenue: true,
      rows: [
        makeEntryRow({
          item: 'A',
          qtd: 2,
          val: 1500,
          desc: 25,
          inicio: 3,
          duracao: 6,
        }),
        makeEntryRow({
          item: 'B',
          qtd: 1,
          val: 500,
          desc: 0,
          inicio: 1,
        }),
      ],
    })
    const serialized = serializeEntryGroups([original])
    const reread = readEntryGroups({ entryGroups: serialized })
    expect(reread).toHaveLength(1)
    expect(reread[0].id).toBe(original.id)
    expect(reread[0].title).toBe(original.title)
    expect(reread[0].accent).toBe(original.accent)
    expect(reread[0].isRevenue).toBe(original.isRevenue)
    expect(reread[0].rows).toHaveLength(2)
    expect(reread[0].rows[0]).toMatchObject({
      item: 'A',
      qtd: 2,
      val: 1500,
      desc: 25,
      inicio: 3,
      duracao: 6,
    })
    expect(reread[0].rows[1]).toMatchObject({
      item: 'B',
      qtd: 1,
      val: 500,
      desc: 0,
      inicio: 1,
    })
    expect(reread[0].rows[1].duracao).toBeUndefined()
  })

  it('round-trip com payload antigo que não tinha inicio/duracao', () => {
    // Cenário: payload de versão anterior, sem inicio/duracao em algumas rows.
    const payload = {
      entryGroups: [
        {
          id: 'g1',
          title: 'Antigo',
          accent: '#000',
          isRevenue: false,
          rows: [{ item: 'item antigo', qtd: 1, val: 100, desc: 0 }],
        },
      ],
    }
    const groups = readEntryGroups(payload)
    expect(groups[0].rows[0].inicio).toBeUndefined()
    expect(groups[0].rows[0].duracao).toBeUndefined()
    // Re-serializa e re-lê: deve continuar undefined em ambos.
    const serialized = serializeEntryGroups(groups)
    const reread = readEntryGroups({ entryGroups: serialized })
    expect(reread[0].rows[0].inicio).toBeUndefined()
    expect(reread[0].rows[0].duracao).toBeUndefined()
  })
})
