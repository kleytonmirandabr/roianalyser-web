/**
 * CurrencyInput — campo numérico com máscara baseada na moeda selecionada.
 * Internamente armazena como Number; mostra formatado (ex: R$ 1.234,56).
 */
import { useEffect, useState } from 'react'

import { Input } from '@/shared/ui/input'

interface Props {
  value: number | null
  currency: string
  onChange: (n: number | null) => void
  placeholder?: string
}

const LOCALE_BY_CCY: Record<string, string> = {
  BRL: 'pt-BR', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB',
  ARS: 'es-AR', CLP: 'es-CL', MXN: 'es-MX',
}

function formatForCurrency(n: number, currency: string): string {
  const locale = LOCALE_BY_CCY[currency] ?? 'pt-BR'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, minimumFractionDigits: 2,
    }).format(n)
  } catch {
    return n.toString()
  }
}

function parseInput(text: string, currency: string): number | null {
  if (!text) return null
  const locale = LOCALE_BY_CCY[currency] ?? 'pt-BR'
  // Pega o decimal separator do locale corrente
  const sample = (1.5).toLocaleString(locale)
  const decimalSep = sample.includes(',') ? ',' : '.'
  const cleaned = text
    .replace(/[^\d,.\-]/g, '')          // remove R$, $, espaços
    .replace(decimalSep === ',' ? /\./g : /,/g, '')   // remove milhares
    .replace(decimalSep, '.')           // converte decimal pra .
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function CurrencyInput({ value, currency, onChange, placeholder }: Props) {
  const [text, setText] = useState<string>(
    value != null ? formatForCurrency(value, currency) : ''
  )
  const [editing, setEditing] = useState(false)

  // Reformat when currency changes (only when not editing)
  useEffect(() => {
    if (!editing) {
      setText(value != null ? formatForCurrency(value, currency) : '')
    }
  }, [currency, value, editing])

  return (
    <Input
      value={text}
      onFocus={() => {
        setEditing(true)
        // Show raw number for edit
        setText(value != null ? String(value).replace('.', LOCALE_BY_CCY[currency] === 'en-US' ? '.' : ',') : '')
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setEditing(false)
        const n = parseInput(text, currency)
        onChange(n)
        setText(n != null ? formatForCurrency(n, currency) : '')
      }}
      placeholder={placeholder ?? formatForCurrency(0, currency)}
    />
  )
}
