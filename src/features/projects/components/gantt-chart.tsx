/**
 * Gantt visual com barras de intervalo (Onda 3.B).
 *
 * Suporta o novo schema de marcos com `plannedStartDate` → `plannedEndDate`,
 * progresso 0-100, dependências (`dependsOn`) e markers separados pra
 * início/fim realizados (`actualStartDate` / `actualEndDate`).
 *
 * Compat: quando o marco só tem `plannedDate` (legado), tratamos como
 * marco-ponto: a barra fica como pequeno losango na data prevista.
 *
 * Layout
 *   - LEFT_LABEL_WIDTH (200px) pro nome do marco
 *   - Header com ticks de mês
 *   - Linha do "hoje" tracejada na cor primária
 *   - Por linha: barra previsto (interval ou ponto) → barra realizado → progress fill
 *   - Linhas de dependência: SVG path do fim do dependency até o início do dependente
 *
 * SVG nativo (zero dependência), ~5kb gzipped quando renderizado.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { effectiveStatus, type Milestone } from '@/features/projects/lib/milestones'
import { cn } from '@/shared/lib/cn'

type GanttRow = {
  milestone: Milestone
  /** Data efetiva de início previsto (start ?? end ?? plannedDate). */
  plannedStart: Date | null
  /** Data efetiva de fim previsto (end ?? plannedDate ?? start). */
  plannedEnd: Date | null
  /** Quando start === end → marco-ponto (legado). Render em losango. */
  isPoint: boolean
  actualStart: Date | null
  actualEnd: Date | null
  effective: ReturnType<typeof effectiveStatus>
  /** Progresso 0-100. */
  progress: number
}

const STATUS_FILL: Record<string, string> = {
  pending: '#f59e0b', // amber-500
  'in-progress': '#3b82f6', // blue-500
  done: '#10b981', // emerald-500
  late: '#ef4444', // red-500
  blocked: '#a855f7', // purple-500
}

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 32
const LEFT_LABEL_WIDTH = 200
const BAR_HEIGHT = 18
const BAR_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2

export function GanttChart({ milestones }: { milestones: Milestone[] }) {
  const { t, i18n } = useTranslation()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  /* ─── Normaliza datas: cobre legado (plannedDate) e novo schema ─── */
  const rowsRaw = useMemo<GanttRow[]>(() => {
    return milestones
      .map((m) => {
        const planStart = parseIso(m.plannedStartDate ?? m.plannedDate)
        const planEnd = parseIso(m.plannedEndDate ?? m.plannedDate)
        const actStart = parseIso(m.actualStartDate)
        const actEnd = parseIso(m.actualEndDate ?? m.actualDate)
        // Resolve casos de só uma das datas previstas: usa a outra pra ambos.
        const start = planStart ?? planEnd
        const end = planEnd ?? planStart
        const isPoint =
          start && end && start.getTime() === end.getTime() ? true : false
        return {
          milestone: m,
          plannedStart: start,
          plannedEnd: end,
          isPoint,
          actualStart: actStart,
          actualEnd: actEnd,
          effective: effectiveStatus(m),
          progress: clampProgress(m.progress),
        }
      })
      .filter((r) => r.plannedStart || r.plannedEnd || r.actualStart || r.actualEnd)
  }, [milestones])

  /* ─── Domínio do eixo X: min/max de qualquer data conhecida ─── */
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (rowsRaw.length === 0) {
      const today = startOfDay(new Date())
      return { minDate: today, maxDate: today, totalDays: 1 }
    }
    let min: Date | null = null
    let max: Date | null = null
    for (const r of rowsRaw) {
      for (const d of [r.plannedStart, r.plannedEnd, r.actualStart, r.actualEnd]) {
        if (!d) continue
        if (!min || d < min) min = d
        if (!max || d > max) max = d
      }
    }
    if (!min || !max) {
      const today = startOfDay(new Date())
      return { minDate: today, maxDate: today, totalDays: 1 }
    }
    // Buffer 7 dias antes/depois pra não cortar barras.
    min = new Date(min.getTime() - 7 * 86400000)
    max = new Date(max.getTime() + 7 * 86400000)
    const days = Math.max(
      1,
      Math.round((max.getTime() - min.getTime()) / 86400000),
    )
    return { minDate: min, maxDate: max, totalDays: days }
  }, [rowsRaw])

  // Ordena por data de início (ou fim se não tiver) — ordem visual cronológica.
  const rows: GanttRow[] = useMemo(() => {
    return [...rowsRaw].sort((a, b) => {
      const aT = (a.plannedStart ?? a.plannedEnd ?? new Date(0)).getTime()
      const bT = (b.plannedStart ?? b.plannedEnd ?? new Date(0)).getTime()
      return aT - bT
    })
  }, [rowsRaw])

  // Mapa id→index pra desenhar linhas de dependência.
  const indexById = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((r, i) => map.set(r.milestone.id, i))
    return map
  }, [rows])

  // Px por dia: escala adaptativa entre 2 e 12 px/dia, máximo ~1100px de timeline.
  const PX_PER_DAY = Math.max(2, Math.min(12, 1100 / totalDays))
  const TIMELINE_WIDTH = Math.round(totalDays * PX_PER_DAY)
  const TOTAL_WIDTH = LEFT_LABEL_WIDTH + TIMELINE_WIDTH

  const monthTicks = useMemo(() => {
    const ticks: { x: number; label: string }[] = []
    const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    const end = maxDate
    const fmt = new Intl.DateTimeFormat(i18n.language || 'pt', {
      month: 'short',
      year: '2-digit',
    })
    while (cursor <= end) {
      const x = dateToX(cursor, minDate, PX_PER_DAY)
      ticks.push({ x, label: fmt.format(cursor) })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return ticks
  }, [minDate, maxDate, PX_PER_DAY, i18n.language])

  const totalHeight = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 8

  if (rows.length === 0) {
    return null
  }

  const hovered = hoveredId
    ? rows.find((r) => r.milestone.id === hoveredId) ?? null
    : null

  /* ─── Linhas de dependência: pra cada dependsOn[id], puxa do fim
         do dependency até o início do dependente ─── */
  const depPaths: { d: string; tone: string }[] = []
  rows.forEach((r, i) => {
    const deps = r.milestone.dependsOn ?? []
    for (const depId of deps) {
      const j = indexById.get(depId)
      if (j === undefined) continue
      const dep = rows[j]
      const fromX =
        LEFT_LABEL_WIDTH +
        dateToX(dep.plannedEnd ?? dep.plannedStart ?? minDate, minDate, PX_PER_DAY)
      const toX =
        LEFT_LABEL_WIDTH +
        dateToX(r.plannedStart ?? r.plannedEnd ?? minDate, minDate, PX_PER_DAY)
      const fromY = HEADER_HEIGHT + j * ROW_HEIGHT + ROW_HEIGHT / 2
      const toY = HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2
      // Path com cotovelo: sai do fim do dep, desce/sobe e entra no início do dependente.
      const elbow = Math.min(fromX + 12, toX - 4)
      const d = `M ${fromX} ${fromY} L ${elbow} ${fromY} L ${elbow} ${toY} L ${toX} ${toY}`
      depPaths.push({ d, tone: 'hsl(var(--muted-foreground))' })
    }
  })

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <svg
          viewBox={`0 0 ${TOTAL_WIDTH} ${totalHeight}`}
          width={TOTAL_WIDTH}
          height={totalHeight}
          className="block"
          role="img"
          aria-label={t('projects.detail.schedule.ganttTitle')}
        >
          {/* Marker (arrow) reusável p/ linhas de dependência */}
          <defs>
            <marker
              id="gantt-arrow"
              viewBox="0 0 6 6"
              refX="5"
              refY="3"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="hsl(var(--muted-foreground))" />
            </marker>
          </defs>

          {/* Header divisor + ticks de mês */}
          <line
            x1={0}
            x2={TOTAL_WIDTH}
            y1={HEADER_HEIGHT}
            y2={HEADER_HEIGHT}
            stroke="hsl(var(--border))"
          />
          <line
            x1={LEFT_LABEL_WIDTH}
            x2={LEFT_LABEL_WIDTH}
            y1={0}
            y2={totalHeight}
            stroke="hsl(var(--border))"
          />
          {monthTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={LEFT_LABEL_WIDTH + tick.x}
                x2={LEFT_LABEL_WIDTH + tick.x}
                y1={HEADER_HEIGHT}
                y2={totalHeight}
                stroke="hsl(var(--border))"
                strokeOpacity={0.35}
              />
              <text
                x={LEFT_LABEL_WIDTH + tick.x + 3}
                y={20}
                fontSize={10}
                className="fill-muted-foreground"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Linha do "hoje" */}
          {(() => {
            const today = startOfDay(new Date())
            if (today >= minDate && today <= maxDate) {
              const x = LEFT_LABEL_WIDTH + dateToX(today, minDate, PX_PER_DAY)
              return (
                <line
                  x1={x}
                  x2={x}
                  y1={HEADER_HEIGHT}
                  y2={totalHeight}
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.7}
                />
              )
            }
            return null
          })()}

          {/* Linhas de dependência (atrás das barras) */}
          {depPaths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill="none"
              stroke={p.tone}
              strokeWidth={1.2}
              strokeOpacity={0.55}
              strokeDasharray="4 3"
              markerEnd="url(#gantt-arrow)"
            />
          ))}

          {/* Linhas de marco */}
          {rows.map((row, i) => {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT
            const isHovered = hoveredId === row.milestone.id
            const fill = STATUS_FILL[row.effective] ?? '#9ca3af'

            // Posição/largura da barra prevista
            const startX = row.plannedStart
              ? dateToX(row.plannedStart, minDate, PX_PER_DAY)
              : null
            const endX = row.plannedEnd
              ? dateToX(row.plannedEnd, minDate, PX_PER_DAY)
              : null
            const barX = startX != null ? startX : endX ?? 0
            const barW =
              startX != null && endX != null
                ? Math.max(4, endX - startX)
                : 8
            // Quando é marco-ponto (sem intervalo), renderiza losango.
            const isPoint = row.isPoint || startX == null || endX == null

            const actualStartX = row.actualStart
              ? dateToX(row.actualStart, minDate, PX_PER_DAY)
              : null
            const actualEndX = row.actualEnd
              ? dateToX(row.actualEnd, minDate, PX_PER_DAY)
              : null

            return (
              <g
                key={row.milestone.id}
                onMouseEnter={() => setHoveredId(row.milestone.id)}
                onMouseLeave={() =>
                  setHoveredId((h) => (h === row.milestone.id ? null : h))
                }
                className="cursor-pointer"
              >
                {/* Faixa de hover */}
                {isHovered && (
                  <rect
                    x={0}
                    y={y}
                    width={TOTAL_WIDTH}
                    height={ROW_HEIGHT}
                    fill="hsl(var(--accent))"
                    fillOpacity={0.4}
                  />
                )}

                {/* Label do marco (truncado, indenta sub-tarefas) */}
                <text
                  x={8}
                  y={y + ROW_HEIGHT / 2 + 4}
                  fontSize={12}
                  className="fill-foreground"
                >
                  <title>{row.milestone.title}</title>
                  {truncate(row.milestone.title || '—', 28)}
                </text>

                {/* ── Barra prevista (interval ou losango) ── */}
                {isPoint ? (
                  // Losango pra marco-ponto
                  <polygon
                    points={diamondPoints(
                      LEFT_LABEL_WIDTH + barX,
                      y + ROW_HEIGHT / 2,
                      8,
                    )}
                    fill={fill}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                ) : (
                  <>
                    {/* Faixa de fundo (semi-transparente) */}
                    <rect
                      x={LEFT_LABEL_WIDTH + barX}
                      y={y + BAR_PADDING}
                      width={barW}
                      height={BAR_HEIGHT}
                      rx={3}
                      fill={fill}
                      fillOpacity={0.25}
                      stroke={fill}
                      strokeOpacity={0.5}
                      strokeWidth={1}
                    />
                    {/* Faixa preenchida proporcional ao % de progresso */}
                    {row.progress > 0 && (
                      <rect
                        x={LEFT_LABEL_WIDTH + barX}
                        y={y + BAR_PADDING}
                        width={Math.max(2, (barW * row.progress) / 100)}
                        height={BAR_HEIGHT}
                        rx={3}
                        fill={fill}
                        fillOpacity={0.85}
                      />
                    )}
                    {/* Texto do progresso dentro da barra (se couber) */}
                    {row.progress > 0 && barW > 30 && (
                      <text
                        x={LEFT_LABEL_WIDTH + barX + 4}
                        y={y + ROW_HEIGHT / 2 + 4}
                        fontSize={10}
                        fontWeight={600}
                        fill="white"
                        style={{ pointerEvents: 'none' }}
                      >
                        {row.progress}%
                      </text>
                    )}
                  </>
                )}

                {/* ── Markers de realizado ── */}
                {/* Linha conectora actualStart → actualEnd quando ambos */}
                {actualStartX != null && actualEndX != null && (
                  <line
                    x1={LEFT_LABEL_WIDTH + actualStartX}
                    x2={LEFT_LABEL_WIDTH + actualEndX}
                    y1={y + ROW_HEIGHT / 2 + 10}
                    y2={y + ROW_HEIGHT / 2 + 10}
                    stroke={fill}
                    strokeWidth={2}
                    strokeOpacity={0.85}
                  />
                )}
                {actualStartX != null && (
                  <circle
                    cx={LEFT_LABEL_WIDTH + actualStartX}
                    cy={y + ROW_HEIGHT / 2 + 10}
                    r={4}
                    fill="hsl(var(--background))"
                    stroke={fill}
                    strokeWidth={2}
                  />
                )}
                {actualEndX != null && (
                  <circle
                    cx={LEFT_LABEL_WIDTH + actualEndX}
                    cy={y + ROW_HEIGHT / 2 + 10}
                    r={5}
                    fill={fill}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Painel de detalhe ao hover */}
      {hovered ? (
        <div className="rounded-md border border-border bg-card p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-foreground">
              {hovered.milestone.title || '—'}
            </span>
            <span
              className={cn('text-xs font-medium')}
              style={{ color: STATUS_FILL[hovered.effective] }}
            >
              {t(`projects.detail.schedule.status.${hovered.effective}`)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {(hovered.plannedStart || hovered.plannedEnd) && (
              <span>
                {t('projects.detail.schedule.plannedRange')}:{' '}
                <span className="tabular-nums text-foreground">
                  {formatRange(
                    hovered.plannedStart,
                    hovered.plannedEnd,
                    i18n.language,
                  )}
                </span>
              </span>
            )}
            {(hovered.actualStart || hovered.actualEnd) && (
              <span>
                {t('projects.detail.schedule.actualRange')}:{' '}
                <span className="tabular-nums text-foreground">
                  {formatRange(
                    hovered.actualStart,
                    hovered.actualEnd,
                    i18n.language,
                  )}
                </span>
              </span>
            )}
            {hovered.progress > 0 && (
              <span>
                {t('projects.detail.schedule.progressLabel')}:{' '}
                <span className="tabular-nums text-foreground">
                  {hovered.progress}%
                </span>
              </span>
            )}
            {(() => {
              // Variação previsto vs realizado: usa fim de cada lado.
              if (!hovered.actualEnd || !hovered.plannedEnd) return null
              const diffDays = Math.round(
                (hovered.actualEnd.getTime() - hovered.plannedEnd.getTime()) /
                  86400000,
              )
              if (diffDays === 0) return null
              return (
                <span
                  className={cn(
                    'tabular-nums',
                    diffDays > 0 ? 'text-destructive' : 'text-emerald-600',
                  )}
                >
                  {diffDays > 0
                    ? t('projects.detail.schedule.lateBy', { n: diffDays })
                    : t('projects.detail.schedule.earlyBy', { n: -diffDays })}
                </span>
              )
            })()}
          </div>
          {(hovered.milestone.dependsOn?.length ?? 0) > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              {t('projects.detail.schedule.dependsOnLabel')}:{' '}
              <span className="text-foreground">
                {(hovered.milestone.dependsOn ?? [])
                  .map((id) => {
                    const dep = rows.find((r) => r.milestone.id === id)
                    return dep?.milestone.title || id
                  })
                  .join(', ')}
              </span>
            </div>
          )}
          {hovered.milestone.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {hovered.milestone.description}
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {t('projects.detail.schedule.ganttHint')}
        </p>
      )}
    </div>
  )
}

// — helpers —

function parseIso(s: string | null | undefined): Date | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  // Constrói data em UTC pra evitar shift por timezone (idem schedule.tsx).
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

function dateToX(date: Date, base: Date, pxPerDay: number): number {
  const days = Math.round((date.getTime() - base.getTime()) / 86400000)
  return days * pxPerDay
}

function clampProgress(p: number | undefined): number {
  if (typeof p !== 'number' || Number.isNaN(p)) return 0
  return Math.max(0, Math.min(100, Math.round(p)))
}

function diamondPoints(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

function formatRange(
  a: Date | null,
  b: Date | null,
  locale?: string,
): string {
  const fmt = new Intl.DateTimeFormat(locale || 'pt', {
    day: '2-digit',
    month: 'short',
  })
  if (a && b) {
    if (a.getTime() === b.getTime()) return fmt.format(a)
    return `${fmt.format(a)} → ${fmt.format(b)}`
  }
  if (a) return fmt.format(a)
  if (b) return fmt.format(b)
  return '—'
}
