/** Extrai até 2 iniciais (primeira+última palavra) para usar em Avatar. */
export function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Formata valor monetário em pt-BR.
 *
 * - `value` null/undefined/NaN → '—' (placeholder visual)
 * - currency padrão 'BRL' (ISO 4217)
 * - `compact: true` → sem casas decimais (R$ 12.500). Usar em listas/cards
 *   onde precisão centavo não importa.
 * - `compact: false` (default) → 2 casas decimais (R$ 12.500,00). Usar em
 *   detalhes/relatórios onde valor exato importa.
 *
 * Sempre prefere formatação local-aware (Intl). Fallback texto se a API
 * Intl não der conta da currency informada (ex: código inválido).
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'BRL',
  options: { compact?: boolean } = {},
): string {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const n = Number(value)
  const cur = String(currency || 'BRL').toUpperCase().slice(0, 3)
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: options.compact ? 0 : 2,
      minimumFractionDigits: options.compact ? 0 : 2,
    }).format(n)
  } catch {
    return `${cur} ${n.toFixed(options.compact ? 0 : 2)}`
  }
}

/** Atalho compacto (sem decimais). Equivalente a formatCurrency(v, c, {compact: true}). */
export function formatCurrencyShort(
  value: number | null | undefined,
  currency: string = 'BRL',
): string {
  return formatCurrency(value, currency, { compact: true })
}

/**
 * Formata número grande de forma legível (ex: "1,2 mi" / "850 mil").
 * Usado em dashboards e KPIs onde o valor exato não cabe.
 */
export function formatNumberCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const n = Math.abs(Number(value))
  const sign = Number(value) < 0 ? '-' : ''
  if (n >= 1_000_000_000) return `${sign}${(n / 1_000_000_000).toFixed(1)} bi`
  if (n >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(1)} mi`
  if (n >= 1_000) return `${sign}${(n / 1_000).toFixed(0)} mil`
  return String(value)
}

/** Formata percentual (recebe valor já em escala 0-100, não 0-1). */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return `${Number(value).toFixed(decimals)}%`
}

/** Formata data ISO/Date pra dd/mm/yyyy (pt-BR). Null-safe. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  try {
    const d = value instanceof Date ? value : new Date(value)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

/**
 * Formata data+hora ISO/Date pra dd/mm/yyyy HH:mm (pt-BR), respeitando timezone.
 *
 * - timezone: IANA TZ (ex: 'America/Sao_Paulo'). Se omitido usa o do navegador.
 * - retorna '—' se valor inválido.
 */
export function formatDateTime(value: string | Date | null | undefined, timezone?: string | null): string {
  if (!value) return '—'
  try {
    const d = value instanceof Date ? value : new Date(value)
    if (isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: timezone || undefined,
    }).format(d)
  } catch {
    return '—'
  }
}

