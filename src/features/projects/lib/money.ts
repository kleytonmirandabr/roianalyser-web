/**
 * Helpers de formato monetário e parsing tolerante.
 * O backend e o frontend vanilla guardam números puros (não formatados);
 * a UI só formata para exibição.
 */

const CURRENCY_LOCALES: Record<string, string> = {
  BRL: 'pt-BR',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
}

export function formatCurrency(
  value: number | null | undefined,
  currency = 'BRL',
): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const locale = CURRENCY_LOCALES[currency] ?? 'pt-BR'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return value.toFixed(2)
  }
}

/** Aceita "1.234,56", "1234.56", "1234,56" e devolve número. */
export function parseNumberLoose(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  if (input == null) return 0
  const s = String(input).trim()
  if (!s) return 0
  // Se tem vírgula como decimal (estilo pt-BR), remove pontos de milhar
  // e troca vírgula por ponto.
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    return Number(s.replace(/\./g, '').replace(',', '.'))
  }
  // Se tem vírgula sem padrão de milhares, trata como decimal.
  const normalized = s.replace(/\s/g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
