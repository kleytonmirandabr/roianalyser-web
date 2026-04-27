/**
 * Cliente do ViaCEP — endpoint público gratuito para CEPs brasileiros.
 * https://viacep.com.br/
 */

export type ViaCepResponse = {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  ibge?: string
  ddd?: string
  /** Quando o CEP não existe, a API retorna { erro: true }. */
  erro?: boolean
}

/** Limpa o CEP, mantendo só dígitos. Retorna null se não tiver 8. */
export function normalizeCep(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  return digits.length === 8 ? digits : null
}

/**
 * Busca um CEP. Retorna null em caso de erro de rede ou CEP inexistente.
 * Não usa o api client do app pois ViaCEP é externo (CSP libera o domínio).
 */
export async function fetchViaCep(
  cep: string,
): Promise<ViaCepResponse | null> {
  const normalized = normalizeCep(cep)
  if (!normalized) return null

  try {
    const response = await fetch(`https://viacep.com.br/ws/${normalized}/json/`)
    if (!response.ok) return null
    const data = (await response.json()) as ViaCepResponse
    if (data.erro) return null
    return data
  } catch {
    return null
  }
}
