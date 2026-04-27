/**
 * Mapa SVG real do Brasil com paths topojson dos 27 estados + DF.
 *
 * Fonte: pacote npm `@svg-maps/brazil` (CC-BY-4.0). 64 KB de paths cobrindo
 * todo o território nacional com formas reais — bem mais visualmente
 * fiel que o tile map. Usado como upgrade do `BrazilTileMap` quando o
 * usuário liga "Mapa real" no widget de distribuição geográfica.
 *
 * Paths usam viewBox 0 0 613 639 (já inclui ilhas oceânicas — Trindade,
 * Fernando de Noronha, etc), com `id` em UF lowercase (`ac`, `sp`, `df`).
 */

// Tipos do pacote vivem em `src/types/svg-maps-brazil.d.ts` —
// evitam a dep transitiva `svg-maps__common` que o pacote referencia
// mas não publica.
import brazilSvgMap from '@svg-maps/brazil'

export type BrazilGeoLocation = {
  /** Nome do estado em português (ex: "São Paulo"). */
  name: string
  /** Sigla UF maiúscula (ex: "SP"). */
  uf: string
  /** Atributo `d` do path SVG, no espaço do viewBox. */
  path: string
}

/** ViewBox do SVG nativo do pacote — manter intacto pra preservar geometria. */
export const BR_GEO_VIEWBOX = brazilSvgMap.viewBox

/** Width/height parseados do viewBox, úteis pra cálculo de aspect ratio. */
const [, , vbW, vbH] = BR_GEO_VIEWBOX.split(' ').map(Number)
export const BR_GEO_WIDTH = vbW
export const BR_GEO_HEIGHT = vbH

/**
 * Lista de estados normalizada com UF maiúscula. O pacote original usa
 * lowercase; convertemos pra match com o resto do app que sempre usa
 * sigla maiúscula (`BR_STATE_BY_UF`, payloads, etc).
 */
export const BR_GEO_LOCATIONS: BrazilGeoLocation[] = brazilSvgMap.locations.map(
  (loc) => ({
    name: loc.name,
    uf: loc.id.toUpperCase(),
    path: loc.path,
  }),
)

/** Index UF → location pra render rápido. */
export const BR_GEO_BY_UF = new Map<string, BrazilGeoLocation>(
  BR_GEO_LOCATIONS.map((loc) => [loc.uf, loc]),
)

/**
 * Retorna o centroide aproximado de um path SVG calculando a média dos
 * pontos do `d` (M/L/m/l absolutos e relativos). Não é geometricamente
 * exato — pra labels suficientemente preciso. Resultado em coordenadas
 * do viewBox (não em píxels da tela).
 *
 * Se o path tem só comandos arc/curve sem pontos óbvios, devolve null
 * pra UI poder pular o label naquele estado.
 */
export function pathCentroid(d: string): { cx: number; cy: number } | null {
  // Tokeniza pares numéricos do path. Ignora os comandos (M/L/C/Z…) e
  // foca nos coordinates — pra centroide aproximado o tipo de comando
  // não importa muito porque a maioria dos commands são L/M relativos.
  const numbers: number[] = []
  const re = /-?\d+(?:\.\d+)?/g
  let match: RegExpExecArray | null
  while ((match = re.exec(d)) !== null) {
    numbers.push(Number(match[0]))
  }
  if (numbers.length < 4) return null
  // Pares (x, y) — somamos x's e y's separados.
  let sumX = 0
  let sumY = 0
  let count = 0
  // Detecta se o path começa com 'm' minúsculo (relativo) — nesse caso
  // os pontos seguintes são deltas. Pra centroide aproximado, vamos
  // converter relativos pra absolutos rastreando posição cumulativa.
  // Approach simplificado: parse usando o atributo de comando, com fallback.
  const tokens = d.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g) ?? []
  let cmd = ''
  let i = 0
  let curX = 0
  let curY = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    if (/[a-zA-Z]/.test(tok)) {
      cmd = tok
      i++
      continue
    }
    const x = Number(tokens[i])
    const y = Number(tokens[i + 1])
    if (Number.isNaN(x) || Number.isNaN(y)) {
      i++
      continue
    }
    if (cmd === cmd.toLowerCase() && cmd !== '') {
      // Comando relativo: soma na posição atual.
      curX += x
      curY += y
    } else {
      curX = x
      curY = y
    }
    sumX += curX
    sumY += curY
    count++
    i += 2
  }
  if (count === 0) return null
  return { cx: sumX / count, cy: sumY / count }
}
