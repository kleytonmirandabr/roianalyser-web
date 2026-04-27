import { useMemo } from 'react'

import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import type { CatalogType } from '@/features/catalogs/types'
import { Combobox } from '@/shared/ui/combobox'

type CatalogSelectProps = {
  id?: string
  /** Tipo do catálogo de onde puxar as opções. */
  refCatalog: CatalogType
  /** Valor atual (id ou name conforme storeField). */
  value: string
  /** Por padrão grava o `id`; passe 'name' pra gravar o nome. */
  storeField?: 'id' | 'name'
  /** Mostra essa opção quando vazio. */
  placeholder?: string
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * Combobox filtrável que puxa itens de um catálogo. Substitui text inputs
 * livres em campos do tipo "foreign key" (sectorId, companyId, etc).
 *
 * Mantém compatibilidade com o backend: grava o `id` (ou `name`) no campo
 * que antes era text livre, então o JSON persistido continua sendo string.
 *
 * Uso típico:
 *   <CatalogSelect refCatalog="companies" value={companyId} onChange={...} />
 */
export function CatalogSelect({
  id,
  refCatalog,
  value,
  storeField = 'id',
  placeholder = '— selecione —',
  onChange,
  disabled,
}: CatalogSelectProps) {
  const list = useCatalog(refCatalog)

  const options = useMemo(() => {
    const base = (list.data ?? [])
      .filter((item) => item.active !== false)
      .map((item) => ({
        value:
          storeField === 'name'
            ? typeof item.name === 'string'
              ? item.name
              : item.id
            : item.id,
        label: typeof item.name === 'string' ? item.name : String(item.id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
    // Fallback: se o valor atual não estiver nas opções (id obsoleto), mantém
    // como opção pra não sumir do form e ficar evidente que está stale.
    if (value && !base.some((o) => o.value === value)) {
      base.unshift({ value, label: `${value} (não encontrado)` })
    }
    return base
  }, [list.data, storeField, value])

  return (
    <Combobox
      id={id}
      options={options}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled || list.isLoading}
      placeholder={list.isLoading ? '…' : placeholder}
      noneLabel="—"
    />
  )
}
