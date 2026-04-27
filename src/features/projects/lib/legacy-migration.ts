/**
 * Migração de payloads antigos do projeto para o novo formato baseado
 * apenas em `entryGroups` (Entradas Dinâmicas).
 *
 * O app vanilla salvava as entradas em chaves fixas no payload:
 *   - licHw   → tabela qty × val × desc (recorrente, mensal)
 *   - mob     → tabela qty × val (one-time, espalhado em mobMes/mobParcelas)
 *   - capex   → tabela qty × val (amortizado em capexMeses)
 *   - cogs    → tabela qty × val (recorrente, com inicio por linha)
 *   - tech    → array de { item, val } (recorrente × opTechQtd × opTechDur)
 *   - ana     → array de { item, val } (recorrente × opAnaQtd × opAnaDur)
 *   - srvRev  → tabela serviços (receita), val × duracao a partir de inicio
 *   - srvCost → tabela serviços (custo)
 *
 * Esta função detecta esses campos e cria entryGroups equivalentes,
 * preservando o cálculo financeiro fim-a-fim. NÃO apaga os campos antigos
 * — assim o vanilla continua funcionando se o mesmo projeto for aberto lá.
 *
 * É **idempotente**: se já houver `_migratedAt` no payload, não roda de novo.
 */

import {
  makeEntryGroup,
  serializeEntryGroups,
  type EntryGroup,
} from './dynamic-entries'
import { makeEntryRow } from './payload-rows'

type RawEntry = {
  item?: unknown
  qtd?: unknown
  val?: unknown
  desc?: unknown
  inicio?: unknown
}

type RawService = {
  item?: unknown
  val?: unknown
  inicio?: unknown
  duracao?: unknown
}

type RawCostItem = {
  item?: unknown
  val?: unknown
}

function readArray<T>(payload: Record<string, unknown>, key: string): T[] {
  const raw = payload[key]
  return Array.isArray(raw) ? (raw as T[]) : []
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export type MigrationResult = {
  /** Payload novo a ser persistido. */
  payload: Record<string, unknown>
  /** Quantos grupos foram criados. */
  groupsCreated: number
  /** Categorias detectadas no payload antigo. */
  detected: string[]
  /** True se o payload já estava migrado e nada foi feito. */
  alreadyMigrated: boolean
}

/**
 * Roda a migração contra um payload. Retorna o payload modificado
 * (entryGroups acrescidos, _migratedAt setado) e estatísticas.
 */
export function migrateLegacyPayload(
  payload: Record<string, unknown>,
): MigrationResult {
  if (payload._migratedAt) {
    return {
      payload,
      groupsCreated: 0,
      detected: [],
      alreadyMigrated: true,
    }
  }

  const newGroups: EntryGroup[] = []
  const detected: string[] = []

  // Mantém entryGroups que já existam (não sobrescreve).
  const existingGroups: unknown[] = Array.isArray(payload.entryGroups)
    ? (payload.entryGroups as unknown[])
    : []

  // 1) licHw — receita recorrente mensal (qty × val × desc), do mês 1 ao fim.
  const licHw = readArray<RawEntry>(payload, 'licHw')
  if (licHw.length > 0) {
    detected.push('licHw')
    newGroups.push(
      makeEntryGroup({
        title: 'Licenças HW (legado)',
        accent: '#2563eb',
        isRevenue: true,
        rows: licHw.map((e) =>
          makeEntryRow({
            item: str(e.item) || 'Licença',
            qtd: num(e.qtd),
            val: num(e.val),
            desc: num(e.desc),
            inicio: 1,
            // duracao omitida = recorrente até o fim do prazo
          }),
        ),
      }),
    )
  }

  // 2) mob — custo espalhado em parcelas a partir de mobMes.
  const mob = readArray<RawEntry>(payload, 'mob')
  const mobMes = num(payload.mobMes, 1)
  const mobParcelas = Math.max(1, num(payload.mobParcelas, 1))
  if (mob.length > 0) {
    detected.push('mob')
    newGroups.push(
      makeEntryGroup({
        title: 'Mobilização (legado)',
        accent: '#f59e0b',
        isRevenue: false,
        rows: mob.map((e) => {
          const totalRow = num(e.qtd) * num(e.val)
          // Cada linha é distribuída em mobParcelas a partir de mobMes.
          // Modelamos como: qtd=1, val=totalRow/mobParcelas, recorrente por mobParcelas meses a partir de mobMes.
          return makeEntryRow({
            item: str(e.item) || 'Mobilização',
            qtd: 1,
            val: mobParcelas > 0 ? totalRow / mobParcelas : 0,
            desc: 0,
            inicio: mobMes,
            duracao: mobParcelas,
          })
        }),
      }),
    )
  }

  // 3) capex — custo amortizado em capexMeses.
  const capex = readArray<RawEntry>(payload, 'capex')
  const capexMeses = Math.max(1, num(payload.capexMeses, 12))
  if (capex.length > 0) {
    detected.push('capex')
    newGroups.push(
      makeEntryGroup({
        title: 'CAPEX (legado)',
        accent: '#7c3aed',
        isRevenue: false,
        rows: capex.map((e) => {
          const totalRow = num(e.qtd) * num(e.val)
          return makeEntryRow({
            item: str(e.item) || 'CAPEX',
            qtd: 1,
            val: capexMeses > 0 ? totalRow / capexMeses : 0,
            desc: 0,
            inicio: 1,
            duracao: capexMeses,
          })
        }),
      }),
    )
  }

  // 4) cogs — custo recorrente com inicio por linha.
  const cogs = readArray<RawEntry>(payload, 'cogs')
  if (cogs.length > 0) {
    detected.push('cogs')
    newGroups.push(
      makeEntryGroup({
        title: 'COGS (legado)',
        accent: '#dc2626',
        isRevenue: false,
        rows: cogs.map((e) =>
          makeEntryRow({
            item: str(e.item) || 'COGS',
            qtd: num(e.qtd, 1),
            val: num(e.val),
            desc: 0,
            inicio: num(e.inicio, 1),
            // duracao omitida = recorrente até o fim
          }),
        ),
      }),
    )
  }

  // 5) tech — custo recorrente: (sum itens) × opTechQtd, do opTechIni por opTechDur meses.
  const tech = readArray<RawCostItem>(payload, 'tech')
  const techQtd = num(payload.opTechQtd, 1)
  const techIni = num(payload.opTechIni, 1)
  const techDur = num(payload.opTechDur, 0)
  if (tech.length > 0 && techDur > 0) {
    detected.push('tech')
    newGroups.push(
      makeEntryGroup({
        title: 'Técnico (legado)',
        accent: '#0891b2',
        isRevenue: false,
        rows: tech.map((e) =>
          makeEntryRow({
            item: str(e.item) || 'Item de custo',
            qtd: techQtd,
            val: num(e.val),
            desc: 0,
            inicio: techIni,
            duracao: techDur,
          }),
        ),
      }),
    )
  }

  // 6) ana — análogo ao tech.
  const ana = readArray<RawCostItem>(payload, 'ana')
  const anaQtd = num(payload.opAnaQtd, 1)
  const anaIni = num(payload.opAnaIni, 2)
  const anaDur = num(payload.opAnaDur, 0)
  if (ana.length > 0 && anaDur > 0) {
    detected.push('ana')
    newGroups.push(
      makeEntryGroup({
        title: 'Analista (legado)',
        accent: '#0d9488',
        isRevenue: false,
        rows: ana.map((e) =>
          makeEntryRow({
            item: str(e.item) || 'Item de custo',
            qtd: anaQtd,
            val: num(e.val),
            desc: 0,
            inicio: anaIni,
            duracao: anaDur,
          }),
        ),
      }),
    )
  }

  // 7) srvRev — receita recorrente por serviço, val × duracao a partir do inicio.
  const srvRev = readArray<RawService>(payload, 'srvRev')
  if (srvRev.length > 0) {
    detected.push('srvRev')
    newGroups.push(
      makeEntryGroup({
        title: 'Receita de Serviços (legado)',
        accent: '#16a34a',
        isRevenue: true,
        rows: srvRev.map((e) =>
          makeEntryRow({
            item: str(e.item) || 'Serviço',
            qtd: 1,
            val: num(e.val),
            desc: 0,
            inicio: num(e.inicio, 1),
            duracao: num(e.duracao, 1),
          }),
        ),
      }),
    )
  }

  // 8) srvCost — custo recorrente por serviço.
  const srvCost = readArray<RawService>(payload, 'srvCost')
  if (srvCost.length > 0) {
    detected.push('srvCost')
    newGroups.push(
      makeEntryGroup({
        title: 'Custos de Serviços (legado)',
        accent: '#ea580c',
        isRevenue: false,
        rows: srvCost.map((e) =>
          makeEntryRow({
            item: str(e.item) || 'Serviço',
            qtd: 1,
            val: num(e.val),
            desc: 0,
            inicio: num(e.inicio, 1),
            duracao: num(e.duracao, 1),
          }),
        ),
      }),
    )
  }

  if (newGroups.length === 0) {
    // Nada para migrar. Marca como migrado mesmo assim, evita prompt repetido.
    return {
      payload: { ...payload, _migratedAt: new Date().toISOString() },
      groupsCreated: 0,
      detected: [],
      alreadyMigrated: false,
    }
  }

  return {
    payload: {
      ...payload,
      entryGroups: [
        ...existingGroups,
        ...serializeEntryGroups(newGroups),
      ],
      _migratedAt: new Date().toISOString(),
    },
    groupsCreated: newGroups.length,
    detected,
    alreadyMigrated: false,
  }
}

/** Indica se o payload tem dados antigos passíveis de migração. */
export function hasLegacyData(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false
  if (payload._migratedAt) return false
  const KEYS = ['licHw', 'mob', 'capex', 'cogs', 'tech', 'ana', 'srvRev', 'srvCost']
  return KEYS.some((k) => {
    const v = payload[k]
    return Array.isArray(v) && v.length > 0
  })
}
