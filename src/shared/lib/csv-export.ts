/**
 * Export utilitário CSV — Sprint #199.
 *
 * Locale-aware:
 *   - pt-BR / es: delimiter ';' (Excel BR/ES abre direto)
 *   - en: delimiter ','
 *   - UTF-8 BOM (Excel reconhece acentos)
 *
 * Uso:
 *   downloadCsv({
 *     filename: 'oportunidades',
 *     columns: [{ key: 'name', label: 'Nome', getValue: (r) => r.name }],
 *     rows: items,
 *     locale: 'pt',
 *   })
 */
export type CsvColumn<T> = {
  key: string
  label: string
  getValue: (row: T) => string | number | null | undefined | boolean | Date
}

export type CsvLocale = 'pt' | 'en' | 'es' | string

function delimiterForLocale(locale: CsvLocale): string {
  const l = String(locale || '').toLowerCase().slice(0, 2)
  return l === 'en' ? ',' : ';'
}

function escapeCell(value: unknown, delimiter: string): string {
  if (value == null) return ''
  let s: string
  if (value instanceof Date) {
    s = isNaN(value.getTime()) ? '' : value.toISOString()
  } else if (typeof value === 'boolean') {
    s = value ? 'true' : 'false'
  } else {
    s = String(value)
  }
  // Escape if contains delimiter, quote, newline or carriage return
  if (s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export type DownloadCsvInput<T> = {
  filename: string
  columns: CsvColumn<T>[]
  rows: T[]
  locale: CsvLocale
}

export function downloadCsv<T>({ filename, columns, rows, locale }: DownloadCsvInput<T>): void {
  const delim = delimiterForLocale(locale)
  const lines: string[] = []
  // Header
  lines.push(columns.map(c => escapeCell(c.label, delim)).join(delim))
  // Rows
  for (const row of rows) {
    lines.push(columns.map(c => escapeCell(c.getValue(row), delim)).join(delim))
  }
  // CRLF for Excel compatibility
  const csv = lines.join('\r\n')
  // BOM + content
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = `${filename}-${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
