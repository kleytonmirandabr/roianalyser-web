/**
 * Calendario mensal de tarefas (Phase 3 P.9).
 * Plota tasks por plannedDate. Click no dia abre detalhe das tarefas.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  MILESTONE_STATUS_COLORS,
  type ProjectMilestone,
} from '@/features/projects2/milestones-types'
import { Button } from '@/shared/ui/button'

interface Props {
  tasks: ProjectMilestone[]
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function ymdKey(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setDate(x.getDate() - x.getDay())
  return x
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function TasksCalendarView({ tasks }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))

  const tasksByDay = useMemo(() => {
    const map: Record<string, ProjectMilestone[]> = {}
    for (const t of tasks) {
      if (t.kind !== 'task' && t.kind !== 'subtask') continue
      if (!t.plannedDate) continue
      const k = ymdKey(t.plannedDate)
      ;(map[k] = map[k] || []).push(t)
    }
    return map
  }, [tasks])

  const grid = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor))
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) cells.push(addDays(start, i))
    return cells
  }, [cursor])

  const cursorYM = ymKey(cursor)
  const todayKey = ymdKey(new Date())

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize">{fmtMonthYear(cursor)}</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="bg-muted px-2 py-1.5 text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">
            {wd}
          </div>
        ))}
        {grid.map((d) => {
          const key = ymdKey(d)
          const inMonth = ymKey(d) === cursorYM
          const items = tasksByDay[key] || []
          const isToday = key === todayKey
          return (
            <div
              key={key}
              className={`bg-background p-1 min-h-[88px] ${!inMonth ? 'opacity-40' : ''} ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}
            >
              <div className={`text-[11px] font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'} mb-1`}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    title={t.title}
                    className={`text-[10px] truncate rounded px-1 py-0.5 ${MILESTONE_STATUS_COLORS[t.status]}`}
                  >
                    {t.title}
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{items.length - 3} mais</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {tasks.filter(t => t.plannedDate && (t.kind === 'task' || t.kind === 'subtask')).length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center pt-2">
          Nenhuma tarefa com data prevista. Defina o prazo nas tarefas para ve-las aqui.
        </p>
      )}
    </div>
  )
}
