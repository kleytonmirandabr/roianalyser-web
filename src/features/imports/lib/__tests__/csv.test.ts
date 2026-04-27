import { describe, expect, it } from 'vitest'

import { autoMapColumns, parseCsv } from '../csv'

describe('parseCsv', () => {
  it('parseia CSV simples com vírgula', () => {
    const out = parseCsv('name,email\nAna,a@x.com\nBruno,b@y.com')
    expect(out.delimiter).toBe(',')
    expect(out.headers).toEqual(['name', 'email'])
    expect(out.rows).toHaveLength(2)
    expect(out.rows[0]).toEqual({ name: 'Ana', email: 'a@x.com' })
  })

  it('detecta delimitador ponto-e-vírgula automaticamente', () => {
    const out = parseCsv('name;email\nAna;a@x.com')
    expect(out.delimiter).toBe(';')
    expect(out.rows[0]).toEqual({ name: 'Ana', email: 'a@x.com' })
  })

  it('respeita aspas duplas com vírgula dentro', () => {
    const out = parseCsv('name,note\nAna,"hello, world"')
    expect(out.rows[0]).toEqual({ name: 'Ana', note: 'hello, world' })
  })

  it('escape de aspas duplas dentro de campo quoted', () => {
    const out = parseCsv('name,note\n"O\'\'Brien","ok"')
    expect(out.rows[0].name).toContain("O''Brien")
  })

  it('aceita aspa escapada usando ""', () => {
    const out = parseCsv('text\n"diz ""olá"""')
    expect(out.rows[0].text).toBe('diz "olá"')
  })

  it('remove BOM UTF-8 inicial', () => {
    const out = parseCsv('\uFEFFname,email\nAna,a@x.com')
    expect(out.headers).toEqual(['name', 'email'])
  })

  it('normaliza CRLF (\\r\\n) e CR (\\r) para LF', () => {
    const out = parseCsv('name,age\r\nAna,30\rBruno,25')
    expect(out.rows).toHaveLength(2)
    expect(out.rows[1].name).toBe('Bruno')
  })

  it('ignora linhas completamente vazias', () => {
    const out = parseCsv('name\nAna\n\n\nBruno\n')
    expect(out.rows).toHaveLength(2)
  })

  it('retorna headers/rows vazios quando entrada é vazia', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [], delimiter: ',' })
  })

  it('campo vazio entre delimitadores fica string vazia', () => {
    const out = parseCsv('a,b,c\n1,,3')
    expect(out.rows[0]).toEqual({ a: '1', b: '', c: '3' })
  })
})

describe('autoMapColumns', () => {
  it('matcha headers exatos case-insensitive', () => {
    const map = autoMapColumns(['Nome', 'Email', 'Telefone'], [
      { fieldKey: 'name', candidates: ['name', 'nome'] },
      { fieldKey: 'email', candidates: ['email', 'mail'] },
      { fieldKey: 'phone', candidates: ['phone', 'telefone'] },
    ])
    expect(map).toEqual({ name: 'Nome', email: 'Email', phone: 'Telefone' })
  })

  it('ignora acentos e separadores ao normalizar', () => {
    const map = autoMapColumns(['razão_social', 'e-mail'], [
      { fieldKey: 'name', candidates: ['razao_social', 'razao social'] },
      { fieldKey: 'email', candidates: ['email'] },
    ])
    expect(map).toEqual({ name: 'razão_social', email: 'e-mail' })
  })

  it('omite campo sem match', () => {
    const map = autoMapColumns(['col1'], [
      { fieldKey: 'name', candidates: ['name'] },
    ])
    expect(map).toEqual({})
  })
})
