/**
 * Máscaras + helpers de telefone com DDI.
 *
 * Formato armazenado: E.164 (+55 11 98765-4321 → +5511987654321).
 * Display: separa DDI / DDD / número com máscara local.
 *
 * Suporta Brasil completo. Outros países guarda só dígitos.
 */

export type CountryDial = {
  code: string
  name: string
  flag: string
  dial: string
  mask: string  // ex: '(##) #####-####'
}

export const COUNTRIES: CountryDial[] = [
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', dial: '+55', mask: '(##) #####-####' },
  { code: 'US', name: 'EUA', flag: '🇺🇸', dial: '+1', mask: '(###) ###-####' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', dial: '+351', mask: '### ### ###' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', dial: '+54', mask: '(##) ####-####' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', dial: '+56', mask: '(#) ####-####' },
  { code: 'MX', name: 'México', flag: '🇲🇽', dial: '+52', mask: '(##) ####-####' },
  { code: 'OTHER', name: 'Outro', flag: '🌐', dial: '+', mask: '###############' },
]

export function applyMask(digits: string, mask: string): string {
  let out = ''
  let di = 0
  for (const ch of mask) {
    if (di >= digits.length) break
    if (ch === '#') {
      out += digits[di++]
    } else {
      out += ch
    }
  }
  return out
}

/**
 * Parse stored phone (E.164 or partial) → { country, localDigits }.
 */
export function parsePhone(raw: string | null | undefined): { country: CountryDial; local: string } {
  const def = { country: COUNTRIES[0], local: '' }
  if (!raw) return def
  const trimmed = String(raw).trim()
  if (!trimmed) return def
  // Try to detect country by prefix
  for (const c of COUNTRIES) {
    if (c.dial !== '+' && trimmed.startsWith(c.dial)) {
      return { country: c, local: trimmed.slice(c.dial.length).replace(/\D/g, '') }
    }
  }
  // Fallback: assume Brasil if no prefix
  const digits = trimmed.replace(/\D/g, '')
  return { country: COUNTRIES[0], local: digits }
}

/** Combine country + local digits into stored E.164 format */
export function joinPhone(country: CountryDial, local: string): string {
  const cleanLocal = local.replace(/\D/g, '')
  if (!cleanLocal) return ''
  return `${country.dial}${cleanLocal}`
}

/** Validate email — RFC-ish */
export function isValidEmail(input: string): boolean {
  if (!input) return true  // empty is OK (optional field)
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(input.trim())
}
