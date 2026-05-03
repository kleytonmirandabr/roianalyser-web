/**
 * Funções utilitárias e constantes da tabela de tarefas.
 * Puras (sem side effects) — fáceis de testar e reutilizar.
 */
import type { ProjectTaskColumn } from '@/features/projects2/task-columns-types'
import type { ColFilter, FilterKind } from './types'

// ─── Paleta para pills de select/status ──────────────────────────────────────
export const PILL_PALETTE = [
  'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400',
  'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-950/50 dark:text-pink-300',
]

// ─── Larguras e alinhamentos padrão por tipo de coluna ───────────────────────
export const COL_WIDTH: Record<string, string> = {
  text: '160px', long_text: '200px', number: '100px', currency: '130px',
  percent: '90px', progress: '90px', date: '130px', date_range: '260px',
  checkbox: '70px', rating: '110px', select: '150px', status: '150px', link: '180px',
}

export const COL_ALIGN: Record<string, 'left' | 'right' | 'center'> = {
  number: 'center', currency: 'right', percent: 'center',
  progress: 'center', date: 'center', checkbox: 'center', rating: 'center',
  select: 'center', status: 'center',
}

// Colunas que nunca podem ser ocultadas (estruturais)
export const NON_HIDEABLE = new Set(['drag', 'expand', 'check', 'title', 'addCol', 'rowActions'])

// ─── Helpers de formatação ────────────────────────────────────────────────────
export function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) }
  catch { return iso }
}

export function relativeTime(iso: string | null): string {
  if (!iso) return ''
  try {
    const sec = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
    if (sec < 60)  return `${sec}s`
    const min = Math.round(sec / 60); if (min < 60)  return `${min}m`
    const hr  = Math.round(min / 60); if (hr  < 24)  return `${hr}h`
    const day = Math.round(hr  / 24); if (day <  7)  return `${day}d`
    if (day < 30)  return `${Math.round(day / 7)}sem`
    if (day < 365) return `${Math.round(day / 30)}mes`
    return `${Math.round(day / 365)}ano`
  } catch { return '' }
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Lógica de filtros ────────────────────────────────────────────────────────
export function isFilterActive(f: ColFilter): boolean {
  switch (f.kind) {
    case 'text':   return f.contains.trim() !== ''
    case 'select': return f.values.length > 0
    case 'date':   return f.from !== '' || f.to !== ''
    case 'number': return f.val.trim() !== ''
    case 'people': return f.ids.length > 0
    case 'bool':   return f.checked !== null
  }
}

export function matchColFilter(value: any, f: ColFilter): boolean {
  switch (f.kind) {
    case 'text':
      return String(value ?? '').toLowerCase().includes(f.contains.toLowerCase())
    case 'select':
      return f.values.includes(String(value ?? ''))
    case 'date': {
      let d: string
      if (value && typeof value === 'object' && 'start' in value) {
        d = ((value as { start?: string }).start ?? '').slice(0, 10)
      } else {
        d = String(value ?? '').slice(0, 10)
      }
      if (!d) return false
      if (f.from && d < f.from) return false
      if (f.to   && d > f.to)   return false
      return true
    }
    case 'number': {
      const n = Number(value ?? 0)
      const v = Number(f.val)
      if (isNaN(v)) return true
      switch (f.op) {
        case 'eq':  return n === v
        case 'lt':  return n <  v
        case 'gt':  return n >  v
        case 'lte': return n <= v
        case 'gte': return n >= v
        default:    return true
      }
    }
    case 'people': {
      const ids = Array.isArray(value) ? value : []
      return f.ids.some(id => ids.includes(id))
    }
    case 'bool':
      if (f.checked === null) return true
      return !!value === f.checked
  }
}

export function getFilterKind(colKey: string, customCol?: ProjectTaskColumn): FilterKind | null {
  if (colKey === 'title')                           return 'text'
  if (colKey === 'plannedDate' || colKey === 'updatedAt') return 'date'
  if (colKey === 'status')                          return 'select'
  if (colKey === 'responsible')                     return 'people'
  if (colKey === 'progress')                        return 'number'
  if (!customCol) return null
  switch (customCol.type) {
    case 'text': case 'long_text': case 'link':                               return 'text'
    case 'number': case 'currency': case 'percent': case 'progress': case 'rating': return 'number'
    case 'date': case 'date_range':                                           return 'date'
    case 'select': case 'status':                                             return 'select'
    case 'checkbox':                                                          return 'bool'
    default: return null
  }
}
