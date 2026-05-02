/**
 * Combobox — substituto pra <select> que tem busca dentro.
 *
 * Implementação intencionalmente leve: abre um painel absolutamente
 * posicionado abaixo do trigger, com Input no topo e lista filtrada
 * embaixo. Sem dependência de Popover/cmdk pra manter o bundle enxuto.
 *
 * Uso básico:
 *   <Combobox
 *     options={clients.map(c => ({ value: c.id, label: c.name }))}
 *     value={draft.clientId}
 *     onChange={(v) => patch('clientId', v)}
 *     placeholder={t('admin.users.field.client')}
 *   />
 */
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import { cn } from '@/shared/lib/cn'

export type ComboboxOption = {
  value: string
  label: string
  /** Opcional — quando definido, mostra abaixo do label (ex: "São Paulo / SP"). */
  hint?: string
  /** Opcional — desabilita a opção. */
  disabled?: boolean
  /** Opcional — ícone à esquerda do label. */
  icon?: React.ReactNode
  /**
   * Opcional — quando definido em qualquer opção, ativa renderização
   * agrupada (`<optgroup>`-style). Opções sem `group` ficam num grupo
   * "(Sem categoria)" no topo. Útil pra select de itens de catálogo
   * agrupados pela categoria deles.
   */
  group?: string
}

export type ComboboxProps = {
  options: ComboboxOption[]
  value?: string | null
  onChange?: (value: string) => void
  placeholder?: string
  /** Texto exibido quando o filtro não encontra nada. Default: "Sem resultados". */
  emptyText?: string
  /** Largura do trigger (default: w-full). */
  className?: string
  disabled?: boolean
  required?: boolean
  /** Identifica o campo (id de label). */
  id?: string
  /** Nome usado em formulários nativos. */
  name?: string
  /** Permite limpar a seleção (mostra "x" no canto). Default false. */
  clearable?: boolean
  /** Texto pra opção "limpar"/"nenhum". Aparece como primeiro item se setado. */
  noneLabel?: string
}

export const Combobox = forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = 'Selecione...',
      emptyText = 'Sem resultados',
      className,
      disabled,
      required,
      id,
      name,
      noneLabel,
    },
    ref,
  ) => {
    const internalId = useId()
    const buttonId = id ?? internalId
    const [open, setOpen] = useState(false)
    const [filter, setFilter] = useState('')
    const [highlight, setHighlight] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    const selected = useMemo(
      () => options.find((o) => o.value === value) ?? null,
      [options, value],
    )

    const filteredOptions = useMemo(() => {
      const q = filter.trim().toLowerCase()
      if (!q) return options
      return options.filter((o) => {
        const text = `${o.label} ${o.hint ?? ''}`.toLowerCase()
        return text.includes(q)
      })
    }, [options, filter])

    // Click fora fecha
    useEffect(() => {
      if (!open) return
      const onClick = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', onClick)
      return () => document.removeEventListener('mousedown', onClick)
    }, [open])

    // Foca no input ao abrir
    useEffect(() => {
      if (open) {
        setFilter('')
        setHighlight(0)
        // Pequeno delay pra esperar o portal renderizar
        const t = setTimeout(() => inputRef.current?.focus(), 0)
        return () => clearTimeout(t)
      }
    }, [open])

    // Mantém o item destacado visível ao navegar
    useEffect(() => {
      if (!open) return
      const list = listRef.current
      if (!list) return
      const item = list.children[highlight] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }, [highlight, open])

    const handleSelect = useCallback(
      (val: string) => {
        onChange?.(val)
        setOpen(false)
      },
      [onChange],
    )

    const handleKey = (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault()
          setOpen(true)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) =>
          Math.min(filteredOptions.length - 1 + (noneLabel ? 1 : 0), h + 1),
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => Math.max(0, h - 1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (noneLabel && highlight === 0) {
          handleSelect('')
          return
        }
        const idx = noneLabel ? highlight - 1 : highlight
        const opt = filteredOptions[idx]
        if (opt && !opt.disabled) handleSelect(opt.value)
      }
    }

    return (
      <div ref={containerRef} className={cn('relative', className)}>
        {/* Hidden native input para integrar com forms (validation/required) */}
        {name && (
          <input
            type="hidden"
            name={name}
            value={value ?? ''}
            required={required}
          />
        )}
        <button
          ref={ref}
          id={buttonId}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={handleKey}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected?.icon}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>

        {open && (() => {
          // Helper local pra renderizar uma <li> de option. Usado tanto
          // pela lista flat quanto pelos sub-listas dentro de grupos.
          const renderOption = (opt: ComboboxOption, adjustedIndex: number) => {
            const isSelected = opt.value === value
            const isHighlighted = adjustedIndex === highlight
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(adjustedIndex)}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm',
                  isHighlighted && 'bg-accent',
                  opt.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <Check
                  className={cn(
                    'h-4 w-4 shrink-0 text-primary',
                    isSelected ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {opt.icon}
                <span className="flex flex-col">
                  <span className="whitespace-nowrap">{opt.label}</span>
                  {opt.hint && (
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {opt.hint}
                    </span>
                  )}
                </span>
              </li>
            )
          }
          return (
          <div
            className="absolute left-0 top-full z-50 mt-1 max-h-72 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg min-w-full w-max max-w-xs"
            onKeyDown={handleKey}
          >
            <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value)
                  setHighlight(0)
                }}
                onKeyDown={handleKey}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul
              ref={listRef}
              role="listbox"
              className="max-h-56 overflow-y-auto p-1"
            >
              {noneLabel && (
                <li
                  role="option"
                  aria-selected={!selected}
                  onMouseEnter={() => setHighlight(0)}
                  onClick={() => handleSelect('')}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm italic text-muted-foreground hover:bg-accent',
                    highlight === 0 && 'bg-accent',
                  )}
                >
                  <span className="ml-6">{noneLabel}</span>
                </li>
              )}
              {filteredOptions.length === 0 ? (
                <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                  {emptyText}
                </li>
              ) : (
                (() => {
                  // Detecta se algum option tem `group` definido —
                  // nesse caso, renderiza com cabeçalhos agrupados.
                  const hasGroups = filteredOptions.some(
                    (o) => typeof o.group === 'string' && o.group.trim() !== '',
                  )
                  if (!hasGroups) {
                    return filteredOptions.map((opt, i) =>
                      renderOption(opt, noneLabel ? i + 1 : i),
                    )
                  }
                  // Agrupa preservando a ordem da primeira ocorrência
                  // de cada grupo. Itens sem `group` viram "—".
                  const groups: { name: string; opts: ComboboxOption[] }[] = []
                  const groupIndex = new Map<string, number>()
                  for (const opt of filteredOptions) {
                    const key = opt.group?.trim() || '—'
                    if (!groupIndex.has(key)) {
                      groupIndex.set(key, groups.length)
                      groups.push({ name: key, opts: [] })
                    }
                    groups[groupIndex.get(key)!].opts.push(opt)
                  }
                  let runningIndex = noneLabel ? 1 : 0
                  return groups.map((g) => (
                    <li key={`grp-${g.name}`} className="list-none">
                      <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.name}
                      </div>
                      <ul role="group">
                        {g.opts.map((opt) => {
                          const idx = runningIndex++
                          return renderOption(opt, idx)
                        })}
                      </ul>
                    </li>
                  ))
                })()
              )}
            </ul>
          </div>
          )
        })()}
      </div>
    )
  },
)
Combobox.displayName = 'Combobox'
