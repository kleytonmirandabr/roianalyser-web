/**
 * Linhas de tabela editável usadas pelas Entradas Dinâmicas.
 *
 * Mantemos chaves curtas (item/qtd/val/desc) próximas ao formato do app
 * vanilla para minimizar fricção de migração de payloads existentes
 * (ver legacy-migration.ts).
 */

import { clamp } from './money'

export type EntryRow = {
  /** ID estável só para keys do React. NÃO é persistido no backend. */
  __key: string
  item: string
  qtd: number
  val: number
  /** Desconto em %, 0–100. */
  desc: number
  /** Mês de início (1 = primeiro mês). */
  inicio?: number
  /** Duração em meses. 1 = one-time no `inicio`. Omitido = recorrente até o fim do prazo. */
  duracao?: number
}

let __keyCounter = 0
function nextKey(): string {
  __keyCounter += 1
  return `row_${Date.now().toString(36)}_${__keyCounter}`
}

export function makeEntryRow(partial?: Partial<EntryRow>): EntryRow {
  const row: EntryRow = {
    __key: nextKey(),
    item: partial?.item ?? '',
    qtd: partial?.qtd ?? 0,
    val: partial?.val ?? 0,
    desc: clamp(partial?.desc ?? 0, 0, 100),
  }
  if (partial?.inicio != null) row.inicio = partial.inicio
  if (partial?.duracao != null) row.duracao = partial.duracao
  return row
}

/** Soma do total de uma única linha — qty × val × (1 - desc/100). */
export function rowTotal(row: EntryRow): number {
  const q = Number.isFinite(row.qtd) ? row.qtd : 0
  const v = Number.isFinite(row.val) ? row.val : 0
  const d = Number.isFinite(row.desc) ? clamp(row.desc, 0, 100) : 0
  return q * v * (1 - d / 100)
}

/** Soma do total das linhas. */
export function entriesTotal(rows: EntryRow[]): number {
  return rows.reduce((acc, row) => acc + rowTotal(row), 0)
}

/** Lê linhas existentes de uma chave do payload com tolerância a shapes antigos. */
export function readEntryRows(
  payload: Record<string, unknown> | null | undefined,
  key: string,
): EntryRow[] {
  if (!payload) return []
  const raw = payload[key]
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const e = entry as Partial<EntryRow> & Record<string, unknown>
    return makeEntryRow({
      item: typeof e.item === 'string' ? e.item : '',
      qtd: Number(e.qtd) || 0,
      val: Number(e.val) || 0,
      desc: Number(e.desc) || 0,
      inicio: e.inicio != null ? Number(e.inicio) || undefined : undefined,
      duracao: e.duracao != null ? Number(e.duracao) || undefined : undefined,
    })
  })
}

/** Serializa linhas para persistir no backend (sem __key interno). */
export function serializeEntryRows(rows: EntryRow[]): Array<{
  item: string
  qtd: number
  val: number
  desc: number
  inicio?: number
  duracao?: number
}> {
  return rows.map((row) => {
    const { __key: _ignored, inicio, duracao, ...rest } = row
    void _ignored
    const out: Record<string, unknown> = { ...rest }
    if (inicio != null) out.inicio = inicio
    if (duracao != null) out.duracao = duracao
    return out as {
      item: string
      qtd: number
      val: number
      desc: number
      inicio?: number
      duracao?: number
    }
  })
}
