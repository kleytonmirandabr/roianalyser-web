/**
 * Tipos pro pacote `@svg-maps/brazil`. O `index.d.ts` que vem no pacote
 * referencia `svg-maps__common` que não está publicado — declaramos os
 * tipos localmente pra TypeScript reconhecer o módulo sem precisar de
 * dep extra.
 */
declare module '@svg-maps/brazil' {
  export type SvgMapLocation = {
    /** Nome do estado (ex: "São Paulo"). */
    name: string
    /** ID lowercase com sigla UF (ex: "sp"). */
    id: string
    /** Atributo `d` do path SVG. */
    path: string
  }
  export type SvgMap = {
    label: string
    viewBox: string
    locations: SvgMapLocation[]
  }
  const map: SvgMap
  export default map
}
