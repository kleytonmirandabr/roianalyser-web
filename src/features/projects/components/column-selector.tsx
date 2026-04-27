/**
 * Seletor de colunas pra Lista de Projetos.
 *
 * - Botão "Colunas" abre popover.
 * - Lista de checkboxes na ordem ativa.
 * - Drag handle pra reordenar.
 * - Botão "Restaurar padrão".
 * - Persistência em localStorage (`planflow.projects.columns`).
 *
 * Pra desligar o checkbox, basta clicar. Pra reordenar, arraste a linha
 * pelo handle (`GripVertical`). A coluna `name` é fixa (não pode sumir).
 */
import { Columns3, GripVertical, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PROJECT_FIELDS,
  PROJECT_FIELDS_BY_KEY,
  getDefaultEnabledKeys,
  type ProjectField,
} from '@/features/projects/lib/project-fields'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'

const STORAGE_KEY = 'planflow.projects.columns'

type ColumnsState = string[] // array de keys, na ordem desejada

function readStored(): ColumnsState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.filter((k) => typeof k === 'string' && PROJECT_FIELDS_BY_KEY[k])
  } catch {
    return null
  }
}

function persist(state: ColumnsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignora — sem localStorage funciona em memória só.
  }
}

/**
 * Hook que devolve as colunas ativas (na ordem) + actions pra mexer nelas.
 * Reinicializa quando localStorage muda em outra aba (raro, mas suportado).
 */
export function useColumnSelector() {
  const [enabled, setEnabled] = useState<ColumnsState>(
    () => readStored() ?? getDefaultEnabledKeys(),
  )

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const next = readStored()
      if (next) setEnabled(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback((key: string) => {
    setEnabled((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      persist(next)
      return next
    })
  }, [])

  const reorder = useCallback((fromKey: string, toKey: string) => {
    setEnabled((prev) => {
      const fromIdx = prev.indexOf(fromKey)
      const toIdx = prev.indexOf(toKey)
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      persist(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const defaults = getDefaultEnabledKeys()
    setEnabled(defaults)
    persist(defaults)
  }, [])

  // Resolvendo pra objetos completos (na ordem). Filtra keys inválidas
  // (ex: se PROJECT_FIELDS removeu algo no futuro).
  const visibleFields = useMemo<ProjectField[]>(
    () => enabled.map((k) => PROJECT_FIELDS_BY_KEY[k]).filter(Boolean),
    [enabled],
  )

  return { enabled, visibleFields, toggle, reorder, reset }
}

export function ColumnSelector({
  state,
}: {
  state: ReturnType<typeof useColumnSelector>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggedKey, setDraggedKey] = useState<string | null>(null)

  // Click fora fecha.
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

  // Lista combinada na ORDEM atual (enabled primeiro, depois disabled
  // mantendo ordem do registry). Pra que user possa ligar/reordenar tudo.
  const orderedAll = useMemo(() => {
    const enabledKeys = new Set(state.enabled)
    const enabled = state.enabled.map((k) => PROJECT_FIELDS_BY_KEY[k]).filter(Boolean)
    const disabled = PROJECT_FIELDS.filter((f) => !enabledKeys.has(f.key))
    return [...enabled, ...disabled]
  }, [state.enabled])

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className="gap-2"
      >
        <Columns3 className="h-4 w-4" />
        <span>
          {t('projects.columnSelector.button', { defaultValue: 'Colunas' })}
        </span>
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border p-2 text-xs">
            <span className="font-medium text-foreground">
              {t('projects.columnSelector.title', {
                defaultValue: 'Colunas visíveis',
              })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={state.reset}
            >
              <RotateCcw className="h-3 w-3" />
              {t('projects.columnSelector.reset', { defaultValue: 'Padrão' })}
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto p-1">
            {orderedAll.map((field) => {
              const checked = state.enabled.includes(field.key)
              const isLocked = field.removable === false
              return (
                <div
                  key={field.key}
                  draggable={checked && !isLocked}
                  onDragStart={() => setDraggedKey(field.key)}
                  onDragEnd={() => setDraggedKey(null)}
                  onDragOver={(e) => {
                    if (draggedKey && draggedKey !== field.key && checked) {
                      e.preventDefault()
                    }
                  }}
                  onDrop={() => {
                    if (draggedKey && draggedKey !== field.key) {
                      state.reorder(draggedKey, field.key)
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent',
                    draggedKey === field.key && 'opacity-50',
                  )}
                >
                  <GripVertical
                    className={cn(
                      'h-3 w-3 shrink-0 text-muted-foreground',
                      (!checked || isLocked) && 'opacity-30',
                    )}
                  />
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLocked}
                    onChange={() => !isLocked && state.toggle(field.key)}
                    className="cursor-pointer"
                  />
                  <span
                    className={cn(
                      'flex-1 truncate',
                      !checked && 'text-muted-foreground',
                    )}
                  >
                    {field.label}
                  </span>
                  {isLocked && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                      {t('projects.columnSelector.fixed', {
                        defaultValue: 'fixa',
                      })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
