/**
 * Modelo de Entradas Dinâmicas (Sprint F.1 — espelhando vanilla).
 *
 * Cada `DynamicEntry` é uma LINHA autônoma referenciando o catálogo
 * (`itemId` → `catalogItems`). A categoria, tipo financeiro, unidade de
 * cobrança, valor padrão e flags `affectsRevenue/Cost/Investment` são
 * HERDADAS do catálogo no momento da seleção do item — o usuário não
 * digita texto livre nem escolhe cor manualmente.
 *
 * Persistido em `payload.dynamicEntries: DynamicEntry[]`. Para projetos
 * antigos que ainda têm `payload.entryGroups[]`, a função
 * `readDynamicEntries` faz conversão automática em runtime (legado vira
 * entries flat com `itemName` no lugar do `itemId` — quando salvar de
 * novo, fica gravado como `dynamicEntries[]`).
 *
 * Persistir como `dynamicEntries[]` é a fonte da verdade. `entryGroups[]`
 * fica preservado no payload pra leitura do vanilla (compat só pra leitura).
 */

import { clamp } from './money'

/**
 * Shape mínimo do item do catálogo `catalogItems` que importa pra Entradas
 * Dinâmicas. Lê do `CatalogItem` genérico (index signature) e tipa só os
 * campos relevantes pra herança de defaults / policies.
 */
export type Comportamento =
  | 'INCOME_ONE_TIME'  | 'INCOME_MONTHLY'  | 'INCOME_INSTALLMENT'
  | 'EXPENSE_ONE_TIME' | 'EXPENSE_MONTHLY' | 'EXPENSE_INSTALLMENT'
  | 'INVESTMENT_ONE_TIME' | 'INVESTMENT_INSTALLMENT'

/** Mapeia comportamento → calculation_mode legado pra manter compat. */
function comportamentoToCalcMode(c?: Comportamento | string | null): string {
  if (!c) return 'one_time'
  if (c.endsWith('_MONTHLY'))     return 'recurring'
  if (c.endsWith('_INSTALLMENT')) return 'installment'
  return 'one_time'
}

/** Mapeia comportamento → flags revenue/cost/investment. */
function comportamentoToFlowFlags(c?: Comportamento | string | null): { revenue: boolean; cost: boolean; investment: boolean } {
  if (!c) return { revenue: false, cost: false, investment: false }
  if (c.startsWith('INCOME_'))      return { revenue: true,  cost: false, investment: false }
  if (c.startsWith('EXPENSE_'))     return { revenue: false, cost: true,  investment: false }
  if (c.startsWith('INVESTMENT_'))  return { revenue: false, cost: false, investment: true  }
  return { revenue: false, cost: false, investment: false }
}

export type DynamicEntryCatalogItem = {
  id: string
  name?: string
  code?: string
  categoryId?: string
  financialTypeId?: string
  billingUnitId?: string
  calculationMode?: string
  comportamento?: Comportamento | string
  defaultValue?: number
  /** Valor legado — usado como fallback de `defaultValue`. */
  valHw?: number
  defaultDurationMonths?: number
  defaultStartMonth?: number
  defaultInstallments?: number
  allowsQuantity?: boolean
  allowsDiscountPct?: boolean
  allowsStartMonth?: boolean
  allowsDurationMonths?: boolean
  allowsInstallments?: boolean
  affectsRevenue?: boolean
  affectsCost?: boolean
  affectsInvestment?: boolean
  active?: boolean
}

/* ─── Tipo principal ─── */
export type DynamicEntry = {
  /** ID estável da entry no projeto. */
  id: string
  /** ID do item do catálogo (`catalogItems`). Vazio = entry recém-criada sem item. */
  itemId: string
  /** Cache do nome do item no momento da seleção. */
  itemName: string
  /** Categoria (`itemCategories`) — herda do `catalogItem.categoryId`. */
  categoryId: string
  /** Tipo financeiro (`financialTypes`) — herda do `catalogItem.financialTypeId`. */
  financialTypeId: string
  /** Unidade de cobrança (`billingUnits`) — herda do `catalogItem.billingUnitId`. */
  billingUnitId: string
  /** Modo de cálculo (do catálogo). 'one_time' | 'amortized' | 'recurring' | ... */
  calculationMode: string
  /** Quantidade. Se `!allowsQuantity` no item, fica fixa em 1. */
  quantity: number
  /** Valor unitário. Default = `catalogItem.defaultValue`. Editável. */
  unitValue: number
  /** Desconto em %, 0–100. */
  discountPct: number
  /** Mês de início (1 = primeiro). */
  startMonth: number
  /** Duração em meses (1 = one-time). */
  durationMonths: number
  /** Parcelas (pra modo amortizado/parcelado). */
  installments: number
  /** Flag de receita herdado do item. */
  affectsRevenue: boolean
  /** Flag de custo herdado do item. */
  affectsCost: boolean
  /** Flag de investimento (CAPEX) herdado do item. */
  affectsInvestment: boolean
}

/* ─── Tipos legados (compat só pra leitura) ─── */
export type EntryGroup = {
  id: string
  title: string
  accent: string
  isRevenue: boolean
  rows: LegacyEntryRow[]
}

export type LegacyEntryRow = {
  item: string
  qtd: number
  val: number
  desc: number
  inicio?: number
  duracao?: number
}

/* ─── Helpers ─── */
let __idCounter = 0
function nextId(): string {
  __idCounter += 1
  return `dyn_${Date.now().toString(36)}_${__idCounter}`
}

export function makeDynamicEntry(partial?: Partial<DynamicEntry>): DynamicEntry {
  return {
    id: partial?.id ?? nextId(),
    itemId: partial?.itemId ?? '',
    itemName: partial?.itemName ?? '',
    categoryId: partial?.categoryId ?? '',
    financialTypeId: partial?.financialTypeId ?? '',
    billingUnitId: partial?.billingUnitId ?? '',
    calculationMode: partial?.calculationMode ?? 'one_time',
    quantity:
      typeof partial?.quantity === 'number' && Number.isFinite(partial.quantity)
        ? Math.max(0, partial.quantity)
        : 1,
    unitValue:
      typeof partial?.unitValue === 'number' && Number.isFinite(partial.unitValue)
        ? Math.max(0, partial.unitValue)
        : 0,
    discountPct: clamp(partial?.discountPct ?? 0, 0, 100),
    startMonth: Math.max(1, Math.floor(partial?.startMonth ?? 1)),
    durationMonths: Math.max(1, Math.floor(partial?.durationMonths ?? 1)),
    installments: Math.max(1, Math.floor(partial?.installments ?? 1)),
    affectsRevenue: !!partial?.affectsRevenue,
    affectsCost: !!partial?.affectsCost,
    affectsInvestment: !!partial?.affectsInvestment,
  }
}

/** Total bruto = qty × unitValue. */
export function entryGross(e: DynamicEntry): number {
  return Math.max(0, e.quantity) * Math.max(0, e.unitValue)
}

/** Total líquido (com desconto aplicado). */
export function entryNet(e: DynamicEntry): number {
  return entryGross(e) * (1 - clamp(e.discountPct, 0, 100) / 100)
}

/** Soma do net das entries. */
export function entriesNetTotal(entries: DynamicEntry[]): number {
  return entries.reduce((acc, e) => acc + entryNet(e), 0)
}

/* ─── Field policy: o que o usuário pode editar baseado no item ─── */
export type FieldPolicy = {
  /** User pode digitar quantidade. Quando false, fixa em 1. */
  quantity: boolean
  /** User pode digitar desconto %. */
  discountPct: boolean
  /** User pode escolher mês de início. */
  startMonth: boolean
  /** User pode editar duração em meses. */
  durationMonths: boolean
  /** User pode escolher parcelas. */
  installments: boolean
  /** Defaults usados quando o respectivo flag está false. */
  defaultStartMonth: number
  defaultDurationMonths: number
  defaultInstallments: number
}

export function getFieldPolicy(item: DynamicEntryCatalogItem | null | undefined): FieldPolicy {
  if (!item) {
    return {
      quantity: true,
      discountPct: true,
      startMonth: true,
      durationMonths: true,
      installments: false,
      defaultStartMonth: 1,
      defaultDurationMonths: 1,
      defaultInstallments: 1,
    }
  }
  return {
    quantity: item.allowsQuantity !== false,
    discountPct: item.allowsDiscountPct === true,
    startMonth: item.allowsStartMonth !== false,
    durationMonths: item.allowsDurationMonths !== false,
    installments: item.allowsInstallments === true,
    defaultStartMonth: Math.max(1, Number(item.defaultStartMonth) || 1),
    defaultDurationMonths: Math.max(1, Number(item.defaultDurationMonths) || 1),
    defaultInstallments: Math.max(1, Number(item.defaultInstallments) || 1),
  }
}

/* ─── Construir/atualizar entry a partir do catálogo ─── */

/**
 * Tipo financeiro do catálogo `financialTypes` (Sprint F.2 — fonte da verdade
 * pra flags de receita/custo/investimento). O motor lê os flags dele,
 * caindo pros flags do `catalogItem` ou da própria `entry` apenas se o
 * tipo financeiro não tiver flags definidos (compat).
 */
export type DynamicEntryFinancialType = {
  id: string
  name?: string
  affectsRevenue?: boolean
  affectsCost?: boolean
  affectsInvestment?: boolean
}

/**
 * Resolve flags `affectsRevenue/Cost/Investment` priorizando o `financialType`
 * (fonte da verdade do motor). Cai pros flags do `catalogItem`, depois pra
 * da `entry`, garantindo compat com dados antigos onde os flags vivem só
 * no item.
 */
export function resolveEntryFlags(
  entry: Pick<
    DynamicEntry,
    'affectsRevenue' | 'affectsCost' | 'affectsInvestment'
  >,
  financialType: DynamicEntryFinancialType | null | undefined,
  catalogItem: DynamicEntryCatalogItem | null | undefined,
): { affectsRevenue: boolean; affectsCost: boolean; affectsInvestment: boolean } {
  // Se o financialType tem ALGUM flag definido, é source-of-truth — usa só ele.
  const typeHasFlags =
    financialType != null &&
    (financialType.affectsRevenue === true ||
      financialType.affectsCost === true ||
      financialType.affectsInvestment === true)
  if (typeHasFlags) {
    return {
      affectsRevenue: !!financialType?.affectsRevenue,
      affectsCost: !!financialType?.affectsCost,
      affectsInvestment: !!financialType?.affectsInvestment,
    }
  }
  // Compat: cai pros flags do item.
  if (
    catalogItem &&
    (catalogItem.affectsRevenue === true ||
      catalogItem.affectsCost === true ||
      catalogItem.affectsInvestment === true)
  ) {
    return {
      affectsRevenue: !!catalogItem.affectsRevenue,
      affectsCost: !!catalogItem.affectsCost,
      affectsInvestment: !!catalogItem.affectsInvestment,
    }
  }
  // Último fallback: flags da própria entry (legado).
  return {
    affectsRevenue: !!entry.affectsRevenue,
    affectsCost: !!entry.affectsCost,
    affectsInvestment: !!entry.affectsInvestment,
  }
}

/**
 * Cria uma nova `DynamicEntry` herdando todos os defaults do `catalogItem`.
 * Quando o `financialType` é passado, herda flags dele (fonte da verdade).
 * Senão, cai pros flags do item (compat).
 */
export function entryFromCatalogItem(
  item: DynamicEntryCatalogItem,
  overrides?: Partial<DynamicEntry>,
  financialType?: DynamicEntryFinancialType | null,
): DynamicEntry {
  const policy = getFieldPolicy(item)
  /* Sprint #231/#233: comportamento é fonte da verdade pra calc mode + sinal.
     Quando item.comportamento existe, ignora financialType + calculationMode
     legados. Pra catálogos antigos sem comportamento, mantém a lógica anterior. */
  const comp = item.comportamento as Comportamento | undefined
  let derivedCalcMode: string
  let flags: { affectsRevenue: boolean; affectsCost: boolean; affectsInvestment: boolean }
  if (comp) {
    derivedCalcMode = comportamentoToCalcMode(comp)
    const f = comportamentoToFlowFlags(comp)
    flags = { affectsRevenue: f.revenue, affectsCost: f.cost, affectsInvestment: f.investment }
  } else {
    derivedCalcMode = item.calculationMode ?? 'one_time'
    flags = resolveEntryFlags(
      { affectsRevenue: false, affectsCost: false, affectsInvestment: false },
      financialType,
      item,
    )
  }
  return makeDynamicEntry({
    itemId: item.id,
    itemName: item.name ?? '',
    categoryId: item.categoryId ?? '',
    financialTypeId: item.financialTypeId ?? '',
    billingUnitId: item.billingUnitId ?? '',
    calculationMode: derivedCalcMode,
    quantity: policy.quantity ? 1 : 1,
    unitValue: numberOr(item.defaultValue, numberOr(item.valHw, 0)),
    discountPct: 0,
    startMonth: policy.defaultStartMonth,
    durationMonths: policy.durationMonths
      ? policy.defaultDurationMonths
      : 1,
    installments: policy.installments ? policy.defaultInstallments : 1,
    affectsRevenue: flags.affectsRevenue,
    affectsCost: flags.affectsCost,
    affectsInvestment: flags.affectsInvestment,
    ...overrides,
  })
}

/**
 * Reaplica os defaults do catálogo numa entry existente (quando o user
 * troca o `itemId`). Mantém o `id` da entry, mas refaz tudo o resto.
 * Quando passado, `financialType` é fonte da verdade pra flags.
 */
export function applyCatalogItemToEntry(
  entry: DynamicEntry,
  item: DynamicEntryCatalogItem,
  financialType?: DynamicEntryFinancialType | null,
): DynamicEntry {
  return entryFromCatalogItem(item, { id: entry.id }, financialType)
}

/* ─── Leitura/escrita do payload ─── */

/**
 * Lê entries do payload. Faz auto-migração de `entryGroups[]` legado quando
 * `dynamicEntries[]` ainda não existe — converte cada row em uma entry flat
 * preservando os valores numéricos. `itemId`/`categoryId` ficam vazios
 * (entries legados não têm referência ao catálogo) — UI mostra `itemName`
 * direto e o usuário pode promover escolhendo um item do catálogo no select.
 */
export function readDynamicEntries(
  payload: Record<string, unknown> | null | undefined,
): DynamicEntry[] {
  if (!payload) return []

  // Caminho novo: `dynamicEntries` já existe.
  const direct = payload.dynamicEntries
  if (Array.isArray(direct)) {
    return direct.map((raw) => parseRawEntry(raw))
  }

  // Caminho legado: `entryGroups[].rows[]` → flatten + herda isRevenue do grupo.
  // Semântica antiga preservada: row sem `duracao` = recorrente até o fim do
  // prazo. Como aqui não temos o prazo na mão, gravamos durationMonths=9999
  // como sentinela de "recorrente"; o motor financeiro trata isso como
  // "ativo até o último mês do prazo" (a janela `[start, start+9999)` cobre
  // qualquer prazo realista).
  const groups = payload.entryGroups
  if (Array.isArray(groups)) {
    const out: DynamicEntry[] = []
    for (const g of groups) {
      const group = g as Partial<EntryGroup>
      const isRevenue = !!group.isRevenue
      const rows = Array.isArray(group.rows) ? group.rows : []
      for (const r of rows) {
        const row = r as Partial<LegacyEntryRow>
        const rawDuracao = row.duracao
        const hasValidDuracao =
          rawDuracao != null &&
          Number.isFinite(Number(rawDuracao)) &&
          Number(rawDuracao) > 0
        out.push(
          makeDynamicEntry({
            itemName: typeof row.item === 'string' ? row.item : '',
            quantity: numberOr(row.qtd, 0),
            unitValue: numberOr(row.val, 0),
            discountPct: numberOr(row.desc, 0),
            startMonth: numberOr(row.inicio, 1),
            durationMonths: hasValidDuracao ? Number(rawDuracao) : 9999,
            affectsRevenue: isRevenue,
            affectsCost: !isRevenue,
          }),
        )
      }
    }
    return out
  }

  return []
}

/** Parse defensivo de uma entry vinda do payload. */
function parseRawEntry(raw: unknown): DynamicEntry {
  const r = (raw ?? {}) as Partial<DynamicEntry>
  return makeDynamicEntry({
    id: typeof r.id === 'string' ? r.id : undefined,
    itemId: typeof r.itemId === 'string' ? r.itemId : '',
    itemName: typeof r.itemName === 'string' ? r.itemName : '',
    categoryId: typeof r.categoryId === 'string' ? r.categoryId : '',
    financialTypeId:
      typeof r.financialTypeId === 'string' ? r.financialTypeId : '',
    billingUnitId: typeof r.billingUnitId === 'string' ? r.billingUnitId : '',
    calculationMode:
      typeof r.calculationMode === 'string' ? r.calculationMode : 'one_time',
    quantity: numberOr(r.quantity, 1),
    unitValue: numberOr(r.unitValue, 0),
    discountPct: numberOr(r.discountPct, 0),
    startMonth: numberOr(r.startMonth, 1),
    durationMonths: numberOr(r.durationMonths, 1),
    installments: numberOr(r.installments, 1),
    affectsRevenue: !!r.affectsRevenue,
    affectsCost: !!r.affectsCost,
    affectsInvestment: !!r.affectsInvestment,
  })
}

/** Serializa entries pro payload. Não escreve campos default-redundantes. */
export function serializeDynamicEntries(
  entries: DynamicEntry[],
): Array<Record<string, unknown>> {
  return entries.map((e) => ({
    id: e.id,
    itemId: e.itemId,
    itemName: e.itemName,
    categoryId: e.categoryId,
    financialTypeId: e.financialTypeId,
    billingUnitId: e.billingUnitId,
    calculationMode: e.calculationMode,
    quantity: e.quantity,
    unitValue: e.unitValue,
    discountPct: e.discountPct,
    startMonth: e.startMonth,
    durationMonths: e.durationMonths,
    installments: e.installments,
    affectsRevenue: e.affectsRevenue,
    affectsCost: e.affectsCost,
    affectsInvestment: e.affectsInvestment,
  }))
}

function numberOr(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/* ─── Re-exports legados que outros arquivos ainda importam ─── */
// `legacy-migration.ts` ainda usa `makeEntryGroup`/`serializeEntryGroups`
// pra criar payload de entryGroups[] como passo intermediário; não vamos
// quebrar isso ainda — manter o helper retornando o shape antigo permite
// que migrações de payloads legados continuem rodando até serem aposentadas.
export function makeEntryGroup(partial?: Partial<EntryGroup>): EntryGroup {
  return {
    id: partial?.id ?? `eg_${Date.now().toString(36)}_${++__idCounter}`,
    title: partial?.title ?? 'Categoria',
    accent: partial?.accent ?? '#7c3aed',
    isRevenue: partial?.isRevenue ?? false,
    rows: partial?.rows ?? [],
  }
}

export function serializeEntryGroups(groups: EntryGroup[]): Array<{
  id: string
  title: string
  accent: string
  isRevenue: boolean
  rows: LegacyEntryRow[]
}> {
  return groups.map((g) => ({
    id: g.id,
    title: g.title,
    accent: g.accent,
    isRevenue: g.isRevenue,
    rows: g.rows.map((r) => ({
      item: r.item,
      qtd: r.qtd,
      val: r.val,
      desc: r.desc,
      ...(r.inicio != null ? { inicio: r.inicio } : {}),
      ...(r.duracao != null ? { duracao: r.duracao } : {}),
    })),
  }))
}

/** @deprecated use `readDynamicEntries`. Mantido para compat de testes. */
export function readEntryGroups(
  payload: Record<string, unknown> | null | undefined,
): EntryGroup[] {
  if (!payload) return []
  const raw = payload.entryGroups
  if (!Array.isArray(raw)) return []
  return raw.map((g) => {
    const group = g as Partial<EntryGroup> & { rows?: unknown }
    const rowsRaw = Array.isArray(group.rows) ? group.rows : []
    return {
      id: typeof group.id === 'string' ? group.id : nextId(),
      title: typeof group.title === 'string' ? group.title : 'Categoria',
      accent: typeof group.accent === 'string' ? group.accent : '#7c3aed',
      isRevenue: !!group.isRevenue,
      rows: rowsRaw.map((r) => {
        const row = r as Partial<LegacyEntryRow>
        // inicio/duracao só entram se forem número finito.
        // Em particular, duracao=0 (degenerado) é descartado.
        const inicioNum = Number(row.inicio)
        const duracaoNum = Number(row.duracao)
        const validInicio =
          row.inicio != null && Number.isFinite(inicioNum)
        const validDuracao =
          row.duracao != null && Number.isFinite(duracaoNum) && duracaoNum > 0
        return {
          item: typeof row.item === 'string' ? row.item : '',
          qtd: numberOr(row.qtd, 0),
          val: numberOr(row.val, 0),
          desc: numberOr(row.desc, 0),
          ...(validInicio ? { inicio: inicioNum } : {}),
          ...(validDuracao ? { duracao: duracaoNum } : {}),
        }
      }),
    }
  })
}
