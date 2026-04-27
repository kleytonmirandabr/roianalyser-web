import { Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  entriesTotal,
  rowTotal,
  type EntryRow,
} from '@/features/projects/lib/payload-rows'
import { formatCurrency } from '@/features/projects/lib/money'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

export type CatalogSuggestion = {
  /** ID do item no catálogo (não persistido na linha — só usado para chave). */
  id: string
  /** Nome a ser exibido e gravado em `row.item`. */
  name: string
  /** Valor sugerido — auto-preenche `row.val` quando o user seleciona. */
  defaultValue?: number
  /**
   * Defaults adicionais herdados do catalogItem ao selecionar.
   * Sem isso o user precisa redigitar duração, início, parcelas, etc, mesmo
   * que o item já tenha esses valores cadastrados.
   */
  defaultDurationMonths?: number
  defaultStartMonth?: number
  defaultInstallments?: number
  /** Quantidade default — útil quando catálogo prevê 1 unidade etc. */
  defaultQuantity?: number
}

type EntryTableProps = {
  rows: EntryRow[]
  currency: string
  /** Cabeçalho da primeira coluna (Item / Descrição / etc.). */
  itemLabel?: string
  /** Cabeçalho da coluna de valor (Valor mensal / Valor unitário / etc.). */
  valLabel?: string
  /** Label do total no rodapé. */
  totalLabel?: string
  /** Mostrar coluna de desconto %? Default true. */
  showDiscount?: boolean
  /** Mostrar coluna "Início" (mês)? Default false. */
  showInicio?: boolean
  /** Mostrar coluna "Duração" (meses)? Default false. */
  showDuracao?: boolean
  /**
   * Sugestões para autocomplete da coluna Item via `<datalist>`. Quando o
   * usuário escolhe um item exato (`name` bate), `val` é auto-preenchido
   * com `defaultValue`. Caso contrário, mantém digitação livre.
   */
  catalogSuggestions?: CatalogSuggestion[]
  /** ID único para identificar o `<datalist>` (evita colisão entre tabelas). */
  catalogListId?: string
  onChange: (rows: EntryRow[]) => void
  onAddRow: () => void
  onRemoveRow: (key: string) => void
  disabled?: boolean
}

/**
 * Tabela editável genérica para linhas do tipo "qty × valor × desconto",
 * usada hoje pelas Entradas Dinâmicas. Suporta colunas opcionais de início
 * e duração (em meses) e autocomplete de itens via `<datalist>`.
 */
export function EntryTable({
  rows,
  currency,
  itemLabel,
  valLabel,
  totalLabel,
  showDiscount = true,
  showInicio = false,
  showDuracao = false,
  catalogSuggestions,
  catalogListId,
  onChange,
  onAddRow,
  onRemoveRow,
  disabled,
}: EntryTableProps) {
  const { t } = useTranslation()
  const itemHead = itemLabel ?? t('entryTable.item')
  const valHead = valLabel ?? t('entryTable.value')
  const totalHead = totalLabel ?? t('entryTable.total')
  const total = useMemo(() => entriesTotal(rows), [rows])
  const datalistId = catalogListId ?? 'entry-table-catalog'
  const colCount =
    5 +
    (showDiscount ? 1 : 0) +
    (showInicio ? 1 : 0) +
    (showDuracao ? 1 : 0)

  function updateRow(key: string, patch: Partial<EntryRow>) {
    onChange(
      rows.map((row) => (row.__key === key ? { ...row, ...patch } : row)),
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{itemHead}</TableHead>
              <TableHead className="w-24 text-right">{t('entryTable.qty')}</TableHead>
              <TableHead className="w-40 text-right">{valHead}</TableHead>
              {showDiscount && (
                <TableHead className="w-24 text-right">{t('entryTable.discount')}</TableHead>
              )}
              {showInicio && (
                <TableHead className="w-24 text-right">{t('entryTable.inicio')}</TableHead>
              )}
              {showDuracao && (
                <TableHead className="w-24 text-right">{t('entryTable.duracao')}</TableHead>
              )}
              <TableHead className="w-40 text-right">{t('entryTable.total')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-center text-sm text-muted-foreground"
                >
                  {t('entryTable.empty')}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.__key}>
                <TableCell>
                  <Input
                    value={row.item}
                    list={
                      catalogSuggestions && catalogSuggestions.length > 0
                        ? datalistId
                        : undefined
                    }
                    onChange={(e) => {
                      const value = e.target.value
                      const matched = catalogSuggestions?.find(
                        (s) => s.name === value,
                      )
                      const patch: Partial<EntryRow> = { item: value }
                      if (matched) {
                        // Herda TODOS os defaults do catalogItem em campos que
                        // o user ainda não preencheu manualmente. A regra
                        // `row.X === 0` evita sobrescrever edições do user.
                        if (
                          matched.defaultValue != null &&
                          Number.isFinite(matched.defaultValue) &&
                          row.val === 0
                        ) {
                          patch.val = matched.defaultValue
                        }
                        if (
                          matched.defaultQuantity != null &&
                          Number.isFinite(matched.defaultQuantity) &&
                          (row.qtd === 0 || row.qtd === 1)
                        ) {
                          patch.qtd = matched.defaultQuantity
                        }
                        if (
                          matched.defaultStartMonth != null &&
                          Number.isFinite(matched.defaultStartMonth) &&
                          row.inicio == null
                        ) {
                          patch.inicio = matched.defaultStartMonth
                        }
                        if (
                          matched.defaultDurationMonths != null &&
                          Number.isFinite(matched.defaultDurationMonths) &&
                          row.duracao == null
                        ) {
                          patch.duracao = matched.defaultDurationMonths
                        }
                      }
                      updateRow(row.__key, patch)
                    }}
                    placeholder="Descrição do item"
                    disabled={disabled}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={row.qtd === 0 ? '' : row.qtd}
                    onChange={(e) =>
                      updateRow(row.__key, {
                        qtd: Number(e.target.value) || 0,
                      })
                    }
                    className="text-right"
                    disabled={disabled}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={row.val === 0 ? '' : row.val}
                    onChange={(e) =>
                      updateRow(row.__key, {
                        val: Number(e.target.value) || 0,
                      })
                    }
                    className="text-right"
                    disabled={disabled}
                  />
                </TableCell>
                {showDiscount && (
                  <TableCell>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="any"
                      value={row.desc === 0 ? '' : row.desc}
                      onChange={(e) =>
                        updateRow(row.__key, {
                          desc: Math.min(
                            100,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      className="text-right"
                      disabled={disabled}
                    />
                  </TableCell>
                )}
                {showInicio && (
                  <TableCell>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step="1"
                      value={row.inicio ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        updateRow(row.__key, {
                          inicio:
                            raw === '' ? undefined : Math.max(1, Number(raw) || 1),
                        })
                      }}
                      className="text-right"
                      disabled={disabled}
                    />
                  </TableCell>
                )}
                {showDuracao && (
                  <TableCell>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step="1"
                      value={row.duracao ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        updateRow(row.__key, {
                          duracao:
                            raw === '' ? undefined : Math.max(1, Number(raw) || 1),
                        })
                      }}
                      className="text-right"
                      placeholder="∞"
                      disabled={disabled}
                    />
                  </TableCell>
                )}
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(rowTotal(row), currency)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveRow(row.__key)}
                    title={t('entryTable.removeRow')}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {catalogSuggestions && catalogSuggestions.length > 0 && (
        <datalist id={datalistId}>
          {catalogSuggestions.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={onAddRow} disabled={disabled}>
          <Plus className="h-4 w-4" />
          <span>{t('entryTable.add')}</span>
        </Button>
        <div className="text-sm">
          <span className="text-muted-foreground">{totalHead}: </span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatCurrency(total, currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
