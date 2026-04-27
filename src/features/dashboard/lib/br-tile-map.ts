/**
 * Tile map dos 27 estados brasileiros + DF — cada estado vira um quadrado
 * num grid aproximadamente geográfico. É a abordagem que NYT/WaPo usam
 * pra heatmaps quando precisam destacar estados pequenos (DF, ES, etc)
 * sem que sejam atropelados pelos grandes (AM, MT).
 *
 * Coordenadas escolhidas pra preservar adjacências reais:
 *   - Norte (RR/AP/AM/PA/AC/RO/TO) na parte superior
 *   - Nordeste (MA/CE/RN/PB/PE/AL/SE/BA) à direita
 *   - Centro-Oeste (MT/MS/GO/DF) no centro
 *   - Sudeste (SP/RJ/MG/ES) abaixo do centro
 *   - Sul (PR/SC/RS) na parte inferior
 *
 * Não é geograficamente exato, mas dá uma noção espacial muito melhor
 * que uma lista vertical e é trivial de implementar (sem topojson).
 */

export type BrazilState = {
  uf: string
  name: string
  region: 'N' | 'NE' | 'CO' | 'SE' | 'S'
  /** Posição X no grid (0-7). */
  x: number
  /** Posição Y no grid (0-9). */
  y: number
}

export const BR_TILE_MAP: BrazilState[] = [
  // Norte
  { uf: 'RR', name: 'Roraima', region: 'N', x: 2, y: 0 },
  { uf: 'AP', name: 'Amapá', region: 'N', x: 4, y: 0 },
  { uf: 'AM', name: 'Amazonas', region: 'N', x: 1, y: 1 },
  { uf: 'PA', name: 'Pará', region: 'N', x: 3, y: 1 },
  { uf: 'AC', name: 'Acre', region: 'N', x: 0, y: 2 },
  { uf: 'RO', name: 'Rondônia', region: 'N', x: 1, y: 2 },
  { uf: 'TO', name: 'Tocantins', region: 'N', x: 4, y: 2 },

  // Nordeste — segue do Maranhão até Bahia/Sergipe descendo a costa
  { uf: 'MA', name: 'Maranhão', region: 'NE', x: 5, y: 1 },
  { uf: 'CE', name: 'Ceará', region: 'NE', x: 6, y: 1 },
  { uf: 'PI', name: 'Piauí', region: 'NE', x: 5, y: 2 },
  { uf: 'RN', name: 'Rio Grande do Norte', region: 'NE', x: 7, y: 1 },
  { uf: 'PB', name: 'Paraíba', region: 'NE', x: 7, y: 2 },
  { uf: 'PE', name: 'Pernambuco', region: 'NE', x: 6, y: 2 },
  { uf: 'AL', name: 'Alagoas', region: 'NE', x: 7, y: 3 },
  { uf: 'SE', name: 'Sergipe', region: 'NE', x: 6, y: 3 },
  { uf: 'BA', name: 'Bahia', region: 'NE', x: 5, y: 3 },

  // Centro-Oeste
  { uf: 'MT', name: 'Mato Grosso', region: 'CO', x: 3, y: 3 },
  { uf: 'GO', name: 'Goiás', region: 'CO', x: 4, y: 3 },
  { uf: 'DF', name: 'Distrito Federal', region: 'CO', x: 4, y: 4 },
  { uf: 'MS', name: 'Mato Grosso do Sul', region: 'CO', x: 3, y: 4 },

  // Sudeste
  { uf: 'MG', name: 'Minas Gerais', region: 'SE', x: 5, y: 4 },
  { uf: 'ES', name: 'Espírito Santo', region: 'SE', x: 6, y: 4 },
  { uf: 'SP', name: 'São Paulo', region: 'SE', x: 4, y: 5 },
  { uf: 'RJ', name: 'Rio de Janeiro', region: 'SE', x: 5, y: 5 },

  // Sul
  { uf: 'PR', name: 'Paraná', region: 'S', x: 4, y: 6 },
  { uf: 'SC', name: 'Santa Catarina', region: 'S', x: 4, y: 7 },
  { uf: 'RS', name: 'Rio Grande do Sul', region: 'S', x: 3, y: 8 },
]

/** Lookup rápido por UF. */
export const BR_STATE_BY_UF = new Map(BR_TILE_MAP.map((s) => [s.uf, s]))

/** Largura/altura do grid em tiles. */
export const BR_GRID_WIDTH = 8
export const BR_GRID_HEIGHT = 9
