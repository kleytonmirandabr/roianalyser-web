/**
 * Lista curada de timezones IANA pra exibir no Combobox de cliente/usuário.
 * Foco em fusos brasileiros (mercado principal) + cobertura razoável global
 * pros casos multi-país. Usuário pode digitar pra filtrar.
 *
 * Cada entry: id IANA + label legível com offset atual + horário em curto.
 */

type TimezoneEntry = {
  iana: string
  label: string
  /** Cidade representativa pra hint. */
  hint: string
}

export const COMMON_TIMEZONES: TimezoneEntry[] = [
  // Brasil
  { iana: 'America/Sao_Paulo', label: 'Brasília (BRT/BRST)', hint: 'São Paulo, Rio, MG, PR, SC, RS, GO, DF…' },
  { iana: 'America/Belem', label: 'Pará / Belém', hint: 'PA, AP, MA, TO' },
  { iana: 'America/Fortaleza', label: 'Fortaleza', hint: 'CE, RN, PB, PE, AL, SE, BA' },
  { iana: 'America/Recife', label: 'Recife', hint: 'PE' },
  { iana: 'America/Bahia', label: 'Salvador', hint: 'BA' },
  { iana: 'America/Manaus', label: 'Manaus (AMT)', hint: 'AM, MT, MS, RO, RR' },
  { iana: 'America/Cuiaba', label: 'Cuiabá', hint: 'MT' },
  { iana: 'America/Porto_Velho', label: 'Porto Velho', hint: 'RO' },
  { iana: 'America/Boa_Vista', label: 'Boa Vista', hint: 'RR' },
  { iana: 'America/Rio_Branco', label: 'Rio Branco (ACT)', hint: 'AC' },
  { iana: 'America/Eirunepe', label: 'Eirunepé', hint: 'AM (oeste)' },
  { iana: 'America/Noronha', label: 'Fernando de Noronha', hint: 'PE (Noronha)' },

  // Américas
  { iana: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)', hint: 'Argentina' },
  { iana: 'America/Santiago', label: 'Santiago (CLT)', hint: 'Chile' },
  { iana: 'America/Lima', label: 'Lima (PET)', hint: 'Peru' },
  { iana: 'America/Bogota', label: 'Bogotá (COT)', hint: 'Colômbia' },
  { iana: 'America/Caracas', label: 'Caracas (VET)', hint: 'Venezuela' },
  { iana: 'America/Mexico_City', label: 'Cidade do México (CST)', hint: 'México' },
  { iana: 'America/New_York', label: 'New York (EST/EDT)', hint: 'EUA Leste' },
  { iana: 'America/Chicago', label: 'Chicago (CST/CDT)', hint: 'EUA Centro' },
  { iana: 'America/Denver', label: 'Denver (MST/MDT)', hint: 'EUA Montanha' },
  { iana: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', hint: 'EUA Pacífico' },
  { iana: 'America/Anchorage', label: 'Anchorage', hint: 'Alaska' },
  { iana: 'Pacific/Honolulu', label: 'Honolulu (HST)', hint: 'Havaí' },

  // Europa
  { iana: 'Europe/London', label: 'Londres (GMT/BST)', hint: 'Reino Unido' },
  { iana: 'Europe/Lisbon', label: 'Lisboa', hint: 'Portugal' },
  { iana: 'Europe/Madrid', label: 'Madri', hint: 'Espanha' },
  { iana: 'Europe/Paris', label: 'Paris (CET/CEST)', hint: 'França' },
  { iana: 'Europe/Berlin', label: 'Berlim', hint: 'Alemanha' },
  { iana: 'Europe/Rome', label: 'Roma', hint: 'Itália' },
  { iana: 'Europe/Amsterdam', label: 'Amsterdam', hint: 'Holanda' },
  { iana: 'Europe/Athens', label: 'Atenas (EET)', hint: 'Grécia' },
  { iana: 'Europe/Moscow', label: 'Moscou (MSK)', hint: 'Rússia' },

  // Ásia / Oceania
  { iana: 'Asia/Dubai', label: 'Dubai (GST)', hint: 'UAE' },
  { iana: 'Asia/Tehran', label: 'Tehran', hint: 'Irã' },
  { iana: 'Asia/Karachi', label: 'Karachi', hint: 'Paquistão' },
  { iana: 'Asia/Kolkata', label: 'Calcutá (IST)', hint: 'Índia' },
  { iana: 'Asia/Bangkok', label: 'Bangkok', hint: 'Tailândia' },
  { iana: 'Asia/Singapore', label: 'Singapura (SGT)', hint: 'Singapura' },
  { iana: 'Asia/Shanghai', label: 'Shanghai (CST)', hint: 'China' },
  { iana: 'Asia/Tokyo', label: 'Tóquio (JST)', hint: 'Japão' },
  { iana: 'Asia/Seoul', label: 'Seul (KST)', hint: 'Coreia do Sul' },
  { iana: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', hint: 'Austrália Leste' },
  { iana: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)', hint: 'Nova Zelândia' },

  // UTC
  { iana: 'UTC', label: 'UTC', hint: 'Universal Coordinated Time' },
]

/**
 * Calcula o offset atual (em horas) de um timezone IANA. Retorna string
 * formatada `+HH:MM` ou `-HH:MM`, útil pra exibir no Combobox.
 */
export function timezoneOffset(iana: string): string {
  try {
    const now = new Date()
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      timeZoneName: 'shortOffset',
    })
    const parts = fmt.formatToParts(now)
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value
    if (tzPart) return tzPart.replace('GMT', 'UTC')
    return ''
  } catch {
    return ''
  }
}

/**
 * Formata as opções pro Combobox. Cada opção:
 *   value: 'America/Sao_Paulo'
 *   label: 'Brasília (BRT/BRST)  UTC-3'
 *   hint:  'São Paulo, Rio, MG, PR, SC…'
 */
export function timezoneOptions(): { value: string; label: string; hint?: string }[] {
  return COMMON_TIMEZONES.map((tz) => {
    const offset = timezoneOffset(tz.iana)
    return {
      value: tz.iana,
      label: offset ? `${tz.label}  ${offset}` : tz.label,
      hint: tz.hint,
    }
  })
}
