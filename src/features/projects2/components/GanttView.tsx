/**
 * GanttView — Sprint 3.8.
 *
 * Visualização Gantt (linha do tempo) das tarefas do projeto.
 * Layout: coluna fixa de nomes (240px) + scroll horizontal por meses.
 * Cada task com plannedDate gera uma barra posicionada no mês correto.
 * Groups são exibidos como cabeçalhos; subtasks são indentadas.
 */
import { useMemo } from 'react'

import {
  MILESTONE_STATUS_COLORS,
  MILESTONE_STATUS_LABELS,
  type ProjectMilestone,
} from '@/features/projects2/milestones-types'
import { cn } from '@/shared/lib/cn'

interface Props {
  tasks: ProjectMilestone[]
}

const MONTH_WIDTH = 120 // px por mês
const ROW_H = 36        // px por linha

const PT_MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

function parseYM(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split('-').map(Number)
  return { year: y, month: m - 1 } // month 0-indexed
}

function monthsDiff(from: { year: number; month: number }, to: { year: number; month: number }) {
  return (to.year - from.year) * 12 + (to.month - from.month)
}

/** Retorna a cor CSS de fundo (hex ou tailwind inline) do status */
const STATUS_BAR_COLORS: Record<string, string> = {
  planning:    '#94a3b8',
  in_progress: '#3b82f6',
  waiting:     '#f59e0b',
  done:        '#22c55e',
  cancelled:   '#f43f5e',
}

export function GanttView({ tasks }: Props) {
  // Descobre range de meses com base nos plannedDates
  const { origin, months } = useMemo(() => {
    const dates = tasks
      .filter((t) => t.plannedDate)
      .map((t) => parseYM(t.plannedDate!))
    if (dates.length === 0) {
      const now = new Date()
      const o = { year: now.getFullYear(), month: now.getMonth() }
      return { origin: o, months: 12 }
    }
    const minYear = Math.min(...dates.map((d) => d.year))
    const maxYear = Math.max(...dates.map((d) => d.year))
    const minMonth = Math.min(...dates.filter((d) => d.year === minYear).map((d) => d.month))
    const maxMonth = Math.max(...dates.filter((d) => d.year === maxYear).map((d) => d.month))
    const o = { year: minYear, month: Math.max(0, minMonth - 1) }
    const span = monthsDiff(o, { year: maxYear, month: maxMonth }) + 2
    return { origin: o, months: Math.max(span, 6) }
  }, [tasks])

  // Gera lista de labels de colunas (mês/ano)
  const colHeaders = useMemo(() => {
    const headers: { label: string; year: number; month: number }[] = []
    for (let i = 0; i < months; i++) {
      const total = origin.month + i
      const year = origin.year + Math.floor(total / 12)
      const month = total % 12
      headers.push({ label: `${PT_MONTHS[month]} ${year}`, year, month })
    }
    return headers
  }, [origin, months])

  // Agrupa tasks: groups no topo, tasks/subtasks abaixo
  const rows = useMemo(() => {
    const groups = tasks.filter((t) => t.kind === 'group')
    const tasksByGroup: Record<string, ProjectMilestone[]> = {}
    const rootTasks: ProjectMilestone[] = []
    for (const t of tasks) {
      if (t.kind === 'task') {
        if (t.parentId) {
          ;(tasksByGroup[t.parentId] = tasksByGroup[t.parentId] || []).push(t)
        } else {
          rootTasks.push(t)
        }
      }
    }
    const subtasksByTask: Record<string, ProjectMilestone[]> = {}
    for (const t of tasks) {
      if (t.kind === 'subtask' && t.parentId) {
        ;(subtasksByTask[t.parentId] = subtasksByTask[t.parentId] || []).push(t)
      }
    }

    type Row = { task: ProjectMilestone; indent: number }
    const result: Row[] = []

    for (const g of groups) {
      result.push({ task: g, indent: 0 })
      for (const t of tasksByGroup[g.id] || []) {
        result.push({ task: t, indent: 1 })
        for (const s of subtasksByTask[t.id] || []) {
          result.push({ task: s, indent: 2 })
        }
      }
    }
    for (const t of rootTasks) {
      result.push({ task: t, indent: 0 })
      for (const s of subtasksByTask[t.id] || []) {
        result.push({ task: s, indent: 1 })
      }
    }
    return result
  }, [tasks])

  const totalWidth = months * MONTH_WIDTH

  if (tasks.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-muted-foreground">
        Nenhuma tarefa neste projeto.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${240 + totalWidth}px` }}>
        {/* Header de meses */}
        <div className="flex border-b border-border sticky top-0 bg-background z-10">
          {/* Coluna de nome fixa */}
          <div
            className="shrink-0 border-r border-border bg-muted/30 px-3 flex items-center"
            style={{ width: 240, height: ROW_H }}
          >
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarefa</span>
          </div>
          {/* Colunas de meses */}
          {colHeaders.map((h) => (
            <div
              key={`${h.year}-${h.month}`}
              className="shrink-0 border-r border-border bg-muted/30 flex items-center justify-center"
              style={{ width: MONTH_WIDTH, height: ROW_H }}
            >
              <span className="text-xs text-muted-foreground font-medium">{h.label}</span>
            </div>
          ))}
        </div>

        {/* Linhas de tasks */}
        {rows.map(({ task, indent }) => {
          const isGroup = task.kind === 'group'
          const barCol = task.plannedDate ? parseYM(task.plannedDate) : null
          const barOffset = barCol ? monthsDiff(origin, barCol) : null
          const barColor = STATUS_BAR_COLORS[task.status] || '#94a3b8'

          return (
            <div
              key={task.id}
              className={cn(
                'flex border-b border-border hover:bg-muted/20 transition-colors',
                isGroup && 'bg-muted/40',
              )}
              style={{ height: ROW_H }}
            >
              {/* Coluna de nome */}
              <div
                className="shrink-0 border-r border-border flex items-center gap-1.5 px-3"
                style={{ width: 240, paddingLeft: `${12 + indent * 16}px` }}
              >
                {isGroup && (
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: barColor }} />
                )}
                <span
                  className={cn(
                    'truncate text-sm',
                    isGroup ? 'font-semibold' : 'text-foreground',
                  )}
                  title={task.title}
                >
                  {task.title}
                </span>
              </div>

              {/* Grade de meses + barra */}
              <div className="flex-1 relative flex" style={{ width: totalWidth }}>
                {/* Linhas de grid vertical */}
                {colHeaders.map((h) => (
                  <div
                    key={`${h.year}-${h.month}`}
                    className="shrink-0 border-r border-border/40"
                    style={{ width: MONTH_WIDTH }}
                  />
                ))}

                {/* Barra Gantt */}
                {barOffset !== null && barOffset >= 0 && barOffset < months && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 rounded-full flex items-center px-2"
                    style={{
                      left: barOffset * MONTH_WIDTH + 4,
                      width: MONTH_WIDTH - 8,
                      height: isGroup ? 14 : 20,
                      background: barColor,
                      opacity: task.status === 'cancelled' ? 0.45 : 1,
                    }}
                    title={`${MILESTONE_STATUS_LABELS[task.status]} — ${task.plannedDate}`}
                  >
                    {!isGroup && (
                      <span className="text-[10px] font-medium text-white truncate leading-none">
                        {task.title}
                      </span>
                    )}
                  </div>
                )}

                {/* Badge de status para tasks sem data */}
                {barOffset === null && !isGroup && (
                  <div className="absolute top-1/2 -translate-y-1/2 left-2">
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium',
                        MILESTONE_STATUS_COLORS[task.status],
                      )}
                    >
                      Sem data
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
