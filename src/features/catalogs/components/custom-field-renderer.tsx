/**
 * Renderer de Custom Fields configurados pelo Master em /catalogs/custom-fields.
 *
 * Tipos suportados:
 *   - text, number, currency, percent, date
 *   - select (1 opção), multi-select (várias)
 *   - checkbox, color, link
 *
 * Cada custom field é definido como CatalogItem em /api/catalogs/.../customFields:
 *   { id, name, fieldKey, fieldType, required, visible, options?: string[] }
 *
 * O valor fica em payload[fieldKey]. Esse componente lê e edita essa chave.
 */

import { useMemo } from 'react'

import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'color'
  | 'link'

export type CustomFieldDef = {
  id: string
  name: string
  fieldKey: string
  fieldType: CustomFieldType
  required?: boolean
  visible?: boolean
  /** Para select/multi-select. Pipe-separated no catálogo. */
  options?: string
}

type Props = {
  field: CustomFieldDef
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
  /** Visual compacto pra inline edit em tabela. */
  inline?: boolean
}

export function CustomFieldRenderer({
  field,
  value,
  onChange,
  disabled,
  inline,
}: Props) {
  const id = `cf-${field.fieldKey}`
  const opts = useMemo(
    () =>
      typeof field.options === 'string'
        ? field.options
            .split(/[|,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    [field.options],
  )

  const stringVal = useMemo(() => {
    if (value == null) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }, [value])

  if (field.fieldType === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 cursor-pointer"
        />
        {!inline && (
          <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
            {field.name}
          </Label>
        )}
      </div>
    )
  }

  if (field.fieldType === 'color') {
    return (
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={stringVal || '#6b7280'}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        {!inline && (
          <span className="font-mono text-xs text-muted-foreground">{stringVal}</span>
        )}
      </div>
    )
  }

  if (field.fieldType === 'select') {
    return (
      <Combobox
        id={id}
        options={opts.map((o) => ({ value: o, label: o }))}
        value={stringVal}
        onChange={onChange}
        disabled={disabled}
        noneLabel="—"
      />
    )
  }

  if (field.fieldType === 'multi-select') {
    const selectedSet = new Set(
      Array.isArray(value) ? (value as unknown[]).map(String) : [],
    )
    const toggle = (opt: string) => {
      const next = new Set(selectedSet)
      if (next.has(opt)) next.delete(opt)
      else next.add(opt)
      onChange([...next])
    }
    return (
      <div className="flex flex-wrap gap-1">
        {opts.map((o) => {
          const on = selectedSet.has(o)
          return (
            <button
              key={o}
              type="button"
              disabled={disabled}
              onClick={() => toggle(o)}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-accent'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
    )
  }

  if (field.fieldType === 'date') {
    return (
      <Input
        id={id}
        type="date"
        value={stringVal}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
      />
    )
  }

  if (field.fieldType === 'number') {
    return (
      <Input
        id={id}
        type="number"
        value={stringVal}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={disabled}
      />
    )
  }

  if (field.fieldType === 'currency') {
    return (
      <Input
        id={id}
        type="number"
        step="0.01"
        value={stringVal}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={disabled}
        placeholder="0,00"
      />
    )
  }

  if (field.fieldType === 'percent') {
    return (
      <Input
        id={id}
        type="number"
        step="0.01"
        min={0}
        max={100}
        value={stringVal}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={disabled}
        placeholder="0–100"
      />
    )
  }

  if (field.fieldType === 'link') {
    return (
      <Input
        id={id}
        type="url"
        value={stringVal}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        placeholder="https://…"
      />
    )
  }

  // text default
  return (
    <Input
      id={id}
      value={stringVal}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  )
}

/**
 * Hook que devolve a lista de custom fields aplicáveis (visível, da entidade
 * que precisa). Por enquanto, retorna todos os customFields ativos —
 * `applies to` ficará pra v2 (requer expansão do registry).
 */
export function useVisibleCustomFields(): CustomFieldDef[] {
  const list = useCatalog('customFields')
  return useMemo(() => {
    return (list.data ?? [])
      .filter((f) => f.active !== false && f.visible !== false)
      .map((f) => ({
        id: f.id,
        name: typeof f.name === 'string' ? f.name : f.id,
        fieldKey:
          typeof f.fieldKey === 'string' ? f.fieldKey : `cf_${f.id}`,
        fieldType: ((f.fieldType as CustomFieldType) ?? 'text') as CustomFieldType,
        required: !!f.required,
        visible: f.visible !== false,
        options: typeof f.options === 'string' ? f.options : undefined,
      }))
  }, [list.data])
}
