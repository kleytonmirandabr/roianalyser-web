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
