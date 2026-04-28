/**
 * slugify — converte um nome qualquer em snake_case ASCII pra usar como
 * `key` em catálogos. Remove acentos, baixa, troca espaços/símbolos por
 * underscore, colapsa repetidos, corta no limite de 64 chars.
 *
 * Ex: "Construção Civil" → "construcao_civil"
 */
export function slugify(input: string, maxLength = 64): string {
  if (!input) return ''
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')        // non-alnum → _
    .replace(/^_+|_+$/g, '')            // trim leading/trailing _
    .replace(/_+/g, '_')                 // collapse repeats
    .slice(0, maxLength)
}
