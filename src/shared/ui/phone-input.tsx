/**
 * PhoneInput — input com bandeira/DDI selecionável + máscara local.
 *
 * Internamente armazena o telefone em formato E.164 (+5511987654321).
 * Visualmente mostra: [🇧🇷 +55 ▾] [(11) 98765-4321]
 */
import { useState, useEffect } from 'react'

import { COUNTRIES, applyMask, joinPhone, parsePhone, type CountryDial } from '@/shared/lib/phone-mask'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'

interface Props {
  value: string
  onChange: (e164: string) => void
  placeholder?: string
}

export function PhoneInput({ value, onChange, placeholder }: Props) {
  const initial = parsePhone(value)
  const [country, setCountry] = useState<CountryDial>(initial.country)
  const [local, setLocal] = useState<string>(applyMask(initial.local, initial.country.mask))

  // Sync external value changes (drawer reopen with different row)
  useEffect(() => {
    const p = parsePhone(value)
    setCountry(p.country)
    setLocal(applyMask(p.local, p.country.mask))
  }, [value])

  const countryOptions = COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial} ${c.name}` }))

  function handleCountryChange(code: string) {
    const c = COUNTRIES.find((x) => x.code === code) ?? COUNTRIES[0]
    setCountry(c)
    const digits = local.replace(/\D/g, '')
    const masked = applyMask(digits, c.mask)
    setLocal(masked)
    onChange(joinPhone(c, digits))
  }

  function handleLocalChange(raw: string) {
    const digits = raw.replace(/\D/g, '')
    const masked = applyMask(digits, country.mask)
    setLocal(masked)
    onChange(joinPhone(country, digits))
  }

  return (
    <div className="flex gap-2">
      <div className="w-40 shrink-0">
        <Combobox options={countryOptions} value={country.code} onChange={handleCountryChange} />
      </div>
      <Input
        value={local}
        onChange={(e) => handleLocalChange(e.target.value)}
        placeholder={placeholder ?? country.mask.replace(/#/g, '_')}
        className="flex-1"
      />
    </div>
  )
}
