/**
 * Utilitários para exportação de dados — CSV (universal) e PDF (via
 * window.print). Sem dependências externas.
 */

type CsvCell = string | number | boolean | null | undefined

/** Escapa um valor para CSV (RFC 4180). */
function escapeCsvCell(value: CsvCell): string {
  if (value == null) return ''
  const s = typeof value === 'string' ? value : String(value)
  // Se tiver vírgula, aspas, quebra de linha, ponto-e-vírgula → quote.
  if (/[,;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Gera string CSV a partir de array de objetos.
 * O cabeçalho é derivado das chaves do primeiro objeto (ou usa `headers`).
 */
export function toCsv<T extends Record<string, CsvCell>>(
  rows: T[],
  options?: {
    headers?: Array<{ key: keyof T; label: string }>
    /** Caractere separador. Padrão `,` (RFC 4180). */
    delimiter?: ',' | ';'
  },
): string {
  if (rows.length === 0 && !options?.headers) return ''
  const delimiter = options?.delimiter ?? ','

  const headers =
    options?.headers ??
    Object.keys(rows[0] ?? {}).map((k) => ({ key: k as keyof T, label: k }))

  const headerLine = headers
    .map((h) => escapeCsvCell(h.label))
    .join(delimiter)

  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvCell(row[h.key])).join(delimiter),
  )

  return [headerLine, ...dataLines].join('\r\n')
}

/**
 * Dispara download de um string como arquivo.
 * Usa um Blob + link temporário; funciona em todos os browsers.
 * Adiciona BOM UTF-8 para Excel reconhecer acentos corretamente.
 */
export function downloadAsCsv(content: string, filename: string): void {
  const bom = '\ufeff' // BOM UTF-8
  const blob = new Blob([bom + content], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Liberação assíncrona; alguns browsers precisam manter o blob brevemente.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Helper combinado: converte rows + dispara download. */
export function exportToCsv<T extends Record<string, CsvCell>>(
  rows: T[],
  filename: string,
  headers?: Array<{ key: keyof T; label: string }>,
): void {
  const csv = toCsv(rows, { headers })
  downloadAsCsv(csv, filename)
}

/**
 * Dispara o diálogo nativo de impressão. O usuário pode escolher
 * "Salvar como PDF" para gerar um PDF do conteúdo da tela.
 *
 * Aplicar `@media print` no CSS pode esconder sidebar/header e deixar o
 * conteúdo principal limpo para impressão.
 */
export function printPage(): void {
  window.print()
}
