/**
 * Parser de CSV simples e tolerante. Suporta:
 *   - Aspas duplas em volta de campos com vírgulas/quebras de linha
 *   - "" escape de aspa dentro de campo quoted
 *   - Auto-detecção de delimitador entre `,` e `;` (linha 0)
 *   - BOM UTF-8 inicial removido
 *
 * Não suporta:
 *   - Encodings que não sejam UTF-8 (use FileReader com encoding correto)
 *   - Linhas com terminadores misturados (\r\n vs \n) — normalizamos pra \n
 */

export type ParsedCsv = {
  headers: string[]
  /** Cada linha é um objeto {header: value}. */
  rows: Record<string, string>[]
  delimiter: ',' | ';'
}

export function parseCsv(text: string): ParsedCsv {
  // BOM
  let t = text.startsWith('\uFEFF') ? text.slice(1) : text
  t = t.replace(/\r\n?/g, '\n')

  // Auto-detect delimiter: pega a primeira linha não vazia.
  const firstLine = t.split('\n').find((l) => l.length > 0) ?? ''
  const delimiter: ',' | ';' = (() => {
    const commas = (firstLine.match(/,/g) ?? []).length
    const semis = (firstLine.match(/;/g) ?? []).length
    return semis > commas ? ';' : ','
  })()

  // Tokeniza linha a linha respeitando quotes.
  const records: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          field += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === delimiter) {
      current.push(field)
      field = ''
      continue
    }
    if (ch === '\n') {
      current.push(field)
      records.push(current)
      current = []
      field = ''
      continue
    }
    field += ch
  }
  // Linha final sem newline trailing
  if (field !== '' || current.length > 0) {
    current.push(field)
    records.push(current)
  }

  // Filtra linhas completamente vazias
  const cleaned = records.filter(
    (r) => r.length > 0 && r.some((cell) => cell.trim() !== ''),
  )
  if (cleaned.length === 0) return { headers: [], rows: [], delimiter }

  const [headerRow, ...rest] = cleaned
  const headers = headerRow.map((h) => h.trim())
  const rows = rest.map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim()
    })
    return obj
  })
  return { headers, rows, delimiter }
}

/**
 * Auto-mapeamento de colunas do CSV para os fieldKeys do destino.
 * Recebe pares { fieldKey, candidates: string[] } e retorna um map
 * { fieldKey -> headerCsv } com o melhor match (case-insensitive,
 * sem acentos).
 */
export function autoMapColumns(
  csvHeaders: string[],
  schema: Array<{ fieldKey: string; candidates: string[] }>,
): Record<string, string> {
  const map: Record<string, string> = {}
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\s_-]+/g, '')
  const normalizedHeaders = csvHeaders.map((h) => ({ raw: h, n: norm(h) }))
  for (const item of schema) {
    const candNorm = item.candidates.map(norm)
    const hit = normalizedHeaders.find((h) => candNorm.includes(h.n))
    if (hit) map[item.fieldKey] = hit.raw
  }
  return map
}
